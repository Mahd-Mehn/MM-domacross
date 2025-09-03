from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CompetitionPortfolio(BaseModel):
    competition_id: int
    name: str
    portfolio_value: float

class Portfolio(BaseModel):
    wallet_address: str
    total_value: float
    competitions: List[CompetitionPortfolio]

class TradeHistory(BaseModel):
    id: int
    domain_token_address: str
    domain_token_id: str
    trade_type: str
    price: float
    tx_hash: str
    timestamp: datetime
