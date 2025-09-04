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


class DomainETFBase(BaseModel):
    name: str
    symbol: str
    description: str | None = None
    competition_id: int | None = None


class DomainETFCreate(DomainETFBase):
    positions: list[tuple[str, int]]  # list of (domain_name, weight_bps)


class DomainETF(DomainETFBase):
    id: int
    owner_user_id: int
    total_shares: Decimal | None = None
    nav_last: Decimal | None = None
    nav_updated_at: datetime | None = None
    management_fee_bps: int | None = None
    performance_fee_bps: int | None = None
    fee_accrued: Decimal | None = None
    nav_high_water: Decimal | None = None
    creation_fee_bps: int | None = None
    redemption_fee_bps: int | None = None

    class Config:
        from_attributes = True


class DomainETFPosition(BaseModel):
    id: int
    etf_id: int
    domain_name: str
    weight_bps: int

    class Config:
        from_attributes = True


class DomainETFShare(BaseModel):
    id: int
    etf_id: int
    user_id: int
    shares: Decimal

    class Config:
        from_attributes = True


class DomainETFShareFlow(BaseModel):
    id: int
    etf_id: int
    user_id: int
    flow_type: str
    shares: Decimal
    cash_value: Decimal
    nav_per_share: Decimal
    settlement_order_ids: list[str] | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ETFListParams(BaseModel):
    limit: int = 20
    offset: int = 0
    competition_id: int | None = None


class ETFIssueRedeem(BaseModel):
    shares: Decimal


class ETFNavUpdate(BaseModel):
    nav: Decimal


class DomainETFRedemptionIntent(BaseModel):
    id: int
    etf_id: int
    user_id: int
    shares: Decimal
    nav_per_share_snapshot: Decimal
    created_at: datetime
    executed_at: datetime | None = None

    class Config:
        from_attributes = True


class DomainETFFeeEvent(BaseModel):
    id: int
    etf_id: int
    event_type: str
    amount: Decimal
    nav_per_share_snapshot: Decimal | None = None
    meta: dict | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class DomainETFRevenueShare(BaseModel):
    id: int
    etf_id: int
    user_id: int
    amount: Decimal
    fee_event_id: int
    created_at: datetime

    class Config:
        from_attributes = True
