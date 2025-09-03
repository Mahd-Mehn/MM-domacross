from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.database import Trade as TradeModel, Participant as ParticipantModel, Competition as CompetitionModel, User as UserModel
from app.schemas.portfolio import Portfolio, TradeHistory
from app.deps.auth import get_current_user
from app.services.doma_service import doma_service

router = APIRouter()

@router.get("/portfolio/{wallet_address}", response_model=Portfolio)
async def get_portfolio(wallet_address: str, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.wallet_address == wallet_address.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Aggregate portfolio from participants
    participants = db.query(ParticipantModel).filter(ParticipantModel.user_id == user.id).all()
    total_value = sum(p.portfolio_value for p in participants)

    # Get cross-chain data from Doma
    cross_chain_data = await doma_service.get_cross_chain_portfolio(wallet_address)
    total_value += cross_chain_data['total_value']

    # Get active competitions
    competitions = []
    for p in participants:
        comp = db.query(CompetitionModel).filter(CompetitionModel.id == p.competition_id).first()
        if comp:
            competitions.append({
                "competition_id": comp.id,
                "name": comp.name,
                "portfolio_value": p.portfolio_value
            })

    return Portfolio(
        wallet_address=wallet_address,
        total_value=total_value,
        competitions=competitions
    )

    # Note: Removed duplicate GET /portfolio/{wallet_address} route below.

@router.get("/portfolio/{wallet_address}/history", response_model=List[TradeHistory])
async def get_portfolio_history(wallet_address: str, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.wallet_address == wallet_address.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get trades from participants
    participants = db.query(ParticipantModel).filter(ParticipantModel.user_id == user.id).all()
    participant_ids = [p.id for p in participants]

    trades = db.query(TradeModel).filter(TradeModel.participant_id.in_(participant_ids)).all()

    return [
        TradeHistory(
            id=trade.id,
            domain_token_address=trade.domain_token_address,
            domain_token_id=trade.domain_token_id,
            trade_type=trade.trade_type,
            price=trade.price,
            tx_hash=trade.tx_hash,
            timestamp=trade.timestamp
        )
        for trade in trades
    ]
