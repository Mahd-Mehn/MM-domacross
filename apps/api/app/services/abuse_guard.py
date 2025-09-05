from __future__ import annotations
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque, Dict, Tuple
from decimal import Decimal
from app.config import settings

@dataclass
class _Bucket:
    events: Deque[float]

class AbuseGuard:
    def __init__(self):
        self._trade_buckets_wallet: Dict[str, _Bucket] = {}
        self._trade_buckets_ip: Dict[str, _Bucket] = {}
        self._nav_history: Deque[Tuple[float, Decimal]] = deque(maxlen=500)
        self._circuit_breaker_triggered_at: float | None = None

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
        # Auto-clear after window if move normalized
        if self._circuit_breaker_triggered_at:
            # if last 2 values within 5% revert tolerance
            if abs((last - first) / first) < Decimal('0.05'):
                self._circuit_breaker_triggered_at = None

    def circuit_breaker_active(self) -> bool:
        return self._circuit_breaker_triggered_at is not None

    def check_rate_limit(self, wallet: str, ip: str | None) -> bool:
        """Return True if allowed, False if blocked."""
        now = time.time()
        allowed_per_min = settings.rate_limit_trades_per_minute
        burst = settings.rate_limit_trades_burst
        window = 60
        def _allow(bucket_map: Dict[str, _Bucket], key: str) -> bool:
            b = bucket_map.get(key)
            if not b:
                b = _Bucket(events=deque())
                bucket_map[key] = b
            ev = b.events
            # prune
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