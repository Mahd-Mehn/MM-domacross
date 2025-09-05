from typing import Optional
from pydantic import Field, field_validator
import json
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings (Pydantic v2 style)."""
    model_config = SettingsConfigDict(case_sensitive=False, extra='ignore')

    app_env: str = Field(default="local")

    # Auth
    jwt_private_key_b64: str | None = None
    jwt_public_key_b64: str | None = None
    jwt_issuer: str = "domacross"
    jwt_audience: str = "domacross-users"
    jwt_ttl_seconds: int = 3600

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str | None = "domacross"
    postgres_password: str | None = "domacross"
    postgres_db: str | None = "domacross"

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
    valuation_trade_lookback_minutes: int = 720
    valuation_decay_lambda: float = 0.00005
    valuation_min_samples_trade: int = 2
    valuation_freshness_lambda: float = 0.00005
    valuation_dispute_vote_threshold: int = 3
    orderbook_snapshot_interval_seconds: int = 60
    reconciliation_interval_seconds: int = 600
    listing_ttl_days: int = 30
    domain_stale_seconds: int = 3600
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

    # Admins
    # Read raw env into a string to avoid pydantic pre-JSON-decoding for list types.
    admin_wallets_env: str | None = None
    admin_wallets: list[str] = Field(default_factory=list)

    @field_validator('admin_wallets', mode='before')
    @classmethod
    def _load_admin_wallets(cls, v, info):  # type: ignore[override]
        # If already provided list, normalize
        if isinstance(v, list):
            return [str(x).strip().lower() for x in v if str(x).strip()]
        # Try env fallback via admin_wallets_env (available in model instance through context not here)
        return v

    def load_admin_wallets_env(self):
        raw = self.admin_wallets_env
        if not raw:
            return
        candidate = raw.strip()
        wallets: list[str] = []
        try:
            loaded = json.loads(candidate)
            if isinstance(loaded, list):
                wallets = [str(x).strip().lower() for x in loaded if str(x).strip()]
            else:
                wallets = [s.strip().lower() for s in candidate.split(',') if s.strip()]
        except Exception:
            wallets = [s.strip().lower() for s in candidate.split(',') if s.strip()]
        self.admin_wallets = wallets


def _generate_ephemeral_keys() -> tuple[str, str]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
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
settings.load_admin_wallets_env()

# Provide ephemeral keys if not supplied so app can start in dev/hackathon contexts.
if not settings.jwt_private_key_b64 or not settings.jwt_public_key_b64:
    priv, pub = _generate_ephemeral_keys()
    settings.jwt_private_key_b64 = priv
    settings.jwt_public_key_b64 = pub
