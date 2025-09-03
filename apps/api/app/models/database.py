from sqlalchemy import Column, Integer, String, DateTime, Numeric, Text, JSON, ForeignKey, UniqueConstraint, Boolean
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
    tx_hash = Column(String(66), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class ProcessedEvent(Base):
    __tablename__ = "processed_events"
    id = Column(Integer, primary_key=True, index=True)
    unique_id = Column(String(255), nullable=False)
    event_type = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('unique_id', name='uq_processed_events_unique'),)


class Domain(Base):
    __tablename__ = "domains"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    tld = Column(String(32), nullable=True, index=True)
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_event_at = Column(DateTime(timezone=True), nullable=True)
    last_floor_price = Column(Numeric(18,8), nullable=True)
    last_estimated_value = Column(Numeric(18,8), nullable=True)

class Listing(Base):
    __tablename__ = "listings"
    id = Column(Integer, primary_key=True, index=True)
    domain_name = Column(String(255), ForeignKey('domains.name'), nullable=False, index=True)
    seller_wallet = Column(String(42), nullable=False, index=True)
    price = Column(Numeric(18,8), nullable=False)
    active = Column(Boolean, default=True, index=True)
    tx_hash = Column(String(66), unique=True, nullable=True)
    external_order_id = Column(String(128), unique=True, nullable=True, index=True)  # SDK / orderbook id
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Offer(Base):
    __tablename__ = "offers"
    id = Column(Integer, primary_key=True, index=True)
    domain_name = Column(String(255), ForeignKey('domains.name'), nullable=False, index=True)
    buyer_wallet = Column(String(42), nullable=False, index=True)
    price = Column(Numeric(18,8), nullable=False)
    active = Column(Boolean, default=True, index=True)
    tx_hash = Column(String(66), unique=True, nullable=True)
    external_order_id = Column(String(128), unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class OrderbookSnapshot(Base):
    __tablename__ = "orderbook_snapshots"
    id = Column(Integer, primary_key=True, index=True)
    domain_name = Column(String(255), ForeignKey('domains.name'), nullable=False, index=True)
    side = Column(String(4), nullable=False)  # BUY / SELL
    price = Column(Numeric(18,8), nullable=False)
    size = Column(Numeric(18,8), nullable=False)
    collected_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class Valuation(Base):
    __tablename__ = "valuations"
    id = Column(Integer, primary_key=True, index=True)
    domain_name = Column(String(255), ForeignKey('domains.name'), nullable=False, index=True)
    model_version = Column(String(32), nullable=False)
    value = Column(Numeric(18,8), nullable=False)
    factors = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class DomainETF(Base):
    __tablename__ = "domain_etfs"
    id = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    competition_id = Column(Integer, ForeignKey('competitions.id'), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    symbol = Column(String(16), nullable=False)
    description = Column(Text, nullable=True)
    total_shares = Column(Numeric(24,8), nullable=False, default=0)
    nav_last = Column(Numeric(18,8), nullable=True)
    nav_updated_at = Column(DateTime(timezone=True), nullable=True)
    creation_unit_size = Column(Numeric(24,8), nullable=True)  # if set, primary market creations must be multiple
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('symbol', name='uq_domain_etf_symbol'),)

class DomainETFPosition(Base):
    __tablename__ = "domain_etf_positions"
    id = Column(Integer, primary_key=True, index=True)
    etf_id = Column(Integer, ForeignKey('domain_etfs.id'), nullable=False, index=True)
    domain_name = Column(String(255), ForeignKey('domains.name'), nullable=False, index=True)
    weight_bps = Column(Integer, nullable=False)  # weight in basis points (10000 = 100%)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('etf_id', 'domain_name', name='uq_domain_etf_domain'),)

class DomainETFShare(Base):
    __tablename__ = "domain_etf_shares"
    id = Column(Integer, primary_key=True, index=True)
    etf_id = Column(Integer, ForeignKey('domain_etfs.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    shares = Column(Numeric(24,8), nullable=False)
    lock_until = Column(DateTime(timezone=True), nullable=True, index=True)  # vesting / lockup
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('etf_id', 'user_id', name='uq_domain_etf_share_holder'),)

class DomainETFShareFlow(Base):
    __tablename__ = "domain_etf_share_flows"
    id = Column(Integer, primary_key=True, index=True)
    etf_id = Column(Integer, ForeignKey('domain_etfs.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    flow_type = Column(String(8), nullable=False)  # ISSUE / REDEEM
    shares = Column(Numeric(24,8), nullable=False)
    cash_value = Column(Numeric(24,8), nullable=False)
    nav_per_share = Column(Numeric(24,8), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
