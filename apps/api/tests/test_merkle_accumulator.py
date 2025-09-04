from app.services.merkle_service import merkle_service
from app.models.database import AuditEvent, MerkleAccumulator
from hashlib import sha256
import json

def test_accumulator_multiple_carries(db_session):
    # Insert events such that multiple carries happen (e.g., 5 events -> levels combine repeatedly)
    for i in range(5):
        db_session.add(AuditEvent(event_type='TEST', entity_type='X', entity_id=None, user_id=None, payload={'i': i}))
    db_session.commit()
    snap = merkle_service.snapshot_incremental(db_session)
    assert snap is not None
    # Add 3 more to trigger further carries (total 8 -> full binary tree up to level 3)
    for i in range(5,8):
        db_session.add(AuditEvent(event_type='TEST', entity_type='X', entity_id=None, user_id=None, payload={'i': i}))
    db_session.commit()
    snap2 = merkle_service.snapshot_incremental(db_session)
    assert snap2 is not None
    # Ensure accumulator has at most log2(n) entries
    acc_levels = db_session.query(MerkleAccumulator).all()
    assert len(acc_levels) <= 4  # log2(8)=3, allow 4 for transient states
    assert snap2.event_count == 8

def test_full_recompute_matches_accumulator(db_session):
    # create 10 events
    for i in range(10):
        db_session.add(AuditEvent(event_type='R', entity_type='Z', entity_id=None, user_id=None, payload={'i': i}))
    db_session.commit()
    snap = merkle_service.snapshot_incremental(db_session)
    # Add 6 more then snapshot again
    for i in range(10,16):
        db_session.add(AuditEvent(event_type='R', entity_type='Z', entity_id=None, user_id=None, payload={'i': i}))
    db_session.commit()
    snap2 = merkle_service.snapshot_incremental(db_session)
    # Full recompute root
    events = db_session.query(AuditEvent).order_by(AuditEvent.id.asc()).all()
    def hash_leaf(obj):
        return sha256(json.dumps(obj, sort_keys=True, separators=(',',':')).encode()).digest()
    leaves = [hash_leaf({'id': e.id,'t': e.event_type,'e': e.entity_type,'eid': e.entity_id,'u': e.user_id,'p': e.payload}) for e in events]
    def build(leaves_bytes):
        if not leaves_bytes:
            return b'\x00'*32
        layer = leaves_bytes
        while len(layer) > 1:
            nxt = []
            for i in range(0,len(layer),2):
                l = layer[i]
                r = layer[i+1] if i+1 < len(layer) else layer[i]
                nxt.append(sha256(l+r).digest())
            layer = nxt
        return layer[0]
    full_root = '0x'+build(leaves).hex()
    assert snap2.merkle_root == full_root
