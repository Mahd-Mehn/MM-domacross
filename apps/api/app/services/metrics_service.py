from datetime import datetime, timedelta, timezone
from collections import defaultdict
from math import sqrt
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.database import (
    Participant, PortfolioValueHistory, CompetitionReward, Trade, Domain, ParticipantHolding
)
from app.config import settings
from app import broadcast as _bc

_LEADERBOARD_CACHE: dict[int, tuple[datetime, list[dict]]] = {}

def invalidate_leaderboard_cache(competition_id: int):
    _LEADERBOARD_CACHE.pop(competition_id, None)

def get_ws_latency_snapshot():
    samples = list(getattr(_bc, '_ws_latency_samples', []))
    if not samples:
        return {'count': 0, 'p50': 0, 'p95': 0, 'avg': 0}
    samples_sorted = sorted(samples)
    n = len(samples_sorted)
    def pct(p: float):
        if n == 0:
            return 0
        idx = int(p * (n-1))
        return samples_sorted[idx]
    avg = sum(samples_sorted)/n
    return {'count': n, 'p50': pct(0.50), 'p95': pct(0.95), 'avg': avg}

def _compute_returns(values: list[tuple[datetime, Decimal]]):
    returns: list[float] = []
    for i in range(1, len(values)):
        prev_v = float(values[i-1][1])
        cur_v = float(values[i][1])
        if prev_v > 0:
            returns.append((cur_v - prev_v) / prev_v)
    return returns

def _std(vals: list[float]):
    if len(vals) < 2:
        return 0.0
    mean = sum(vals)/len(vals)
    var = sum((v-mean)**2 for v in vals)/(len(vals)-1)
    return sqrt(var)

def _compute_unrealized_pnl(db: Session, participant_id: int) -> Decimal:
    holdings = db.query(ParticipantHolding).filter(ParticipantHolding.participant_id==participant_id, ParticipantHolding.quantity > 0).all()
    unrealized = Decimal(0)
    for h in holdings:
        dom = db.query(Domain).filter(Domain.name==h.domain_name).first()
        if not dom or dom.last_estimated_value is None:
            continue
        cur_val = Decimal(dom.last_estimated_value)
        avg_cost = Decimal(h.avg_cost or 0)
        qty = Decimal(h.quantity or 0)
        if qty > 0:
            unrealized += (cur_val - avg_cost) * qty
    return unrealized

def get_full_leaderboard(db: Session, competition_id: int, window_minutes: int | None = None):
    now = datetime.now(timezone.utc)
    window = window_minutes or settings.metrics_returns_window_minutes
    ttl = settings.metrics_cache_ttl_seconds
    cached = _LEADERBOARD_CACHE.get(competition_id)
    if cached and (now - cached[0]).total_seconds() < ttl:
        return cached[1]
    cutoff = now - timedelta(minutes=window)
    participants = db.query(Participant).filter(Participant.competition_id==competition_id).all()
    participant_ids = [p.id for p in participants]
    if not participant_ids:
        data: list[dict] = []
        _LEADERBOARD_CACHE[competition_id] = (now, data)
        return data

    # Fetch portfolio value history
    histories = (
        db.query(PortfolioValueHistory)
        .filter(PortfolioValueHistory.participant_id.in_(participant_ids), PortfolioValueHistory.snapshot_time >= cutoff)
        .order_by(PortfolioValueHistory.participant_id.asc(), PortfolioValueHistory.snapshot_time.asc())
        .all()
    )
    grouped_values: dict[int, list[tuple[datetime, Decimal]]] = defaultdict(list)
    for row in histories:
        grouped_values[row.participant_id].append((row.snapshot_time, Decimal(row.value)))

    # Fetch rewards for volume / points / pnl metrics
    rewards = db.query(CompetitionReward).filter(CompetitionReward.competition_id==competition_id).all()
    reward_map: dict[int, CompetitionReward] = {r.user_id: r for r in rewards if r.epoch_id}

    # Compute metrics
    leaderboard: list[dict] = []
    # Risk free daily approximation (annual pct -> per period using 365d)
    rf_annual = settings.risk_free_rate_annual_pct / 100.0
    rf_daily = (1 + rf_annual)**(1/365) - 1 if rf_annual > 0 else 0.0

    for p in participants:
        values = grouped_values.get(p.id, [])
        rets = _compute_returns(values) if values else []
        std = _std(rets)
        mean = sum(rets)/len(rets) if rets else 0.0
        n = len(rets)
        sharpe = 0.0
        if std > 0 and n > 1:
            excess_mean = (mean - rf_daily)
            sharpe = (excess_mean / std) * sqrt(n)
        reward = None
        # Map reward via participant.user_id to reward_map key user_id
        reward = reward_map.get(p.user_id)
        unrealized = _compute_unrealized_pnl(db, p.id)
        realized = Decimal(p.realized_pnl or 0)
        # Persist unrealized pnl for participant record for quick reads
        p.unrealized_pnl = unrealized
        leader_entry = {
            'participant_id': p.id,
            'user_id': p.user_id,
            'portfolio_value': str(p.portfolio_value or 0),
            'realized_pnl': str(realized),
            'unrealized_pnl': str(unrealized),
            'volume': str(reward.volume) if reward and reward.volume is not None else '0',
            'points': str(reward.points) if reward and reward.points is not None else '0',
            'turnover_ratio': str(reward.turnover_ratio) if reward and reward.turnover_ratio is not None else '0',
            'concentration_index': str(reward.concentration_index) if reward and reward.concentration_index is not None else '0',
            'sharpe': f"{sharpe:.6f}",
            'returns_sample': len(rets)
        }
        leaderboard.append(leader_entry)

    # Rank by portfolio value desc
    leaderboard.sort(key=lambda x: Decimal(x['portfolio_value']), reverse=True)
    for idx, entry in enumerate(leaderboard, start=1):
        entry['rank'] = idx

    # Commit any participant unrealized pnl updates (safe lightweight)
    try:
        db.commit()
    except Exception:
        db.rollback()

    _LEADERBOARD_CACHE[competition_id] = (now, leaderboard)
    return leaderboard
