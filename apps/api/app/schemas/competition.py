from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class CompetitionBase(BaseModel):
    contract_address: str
    chain_id: int
    name: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    entry_fee: Optional[Decimal] = None
    rules: Optional[dict] = None


class CompetitionCreate(CompetitionBase):
    pass


class Competition(CompetitionBase):
    id: int

    class Config:
        from_attributes = True


class ParticipantBase(BaseModel):
    user_id: int
    competition_id: int
    portfolio_value: Decimal = Decimal(0)


class ParticipantCreate(ParticipantBase):
    pass


class Participant(ParticipantBase):
    id: int

    class Config:
        from_attributes = True


class TradeBase(BaseModel):
    participant_id: int
    domain_token_address: str
    domain_token_id: str
    trade_type: str  # 'BUY' or 'SELL'
    price: Decimal
    tx_hash: str
    timestamp: datetime


class TradeCreate(TradeBase):
    pass


class Trade(TradeBase):
    id: int

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    user_id: int
    wallet_address: str
    username: Optional[str]
    portfolio_value: Decimal
    rank: int


class CompetitionWithLeaderboard(Competition):
    leaderboard: List[LeaderboardEntry]


class PortfolioUpdate(BaseModel):
    portfolio_value: Decimal
