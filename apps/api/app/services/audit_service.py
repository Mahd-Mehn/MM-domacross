from sqlalchemy.orm import Session
from typing import Any
from app.models.database import AuditEvent

def record_audit_event(db: Session, *, event_type: str, entity_type: str, entity_id: int | None = None, user_id: int | None = None, payload: Any | None = None) -> AuditEvent:
    """Persist an immutable audit event row.

    Parameters
    ----------
    db : Session
        Active SQLAlchemy session
    event_type : str
        Logical event type (e.g. CREATE_ETF, ISSUE, REDEEM, FEE_DISTRIBUTION)
    entity_type : str
        Domain entity classification (ETF, ETF_SHARE_FLOW, REDEMPTION_INTENT, FEE_EVENT)
    entity_id : int | None
        Primary id of the entity (if available)
    user_id : int | None
        User performing action (if any)
    payload : Any | None
        Canonical snapshot / metadata used for Merkle hashing
    """
    ae = AuditEvent(event_type=event_type, entity_type=entity_type, entity_id=entity_id, user_id=user_id, payload=payload)
    db.add(ae)
    return ae
