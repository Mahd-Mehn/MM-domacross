from datetime import datetime, timezone
from decimal import Decimal
from typing import List
from sqlalchemy.orm import Session
from app.models.database import (
    IncentiveSchedule, IncentiveEpoch, IncentiveUserPoint,
    Participant as ParticipantModel, Trade as TradeModel,
    TradeRiskFlag as TradeRiskFlagModel, ParticipantHolding as ParticipantHoldingModel,
    Domain as DomainModel
)
from app.broadcast import get_sync_broadcast

class IncentiveService:
    """Lightweight service that finalizes ended incentive epochs.

    Expansion later: provisional point calculation, risk-adjusted metrics integration.
    """
    def run_once(self, db: Session) -> List[int]:
        now = datetime.now(timezone.utc)
        finalized: list[int] = []
        epochs = (
            db.query(IncentiveEpoch)
            .filter(IncentiveEpoch.end_time <= now, IncentiveEpoch.finalized_at == None)  # noqa: E711
            .all()
        )
        for ep in epochs:
            sched: IncentiveSchedule | None = db.query(IncentiveSchedule).filter(IncentiveSchedule.id==ep.schedule_id).first()
            if not sched:
                continue
            # If no user points yet, emission = 0
            points = db.query(IncentiveUserPoint).filter(IncentiveUserPoint.epoch_id==ep.id).all()
            participation = len(points)
            ep.participation_count = participation
            emission = Decimal(ep.planned_emission or 0)
            if participation == 0:
                emission = Decimal(0)
            elif sched and participation < (sched.min_participants_full_emission or 0):
                reduction = Decimal(sched.emission_reduction_factor_bps) / Decimal(10000)
                emission = emission * (Decimal(1) - reduction)
                ep.adjusted = True
            ep.actual_emission = emission
            ep.finalized_at = now
            # Allocate naive proportional reward if points exist
            total_pts = sum([p.total_points or 0 for p in points]) if points else Decimal(0)
            if emission > 0 and total_pts > 0:
                for p in points:
                    share = (Decimal(p.total_points or 0) / Decimal(total_pts)) if total_pts > 0 else Decimal(0)
                    p.reward_amount = (emission * share).quantize(Decimal('0.00000001'))
                    db.add(p)
            db.add(ep)
            finalized.append(ep.id)
        if finalized:
            db.commit()
            broadcast = get_sync_broadcast()
            if broadcast:
                for ep_id in finalized:
                    ep = db.query(IncentiveEpoch).filter(IncentiveEpoch.id==ep_id).first()
                    if ep:
                        broadcast({'type': 'incentive_epoch_finalized', 'schedule_id': ep.schedule_id, 'epoch_index': ep.epoch_index, 'actual_emission': str(ep.actual_emission or 0), 'adjusted': ep.adjusted})
        return finalized

    # -------- Provisional Point Computation (idempotent) --------
    def compute_provisional(self, db: Session, schedule_id: int, epoch_index: int) -> list[dict]:
        sched = db.query(IncentiveSchedule).filter(IncentiveSchedule.id==schedule_id).first()
        if not sched:
            return []
        ep = db.query(IncentiveEpoch).filter(IncentiveEpoch.schedule_id==schedule_id, IncentiveEpoch.epoch_index==epoch_index).first()
        if not ep:
            return []
        # If epoch already finalized, just return existing stored points
        if ep.finalized_at:
            rows = db.query(IncentiveUserPoint).filter(IncentiveUserPoint.epoch_id==ep.id).all()
            return [
                {
                    'user_id': r.user_id,
                    'volume': str(r.volume or 0),
                    'base_points': str(r.base_points or 0),
                    'bonus_points': str(r.bonus_points or 0),
                    'total_points': str(r.total_points or 0),
                    'finalized': True,
                    'reward_amount': str(r.reward_amount or 0)
                } for r in rows
            ]
        # Scope participants by competition if schedule linked; else skip for now
        if sched.competition_id is None:
            # future: global incentive scope; currently no-op
            return []
        # Derive participant user set
        participants = db.query(ParticipantModel).filter(ParticipantModel.competition_id==sched.competition_id).all()
        if not participants:
            return []
        part_by_user = {p.user_id: p for p in participants}
        # Anti-abuse: collect flagged trade ids inside window
        flagged_ids = {
            f.trade_id for f in db.query(TradeRiskFlagModel).filter(TradeRiskFlagModel.created_at >= ep.start_time, TradeRiskFlagModel.created_at < ep.end_time).all()
        }
        trades = db.query(TradeModel).filter(TradeModel.timestamp >= ep.start_time, TradeModel.timestamp < ep.end_time).all()
        part_id_to_user: dict[int, int] = {p.id: p.user_id for p in participants}
        # Track earliest BUY timestamp per user for holding duration bonus calculation
        earliest_buy_ts: dict[int, datetime] = {}
        # Metric accumulators
        volume_by_user: dict[int, Decimal] = {}
        buy_by_user: dict[int, Decimal] = {}
        sell_by_user: dict[int, Decimal] = {}
        pnl_by_user: dict[int, Decimal] = {}
        # For cost basis calculation, construct a per-user running average cost (approximation using current ParticipantHolding avg_cost when available)
        holding_cost_map: dict[int, dict[str, tuple[Decimal, Decimal]]] = {}
        ph_rows = db.query(ParticipantHoldingModel).filter(ParticipantHoldingModel.participant_id.in_([p.id for p in participants])).all()
        for h in ph_rows:
            user_id = part_id_to_user.get(h.participant_id)
            if user_id is None:
                continue
            holding_cost_map.setdefault(user_id, {})[h.domain_name] = (Decimal(h.quantity or 0), Decimal(h.avg_cost or 0))

        for t in trades:
            if t.id in flagged_ids:
                continue
            u = part_id_to_user.get(t.participant_id)
            if u is None:
                continue
            price = Decimal(t.price or 0)
            volume_by_user[u] = volume_by_user.get(u, Decimal(0)) + price
            trade_type = (t.trade_type or '').upper()
            domain_key = f"{t.domain_token_address}:{t.domain_token_id}"
            if trade_type == 'BUY':
                buy_by_user[u] = buy_by_user.get(u, Decimal(0)) + price
                if u not in earliest_buy_ts:
                    earliest_buy_ts[u] = getattr(t, 'timestamp', ep.start_time) or ep.start_time
                qty, avg_cost = holding_cost_map.get(u, {}).get(domain_key, (Decimal(0), Decimal(0)))
                new_qty = qty + Decimal(1)
                new_avg = ((avg_cost * qty) + price) / (new_qty if new_qty > 0 else Decimal(1))
                holding_cost_map.setdefault(u, {})[domain_key] = (new_qty, new_avg)
                pnl_by_user.setdefault(u, Decimal(0))
            else:  # SELL
                sell_by_user[u] = sell_by_user.get(u, Decimal(0)) + price
                qty, avg_cost = holding_cost_map.get(u, {}).get(domain_key, (Decimal(0), Decimal(0)))
                if qty > 0:
                    pnl_component = price - avg_cost
                else:
                    pnl_component = price
                pnl_by_user[u] = pnl_by_user.get(u, Decimal(0)) + pnl_component
                new_qty = qty - Decimal(1)
                if new_qty < 0:
                    new_qty = Decimal(0)
                holding_cost_map.setdefault(u, {})[domain_key] = (new_qty, avg_cost)
        if not volume_by_user:
            return []
        # Holdings-based concentration (HHI) using last_estimated_value * quantity
        holdings = db.query(ParticipantHoldingModel).filter(ParticipantHoldingModel.participant_id.in_([p.id for p in participants])).all()
        domain_vals = {d.name: Decimal(d.last_estimated_value or 0) for d in db.query(DomainModel).filter(DomainModel.last_estimated_value != None).all()}  # noqa: E711
        holding_map: dict[int, list[ParticipantHoldingModel]] = {}
        for h in holdings:
            holding_map.setdefault(h.participant_id, []).append(h)
        hhi_by_user: dict[int, Decimal] = {}
        for p in participants:
            hs = holding_map.get(p.id, [])
            if not hs:
                continue
            # compute weights by value
            values = [ (domain_vals.get(h.domain_name, Decimal(0)) * Decimal(h.quantity or 0)) for h in hs ]
            total_val = sum(values)
            if total_val <= 0:
                continue
            weights = [ (v / total_val) for v in values if v > 0 ]
            hhi = sum([w*w for w in weights])
            hhi_by_user[p.user_id] = Decimal(hhi)
        # Normalization constants
        max_volume = max(volume_by_user.values()) if volume_by_user else Decimal(0)
        max_turnover = Decimal(0)
        max_hhi = max(hhi_by_user.values()) if hhi_by_user else Decimal(0)
        positive_pnls = [v for v in pnl_by_user.values() if v > 0]
        sum_positive_pnl = sum(positive_pnls) if positive_pnls else Decimal(0)
        # Prepare weights
        w_vol = Decimal(sched.weight_volume_bps or 0) / Decimal(10000)
        w_pnl = Decimal(sched.weight_pnl_bps or 0) / Decimal(10000)
        w_turn = Decimal(sched.weight_turnover_bps or 0) / Decimal(10000)
        w_conc = Decimal(sched.weight_concentration_bps or 0) / Decimal(10000)
        results: list[dict] = []
        # Determine early join bonus eligibility (no earlier epoch user point rows)
        earlier_epoch_ids = [e.id for e in db.query(IncentiveEpoch).filter(IncentiveEpoch.schedule_id==schedule_id, IncentiveEpoch.epoch_index < epoch_index).all()]
        user_has_prior = set(
            [r.user_id for r in db.query(IncentiveUserPoint).filter(IncentiveUserPoint.epoch_id.in_(earlier_epoch_ids)).all()] if earlier_epoch_ids else []
        )
        bonus_bps = Decimal(sched.bonus_early_join_bps or 0)
        # Advanced volume tiers
        vol_tiers = []
        if getattr(sched, 'volume_tier_thresholds', None):
            try:
                vol_tiers = sorted([
                    (Decimal(str(v.get('threshold'))), Decimal(str(v.get('bonus_bps', 0))))
                    for v in (sched.volume_tier_thresholds or []) if 'threshold' in v
                ], key=lambda x: x[0])
            except Exception:
                vol_tiers = []
        # Holding duration tiers (min_minutes, bonus_bps)
        hold_tiers = []
        if getattr(sched, 'holding_duration_tiers', None):
            try:
                hold_tiers = sorted([
                    (Decimal(str(v.get('min_minutes'))), Decimal(str(v.get('bonus_bps', 0))))
                    for v in (sched.holding_duration_tiers or []) if 'min_minutes' in v
                ], key=lambda x: x[0])
            except Exception:
                hold_tiers = []
        # Precompute turnover ratios
        portfolio_value_by_user = {p.user_id: Decimal(p.portfolio_value or 0) for p in participants}
        turnover_by_user: dict[int, Decimal] = {}
        for user_id in volume_by_user.keys():
            gross = buy_by_user.get(user_id, Decimal(0)) + sell_by_user.get(user_id, Decimal(0))
            denom = portfolio_value_by_user.get(user_id, Decimal(0))
            if denom <= 0:
                turnover = Decimal(0)
            else:
                turnover = (gross / denom).quantize(Decimal('0.00000001'))
            turnover_by_user[user_id] = turnover
            if turnover > max_turnover:
                max_turnover = turnover
        for user_id, vol in volume_by_user.items():
            vol_n = (vol / max_volume) if max_volume > 0 else Decimal(0)
            pnl_val = pnl_by_user.get(user_id, Decimal(0))
            pnl_n = (pnl_val / sum_positive_pnl) if (pnl_val > 0 and sum_positive_pnl > 0) else Decimal(0)
            turn_val = turnover_by_user.get(user_id, Decimal(0))
            turn_n = (turn_val / max_turnover) if max_turnover > 0 else Decimal(0)
            hhi_val = hhi_by_user.get(user_id, None)
            if hhi_val is not None and max_hhi > 0:
                diversification_n = Decimal(1) - (hhi_val / max_hhi)
            else:
                diversification_n = Decimal(0)
            raw_score = (vol_n * w_vol) + (pnl_n * w_pnl) + (turn_n * w_turn) + (diversification_n * w_conc)
            base_points = Decimal(raw_score).quantize(Decimal('0.00000001'))
            early_bonus_points = Decimal(0)
            if user_id not in user_has_prior and bonus_bps > 0 and base_points > 0:
                early_bonus_points = (base_points * (bonus_bps / Decimal(10000))).quantize(Decimal('0.00000001'))
            # Volume tier bonus
            vol_bonus_points = Decimal(0)
            if vol_tiers and base_points > 0:
                matched = [b for thresh, b in vol_tiers if vol >= thresh]
                if matched:
                    vol_bonus_points = (base_points * (matched[-1] / Decimal(10000))).quantize(Decimal('0.00000001'))
            # Holding duration bonus
            hold_bonus_points = Decimal(0)
            if hold_tiers and base_points > 0 and user_id in earliest_buy_ts:
                held_minutes = Decimal((ep.end_time - earliest_buy_ts[user_id]).total_seconds() / 60)
                matched = [b for mins, b in hold_tiers if held_minutes >= mins]
                if matched:
                    hold_bonus_points = (base_points * (matched[-1] / Decimal(10000))).quantize(Decimal('0.00000001'))
            total_points = base_points + early_bonus_points + vol_bonus_points + hold_bonus_points
            # Upsert IncentiveUserPoint row (provisional) without reward_amount
            existing = db.query(IncentiveUserPoint).filter(IncentiveUserPoint.epoch_id==ep.id, IncentiveUserPoint.user_id==user_id).first()
            if not existing:
                existing = IncentiveUserPoint(
                    schedule_id=schedule_id,
                    epoch_id=ep.id,
                    user_id=user_id,
                )
            existing.volume = vol
            existing.turnover_ratio = turn_val
            existing.concentration_index = hhi_val
            existing.pnl = pnl_val
            existing.base_points = base_points
            existing.bonus_points = early_bonus_points + vol_bonus_points + hold_bonus_points
            existing.total_points = total_points
            db.add(existing)
            results.append({
                'user_id': user_id,
                'volume': str(vol),
                'pnl': str(pnl_val),
                'turnover_ratio': str(turn_val),
                'concentration_index': str(hhi_val) if hhi_val is not None else '0',
                'base_points': str(base_points),
                'bonus_points': str(early_bonus_points + vol_bonus_points + hold_bonus_points),
                'early_bonus_points': str(early_bonus_points),
                'volume_bonus_points': str(vol_bonus_points),
                'holding_duration_bonus_points': str(hold_bonus_points),
                'total_points': str(total_points),
                'finalized': False
            })
        db.commit()
        return results

incentive_service = IncentiveService()
