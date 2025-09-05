from __future__ import annotations
from datetime import datetime, timedelta, timezone
import logging
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.database import Listing, Offer, ProcessedEvent
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

class ExternalIdBackfillService:
    """Heuristic external_order_id backfill.

    Current strategy (temporary):
      * Scan recent listings/offers missing external_order_id.
      * If a row has a tx_hash that looks like a hex hash, set external_order_id = tx_hash.

    This is a placeholder until we add a true lookup (e.g. hitting the orderbook API
    or correlating with a richer ProcessedEvent payload). We expose counts so we can
    monitor effectiveness and replace later without changing callers.
    """

    def __init__(self):
        self.last_run: datetime | None = None
        self._client: httpx.AsyncClient | None = None  # reused for async fetch (we'll run sync via asyncio.run in thread)
        # simple cache to avoid re-processing same tx hashes within a process lifetime
        self._tx_to_order: dict[str,str] = {}
        self._last_mapping_built: datetime | None = None
        # metrics
        self.total_runs = 0
        self.total_updated = 0
        self.total_scanned = 0
        # fallback age threshold (seconds); disable heuristic for older than this
        self.fallback_max_age_seconds = getattr(settings, 'backfill_fallback_max_age_seconds', 3600)

    async def _get_client(self) -> httpx.AsyncClient:
        if not self._client:
            headers = {"Accept":"application/json"}
            if settings.doma_poll_api_key:
                headers["Api-Key"] = settings.doma_poll_api_key
            self._client = httpx.AsyncClient(timeout=20.0, headers=headers)
        return self._client

    async def _fetch_market_events(self, limit: int = 500) -> list[dict]:
        """Fetch recent marketplace poll events (listing/offer) without advancing main cursor.

        NOTE: This uses the poll endpoint directly and DOES NOT acknowledge, so it always
        returns only new events relative to the shared cursor used by ingestion. If the
        main poller already consumed them, they won't appear; therefore correlation works
        best when backfill runs shortly after creation.
        Future: add dedicated endpoint for order lookup or extend ingestion to persist orderId.
        """
        if not settings.doma_poll_base_url:
            return []
        url = f"{settings.doma_poll_base_url.rstrip('/')}/v1/poll"
        params = ["eventTypes=NAME_TOKEN_LISTED","eventTypes=NAME_TOKEN_OFFER_RECEIVED","finalizedOnly=true", f"limit={limit}"]
        full = url + "?" + "&".join(params)
        client = await self._get_client()
        try:
            resp = await client.get(full)
            resp.raise_for_status()
            js = resp.json()
            return js.get('events') or []
        except Exception:
            logger.exception("[backfill] fetch market events failed")
            return []

    async def _build_tx_order_mapping(self, session: Session | None = None) -> None:
        # Rate limit: rebuild at most every 60s
        now = datetime.now(timezone.utc)
        if self._last_mapping_built and (now - self._last_mapping_built).total_seconds() < 60:
            return
        # Prefer DB payloads for reliability
        close_session = False
        if session is None:
            from app.database import SessionLocal as _SL
            session = _SL()
            close_session = True
        try:
            recent = session.query(ProcessedEvent).filter(ProcessedEvent.event_type.in_([
                'NAME_TOKEN_LISTED','NAME_TOKEN_OFFER_RECEIVED'
            ])).order_by(ProcessedEvent.id.desc()).limit(1000).all()
            for pe in recent:
                if not pe.payload:
                    continue
                txh = (pe.payload.get('txHash') or '').lower()
                oid = pe.payload.get('orderId') or pe.payload.get('listingId') or pe.payload.get('offerId') or pe.payload.get('id')
                if txh and oid and txh not in self._tx_to_order:
                    self._tx_to_order[txh] = str(oid)
            self._last_mapping_built = now
        finally:
            if close_session:
                try:
                    session.close()
                except Exception:
                    pass

    def run_once(self, lookback_minutes: int = 1440, limit: int = 200) -> dict[str, int | str]:
        self.last_run = datetime.now(timezone.utc)
        db: Session = SessionLocal()
        updated = 0
        scanned = 0
        try:
            # build / refresh mapping (synchronous usage of async helper via loop if needed)
            try:
                import asyncio as _a
                _a.run(self._build_tx_order_mapping(db))
            except RuntimeError:
                # inside event loop
                import asyncio as _a2
                _a2.get_event_loop().create_task(self._build_tx_order_mapping(db))
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)
            listings = db.query(Listing).filter(Listing.external_order_id == None, Listing.created_at >= cutoff).limit(limit).all()  # noqa: E711
            offers = db.query(Offer).filter(Offer.external_order_id == None, Offer.created_at >= cutoff).limit(limit).all()  # noqa: E711
            scanned = len(listings) + len(offers)
            if scanned == 0:
                return {"updated": 0, "scanned": 0, "status": "noop"}
            now_ts = datetime.now(timezone.utc)
            def adopt_tx_hash(model_obj):
                nonlocal updated
                if not model_obj.tx_hash or model_obj.external_order_id:
                    return
                h = model_obj.tx_hash.lower()
                # Primary: mapping via fetched events
                mapped = self._tx_to_order.get(h)
                if mapped:
                    model_obj.external_order_id = mapped
                    updated += 1
                # Fallback heuristic (only if still missing)
                elif h.startswith('0x') and len(h) >= 10:
                    # Only apply if object is fresh (created within fallback_max_age_seconds)
                    created_at = getattr(model_obj, 'created_at', None)
                    if created_at and (now_ts - created_at).total_seconds() > self.fallback_max_age_seconds:
                        return
                    model_obj.external_order_id = h
                    updated += 1
            for lst in listings:
                adopt_tx_hash(lst)
            for off in offers:
                adopt_tx_hash(off)
            if updated:
                db.commit()
            self.total_runs += 1
            self.total_updated += updated
            self.total_scanned += scanned
            return {"updated": updated, "scanned": scanned, "status": "ok" if updated else "none", "mapping_size": len(self._tx_to_order)}
        except Exception:
            logger.exception("[backfill] error during run")
            return {"error": 1, "updated": updated, "scanned": scanned, "status": "error", "mapping_size": len(self._tx_to_order)}
        finally:
            try:
                db.close()
            except Exception:
                pass

backfill_service = ExternalIdBackfillService()
