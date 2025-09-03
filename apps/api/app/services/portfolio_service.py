from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.models.database import User, Competition, Participant, Trade
from decimal import Decimal

class PortfolioService:
    def __init__(self, db: Session):
        self.db = db

    async def get_user_portfolio(self, wallet_address: str) -> Dict[str, Any]:
        """Get aggregated portfolio data for a user"""
        user = self.db.query(User).filter(User.wallet_address == wallet_address.lower()).first()
        if not user:
            return {"error": "User not found"}

        # Get all competitions the user is participating in
        participants = self.db.query(Participant).filter(Participant.user_id == user.id).all()

        total_value = Decimal(0)
        competitions_data = []

        for participant in participants:
            competition = self.db.query(Competition).filter(
                Competition.id == participant.competition_id
            ).first()

            if competition:
                total_value += participant.portfolio_value
                competitions_data.append({
                    "competition_id": competition.id,
                    "competition_name": competition.name,
                    "portfolio_value": str(participant.portfolio_value),
                    "status": self._get_competition_status(competition),
                })

        return {
            "user_id": user.id,
            "wallet_address": wallet_address,
            "total_portfolio_value": str(total_value),
            "competitions_participating": len(competitions_data),
            "competitions": competitions_data,
        }

    async def get_user_trade_history(self, wallet_address: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get trade history for a user"""
        user = self.db.query(User).filter(User.wallet_address == wallet_address.lower()).first()
        if not user:
            return []

        trades = (
            self.db.query(Trade)
            .join(Participant, Trade.participant_id == Participant.id)
            .filter(Participant.user_id == user.id)
            .order_by(Trade.timestamp.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": trade.id,
                "competition_id": trade.participant.competition_id,
                "domain_token_address": trade.domain_token_address,
                "domain_token_id": trade.domain_token_id,
                "trade_type": trade.trade_type,
                "price": str(trade.price),
                "tx_hash": trade.tx_hash,
                "timestamp": trade.timestamp.isoformat(),
            }
            for trade in trades
        ]

    def _get_competition_status(self, competition: Competition) -> str:
        """Determine competition status"""
        from datetime import datetime
        now = datetime.utcnow()

        if now < competition.start_time:
            return "upcoming"
        elif now <= competition.end_time:
            return "active"
        else:
            return "ended"
