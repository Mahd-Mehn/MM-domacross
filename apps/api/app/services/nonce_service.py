import secrets
from typing import Optional

from app.services.redis_client import redis_client


NONCE_PREFIX = "auth:nonce:"
NONCE_TTL_SECONDS = 300  # 5 minutes


def _key(address: str) -> str:
    return f"{NONCE_PREFIX}{address.lower()}"


async def issue_nonce(address: str) -> str:
    nonce = secrets.token_urlsafe(16)
    await redis_client.setex(_key(address), NONCE_TTL_SECONDS, nonce)
    return nonce


async def peek_nonce(address: str) -> Optional[str]:
    return await redis_client.get(_key(address))


async def consume_nonce(address: str, provided: str) -> bool:
    key = _key(address)
    pipe = redis_client.pipeline(transaction=True)
    await pipe.get(key)
    await pipe.delete(key)
    res = await pipe.execute()
    current = res[0]
    if current is None:
        return False
    return secrets.compare_digest(current, provided)
