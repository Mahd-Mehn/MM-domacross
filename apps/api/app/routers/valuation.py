from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from app.services.valuation_service import valuation_service
from app.models.database import Listing, Offer, Domain

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
    results = valuation_service.value_domains(db, payload.domains, context)
    return {"results": results}
