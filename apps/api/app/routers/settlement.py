from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.database import AuditEvent, MerkleSnapshot, DomainETFShareFlow, DomainETFFeeEvent, DomainETFRedemptionIntent, DomainETF as DomainETFModel
from app.services.merkle_service import merkle_service
from app.deps.auth import get_current_user
from app.models.database import User as UserModel
from typing import Any
from hashlib import sha256
from app.config import settings
from app.services.redis_rate_limit import consume_token as rl_consume
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization

router = APIRouter()

# Simple in-memory token bucket per IP+endpoint (not persistent; for production use Redis / external store)
import time
_rate_buckets: dict[str, tuple[float, float]] = {}

def _consume_token(key: str, capacity: int = 120, refill_rate: float = 2.0) -> bool:
    """Token bucket; refill_rate tokens per second up to capacity."""
    now = time.time()
    tokens, last = _rate_buckets.get(key, (capacity * 1.0, now))
    # Refill
    tokens = min(capacity, tokens + (now - last) * refill_rate)
    if tokens < 1.0:
        _rate_buckets[key] = (tokens, now)
        return False
    tokens -= 1.0
    _rate_buckets[key] = (tokens, now)
    return True

def _enforce_rate_limit(request: Request, bucket: str, capacity: int = 120, refill_rate: float = 2.0):
    ip = request.client.host if request.client else 'unknown'
    key = f"{bucket}:{ip}"
    # Try Redis first; fallback to in-memory
    if not rl_consume(key, capacity=capacity, refill_rate=refill_rate):
        # fallback local bucket attempt
        if not _consume_token(key, capacity=capacity, refill_rate=refill_rate):
            raise HTTPException(status_code=429, detail='Rate limit exceeded')

def _hash_leaf(obj: dict) -> bytes:
    # Stable JSON encoding (sorted keys) then sha256
    import json
    encoded = json.dumps(obj, sort_keys=True, separators=(',',':')).encode()
    return sha256(encoded).digest()

def _build_merkle(leaves: list[bytes]) -> bytes:
    if not leaves:
        return b'\x00'*32
    layer = leaves
    while len(layer) > 1:
        nxt: list[bytes] = []
        for i in range(0,len(layer),2):
            left = layer[i]
            right = layer[i+1] if i+1 < len(layer) else left
            nxt.append(sha256(left+right).digest())
        layer = nxt
    return layer[0]

@router.get('/settlement/audit-events')
def list_audit_events(limit: int = 200, offset: int = 0, event_type: str | None = None, entity_type: str | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    q = db.query(AuditEvent)
    if event_type:
        q = q.filter(AuditEvent.event_type == event_type)
    if entity_type:
        q = q.filter(AuditEvent.entity_type == entity_type)
    rows = q.order_by(AuditEvent.id.desc()).limit(min(limit,500)).offset(offset).all()
    return [ {
        'id': r.id,
        'event_type': r.event_type,
        'entity_type': r.entity_type,
        'entity_id': r.entity_id,
        'user_id': r.user_id,
        'payload': r.payload,
        'created_at': r.created_at.isoformat()
    } for r in rows ]

@router.get('/settlement/merkle/latest')
def latest_merkle(db: Session = Depends(get_db)):
    snap = db.query(MerkleSnapshot).order_by(MerkleSnapshot.id.desc()).first()
    if not snap:
        return { 'merkle_root': None, 'event_count': 0, 'last_event_id': None }
    return { 'merkle_root': snap.merkle_root, 'event_count': snap.event_count, 'last_event_id': snap.last_event_id, 'created_at': snap.created_at.isoformat() }

@router.post('/settlement/merkle/recompute')
def recompute_merkle(db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Simple admin gate (could use config admin list)
    from app.config import settings
    if user.wallet_address.lower() not in settings.admin_wallets:
        raise HTTPException(status_code=403, detail='Not authorized')
    rows = db.query(AuditEvent).order_by(AuditEvent.id.asc()).all()
    leaves = []
    for r in rows:
        base = {
            'id': r.id,
            't': r.event_type,
            'e': r.entity_type,
            'eid': r.entity_id,
            'u': r.user_id,
            'p': r.payload
        }
        leaves.append(_hash_leaf(base))
    root = _build_merkle(leaves).hex()
    snap = MerkleSnapshot(last_event_id=rows[-1].id if rows else 0, merkle_root='0x'+root, event_count=len(rows))
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return { 'merkle_root': snap.merkle_root, 'event_count': snap.event_count, 'last_event_id': snap.last_event_id }

@router.get('/settlement/etfs/{etf_id}/proof')
def etf_settlement_proof(etf_id: int, db: Session = Depends(get_db)):
    # Provide lightweight proof context: recent share flows & fee events hashed individually (client can reconstruct)
    flows = db.query(DomainETFShareFlow).filter(DomainETFShareFlow.etf_id==etf_id).order_by(DomainETFShareFlow.id.desc()).limit(50).all()
    fees = db.query(DomainETFFeeEvent).filter(DomainETFFeeEvent.etf_id==etf_id).order_by(DomainETFFeeEvent.id.desc()).limit(50).all()
    def to_dict_flow(f):
        return {'id': f.id, 't': f.flow_type, 's': str(f.shares), 'c': str(f.cash_value), 'nps': str(f.nav_per_share), 'so': f.settlement_order_ids, 'at': f.created_at.isoformat() }
    def to_dict_fee(e):
        return {'id': e.id, 't': e.event_type, 'a': str(e.amount), 'nps': str(e.nav_per_share_snapshot) if e.nav_per_share_snapshot is not None else None, 'm': e.meta, 'at': e.created_at.isoformat() }
    flow_dicts = [to_dict_flow(f) for f in flows]
    fee_dicts = [to_dict_fee(e) for e in fees]
    return {
        'etf_id': etf_id,
        'flows': flow_dicts,
        'fee_events': fee_dicts,
        'flow_hashes': [ '0x'+_hash_leaf(d).hex() for d in flow_dicts],
        'fee_hashes': [ '0x'+_hash_leaf(d).hex() for d in fee_dicts]
    }

@router.get('/settlement/audit-events/{event_id}/merkle-proof')
def audit_event_merkle_proof(event_id: int, db: Session = Depends(get_db)):
    proof = merkle_service.compute_proof_path(db, event_id)
    if 'error' in proof:
        raise HTTPException(status_code=404, detail=proof['error'])
    # Attach leaf payload + latest snapshot signature if available
    ae = db.query(AuditEvent).filter(AuditEvent.id==event_id).first()
    snap = db.query(MerkleSnapshot).order_by(MerkleSnapshot.id.desc()).first()
    leaf = None
    if ae:
        leaf = { 'id': ae.id, 't': ae.event_type, 'e': ae.entity_type, 'eid': ae.entity_id, 'u': ae.user_id, 'p': ae.payload }
    proof['leaf'] = leaf
    if snap and snap.merkle_root == proof.get('merkle_root'):
        proof['snapshot_signature'] = snap.signature
        proof['anchor_tx_hash'] = snap.anchor_tx_hash
    return proof

@router.post('/settlement/etfs/{etf_id}/redemption-proof/{intent_id}')
def submit_redemption_proof(etf_id: int, intent_id: int, tx_hash: str, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Mark redemption intent executed if not already; rely on existing execute path but log audit event
    intent = db.query(DomainETFRedemptionIntent).filter(DomainETFRedemptionIntent.id==intent_id, DomainETFRedemptionIntent.etf_id==etf_id).first()
    if not intent:
        raise HTTPException(status_code=404, detail='Intent not found')
    if intent.executed_at is None:
        raise HTTPException(status_code=400, detail='Intent not yet executed in system (call execute first)')
    # Create audit event for provenance linking on-chain tx hash to executed redemption
    ae = AuditEvent(event_type='REDEMPTION_PROOF', entity_type='REDEMPTION_INTENT', entity_id=intent.id, user_id=user.id, payload={'tx_hash': tx_hash, 'etf_id': etf_id, 'shares': str(intent.shares)})
    db.add(ae)
    db.commit()
    db.refresh(ae)
    return { 'audit_event_id': ae.id }

def record_audit_event(db: Session, event_type: str, entity_type: str, entity_id: int | None, user_id: int | None, payload: Any | None = None):
    ae = AuditEvent(event_type=event_type, entity_type=entity_type, entity_id=entity_id, user_id=user_id, payload=payload)
    db.add(ae)
    return ae

@router.get('/settlement/audit-events/export')
def export_audit_events(limit: int = 1000, offset: int = 0, cursor_after_id: int | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Simple authorization: restrict to admins
    from app.config import settings
    if user.wallet_address.lower() not in settings.admin_wallets:
        raise HTTPException(status_code=403, detail='Not authorized')
    q = db.query(AuditEvent).order_by(AuditEvent.id.asc())
    if cursor_after_id:
        q = q.filter(AuditEvent.id > cursor_after_id)
    else:
        q = q.offset(offset)
    q = q.limit(min(limit, 5000))
    rows = q.all()
    import json
    lines = []
    for r in rows:
        lines.append(json.dumps({
            'id': r.id,
            'event_type': r.event_type,
            'entity_type': r.entity_type,
            'entity_id': r.entity_id,
            'user_id': r.user_id,
            'payload': r.payload,
            'created_at': r.created_at.isoformat()
        }, sort_keys=True))
    next_cursor = rows[-1].id if rows else None
    return {'offset': offset, 'count': len(lines), 'next_cursor': next_cursor, 'data': lines}

@router.get('/settlement/public-key')
def public_key(request: Request, response: Response):
    # Public key rarely changes; strong cache & ETag
    pk = settings.jwt_public_key_b64 or ''
    import hashlib
    etag = 'W/"pk-' + hashlib.sha256(pk.encode()).hexdigest()[:16] + '"'
    inm = request.headers.get('if-none-match')
    if inm == etag:
        response.status_code = 304
        return
    response.headers['ETag'] = etag
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return { 'public_key_pem_b64': pk }

_verify_sig_calls = 0

@router.post('/settlement/verify-signature')
def verify_signature(request: Request, root: str, signature_b64: str):
    _enforce_rate_limit(request, 'verify_single', capacity=300, refill_rate=3.0)
    global _verify_sig_calls
    _verify_sig_calls += 1
    if _verify_sig_calls > 1000:
        # crude throttle (resets not implemented for brevity)
        raise HTTPException(status_code=429, detail='Verification throttle exceeded')
    if not settings.jwt_public_key_b64:
        raise HTTPException(status_code=400, detail='No public key available')
    try:
        pem = base64.b64decode(settings.jwt_public_key_b64)
        pub = serialization.load_pem_public_key(pem)
        sig = base64.b64decode(signature_b64)
        pub.verify(sig, root.encode(), padding.PKCS1v15(), hashes.SHA256())
        return { 'valid': True }
    except Exception:
        return { 'valid': False }

@router.post('/settlement/verify-signatures-batch')
def verify_signatures_batch(request: Request, payload: dict):
    _enforce_rate_limit(request, 'verify_batch', capacity=120, refill_rate=1.5)
    roots = payload.get('roots') or []
    signatures = payload.get('signatures') or []
    if len(roots) != len(signatures):
        raise HTTPException(status_code=400, detail='roots/signatures length mismatch')
    if not settings.jwt_public_key_b64:
        raise HTTPException(status_code=400, detail='No public key available')
    try:
        pem = base64.b64decode(settings.jwt_public_key_b64)
        pub = serialization.load_pem_public_key(pem)
    except Exception:
        raise HTTPException(status_code=500, detail='Public key load failed')
    results: list[bool] = []
    for r, s in zip(roots, signatures):
        try:
            sig = base64.b64decode(s)
            pub.verify(sig, r.encode(), padding.PKCS1v15(), hashes.SHA256())
            results.append(True)
        except Exception:
            results.append(False)
    return { 'results': results }

@router.get('/settlement/snapshot-with-proofs')
def snapshot_with_proofs(request: Request, response: Response, limit: int = 5, cursor_before_id: int | None = None, event_types: str | None = None, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 50))
    snap = db.query(MerkleSnapshot).order_by(MerkleSnapshot.id.desc()).first()
    if not snap:
        return { 'snapshot': None, 'proofs': [], 'next_cursor': None, 'has_more': False }
    q = db.query(AuditEvent)
    if event_types:
        types = [t for t in event_types.split(',') if t]
        if types:
            q = q.filter(AuditEvent.event_type.in_(types))
    if cursor_before_id:
        q = q.filter(AuditEvent.id < cursor_before_id)
    events = q.order_by(AuditEvent.id.desc()).limit(limit).all()
    proofs = []
    lowest_id = None
    for ev in events:
        proof = merkle_service.compute_proof_path(db, ev.id)
        if 'error' in proof:
            continue
        # Attach leaf for client-side inclusion verification
        leaf = { 'id': ev.id, 't': ev.event_type, 'e': ev.entity_type, 'eid': ev.entity_id, 'u': ev.user_id, 'p': ev.payload }
        proof_obj = { 'event_id': ev.id, 'leaf': leaf, **proof }
        proofs.append(proof_obj)
        lowest_id = ev.id if lowest_id is None or ev.id < lowest_id else lowest_id
    # Determine if more events exist
    has_more = False
    next_cursor = None
    if lowest_id is not None:
        more_exists = db.query(AuditEvent).filter(AuditEvent.id < lowest_id).first() is not None
        has_more = more_exists
        next_cursor = lowest_id if more_exists else None
    # Build response object
    resp_obj = { 'snapshot': { 'merkle_root': snap.merkle_root, 'signature': snap.signature, 'anchor_tx_hash': snap.anchor_tx_hash, 'event_count': snap.event_count, 'created_at': snap.created_at.isoformat() }, 'proofs': proofs, 'next_cursor': next_cursor, 'has_more': has_more }
    # ETag: based on snapshot root + event ids set
    import hashlib, json
    id_part = ','.join(str(p['event_id']) for p in proofs)
    etag_val = f"{snap.merkle_root}:{snap.event_count}:{id_part}:{next_cursor or ''}"
    etag = 'W/"snap-' + hashlib.sha256(etag_val.encode()).hexdigest()[:16] + '"'
    inm = request.headers.get('if-none-match')
    if inm == etag:
        response.status_code = 304
        return
    response.headers['ETag'] = etag
    response.headers['Cache-Control'] = 'public, max-age=15'
    return resp_obj

@router.get('/settlement/fee-events-unified')
def fee_events_unified(request: Request, response: Response, limit: int = 25, cursor_before_id: int | None = None, event_types: str | None = None, db: Session = Depends(get_db)):
    """Unified fee-event listing with bundled proofs when available (leverages snapshot root).
    Primarily for frontend to replace separate fee-events fetch + individual proof calls."""
    limit = max(1, min(limit, 100))
    snap = db.query(MerkleSnapshot).order_by(MerkleSnapshot.id.desc()).first()
    q = db.query(AuditEvent).filter(AuditEvent.event_type.in_([
        'MANAGEMENT_ACCRUAL','PERFORMANCE_ACCRUAL','ISSUE_FEE','REDEMPTION_FEE','DISTRIBUTION'
    ]))
    if event_types:
        types = [t for t in event_types.split(',') if t]
        if types:
            q = q.filter(AuditEvent.event_type.in_(types))
    if cursor_before_id:
        q = q.filter(AuditEvent.id < cursor_before_id)
    rows = q.order_by(AuditEvent.id.desc()).limit(limit).all()
    proofs: list[dict[str, Any]] = []
    lowest = None
    for r in rows:
        proof = merkle_service.compute_proof_path(db, r.id)
        if 'error' in proof:
            leaf = None
        else:
            leaf = { 'id': r.id, 't': r.event_type, 'e': r.entity_type, 'eid': r.entity_id, 'u': r.user_id, 'p': r.payload }
            proof['leaf'] = leaf
            proofs.append({ 'event_id': r.id, **proof })
        lowest = r.id if lowest is None or r.id < lowest else lowest
    has_more = False
    next_cursor = None
    if lowest is not None and db.query(AuditEvent).filter(AuditEvent.id < lowest, AuditEvent.event_type.in_([
        'MANAGEMENT_ACCRUAL','PERFORMANCE_ACCRUAL','ISSUE_FEE','REDEMPTION_FEE','DISTRIBUTION'
    ])).first():
        has_more = True
        next_cursor = lowest
    import hashlib
    etag_source = f"fee-unified:{snap.merkle_root if snap else 'none'}:{','.join(str(p['event_id']) for p in proofs)}:{next_cursor or ''}"
    etag = 'W/"feu-' + hashlib.sha256(etag_source.encode()).hexdigest()[:16] + '"'
    inm = request.headers.get('if-none-match')
    if inm == etag:
        response.status_code = 304
        return
    response.headers['ETag'] = etag
    response.headers['Cache-Control'] = 'public, max-age=10'
    return {
        'snapshot_root': snap.merkle_root if snap else None,
        'snapshot_signature': snap.signature if snap else None,
        'anchor_tx_hash': snap.anchor_tx_hash if snap else None,
        'events': [ { 'id': r.id, 'event_type': r.event_type, 'entity_type': r.entity_type, 'payload': r.payload, 'created_at': r.created_at.isoformat() } for r in rows],
        'proofs': proofs,
        'next_cursor': next_cursor,
        'has_more': has_more
    }
