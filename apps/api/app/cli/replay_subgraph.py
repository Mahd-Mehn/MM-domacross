#!/usr/bin/env python3
"""Replay/backfill script using Subgraph API.

Fetches historical events or domain states and replays them through simplified processing.
"""
from __future__ import annotations
import os, sys, json, asyncio
import httpx
from typing import List
from sqlalchemy.orm import Session
from app.config import settings
from app.database import SessionLocal
from app.services.doma_poll_service import DomaPollService

SUBGRAPH_URL = settings.doma_subgraph_url

async def fetch_subgraph(query: str, variables: dict | None = None) -> dict:
    if not SUBGRAPH_URL:
        raise RuntimeError("DOMA_SUBGRAPH_URL not configured")
    async with httpx.AsyncClient(timeout=40) as client:
        resp = await client.post(SUBGRAPH_URL, json={"query": query, "variables": variables or {}})
        resp.raise_for_status()
        data = resp.json()
        if 'errors' in data:
            raise RuntimeError(data['errors'])
        return data['data']

DOMAIN_TRADES_QUERY = """
query DomainTrades($first:Int,$skip:Int){
  trades:firstDomainTrades(first:$first, skip:$skip){
    id
    tokenId
    tokenAddress
    price
    buyer
    seller
    txHash
  }
}
"""

async def backfill_trades(batch_size: int = 100):
    skip = 0
    dps = DomaPollService()  # fresh instance but reuses DB logic
    while True:
        data = await fetch_subgraph(DOMAIN_TRADES_QUERY, {"first": batch_size, "skip": skip})
        rows = data.get('trades') or []
        if not rows:
            break
        # Adapt to process_events by shaping rows as purchase events
        events = []
        for r in rows:
            events.append({
                'type': 'NAME_TOKEN_PURCHASED',
                'uniqueId': r['id'],
                'eventData': {
                    'tokenId': r['tokenId'],
                    'tokenAddress': r['tokenAddress'],
                    'seller': r['seller'],
                    'buyer': r['buyer'],
                    'payment': {'price': r['price'], 'tokenAddress': r['tokenAddress'], 'currencySymbol': 'N/A'}
                },
                'txHash': r.get('txHash')
            })
        await dps.process_events(events)
        skip += batch_size

async def main():
    await backfill_trades()

if __name__ == '__main__':
    asyncio.run(main())
