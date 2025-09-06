from __future__ import annotations
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, Tuple, Any
from decimal import Decimal
from app.config import settings
import os
try:
    import redis  # type: ignore
except Exception:  # pragma: no cover
    redis = None

@dataclass
class _Bucket:
    events: Deque[float]

class AbuseGuard:
    def __init__(self):
        self._trade_buckets_wallet: Dict[str, _Bucket] = {}
        self._trade_buckets_ip: Dict[str, _Bucket] = {}
        self._nav_history: Deque[Tuple[float, Decimal]] = deque(maxlen=500)
        self._circuit_breaker_triggered_at: float | None = None
        self._redis: Any = None
        url = getattr(settings, 'redis_url', None)
        if url and redis:
            try:  # best effort; fall back silently
                self._redis = redis.Redis.from_url(url, decode_responses=True)
                self._redis.ping()
            except Exception:  # pragma: no cover
                self._redis = None

    def record_nav(self, nav_value: Decimal):
        now = time.time()
        self._nav_history.append((now, nav_value))
        self._evaluate_circuit_breaker(now)

    def _evaluate_circuit_breaker(self, now: float):
        if not self._nav_history:
            return
        window_sec = settings.circuit_breaker_window_minutes * 60
        cutoff = now - window_sec
        recent = [v for ts, v in self._nav_history if ts >= cutoff]
        if len(recent) < 2:
            return
        first = recent[0]
        last = recent[-1]
        if first and first != 0:
            move = (last - first) / first * Decimal(10000)  # bps
            if abs(move) >= settings.circuit_breaker_nav_move_bps:
                self._circuit_breaker_triggered_at = now
                if self._redis is not None:
                    try:
                        ttl = int(settings.circuit_breaker_window_minutes * 60)
                        self._redis.set('abuse:circuit_breaker', '1', ex=ttl)
                    except Exception:  # pragma: no cover
                        pass
        # Auto-clear after window if move normalized
        if self._circuit_breaker_triggered_at:
            # if last 2 values within 5% revert tolerance
            if abs((last - first) / first) < Decimal('0.05'):
                self._circuit_breaker_triggered_at = None
                if self._redis is not None:
                    try:
                        self._redis.delete('abuse:circuit_breaker')
                    except Exception:  # pragma: no cover
                        pass

    def circuit_breaker_active(self) -> bool:
        if self._redis is not None:
            try:
                val = self._redis.get('abuse:circuit_breaker')
                if val:
                    return True
            except Exception:  # pragma: no cover
                pass
        return self._circuit_breaker_triggered_at is not None

    def check_rate_limit(self, wallet: str, ip: str | None) -> bool:
        """Return True if allowed, False if blocked."""
        now = time.time()
        allowed_per_min = settings.rate_limit_trades_per_minute
        burst = settings.rate_limit_trades_burst
        window = 60
        def _allow(bucket_map: Dict[str, _Bucket], key: str) -> bool:
            # Redis variant: store timestamps in a sorted set key
            if self._redis is not None:
                rkey = f"abuse:bucket:{key}"
                try:
                    pipe = self._redis.pipeline()
                    cutoff = now - window
                    pipe.zremrangebyscore(rkey, 0, cutoff)
                    pipe.zcard(rkey)
                    removed, count = pipe.execute()
                    if count >= allowed_per_min + burst:
                        return False
                    self._redis.zadd(rkey, {str(now): now})
                    self._redis.expire(rkey, window)
                    return True
                except Exception:  # pragma: no cover fallback to memory
                    pass
            b = bucket_map.get(key)
            if not b:
                b = _Bucket(events=deque())
                bucket_map[key] = b
            ev = b.events
            while ev and ev[0] <= now - window:
                ev.popleft()
            if len(ev) >= allowed_per_min + burst:
                return False
            ev.append(now)
            return True
        if not _allow(self._trade_buckets_wallet, wallet.lower()):
            return False
        if ip and not _allow(self._trade_buckets_ip, ip):
            return False
        return True

abuse_guard = AbuseGuard()