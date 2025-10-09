"""Celery tasks for DomaCross background processing."""
import logging
from celery import Task
from app.celery_app import celery_app
from app.config import settings
from app.database import SessionLocal
from decimal import Decimal
import asyncio

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Base task that provides database session management."""
    
    def __call__(self, *args, **kwargs):
        """Execute task with database session cleanup."""
        try:
            return self.run(*args, **kwargs)
        except Exception as exc:
            logger.exception(f"Task {self.name} failed")
            raise exc


def run_async(coro):
    """Helper to run async functions in sync Celery tasks."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.poll_doma_events")
def poll_doma_events(self):
    """Poll Doma events from the Doma Poll API."""
    if not settings.enable_background_polling or not settings.doma_poll_base_url or not settings.doma_poll_api_key:
        logger.info("[poll] Background polling disabled, skipping")
        return {"status": "disabled"}
    
    try:
        from app.services.doma_poll_service import doma_poll_service
        logger.info("[poll] Starting Doma event polling")
        stats = run_async(doma_poll_service.run_once(limit=50))
        logger.info("[poll] Completed: %s", stats)
        return {"status": "success", "stats": stats}
    except Exception as e:
        logger.exception("[poll] Failed to poll Doma events")
        raise self.retry(exc=e, countdown=300, max_retries=3)


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.snapshot_orderbook")
def snapshot_orderbook(self):
    """Snapshot orderbook data for active domains."""
    if not settings.enable_orderbook_snapshots or not settings.doma_orderbook_base_url:
        logger.info("[orderbook] Orderbook snapshots disabled, skipping")
        return {"status": "disabled"}
    
    db = SessionLocal()
    try:
        from app.services.orderbook_snapshot_service import orderbook_snapshot_service
        from app.services.doma_subgraph_service import doma_subgraph_service
        
        logger.info("[orderbook] Starting orderbook snapshot")
        
        # Get active domains from subgraph
        try:
            active_domains = run_async(doma_subgraph_service.get_active_domains(limit=50))
            domain_names = [d['name'] for d in active_domains]
        except Exception:
            logger.exception("[orderbook] Failed to fetch active domains, using fallback")
            domain_names = []
        
        # Fallback to recent domains from database
        if not domain_names:
            try:
                from app.models.database import Domain
                domain_names = [d.name for d in db.query(Domain).order_by(Domain.first_seen_at.desc()).limit(10)]
            except Exception:
                domain_names = []
        
        if domain_names:
            run_async(orderbook_snapshot_service.snapshot_once(db, domain_names))
            logger.info("[orderbook] Snapshot completed for %d domains", len(domain_names))
            return {"status": "success", "domains": len(domain_names)}
        else:
            logger.warning("[orderbook] No domains to snapshot")
            return {"status": "success", "domains": 0}
    except Exception as e:
        logger.exception("[orderbook] Failed to snapshot orderbook")
        raise self.retry(exc=e, countdown=300, max_retries=3)
    finally:
        db.close()


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.reconcile_orderbook")
def reconcile_orderbook(self):
    """Reconcile orderbook data with on-chain state."""
    if not settings.enable_reconciliation or not settings.doma_orderbook_base_url:
        logger.info("[reconcile] Reconciliation disabled, skipping")
        return {"status": "disabled"}
    
    try:
        from app.services.reconciliation_service import reconciliation_service
        logger.info("[reconcile] Starting reconciliation")
        run_async(reconciliation_service.run_once(limit=300))
        logger.info("[reconcile] Reconciliation completed")
        return {"status": "success"}
    except Exception as e:
        logger.exception("[reconcile] Failed to reconcile orderbook")
        raise self.retry(exc=e, countdown=300, max_retries=3)


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.calculate_nav")
def calculate_nav(self):
    """Calculate NAV for ETFs and record metrics."""
    if not settings.enable_nav_calculations:
        logger.info("[nav] NAV calculations disabled, skipping")
        return {"status": "disabled"}
    
    db = SessionLocal()
    try:
        from app.services.nav_service import nav_service
        from app.services.snapshot_service import snapshot_service
        from app.services.abuse_guard import abuse_guard
        from app.models.database import Domain
        from sqlalchemy import func as _f
        
        logger.info("[nav] Starting NAV calculation")
        nav_service.run_once(stale_seconds=600)
        
        # Take snapshot after NAV calculation
        snapshot_service.snapshot_once()
        
        # Record NAV metric for circuit breaker
        try:
            avg_val = db.query(_f.avg(Domain.last_estimated_value)).scalar()
            if avg_val:
                abuse_guard.record_nav(Decimal(avg_val))
        except Exception:
            logger.exception("[nav] Failed to record NAV metric")
        
        # Broadcast NAV update event
        try:
            from app.broadcast import broadcast_event
            run_async(broadcast_event({"type": "nav_update"}))
        except Exception:
            logger.exception("[nav] Failed to broadcast NAV update")
        
        logger.info("[nav] NAV calculation completed")
        return {"status": "success"}
    except Exception as e:
        logger.exception("[nav] Failed to calculate NAV")
        raise self.retry(exc=e, countdown=300, max_retries=3)
    finally:
        db.close()


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.snapshot_etf")
def snapshot_etf(self):
    """Take ETF snapshot with valuation drift simulation."""
    if not settings.enable_nav_calculations:
        logger.info("[snapshot] ETF snapshots disabled, skipping")
        return {"status": "disabled"}
    
    db = SessionLocal()
    try:
        from app.services.snapshot_service import snapshot_service
        from app.models.database import Domain
        
        logger.info("[snapshot] Starting ETF snapshot")
        snapshot_service.snapshot_once()
        
        # Valuation drift simulation (placeholder)
        domains = db.query(Domain).limit(50).all()
        for d in domains:
            base = Decimal(d.last_estimated_value or 100)
            # +/- up to 1% pseudo-random based on name hash
            delta_seed = (hash(d.name) + int(asyncio.get_event_loop().time())) % 200 - 100
            adj = Decimal(delta_seed) / Decimal(10000)
            new_val = base * (Decimal(1) + adj)
            d.last_estimated_value = new_val
        db.commit()
        
        logger.info("[snapshot] ETF snapshot completed")
        return {"status": "success", "domains_updated": len(domains)}
    except Exception as e:
        logger.exception("[snapshot] Failed to take ETF snapshot")
        db.rollback()
        raise self.retry(exc=e, countdown=300, max_retries=3)
    finally:
        db.close()


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.backfill_external_order_ids")
def backfill_external_order_ids(self):
    """Backfill external order IDs for listings/offers."""
    if not settings.enable_backfill_service:
        logger.info("[backfill] Backfill service disabled, skipping")
        return {"status": "disabled"}
    
    try:
        from app.services.backfill_service import backfill_service
        logger.info("[backfill] Starting external order ID backfill")
        result = run_async(backfill_service.run_once(lookback_minutes=24*60, limit=200))
        if result.get("updated"):
            logger.info("[backfill] Updated %d records", result.get("updated"))
        return {"status": "success", "updated": result.get("updated", 0)}
    except Exception as e:
        logger.exception("[backfill] Failed to backfill external order IDs")
        raise self.retry(exc=e, countdown=300, max_retries=3)


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.merkle_snapshot")
def merkle_snapshot(self):
    """Create incremental Merkle tree snapshot."""
    if not settings.enable_merkle_service:
        logger.info("[merkle] Merkle service disabled, skipping")
        return {"status": "disabled"}
    
    db = SessionLocal()
    try:
        from app.services.merkle_service import merkle_service
        logger.info("[merkle] Starting Merkle snapshot")
        snap = merkle_service.snapshot_incremental(db)
        if snap:
            logger.info("[merkle] New snapshot root=%s events=%s", snap.merkle_root, snap.event_count)
            return {"status": "success", "root": snap.merkle_root, "events": snap.event_count}
        return {"status": "success", "root": None}
    except Exception as e:
        logger.exception("[merkle] Failed to create Merkle snapshot")
        db.rollback()
        raise self.retry(exc=e, countdown=300, max_retries=3)
    finally:
        db.close()


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.ingest_chain_events")
def ingest_chain_events(self):
    """Ingest raw chain events (if enabled)."""
    if not settings.enable_raw_chain_ingest:
        logger.debug("[chain] Chain ingest disabled, skipping")
        return {"status": "disabled"}
    
    db = SessionLocal()
    try:
        from app.services.chain_ingest_service import chain_ingest_service
        processed = chain_ingest_service.run_once(db)
        if processed:
            logger.info("[chain] Processed %s blocks", processed)
            return {"status": "success", "blocks": processed}
        return {"status": "success", "blocks": 0}
    except Exception as e:
        logger.exception("[chain] Failed to ingest chain events")
        raise self.retry(exc=e, countdown=60, max_retries=5)
    finally:
        db.close()


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.distribute_incentives")
def distribute_incentives(self):
    """Distribute incentives and finalize epochs."""
    db = SessionLocal()
    try:
        from app.services.incentive_service import incentive_service
        if not incentive_service:
            logger.info("[incentive] Incentive service not available, skipping")
            return {"status": "disabled"}
        
        logger.info("[incentive] Starting incentive distribution")
        finalized = incentive_service.run_once(db)
        if finalized:
            logger.info("[incentive] Finalized %d epochs", finalized)
        return {"status": "success", "finalized": finalized or 0}
    except Exception as e:
        logger.exception("[incentive] Failed to distribute incentives")
        raise self.retry(exc=e, countdown=300, max_retries=3)
    finally:
        db.close()


@celery_app.task(base=DatabaseTask, bind=True, name="app.tasks.update_doma_rank_valuations")
def update_doma_rank_valuations(self):
    """Update DomaRank Oracle valuations for fractional tokens."""
    if not settings.enable_doma_rank_oracle or not settings.doma_subgraph_url:
        logger.info("[doma-rank] DomaRank Oracle disabled, skipping")
        return {"status": "disabled"}
    
    try:
        from app.services.doma_rank_oracle_service import doma_rank_oracle_service
        from app.services.doma_subgraph_service import doma_subgraph_service
        
        logger.info("[doma-rank] Starting DomaRank valuation update")
        
        # First sync fractional tokens from subgraph
        run_async(doma_subgraph_service.sync_fractional_tokens_to_db())
        
        # Then update valuations
        stats = run_async(doma_rank_oracle_service.update_all_fractional_token_valuations())
        logger.info("[doma-rank] Valuation update completed: %s", stats)
        return {"status": "success", "stats": stats}
    except Exception as e:
        logger.exception("[doma-rank] Failed to update DomaRank valuations")
        raise self.retry(exc=e, countdown=300, max_retries=3)
