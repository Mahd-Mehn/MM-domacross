from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Any
from app.database import get_db
from app.models.database import DomainWhitelist, GovernanceConfig, AdminActionAudit, KYCRequest, User
from app.deps.auth import get_current_user
from datetime import datetime, timezone

router = APIRouter(tags=["policy"])

# Helpers

def ensure_admin(user: User):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")


def _audit(db: Session, admin_user_id: int, action_type: str, target: str | None = None, meta: dict | None = None):
    audit = AdminActionAudit(admin_user_id=admin_user_id, action_type=action_type, target=target, meta=meta or {})
    db.add(audit)

# Domain Whitelist CRUD
@router.get('/policy/whitelist', response_model=list[dict])
def list_whitelist(active: bool | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    q = db.query(DomainWhitelist)
    if active is not None:
        q = q.filter(DomainWhitelist.active == active)
    return [{ 'id': w.id, 'domain_name': w.domain_name, 'active': w.active, 'created_at': w.created_at } for w in q.order_by(DomainWhitelist.created_at.desc()).all()]

@router.post('/policy/whitelist', response_model=dict)
def add_whitelist(domain_name: str = Body(..., embed=True), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    name_l = domain_name.lower()
    existing = db.query(DomainWhitelist).filter(DomainWhitelist.domain_name == name_l).first()
    if existing:
        if not existing.active:
            existing.active = True
            _audit(db, user.id, 'WHITELIST_REACTIVATE', target=name_l)
            db.commit()
            db.refresh(existing)
        return { 'id': existing.id, 'domain_name': existing.domain_name, 'active': existing.active }
    entry = DomainWhitelist(domain_name=name_l, active=True)
    db.add(entry)
    _audit(db, user.id, 'WHITELIST_ADD', target=name_l)
    db.commit()
    db.refresh(entry)
    return { 'id': entry.id, 'domain_name': entry.domain_name, 'active': entry.active }

@router.delete('/policy/whitelist/{entry_id}', response_model=dict)
def deactivate_whitelist(entry_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    e = db.query(DomainWhitelist).filter(DomainWhitelist.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail='Not found')
    e.active = False
    _audit(db, user.id, 'WHITELIST_DEACTIVATE', target=e.domain_name)
    db.commit()
    return { 'id': e.id, 'domain_name': e.domain_name, 'active': e.active }

# Governance Config
@router.get('/policy/config', response_model=list[dict])
def list_config(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    rows = db.query(GovernanceConfig).order_by(GovernanceConfig.key.asc()).all()
    return [{ 'id': r.id, 'key': r.key, 'value': r.value, 'updated_at': r.updated_at} for r in rows]

@router.post('/policy/config/{key}', response_model=dict)
def upsert_config(key: str, value: Any = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    row = db.query(GovernanceConfig).filter(GovernanceConfig.key == key).first()
    if not row:
        row = GovernanceConfig(key=key, value=value)
        db.add(row)
        _audit(db, user.id, 'GOV_CONFIG_CREATE', target=key, meta={'value': value})
    else:
        row.value = value
        _audit(db, user.id, 'GOV_CONFIG_UPDATE', target=key, meta={'value': value})
    db.commit()
    db.refresh(row)
    return { 'id': row.id, 'key': row.key, 'value': row.value, 'updated_at': row.updated_at }

# KYC Requests
@router.post('/policy/kyc/request', response_model=dict)
def submit_kyc(document_hash: str | None = Body(None), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing_pending = db.query(KYCRequest).filter(KYCRequest.user_id == user.id, KYCRequest.status == 'PENDING').first()
    if existing_pending:
        raise HTTPException(status_code=400, detail='Existing pending request')
    req = KYCRequest(user_id=user.id, status='PENDING', document_hash=document_hash)
    db.add(req)
    db.commit()
    db.refresh(req)
    return { 'id': req.id, 'status': req.status, 'created_at': req.created_at }

@router.get('/policy/kyc/requests', response_model=list[dict])
def list_kyc(status: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    q = db.query(KYCRequest)
    if status:
        q = q.filter(KYCRequest.status == status.upper())
    rows = q.order_by(KYCRequest.created_at.desc()).limit(200).all()
    return [{ 'id': r.id, 'user_id': r.user_id, 'status': r.status, 'document_hash': r.document_hash, 'created_at': r.created_at, 'reviewed_at': r.reviewed_at } for r in rows]

@router.post('/policy/kyc/requests/{request_id}/approve', response_model=dict)
def approve_kyc(request_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    r = db.query(KYCRequest).filter(KYCRequest.id == request_id).first()
    if not r:
        raise HTTPException(status_code=404, detail='Not found')
    if r.status != 'PENDING':
        raise HTTPException(status_code=400, detail='Not pending')
    r.status = 'APPROVED'
    r.reviewed_at = datetime.now(timezone.utc)
    u = db.query(User).filter(User.id == r.user_id).first()
    if u:
        u.kyc_verified = True
    _audit(db, user.id, 'KYC_APPROVE', target=str(r.user_id))
    db.commit()
    db.refresh(r)
    return { 'id': r.id, 'status': r.status, 'reviewed_at': r.reviewed_at }

@router.post('/policy/kyc/requests/{request_id}/reject', response_model=dict)
def reject_kyc(request_id: int, notes: str | None = Body(None), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    r = db.query(KYCRequest).filter(KYCRequest.id == request_id).first()
    if not r:
        raise HTTPException(status_code=404, detail='Not found')
    if r.status != 'PENDING':
        raise HTTPException(status_code=400, detail='Not pending')
    r.status = 'REJECTED'
    r.notes = notes
    r.reviewed_at = datetime.now(timezone.utc)
    _audit(db, user.id, 'KYC_REJECT', target=str(r.user_id), meta={'notes': notes})
    db.commit()
    db.refresh(r)
    return { 'id': r.id, 'status': r.status, 'reviewed_at': r.reviewed_at }

# Admin Action Audit listing
@router.get('/policy/audit', response_model=list[dict])
def list_admin_audit(limit: int = 100, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    q = db.query(AdminActionAudit).order_by(AdminActionAudit.created_at.desc()).limit(min(limit, 500)).all()
    return [ { 'id': a.id, 'admin_user_id': a.admin_user_id, 'action_type': a.action_type, 'target': a.target, 'meta': a.meta, 'created_at': a.created_at } for a in q ]
