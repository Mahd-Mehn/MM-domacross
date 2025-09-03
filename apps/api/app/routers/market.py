from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from typing import Optional
from app.database import get_db
from app.models.database import Listing, Offer, Domain, Trade, Participant, Competition
from app.deps.auth import get_current_user
from app.models.database import User as UserModel
from datetime import datetime, timezone, timedelta

router = APIRouter()

def _get_or_create_domain(db: Session, name: str) -> Domain:
    name_l = name.lower()
    dom = db.query(Domain).filter(Domain.name == name_l).first()
    if not dom:
        tld = name_l.split('.')[-1] if '.' in name_l else None
        dom = Domain(name=name_l, tld=tld, last_seen_event_at=datetime.now(timezone.utc))
        db.add(dom)
        db.flush()
    return dom

@router.post('/market/listing')
def create_listing(
    domain: str,
    contract: str,
    token_id: str,
    price: str,
    external_order_id: str | None = None,
    tx_hash: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    # Persist off-chain listing snapshot (SDK handles on-chain / remote orderbook)
    _get_or_create_domain(db, domain)
    try:
        price_dec = Decimal(price)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid price')
    from app.config import settings
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.listing_ttl_days)
    listing = Listing(domain_name=domain.lower(), seller_wallet=user.wallet_address.lower(), price=price_dec, tx_hash=tx_hash, external_order_id=external_order_id, expires_at=expires_at)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return { 'id': listing.id, 'domain': domain.lower(), 'price': str(listing.price) }

@router.post('/market/buy')
def record_buy(
    order_id: Optional[str] = None,
    domain: Optional[str] = None,
    price: Optional[str] = None,
    tx_hash: Optional[str] = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    # Simple persistence: mark any listing inactive if domain provided & seller differs.
    if domain:
        name_l = domain.lower()
        _get_or_create_domain(db, name_l)
        # Deactivate lowest priced active listing as matched fill heuristic
        lst = db.query(Listing).filter(Listing.domain_name == name_l, Listing.active == True).order_by(Listing.price.asc()).first()  # noqa: E712
        if lst:
            lst.active = False
            # Record a trade entry for participants referencing this domain (simplistic: any participant of any competition by seller/buyer wallet)
            try:
                from decimal import Decimal as D
                trade_price = D(price) if price else lst.price
            except Exception:
                trade_price = lst.price
            now_ts = datetime.now(timezone.utc)
            participants = (
                db.query(Participant)
                .join(UserModel, Participant.user_id == UserModel.id)
                .join(Competition, Competition.id == Participant.competition_id)
                .filter(
                    UserModel.wallet_address.in_([user.wallet_address.lower(), lst.seller_wallet]),
                    Competition.start_time <= now_ts,
                    Competition.end_time >= now_ts,
                )
                .all()
            )
            for part in participants:
                trade_type = 'BUY' if part.user_id == user.id else 'SELL'
                tr = Trade(participant_id=part.id, domain_token_address=contract_placeholder(lst.domain_name), domain_token_id=lst.domain_name, trade_type=trade_type, price=trade_price, tx_hash=tx_hash or order_id or "local")
                db.add(tr)
    db.commit()
    return { 'status': 'ok', 'order_id': order_id }

@router.post('/market/offer')
def create_offer(
    domain: str,
    contract: str,
    token_id: str,
    price: str,
    external_order_id: str | None = None,
    tx_hash: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    _get_or_create_domain(db, domain)
    try:
        price_dec = Decimal(price)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid price')
    offer = Offer(domain_name=domain.lower(), buyer_wallet=user.wallet_address.lower(), price=price_dec, tx_hash=tx_hash, external_order_id=external_order_id)
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return { 'id': offer.id, 'domain': domain.lower(), 'price': str(offer.price) }

@router.post('/market/cancel-listing')
def cancel_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    lst = db.query(Listing).filter(Listing.id == listing_id, Listing.seller_wallet == user.wallet_address.lower()).first()
    if not lst:
        raise HTTPException(status_code=404, detail='Listing not found')
    lst.active = False
    db.commit()
    return { 'status': 'cancelled', 'listing_id': listing_id }

@router.post('/market/cancel-offer')
def cancel_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    off = db.query(Offer).filter(Offer.id == offer_id, Offer.buyer_wallet == user.wallet_address.lower()).first()
    if not off:
        raise HTTPException(status_code=404, detail='Offer not found')
    off.active = False
    db.commit()
    return { 'status': 'cancelled', 'offer_id': offer_id }

@router.post('/market/accept-offer')
def accept_offer(
    offer_id: int | None = None,
    external_order_id: str | None = None,
    domain: str | None = None,
    price: str | None = None,
    tx_hash: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    # Locate offer by internal id or external_order_id
    q = db.query(Offer).filter(Offer.active == True)  # noqa: E712
    if offer_id is not None:
        q = q.filter(Offer.id == offer_id)
    elif external_order_id is not None:
        q = q.filter(Offer.external_order_id == external_order_id)
    else:
        raise HTTPException(status_code=400, detail='offer_id or external_order_id required')
    off = q.first()
    if not off:
        raise HTTPException(status_code=404, detail='Offer not found or inactive')
    # Ensure domain alignment if provided
    if domain and off.domain_name != domain.lower():
        raise HTTPException(status_code=400, detail='Domain mismatch')
    # Seller is current user; buyer is offer.buyer_wallet
    # Deactivate offer
    off.active = False
    # Record trades for participants (BUY for offer buyer, SELL for current user)
    from decimal import Decimal as D
    try:
        trade_price = D(price) if price else off.price
    except Exception:
        trade_price = off.price
    # Gather participants related to either wallet
    now_ts = datetime.now(timezone.utc)
    participants = (
        db.query(Participant)
        .join(UserModel, Participant.user_id == UserModel.id)
        .join(Competition, Competition.id == Participant.competition_id)
        .filter(
            UserModel.wallet_address.in_([user.wallet_address.lower(), off.buyer_wallet]),
            Competition.start_time <= now_ts,
            Competition.end_time >= now_ts,
        )
        .all()
    )
    for part in participants:
        trade_type = 'SELL' if part.user_id == user.id else 'BUY'
        tr = Trade(
            participant_id=part.id,
            domain_token_address=contract_placeholder(off.domain_name),
            domain_token_id=off.domain_name,
            trade_type=trade_type,
            price=trade_price,
            tx_hash=tx_hash or external_order_id or f"offer-{off.id}"
        )
        db.add(tr)
    db.commit()
    return { 'status': 'accepted', 'offer_id': off.id }

@router.delete('/market/expired/listings')
def cleanup_expired_listings(
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    # Allow only admins for cleanup
    from app.config import settings
    if user.wallet_address.lower() not in settings.admin_wallets:
        raise HTTPException(status_code=403, detail='Not authorized')
    now = datetime.now(timezone.utc)
    q = db.query(Listing).filter(Listing.active == True, Listing.expires_at != None, Listing.expires_at < now)  # noqa: E712
    count = 0
    for lst in q.all():
        lst.active = False
        count += 1
    db.commit()
    return { 'deactivated': count }

# Helper placeholder for domain token address until mapping is introduced
def contract_placeholder(domain_name: str) -> str:
    # Could map TLD or domain to a known contract; for now return zero address
    return '0x' + '0'*40
