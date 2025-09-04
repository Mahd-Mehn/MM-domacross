from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from datetime import datetime, timezone

from app.database import get_db
from app.models.database import Season, Competition, User, CompetitionReward, CompetitionEpoch, Participant
from app.deps.auth import get_current_user

router = APIRouter()


@router.post('/seasons')
async def create_season(name: str, description: str | None = None, start_time: datetime | None = None, end_time: datetime | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    from app.config import settings
    if (user.wallet_address or '').lower() not in settings.admin_wallets:
        raise HTTPException(status_code=403, detail='Not authorized')
    now = datetime.now(timezone.utc)
    st = start_time or now
    et = end_time or (now.replace(microsecond=0) + (end_time - start_time) if end_time and start_time else now)
    if et <= st:
        et = st
    season = Season(name=name, description=description, start_time=st, end_time=et)
    db.add(season); db.commit(); db.refresh(season)
    return season


@router.get('/seasons')
async def list_seasons(db: Session = Depends(get_db)):
    return db.query(Season).order_by(Season.start_time.desc()).all()


@router.get('/seasons/{season_id}')
async def get_season(season_id: int, db: Session = Depends(get_db)):
    s = db.query(Season).filter(Season.id==season_id).first()
    if not s:
        raise HTTPException(status_code=404, detail='Season not found')
    return s


@router.get('/seasons/{season_id}/leaderboard')
async def season_leaderboard(season_id: int, db: Session = Depends(get_db)):
    # Aggregate rewards across all competitions in season (placeholder: sum reward_amount where distributed)
    rewards = (db.query(
        CompetitionReward.user_id,
        User.wallet_address,
        User.username,
        func.coalesce(func.sum(CompetitionReward.reward_amount), 0).label('total_rewards'),
        func.coalesce(func.sum(CompetitionReward.points), 0).label('total_points'),
        func.coalesce(func.sum(CompetitionReward.volume), 0).label('total_volume'),
        func.coalesce(func.avg(CompetitionReward.sharpe_like), 0).label('avg_sharpe'),
    )
    .join(User, User.id == CompetitionReward.user_id)
    .join(CompetitionEpoch, CompetitionEpoch.id == CompetitionReward.epoch_id)
    .join(Competition, Competition.id == CompetitionReward.competition_id)
    .filter(Competition.season_id == season_id)
    .group_by(CompetitionReward.user_id, User.wallet_address, User.username)
    .order_by(func.coalesce(func.sum(CompetitionReward.reward_amount), 0).desc())
    .all())
    return [{
        'user_id': r.user_id,
        'wallet_address': r.wallet_address,
        'username': r.username,
        'total_rewards': str(r.total_rewards),
        'total_points': str(r.total_points),
        'total_volume': str(r.total_volume),
        'avg_sharpe_like': str(r.avg_sharpe),
    } for r in rewards]

@router.get('/seasons/{season_id}/summary')
async def season_summary(season_id: int, db: Session = Depends(get_db)):
    s = db.query(Season).filter(Season.id==season_id).first()
    if not s:
        raise HTTPException(status_code=404, detail='Season not found')
    comps = db.query(Competition).filter(Competition.season_id==season_id).all()
    comp_ids = [c.id for c in comps]
    epochs = db.query(CompetitionEpoch).join(Competition, CompetitionEpoch.competition_id==Competition.id).filter(Competition.season_id==season_id).all()
    rewards = db.query(CompetitionReward).filter(CompetitionReward.competition_id.in_(comp_ids)).all() if comp_ids else []
    participants = db.query(Participant).filter(Participant.competition_id.in_(comp_ids)).all() if comp_ids else []
    total_reward_pool = sum([float(e.reward_pool or 0) for e in epochs])
    distributed_reward_amount = sum([float(r.reward_amount or 0) for r in rewards])
    active_now = [c for c in comps if c.start_time <= datetime.now(timezone.utc) <= c.end_time]
    return {
        'season': { 'id': s.id, 'name': s.name, 'start_time': s.start_time, 'end_time': s.end_time },
        'competitions': len(comps),
        'active_competitions': len(active_now),
        'epochs': len(epochs),
        'participants': len(participants),
        'total_reward_pool': total_reward_pool,
        'distributed_reward_amount': distributed_reward_amount,
        'distribution_progress_pct': (distributed_reward_amount / total_reward_pool * 100) if total_reward_pool > 0 else 0,
    }
