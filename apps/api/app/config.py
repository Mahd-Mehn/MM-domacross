from typing import Optional
from pydantic import Field, field_validator
import json
import os
from dotenv import load_dotenv
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()

class Settings(BaseSettings):
    """Central application settings (Pydantic v2 style)."""
    model_config = SettingsConfigDict(case_sensitive=False, extra='ignore')

    app_env: str = os.getenv("APP_ENV", "local")

    # Auth
    jwt_private_key_b64: str | None = None
    jwt_public_key_b64: str | None = None
    jwt_issuer: str = "domacross"
    jwt_audience: str = "domacross-users"
    jwt_ttl_seconds: int = 3600

    redis_url: str = "redis://localhost:6379/0"

    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "domacross"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    database_url: str | None = Field(default=None, alias='DATABASE_URL')

    # Blockchain (optional for API baseline)
    doma_testnet_chain_id: Optional[int] = None
    doma_rpc_url_primary: Optional[str] = None
    doma_rpc_url_fallback: Optional[str] = None

    # Doma Poll API
    doma_poll_base_url: Optional[str] = None
    doma_poll_api_key: Optional[str] = None

    # Additional Doma API surfaces (future use)
    doma_marketplace_base_url: Optional[str] = None
    doma_orderbook_base_url: Optional[str] = None
    doma_subgraph_url: Optional[str] = None
    doma_api_key: Optional[str] = Field(default=None, alias='DOMA_TESTNET_API_KEY')  # API key for Doma services
    
    # Doma Fractionalization
    doma_fractionalization_contract: Optional[str] = None
    enable_fractional_tokens: bool = Field(default=True, alias='ENABLE_FRACTIONAL_TOKENS')
    
    # DomaRank Oracle
    enable_doma_rank_oracle: bool = Field(default=True, alias='ENABLE_DOMA_RANK_ORACLE')
    doma_rank_update_interval_seconds: int = 21600  # 6 hours - runs 4 times per day

    # Ingestion feature flags
    enable_raw_chain_ingest: bool = False  # default to False to stay within official Doma Poll API surface
    enable_chain_marketplace_events: bool = True  # parse DomainMarketplace events when raw ingest enabled

    # On-chain contract addresses (optional)
    domain_marketplace_contract_address: Optional[str] = None  # DomainMarketplace.sol address for event parsing

    # Settlement / Redemption validation config
    redemption_contract_address: Optional[str] = None
    redemption_expected_event_topic0: Optional[str] = None
    redemption_min_logs: int = 1
    redemption_min_gas_used: int = 21000
    redemption_min_value_wei: Optional[int] = None
    redemption_weth_contract_address: Optional[str] = None

    # Competition settlement verification
    competition_settlement_contract_address: Optional[str] = None
    competition_settlement_finalized_topic0: Optional[str] = None
    competition_settlement_prizepaid_topic0: Optional[str] = None
    competition_settlement_min_logs: int = 1

    valuation_model_version: str = "v1.0"
    # Valuation engine weights (v1)
    valuation_weight_trade: float = 0.45
    valuation_weight_floor: float = 0.25
    valuation_weight_orderbook: float = 0.20
    valuation_weight_time_decay: float = 0.10
    # Ensemble (Phase 10) – when enabled, a secondary blending layer chooses among
    # heuristic (baseline current engine), external_oracle (stub), and ml_model (stub)
    valuation_use_ensemble: bool = False
    ensemble_weight_heuristic: float = 0.55
    ensemble_weight_external: float = 0.25
    ensemble_weight_ml: float = 0.20
    valuation_trade_lookback_minutes: int = 720
    valuation_decay_lambda: float = 0.00005
    valuation_min_samples_trade: int = 2
    valuation_freshness_lambda: float = 0.00005
    valuation_dispute_vote_threshold: int = 3
    orderbook_snapshot_interval_seconds: int = 21600  # 6 hours - runs 4 times per day
    reconciliation_interval_seconds: int = 21600  # 6 hours - runs 4 times per day
    listing_ttl_days: int = 30
    domain_stale_seconds: int = 3600
    external_oracle_max_age_seconds: int = 600  # staleness threshold for external oracle price adoption
    backfill_fallback_max_age_seconds: int = 3600  # max age (s) to apply tx-hash fallback for external_order_id
    # Metrics config
    metrics_returns_window_minutes: int = 1440
    metrics_cache_ttl_seconds: int = 30
    risk_free_rate_annual_pct: float = 0.0
    domain_valuation_interval_seconds: int = 120
    # Reward formula weights (tunable)
    reward_sharpe_weight: float = 0.5
    reward_turnover_weight: float = 0.1
    reward_concentration_weight: float = 0.1
    reward_min_multiplier: float = 0.5
    reward_max_multiplier: float = 3.0

    # Anti-abuse / Phase 6
    rate_limit_trades_per_minute: int = 30
    rate_limit_trades_burst: int = 10
    circuit_breaker_nav_move_bps: int = 2000  # 20% move triggers breaker
    circuit_breaker_window_minutes: int = 15

    # Background Services Control
    enable_background_polling: bool = Field(default=False, alias='ENABLE_BACKGROUND_POLLING')
    enable_orderbook_snapshots: bool = Field(default=False, alias='ENABLE_ORDERBOOK_SNAPSHOTS')
    enable_nav_calculations: bool = Field(default=False, alias='ENABLE_NAV_CALCULATIONS')
    enable_reconciliation: bool = Field(default=False, alias='ENABLE_RECONCILIATION')
    enable_backfill_service: bool = Field(default=False, alias='ENABLE_BACKFILL_SERVICE')
    enable_merkle_service: bool = Field(default=False, alias='ENABLE_MERKLE_SERVICE')

    # Admins - Simplified to avoid pydantic parsing issues
    admin_wallets: list[str] = Field(default_factory=list)
    
    def load_admin_wallets_from_env(self):
        """Load admin wallets from environment after initialization"""
        import os
        admin_wallets_env = os.getenv('ADMIN_WALLETS', '')
        if admin_wallets_env:
            self.admin_wallets = [s.strip().lower() for s in admin_wallets_env.split(',') if s.strip()]


def _generate_ephemeral_keys() -> tuple[str, str]:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    import base64
    
    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return (
        base64.b64encode(private_pem).decode(),
        base64.b64encode(public_pem).decode(),
    )


settings = Settings()

# Load admin wallets from environment
settings.load_admin_wallets_from_env()

# Provide ephemeral keys if not supplied so app can start in dev/hackathon contexts.
if not settings.jwt_private_key_b64 or not settings.jwt_public_key_b64:
    priv, pub = _generate_ephemeral_keys()
    settings.jwt_private_key_b64 = priv
    settings.jwt_public_key_b64 = pub
