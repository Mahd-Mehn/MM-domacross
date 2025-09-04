import time
import math
from typing import Optional
from redis import Redis
from app.config import settings

_client: Optional[Redis] = None

def get_client() -> Optional[Redis]:
    global _client
    if _client is not None:
        return _client
    try:
        _client = Redis.from_url(settings.redis_url, decode_responses=True)
        # ping to validate
        _client.ping()
        return _client
    except Exception:
        _client = None
        return None

SCRIPT = """
-- KEYS[1] = bucket key
-- ARGV[1] = capacity
-- ARGV[2] = refill_rate (tokens per second * 1000 to keep integer)
-- ARGV[3] = now_ms
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2]) -- scaled by 1000
local now_ms = tonumber(ARGV[3])
local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = capacity
  ts = now_ms
else
  local delta = now_ms - ts
  local refill = (delta * refill_rate) / 1000.0
  tokens = math.min(capacity, tokens + refill)
  ts = now_ms
end
if tokens < 1 then
  redis.call('HMSET', key, 'tokens', tokens, 'ts', ts)
  redis.call('PEXPIRE', key, 60000)
  return 0
else
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'ts', ts)
  redis.call('PEXPIRE', key, 60000)
  return 1
end
"""

_cached_sha: Optional[str] = None

def consume_token(bucket: str, capacity: int = 120, refill_rate: float = 2.0) -> bool:
    """Distributed token bucket using Redis. refill_rate tokens/sec."""
    client = get_client()
    if not client:
        # fallback to allow (do not block if redis absent)
        return True
    global _cached_sha
  try:
    if not _cached_sha:
      loaded = client.script_load(SCRIPT)
      if isinstance(loaded, bytes):
        loaded = loaded.decode()
      _cached_sha = str(loaded)
    now_ms = int(time.time() * 1000)
    ok = client.evalsha(_cached_sha, 1, f"rl:{bucket}", str(capacity), str(int(refill_rate * 1000)), str(now_ms))
    try:
      ok_int = int(ok)  # type: ignore[arg-type]
    except Exception:
      ok_int = 0
    return ok_int == 1
  except Exception:
    return True
