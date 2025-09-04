from typing import Optional
from pydantic import Field, field_validator
import json
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = Field(default="local", env="APP_ENV")

    # Auth
    jwt_private_key_b64: str | None = Field(default=None, env="JWT_PRIVATE_KEY_BASE64")
    jwt_public_key_b64: str | None = Field(default=None, env="JWT_PUBLIC_KEY_BASE64")
    jwt_issuer: str = Field(default="domacross", env="JWT_ISSUER")
    jwt_audience: str = Field(default="domacross-users", env="JWT_AUDIENCE")
    jwt_ttl_seconds: int = Field(default=3600, env="JWT_TTL_SECONDS")

    # Redis
    redis_url: str = Field(default="redis://redis:6379/0", env="REDIS_URL")

    # Database
    postgres_host: str = Field(default="localhost", env="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, env="POSTGRES_PORT")
    postgres_user: str | None = Field(default="domacross", env="POSTGRES_USER")
    postgres_password: str | None = Field(default="domacross", env="POSTGRES_PASSWORD")
    postgres_db: str | None = Field(default="domacross", env="POSTGRES_DB")

    # Blockchain (optional for API baseline)
    doma_testnet_chain_id: Optional[int] = Field(default=None, env="DOMA_TESTNET_CHAIN_ID")
    doma_rpc_url_primary: Optional[str] = Field(default=None, env="DOMA_TESTNET_RPC_URL_PRIMARY")
    doma_rpc_url_fallback: Optional[str] = Field(default=None, env="DOMA_TESTNET_RPC_URL_FALLBACK")

    # Doma Poll API
    doma_poll_base_url: Optional[str] = Field(default=None, env="DOMA_POLL_BASE_URL")
    doma_poll_api_key: Optional[str] = Field(default=None, env="DOMA_POLL_API_KEY")

    # Additional Doma API surfaces (future use)
    doma_marketplace_base_url: Optional[str] = Field(default=None, env="DOMA_MARKETPLACE_BASE_URL")
    doma_orderbook_base_url: Optional[str] = Field(default=None, env="DOMA_ORDERBOOK_BASE_URL")
    doma_subgraph_url: Optional[str] = Field(default=None, env="DOMA_SUBGRAPH_URL")

    valuation_model_version: str = Field(default="v1.0", env="VALUATION_MODEL_VERSION")
    # Valuation engine weights (v1)
    valuation_weight_trade: float = Field(default=0.45, env="VALUATION_WEIGHT_TRADE")
    valuation_weight_floor: float = Field(default=0.25, env="VALUATION_WEIGHT_FLOOR")
    valuation_weight_orderbook: float = Field(default=0.20, env="VALUATION_WEIGHT_ORDERBOOK")
    valuation_weight_time_decay: float = Field(default=0.10, env="VALUATION_WEIGHT_TIME_DECAY")
    valuation_trade_lookback_minutes: int = Field(default=720, env="VALUATION_TRADE_LOOKBACK_MINUTES")
    valuation_decay_lambda: float = Field(default=0.00005, env="VALUATION_DECAY_LAMBDA")  # exp(-lambda * age_seconds)
    valuation_min_samples_trade: int = Field(default=2, env="VALUATION_MIN_SAMPLES_TRADE")
    valuation_freshness_lambda: float = Field(default=0.00005, env="VALUATION_FRESHNESS_LAMBDA")
    valuation_dispute_vote_threshold: int = Field(default=3, env="VALUATION_DISPUTE_VOTE_THRESHOLD")
    orderbook_snapshot_interval_seconds: int = Field(default=60, env="ORDERBOOK_SNAPSHOT_INTERVAL_SECONDS")
    listing_ttl_days: int = Field(default=30, env="LISTING_TTL_DAYS")
    # Metrics config
    metrics_returns_window_minutes: int = Field(default=1440, env="METRICS_RETURNS_WINDOW_MINUTES")
    metrics_cache_ttl_seconds: int = Field(default=30, env="METRICS_CACHE_TTL_SECONDS")
    risk_free_rate_annual_pct: float = Field(default=0.0, env="RISK_FREE_RATE_ANNUAL_PCT")
    domain_valuation_interval_seconds: int = Field(default=120, env="DOMAIN_VALUATION_INTERVAL_SECONDS")
    # Reward formula weights (tunable)
    reward_sharpe_weight: float = Field(default=0.5, env="REWARD_SHARPE_WEIGHT")
    reward_turnover_weight: float = Field(default=0.1, env="REWARD_TURNOVER_WEIGHT")
    reward_concentration_weight: float = Field(default=0.1, env="REWARD_CONCENTRATION_WEIGHT")  # applied to (1 - concentration)
    reward_min_multiplier: float = Field(default=0.5, env="REWARD_MIN_MULTIPLIER")
    reward_max_multiplier: float = Field(default=3.0, env="REWARD_MAX_MULTIPLIER")

    # Admins
    # Read raw env into a string to avoid pydantic pre-JSON-decoding for list types.
    admin_wallets_env: str | None = Field(default=None, env="ADMIN_WALLETS")
    admin_wallets: list[str] = Field(default_factory=list, env=None)

    def model_post_init(self, __context) -> None:  # type: ignore[override]
        raw = self.admin_wallets_env
        wallets: list[str] = []
        if raw is None:
            self.admin_wallets = wallets
            return
        candidate = raw.strip()
        if not candidate:
            self.admin_wallets = wallets
            return
        # First try strict JSON array
        try:
            loaded = json.loads(candidate)
            if isinstance(loaded, list):
                wallets = [str(x).strip().lower() for x in loaded if str(x).strip()]
                self.admin_wallets = wallets
                return
        except Exception:
            pass
        # Fallback: comma-separated
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

# Provide ephemeral keys if not supplied so app can start in dev/hackathon contexts.
if not settings.jwt_private_key_b64 or not settings.jwt_public_key_b64:
    priv, pub = _generate_ephemeral_keys()
    settings.jwt_private_key_b64 = priv
    settings.jwt_public_key_b64 = pub
