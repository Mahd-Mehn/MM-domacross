from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.database import Domain, Listing, Offer, Valuation

router = APIRouter()

@router.get("/domains/{name}")
async def get_domain(name: str, db: Session = Depends(get_db)):
    name_l = name.lower()
    domain = db.query(Domain).filter(Domain.name == name_l).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    listings = db.query(Listing).filter(Listing.domain_name == name_l, Listing.active == True).order_by(Listing.price.asc()).limit(10).all()  # noqa: E712
    offers = db.query(Offer).filter(Offer.domain_name == name_l, Offer.active == True).order_by(Offer.price.desc()).limit(10).all()  # noqa: E712
    valuation = db.query(Valuation).filter(Valuation.domain_name == name_l).order_by(Valuation.created_at.desc()).first()
    return {
        "domain": {
            "name": domain.name,
            "tld": domain.tld,
            "last_seen_event_at": domain.last_seen_event_at,
            "last_floor_price": str(domain.last_floor_price) if domain.last_floor_price is not None else None,
            "last_estimated_value": str(domain.last_estimated_value) if domain.last_estimated_value is not None else None,
        },
        "listings": [
            {"id": l.id, "price": str(l.price), "seller": l.seller_wallet, "created_at": l.created_at, "tx_hash": l.tx_hash}
            for l in listings
        ],
        "offers": [
            {"id": o.id, "price": str(o.price), "buyer": o.buyer_wallet, "created_at": o.created_at, "tx_hash": o.tx_hash}
            for o in offers
        ],
        "valuation": {"value": str(valuation.value), "model_version": valuation.model_version, "created_at": valuation.created_at} if valuation else None,
    }
