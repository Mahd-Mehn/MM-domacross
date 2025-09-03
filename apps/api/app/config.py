from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = Field(default="local", env="APP_ENV")

    # Auth
    jwt_private_key_b64: str = Field(env="JWT_PRIVATE_KEY_BASE64")
    jwt_public_key_b64: str = Field(env="JWT_PUBLIC_KEY_BASE64")
    jwt_issuer: str = Field(default="domacross", env="JWT_ISSUER")
    jwt_audience: str = Field(default="domacross-users", env="JWT_AUDIENCE")
    jwt_ttl_seconds: int = Field(default=3600, env="JWT_TTL_SECONDS")

    # Redis
    redis_url: str = Field(default="redis://redis:6379/0", env="REDIS_URL")

    # Database
    postgres_host: str = Field(default="localhost", env="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, env="POSTGRES_PORT")
    postgres_user: str = Field(env="POSTGRES_USER")
    postgres_password: str = Field(env="POSTGRES_PASSWORD")
    postgres_db: str = Field(env="POSTGRES_DB")

    # Blockchain (optional for API baseline)
    doma_testnet_chain_id: Optional[int] = Field(default=None, env="DOMA_TESTNET_CHAIN_ID")
    doma_rpc_url_primary: Optional[str] = Field(default=None, env="DOMA_TESTNET_RPC_URL_PRIMARY")
    doma_rpc_url_fallback: Optional[str] = Field(default=None, env="DOMA_TESTNET_RPC_URL_FALLBACK")


settings = Settings()
