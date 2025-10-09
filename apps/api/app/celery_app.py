"""Celery application configuration for DomaCross background tasks."""
from celery import Celery
from celery.schedules import crontab
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery(
    "domacross",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks"]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour hard limit
    task_soft_time_limit=3300,  # 55 minutes soft limit
    worker_prefetch_multiplier=1,  # Fetch one task at a time
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks to prevent memory leaks
    broker_connection_retry_on_startup=True,
    result_expires=86400,  # Results expire after 24 hours
)

# Celery Beat schedule - periodic tasks
celery_app.conf.beat_schedule = {
    # Doma Poll Service - every 6 hours (4x daily)
    "poll-doma-events": {
        "task": "app.tasks.poll_doma_events",
        "schedule": 21600.0,  # 6 hours in seconds
        "options": {"expires": 21000},  # Expire if not run within interval
    },
    # Orderbook Snapshot - every 6 hours (4x daily)
    "snapshot-orderbook": {
        "task": "app.tasks.snapshot_orderbook",
        "schedule": 21600.0,  # 6 hours in seconds
        "options": {"expires": 21000},
    },
    # Reconciliation Service - every 6 hours (4x daily)
    "reconcile-orderbook": {
        "task": "app.tasks.reconcile_orderbook",
        "schedule": 21600.0,  # 6 hours in seconds
        "options": {"expires": 21000},
    },
    # NAV Calculations - every 6 hours (4x daily)
    "calculate-nav": {
        "task": "app.tasks.calculate_nav",
        "schedule": 21600.0,  # 6 hours in seconds
        "options": {"expires": 21000},
    },
    # Snapshot Service - every 6 hours (4x daily)
    "snapshot-etf": {
        "task": "app.tasks.snapshot_etf",
        "schedule": 21600.0,  # 6 hours in seconds
        "options": {"expires": 21000},
    },
    # Backfill Service - every 6 hours (4x daily)
    "backfill-external-order-ids": {
        "task": "app.tasks.backfill_external_order_ids",
        "schedule": 21600.0,  # 6 hours in seconds
        "options": {"expires": 21000},
    },
    # Merkle Service - every 6 hours (4x daily)
    "merkle-snapshot": {
        "task": "app.tasks.merkle_snapshot",
        "schedule": 21600.0,  # 6 hours in seconds
        "options": {"expires": 21000},
    },
    # Chain Ingest - every 30 seconds (if enabled)
    "ingest-chain-events": {
        "task": "app.tasks.ingest_chain_events",
        "schedule": 30.0,  # 30 seconds
        "options": {"expires": 25},
    },
    # Incentive Distribution - every 6 hours (4x daily)
    "distribute-incentives": {
        "task": "app.tasks.distribute_incentives",
        "schedule": 21600.0,  # 6 hours in seconds
        "options": {"expires": 21000},
    },
    # DomaRank Oracle - configurable interval (default 6 hours)
    "update-doma-rank-valuations": {
        "task": "app.tasks.update_doma_rank_valuations",
        "schedule": float(settings.doma_rank_update_interval_seconds),
        "options": {"expires": settings.doma_rank_update_interval_seconds - 60},
    },
}

logger.info("[celery] Celery app configured with Redis broker: %s", settings.redis_url)
