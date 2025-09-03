from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.deps.auth import get_current_user_optional
from app.models.database import User as UserModel
from app.services.doma_poll_service import doma_poll_service

router = APIRouter()


def _require_auth_in_non_local(user: Optional[UserModel]) -> None:
    if settings.app_env != "local" and user is None:
        raise HTTPException(status_code=401, detail="Authentication required")


@router.post("/poll/run-once")
async def poll_run_once(
    limit: Optional[int] = None,
    event_types: Optional[List[str]] = None,
    maybe_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    _require_auth_in_non_local(maybe_user)
    result = await doma_poll_service.run_once(limit=limit, event_types=event_types)
    return result


@router.post("/poll/ack/{last_event_id}")
async def poll_ack(
    last_event_id: str,
    maybe_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    _require_auth_in_non_local(maybe_user)
    await doma_poll_service.ack(last_event_id)
    return {"status": "ok", "ack": last_event_id}


@router.post("/poll/reset")
async def poll_reset(
    to_event_id: Optional[str] = None,
    maybe_user: Optional[UserModel] = Depends(get_current_user_optional),
):
    _require_auth_in_non_local(maybe_user)
    await doma_poll_service.reset(to_event_id)
    return {"status": "ok", "reset_to": to_event_id}
