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
