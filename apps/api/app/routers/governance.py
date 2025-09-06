from fastapi import APIRouter, Depends, HTTPException, Body, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Any
from app.database import get_db  # type: ignore
from app.deps.auth import get_current_user
from app.models.database import GovernanceConfig, GovernanceConfigAudit, User as UserModel

router = APIRouter(prefix="/governance", tags=["governance"])

RISK_KEYS = {
    'trade_max_notional_per_tx': {'desc': 'Max allowed trade notional (price) per transaction', 'default': 100000},
    'portfolio_max_concentration_bps': {'desc': 'Maximum single domain concentration in basis points (0-10000)', 'default': 7000},
}


class RiskConfigValue(BaseModel):
    value: int = Field(..., description="Configured numeric value")
    desc: str = Field(..., description="Human readable description")


class RiskConfigResponse(BaseModel):
    trade_max_notional_per_tx: RiskConfigValue
    portfolio_max_concentration_bps: RiskConfigValue
    last_modified: dict[str, str] | None = Field(None, description="Per-key ISO timestamps of last update")


class RiskUpdateRequest(BaseModel):
    trade_max_notional_per_tx: int | None = Field(
        None, ge=1, description=RISK_KEYS['trade_max_notional_per_tx']['desc']
    )
    portfolio_max_concentration_bps: int | None = Field(
        None, ge=1, le=10000, description=RISK_KEYS['portfolio_max_concentration_bps']['desc']
    )


class RiskUpdateResponse(BaseModel):
    updated: dict[str, int]
    last_modified: dict[str, str]

@router.get("/risk", response_model=RiskConfigResponse)
def get_risk_config(db: Session = Depends(get_db)) -> RiskConfigResponse:
    rows = db.query(GovernanceConfig).filter(GovernanceConfig.key.in_(RISK_KEYS.keys())).all()
    existing = {r.key: r for r in rows}
    payload: dict[str, RiskConfigValue] = {}
    last_modified: dict[str, str] = {}
    for k, meta in RISK_KEYS.items():
        row = existing.get(k)
        if row:
            payload[k] = RiskConfigValue(value=int(row.value['value']), desc=meta['desc'])  # type: ignore[index]
            if row.updated_at:
                last_modified[k] = row.updated_at.isoformat()
        else:
            payload[k] = RiskConfigValue(value=int(meta['default']), desc=meta['desc'])
    return RiskConfigResponse(**payload, last_modified=last_modified or None)  # type: ignore[arg-type]

@router.post("/risk", response_model=RiskUpdateResponse)
def update_risk_config(
    body: RiskUpdateRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
    if_match: str | None = Header(None, alias="If-Match", description="Optional optimistic lock timestamp (ISO) for ALL provided keys")
) -> RiskUpdateResponse:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail='admin only')
    body_dict = body.model_dump(exclude_unset=True)
    if not body_dict:
        raise HTTPException(status_code=400, detail='no keys provided')
    changed: dict[str, int] = {}
    last_modified: dict[str, str] = {}
    # Preload rows for optimistic lock / monotonic checks
    existing_rows = {r.key: r for r in db.query(GovernanceConfig).filter(GovernanceConfig.key.in_(body_dict.keys())).all()}

    # Optimistic lock: If-Match means all targeted keys must have updated_at <= provided timestamp
    if if_match:
        from datetime import datetime
        try:
            if_ts = datetime.fromisoformat(if_match)
        except Exception:
            raise HTTPException(status_code=400, detail='invalid If-Match timestamp')
        for key, row in existing_rows.items():
            if row.updated_at and row.updated_at > if_ts:
                raise HTTPException(status_code=409, detail=f'conflict: {key} modified at {row.updated_at.isoformat()} > {if_match}')

    for key, val in body_dict.items():
        if key not in RISK_KEYS:
            raise HTTPException(status_code=400, detail=f'unknown key {key}')
        # Enforce additional bounds beyond pydantic (e.g., cap concentration to 9500)
        if key == 'portfolio_max_concentration_bps' and int(val) > 9500:
            raise HTTPException(status_code=400, detail='portfolio_max_concentration_bps cannot exceed 9500')
        row = existing_rows.get(key)
        if not row:
            row = GovernanceConfig(key=key, value={'value': int(val)})
            db.add(row)
            old_value = None
        else:
            old_value = row.value
            row.value = {'value': int(val)}
        # Flush to get updated_at after autocommit
        db.flush()
        if row.updated_at:
            last_modified[key] = row.updated_at.isoformat()
        changed[key] = int(val)
        # Insert audit record
        audit = GovernanceConfigAudit(
            key=key,
            old_value=old_value,
            new_value=row.value,
            admin_user_id=user.id,
        )
        db.add(audit)
    db.commit()
    return RiskUpdateResponse(updated=changed, last_modified=last_modified)
