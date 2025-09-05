from __future__ import annotations

from typing import Any, Dict, List, Optional, Callable

import asyncio
import logging
from enum import Enum
from datetime import datetime, timezone

import httpx

from app.config import settings
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from app.models.database import Trade, Participant, Competition, User, ProcessedEvent, Domain, Listing, Offer, PollIngestState
from app.services.cost_basis_service import apply_trade_cost_basis
from app.database import Base, engine
from app.services.audit_service import record_audit_event
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class DomaEventType(str, Enum):
    NAME_TOKEN_LISTED = "NAME_TOKEN_LISTED"
    NAME_TOKEN_PURCHASED = "NAME_TOKEN_PURCHASED"
    NAME_TOKEN_OFFER_RECEIVED = "NAME_TOKEN_OFFER_RECEIVED"
    NAME_TOKEN_TRANSFERRED = "NAME_TOKEN_TRANSFERRED"
    NAME_TOKEN_RENEWED = "NAME_TOKEN_RENEWED"
    NAME_RENEWED = "NAME_RENEWED"
    PAYMENT_FULFILLED = "PAYMENT_FULFILLED"
    FRACTION_MINTED = "FRACTION_MINTED"  # hypothetical based on fractionalization doc
    FRACTION_REDEEMED = "FRACTION_REDEEMED"  # hypothetical


class DomaPollService:
    def __init__(self) -> None:
        self.base_url: Optional[str] = settings.doma_poll_base_url
        self.api_key: Optional[str] = settings.doma_poll_api_key
        self._client: Optional[httpx.AsyncClient] = None
        # metrics
        self.last_poll_time: Optional[datetime] = None
        self.last_event_time: Optional[datetime] = None
        self.total_events_processed: int = 0
        self.handlers: Dict[str, Callable[[Session, Dict[str, Any], Dict[str, Any]], None]] = {
            DomaEventType.NAME_TOKEN_PURCHASED.value: self._handle_name_token_purchased,
            DomaEventType.NAME_TOKEN_LISTED.value: self._handle_name_token_listed,
            DomaEventType.NAME_TOKEN_OFFER_RECEIVED.value: self._handle_offer_received,
            DomaEventType.NAME_TOKEN_TRANSFERRED.value: self._handle_transferred,
            DomaEventType.NAME_TOKEN_RENEWED.value: self._handle_renewed,
            DomaEventType.NAME_RENEWED.value: self._handle_renewed,
            DomaEventType.PAYMENT_FULFILLED.value: self._handle_payment_fulfilled,
        }

    def _headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {"Accept": "application/json"}
        # According to Poll API spec, API key should be sent in 'Api-Key' header
        if self.api_key:
            headers["Api-Key"] = self.api_key
        return headers

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0, headers=self._headers())
        return self._client

    async def close(self) -> None:
        client = self._client
        if client is not None:
            try:
                await client.aclose()
            finally:
                self._client = None

    async def poll(self, limit: Optional[int] = None, event_types: Optional[List[str]] = None) -> Dict[str, Any]:
        if not self.base_url:
            raise RuntimeError("DOMA Poll API not configured. Set DOMA_POLL_BASE_URL.")
        params: Dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if event_types:
            # API expects repeated eventTypes query param entries
            params["eventTypes"] = event_types
        client = await self._get_client()
        url = f"{self.base_url.rstrip('/')}/v1/poll"
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()

    async def ack(self, last_event_id: Any) -> None:
        if not self.base_url:
            raise RuntimeError("DOMA Poll API not configured. Set DOMA_POLL_BASE_URL.")
        client = await self._get_client()
        url = f"{self.base_url.rstrip('/')}/v1/poll/ack/{last_event_id}"
        resp = await client.post(url)
        resp.raise_for_status()

    async def reset(self, to_event_id: Optional[Any] = None) -> None:
        if not self.base_url:
            raise RuntimeError("DOMA Poll API not configured. Set DOMA_POLL_BASE_URL.")
        client = await self._get_client()
        # Spec uses path parameter: /v1/poll/reset/{eventId}. Use 0 when None to rewind.
        event_id = to_event_id if to_event_id is not None else 0
        url = f"{self.base_url.rstrip('/')}/v1/poll/reset/{event_id}"
        resp = await client.post(url)
        resp.raise_for_status()

    def _get_or_create_state(self, session: Session) -> PollIngestState:
        st = session.query(PollIngestState).first()
        if not st:
            st = PollIngestState()
            session.add(st)
            session.flush()
        return st

    async def process_events(self, events: List[Dict[str, Any]]) -> Dict[str, int]:
        """Persist recognized events to the database.

        Mappings (initial pragmatic rules):
        - NAME_TOKEN_LISTED: no portfolio impact yet (could build orderbook later)
        - NAME_TOKEN_PURCHASED: creates Trade BUY for buyer, Trade SELL for seller, adjusts participant portfolio_value
        - NAME_TOKEN_OFFER_RECEIVED: ignored (future notifications)
        - NAME_TOKEN_TRANSFERRED: treat as movement without price (ignored for PnL)
        - NAME_TOKEN_RENEWED / NAME_RENEWED: ignored for now
        - PAYMENT_FULFILLED: potential funding event (ignored)
        """
        if not events:
            return {"processed": 0}

        # Acquire a DB session lazily (FastAPI dependency not available here directly)
        # We import inside method to avoid circular import.
        from app.database import SessionLocal  # type: ignore
        session: Session = SessionLocal()
        processed = 0
        try:
            state_row = self._get_or_create_state(session)
            prev_integrity = state_row.last_integrity_hash or ''
            for evt in events:
                evt_type = evt.get("type") or evt.get("eventType") or "UNKNOWN"
                event_data = evt.get("eventData") or {}
                unique_id = evt.get("uniqueId") or evt.get("id")
                raw_ts = evt.get("timestamp") or evt.get("createdAt")
                if raw_ts and not self.last_event_time:
                    try:
                        # assume ISO8601
                        self.last_event_time = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
                    except Exception:
                        pass
                if unique_id and session.query(ProcessedEvent).filter(ProcessedEvent.unique_id == str(unique_id)).first():
                    continue  # already processed
                try:
                    handler = self.handlers.get(evt_type)
                    if handler:
                        handler(session, evt, event_data)
                        processed += 1
                    else:
                        # unhandled event type, still mark processed for idempotency ledger
                        processed += 1
                    if unique_id:
                        session.add(ProcessedEvent(unique_id=str(unique_id), event_type=evt_type or "UNKNOWN", payload=event_data))
                        # Record audit event chaining off previous integrity hash
                        ae = record_audit_event(session, event_type=f"POLL_{evt_type}", entity_type='DOMA_EVENT', entity_id=None, user_id=None, payload={
                            'unique_id': unique_id, 'raw_type': evt_type, 'data': event_data
                        })
                        prev_integrity = ae.integrity_hash
                except Exception as e:  # log and continue; don't block batch
                    logger.error("Error processing event type=%s id=%s err=%s", evt_type, evt.get("id"), e)
            session.commit()
            # Update state after commit
            if events:
                try:
                    state_row.last_ack_event_id = events[-1].get('id') or state_row.last_ack_event_id
                    state_row.last_ingested_at = datetime.now(timezone.utc)
                    state_row.last_integrity_hash = prev_integrity
                    session.add(state_row)
                    session.commit()
                except Exception:
                    logger.exception("Failed updating PollIngestState")
        finally:
            session.close()
        self.total_events_processed += processed
        return {"processed": processed}

    def _handle_name_token_purchased(self, session: Session, raw_evt: Dict[str, Any], data: Dict[str, Any]) -> None:
        token_id = data.get("tokenId")
        token_address = data.get("tokenAddress")
        seller = (data.get("seller") or "").lower()
        buyer = (data.get("buyer") or "").lower()
        payment = data.get("payment") or {}
        price_raw = payment.get("price")
        try:
            price = Decimal(str(price_raw)) if price_raw is not None else Decimal(0)
        except Exception:
            price = Decimal(0)

        # Resolve users
        buyer_user = self._get_or_create_user(session, buyer)
        seller_user = self._get_or_create_user(session, seller)

        # For now we can't map to a specific competition unless contract_address matches; naive approach: update all active competitions participants that match wallet.
        active_participants = session.query(Participant).join(Competition, Participant.competition_id == Competition.id).filter(
            (Participant.user_id.in_([buyer_user.id, seller_user.id]))
        ).all()

    # Record trades
        for user, trade_type in [(buyer_user, "BUY"), (seller_user, "SELL")]:
            participant = next((p for p in active_participants if p.user_id == user.id), None)
            if not participant:
                continue
            trade = Trade(
                participant_id=participant.id,
                domain_token_address=token_address,
                domain_token_id=str(token_id),
                trade_type=trade_type,
                price=price,
                tx_hash=str(raw_evt.get("txHash") or raw_evt.get("uniqueId")),
            )
            session.add(trade)
            # Adjust portfolio value
            sign = Decimal(1) if trade_type == "BUY" else Decimal(-1)
            participant.portfolio_value = Decimal(participant.portfolio_value or 0) + (price * sign)
            # Apply shared cost basis logic
            domain_key = f"{token_address}:{token_id}"
            apply_trade_cost_basis(session, participant.id, domain_key, trade_type, price)

    def _handle_name_token_listed(self, session: Session, raw_evt: Dict[str, Any], data: Dict[str, Any]) -> None:
        domain_name = data.get("name") or data.get("domainName")
        seller = (data.get("seller") or "").lower()
        price_raw = (data.get("price") or data.get("listingPrice"))
        # Future: Poll API may include an order / listing id field (e.g. listingId, orderId)
        ext_id = data.get("orderId") or data.get("listingId") or data.get("id")
        try:
            price = Decimal(str(price_raw)) if price_raw is not None else Decimal(0)
        except Exception:
            price = Decimal(0)
        if domain_name:
            self._get_or_create_domain(session, domain_name)
            listing = Listing(domain_name=domain_name, seller_wallet=seller, price=price, tx_hash=str(raw_evt.get("txHash") or raw_evt.get("uniqueId")))
            if ext_id:
                # Only set if not already present to avoid uniqueness conflicts from reorg-like duplicates
                listing.external_order_id = str(ext_id)
            session.add(listing)
        return

    def _handle_offer_received(self, session: Session, raw_evt: Dict[str, Any], data: Dict[str, Any]) -> None:
        domain_name = data.get("name") or data.get("domainName")
        buyer = (data.get("buyer") or data.get("maker") or "").lower()
        price_raw = data.get("price") or data.get("offerPrice")
        ext_id = data.get("orderId") or data.get("offerId") or data.get("id")
        try:
            price = Decimal(str(price_raw)) if price_raw is not None else Decimal(0)
        except Exception:
            price = Decimal(0)
        if domain_name:
            self._get_or_create_domain(session, domain_name)
            offer = Offer(domain_name=domain_name, buyer_wallet=buyer, price=price, tx_hash=str(raw_evt.get("txHash") or raw_evt.get("uniqueId")))
            if ext_id:
                offer.external_order_id = str(ext_id)
            session.add(offer)
        return

    def _handle_transferred(self, session: Session, raw_evt: Dict[str, Any], data: Dict[str, Any]) -> None:
        # Ownership transfer without price impact: could adjust inventory later.
        return

    def _handle_renewed(self, session: Session, raw_evt: Dict[str, Any], data: Dict[str, Any]) -> None:
        return

    def _handle_payment_fulfilled(self, session: Session, raw_evt: Dict[str, Any], data: Dict[str, Any]) -> None:
        return

    def _get_or_create_user(self, session: Session, wallet: str) -> User:
        wallet = wallet.lower()
        user = session.query(User).filter(User.wallet_address == wallet).first()
        if not user:
            user = User(wallet_address=wallet)
            session.add(user)
            session.flush()
        return user

    def _get_or_create_domain(self, session: Session, name: str) -> Domain:
        name_l = name.lower()
        domain = session.query(Domain).filter(Domain.name == name_l).first()
        if not domain:
            tld = name_l.split('.')[-1] if '.' in name_l else None
            domain = Domain(name=name_l, tld=tld)
            session.add(domain)
            session.flush()
        domain.last_seen_event_at = datetime.now(timezone.utc)
        return domain

    async def run_once(self, limit: Optional[int] = None, event_types: Optional[List[str]] = None) -> Dict[str, Any]:
        """Polls once, processes events, acks the batch."""
        result = await self.poll(limit=limit, event_types=event_types)
        events: List[Dict[str, Any]] = result.get("events") or result.get("items") or []
        last_id = result.get("lastId") or (events[-1]["id"] if events else None)
        stats = await self.process_events(events)
        if last_id is not None:
            await self.ack(last_id)
        self.last_poll_time = datetime.now(timezone.utc)
        return {"count": len(events), "last_id": last_id, **stats}


doma_poll_service = DomaPollService()
