import json
from hashlib import sha256
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.database import AuditEvent, MerkleSnapshot, MerkleAccumulator
from app.services.blockchain_service import blockchain_service
from app.config import settings
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization


def _hash_leaf(obj: Dict[str, Any]) -> bytes:
    return sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()).digest()


def _build_merkle(leaves: List[bytes]) -> bytes:
    if not leaves:
        return b"\x00" * 32
    layer = leaves
    while len(layer) > 1:
        nxt: List[bytes] = []
        for i in range(0, len(layer), 2):
            left = layer[i]
            right = layer[i + 1] if i + 1 < len(layer) else left
            nxt.append(sha256(left + right).digest())
        layer = nxt
    return layer[0]


class MerkleService:
    """Service for incremental Merkle snapshot creation using an accumulator.

    Accumulator: stores one hash per level representing combined hash of all
    leaves processed so far at that level (similar to a binary prefix tree).
    New leaves update the accumulator in O(log n). Snapshot root is computed
    by folding non-empty level nodes from lowest to highest.
    """

    def latest(self, db: Session) -> Optional[MerkleSnapshot]:
        return db.query(MerkleSnapshot).order_by(MerkleSnapshot.id.desc()).first()

    def _load_private_key(self) -> Optional[bytes]:
        if not settings.jwt_private_key_b64:
            return None
        try:
            return base64.b64decode(settings.jwt_private_key_b64)
        except Exception:
            return None

    def _sign(self, root_hex: str) -> Optional[str]:
        pem = self._load_private_key()
        if not pem:
            return None
        try:
            key = serialization.load_pem_private_key(pem, password=None)
            sig = key.sign(root_hex.encode(), padding.PKCS1v15(), hashes.SHA256())
            return base64.b64encode(sig).decode()
        except Exception:
            return None

    def _update_accumulator(self, db: Session, leaf: bytes):
        curr = leaf
        level = 0
        while True:
            node = db.query(MerkleAccumulator).filter(MerkleAccumulator.level == level).first()
            if node is None:
                db.add(MerkleAccumulator(level=level, node_hash='0x'+curr.hex()))
                break
            else:
                existing = bytes.fromhex(node.node_hash[2:])
                # combine and clear this level (simulate carry)
                curr = sha256(existing + curr).digest()
                db.delete(node)
                level += 1
                continue

    def _compute_root_from_accumulator(self, db: Session) -> str:
        levels = db.query(MerkleAccumulator).order_by(MerkleAccumulator.level.asc()).all()
        hashes = []
        for node in levels:
            h = bytes.fromhex(node.node_hash[2:])
            hashes.append(h)
        if not hashes:
            return '0x' + ('00'*32)
        # fold from lowest to highest
        root = hashes[0]
        for h in hashes[1:]:
            root = sha256(root + h).digest()
        return '0x'+root.hex()

    def snapshot_incremental(self, db: Session) -> Optional[MerkleSnapshot]:
        last = self.latest(db)
        # Determine new events
        q = db.query(AuditEvent).order_by(AuditEvent.id.asc())
        if last:
            events = q.filter(AuditEvent.id > last.last_event_id).all()
        else:
            events = q.all()
        if not events:
            return None
        for r in events:
            leaf = _hash_leaf({"id": r.id, "t": r.event_type, "e": r.entity_type, "eid": r.entity_id, "u": r.user_id, "p": r.payload})
            self._update_accumulator(db, leaf)
        # root from accumulator
        root = self._compute_root_from_accumulator(db)
        total_events = q.count()
        snap = MerkleSnapshot(last_event_id=events[-1].id, merkle_root=root, event_count=total_events)
        # Sign
        sig = self._sign(root)
        if sig:
            snap.signature = sig
        # Anchor placeholder: store none (future on-chain tx hash after broadcast)
        db.add(snap)
        db.commit()
        db.refresh(snap)
        # Attempt on-chain anchoring (async call simplified synchronously if possible)
        try:
            if blockchain_service.ensure_initialized():
                # Since anchor_merkle_root is async, schedule simple loop run
                import asyncio
                async def _anchor():
                    tx = await blockchain_service.anchor_merkle_root(root)
                    if tx:
                        snap.anchor_tx_hash = tx
                        db.add(snap)
                        db.commit()
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(_anchor())
                except RuntimeError:
                    # no running loop, run inline
                    asyncio.run(_anchor())
        except Exception:
            pass
        return snap

    def compute_proof_path(self, db: Session, audit_event_id: int) -> dict:
        events = db.query(AuditEvent).order_by(AuditEvent.id.asc()).all()
        if not events:
            return {"error": "no events"}
        leaves = [
            _hash_leaf(
                {
                    "id": r.id,
                    "t": r.event_type,
                    "e": r.entity_type,
                    "eid": r.entity_id,
                    "u": r.user_id,
                    "p": r.payload,
                }
            )
            for r in events
        ]
        # index lookup
        index_map = {r.id: i for i, r in enumerate(events)}
        if audit_event_id not in index_map:
            return {"error": "event not found"}
        idx = index_map[audit_event_id]
        path: list[str] = []
        # Build layers retaining order to compute sibling path
        layer = leaves
        while len(layer) > 1:
            is_right = idx % 2 == 1
            sibling_index = idx - 1 if is_right else idx + 1
            if sibling_index >= len(layer):
                sibling_index = idx  # duplicate if no sibling
            sibling = layer[sibling_index]
            path.append("0x" + sibling.hex())
            # Next layer index
            idx = idx // 2
            nxt: list[bytes] = []
            for i in range(0, len(layer), 2):
                left = layer[i]
                right = layer[i + 1] if i + 1 < len(layer) else left
                nxt.append(sha256(left + right).digest())
            layer = nxt
        root = "0x" + layer[0].hex()
        return {"event_id": audit_event_id, "merkle_root": root, "path": path, "position": index_map[audit_event_id]}


merkle_service = MerkleService()
