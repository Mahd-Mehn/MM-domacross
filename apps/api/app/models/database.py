from sqlalchemy import Column, Integer, String, DateTime, Numeric, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), unique=True, nullable=False, index=True)
    username = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Competition(Base):
    __tablename__ = "competitions"

    id = Column(Integer, primary_key=True, index=True)
    contract_address = Column(String(42), unique=True, nullable=False, index=True)
    chain_id = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    entry_fee = Column(Numeric(18, 8), nullable=True)
    rules = Column(JSON, nullable=True)

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    competition_id = Column(Integer, ForeignKey("competitions.id"), nullable=False)
    portfolio_value = Column(Numeric(18, 8), default=0)

class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=False)
    domain_token_address = Column(String(42), nullable=False)
    domain_token_id = Column(String(255), nullable=False)
    trade_type = Column(String(4), nullable=False)  # 'BUY' or 'SELL'
    price = Column(Numeric(18, 8), nullable=False)
    tx_hash = Column(String(66), unique=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
