from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from fastapi import Query
from app.database import get_db
from app.models.database import (
    Competition as CompetitionModel,
    Participant as ParticipantModel,
    User as UserModel,
    CompetitionEpoch,
    CompetitionReward,
    PortfolioValueHistory,
)
from app.schemas.competition import (
    Competition,
    CompetitionCreate,
    CompetitionWithLeaderboard,
    LeaderboardEntry,
    PortfolioUpdate,
    Participant as ParticipantSchema,
)
from datetime import datetime, timezone, timedelta
from decimal import Decimal, getcontext
from app.deps.auth import get_current_user, get_current_user_optional
from fastapi import Request
from app.config import settings
from app.broadcast import get_sync_broadcast
from math import sqrt
from app.services.metrics_service import get_full_leaderboard
from decimal import Decimal

getcontext().prec = 28

router = APIRouter()


@router.get("/competitions", response_model=List[Competition])
async def get_competitions(db: Session = Depends(get_db), include_joined_status: bool = False, joined_only: bool = False, current_user: UserModel | None = Depends(get_current_user_optional)):
    comps = db.query(CompetitionModel).all()
    if include_joined_status and current_user:
        # Build participant set for current user
        p_ids = {p.competition_id for p in db.query(ParticipantModel).filter(ParticipantModel.user_id==current_user.id).all()}
        enriched: list[CompetitionModel] = []
        for c in comps:
            if joined_only and c.id not in p_ids:
                continue
            # dynamically add attribute for serialization (pydantic will ignore unknown unless model updated; we can monkey patch attr)
            setattr(c, 'has_joined', c.id in p_ids)
            enriched.append(c)
        comps = enriched
    elif joined_only and current_user:
        p_ids = {p.competition_id for p in db.query(ParticipantModel).filter(ParticipantModel.user_id==current_user.id).all()}
        comps = [c for c in comps if c.id in p_ids]
    return comps


@router.get("/competitions/{competition_id}", response_model=CompetitionWithLeaderboard)
async def get_competition(competition_id: int, db: Session = Depends(get_db), current_user: UserModel | None = Depends(get_current_user_optional)):
    competition = db.query(CompetitionModel).filter(CompetitionModel.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    # Get leaderboard
    leaderboard_query = (
        db.query(
            ParticipantModel.user_id,
            UserModel.wallet_address,
            UserModel.username,
            ParticipantModel.portfolio_value
        )
        .join(UserModel, ParticipantModel.user_id == UserModel.id)
        .filter(ParticipantModel.competition_id == competition_id)
        .order_by(ParticipantModel.portfolio_value.desc())
        .all()
    )

    leaderboard = [
        LeaderboardEntry(
            user_id=row.user_id,
            wallet_address=row.wallet_address,
            username=row.username,
            portfolio_value=row.portfolio_value,
            rank=index + 1
        )
        for index, row in enumerate(leaderboard_query)
    ]

    # Determine if current user has joined
    has_joined: bool | None = None
    if current_user:
        pj = (
            db.query(ParticipantModel)
            .filter(ParticipantModel.competition_id == competition_id, ParticipantModel.user_id == current_user.id)
            .first()
        )
        has_joined = pj is not None

    return CompetitionWithLeaderboard(
        id=competition.id,
        contract_address=competition.contract_address,
        chain_id=competition.chain_id,
        name=competition.name,
        description=competition.description,
        start_time=competition.start_time,
        end_time=competition.end_time,
        entry_fee=competition.entry_fee,
        rules=competition.rules,
        leaderboard=leaderboard,
        has_joined=has_joined,
    )


@router.get('/competitions/{competition_id}/leaderboard/full')
def full_leaderboard(competition_id: int, minutes: int | None = None, db: Session = Depends(get_db)):
    from app.config import settings as cfg
    win = minutes if minutes is not None else cfg.metrics_returns_window_minutes
    data = get_full_leaderboard(db, competition_id, window_minutes=win)
    from app.config import settings
    return { 'competition_id': competition_id, 'window_minutes': win, 'risk_free_rate_annual_pct': settings.risk_free_rate_annual_pct, 'entries': data }


@router.post("/competitions", response_model=Competition)
async def create_competition(competition: CompetitionCreate, db: Session = Depends(get_db), request: Request = None):
    current_user: UserModel | None = None
    # Try auth (best-effort)
    try:
        current_user = await get_current_user(request)  # type: ignore
    except Exception:
        if settings.app_env not in ("local", "test"):
            raise HTTPException(status_code=401, detail="Authentication required")
    if settings.app_env not in ("local", "test"):
        if not current_user or (current_user.wallet_address or "").lower() not in set(settings.admin_wallets):
            raise HTTPException(status_code=403, detail="Admin privileges required")
    comp_data = competition.model_dump()
    # Auto-generate off-chain placeholder if no contract address provided
    if not comp_data.get('contract_address'):
        from uuid import uuid4
        comp_data['contract_address'] = f"offchain-{uuid4().hex[:20]}"
    db_competition = CompetitionModel(**comp_data)
    db.add(db_competition)
    db.commit()
    db.refresh(db_competition)
    return db_competition


@router.post("/competitions/{competition_id}/join", response_model=Competition)
async def join_competition(
    competition_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    competition = db.query(CompetitionModel).filter(CompetitionModel.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    now = datetime.now(timezone.utc)
    if competition.start_time > now:
        raise HTTPException(status_code=400, detail="Competition has not started yet")
    if competition.end_time < now:
        raise HTTPException(status_code=400, detail="Competition has already ended")

    existing = (
        db.query(ParticipantModel)
        .filter(
            ParticipantModel.competition_id == competition_id,
            ParticipantModel.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        return competition

    participant = ParticipantModel(
        user_id=current_user.id,
        competition_id=competition_id,
        portfolio_value=0,
    )
    db.add(participant)
    db.commit()
    return competition


@router.get("/competitions/{competition_id}/participants", response_model=List[ParticipantSchema])
async def list_participants(competition_id: int, db: Session = Depends(get_db)):
    competition = db.query(CompetitionModel).filter(CompetitionModel.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    participants = (
        db.query(ParticipantModel)
        .filter(ParticipantModel.competition_id == competition_id)
        .all()
    )
    return participants


@router.get("/competitions/{competition_id}/leaderboard", response_model=List[LeaderboardEntry])
async def get_competition_leaderboard(competition_id: int, db: Session = Depends(get_db)):
    competition = db.query(CompetitionModel).filter(CompetitionModel.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    leaderboard_query = (
        db.query(
            ParticipantModel.user_id,
            UserModel.wallet_address,
            UserModel.username,
            ParticipantModel.portfolio_value,
        )
        .join(UserModel, ParticipantModel.user_id == UserModel.id)
        .filter(ParticipantModel.competition_id == competition_id)
        .order_by(ParticipantModel.portfolio_value.desc())
        .all()
    )

    leaderboard = [
        LeaderboardEntry(
            user_id=row.user_id,
            wallet_address=row.wallet_address,
            username=row.username,
            portfolio_value=row.portfolio_value,
            rank=index + 1,
        )
        for index, row in enumerate(leaderboard_query)
    ]
    return leaderboard

@router.post("/competitions/{competition_id}/portfolio", response_model=Competition)
async def update_portfolio(
    competition_id: int,
    payload: PortfolioUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    competition = db.query(CompetitionModel).filter(CompetitionModel.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    participant = (
        db.query(ParticipantModel)
        .filter(
            ParticipantModel.competition_id == competition_id,
            ParticipantModel.user_id == current_user.id,
        )
        .first()
    )
    if not participant:
        raise HTTPException(status_code=400, detail="User not joined in this competition")

    participant.portfolio_value = payload.portfolio_value
    db.add(participant)
    db.commit()
    return competition

@router.get('/competitions/{competition_id}/epochs')
async def list_epochs(competition_id: int, db: Session = Depends(get_db)):
    return db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==competition_id).order_by(CompetitionEpoch.epoch_index.asc()).all()

@router.post('/competitions/{competition_id}/epochs')
async def create_epoch(competition_id: int, epoch_index: int, start_time: datetime, end_time: datetime, reward_pool: float | None = None, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    if (current_user.wallet_address or '').lower() not in set(settings.admin_wallets):
        raise HTTPException(status_code=403, detail='Not authorized')
    existing = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==competition_id, CompetitionEpoch.epoch_index==epoch_index).first()
    if existing:
        raise HTTPException(status_code=400, detail='Epoch exists')
    ep = CompetitionEpoch(competition_id=competition_id, epoch_index=epoch_index, start_time=start_time, end_time=end_time, reward_pool=reward_pool)
    db.add(ep); db.commit(); db.refresh(ep)
    return ep

@router.get('/competitions/{competition_id}/rewards/current')
async def current_epoch_rewards(competition_id: int, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    ep = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==competition_id, CompetitionEpoch.start_time <= now, CompetitionEpoch.end_time >= now).first()
    if not ep:
        return {'epoch': None, 'rewards': []}
    rewards = db.query(CompetitionReward).filter(CompetitionReward.epoch_id==ep.id).order_by(CompetitionReward.points.desc()).all()
    return {'epoch': {'id': ep.id, 'index': ep.epoch_index, 'start_time': ep.start_time, 'end_time': ep.end_time, 'reward_pool': str(ep.reward_pool) if ep.reward_pool else None}, 'rewards': [ { 'user_id': r.user_id, 'points': str(r.points), 'volume': str(r.volume or 0), 'pnl': str(r.pnl or 0), 'sharpe_like': str(r.sharpe_like or 0), 'reward_amount': str(r.reward_amount or 0) } for r in rewards ] }

@router.get('/competitions/{competition_id}/portfolio/history/{participant_id}')
async def portfolio_history(competition_id: int, participant_id: int, hours: int = Query(24, le=168), db: Session = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = db.query(PortfolioValueHistory).filter(PortfolioValueHistory.participant_id==participant_id, PortfolioValueHistory.snapshot_time >= cutoff).order_by(PortfolioValueHistory.snapshot_time.asc()).all()
    return [{ 't': r.snapshot_time.isoformat(), 'v': str(r.value) } for r in rows]

@router.get('/competitions/{competition_id}/performance/aggregations')
def performance_aggregations(competition_id: int, db: Session = Depends(get_db)):
    """Return participant portfolio value percentage deltas over 1h / 24h / 7d windows.
    Windows are best-effort; if insufficient history a delta may be null.
    """
    now = datetime.now(timezone.utc)
    horizons = { '1h': now - timedelta(hours=1), '24h': now - timedelta(hours=24), '7d': now - timedelta(days=7) }
    participants = db.query(ParticipantModel).filter(ParticipantModel.competition_id==competition_id).all()
    if not participants:
        return { 'competition_id': competition_id, 'participants': [] }
    # Fetch all history for 7d window
    earliest = min(horizons.values())
    histories = db.query(PortfolioValueHistory).filter(PortfolioValueHistory.snapshot_time >= earliest, PortfolioValueHistory.participant_id.in_([p.id for p in participants])).order_by(PortfolioValueHistory.participant_id.asc(), PortfolioValueHistory.snapshot_time.asc()).all()
    by_part: dict[int, list[PortfolioValueHistory]] = {}
    for row in histories:
        by_part.setdefault(row.participant_id, []).append(row)
    results = []
    for p in participants:
        vals = by_part.get(p.id, [])
        latest_v = Decimal(vals[-1].value) if vals else Decimal(p.portfolio_value or 0)
        entry = { 'participant_id': p.id, 'user_id': p.user_id }
        for label, cutoff in horizons.items():
            base = None
            for r in vals:
                if r.snapshot_time >= cutoff:
                    base = Decimal(r.value)
                    break
            if base and base > 0:
                entry[label] = f"{((latest_v - base)/base * 100):.4f}"
            else:
                entry[label] = None
        results.append(entry)
    return { 'competition_id': competition_id, 'generated_at': now.isoformat(), 'participants': results }

@router.get('/competitions/{competition_id}/participants/{participant_id}/risk-profile')
def risk_profile(competition_id: int, participant_id: int, window_hours: int = Query(168, le=720), db: Session = Depends(get_db)):
    p = db.query(ParticipantModel).filter(ParticipantModel.competition_id==competition_id, ParticipantModel.user_id==participant_id).first()
    if not p:
        raise HTTPException(status_code=404, detail='Participant not found')
    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    hist = db.query(PortfolioValueHistory).filter(PortfolioValueHistory.participant_id==p.id, PortfolioValueHistory.snapshot_time >= cutoff).order_by(PortfolioValueHistory.snapshot_time.asc()).all()
    values: list[tuple[datetime, Decimal]] = [(h.snapshot_time, Decimal(h.value)) for h in hist]
    # Returns
    rets: list[float] = []
    for i in range(1, len(values)):
        prev = float(values[i-1][1]); cur = float(values[i][1])
        if prev > 0:
            rets.append((cur-prev)/prev)
    vol = 0.0
    if len(rets) > 1:
        m = sum(rets)/len(rets)
        vol = sqrt(sum((r-m)**2 for r in rets)/(len(rets)-1))
    # Max drawdown
    peak = None
    max_dd = 0.0
    for _, v in values:
        fv = float(v)
        if peak is None or fv > peak:
            peak = fv
        if peak is not None and peak > 0:
            dd = (peak - fv)/peak
            if dd > max_dd:
                max_dd = dd
    # Concentration (HHI) from holdings
    from app.models.database import ParticipantHolding, Domain  # type: ignore
    holds = db.query(ParticipantHolding).filter(ParticipantHolding.participant_id==p.id, ParticipantHolding.quantity > 0).all()
    total_val = Decimal(0)
    weights: list[Decimal] = []
    for h in holds:
        dom = db.query(Domain).filter(Domain.name==h.domain_name).first()
        if not dom or dom.last_estimated_value is None:
            continue
        val = Decimal(dom.last_estimated_value) * Decimal(h.quantity or 0)
        total_val += val
        weights.append(val)
    hhi = 0.0
    if total_val > 0:
        hhi = float(sum((w/total_val)**2 for w in weights))
    # Turnover & concentration index fallback from rewards if exists
    reward = db.query(CompetitionReward).filter(CompetitionReward.competition_id==competition_id, CompetitionReward.user_id==participant_id).order_by(CompetitionReward.distributed_at.desc()).first()
    turnover = float(reward.turnover_ratio) if reward and reward.turnover_ratio is not None else 0.0
    concentration_index = float(reward.concentration_index) if reward and reward.concentration_index is not None else hhi
    return {
        'participant_id': participant_id,
        'competition_id': competition_id,
        'window_hours': window_hours,
        'volatility': f"{vol:.6f}",
        'max_drawdown_pct': f"{max_dd*100:.4f}",
        'turnover_ratio': f"{turnover:.6f}",
        'concentration_index': f"{concentration_index:.6f}",
        'hhi_snapshot': f"{hhi:.6f}",
        'sample_returns': len(rets)
    }

@router.get('/competitions/{competition_id}/participants/{participant_id}/execution-quality')
def execution_quality(competition_id: int, participant_id: int, window_hours: int = Query(168, le=720), db: Session = Depends(get_db)):
    """Approximate slippage metrics using rolling median of prior trades for each token as reference.
    This is a heuristic (no full orderbook reconstruction)."""
    from app.models.database import Trade
    participant = db.query(ParticipantModel).filter(ParticipantModel.competition_id==competition_id, ParticipantModel.user_id==participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail='Participant not found')
    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    trades = db.query(Trade).filter(Trade.participant_id==participant.id, Trade.timestamp >= cutoff).order_by(Trade.timestamp.asc()).all()
    ref_prices: dict[tuple[str,str], list[Decimal]] = {}
    samples = []
    total_slip = Decimal(0)
    worst: Decimal = Decimal(0)
    evaluated = 0
    for t in trades:
        key = (t.domain_token_address, t.domain_token_id)
        history = ref_prices.setdefault(key, [])
        price = Decimal(t.price)
        benchmark = None
        if history:
            # median of previous prices
            sorted_hist = sorted(history)
            mid = len(sorted_hist)//2
            if len(sorted_hist) % 2 == 1:
                benchmark = sorted_hist[mid]
            else:
                benchmark = (sorted_hist[mid-1] + sorted_hist[mid]) / 2
        if benchmark and benchmark > 0:
            slip = (price - benchmark) / benchmark
            total_slip += slip
            if abs(slip) > abs(worst):
                worst = slip
            evaluated += 1
            if len(samples) < 50:
                samples.append({ 'trade_id': t.id, 'ts': t.timestamp.isoformat(), 'price': str(price), 'benchmark': str(benchmark), 'slippage_pct': f"{slip*100:.4f}" })
        history.append(price)
        if len(history) > 25:  # cap memory
            del history[0]
    avg_slip = (total_slip / evaluated) if evaluated else Decimal(0)
    return {
        'competition_id': competition_id,
        'participant_id': participant_id,
        'window_hours': window_hours,
        'trades_considered': len(trades),
        'trades_evaluated': evaluated,
    'average_slippage_pct': f"{(avg_slip*Decimal(100)):.4f}",
    'worst_slippage_pct': f"{(worst*Decimal(100)):.4f}",
        'sample_trades': samples
    }

@router.post('/competitions/{competition_id}/epochs/{epoch_index}/distribute')
async def distribute_epoch_rewards(
    competition_id: int,
    epoch_index: int,
    top_n: int = 10,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    # Admin only
    if (current_user.wallet_address or '').lower() not in set(settings.admin_wallets):
        raise HTTPException(status_code=403, detail='Not authorized')
    epoch = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==competition_id, CompetitionEpoch.epoch_index==epoch_index).first()
    if not epoch:
        raise HTTPException(status_code=404, detail='Epoch not found')
    now = datetime.now(timezone.utc)
    if now < epoch.end_time:
        raise HTTPException(status_code=400, detail='Epoch not finished yet')
    if epoch.distributed:
        return { 'status': 'already_distributed', 'epoch': epoch_index }
    rewards_q = db.query(CompetitionReward).filter(CompetitionReward.epoch_id==epoch.id)
    rewards = rewards_q.order_by(CompetitionReward.points.desc()).all()
    total_points = sum([r.points or 0 for r in rewards]) if rewards else Decimal(0)
    pool = Decimal(epoch.reward_pool or 0)
    # Enhanced proportional formula: base on points which already integrate volume & risk-adjustment.
    distributed_count = 0
    for rank, r in enumerate(rewards, start=1):
        if pool > 0 and total_points > 0:
            base_share = (Decimal(r.points) / Decimal(total_points)) * pool
            if rank <= top_n and top_n > 1:
                bonus_factor = Decimal(1) + (Decimal(top_n - rank) / Decimal(top_n - 1)) * Decimal('0.20')
            else:
                bonus_factor = Decimal(1)
            reward_amount = (base_share * bonus_factor).quantize(Decimal('0.00000001'))
        else:
            reward_amount = Decimal(0)
        # KYC gating: zero out reward if user not kyc_verified
        from app.models.database import User as _U
        u = db.query(_U).filter(_U.id == r.user_id).first()
        r.raw_reward_amount = reward_amount
        if u and not u.kyc_verified:
            # still record zero distributed reward; can claim later once KYC passes
            r.reward_amount = Decimal(0)
        else:
            r.reward_amount = reward_amount
        r.distributed_at = now
        db.add(r)
        distributed_count += 1
    epoch.distributed = True
    db.add(epoch)
    db.commit()
    broadcast = get_sync_broadcast()
    if broadcast:
        broadcast({'type': 'epoch_distributed', 'competition_id': competition_id, 'epoch_index': epoch_index})
    return { 'status': 'distributed', 'epoch': epoch_index, 'rewards_updated': distributed_count }

@router.post('/competitions/{competition_id}/epochs/{epoch_index}/claim')
async def claim_epoch_reward(competition_id: int, epoch_index: int, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    # User must be KYC verified to claim
    if not current_user.kyc_verified:
        raise HTTPException(status_code=403, detail='KYC required')
    epoch = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==competition_id, CompetitionEpoch.epoch_index==epoch_index).first()
    if not epoch:
        raise HTTPException(status_code=404, detail='Epoch not found')
    if not epoch.distributed:
        raise HTTPException(status_code=400, detail='Epoch not yet distributed')
    reward = db.query(CompetitionReward).filter(CompetitionReward.epoch_id==epoch.id, CompetitionReward.user_id==current_user.id).first()
    if not reward:
        raise HTTPException(status_code=404, detail='No reward entry')
    if reward.claimed_at:
        return { 'status': 'already_claimed', 'amount': str(reward.reward_amount or 0) }
    if reward.reward_amount and reward.reward_amount > 0:
        # Already present (user was KYC at distribution time) just mark claimed
        pass
    else:
        # Retroactive claim if raw_reward_amount existed
        if reward.raw_reward_amount and (reward.raw_reward_amount or 0) > 0:
            reward.reward_amount = reward.raw_reward_amount
        else:
            return { 'status': 'no_reward' }
    reward.claimed_at = datetime.now(timezone.utc)
    db.add(reward); db.commit(); db.refresh(reward)
    broadcast = get_sync_broadcast()
    if broadcast:
        broadcast({'type': 'reward_claim', 'competition_id': competition_id, 'epoch_index': epoch_index, 'user_id': current_user.id, 'amount': str(reward.reward_amount or 0)})
    return { 'status': 'claimed', 'amount': str(reward.reward_amount or 0) }


@router.get('/competitions/{competition_id}/reward-pool/summary')
def reward_pool_summary(competition_id: int, db: Session = Depends(get_db)):
    # Summarize each epoch: total points, distributed flag, remaining (undistributed) pool aggregate
    epochs = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==competition_id).order_by(CompetitionEpoch.epoch_index.asc()).all()
    out = []
    undistributed_total = Decimal(0)
    for ep in epochs:
        rewards = db.query(CompetitionReward).filter(CompetitionReward.epoch_id==ep.id).all()
        total_points = sum([r.points or 0 for r in rewards]) if rewards else Decimal(0)
        total_reward_amount = sum([r.reward_amount or 0 for r in rewards]) if rewards else Decimal(0)
        if not ep.distributed and ep.reward_pool:
            undistributed_total += Decimal(ep.reward_pool)
        out.append({
            'epoch_index': ep.epoch_index,
            'reward_pool': str(ep.reward_pool or 0),
            'distributed': ep.distributed,
            'total_points': str(total_points),
            'total_reward_amount': str(total_reward_amount)
        })
    return { 'epochs': out, 'undistributed_pool_total': str(undistributed_total) }
