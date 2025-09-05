from sqlalchemy import Column, Integer, String, DateTime, Numeric, Text, JSON, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), unique=True, nullable=False, index=True)
    username = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Season(Base):
    __tablename__ = "seasons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Competition(Base):
    __tablename__ = "competitions"

    id = Column(Integer, primary_key=True, index=True)
    contract_address = Column(String(42), unique=True, nullable=True, index=True)  # may be null until on-chain deployment
    chain_id = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    entry_fee = Column(Numeric(18, 8), nullable=True)
    rules = Column(JSON, nullable=True)
    season_id = Column(Integer, ForeignKey('seasons.id'), nullable=True, index=True)

class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    competition_id = Column(Integer, ForeignKey("competitions.id"), nullable=False)
    portfolio_value = Column(Numeric(18, 8), default=0)
    realized_pnl = Column(Numeric(18,8), nullable=True)
    unrealized_pnl = Column(Numeric(18,8), nullable=True)

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

# Persistent cache of on-chain marketplace orders for attribution across restarts
class MarketplaceOrderCache(Base):
    __tablename__ = 'marketplace_order_cache'
    order_id = Column(Integer, primary_key=True, index=True)
    domain_contract = Column(String(42), nullable=True, index=True)
    token_id = Column(String(255), nullable=True, index=True)
    price_raw = Column(String(80), nullable=True)  # store raw wei as string to avoid precision issues
    seller_wallet = Column(String(42), nullable=True, index=True)
    created_block_time = Column(DateTime(timezone=True), nullable=True, index=True)
    fulfilled_tx_hash = Column(String(80), nullable=True, index=True)
    fulfilled_block_time = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class ProcessedEvent(Base):
    __tablename__ = "processed_events"
    id = Column(Integer, primary_key=True, index=True)
    unique_id = Column(String(255), nullable=False)
    event_type = Column(String(64), nullable=False, index=True)
    payload = Column(JSON, nullable=True)  # stored eventData for correlation/backfill
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('unique_id', name='uq_processed_events_unique'),)

class PollIngestState(Base):
    __tablename__ = 'poll_ingest_state'
    id = Column(Integer, primary_key=True, index=True)
    last_ack_event_id = Column(Integer, nullable=True, index=True)
    last_ingested_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_integrity_hash = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Domain(Base):
    __tablename__ = "domains"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    tld = Column(String(32), nullable=True, index=True)
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_event_at = Column(DateTime(timezone=True), nullable=True)
    last_floor_price = Column(Numeric(18,8), nullable=True)
    last_estimated_value = Column(Numeric(18,8), nullable=True)
    last_orderbook_snapshot_at = Column(DateTime(timezone=True), nullable=True, index=True)

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

class DomainValuationOverride(Base):
    __tablename__ = 'domain_valuation_overrides'
    id = Column(Integer, primary_key=True, index=True)
    domain_name = Column(String(255), ForeignKey('domains.name'), nullable=False, index=True)
    override_value = Column(Numeric(18,8), nullable=False)
    reason = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (UniqueConstraint('domain_name', name='uq_domain_override_domain'),)

class DomainValuationDispute(Base):
    __tablename__ = 'domain_valuation_disputes'
    id = Column(Integer, primary_key=True, index=True)
    domain_name = Column(String(255), ForeignKey('domains.name'), nullable=False, index=True)
    reason = Column(Text, nullable=True)
    status = Column(String(16), nullable=False, index=True, default='OPEN')  # OPEN / RESOLVED / REJECTED
    votes = Column(Integer, nullable=False, default=0)
    threshold = Column(Integer, nullable=True)  # optional explicit threshold snapshot
    created_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True, index=True)

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
    # Fee & economics extensions
    management_fee_bps = Column(Integer, nullable=True)  # annualized, e.g. 200 = 2%
    performance_fee_bps = Column(Integer, nullable=True)  # on positive nav delta (placeholder metric)
    fee_accrued = Column(Numeric(24,8), nullable=True)  # cumulative fees (in nav units)
    nav_high_water = Column(Numeric(18,8), nullable=True)  # High-water mark for performance fee crystallization
    management_fee_last_accrued_at = Column(DateTime(timezone=True), nullable=True, index=True)
    creation_fee_bps = Column(Integer, nullable=True)  # primary market subscription fee
    redemption_fee_bps = Column(Integer, nullable=True)  # primary market redemption fee
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
    settlement_order_ids = Column(JSON, nullable=True)  # array of external order ids used in redemption settlement
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class DomainETFRedemptionIntent(Base):
    __tablename__ = "domain_etf_redemption_intents"
    id = Column(Integer, primary_key=True, index=True)
    etf_id = Column(Integer, ForeignKey('domain_etfs.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    shares = Column(Numeric(24,8), nullable=False)
    nav_per_share_snapshot = Column(Numeric(24,8), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    executed_at = Column(DateTime(timezone=True), nullable=True, index=True)
    verified_onchain = Column(Boolean, nullable=True, index=True)

# Competition epochs & rewards for incentive layer
class CompetitionEpoch(Base):
    __tablename__ = "competition_epochs"
    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey('competitions.id'), nullable=False, index=True)
    epoch_index = Column(Integer, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    reward_pool = Column(Numeric(24,8), nullable=True)
    distributed = Column(Boolean, default=False, index=True)
    __table_args__ = (UniqueConstraint('competition_id','epoch_index', name='uq_competition_epoch_idx'),)

class CompetitionReward(Base):
    __tablename__ = "competition_rewards"
    id = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey('competitions.id'), nullable=False, index=True)
    epoch_id = Column(Integer, ForeignKey('competition_epochs.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    points = Column(Numeric(24,8), nullable=False)
    volume = Column(Numeric(24,8), nullable=True)
    pnl = Column(Numeric(24,8), nullable=True)
    sharpe_like = Column(Numeric(24,8), nullable=True)
    turnover_ratio = Column(Numeric(24,8), nullable=True)
    concentration_index = Column(Numeric(24,8), nullable=True)
    reward_amount = Column(Numeric(24,8), nullable=True)
    distributed_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('epoch_id','user_id', name='uq_epoch_user_reward'),)

# Time-series histories
class PortfolioValueHistory(Base):
    __tablename__ = "portfolio_value_history"
    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey('participants.id'), nullable=False, index=True)
    snapshot_time = Column(DateTime(timezone=True), nullable=False, index=True)
    value = Column(Numeric(24,8), nullable=False)

class DomainETFNavHistory(Base):
    __tablename__ = "domain_etf_nav_history"
    id = Column(Integer, primary_key=True, index=True)
    etf_id = Column(Integer, ForeignKey('domain_etfs.id'), nullable=False, index=True)
    snapshot_time = Column(DateTime(timezone=True), nullable=False, index=True)
    nav_per_share = Column(Numeric(24,8), nullable=False)

# Fee events & revenue distribution
class DomainETFFeeEvent(Base):
    __tablename__ = 'domain_etf_fee_events'
    id = Column(Integer, primary_key=True, index=True)
    etf_id = Column(Integer, ForeignKey('domain_etfs.id'), nullable=False, index=True)
    event_type = Column(String(32), nullable=False, index=True)  # MANAGEMENT_ACCRUAL | PERFORMANCE_ACCRUAL | ISSUE_FEE | REDEMPTION_FEE | DISTRIBUTION
    amount = Column(Numeric(24,8), nullable=False)  # fee amount in NAV units
    nav_per_share_snapshot = Column(Numeric(18,8), nullable=True)
    meta = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class DomainETFRevenueShare(Base):
    __tablename__ = 'domain_etf_revenue_shares'
    id = Column(Integer, primary_key=True, index=True)
    etf_id = Column(Integer, ForeignKey('domain_etfs.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    amount = Column(Numeric(24,8), nullable=False)
    fee_event_id = Column(Integer, ForeignKey('domain_etf_fee_events.id'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

# Whitelisted domains for controlled competitions / operations
class DomainWhitelist(Base):
    __tablename__ = "domain_whitelist"
    id = Column(Integer, primary_key=True, index=True)
    domain_name = Column(String(255), unique=True, nullable=False, index=True)
    active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# Risk flags (wash trading, self-cross, rapid flips)
class TradeRiskFlag(Base):
    __tablename__ = "trade_risk_flags"
    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey('trades.id'), nullable=False, index=True)
    flag_type = Column(String(64), nullable=False, index=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class ParticipantHolding(Base):
    __tablename__ = "participant_holdings"
    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey('participants.id'), nullable=False, index=True)
    domain_name = Column(String(255), ForeignKey('domains.name'), nullable=False, index=True)
    quantity = Column(Numeric(24,8), nullable=False, default=0)  # number of lots (assume 1 per trade for now)
    avg_cost = Column(Numeric(24,8), nullable=True)  # average acquisition price
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)
    __table_args__ = (UniqueConstraint('participant_id','domain_name', name='uq_participant_domain_holding'),)


# Generic immutable audit log capturing critical state transitions (provenance layer)
class AuditEvent(Base):
    __tablename__ = 'audit_events'
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    entity_type = Column(String(32), nullable=False, index=True)  # e.g. ETF, FEE, REDEMPTION_INTENT
    entity_id = Column(Integer, nullable=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    payload = Column(JSON, nullable=True)  # canonical snapshot for merkle hashing
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    integrity_hash = Column(String(130), nullable=True, index=True)  # sha256(prev_integrity_hash || canonical_json)

class MerkleSnapshot(Base):
    __tablename__ = 'merkle_snapshots'
    id = Column(Integer, primary_key=True, index=True)
    last_event_id = Column(Integer, nullable=False, index=True)
    merkle_root = Column(String(66), nullable=False, index=True)  # hex sha256 root
    event_count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    signature = Column(String(512), nullable=True)  # base64 RSA signature of root
    anchor_tx_hash = Column(String(80), nullable=True, index=True)

class MerkleAccumulator(Base):
    __tablename__ = 'merkle_accumulator'
    id = Column(Integer, primary_key=True, index=True)
    level = Column(Integer, nullable=False, unique=True, index=True)
    node_hash = Column(String(66), nullable=False)  # 0x + hex
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)

# Idempotency keys (simple replay guard)
class IdempotencyKey(Base):
    __tablename__ = 'idempotency_keys'
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    route = Column(String(128), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    last_result_hash = Column(String(66), nullable=True)

# ----------------------
# Incentives / Liquidity Mining (Phase 5 scaffolding)
# ----------------------

class IncentiveSchedule(Base):
    __tablename__ = 'incentive_schedules'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    competition_id = Column(Integer, ForeignKey('competitions.id'), nullable=True, index=True)  # optional scope
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    epoch_duration_minutes = Column(Integer, nullable=False, default=60)  # granularity of emission windows
    base_emission_per_epoch = Column(Numeric(24,8), nullable=False, default=0)  # raw units (off-chain points or token units future)
    weight_volume_bps = Column(Integer, nullable=False, default=4000)  # 40%
    weight_pnl_bps = Column(Integer, nullable=False, default=3000)     # 30%
    weight_turnover_bps = Column(Integer, nullable=False, default=2000) # 20%
    weight_concentration_bps = Column(Integer, nullable=False, default=1000) # 10% (inverse concentration)
    bonus_early_join_bps = Column(Integer, nullable=False, default=500)  # applied once per user first epoch (5% extra)
    min_participants_full_emission = Column(Integer, nullable=False, default=10)
    emission_reduction_factor_bps = Column(Integer, nullable=False, default=5000)  # 50% reduction if below threshold
    # Advanced bonus / multiplier configuration (JSON arrays of objects)
    # Example volume_tier_thresholds: [{"threshold": 1000, "bonus_bps": 500}, {"threshold": 5000, "bonus_bps": 1500}]
    volume_tier_thresholds = Column(JSON, nullable=True)
    # Example holding_duration_tiers: [{"min_minutes": 30, "bonus_bps": 300}, {"min_minutes": 120, "bonus_bps": 800}]
    holding_duration_tiers = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class IncentiveEpoch(Base):
    __tablename__ = 'incentive_epochs'
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey('incentive_schedules.id'), nullable=False, index=True)
    epoch_index = Column(Integer, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False, index=True)
    planned_emission = Column(Numeric(24,8), nullable=False)
    actual_emission = Column(Numeric(24,8), nullable=True)
    participation_count = Column(Integer, nullable=True)
    adjusted = Column(Boolean, default=False, index=True)
    finalized_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (UniqueConstraint('schedule_id','epoch_index', name='uq_incentive_schedule_epoch'),)

class IncentiveUserPoint(Base):
    __tablename__ = 'incentive_user_points'
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey('incentive_schedules.id'), nullable=False, index=True)
    epoch_id = Column(Integer, ForeignKey('incentive_epochs.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    volume = Column(Numeric(24,8), nullable=True)
    pnl = Column(Numeric(24,8), nullable=True)
    turnover_ratio = Column(Numeric(24,8), nullable=True)
    concentration_index = Column(Numeric(24,8), nullable=True)
    base_points = Column(Numeric(24,8), nullable=True)
    bonus_points = Column(Numeric(24,8), nullable=True)
    total_points = Column(Numeric(24,8), nullable=True)
    reward_amount = Column(Numeric(24,8), nullable=True)
    distributed_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    __table_args__ = (UniqueConstraint('epoch_id','user_id', name='uq_incentive_epoch_user'),)
