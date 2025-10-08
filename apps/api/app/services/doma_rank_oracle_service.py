"""
DomaRank Oracle Service
AI-powered domain valuation system for fractional domain tokens
Implements multi-factor analysis
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
import re

from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.database import Domain, FractionalToken, DomainValuation
from app.services.doma_subgraph_service import doma_subgraph_service

logger = logging.getLogger(__name__)


class DomaRankOracleService:
    """
    AI-powered oracle for domain token valuation
    
    Scoring Factors:
    1. Age Score (20%): Years on-chain + years until expiry
    2. Market Demand (50%): Active offers, trading volume, liquidity
    3. Keyword Premium (30%): TLD quality, domain length, premium keywords
    
    Final Price = Market Price × (DomaRank / 100)
    """
    
    # TLD Premium Scores (out of 10)
    TLD_SCORES = {
        '.ai': 10,
        '.io': 9,
        '.com': 9,
        '.xyz': 7,
        '.eth': 8,
        '.crypto': 8,
        '.nft': 7,
        '.dao': 7,
        '.app': 6,
        '.dev': 6,
        '.tech': 6,
        '.finance': 7,
        '.defi': 8,
    }
    
    # Premium Keywords
    PREMIUM_KEYWORDS = {
        'crypto', 'nft', 'defi', 'dao', 'web3', 'blockchain', 'bitcoin', 'ethereum',
        'meta', 'metaverse', 'ai', 'artificial', 'intelligence', 'machine', 'learning',
        'software', 'app', 'platform', 'protocol', 'finance', 'bank', 'pay', 'wallet',
        'trade', 'exchange', 'market', 'token', 'coin', 'digital', 'virtual', 'cyber',
        'cloud', 'data', 'analytics', 'smart', 'tech', 'innovation', 'future', 'next'
    }
    
    def __init__(self) -> None:
        self.min_score = 0
        self.max_score = 100
        self.conservative_multiplier = 0.85  # Apply 15% safety margin
    
    def _calculate_age_score(
        self,
        fractionalized_at: Optional[datetime],
        expires_at: Optional[datetime]
    ) -> float:
        """
        Calculate age score based on:
        - Years since fractionalization (on-chain history)
        - Years until domain expiry (remaining utility)
        
        Returns: 0-10 score
        """
        score = 0.0
        
        # Years on-chain (max 5 points)
        if fractionalized_at:
            years_on_chain = (datetime.now(timezone.utc) - fractionalized_at).days / 365.25
            score += min(years_on_chain * 2.5, 5.0)  # Cap at 5 points for 2+ years
        
        # Years until expiry (max 5 points)
        if expires_at:
            years_until_expiry = (expires_at - datetime.now(timezone.utc)).days / 365.25
            if years_until_expiry > 0:
                score += min(years_until_expiry * 1.67, 5.0)  # Cap at 5 points for 3+ years
            else:
                score = 0  # Expired domain has no value
        
        return min(score, 10.0)
    
    def _calculate_demand_score(
        self,
        active_offers_count: int,
        highest_offer_price: Optional[Decimal],
        current_market_price: Optional[Decimal],
        trading_volume_24h: Optional[Decimal]
    ) -> float:
        """
        Calculate market demand score based on:
        - Number of active offers
        - Highest offer vs market price ratio
        - Trading volume
        
        Returns: 0-10 score
        """
        score = 0.0
        
        # Active offers (max 3 points)
        if active_offers_count > 0:
            score += min(active_offers_count * 0.5, 3.0)  # Cap at 3 points for 6+ offers
        
        # Offer strength (max 4 points)
        if highest_offer_price and current_market_price and current_market_price > 0:
            offer_ratio = float(highest_offer_price / current_market_price)
            if offer_ratio >= 0.9:
                score += 4.0  # Strong demand (offer near market price)
            elif offer_ratio >= 0.7:
                score += 3.0
            elif offer_ratio >= 0.5:
                score += 2.0
            else:
                score += 1.0
        
        # Trading volume (max 3 points)
        if trading_volume_24h and trading_volume_24h > 0:
            # Normalize by market price to get volume in units
            if current_market_price and current_market_price > 0:
                volume_units = float(trading_volume_24h / current_market_price)
                score += min(volume_units / 100, 3.0)  # Cap at 3 points for 100+ units
        
        return min(score, 10.0)
    
    def _calculate_keyword_score(
        self,
        domain_name: str,
        tld: Optional[str]
    ) -> float:
        """
        Calculate keyword premium score based on:
        - TLD quality
        - Domain length
        - Premium keywords
        
        Returns: 0-10 score
        """
        score = 0.0
        
        # TLD score (max 4 points)
        if tld:
            tld_lower = tld.lower()
            if tld_lower in self.TLD_SCORES:
                score += (self.TLD_SCORES[tld_lower] / 10) * 4.0
            else:
                score += 1.0  # Base score for any valid TLD
        
        # Domain length (max 3 points)
        base_name = domain_name.split('.')[0].lower()
        length = len(base_name)
        if length <= 3:
            score += 3.0  # Premium short domain
        elif length <= 5:
            score += 2.5
        elif length <= 8:
            score += 2.0
        elif length <= 12:
            score += 1.5
        else:
            score += 1.0
        
        # Premium keywords (max 3 points)
        keyword_matches = sum(1 for kw in self.PREMIUM_KEYWORDS if kw in base_name)
        score += min(keyword_matches * 1.5, 3.0)
        
        return min(score, 10.0)
    
    async def calculate_doma_rank(
        self,
        domain_name: str,
        token_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive DomaRank score for a domain
        
        Returns:
        {
            'domain_name': str,
            'doma_rank': float (0-100),
            'age_score': float (0-10),
            'demand_score': float (0-10),
            'keyword_score': float (0-10),
            'market_price_usd': Decimal,
            'oracle_price_usd': Decimal (conservative),
            'confidence': str ('high', 'medium', 'low')
        }
        """
        # Fetch domain details from Subgraph
        domain_details = await doma_subgraph_service.get_domain_details(domain_name)
        
        if not domain_details:
            logger.warning(f"No domain details found for {domain_name}")
            return self._default_valuation(domain_name)
        
        # Extract data
        expires_at_str = domain_details.get("expiresAt")
        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00")) if expires_at_str else None
        
        active_offers_count = domain_details.get("activeOffersCount", 0)
        
        highest_offer = domain_details.get("highestOffer", {})
        highest_offer_price = Decimal(str(highest_offer.get("price", 0))) if highest_offer else None
        
        frac_info = domain_details.get("fractionalTokenInfo", {})
        current_price = Decimal(str(frac_info.get("currentPrice", 0))) if frac_info else Decimal(0)
        
        metadata = domain_details.get("metadata", {})
        tld = metadata.get("tld")
        
        # Get fractional token for fractionalization date
        frac_token = None
        if token_address:
            frac_token = await doma_subgraph_service.get_fractional_token_by_address(token_address)
        
        fractionalized_at_str = frac_token.get("fractionalizedAt") if frac_token else None
        fractionalized_at = datetime.fromisoformat(
            fractionalized_at_str.replace("Z", "+00:00")
        ) if fractionalized_at_str else None
        
        # Get trading volume (placeholder - would need additional query)
        trading_volume_24h = Decimal(0)  # TODO: Implement from trading history
        
        # Calculate component scores
        age_score = self._calculate_age_score(fractionalized_at, expires_at)
        demand_score = self._calculate_demand_score(
            active_offers_count,
            highest_offer_price,
            current_price,
            trading_volume_24h
        )
        keyword_score = self._calculate_keyword_score(domain_name, tld)
        
        # Weighted DomaRank (0-100)
        doma_rank = (
            (age_score * 0.20) +      # 20% weight
            (demand_score * 0.50) +   # 50% weight
            (keyword_score * 0.30)    # 30% weight
        ) * 10  # Scale to 0-100
        
        # Conservative oracle price
        oracle_price = current_price * Decimal(str(doma_rank / 100)) * Decimal(str(self.conservative_multiplier))
        
        # Confidence level
        confidence = 'high' if doma_rank >= 70 else 'medium' if doma_rank >= 40 else 'low'
        
        return {
            'domain_name': domain_name,
            'doma_rank': round(float(doma_rank), 2),
            'age_score': round(age_score, 2),
            'demand_score': round(demand_score, 2),
            'keyword_score': round(keyword_score, 2),
            'market_price_usd': current_price,
            'oracle_price_usd': oracle_price,
            'confidence': confidence,
            'expires_at': expires_at,
            'active_offers': active_offers_count,
            'calculated_at': datetime.now(timezone.utc)
        }
    
    def _default_valuation(self, domain_name: str) -> Dict[str, Any]:
        """Return default valuation when data is unavailable"""
        return {
            'domain_name': domain_name,
            'doma_rank': 50.0,
            'age_score': 5.0,
            'demand_score': 5.0,
            'keyword_score': 5.0,
            'market_price_usd': Decimal(0),
            'oracle_price_usd': Decimal(0),
            'confidence': 'low',
            'expires_at': None,
            'active_offers': 0,
            'calculated_at': datetime.now(timezone.utc)
        }
    
    async def batch_calculate_rankings(
        self,
        domain_names: List[str]
    ) -> List[Dict[str, Any]]:
        """Calculate DomaRank for multiple domains in parallel"""
        tasks = [self.calculate_doma_rank(name) for name in domain_names]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions
        valid_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Failed to calculate rank for {domain_names[i]}: {result}")
            else:
                valid_results.append(result)
        
        return valid_results
    
    async def save_valuation_to_db(
        self,
        valuation: Dict[str, Any]
    ) -> None:
        """Persist valuation to database"""
        session: Session = SessionLocal()
        
        try:
            domain_name = valuation['domain_name']
            
            # Get or create domain
            domain = session.query(Domain).filter(Domain.name == domain_name).first()
            if not domain:
                tld = domain_name.split('.')[-1] if '.' in domain_name else None
                domain = Domain(name=domain_name, tld=tld)
                session.add(domain)
                session.flush()
            
            # Create valuation record
            val_record = DomainValuation(
                domain_name=domain_name,
                doma_rank_score=Decimal(str(valuation['doma_rank'])),
                age_score=Decimal(str(valuation['age_score'])),
                demand_score=Decimal(str(valuation['demand_score'])),
                keyword_score=Decimal(str(valuation['keyword_score'])),
                market_price_usd=valuation['market_price_usd'],
                oracle_price_usd=valuation['oracle_price_usd'],
                confidence_level=valuation['confidence'],
                calculated_at=valuation['calculated_at']
            )
            session.add(val_record)
            
            # Update domain's latest valuation
            domain.last_estimated_value = valuation['oracle_price_usd']
            domain.doma_rank_score = Decimal(str(valuation['doma_rank']))
            
            session.commit()
            logger.info(f"Saved valuation for {domain_name}: DomaRank={valuation['doma_rank']}")
        
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to save valuation: {e}")
            raise
        finally:
            session.close()
    
    async def update_all_fractional_token_valuations(self) -> Dict[str, int]:
        """
        Background task: Update valuations for all fractional tokens
        Similar to DomaLend's 10-minute oracle update cycle
        """
        # Get all fractional tokens
        tokens = await doma_subgraph_service.get_all_fractional_tokens(force_refresh=True)
        
        domain_names = [t.get("name") for t in tokens if t.get("name")]
        
        logger.info(f"Updating valuations for {len(domain_names)} fractional tokens...")
        
        # Calculate rankings in parallel
        valuations = await self.batch_calculate_rankings(domain_names)
        
        # Save to database
        saved = 0
        for valuation in valuations:
            try:
                await self.save_valuation_to_db(valuation)
                saved += 1
            except Exception as e:
                logger.error(f"Failed to save valuation for {valuation['domain_name']}: {e}")
        
        return {
            "total_tokens": len(domain_names),
            "valuations_calculated": len(valuations),
            "valuations_saved": saved
        }


# Singleton instance
doma_rank_oracle_service = DomaRankOracleService()
