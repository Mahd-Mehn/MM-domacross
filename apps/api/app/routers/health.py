from fastapi import APIRouter
from datetime import datetime, timezone
from app.services.blockchain_service import blockchain_service
from app.services.doma_poll_service import doma_poll_service

router = APIRouter()

@router.get("/health")
async def health():
    now = datetime.now(timezone.utc)
    web3_status = {
        "initialized": blockchain_service.web3 is not None,
    }
    if hasattr(blockchain_service, "_init_error") and blockchain_service._init_error:  # type: ignore
        web3_status["init_error"] = blockchain_service._init_error  # type: ignore
    poll_status = {
        "configured": bool(doma_poll_service.base_url and doma_poll_service.api_key),
        "last_poll_time": doma_poll_service.last_poll_time.isoformat() if doma_poll_service.last_poll_time else None,
        "last_event_time": doma_poll_service.last_event_time.isoformat() if doma_poll_service.last_event_time else None,
        "total_events_processed": doma_poll_service.total_events_processed,
    }
    if poll_status["last_poll_time"]:
        try:
            poll_status["poll_lag_seconds"] = (now - doma_poll_service.last_poll_time).total_seconds()  # type: ignore
        except Exception:
            pass
    if poll_status["last_event_time"]:
        try:
            poll_status["event_lag_seconds"] = (now - doma_poll_service.last_event_time).total_seconds()  # type: ignore
        except Exception:
            pass
    # Lightweight marketplace stats (avoid heavy queries)
    try:
        from app.database import SessionLocal
        from app.models.database import Listing, Offer, Domain
        from app.config import settings
        from datetime import timedelta
        session = SessionLocal()
        total_listings = session.query(Listing).count()
        total_offers = session.query(Offer).count()
        active_listings = session.query(Listing).filter(Listing.active == True).count()  # noqa: E712
        active_offers = session.query(Offer).filter(Offer.active == True).count()  # noqa: E712
        missing_listing_ids = session.query(Listing).filter(Listing.external_order_id == None).count()  # noqa: E711
        missing_offer_ids = session.query(Offer).filter(Offer.external_order_id == None).count()  # noqa: E711
        stale_cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.domain_stale_seconds)
        stale_domains = session.query(Domain).filter((Domain.last_seen_event_at == None) | (Domain.last_seen_event_at < stale_cutoff)).count()  # noqa: E711
        market_stats = {
            "listings_total": total_listings,
            "offers_total": total_offers,
            "listings_active": active_listings,
            "offers_active": active_offers,
            "listings_missing_external_id": missing_listing_ids,
            "offers_missing_external_id": missing_offer_ids,
            "domains_stale": stale_domains,
            "stale_cutoff_iso": stale_cutoff.isoformat(),
        }
    except Exception:
        market_stats = {"error": "market_stats_unavailable"}
    finally:
        try:
            session.close()  # type: ignore
        except Exception:
            pass
    return {
        "ok": True,
        "web3": web3_status,
        "poller": poll_status,
        "market": market_stats,
        "timestamp": now.isoformat(),
    }
