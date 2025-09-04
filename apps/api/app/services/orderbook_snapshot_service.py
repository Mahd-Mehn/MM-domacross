from __future__ import annotations
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from decimal import Decimal
import httpx
from app.config import settings
from app.models.database import OrderbookSnapshot, Domain
from sqlalchemy.orm import Session

class OrderbookSnapshotService:
    def __init__(self):
        self.base_url = settings.doma_orderbook_base_url
        self.api_key = settings.doma_poll_api_key  # reuse key if same
        self.interval_seconds = 60
        self._client: httpx.AsyncClient | None = None
        self._running = False
        # counters
        self.total_requests = 0
        self.total_failures = 0
        self.total_snapshots = 0

    def _headers(self) -> Dict[str, str]:
        h = {"Accept": "application/json"}
        if self.api_key:
            h["Api-Key"] = self.api_key
        return h

    async def _get_client(self) -> httpx.AsyncClient:
        if not self._client:
            self._client = httpx.AsyncClient(timeout=20.0, headers=self._headers())
        return self._client

    async def fetch_orderbook(self, domain_name: str) -> Dict[str, Any]:
        if not self.base_url:
            raise RuntimeError("Orderbook base URL not configured")
        client = await self._get_client()
        # Hypothetical path; adjust when exact spec known
        url = f"{self.base_url.rstrip('/')}/v1/orderbook/{domain_name}"
        self.total_requests += 1
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            self.total_failures += 1
            raise

    def persist_snapshot(self, db: Session, domain_name: str, side: str, price: Decimal, size: Decimal) -> None:
        snap = OrderbookSnapshot(domain_name=domain_name, side=side, price=price, size=size)
        db.add(snap)
        self.total_snapshots += 1

    async def snapshot_once(self, db: Session, domain_names: List[str]) -> Dict[str, Any]:
        collected = 0
        for name in domain_names:
            try:
                data = await self.fetch_orderbook(name)
                # Expect structure with 'bids' and 'asks' lists of [price, size]
                bids = data.get('bids') or []
                asks = data.get('asks') or []
                for p, s in bids[:10]:
                    self.persist_snapshot(db, name, 'BUY', Decimal(str(p)), Decimal(str(s)))
                    collected += 1
                for p, s in asks[:10]:
                    self.persist_snapshot(db, name, 'SELL', Decimal(str(p)), Decimal(str(s)))
                    collected += 1
                dom = db.query(Domain).filter(Domain.name==name).first()
                if dom:
                    dom.last_orderbook_snapshot_at = datetime.now(timezone.utc)
            except Exception:
                # swallow per-domain errors
                pass
        db.commit()
        return {"snapshots": collected}

orderbook_snapshot_service = OrderbookSnapshotService()
