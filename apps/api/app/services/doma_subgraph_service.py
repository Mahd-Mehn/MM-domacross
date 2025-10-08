"""
Doma Subgraph Integration Service
Provides real-time access to fractional tokens, domain metadata, and market data
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.database import Domain, FractionalToken

logger = logging.getLogger(__name__)


class DomaSubgraphService:
    """
    Integrates with Doma Protocol's GraphQL Subgraph to fetch:
    - Fractional token data (ERC-20 tokens from fractionalized domains)
    - Domain metadata (expiry, offers, trading history)
    - Market data (prices, volumes, liquidity)
    """
    
    def __init__(self) -> None:
        self.subgraph_url: Optional[str] = settings.doma_subgraph_url
        self.api_key: Optional[str] = settings.doma_api_key
        self._client: Optional[httpx.AsyncClient] = None
        
        # Cache for performance
        self._fractional_tokens_cache: Dict[str, Any] = {}
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl_seconds = 60  # 1 minute cache
    
    def _headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self.api_key:
            headers["Api-Key"] = self.api_key
        return headers
    
    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers=self._headers()
            )
        return self._client
    
    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            finally:
                self._client = None
    
    async def query_subgraph(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute a GraphQL query against the Doma Subgraph"""
        if not self.subgraph_url:
            raise RuntimeError("Doma Subgraph URL not configured. Set DOMA_SUBGRAPH_URL.")
        
        client = await self._get_client()
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        
        resp = await client.post(self.subgraph_url, json=payload)
        resp.raise_for_status()
        result = resp.json()
        
        if "errors" in result:
            logger.error(f"Subgraph query errors: {result['errors']}")
            raise RuntimeError(f"Subgraph query failed: {result['errors']}")
        
        return result.get("data", {})
    
    async def get_all_fractional_tokens(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Phase 1: Token Discovery
        Fetch all fractionalized domain tokens from the Doma Subgraph
        """
        # Check cache
        if not force_refresh and self._cache_timestamp:
            age = (datetime.now(timezone.utc) - self._cache_timestamp).total_seconds()
            if age < self._cache_ttl_seconds and self._fractional_tokens_cache:
                return list(self._fractional_tokens_cache.values())
        
        query = """
        query GetFractionalTokenList {
          fractionalTokens {
            items {
              name
              address
              fractionalizedAt
              currentPrice
              params {
                totalSupply
                name
                symbol
                decimals
              }
              metadata {
                image
                description
                website
                twitterLink
              }
            }
          }
        }
        """
        
        try:
            data = await self.query_subgraph(query)
            tokens = data.get("fractionalTokens", {}).get("items", [])
            
            # Update cache
            self._fractional_tokens_cache = {t["address"]: t for t in tokens}
            self._cache_timestamp = datetime.now(timezone.utc)
            
            logger.info(f"Fetched {len(tokens)} fractional tokens from Doma Subgraph")
            return tokens
        except Exception as e:
            logger.error(f"Failed to fetch fractional tokens: {e}")
            return []
    
    async def get_domain_details(self, domain_name: str) -> Optional[Dict[str, Any]]:
        """
        Phase 2: Domain Analysis
        Fetch detailed information about a specific domain
        """
        query = """
        query GetNameDetails($domainName: String!) {
          names(name: $domainName) {
            items {
              name
              expiresAt
              activeOffersCount
              highestOffer {
                price
                maker
              }
              fractionalTokenInfo {
                address
                currentPrice
                totalSupply
                symbol
              }
              metadata {
                tld
                length
                keywords
                premium
              }
            }
          }
        }
        """
        
        try:
            data = await self.query_subgraph(query, {"domainName": domain_name})
            items = data.get("names", {}).get("items", [])
            return items[0] if items else None
        except Exception as e:
            logger.error(f"Failed to fetch domain details for {domain_name}: {e}")
            return None
    
    async def get_fractional_token_by_address(self, token_address: str) -> Optional[Dict[str, Any]]:
        """Get specific fractional token by contract address"""
        tokens = await self.get_all_fractional_tokens()
        return next((t for t in tokens if t["address"].lower() == token_address.lower()), None)
    
    async def get_domain_trading_history(self, domain_name: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch trading history for a domain"""
        query = """
        query GetDomainTrades($domainName: String!, $limit: Int!) {
          trades(
            where: { domainName: $domainName }
            orderBy: timestamp
            orderDirection: desc
            first: $limit
          ) {
            id
            buyer
            seller
            price
            timestamp
            txHash
          }
        }
        """
        
        try:
            data = await self.query_subgraph(query, {"domainName": domain_name, "limit": limit})
            return data.get("trades", [])
        except Exception as e:
            logger.error(f"Failed to fetch trading history for {domain_name}: {e}")
            return []
    
    async def get_active_offers_for_domain(self, domain_name: str) -> List[Dict[str, Any]]:
        """Get all active offers for a domain"""
        query = """
        query GetActiveOffers($domainName: String!) {
          offers(
            where: { domainName: $domainName, status: "ACTIVE" }
            orderBy: price
            orderDirection: desc
          ) {
            id
            maker
            price
            expiresAt
            currency
          }
        }
        """
        
        try:
            data = await self.query_subgraph(query, {"domainName": domain_name})
            return data.get("offers", [])
        except Exception as e:
            logger.error(f"Failed to fetch active offers for {domain_name}: {e}")
            return []
    
    async def sync_fractional_tokens_to_db(self) -> Dict[str, int]:
        """
        Sync fractional tokens from Doma Subgraph to local database
        Returns stats about synced tokens
        """
        tokens = await self.get_all_fractional_tokens(force_refresh=True)
        
        session: Session = SessionLocal()
        created = 0
        updated = 0
        
        try:
            for token_data in tokens:
                address = token_data.get("address", "").lower()
                if not address:
                    continue
                
                # Extract domain name from token
                domain_name = token_data.get("name", "").lower()
                
                # Get or create domain
                domain = session.query(Domain).filter(Domain.name == domain_name).first()
                if not domain:
                    tld = domain_name.split('.')[-1] if '.' in domain_name else None
                    domain = Domain(name=domain_name, tld=tld)
                    session.add(domain)
                    session.flush()
                
                # Get or create fractional token
                frac_token = session.query(FractionalToken).filter(
                    FractionalToken.token_address == address
                ).first()
                
                params = token_data.get("params", {})
                metadata = token_data.get("metadata", {})
                
                if not frac_token:
                    frac_token = FractionalToken(
                        token_address=address,
                        domain_name=domain_name,
                        symbol=params.get("symbol", ""),
                        name=params.get("name", ""),
                        decimals=params.get("decimals", 18),
                        total_supply=Decimal(str(params.get("totalSupply", 0))),
                        current_price_usd=Decimal(str(token_data.get("currentPrice", 0))),
                        fractionalized_at=datetime.fromisoformat(
                            token_data.get("fractionalizedAt", "").replace("Z", "+00:00")
                        ) if token_data.get("fractionalizedAt") else None,
                        image_url=metadata.get("image"),
                        description=metadata.get("description"),
                        website=metadata.get("website"),
                        twitter_link=metadata.get("twitterLink")
                    )
                    session.add(frac_token)
                    created += 1
                else:
                    # Update existing
                    frac_token.current_price_usd = Decimal(str(token_data.get("currentPrice", 0)))
                    frac_token.total_supply = Decimal(str(params.get("totalSupply", 0)))
                    frac_token.updated_at = datetime.now(timezone.utc)
                    updated += 1
            
            session.commit()
            logger.info(f"Synced fractional tokens: {created} created, {updated} updated")
            return {"created": created, "updated": updated, "total": len(tokens)}
        
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to sync fractional tokens to DB: {e}")
            raise
        finally:
            session.close()
    
    async def get_market_stats(self) -> Dict[str, Any]:
        """Get overall market statistics from Doma Subgraph"""
        query = """
        query GetMarketStats {
          marketStats {
            totalVolume24h
            totalTrades24h
            totalFractionalTokens
            totalValueLocked
            topGainers {
              name
              priceChange24h
            }
            topLosers {
              name
              priceChange24h
            }
          }
        }
        """
        
        try:
            data = await self.query_subgraph(query)
            return data.get("marketStats", {})
        except Exception as e:
            logger.error(f"Failed to fetch market stats: {e}")
            return {}


# Singleton instance
doma_subgraph_service = DomaSubgraphService()
