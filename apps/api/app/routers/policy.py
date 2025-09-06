from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Any
from app.database import get_db
from app.models.database import DomainWhitelist, GovernanceConfig, AdminActionAudit, KYCRequest, User
from app.broadcast import get_sync_broadcast
from app.deps.auth import get_current_user
from datetime import datetime, timezone
from decimal import Decimal

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
        result = { 'id': existing.id, 'domain_name': existing.domain_name, 'active': existing.active }
        broadcast = get_sync_broadcast();
        if broadcast:
            broadcast({'type': 'policy_change', 'subtype': 'whitelist_reactivate', 'domain_name': name_l})
        return result
    entry = DomainWhitelist(domain_name=name_l, active=True)
    db.add(entry)
    _audit(db, user.id, 'WHITELIST_ADD', target=name_l)
    db.commit()
    db.refresh(entry)
    broadcast = get_sync_broadcast();
    if broadcast:
        broadcast({'type': 'policy_change', 'subtype': 'whitelist_add', 'domain_name': name_l})
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
    broadcast = get_sync_broadcast();
    if broadcast:
        broadcast({'type': 'policy_change', 'subtype': 'whitelist_deactivate', 'domain_name': e.domain_name})
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
    broadcast = get_sync_broadcast();
    if broadcast:
        broadcast({'type': 'policy_change', 'subtype': 'config_upsert', 'key': key})
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
    broadcast = get_sync_broadcast();
    if broadcast:
        broadcast({'type': 'kyc_status', 'user_id': user.id, 'status': req.status})
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
    broadcast = get_sync_broadcast();
    if broadcast:
        broadcast({'type': 'kyc_status', 'user_id': r.user_id, 'status': r.status})
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
    broadcast = get_sync_broadcast();
    if broadcast:
        broadcast({'type': 'kyc_status', 'user_id': r.user_id, 'status': r.status})
    return { 'id': r.id, 'status': r.status, 'reviewed_at': r.reviewed_at }

@router.post('/policy/kyc/users/{user_id}/revoke')
def revoke_kyc(user_id: int, reason: str | None = Body(None, embed=True), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Admin revokes a previously verified user's KYC (sets user.kyc_verified = False)."""
    ensure_admin(user)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail='User not found')
    if not u.kyc_verified:
        return { 'status': 'noop', 'user_id': user_id }
    u.kyc_verified = False
    _audit(db, user.id, 'KYC_REVOKE', target=str(user_id), meta={'reason': reason})
    db.commit()
    broadcast = get_sync_broadcast();
    if broadcast:
        broadcast({'type': 'kyc_status', 'user_id': user_id, 'status': 'REVOKED'})
    return { 'status': 'revoked', 'user_id': user_id }

@router.post('/policy/rewards/manual-adjust')
def manual_reward_adjust(
    competition_id: int = Body(...),
    epoch_index: int = Body(...),
    amount: str = Body(...),
    user_wallet: str | None = Body(None),
    user_id: int | None = Body(None),
    reason: str | None = Body(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Admin manually sets (or creates) a reward_amount for a user in an epoch (exception / override)."""
    ensure_admin(user)
    from app.models.database import CompetitionEpoch, CompetitionReward
    # Resolve user
    target_user: User | None = None
    if user_id is not None:
        target_user = db.query(User).filter(User.id == user_id).first()
    elif user_wallet:
        target_user = db.query(User).filter(User.wallet_address == user_wallet.lower()).first()
    if not target_user:
        raise HTTPException(status_code=404, detail='Target user not found')
    epoch = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==competition_id, CompetitionEpoch.epoch_index==epoch_index).first()
    if not epoch:
        raise HTTPException(status_code=404, detail='Epoch not found')
    try:
        amt = Decimal(amount)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid amount')
    reward = db.query(CompetitionReward).filter(CompetitionReward.epoch_id==epoch.id, CompetitionReward.user_id==target_user.id).first()
    now = datetime.now(timezone.utc)
    if not reward:
        # Create with zero points baseline
        reward = CompetitionReward(competition_id=competition_id, epoch_id=epoch.id, user_id=target_user.id, points=0, raw_reward_amount=amt, reward_amount=amt, distributed_at=now)
        db.add(reward)
    else:
        reward.raw_reward_amount = amt
        reward.reward_amount = amt
        reward.distributed_at = reward.distributed_at or now
        reward.claimed_at = None
        db.add(reward)
    _audit(db, user.id, 'REWARD_MANUAL_ADJUST', target=str(target_user.id), meta={'competition_id': competition_id, 'epoch_index': epoch_index, 'amount': str(amt), 'reason': reason})
    db.commit(); db.refresh(reward)
    broadcast = get_sync_broadcast();
    if broadcast:
        broadcast({'type': 'reward_manual_adjust', 'competition_id': competition_id, 'epoch_index': epoch_index, 'user_id': target_user.id, 'amount': str(amt)})
    return { 'status': 'ok', 'competition_id': competition_id, 'epoch_index': epoch_index, 'user_id': target_user.id, 'amount': str(amt) }

# Admin Action Audit listing
@router.get('/policy/audit', response_model=list[dict])
def list_admin_audit(limit: int = 100, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ensure_admin(user)
    q = db.query(AdminActionAudit).order_by(AdminActionAudit.created_at.desc()).limit(min(limit, 500)).all()
    return [ { 'id': a.id, 'admin_user_id': a.admin_user_id, 'action_type': a.action_type, 'target': a.target, 'meta': a.meta, 'created_at': a.created_at } for a in q ]
