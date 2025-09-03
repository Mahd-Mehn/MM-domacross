from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.database import Competition as CompetitionModel, Participant as ParticipantModel, User as UserModel
from app.schemas.competition import (
    Competition,
    CompetitionCreate,
    CompetitionWithLeaderboard,
    LeaderboardEntry,
    PortfolioUpdate,
    Participant as ParticipantSchema,
)
from datetime import datetime, timezone
from app.deps.auth import get_current_user, get_current_user_optional
from app.config import settings

router = APIRouter()


@router.get("/competitions", response_model=List[Competition])
async def get_competitions(db: Session = Depends(get_db)):
    competitions = db.query(CompetitionModel).all()
    return competitions


@router.get("/competitions/{competition_id}", response_model=CompetitionWithLeaderboard)
async def get_competition(competition_id: int, db: Session = Depends(get_db)):
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
        leaderboard=leaderboard
    )


@router.post("/competitions", response_model=Competition)
async def create_competition(
    competition: CompetitionCreate,
    db: Session = Depends(get_db),
    maybe_user: UserModel | None = Depends(get_current_user_optional),
):
    # Require auth outside local environment
    if settings.app_env != "local":
        if maybe_user is None:
            raise HTTPException(status_code=401, detail="Authentication required")
        # Admin allowlist check
        if (maybe_user.wallet_address or "").lower() not in set(settings.admin_wallets):
            raise HTTPException(status_code=403, detail="Admin privileges required")
    db_competition = CompetitionModel(**competition.model_dump())
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
