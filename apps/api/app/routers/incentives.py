from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from app.database import get_db
from app.models.database import (
    IncentiveSchedule, IncentiveEpoch, IncentiveUserPoint, TradeRiskFlag
)
from app.deps.auth import get_current_user
from app.services.incentive_service import incentive_service
from app.config import settings

router = APIRouter()

# --------- Helper logic (minimal placeholder) ---------

def _is_admin(user) -> bool:
    if not user:
        return False
    return (user.wallet_address or '').lower() in set(settings.admin_wallets)


def _compute_epoch_windows(schedule: IncentiveSchedule):
    cur = schedule.start_time
    idx = 0
    out = []
    delta = timedelta(minutes=schedule.epoch_duration_minutes)
    while cur < schedule.end_time:
        end = min(cur + delta, schedule.end_time)
        out.append((idx, cur, end))
        idx += 1
        cur = end
    return out

# --------- Endpoints ---------

@router.post('/incentives/schedules')
async def create_schedule(
    name: str,
    start_time: datetime,
    end_time: datetime,
    epoch_duration_minutes: int = 60,
    base_emission_per_epoch: float = 0,
    description: str | None = None,
    competition_id: int | None = None,
    weight_volume_bps: int | None = None,
    weight_pnl_bps: int | None = None,
    weight_turnover_bps: int | None = None,
    weight_concentration_bps: int | None = None,
    bonus_early_join_bps: int | None = None,
    volume_tier_thresholds: list[dict] | None = None,
    holding_duration_tiers: list[dict] | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail='Not authorized')
    if end_time <= start_time:
        raise HTTPException(status_code=400, detail='end_time must be after start_time')
    existing = db.query(IncentiveSchedule).filter(IncentiveSchedule.name==name).first()
    if existing:
        raise HTTPException(status_code=400, detail='Schedule name exists')
    sched = IncentiveSchedule(
        name=name,
        description=description,
        competition_id=competition_id,
        start_time=start_time,
        end_time=end_time,
        epoch_duration_minutes=epoch_duration_minutes,
        base_emission_per_epoch=Decimal(str(base_emission_per_epoch)),
        weight_volume_bps=weight_volume_bps or 4000,
        weight_pnl_bps=weight_pnl_bps or 3000,
        weight_turnover_bps=weight_turnover_bps or 2000,
        weight_concentration_bps=weight_concentration_bps or 1000,
        bonus_early_join_bps=bonus_early_join_bps or 500,
        volume_tier_thresholds=volume_tier_thresholds,
        holding_duration_tiers=holding_duration_tiers,
    )
    db.add(sched); db.commit(); db.refresh(sched)
    # Pre-materialize epochs for visibility
    for idx, s, e in _compute_epoch_windows(sched):
        ep = IncentiveEpoch(schedule_id=sched.id, epoch_index=idx, start_time=s, end_time=e, planned_emission=sched.base_emission_per_epoch)
        db.add(ep)
    db.commit()
    return sched

@router.get('/incentives/schedules')
async def list_schedules(db: Session = Depends(get_db)):
    return db.query(IncentiveSchedule).order_by(IncentiveSchedule.start_time.desc()).all()

@router.get('/incentives/schedules/{schedule_id}')
async def get_schedule(schedule_id: int, db: Session = Depends(get_db)):
    sched = db.query(IncentiveSchedule).filter(IncentiveSchedule.id==schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail='Not found')
    epochs = db.query(IncentiveEpoch).filter(IncentiveEpoch.schedule_id==schedule_id).order_by(IncentiveEpoch.epoch_index.asc()).all()
    return {'schedule': sched, 'epochs': epochs}

@router.get('/incentives/schedules/{schedule_id}/current')
async def current_epoch(schedule_id: int, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    ep = db.query(IncentiveEpoch).filter(IncentiveEpoch.schedule_id==schedule_id, IncentiveEpoch.start_time <= now, IncentiveEpoch.end_time > now).first()
    if not ep:
        return {'epoch': None}
    return {'epoch': {'id': ep.id, 'index': ep.epoch_index, 'start_time': ep.start_time, 'end_time': ep.end_time, 'planned_emission': str(ep.planned_emission)}}

@router.get('/incentives/schedules/{schedule_id}/epochs/{epoch_index}/points')
async def epoch_points(schedule_id: int, epoch_index: int, db: Session = Depends(get_db)):
    ep = db.query(IncentiveEpoch).filter(IncentiveEpoch.schedule_id==schedule_id, IncentiveEpoch.epoch_index==epoch_index).first()
    if not ep:
        raise HTTPException(status_code=404, detail='Epoch not found')
    pts = db.query(IncentiveUserPoint).filter(IncentiveUserPoint.epoch_id==ep.id).order_by(IncentiveUserPoint.total_points.desc()).all()
    return {'epoch': {'id': ep.id, 'index': ep.epoch_index}, 'points': [ {'user_id': p.user_id, 'total_points': str(p.total_points or 0), 'reward_amount': str(p.reward_amount or 0)} for p in pts ] }

@router.get('/incentives/schedules/{schedule_id}/epochs/{epoch_index}/risk-flags')
async def epoch_risk_flags(schedule_id: int, epoch_index: int, db: Session = Depends(get_db)):
        """Return aggregate risk flag counts for trades occurring inside the epoch window.

        Response shape:
            {
                'epoch': { 'index': int },
                'total': int,
                'by_type': { 'FLAG_TYPE': count, ... }
            }
        """
        ep = db.query(IncentiveEpoch).filter(IncentiveEpoch.schedule_id==schedule_id, IncentiveEpoch.epoch_index==epoch_index).first()
        if not ep:
                raise HTTPException(status_code=404, detail='Epoch not found')
        # Map trade_id -> flag types inside window
        flags = db.query(TradeRiskFlag).filter(TradeRiskFlag.created_at >= ep.start_time, TradeRiskFlag.created_at < ep.end_time).all()
        by_type: dict[str,int] = {}
        for f in flags:
                by_type[f.flag_type] = by_type.get(f.flag_type, 0) + 1
        return { 'epoch': { 'index': ep.epoch_index }, 'total': sum(by_type.values()), 'by_type': by_type }

@router.post('/incentives/schedules/{schedule_id}/epochs/{epoch_index}/provisional')
async def provisional_points(schedule_id: int, epoch_index: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # Admin only for forcing recalculation (pre-finalize). Could be relaxed later.
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail='Not authorized')
    res = incentive_service.compute_provisional(db, schedule_id, epoch_index)
    return {'schedule_id': schedule_id, 'epoch_index': epoch_index, 'rows': res}

@router.post('/incentives/schedules/{schedule_id}/epochs/{epoch_index}/finalize')
async def finalize_epoch(schedule_id: int, epoch_index: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail='Not authorized')
    ep = db.query(IncentiveEpoch).filter(IncentiveEpoch.schedule_id==schedule_id, IncentiveEpoch.epoch_index==epoch_index).first()
    if not ep:
        raise HTTPException(status_code=404, detail='Epoch not found')
    if ep.finalized_at:
        return {'status': 'already_finalized'}
    # Placeholder: compute participation & adjust emission if below min participants
    sched = db.query(IncentiveSchedule).filter(IncentiveSchedule.id==schedule_id).first()
    participation = db.query(IncentiveUserPoint).filter(IncentiveUserPoint.epoch_id==ep.id).count()
    ep.participation_count = participation
    emission = Decimal(ep.planned_emission or 0)
    if participation < (sched.min_participants_full_emission or 0):
        # reduce emission
        reduction = Decimal(sched.emission_reduction_factor_bps) / Decimal(10000)
        emission = emission * (Decimal(1) - reduction)
        ep.adjusted = True
    ep.actual_emission = emission
    ep.finalized_at = datetime.now(timezone.utc)
    db.add(ep); db.commit()
    return {'status': 'finalized', 'epoch_index': epoch_index, 'actual_emission': str(ep.actual_emission or 0), 'adjusted': ep.adjusted}

@router.get('/incentives/schedules/{schedule_id}/summary')
async def schedule_summary(schedule_id: int, db: Session = Depends(get_db)):
    sched = db.query(IncentiveSchedule).filter(IncentiveSchedule.id==schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail='Not found')
    epochs = db.query(IncentiveEpoch).filter(IncentiveEpoch.schedule_id==schedule_id).order_by(IncentiveEpoch.epoch_index.asc()).all()
    total_planned = sum([Decimal(e.planned_emission or 0) for e in epochs]) if epochs else Decimal(0)
    total_actual = sum([Decimal(e.actual_emission or 0) for e in epochs if e.actual_emission is not None])
    next_epoch = None
    now = datetime.now(timezone.utc)
    for e in epochs:
        if e.start_time > now:
            next_epoch = {
                'index': e.epoch_index,
                'start_time': e.start_time,
                'end_time': e.end_time,
                'planned_emission': str(e.planned_emission or 0)
            }
            break
    current = db.query(IncentiveEpoch).filter(IncentiveEpoch.schedule_id==schedule_id, IncentiveEpoch.start_time <= now, IncentiveEpoch.end_time > now).first()
    return {
        'schedule': {
            'id': sched.id,
            'name': sched.name,
            'start_time': sched.start_time,
            'end_time': sched.end_time,
            'epoch_duration_minutes': sched.epoch_duration_minutes,
            'base_emission_per_epoch': str(sched.base_emission_per_epoch),
            'weights_bps': {
                'volume': sched.weight_volume_bps,
                'pnl': sched.weight_pnl_bps,
                'turnover': sched.weight_turnover_bps,
                'concentration': sched.weight_concentration_bps,
            },
            'bonus_early_join_bps': sched.bonus_early_join_bps,
            'volume_tier_thresholds': sched.volume_tier_thresholds,
            'holding_duration_tiers': sched.holding_duration_tiers,
        },
        'current_epoch': None if not current else {
            'index': current.epoch_index,
            'start_time': current.start_time,
            'end_time': current.end_time,
            'planned_emission': str(current.planned_emission or 0),
            'actual_emission': str(current.actual_emission or 0),
            'finalized': bool(current.finalized_at),
        },
        'next_epoch': next_epoch,
        'epochs': [
            {
                'index': e.epoch_index,
                'start_time': e.start_time,
                'end_time': e.end_time,
                'planned_emission': str(e.planned_emission or 0),
                'actual_emission': str(e.actual_emission or 0),
                'finalized': bool(e.finalized_at)
            } for e in epochs
        ],
        'aggregate': {
            'total_planned_emission': str(total_planned),
            'total_actual_emission': str(total_actual),
        }
    }
