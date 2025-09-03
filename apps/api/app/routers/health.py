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
    return {
        "ok": True,
        "web3": web3_status,
        "poller": poll_status,
        "timestamp": now.isoformat(),
    }
