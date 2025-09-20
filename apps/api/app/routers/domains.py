from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models.database import Domain, Listing, Offer, Valuation, Trade
from sqlalchemy import func, desc, and_

router = APIRouter()

# Pydantic models for time-boxed offers
class TimedOfferCreate(BaseModel):
    offerer: str
    amount: str
    expiresAt: int  # Unix timestamp
    message: Optional[str] = None

class TimedOfferResponse(BaseModel):
    id: str
    offerer: str
    amount: str
    expiresAt: int
    message: Optional[str]
    status: str  # active, expired, accepted, rejected
    created_at: datetime

@router.get("/list")
async def list_domains(
    limit: int = Query(100, description="Maximum number of domains to return"),
    offset: int = Query(0, description="Offset for pagination"),
    sort_by: str = Query("views", description="Sort by: views, price, offers, recent"),
    db: Session = Depends(get_db)
):
    """List all domains for SEO sitemap and marketplace"""
    # For demo, directly return mock data to avoid database issues
    domain_list = [
        {
            "name": "crypto",
            "tld": "eth",
            "price": "5000000000000000000",  # 5 ETH
            "offers_count": 3,
            "listings_count": 1,
            "last_activity": datetime.utcnow().isoformat(),
        },
        {
            "name": "defi",
            "tld": "eth",
            "price": "3000000000000000000",  # 3 ETH
            "offers_count": 2,
            "listings_count": 1,
            "last_activity": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
        },
        {
            "name": "web3",
            "tld": "eth",
            "price": "10000000000000000000",  # 10 ETH
            "offers_count": 5,
            "listings_count": 1,
            "last_activity": (datetime.utcnow() - timedelta(hours=5)).isoformat(),
        },
        {
            "name": "nft",
            "tld": "eth",
            "price": "7500000000000000000",  # 7.5 ETH
            "offers_count": 4,
            "listings_count": 1,
            "last_activity": (datetime.utcnow() - timedelta(days=1)).isoformat(),
        },
        {
            "name": "dao",
            "tld": "eth",
            "price": "4000000000000000000",  # 4 ETH
            "offers_count": 1,
            "listings_count": 1,
            "last_activity": (datetime.utcnow() - timedelta(days=2)).isoformat(),
        },
        {
            "name": "metaverse",
            "tld": "eth",
            "price": "2500000000000000000",  # 2.5 ETH
            "offers_count": 2,
            "listings_count": 1,
            "last_activity": (datetime.utcnow() - timedelta(hours=12)).isoformat(),
        },
        {
            "name": "gaming",
            "tld": "eth",
            "price": "1500000000000000000",  # 1.5 ETH
            "offers_count": 0,
            "listings_count": 1,
            "last_activity": (datetime.utcnow() - timedelta(days=3)).isoformat(),
        },
        {
            "name": "protocol",
            "tld": "eth",
            "price": None,  # Make offer only
            "offers_count": 6,
            "listings_count": 0,
            "last_activity": (datetime.utcnow() - timedelta(minutes=30)).isoformat(),
        },
        {
            "name": "exchange",
            "tld": "eth",
            "price": "8000000000000000000",  # 8 ETH
            "offers_count": 3,
            "listings_count": 1,
            "last_activity": (datetime.utcnow() - timedelta(hours=4)).isoformat(),
        },
        {
            "name": "wallet",
            "tld": "eth",
            "price": "6000000000000000000",  # 6 ETH
            "offers_count": 2,
            "listings_count": 1,
            "last_activity": (datetime.utcnow() - timedelta(hours=8)).isoformat(),
        },
    ]
    
    # Apply sorting
    if sort_by == "price":
        domain_list = sorted(domain_list, key=lambda x: float(x["price"]) if x["price"] else 0, reverse=True)
    elif sort_by == "offers":
        domain_list = sorted(domain_list, key=lambda x: x["offers_count"], reverse=True)
    elif sort_by == "recent":
        domain_list = sorted(domain_list, key=lambda x: x["last_activity"], reverse=True)
    
    # Apply pagination
    start = offset
    end = offset + limit
    paginated_list = domain_list[start:end]
    
    return {
        "domains": [d["name"] for d in paginated_list],  # Simple list for sitemap
        "detailed": paginated_list,  # Detailed info for marketplace
        "total": len(domain_list),
        "limit": limit,
        "offset": offset,
    }

@router.get("/{name}")
async def get_domain(name: str, db: Session = Depends(get_db)):
    name_l = name.lower()
    domain = db.query(Domain).filter(Domain.name == name_l).first()
    
    # If domain not in database, check if it's one of our mock domains
    if not domain:
        mock_domains = {
            "crypto": {"price": "5000000000000000000", "owner": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"},
            "defi": {"price": "3000000000000000000", "owner": "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed"},
            "web3": {"price": "10000000000000000000", "owner": "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"},
            "nft": {"price": "7500000000000000000", "owner": "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB"},
            "dao": {"price": "4000000000000000000", "owner": "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"},
            "metaverse": {"price": "2500000000000000000", "owner": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"},
            "gaming": {"price": "1500000000000000000", "owner": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"},
            "protocol": {"price": None, "owner": "0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c"},
        }
        
        if name_l in mock_domains:
            # Return mock data
            mock_data = mock_domains[name_l]
            return {
                "domain": {
                    "name": name_l,
                    "tld": "eth",
                    "owner": mock_data["owner"],
                    "last_seen_event_at": datetime.utcnow(),
                    "last_floor_price": mock_data["price"],
                    "last_estimated_value": mock_data["price"],
                    "price": mock_data["price"] or "0",
                    "tokenId": f"{hash(name_l) % 1000000}",
                    "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
                    "lastSale": None,
                    "views": len(name_l) * 100,  # Mock views
                    "description": f"{name_l} is a premium domain available for trading on the Doma protocol.",
                    "trades_count": 0,
                },
                "listings": [],
                "offers": [],
                "valuation": None,
            }
        else:
            raise HTTPException(status_code=404, detail="Domain not found")
    listings = db.query(Listing).filter(Listing.domain_name == name_l, Listing.active == True).order_by(Listing.price.asc()).limit(10).all()  # noqa: E712
    offers = db.query(Offer).filter(Offer.domain_name == name_l, Offer.active == True).order_by(Offer.price.desc()).limit(10).all()  # noqa: E712
    valuation = db.query(Valuation).filter(Valuation.domain_name == name_l).order_by(Valuation.created_at.desc()).first()
    
    # Get additional metrics for SEO and conversion tracking
    trades_count = db.query(func.count(Trade.id)).filter(Trade.domain_name == name_l).scalar()
    last_sale = db.query(Trade).filter(Trade.domain_name == name_l).order_by(Trade.created_at.desc()).first()
    
    # Calculate views (placeholder - would track in real implementation)
    views = trades_count * 10  # Simple placeholder calculation
    
    return {
        "domain": {
            "name": domain.name,
            "tld": domain.tld,
            "owner": domain.owner_wallet if hasattr(domain, 'owner_wallet') else None,
            "last_seen_event_at": domain.last_seen_event_at,
            "last_floor_price": str(domain.last_floor_price) if domain.last_floor_price is not None else None,
            "last_estimated_value": str(domain.last_estimated_value) if domain.last_estimated_value is not None else None,
            "price": str(listings[0].price) if listings else str(domain.last_floor_price) if domain.last_floor_price else "0",
            "tokenId": domain.token_id if hasattr(domain, 'token_id') else None,
            "contract": domain.contract_address if hasattr(domain, 'contract_address') else None,
            "lastSale": str(last_sale.price) if last_sale else None,
            "views": views,
            "description": f"{domain.name} is a premium domain available for trading on the Doma protocol.",
            "trades_count": trades_count,
        },
        "listings": [
            {
                "id": l.id,
                "price": str(l.price),
                "seller": l.seller_wallet,
                "created_at": l.created_at,
                "tx_hash": l.tx_hash,
                "external_order_id": l.external_order_id,
            }
            for l in listings
        ],
        "offers": [
            {"id": o.id, "price": str(o.price), "buyer": o.buyer_wallet, "created_at": o.created_at, "tx_hash": o.tx_hash}
            for o in offers
        ],
        "valuation": {"value": str(valuation.value), "model_version": valuation.model_version, "created_at": valuation.created_at} if valuation else None,
    }

@router.get("/domains/{name}/offers")
async def get_domain_offers(
    name: str, 
    status: Optional[str] = Query(None, description="Filter by status: active, expired, accepted, rejected"),
    db: Session = Depends(get_db)
):
    """Get time-boxed offers for a domain with expiry tracking"""
    name_l = name.lower()
    
    # Get offers from database
    query = db.query(Offer).filter(Offer.domain_name == name_l)
    
    # Filter by status if provided
    if status == "active":
        query = query.filter(Offer.active == True)
    
    offers = query.order_by(Offer.created_at.desc()).limit(50).all()
    
    # Transform to time-boxed offer format
    current_time = datetime.utcnow()
    timed_offers = []
    
    for offer in offers:
        # Calculate expiry (default 24 hours from creation if not specified)
        expires_at = offer.expires_at if hasattr(offer, 'expires_at') else (offer.created_at + timedelta(hours=24))
        expires_timestamp = int(expires_at.timestamp() * 1000)
        
        # Determine status
        if not offer.active:
            offer_status = "cancelled"
        elif hasattr(offer, 'accepted') and offer.accepted:
            offer_status = "accepted"
        elif current_time > expires_at:
            offer_status = "expired"
        else:
            offer_status = "active"
        
        timed_offers.append({
            "id": str(offer.id),
            "offerer": offer.buyer_wallet,
            "amount": str(offer.price),
            "expiresAt": expires_timestamp,
            "message": offer.message if hasattr(offer, 'message') else None,
            "status": offer_status,
            "created_at": offer.created_at,
        })
    
    return timed_offers

@router.post("/domains/{name}/offers")
async def create_timed_offer(
    name: str,
    offer: TimedOfferCreate,
    db: Session = Depends(get_db)
):
    """Create a time-boxed offer for a domain"""
    name_l = name.lower()
    
    # Check if domain exists
    domain = db.query(Domain).filter(Domain.name == name_l).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    
    # Create new offer with expiry
    expires_at = datetime.fromtimestamp(offer.expiresAt / 1000)  # Convert from JS timestamp
    
    new_offer = Offer(
        domain_name=name_l,
        buyer_wallet=offer.offerer.lower(),
        price=int(offer.amount),
        active=True,
        created_at=datetime.utcnow(),
        expires_at=expires_at,
        message=offer.message,
    )
    
    db.add(new_offer)
    db.commit()
    db.refresh(new_offer)
    
    return {
        "id": str(new_offer.id),
        "offerer": new_offer.buyer_wallet,
        "amount": str(new_offer.price),
        "expiresAt": offer.expiresAt,
        "message": new_offer.message,
        "status": "active",
        "created_at": new_offer.created_at,
    }

@router.get("/domains/{name}/metrics")
async def get_domain_metrics(name: str, db: Session = Depends(get_db)):
    """Get conversion metrics for a domain deal page"""
    name_l = name.lower()
    
    # Calculate metrics for the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # Page views (placeholder - would use analytics in production)
    page_views = db.query(func.count(Trade.id)).filter(
        Trade.domain_name == name_l,
        Trade.created_at >= thirty_days_ago
    ).scalar() * 25  # Multiplier for estimated views
    
    # Offers made
    offers_count = db.query(func.count(Offer.id)).filter(
        Offer.domain_name == name_l,
        Offer.created_at >= thirty_days_ago
    ).scalar()
    
    # Deals closed (accepted offers or completed trades)
    deals_closed = db.query(func.count(Trade.id)).filter(
        Trade.domain_name == name_l,
        Trade.created_at >= thirty_days_ago
    ).scalar()
    
    # Calculate conversion rates
    page_to_offer_rate = (offers_count / page_views * 100) if page_views > 0 else 0
    offer_to_deal_rate = (deals_closed / offers_count * 100) if offers_count > 0 else 0
    
    return {
        "metrics": {
            "page_views": page_views,
            "offers_made": offers_count,
            "deals_closed": deals_closed,
            "page_to_offer_rate": round(page_to_offer_rate, 2),
            "offer_to_deal_rate": round(offer_to_deal_rate, 2),
            "period": "last_30_days",
        }
    }
