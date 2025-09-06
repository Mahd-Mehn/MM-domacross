from __future__ import annotations
from typing import Optional, Dict
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import random

from app.config import settings

class ExternalOracleService:
    """Lightweight external oracle adapter.

    For hackathon demo this generates deterministic pseudo prices using a seeded RNG based on domain name.
    Replace `_fetch_remote_price` with real HTTP call logic and signature verification.
    """
    def __init__(self):
        self.cache: Dict[str, tuple[Decimal, datetime]] = {}

    def _fetch_remote_price(self, domain: str) -> Optional[Decimal]:
        # TODO: integrate real endpoint (httpx) with API key + schema validation
        seed = sum(ord(c) for c in domain) % 997
        random.seed(seed)
        base = 80 + (seed % 40)  # 80..119 baseline
        jitter = random.random() * 5
        return Decimal(f"{base + jitter:.2f}")

    def get_price(self, domain: str) -> Optional[Decimal]:
        now = datetime.now(timezone.utc)
        ent = self.cache.get(domain)
        if ent:
            val, ts = ent
            if (now - ts).total_seconds() < settings.external_oracle_max_age_seconds:
                return val
        price = self._fetch_remote_price(domain)
        if price is not None:
            self.cache[domain] = (price, now)
        return price

external_oracle_service = ExternalOracleService()

__all__ = ["external_oracle_service"]