from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from app.deps.auth import get_current_user
from app.models.database import DomainBasketRecord, Domain, User as UserModel
from app.services.basket_service import basket_valuation_service
from datetime import datetime, timezone

router = APIRouter(prefix="/baskets", tags=["baskets"])

@router.get("/health")
def baskets_health():
    return {"ok": True}

class BasketCreateRequest(BaseModel):
    domains: List[str]
    weights_bps: List[int]
    token_uri: str | None = None

@router.post("/create")
def create_basket(req: BasketCreateRequest, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    if len(req.domains) != len(req.weights_bps):
        raise HTTPException(status_code=400, detail="length mismatch")
    if sum(req.weights_bps) != 10000:
        raise HTTPException(status_code=400, detail="weights must sum to 10000 bps")
    # Ensure domains exist (auto-create placeholder rows)
    norm_domains: list[str] = []
    for d in req.domains:
        name_l = d.lower()
        norm_domains.append(name_l)
        dom = db.query(Domain).filter(Domain.name==name_l).first()
        if not dom:
            tld = name_l.split('.')[-1] if '.' in name_l else None
            dom = Domain(name=name_l, tld=tld)
            db.add(dom); db.flush()
    record = DomainBasketRecord(
        creator_user_id=user.id,
        domain_names=norm_domains,
        weights_bps=req.weights_bps,
        token_uri=req.token_uri,
    )
    db.add(record)
    db.flush()
    # Compute initial value (sum weighted last_estimated_value)
    total = Decimal(0)
    for i, dn in enumerate(norm_domains):
        dom = db.query(Domain).filter(Domain.name==dn).first()
        if dom and dom.last_estimated_value is not None:
            total += Decimal(dom.last_estimated_value) * Decimal(req.weights_bps[i]) / Decimal(10000)
    record.total_value = total.quantize(Decimal('0.01')) if total else None
    db.commit(); db.refresh(record)
    return {
        'id': record.id,
        'domains': record.domain_names,
        'weights_bps': record.weights_bps,
        'total_value': str(record.total_value) if record.total_value is not None else None,
        'token_uri': record.token_uri
    }

@router.post("/{basket_id}/redeem")
def redeem_basket(basket_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    rec = db.query(DomainBasketRecord).filter(DomainBasketRecord.id==basket_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    if rec.creator_user_id != user.id:
        raise HTTPException(status_code=403, detail="not owner")
    if rec.redeemed:
        raise HTTPException(status_code=400, detail="already redeemed")
    rec.redeemed = True
    rec.redeemed_at = datetime.now(timezone.utc)
    db.commit()
    return {'status': 'redeemed', 'id': rec.id}

@router.get("/list")
def list_baskets(db: Session = Depends(get_db)):
    rows = db.query(DomainBasketRecord).order_by(DomainBasketRecord.created_at.desc()).limit(100).all()
    out = []
    for r in rows:
        out.append({
            'id': r.id,
            'domains': r.domain_names,
            'weights_bps': r.weights_bps,
            'total_value': str(r.total_value) if r.total_value is not None else None,
            'redeemed': r.redeemed
        })
    return out
