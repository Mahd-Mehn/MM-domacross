from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import time, uuid
from app.broadcast import broadcast_event

router = APIRouter(tags=["orderfeed"], prefix="/api/v1")

class Listing(BaseModel):
    id: str
    competition_id: Optional[str] = None
    domain: str
    price: float
    seller: str
    contract: str | None = None
    token_id: str | None = None
    created_at: float
    active: bool = True
    created_seq: Optional[int] = None

_LISTINGS: dict[str, Listing] = {}

# --- Offers (simple in-memory for demo parity) ---
class Offer(BaseModel):
    id: str
    competition_id: Optional[str] = None
    domain: str
    price: float
    offerer: str
    contract: str | None = None
    token_id: str | None = None
    created_at: float
    active: bool = True
    created_seq: Optional[int] = None

_OFFERS: dict[str, Offer] = {}

class CreateListingRequest(BaseModel):
    competition_id: Optional[str] = None
    domain: str
    price: float
    seller: str
    contract: str | None = None
    token_id: str | None = None

class CreateOfferRequest(BaseModel):
    competition_id: Optional[str] = None
    domain: str
    price: float
    offerer: str
    contract: str | None = None
    token_id: str | None = None

@router.get("/listings", response_model=List[Listing])
def list_listings(competition_id: str | None = None, since_seq: int | None = None):
    vals = [l for l in _LISTINGS.values() if l.active]
    if competition_id:
        vals = [l for l in vals if l.competition_id == competition_id]
    if since_seq is not None:
        vals = [l for l in vals if (l.created_seq or 0) > since_seq]
    return vals

@router.get("/offers", response_model=List[Offer])
def list_offers(competition_id: str | None = None, since_seq: int | None = None):
    vals = [o for o in _OFFERS.values() if o.active]
    if competition_id:
        vals = [o for o in vals if o.competition_id == competition_id]
    if since_seq is not None:
        vals = [o for o in vals if (o.created_seq or 0) > since_seq]
    return vals

@router.post("/listings", response_model=Listing)
async def create_listing(req: CreateListingRequest):
    lid = str(uuid.uuid4())
    listing = Listing(id=lid, created_at=time.time(), **req.dict())
    _LISTINGS[lid] = listing
    await broadcast_event({
        'type': 'listing_created',
        'id': lid,
        'domain': listing.domain,
        'price': listing.price,
        'seller': listing.seller,
        'competition_id': listing.competition_id,
        'contract': listing.contract,
        'token_id': listing.token_id,
    })
    try:
        # import here to avoid circular import issues
        from app import broadcast as _bc
        listing.created_seq = getattr(_bc, '_event_seq', None)
    except Exception:
        pass
    return listing

@router.post("/offers", response_model=Offer)
async def create_offer(req: CreateOfferRequest):
    oid = str(uuid.uuid4())
    offer = Offer(id=oid, created_at=time.time(), **req.dict())
    _OFFERS[oid] = offer
    await broadcast_event({
        'type': 'offer_created',
        'id': oid,
        'domain': offer.domain,
        'price': offer.price,
        'offerer': offer.offerer,
        'competition_id': offer.competition_id,
        'contract': offer.contract,
        'token_id': offer.token_id,
    })
    try:
        from app import broadcast as _bc
        offer.created_seq = getattr(_bc, '_event_seq', None)
    except Exception:
        pass
    return offer

class FillRequest(BaseModel):
    buyer: str

@router.post("/listings/{listing_id}/fill")
async def fill_listing(listing_id: str, req: FillRequest):
    listing = _LISTINGS.get(listing_id)
    if not listing or not listing.active:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.active = False
    await broadcast_event({
        'type': 'listing_filled',
        'id': listing_id,
        'domain': listing.domain,
        'price': listing.price,
        'seller': listing.seller,
        'buyer': req.buyer,
        'competition_id': listing.competition_id,
        'contract': listing.contract,
        'token_id': listing.token_id,
    })
    return { 'status': 'filled' }

class AcceptOfferRequest(BaseModel):
    seller: str

@router.post("/offers/{offer_id}/accept")
async def accept_offer(offer_id: str, req: AcceptOfferRequest):
    offer = _OFFERS.get(offer_id)
    if not offer or not offer.active:
        raise HTTPException(status_code=404, detail="Offer not found")
    offer.active = False
    await broadcast_event({
        'type': 'offer_accepted',
        'id': offer_id,
        'domain': offer.domain,
        'price': offer.price,
        'offerer': offer.offerer,
        'seller': req.seller,
        'competition_id': offer.competition_id,
        'contract': offer.contract,
        'token_id': offer.token_id,
    })
    return { 'status': 'accepted' }

@router.post("/listings/{listing_id}/cancel")
async def cancel_listing(listing_id: str):
    listing = _LISTINGS.get(listing_id)
    if not listing or not listing.active:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.active = False
    await broadcast_event({
        'type': 'listing_cancelled',
        'id': listing_id,
        'domain': listing.domain,
        'price': listing.price,
        'seller': listing.seller,
        'competition_id': listing.competition_id,
        'contract': listing.contract,
        'token_id': listing.token_id,
    })
    return { 'status': 'cancelled' }

@router.post("/offers/{offer_id}/cancel")
async def cancel_offer(offer_id: str):
    offer = _OFFERS.get(offer_id)
    if not offer or not offer.active:
        raise HTTPException(status_code=404, detail="Offer not found")
    offer.active = False
    await broadcast_event({
        'type': 'offer_cancelled',
        'id': offer_id,
        'domain': offer.domain,
        'price': offer.price,
        'offerer': offer.offerer,
        'competition_id': offer.competition_id,
        'contract': offer.contract,
        'token_id': offer.token_id,
    })
    return { 'status': 'cancelled' }

@router.post("/listings/demo/seed")
async def seed_demo(competition_id: str | None = None):
    sample = [
        ("example.com", 500.0),
        ("test.net", 300.0),
        ("demo.org", 200.0),
        ("alpha.xyz", 420.0),
    ]
    created = []
    for d, p in sample:
        lid = str(uuid.uuid4())
        listing = Listing(id=lid, competition_id=competition_id, domain=d, price=p, seller="0xSEED", contract=None, token_id=None, created_at=time.time())
        _LISTINGS[lid] = listing
        created.append(lid)
        await broadcast_event({'type': 'listing_created', 'id': lid, 'domain': d, 'price': p, 'seller': listing.seller, 'competition_id': competition_id})
    return {'created': created}
