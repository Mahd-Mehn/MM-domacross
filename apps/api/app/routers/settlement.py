from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.database import AuditEvent, MerkleSnapshot, DomainETFShareFlow, DomainETFFeeEvent, DomainETFRedemptionIntent, DomainETF as DomainETFModel
from app.models.database import IdempotencyKey
from app.services.merkle_service import merkle_service
from app.services.audit_service import record_audit_event
from app.services.blockchain_service import blockchain_service
from app.services.redemption_validation import validate_redemption_receipt
from app.services.competition_settlement_validation import validate_competition_settlement_receipt
from app.deps.auth import get_current_user
from app.models.database import User as UserModel
from typing import Any, List
from hashlib import sha256
from app.config import settings
from app.services.redis_rate_limit import consume_token as rl_consume
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import BaseModel

router = APIRouter()

# Simple in-memory token bucket per IP+endpoint (not persistent; for production use Redis / external store)
import time
_rate_buckets: dict[str, tuple[float, float]] = {}

def _consume_token(key: str, capacity: int = 120, refill_rate: float = 2.0) -> bool:
    """Token bucket; refill_rate tokens per second up to capacity."""
    now = time.time()
    tokens, last = _rate_buckets.get(key, (capacity * 1.0, now))
    # Refill
    # Cast capacity to float to appease strict type checkers
    tokens = min(float(capacity), tokens + (now - last) * refill_rate)
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
def list_audit_events(limit: int = 200, offset: int = 0, cursor_after_id: int | None = None, event_type: str | None = None, entity_type: str | None = None, entity_id: int | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    """List audit events with basic offset or cursor pagination.

    If cursor_after_id is supplied, rows strictly greater than that id are returned (ignores offset).
    Returns a wrapper with data array and next_cursor for subsequent calls."""
    q = db.query(AuditEvent)
    if event_type:
        # Allow comma/semicolon separated multi-values
        types = [t.strip() for t in event_type.replace(';',',').split(',') if t.strip()]
        if len(types) == 1:
            q = q.filter(AuditEvent.event_type == types[0])
        elif len(types) > 1:
            q = q.filter(AuditEvent.event_type.in_(types))
    if entity_type:
        q = q.filter(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        q = q.filter(AuditEvent.entity_id == entity_id)
    q = q.order_by(AuditEvent.id.desc())
    lim = max(1, min(limit, 500))
    if cursor_after_id is not None:
        q = q.filter(AuditEvent.id < cursor_after_id)  # descending order, fetch older
        rows = q.limit(lim).all()
    else:
        rows = q.offset(offset).limit(lim).all()
    next_cursor = rows[-1].id if rows else None
    return {
        'data': [ {
            'id': r.id,
            'event_type': r.event_type,
            'entity_type': r.entity_type,
            'entity_id': r.entity_id,
            'user_id': r.user_id,
            'payload': r.payload,
            'created_at': r.created_at.isoformat()
        } for r in rows ],
        'next_cursor': next_cursor,
        'limit': lim
    }

@router.get('/settlement/etfs/{etf_id}/redemption-intents')
def list_redemption_intents(etf_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    intents = db.query(DomainETFRedemptionIntent).filter(DomainETFRedemptionIntent.etf_id==etf_id, DomainETFRedemptionIntent.user_id==user.id).order_by(DomainETFRedemptionIntent.id.desc()).limit(200).all()
    return [ {
        'id': i.id,
        'shares': str(i.shares),
        'nav_per_share_snapshot': str(i.nav_per_share_snapshot),
        'created_at': i.created_at.isoformat() if i.created_at else None,
        'executed_at': i.executed_at.isoformat() if i.executed_at else None,
        'verified_onchain': bool(i.verified_onchain)
    } for i in intents ]

@router.get('/settlement/merkle/latest')
def latest_merkle(db: Session = Depends(get_db)):
    snap = db.query(MerkleSnapshot).order_by(MerkleSnapshot.id.desc()).first()
    if not snap:
        return { 'merkle_root': None, 'event_count': 0, 'last_event_id': None }
    return { 'merkle_root': snap.merkle_root, 'event_count': snap.event_count, 'last_event_id': snap.last_event_id, 'created_at': snap.created_at.isoformat() }

class RedemptionCreateRequest(BaseModel):
    shares: str

@router.post('/settlement/etfs/{etf_id}/redemption-intents')
def create_redemption_intent(etf_id: int, body: RedemptionCreateRequest, request: Request, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Idempotency: look for header
    idem_key = request.headers.get('Idempotency-Key')
    if idem_key:
        existing_key = db.query(IdempotencyKey).filter(IdempotencyKey.key==idem_key).first()
        if existing_key:
            # Return latest intent of this user+etf with same created_at window (simplistic approach)
            intent = db.query(DomainETFRedemptionIntent).filter(DomainETFRedemptionIntent.user_id==user.id, DomainETFRedemptionIntent.etf_id==etf_id).order_by(DomainETFRedemptionIntent.id.desc()).first()
            if intent:
                return {'id': intent.id, 'shares': str(intent.shares), 'idempotent': True}
    # Validate ETF exists
    etf = db.query(DomainETFModel).filter(DomainETFModel.id==etf_id).first()
    if not etf:
        raise HTTPException(status_code=404, detail='ETF not found')
    from decimal import Decimal
    try:
        shares_dec = Decimal(body.shares)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid shares')
    intent = DomainETFRedemptionIntent(etf_id=etf_id, user_id=user.id, shares=shares_dec, nav_per_share_snapshot=etf.nav_last)
    db.add(intent)
    if idem_key:
        db.add(IdempotencyKey(key=idem_key, route='/settlement/etfs/redemption-intents'))
    db.commit()
    db.refresh(intent)
    record_audit_event(db, event_type='REDEMPTION_INTENT_CREATE', entity_type='REDEMPTION_INTENT', entity_id=intent.id, user_id=user.id, payload={'etf_id': etf_id, 'shares': str(intent.shares)})
    return {'id': intent.id, 'shares': str(intent.shares), 'idempotent': False}

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

@router.post('/settlement/etfs/{etf_id}/redemption-verify/{intent_id}')
async def verify_redemption_onchain(etf_id: int, intent_id: int, tx_hash: str | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Validate intent exists
    intent = db.query(DomainETFRedemptionIntent).filter(DomainETFRedemptionIntent.id==intent_id, DomainETFRedemptionIntent.etf_id==etf_id).first()
    if not intent:
        raise HTTPException(status_code=404, detail='Intent not found')
    if not blockchain_service.ensure_initialized():  # type: ignore[attr-defined]
        raise HTTPException(status_code=503, detail='Blockchain RPC unavailable')
    # If tx_hash not provided attempt to locate from most recent REDEMPTION_PROOF audit event
    if not tx_hash:
        proof_ev = db.query(AuditEvent).filter(
            AuditEvent.event_type=='REDEMPTION_PROOF',
            AuditEvent.entity_type=='REDEMPTION_INTENT',
            AuditEvent.entity_id==intent.id
        ).order_by(AuditEvent.id.desc()).first()
        if proof_ev and isinstance(proof_ev.payload, dict):
            tx_hash = proof_ev.payload.get('tx_hash')
    if not tx_hash:
        raise HTTPException(status_code=400, detail='tx_hash required or submit redemption proof first')
    # Retrieve receipt and semantic checks
    receipt = await blockchain_service.get_transaction_receipt(tx_hash)
    if not receipt:
        return { 'verified': False, 'reason': 'receipt_not_found' }
    # Centralized semantic validation
    validation = validate_redemption_receipt(receipt)
    if not validation.ok:
        return { 'verified': False, **validation }
    block_number = validation.get('block')
    gas_used = validation.get('gas_used')
    log_count = validation.get('log_count')
    # Idempotent success if already verified
    if intent.verified_onchain:
        return { 'verified': True, 'block': block_number, 'already': True, 'gas_used': gas_used, 'log_count': log_count }
    # Mark intent verified and record audit event
    intent.verified_onchain = True
    ae = record_audit_event(db, event_type='REDEMPTION_TX_VERIFIED', entity_type='REDEMPTION_INTENT', entity_id=intent.id, user_id=user.id, payload={
        'etf_id': etf_id,
        'intent_id': intent_id,
        'tx_hash': tx_hash,
        'block': block_number,
        'gas_used': gas_used,
        'log_count': log_count
    })
    db.commit()
    return { 'verified': True, 'block': block_number, 'gas_used': gas_used, 'log_count': log_count, 'audit_event_id': ae.id }

@router.get('/settlement/audit-export')
def audit_export_stream(response: Response, db: Session = Depends(get_db), after_id: int | None = None, limit: int = 5000, verify_integrity: bool = False, user: UserModel = Depends(get_current_user)):
    # Restrict to admins for full export
    from app.config import settings as _settings
    if user.wallet_address.lower() not in _settings.admin_wallets:
        raise HTTPException(status_code=403, detail='Not authorized')
    limit = max(1, min(limit, 20000))
    q = db.query(AuditEvent).order_by(AuditEvent.id.asc())
    if after_id:
        q = q.filter(AuditEvent.id > after_id)
    rows = q.limit(limit).all()
    # Build JSONL content
    import json
    prev_hash = None
    integrity_ok = True
    lines = []
    for r in rows:
        # Optional integrity verification (recompute digest from previous)
        if verify_integrity:
            canonical = json.dumps({
                'event_type': r.event_type,
                'entity_type': r.entity_type,
                'entity_id': r.entity_id,
                'user_id': r.user_id,
                'payload': r.payload
            }, sort_keys=True, separators=(',',':'))
            expected = sha256(((prev_hash or '') + canonical).encode()).hexdigest()
            if expected != r.integrity_hash:
                integrity_ok = False
            prev_hash = r.integrity_hash
        lines.append(json.dumps({
            'id': r.id,
            'event_type': r.event_type,
            'entity_type': r.entity_type,
            'entity_id': r.entity_id,
            'user_id': r.user_id,
            'payload': r.payload,
            'created_at': r.created_at.isoformat(),
            'integrity_hash': r.integrity_hash
        }, sort_keys=True))
    body = '\n'.join(lines) + ('\n' if lines else '')
    response.headers['Content-Type'] = 'application/jsonl; charset=utf-8'
    response.headers['X-Next-Cursor'] = str(rows[-1].id) if rows else ''
    response.headers['X-Integrity-OK'] = 'true' if integrity_ok else 'false'
    response.headers['Cache-Control'] = 'no-store'
    # Return as PlainTextResponse to avoid FastAPI auto JSON-encoding the string
    return PlainTextResponse(body, media_type='application/jsonl; charset=utf-8', headers=response.headers)

@router.get('/settlement/audit-export/stream')
def audit_export_true_stream(db: Session = Depends(get_db), after_id: int | None = None, batch_size: int = 2000, verify_integrity: bool = False, user: UserModel = Depends(get_current_user)):
    from app.config import settings as _settings
    if user.wallet_address.lower() not in _settings.admin_wallets:
        raise HTTPException(status_code=403, detail='Not authorized')
    batch_size = max(1, min(batch_size, 10000))
    import json
    def gen():
        prev_hash = None
        last_id = after_id
        while True:
            q = db.query(AuditEvent).order_by(AuditEvent.id.asc())
            if last_id:
                q = q.filter(AuditEvent.id > last_id)
            rows = q.limit(batch_size).all()
            if not rows:
                break
            for r in rows:
                if verify_integrity:
                    canonical = json.dumps({
                        'event_type': r.event_type,
                        'entity_type': r.entity_type,
                        'entity_id': r.entity_id,
                        'user_id': r.user_id,
                        'payload': r.payload
                    }, sort_keys=True, separators=(',',':'))
                    expected = sha256(((prev_hash or '') + canonical).encode()).hexdigest()
                    r.integrity_ok = (expected == r.integrity_hash)
                    prev_hash = r.integrity_hash
                yield json.dumps({
                    'id': r.id,
                    'event_type': r.event_type,
                    'entity_type': r.entity_type,
                    'entity_id': r.entity_id,
                    'user_id': r.user_id,
                    'payload': r.payload,
                    'created_at': r.created_at.isoformat(),
                    'integrity_hash': r.integrity_hash,
                    **({'integrity_ok': r.integrity_ok} if verify_integrity else {})
                }, sort_keys=True) + '\n'
            last_id = rows[-1].id
    return StreamingResponse(gen(), media_type='application/jsonl')

# --- Competition Settlement Flow ---

class DistributionItem(BaseModel):
    address: str
    amount: str  # store raw string (wei or token units) for provenance

class CompetitionSettlementSubmit(BaseModel):
    tx_hash: str
    distribution: List[DistributionItem] | None = None
    total_amount: str | None = None  # if omitted and distribution provided we derive sum

@router.post('/settlement/competitions/{competition_id}/submit')
async def submit_competition_settlement(competition_id: int, data: CompetitionSettlementSubmit, request: Request, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Optional Idempotency-Key header to prevent duplicate submissions (same competition + tx_hash)
    idem_key = request.headers.get('Idempotency-Key')
    if idem_key:
        existing = db.query(IdempotencyKey).filter(IdempotencyKey.key==idem_key).first()
        if existing:
            # Return latest prior submit audit event for this competition
            prev = db.query(AuditEvent).filter(
                AuditEvent.event_type=='COMPETITION_SETTLEMENT_SUBMIT',
                AuditEvent.entity_type=='COMPETITION',
                AuditEvent.entity_id==competition_id
            ).order_by(AuditEvent.id.desc()).first()
            if prev and isinstance(prev.payload, dict):
                return {
                    'audit_event_id': prev.id,
                    'total_amount': prev.payload.get('total_amount'),
                    'distribution_count': prev.payload.get('distribution_count'),
                    'idempotent': True
                }
    # Derive total if not supplied
    total = data.total_amount
    if not total and data.distribution:
        try:
            # naive decimal-safe sum as int of string values
            total_int = sum(int(d.amount) for d in data.distribution)
            total = str(total_int)
        except Exception:
            total = None
    payload = {
        'tx_hash': data.tx_hash,
        'total_amount': total,
        'distribution': [di.dict() for di in (data.distribution or [])],
        'distribution_count': len(data.distribution or [])
    }
    ae = record_audit_event(db, event_type='COMPETITION_SETTLEMENT_SUBMIT', entity_type='COMPETITION', entity_id=competition_id, user_id=user.id, payload=payload)
    if idem_key:
        db.add(IdempotencyKey(key=idem_key, route='/settlement/competitions/submit'))
    db.commit()
    return { 'audit_event_id': ae.id, 'total_amount': total, 'distribution_count': payload['distribution_count'], 'idempotent': False }

@router.post('/settlement/competitions/{competition_id}/verify')
async def verify_competition_settlement(competition_id: int, tx_hash: str | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Gather any prior submit/verify audit events
    submit_ev = db.query(AuditEvent).filter(
        AuditEvent.event_type=='COMPETITION_SETTLEMENT_SUBMIT',
        AuditEvent.entity_type=='COMPETITION',
        AuditEvent.entity_id==competition_id
    ).order_by(AuditEvent.id.desc()).first()
    verified_prev = db.query(AuditEvent).filter(
        AuditEvent.event_type=='COMPETITION_SETTLEMENT_VERIFIED',
        AuditEvent.entity_type=='COMPETITION',
        AuditEvent.entity_id==competition_id
    ).order_by(AuditEvent.id.desc()).first()
    if not tx_hash:
        if submit_ev and isinstance(submit_ev.payload, dict):
            tx_hash = submit_ev.payload.get('tx_hash')
        if not tx_hash and verified_prev and isinstance(verified_prev.payload, dict):
            tx_hash = verified_prev.payload.get('tx_hash')
    if not tx_hash:
        raise HTTPException(status_code=400, detail='tx_hash required')
    # Idempotency: if already verified (all epochs distributed) return early
    from app.models.database import CompetitionReward, CompetitionEpoch
    undistributed = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==competition_id, CompetitionEpoch.distributed == False).count()  # noqa: E712
    if undistributed == 0 and verified_prev:
        block_prev = None
        if isinstance(verified_prev.payload, dict):
            block_prev = verified_prev.payload.get('block')
        return { 'verified': True, 'already': True, 'block': block_prev }
    if not blockchain_service.ensure_initialized():  # type: ignore[attr-defined]
        raise HTTPException(status_code=503, detail='Blockchain RPC unavailable')
    receipt = await blockchain_service.get_transaction_receipt(tx_hash)
    if not receipt:
        return { 'verified': False, 'reason': 'receipt_not_found' }
    validation = validate_competition_settlement_receipt(receipt)
    if not validation.ok:
        return { 'verified': False, **validation }
    # Mark any remaining undistributed epochs & rewards
    ep_rows = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==competition_id, CompetitionEpoch.distributed == False).all()  # noqa: E712
    import datetime
    now = datetime.datetime.utcnow()
    modified_rewards = 0
    for ep in ep_rows:
        rws = db.query(CompetitionReward).filter(CompetitionReward.epoch_id==ep.id, CompetitionReward.distributed_at == None).all()  # noqa: E711
        for r in rws:
            r.distributed_at = now
            modified_rewards += 1
        ep.distributed = True
    # Compose verification payload with provenance (include original distribution if present)
    distribution = []
    total_amount = None
    if submit_ev and isinstance(submit_ev.payload, dict):
        distribution = submit_ev.payload.get('distribution') or []
        total_amount = submit_ev.payload.get('total_amount')
    ae = record_audit_event(db, event_type='COMPETITION_SETTLEMENT_VERIFIED', entity_type='COMPETITION', entity_id=competition_id, user_id=user.id, payload={
        'tx_hash': tx_hash,
        'block': validation.get('block'),
        'total_amount': total_amount,
        'distribution': distribution,
        'reward_rows_marked': modified_rewards
    })
    db.commit()
    return { 'verified': True, 'block': validation.get('block'), 'audit_event_id': ae.id, 'reward_rows_marked': modified_rewards }


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
