import threading
import time
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.merkle_service import merkle_service
from app.models.database import AuditEvent
from app.services.blockchain_service import blockchain_service

# Simple background scheduler (in-process). For production: move to dedicated worker.
class Scheduler:
    def __init__(self, interval_seconds: int = 60):
        self.interval = interval_seconds
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_snapshot_at: datetime | None = None
        self.snapshot_period_seconds = 300  # every 5 minutes
        self.last_chain_ingest_at: datetime | None = None
        self.chain_ingest_period_seconds = 30  # poll blockchain every 30s
        self.last_block_checked: int | None = None

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, name="scheduler", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    def _run(self):
        while not self._stop.is_set():
            try:
                now = datetime.utcnow()
                # Periodic Merkle snapshot
                if (self.last_snapshot_at is None) or (now - self.last_snapshot_at >= timedelta(seconds=self.snapshot_period_seconds)):
                    with SessionLocal() as db:
                        created = merkle_service.snapshot_incremental(db)
                        if created:
                            self.last_snapshot_at = now
                # Periodic blockchain poll ingestion (basic): record block height progress
                if (self.last_chain_ingest_at is None) or (now - self.last_chain_ingest_at >= timedelta(seconds=self.chain_ingest_period_seconds)):
                    if blockchain_service.ensure_initialized():
                        with SessionLocal() as db:
                            try:
                                w3 = blockchain_service.web3
                                if w3:
                                    latest_block = w3.eth.block_number
                                    if self.last_block_checked is None or latest_block > self.last_block_checked:
                                        payload = {'from_block': (self.last_block_checked or latest_block), 'to_block': latest_block}
                                        db.add(AuditEvent(event_type='CHAIN_BLOCK_SYNC', entity_type='CHAIN', entity_id=None, user_id=None, payload=payload))
                                        self.last_block_checked = latest_block
                                        db.commit()
                            except Exception:
                                pass
                    self.last_chain_ingest_at = now
            except Exception:
                pass
            time.sleep(self.interval)

scheduler = Scheduler(interval_seconds=5)
