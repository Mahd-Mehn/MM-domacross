"""
Doma Fractional Tokens API
Endpoints for interacting with Doma Protocol's fractionalized domain tokens
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.models.database import FractionalToken, Domain, DomainValuation
from app.services.doma_subgraph_service import doma_subgraph_service
from app.services.doma_rank_oracle_service import doma_rank_oracle_service
from pydantic import BaseModel

router = APIRouter(prefix="/doma/fractional", tags=["Doma Fractional Tokens"])


class FractionalTokenResponse(BaseModel):
    token_address: str
    domain_name: str
    symbol: str
    name: str
    decimals: int
    total_supply: str
    current_price_usd: str
    fractionalized_at: Optional[datetime]
    minimum_buyout_price: Optional[str]
    is_bought_out: bool
    image_url: Optional[str]
    description: Optional[str]
    website: Optional[str]
    twitter_link: Optional[str]
    doma_rank_score: Optional[float]
    oracle_price_usd: Optional[str]
    
    class Config:
        from_attributes = True


class DomaRankResponse(BaseModel):
    domain_name: str
    doma_rank: float
    age_score: float
    demand_score: float
    keyword_score: float
    market_price_usd: str
    oracle_price_usd: str
    confidence: str
    expires_at: Optional[datetime]
    active_offers: int
    calculated_at: datetime


@router.get("/tokens", response_model=List[FractionalTokenResponse])
async def get_all_fractional_tokens(
    force_refresh: bool = Query(False, description="Force refresh from Doma Subgraph"),
    db: Session = Depends(get_db)
):
    """
    Get all fractional domain tokens from Doma Protocol
    Similar to DomaLend's token discovery phase
    """
    # Sync from subgraph if needed
    if force_refresh:
        await doma_subgraph_service.sync_fractional_tokens_to_db()
    
    # Query from database
    tokens = db.query(FractionalToken).all()
    
    # Enrich with DomaRank scores
    result = []
    for token in tokens:
        # Get latest valuation
        latest_val = db.query(DomainValuation).filter(
            DomainValuation.domain_name == token.domain_name
        ).order_by(DomainValuation.calculated_at.desc()).first()
        
        token_dict = {
            "token_address": token.token_address,
            "domain_name": token.domain_name,
            "symbol": token.symbol,
            "name": token.name,
            "decimals": token.decimals,
            "total_supply": str(token.total_supply),
            "current_price_usd": str(token.current_price_usd or 0),
            "fractionalized_at": token.fractionalized_at,
            "minimum_buyout_price": str(token.minimum_buyout_price) if token.minimum_buyout_price else None,
            "is_bought_out": token.is_bought_out,
            "image_url": token.image_url,
            "description": token.description,
            "website": token.website,
            "twitter_link": token.twitter_link,
            "doma_rank_score": float(latest_val.doma_rank_score) if latest_val else None,
            "oracle_price_usd": str(latest_val.oracle_price_usd) if latest_val else None
        }
        result.append(FractionalTokenResponse(**token_dict))
    
    return result


@router.get("/tokens/{token_address}", response_model=FractionalTokenResponse)
async def get_fractional_token(
    token_address: str,
    db: Session = Depends(get_db)
):
    """Get details for a specific fractional token"""
    token = db.query(FractionalToken).filter(
        FractionalToken.token_address == token_address.lower()
    ).first()
    
    if not token:
        raise HTTPException(status_code=404, detail="Fractional token not found")
    
    # Get latest valuation
    latest_val = db.query(DomainValuation).filter(
        DomainValuation.domain_name == token.domain_name
    ).order_by(DomainValuation.calculated_at.desc()).first()
    
    return FractionalTokenResponse(
        token_address=token.token_address,
        domain_name=token.domain_name,
        symbol=token.symbol,
        name=token.name,
        decimals=token.decimals,
        total_supply=str(token.total_supply),
        current_price_usd=str(token.current_price_usd or 0),
        fractionalized_at=token.fractionalized_at,
        minimum_buyout_price=str(token.minimum_buyout_price) if token.minimum_buyout_price else None,
        is_bought_out=token.is_bought_out,
        image_url=token.image_url,
        description=token.description,
        website=token.website,
        twitter_link=token.twitter_link,
        doma_rank_score=float(latest_val.doma_rank_score) if latest_val else None,
        oracle_price_usd=str(latest_val.oracle_price_usd) if latest_val else None
    )


@router.get("/rank/{domain_name}", response_model=DomaRankResponse)
async def get_doma_rank(
    domain_name: str,
    recalculate: bool = Query(False, description="Force recalculation"),
    db: Session = Depends(get_db)
):
    """
    Get DomaRank AI valuation for a domain
    Implements multi-factor analysis like DomaLend's oracle
    """
    if recalculate:
        # Calculate fresh ranking
        valuation = await doma_rank_oracle_service.calculate_doma_rank(domain_name)
        await doma_rank_oracle_service.save_valuation_to_db(valuation)
    else:
        # Get latest from DB
        latest_val = db.query(DomainValuation).filter(
            DomainValuation.domain_name == domain_name.lower()
        ).order_by(DomainValuation.calculated_at.desc()).first()
        
        if not latest_val:
            # Calculate if not exists
            valuation = await doma_rank_oracle_service.calculate_doma_rank(domain_name)
            await doma_rank_oracle_service.save_valuation_to_db(valuation)
        else:
            valuation = {
                'domain_name': latest_val.domain_name,
                'doma_rank': float(latest_val.doma_rank_score),
                'age_score': float(latest_val.age_score),
                'demand_score': float(latest_val.demand_score),
                'keyword_score': float(latest_val.keyword_score),
                'market_price_usd': latest_val.market_price_usd,
                'oracle_price_usd': latest_val.oracle_price_usd,
                'confidence': latest_val.confidence_level,
                'expires_at': None,  # Would need to join with domain details
                'active_offers': 0,  # Would need additional query
                'calculated_at': latest_val.calculated_at
            }
    
    return DomaRankResponse(
        domain_name=valuation['domain_name'],
        doma_rank=valuation['doma_rank'],
        age_score=valuation['age_score'],
        demand_score=valuation['demand_score'],
        keyword_score=valuation['keyword_score'],
        market_price_usd=str(valuation['market_price_usd']),
        oracle_price_usd=str(valuation['oracle_price_usd']),
        confidence=valuation['confidence'],
        expires_at=valuation.get('expires_at'),
        active_offers=valuation.get('active_offers', 0),
        calculated_at=valuation['calculated_at']
    )


@router.post("/sync")
async def sync_fractional_tokens(
    db: Session = Depends(get_db)
):
    """
    Manually trigger sync of fractional tokens from Doma Subgraph
    Admin endpoint for refreshing data
    """
    try:
        stats = await doma_subgraph_service.sync_fractional_tokens_to_db()
        return {
            "success": True,
            "message": "Fractional tokens synced successfully",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.post("/update-valuations")
async def update_all_valuations():
    """
    Manually trigger DomaRank valuation updates for all fractional tokens
    Similar to DomaLend's 10-minute oracle update cycle
    """
    try:
        stats = await doma_rank_oracle_service.update_all_fractional_token_valuations()
        return {
            "success": True,
            "message": "Valuations updated successfully",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")


@router.get("/market-stats")
async def get_market_stats():
    """Get overall market statistics for fractional tokens"""
    try:
        stats = await doma_subgraph_service.get_market_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch market stats: {str(e)}")


@router.get("/domain/{domain_name}/offers")
async def get_domain_offers(domain_name: str):
    """Get active offers for a specific domain from Doma Subgraph"""
    try:
        offers = await doma_subgraph_service.get_active_offers_for_domain(domain_name)
        return {
            "success": True,
            "domain_name": domain_name,
            "offers": offers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch offers: {str(e)}")


@router.get("/domain/{domain_name}/trading-history")
async def get_domain_trading_history(
    domain_name: str,
    limit: int = Query(50, ge=1, le=200)
):
    """Get trading history for a domain"""
    try:
        history = await doma_subgraph_service.get_domain_trading_history(domain_name, limit)
        return {
            "success": True,
            "domain_name": domain_name,
            "trades": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trading history: {str(e)}")
