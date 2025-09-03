"""Reconciliation service

Periodically compares local listings/offers with external orderbook states
and deactivates / updates local records that are no longer active remotely.

Designed to be lightweight: pull only a window of most recent active orders.
Actual external calls are currently placeholders until SDK/API client wiring.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence, Iterable
from datetime import datetime, timezone
import logging

from app.config import settings
from app.database import SessionLocal
from app.models.database import Listing, Offer
import httpx

logger = logging.getLogger(__name__)


@dataclass
class ExternalOrderState:
    order_id: str
    active: bool


class ReconciliationService:
    def __init__(self):
        self.last_run: datetime | None = None

    async def fetch_external_states(self, order_ids: Sequence[str]) -> dict[str, ExternalOrderState]:
        """Fetch external order activity flags.

        Strategy:
        1. POST to /orders/status (assumed batch endpoint) with { ids: [...] }
        2. Fallback: individual GET /orders/{id}

        Response contract (assumed): [{ "id": str, "active": bool }]
        Missing IDs => not active.
        """
        base = settings.doma_orderbook_base_url
        if not base or not order_ids:
            return {}
        headers = {}
        if settings.doma_poll_api_key:
            headers["x-api-key"] = settings.doma_poll_api_key
        url = base.rstrip('/') + '/orders/status'
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, json={"ids": list(order_ids)}, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    out: dict[str, ExternalOrderState] = {}
                    if isinstance(data, list):
                        for item in data:
                            oid = item.get("id")
                            if oid:
                                out[oid] = ExternalOrderState(order_id=oid, active=bool(item.get("active", False)))
                    return out
        except Exception:
            logger.exception("[reconcile] batch status request failed")
        # Fallback per-id
        results: dict[str, ExternalOrderState] = {}
        async with httpx.AsyncClient(timeout=5) as client:
            for oid in order_ids:
                try:
                    r = await client.get(base.rstrip('/') + f'/orders/{oid}', headers=headers)
                    if r.status_code == 200:
                        js = r.json()
                        active = bool(js.get('active', False))
                        results[oid] = ExternalOrderState(order_id=oid, active=active)
                except Exception:
                    logger.debug("[reconcile] per-id fetch failed oid=%s", oid)
        return results

    async def run_once(self, limit: int = 200) -> dict[str, int]:
        self.last_run = datetime.now(timezone.utc)
        if not settings.doma_orderbook_base_url:
            return {"skipped": 1}
        db = SessionLocal()
        try:
            active_listings = db.query(Listing).filter(Listing.active == True, Listing.external_order_id != None).order_by(Listing.created_at.desc()).limit(limit).all()  # noqa: E712
            active_offers = db.query(Offer).filter(Offer.active == True, Offer.external_order_id != None).order_by(Offer.created_at.desc()).limit(limit).all()  # noqa: E712
            listing_ids = [l.external_order_id for l in active_listings if l.external_order_id]
            offer_ids = [o.external_order_id for o in active_offers if o.external_order_id]
            external_ids = listing_ids + offer_ids
            if not external_ids:
                return {"processed": 0}
            states = await self.fetch_external_states(external_ids)
            deactivated = 0
            for lst in active_listings:
                st = states.get(lst.external_order_id)
                if st is None or not st.active:
                    lst.active = False
                    deactivated += 1
            for off in active_offers:
                st = states.get(off.external_order_id)
                if st is None or not st.active:
                    off.active = False
                    deactivated += 1
            if deactivated:
                db.commit()
            return {"processed": len(external_ids), "deactivated": deactivated}
        except Exception:
            logger.exception("[reconcile] failure during reconciliation run")
            return {"error": 1}
        finally:
            try:
                db.close()
            except Exception:
                pass
        # Fallback return in unexpected flow
        return {"processed": 0}


reconciliation_service = ReconciliationService()