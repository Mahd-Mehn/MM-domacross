from __future__ import annotations
"""Simple on-chain event ingestion loop with block cursor & shallow reorg handling.

Design:
- Stores last processed block + parent hash in a tiny state table (created lazily).
- On each run:
  * Fetch current head block number & hash.
  * Starting from (last_block + 1) up to head (cap max_range) fetch logs (stubbed placeholder if web3 absent).
  * For each block, confirm parent hash continuity; if mismatch, treat as shallow reorg: rewind N blocks (configurable depth) and reprocess.
  * Emits AUDIT events placeholder (future: actual redemption / fee events on-chain).

This is a minimal scaffold; real implementation would filter specific contract addresses / topics.
"""
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String
from app.database import engine, Base
from app.services.blockchain_service import blockchain_service
from app.services.audit_service import record_audit_event
from app.models.database import Trade, Participant, User, Competition, MarketplaceOrderCache
from app.config import settings
from datetime import datetime, timezone
from typing import Any
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)

class ChainIngestState(Base):  # type: ignore
    __tablename__ = 'chain_ingest_state'
    id = Column(Integer, primary_key=True)
    last_block = Column(Integer, nullable=False, default=0)
    parent_hash = Column(String(80), nullable=True)

try:  # pragma: no cover
    if ChainIngestState.__table__.name not in Base.metadata.tables:
        Base.metadata._add_table(ChainIngestState.__table__.name, None, ChainIngestState.__table__)
    Base.metadata.create_all(bind=engine, tables=[ChainIngestState.__table__])
except Exception:
    logger.exception("Failed creating chain_ingest_state table")

class ChainIngestService:
    # Explicit attribute declaration for static analyzers
    order_cache: dict[int, dict[str, Any]]
    def __init__(self):
        self.max_batch_blocks = 50
        self.max_reorg_depth = 6
        # in-memory mirror: order_id -> metadata dict (contract, token_id, price_raw, seller)
        self.order_cache = {}

    def _get_state(self, db: Session) -> ChainIngestState:
        row = db.query(ChainIngestState).first()
        if not row:
            row = ChainIngestState(last_block=0, parent_hash=None)
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    def _update_state(self, db: Session, row: ChainIngestState, last_block: int, parent_hash: str | None):
        row.last_block = last_block
        row.parent_hash = parent_hash
        db.add(row)
        db.commit()

    def _maybe_decode_marketplace_events(self, db: Session, logs, block_ts: datetime):
        """Decode DomainMarketplace events from raw logs if config enabled.

        Emits AUDIT events and persists Trade rows for TradeExecuted events.
        Requirements: settings.enable_chain_marketplace_events and marketplace
        contract address configured. Uses explicit topic signatures for
        OrderCreated(uint256,address,address,uint256,uint256) and
        TradeExecuted(uint256,address,address,uint256) from solidity events:
            event OrderCreated(uint256 indexed orderId, address indexed seller, address domainContract, uint256 tokenId, uint256 price);
            event TradeExecuted(uint256 indexed tradeId, address indexed buyer, address indexed seller, uint256 price);
        """
        if not settings.enable_chain_marketplace_events:
            return
        mkt = settings.domain_marketplace_contract_address
        if not mkt:
            return
        mkt_lower = mkt.lower()
        # Precomputed keccak hashes of event signatures (topic0)
        ORDER_CREATED = '0x03dd3b14c56623f65a5c49080f964c1673909e9e5a66dd2d445a95d8961c5e0c'
        TRADE_EXECUTED = '0x3bf1911091cf07bba468e2e4040d3ba93926ab9dd98ec6053b457769278ade41'
        for lg in logs:
            try:
                addr = getattr(lg, 'address', None)
                if not addr or addr.lower() != mkt_lower:
                    continue
                topics = [t.hex() if hasattr(t,'hex') else t for t in getattr(lg,'topics',[])]
                if not topics:
                    continue
                topic0 = topics[0]
                data = getattr(lg, 'data', None)
                # Basic decoding: topics[1..] are indexed params, data encodes the rest (ABI packed 32-byte words)
                if topic0 == ORDER_CREATED:
                    # Indexed: orderId, seller; Non-indexed (data): domainContract, tokenId, price
                    order_id = int(topics[1],16) if len(topics) > 1 else None
                    seller = '0x'+topics[2][-40:] if len(topics) > 2 else None
                    domain_contract = None
                    token_id = None
                    price_raw = None
                    if data and len(data) >= 2 + 64*3:
                        try:
                            hex_body = data[2:]
                            word0 = hex_body[0:64]
                            word1 = hex_body[64:128]
                            word2 = hex_body[128:192]
                            domain_contract = '0x' + word0[-40:]
                            token_id = int(word1,16)
                            price_raw = int(word2,16)
                        except Exception:
                            pass
                    if order_id is not None and price_raw is not None:
                        # update in-memory cache
                        self.order_cache[order_id] = {
                            'contract': domain_contract or '0x0',
                            'token_id': token_id or 0,
                            'price_raw': price_raw,
                            'seller': (seller or '').lower()
                        }
                        # persist (upsert-like) marketplace order cache row
                        existing = db.query(MarketplaceOrderCache).filter(MarketplaceOrderCache.order_id == order_id).first()
                        if not existing:
                            db.add(MarketplaceOrderCache(
                                order_id=order_id,
                                domain_contract=domain_contract,
                                token_id=str(token_id) if token_id is not None else None,
                                price_raw=str(price_raw),
                                seller_wallet=(seller or '').lower(),
                                created_block_time=block_ts
                            ))
                        else:
                            # If we saw it before but missing some fields, patch them (defensive)
                            if not existing.domain_contract and domain_contract:
                                existing.domain_contract = domain_contract
                            if not existing.token_id and token_id is not None:
                                existing.token_id = str(token_id)
                            if not existing.price_raw and price_raw is not None:
                                existing.price_raw = str(price_raw)
                            if not existing.seller_wallet and seller:
                                existing.seller_wallet = seller.lower()
                    price_eth = None
                    if price_raw is not None:
                        price_eth = str(Decimal(price_raw) / Decimal(10**18))
                    record_audit_event(db, event_type='CHAIN_ORDER_CREATED', entity_type='MARKET_ORDER', entity_id=order_id, user_id=None, payload={
                        'order_id': order_id,
                        'seller': seller,
                        'domain_contract': domain_contract,
                        'token_id': token_id,
                        'price_raw': str(price_raw) if price_raw is not None else None,
                        'price_eth': price_eth,
                        'block_time': block_ts.isoformat()
                    })
                elif topic0 == TRADE_EXECUTED:
                    trade_id = int(topics[1],16) if len(topics) > 1 else None
                    buyer = '0x'+topics[2][-40:] if len(topics) > 2 else None
                    seller = '0x'+topics[3][-40:] if len(topics) > 3 else None
                    # Attempt naive value decode: last 32 bytes of data is price (uint256)
                    price = None
                    if data and len(data) >= 66:  # 0x + 64 hex chars
                        try:
                            price = int(data[-64:],16)
                        except Exception:
                            price = None
                    price_eth = None
                    if price is not None:
                        price_eth = str(Decimal(price) / Decimal(10**18))
                    # Domain attribution: prefer direct orderId match if tradeId maps to existing order (assuming tradeId == orderId semantics); else fallback heuristic
                    domain_contract = None
                    token_id = None
                    matched_order = None
                    # Direct map: if trade_id present and cached
                    if trade_id is not None:
                        cached = self.order_cache.get(trade_id)
                        if not cached:
                            # try persistent store
                            persistent = db.query(MarketplaceOrderCache).filter(MarketplaceOrderCache.order_id == trade_id).first()
                            if persistent:
                                cached = {
                                    'contract': persistent.domain_contract,
                                    'token_id': int(persistent.token_id) if persistent.token_id else 0,
                                    'price_raw': int(persistent.price_raw) if persistent.price_raw else None,
                                    'seller': (persistent.seller_wallet or '').lower()
                                }
                                # hydrate in-memory
                                self.order_cache[trade_id] = cached
                        if cached:
                            matched_order = cached
                            domain_contract = str(cached.get('contract') or '0x0')
                            try:
                                token_id = int(cached.get('token_id') or 0)
                            except Exception:
                                token_id = 0
                    # Heuristic fallback if still missing
                    if (domain_contract is None or token_id is None) and price is not None and seller:
                        sl = seller.lower()
                        for oid, meta in list(self.order_cache.items())[-50:]:
                            try:
                                if meta.get('price_raw') == price and sl == meta.get('seller'):
                                    matched_order = meta
                                    domain_contract = str(meta.get('contract'))
                                    token_id = int(meta.get('token_id') or 0)
                                    break
                            except Exception:
                                continue
                    # Mark order fulfilled in persistent store if we matched one and have trade_id
                    if matched_order and trade_id is not None:
                        oc = db.query(MarketplaceOrderCache).filter(MarketplaceOrderCache.order_id == trade_id).first()
                        if oc and not oc.fulfilled_tx_hash:
                            txh_tmp = getattr(getattr(lg,'transactionHash',''), 'hex', lambda: getattr(lg,'transactionHash',''))()
                            oc.fulfilled_tx_hash = txh_tmp
                            oc.fulfilled_block_time = block_ts
                    record_audit_event(db, event_type='CHAIN_TRADE_EXECUTED', entity_type='MARKET_TRADE', entity_id=trade_id, user_id=None, payload={
                        'trade_id': trade_id,
                        'buyer': buyer,
                        'seller': seller,
                        'domain_contract': domain_contract,
                        'token_id': token_id,
                        'price_raw': str(price) if price is not None else None,
                        'price_eth': price_eth,
                        'block_time': block_ts.isoformat()
                    })
                    # Enrich persistence: create Trade rows for buyer (BUY) and seller (SELL) participants active at block time
                    if buyer and seller and price is not None:
                        txh = getattr(getattr(lg,'transactionHash',''), 'hex', lambda: getattr(lg,'transactionHash',''))()
                        # Resolve users
                        buyer_user = db.query(User).filter(User.wallet_address.ilike(buyer)).first()
                        seller_user = db.query(User).filter(User.wallet_address.ilike(seller)).first()
                        # Determine active competitions at timestamp
                        active_comps = db.query(Competition.id).filter(Competition.start_time <= block_ts, Competition.end_time >= block_ts).all()
                        comp_ids = [c.id for c in active_comps]
                        def participant_rows(u: User | None):
                            if not u:
                                return []
                            q = db.query(Participant).filter(Participant.user_id==u.id)
                            if comp_ids:
                                q = q.filter(Participant.competition_id.in_(comp_ids))
                            return q.all()
                        buyer_parts = participant_rows(buyer_user)
                        seller_parts = participant_rows(seller_user)
                        # Insert trade records
                        norm_price = Decimal(price) / Decimal(10**18)
                        # Normalize to concrete types for type checker (avoid Optional unions)
                        safe_domain_contract: str = domain_contract if domain_contract else '0x0'
                        safe_token_id: int = token_id if token_id is not None else 0
                        for bp in buyer_parts:
                            db.add(Trade(participant_id=bp.id, domain_token_address=safe_domain_contract, domain_token_id=str(safe_token_id), trade_type='BUY', price=norm_price, tx_hash=txh, timestamp=block_ts))
                        for sp in seller_parts:
                            db.add(Trade(participant_id=sp.id, domain_token_address=safe_domain_contract, domain_token_id=str(safe_token_id), trade_type='SELL', price=norm_price, tx_hash=txh, timestamp=block_ts))
                else:
                    continue
            except Exception:
                logger.exception('[chain] marketplace log decode failed')
        db.flush()

    def run_once(self, db: Session):
        """Process up to max_batch_blocks new blocks; decode marketplace contract events (optional).

        Returns number of blocks processed. If web3 not initialized or no new blocks, returns 0.
        """
        # ensure_initialized lazily sets up web3; ignore type checker if it cannot infer
        if not blockchain_service.ensure_initialized():  # type: ignore[attr-defined]
            return 0
        web3 = blockchain_service.web3
        head = web3.eth.block_number  # type: ignore[attr-defined]

        state = self._get_state(db)
        start = state.last_block + 1
        if start > head:
            return 0
        end = min(head, start + self.max_batch_blocks - 1)
        processed = 0
        prior_parent = state.parent_hash
        for bn in range(start, end + 1):
            block = web3.eth.get_block(bn, full_transactions=False)  # type: ignore[attr-defined]
            # Reorg detection: parent hash mismatch triggers rewind
            if prior_parent and block.parentHash.hex() != prior_parent:  # type: ignore
                logger.warning(
                    "Reorg detected at block %s (expected parent %s got %s) - rewinding",
                    bn,
                    prior_parent,
                    block.parentHash.hex(),
                )
                rewind_to = max(0, bn - self.max_reorg_depth)
                self._update_state(db, state, rewind_to, None)
                return processed
            # Emit block heartbeat audit event
            record_audit_event(
                db,
                event_type='CHAIN_BLOCK_INGEST',
                entity_type='BLOCK',
                entity_id=bn,
                user_id=None,
                payload={
                    'hash': block.hash.hex(),  # type: ignore
                    'parent_hash': block.parentHash.hex(),  # type: ignore
                    'ts': datetime.fromtimestamp(block.timestamp, tz=timezone.utc).isoformat(),  # type: ignore
                },
            )
            # Fetch logs for this block (broad query) then filter (placeholder: none yet)
            try:
                logs = web3.eth.get_logs({'fromBlock': bn, 'toBlock': bn})  # type: ignore[attr-defined]
            except Exception:
                logs = []
            for lg in logs:
                try:
                    # Basic shape extraction; real filters would match contract / topics
                    rec = {
                        'address': getattr(lg, 'address', None),
                        'topics': [t.hex() if hasattr(t,'hex') else t for t in getattr(lg,'topics', [])],
                        'data': getattr(lg, 'data', None),
                        'blockNumber': getattr(lg, 'blockNumber', None),
                        'transactionHash': getattr(getattr(lg,'transactionHash',''), 'hex', lambda: getattr(lg,'transactionHash', ''))(),
                        'logIndex': getattr(lg, 'logIndex', None),
                    }
                    record_audit_event(
                        db,
                        event_type='CHAIN_LOG_INGEST',
                        entity_type='LOG',
                        entity_id=bn,
                        user_id=None,
                        payload=rec,
                    )
                except Exception:
                    logger.exception("[chain] failed to record log event for block %s", bn)
            # Marketplace event decoding after generic audit log ingestion
            try:
                self._maybe_decode_marketplace_events(db, logs, datetime.fromtimestamp(block.timestamp, tz=timezone.utc))  # type: ignore
            except Exception:
                logger.exception('[chain] marketplace decode batch failed')
            prior_parent = block.hash.hex()  # type: ignore
            processed += 1

        self._update_state(db, state, end, prior_parent)
        return processed

chain_ingest_service = ChainIngestService()
