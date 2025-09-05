import secrets
import time
from typing import Optional, Dict, Tuple

from app.services.redis_client import redis_client


NONCE_PREFIX = "auth:nonce:"
NONCE_TTL_SECONDS = 300  # 5 minutes

# In-memory fallback: { key: (nonce, expires_at_epoch_seconds) }
_fallback_store: Dict[str, Tuple[str, float]] = {}


def _purge_expired() -> None:
    if not _fallback_store:
        return
    now = time.time()
    expired = [k for k, (_, exp) in _fallback_store.items() if exp < now]
    for k in expired:
        _fallback_store.pop(k, None)


def _key(address: str) -> str:
    return f"{NONCE_PREFIX}{address.lower()}"


async def issue_nonce(address: str) -> str:
    nonce = secrets.token_urlsafe(16)
    key = _key(address)
    try:
        await redis_client.setex(key, NONCE_TTL_SECONDS, nonce)
        return nonce
    except Exception:
        # Fallback to memory
        _purge_expired()
        _fallback_store[key] = (nonce, time.time() + NONCE_TTL_SECONDS)
        return nonce


async def peek_nonce(address: str) -> Optional[str]:
    key = _key(address)
    try:
        return await redis_client.get(key)
    except Exception:
        _purge_expired()
        item = _fallback_store.get(key)
        if not item:
            return None
        nonce, exp = item
        if exp < time.time():
            _fallback_store.pop(key, None)
            return None
        return nonce


async def consume_nonce(address: str, provided: str) -> bool:
    key = _key(address)
    # First attempt atomic redis pipeline
    try:
        pipe = redis_client.pipeline(transaction=True)
        await pipe.get(key)
        await pipe.delete(key)
        res = await pipe.execute()
        current = res[0]
        if current is None:
            # If missing in redis, still check fallback before failing
            raise KeyError
        return secrets.compare_digest(current, provided)
    except Exception:
        # Fallback path
        _purge_expired()
        item = _fallback_store.pop(key, None)
        if not item:
            return False
        nonce, exp = item
        if exp < time.time():
            return False
        return secrets.compare_digest(nonce, provided)
