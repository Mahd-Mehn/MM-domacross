from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from app.services.valuation_service import valuation_service
from app.models.database import Listing, Offer, Domain, DomainValuationOverride, Valuation, DomainValuationDispute
from datetime import datetime, timezone, timedelta

router = APIRouter()

class ValuationBatchRequest(BaseModel):
    domains: List[str]

class ValuationBatchResponse(BaseModel):
    results: List[Dict[str, Any]]

@router.post("/valuation/batch", response_model=ValuationBatchResponse)
async def valuation_batch(payload: ValuationBatchRequest, db: Session = Depends(get_db)):
    # Build context maps
    listings_map: Dict[str, List[Decimal]] = {}
    offers_map: Dict[str, List[Decimal]] = {}
    floors: Dict[str, Decimal] = {}
    # gather listing/offer prices
    for l in db.query(Listing).filter(Listing.domain_name.in_([d.lower() for d in payload.domains]), Listing.active == True).all():  # noqa: E712
        listings_map.setdefault(l.domain_name, []).append(Decimal(str(l.price)))
    for o in db.query(Offer).filter(Offer.domain_name.in_([d.lower() for d in payload.domains]), Offer.active == True).all():  # noqa: E712
        offers_map.setdefault(o.domain_name, []).append(Decimal(str(o.price)))
    for dom in db.query(Domain).filter(Domain.name.in_([d.lower() for d in payload.domains])).all():
        if dom.last_floor_price is not None:
            floors[dom.name] = Decimal(str(dom.last_floor_price))
    # tld counts for scarcity
    tld_counts: Dict[str, int] = {}
    domain_rows = db.query(Domain.tld).all()
    for (tld,) in domain_rows:
        if tld:
            tld_counts[tld] = tld_counts.get(tld, 0) + 1
    context = {"listings": listings_map, "offers": offers_map, "floors": floors, "tld_counts": tld_counts}
    # Capture previous valuation map for delta emission
    prev_vals: Dict[str, Decimal] = {}
    from decimal import Decimal as _D
    for d in payload.domains:
        last = db.query(Valuation).filter(Valuation.domain_name==d.lower()).order_by(Valuation.created_at.desc()).first()
        if last:
            try:
                prev_vals[d.lower()] = _D(str(last.value))
            except Exception:
                pass

    results = valuation_service.value_domains(db, payload.domains, context)
    # Broadcast each valuation update enriched with delta info
    try:
        from app.broadcast import get_sync_broadcast
        bc = get_sync_broadcast()
        if bc:
            for r in results:
                domain_lower = r['domain']
                current_v = None
                try:
                    current_v = _D(str(r['value']))
                except Exception:
                    pass
                prev_v = prev_vals.get(domain_lower)
                change_pct = None
                if current_v is not None and prev_v is not None and prev_v != 0:
                    try:
                        change_pct = float(((current_v - prev_v) / prev_v) * 100)
                    except Exception:
                        change_pct = None
                payload_evt = {
                    'type': 'valuation_update',
                    'domain': domain_lower,
                    'value': str(r['value']),
                    'model_version': r['model_version'],
                    'ts': datetime.now(timezone.utc).isoformat()
                }
                if prev_v is not None:
                    payload_evt['previous_value'] = str(prev_v)
                if change_pct is not None:
                    payload_evt['change_pct'] = change_pct
                bc(payload_evt)
    except Exception:
        pass
    return {"results": results}

@router.get('/valuation/latest')
async def latest_valuations(domain: str, lookback_minutes: int = 1440, db: Session = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)
    rows = db.query(Valuation).filter(Valuation.domain_name==domain.lower(), Valuation.created_at >= cutoff).order_by(Valuation.created_at.desc()).limit(50).all()
    out = []
    for r in rows:
        age_sec = (datetime.now(timezone.utc) - r.created_at).total_seconds() if r.created_at else None
        stale = age_sec is not None and age_sec > 3600
        out.append({ 'value': str(r.value), 'created_at': r.created_at.isoformat() if r.created_at else None, 'model_version': r.model_version, 'factors': r.factors, 'stale': stale })
    return { 'domain': domain.lower(), 'valuations': out }

@router.get('/valuation/factors')
async def valuation_factors(domain: str, db: Session = Depends(get_db)):
    # Return latest valuation plus raw component breakdown (already stored in factors) + override if any
    val = db.query(Valuation).filter(Valuation.domain_name==domain.lower()).order_by(Valuation.created_at.desc()).first()
    override = db.query(DomainValuationOverride).filter(DomainValuationOverride.domain_name==domain.lower()).first()
    return {
        'domain': domain.lower(),
        'latest': {
            'value': str(val.value) if val else None,
            'model_version': val.model_version if val else None,
            'factors': val.factors if val else None,
        },
        'override': {
            'value': str(override.override_value),
            'reason': override.reason,
            'expires_at': override.expires_at.isoformat() if override and override.expires_at else None
        } if override else None
    }

class ValuationOverrideRequest(BaseModel):
    domain: str
    value: str
    reason: str | None = None
    ttl_minutes: int | None = None

class ValuationDisputeRequest(BaseModel):
    domain: str
    reason: str | None = None

class ValuationDisputeVoteRequest(BaseModel):
    dispute_id: int
    vote: bool = True  # only positive votes count for simplicity

from app.config import settings as app_settings
from app.deps.auth import get_current_user
from app.services.audit_service import record_audit_event
from app.broadcast import get_sync_broadcast

@router.post('/valuation/override')
async def create_override(payload: ValuationOverrideRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if (user.wallet_address or '').lower() not in set(app_settings.admin_wallets):
        raise HTTPException(status_code=403, detail='Not authorized')
    dom = db.query(Domain).filter(Domain.name==payload.domain.lower()).first()
    if not dom:
        dom = Domain(name=payload.domain.lower())
        db.add(dom); db.flush()
    existing = db.query(DomainValuationOverride).filter(DomainValuationOverride.domain_name==payload.domain.lower()).first()
    from decimal import Decimal
    from datetime import timedelta
    expires_at = None
    if payload.ttl_minutes:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=payload.ttl_minutes)
    if existing:
        existing.override_value = Decimal(payload.value)
        existing.reason = payload.reason
        existing.expires_at = expires_at
        db.add(existing)
    else:
        override = DomainValuationOverride(domain_name=payload.domain.lower(), override_value=Decimal(payload.value), reason=payload.reason, expires_at=expires_at, created_by_user_id=user.id)
        db.add(override)
    db.commit()
    return { 'status': 'ok' }

@router.post('/valuation/dispute')
async def create_dispute(payload: ValuationDisputeRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    dom = db.query(Domain).filter(Domain.name==payload.domain.lower()).first()
    if not dom:
        raise HTTPException(status_code=404, detail='Domain not found')
    existing_open = db.query(DomainValuationDispute).filter(DomainValuationDispute.domain_name==payload.domain.lower(), DomainValuationDispute.status=='OPEN').first()
    if existing_open:
        return {'status': 'exists', 'dispute_id': existing_open.id}
    # Snapshot current threshold for transparency
    threshold_snapshot = app_settings.valuation_dispute_vote_threshold
    dispute = DomainValuationDispute(domain_name=payload.domain.lower(), reason=payload.reason, created_by_user_id=getattr(user, 'id', None), threshold=threshold_snapshot)
    db.add(dispute); db.commit(); db.refresh(dispute)
    # Audit event
    record_audit_event(db, event_type='VALUATION_DISPUTE_OPENED', entity_type='VALUATION_DISPUTE', entity_id=dispute.id, user_id=getattr(user,'id',None), payload={'domain': payload.domain.lower(), 'reason': payload.reason, 'threshold': threshold_snapshot})
    return {'status': 'ok', 'dispute_id': dispute.id}

@router.post('/valuation/dispute/vote')
async def vote_dispute(payload: ValuationDisputeVoteRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    dispute = db.query(DomainValuationDispute).filter(DomainValuationDispute.id==payload.dispute_id).first()
    if not dispute or dispute.status != 'OPEN':
        raise HTTPException(status_code=404, detail='Dispute not open')
    if payload.vote:
        before = dispute.votes or 0
        dispute.votes = before + 1
        reached = dispute.votes >= (dispute.threshold or app_settings.valuation_dispute_vote_threshold)
        # Audit each vote
        record_audit_event(db, event_type='VALUATION_DISPUTE_VOTE', entity_type='VALUATION_DISPUTE', entity_id=dispute.id, user_id=getattr(user,'id',None), payload={'votes': dispute.votes, 'domain': dispute.domain_name, 'reached': reached})
        if reached:
            # Emit quorum reached audit (admin still must resolve explicitly; clamp active via valuation_service)
            record_audit_event(db, event_type='VALUATION_DISPUTE_QUORUM', entity_type='VALUATION_DISPUTE', entity_id=dispute.id, user_id=getattr(user,'id',None), payload={'domain': dispute.domain_name, 'votes': dispute.votes, 'threshold': dispute.threshold or app_settings.valuation_dispute_vote_threshold})
            broadcast = get_sync_broadcast()
            if broadcast:
                broadcast({'type': 'dispute_quorum', 'domain': dispute.domain_name, 'dispute_id': dispute.id, 'votes': dispute.votes, 'threshold': dispute.threshold or app_settings.valuation_dispute_vote_threshold, 'ts': datetime.now(timezone.utc).isoformat()})
    db.add(dispute); db.commit(); db.refresh(dispute)
    return {'status': 'ok', 'votes': dispute.votes}

@router.post('/valuation/dispute/resolve')
async def resolve_dispute(dispute_id: int, accept: bool = True, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # admin only
    if (user.wallet_address or '').lower() not in set(app_settings.admin_wallets):
        raise HTTPException(status_code=403, detail='Not authorized')
    dispute = db.query(DomainValuationDispute).filter(DomainValuationDispute.id==dispute_id).first()
    if not dispute or dispute.status != 'OPEN':
        raise HTTPException(status_code=404, detail='Dispute not open')
    dispute.status = 'RESOLVED' if accept else 'REJECTED'
    dispute.resolved_at = datetime.now(timezone.utc)
    db.add(dispute); db.commit()
    record_audit_event(db, event_type='VALUATION_DISPUTE_RESOLVED', entity_type='VALUATION_DISPUTE', entity_id=dispute.id, user_id=getattr(user,'id',None), payload={'domain': dispute.domain_name, 'final_status': dispute.status})
    broadcast = get_sync_broadcast()
    if broadcast:
        broadcast({'type': 'dispute_resolved', 'domain': dispute.domain_name, 'dispute_id': dispute.id, 'final_status': dispute.status, 'ts': datetime.now(timezone.utc).isoformat()})
    return {'status': 'ok', 'final_status': dispute.status}
