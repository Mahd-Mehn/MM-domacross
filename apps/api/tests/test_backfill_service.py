import secrets
from datetime import datetime, timezone, timedelta
from app.database import SessionLocal
from app.models.database import Listing, Offer, ProcessedEvent
from app.services.backfill_service import backfill_service

def _mk_tx():
    return "0x" + secrets.token_hex(16)

def test_backfill_uses_processed_event_mapping():
    db = SessionLocal()
    txh = _mk_tx().lower()
    # Insert processed listing event with payload including orderId
    pe = ProcessedEvent(unique_id="u-"+secrets.token_hex(4), event_type="NAME_TOKEN_LISTED", payload={
        "txHash": txh,
        "orderId": "ORD-123",
    })
    db.add(pe)
    lst = Listing(domain_name="example.test", seller_wallet="0xabc", price=1, tx_hash=txh)
    db.add(lst)
    db.commit()
    res = backfill_service.run_once(lookback_minutes=10, limit=10)
    db.refresh(lst)
    assert lst.external_order_id == "ORD-123", res
    db.close()

def test_backfill_fallback_tx_hash_when_no_mapping():
    db = SessionLocal()
    txh = _mk_tx().lower()
    off = Offer(domain_name="fallback.test", buyer_wallet="0xdef", price=1, tx_hash=txh)
    db.add(off)
    db.commit()
    prev_runs = backfill_service.total_runs
    res = backfill_service.run_once(lookback_minutes=10, limit=10)
    db.refresh(off)
    assert off.external_order_id == txh, res
    assert backfill_service.total_runs == prev_runs + 1
    assert backfill_service.total_updated >= 1
    db.close()

def test_backfill_does_not_apply_fallback_for_old_entries():
    db = SessionLocal()
    txh = _mk_tx().lower()
    # Create an old listing (simulate by adjusting created_at manually after flush)
    lst = Listing(domain_name="old.test", seller_wallet="0xabc", price=1, tx_hash=txh)
    db.add(lst)
    db.commit()
    # Manually age it beyond threshold
    old_time = datetime.now(timezone.utc) - timedelta(hours=2)
    db.execute("UPDATE listings SET created_at = :t WHERE id = :id", {"t": old_time, "id": lst.id})
    db.commit()
    # Temporarily set threshold low to guarantee suppression
    orig_thresh = backfill_service.fallback_max_age_seconds
    backfill_service.fallback_max_age_seconds = 300  # 5 minutes
    res = backfill_service.run_once(lookback_minutes=300, limit=10)
    db.refresh(lst)
    assert lst.external_order_id is None, res
    backfill_service.fallback_max_age_seconds = orig_thresh
    db.close()
