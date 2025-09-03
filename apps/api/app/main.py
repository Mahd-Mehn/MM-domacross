from fastapi import FastAPI, WebSocket
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from .routers import health, auth, competitions, users, portfolio, poll, domains, valuation, market, etf
import logging
from typing import List
import asyncio
from app.services.blockchain_service import blockchain_service
from app.services.doma_poll_service import doma_poll_service
from app.services.orderbook_snapshot_service import orderbook_snapshot_service
from app.services.reconciliation_service import reconciliation_service
from app.services.nav_service import nav_service
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bg_task: asyncio.Task | None = None

@asynccontextmanager
async def lifespan(app_: FastAPI):
    # Startup
    if blockchain_service.web3:
        logger.info("[startup] Blockchain service initialized (web3 ready)")
    else:
        logger.info("[startup] Blockchain service deferred (no web3)")
    # Optionally start background poller
    async def poll_loop():
        interval = 10
        logger.info("[poll] background poller started interval=%ss", interval)
        while True:
            try:
                await doma_poll_service.run_once(limit=50)
            except Exception:
                logger.exception("[poll] run_once failed")
            await asyncio.sleep(interval)

    async def orderbook_loop():
        if not settings.doma_orderbook_base_url:
            return
        interval = settings.orderbook_snapshot_interval_seconds
        logger.info("[orderbook] snapshot loop started interval=%ss", interval)
        from app.database import SessionLocal  # local import to avoid cycles
        while True:
            try:
                db = SessionLocal()
                # choose domains with recent events / valuations
                from app.models.database import Domain
                names = [r[0] for r in db.query(Domain.name).order_by(Domain.last_seen_event_at.desc()).limit(20).all()]
                if names:
                    await orderbook_snapshot_service.snapshot_once(db, names)
            except Exception:
                logger.exception("[orderbook] snapshot failed")
            finally:
                try:
                    db.close()
                except Exception:
                    pass
            await asyncio.sleep(interval)

    async def reconcile_loop():
        if not settings.doma_orderbook_base_url:
            return
        interval = max(180, settings.orderbook_snapshot_interval_seconds * 3)
        logger.info("[reconcile] loop started interval=%ss", interval)
        while True:
            try:
                await reconciliation_service.run_once(limit=300)
            except Exception:
                logger.exception("[reconcile] run failed")
            await asyncio.sleep(interval)

    async def nav_loop():
        interval = 300  # 5 minutes default NAV refresh for stale sets
        logger.info("[nav] loop started interval=%ss", interval)
        while True:
            try:
                nav_service.run_once(stale_seconds=600)
            except Exception:
                logger.exception("[nav] run failed")
            await asyncio.sleep(interval)

    global bg_task
    loop_tasks: list[asyncio.Task] = []
    if settings.doma_poll_base_url and settings.doma_poll_api_key and settings.app_env != "test":
        loop_tasks.append(asyncio.create_task(poll_loop()))
    if settings.doma_orderbook_base_url and settings.app_env != "test":
        loop_tasks.append(asyncio.create_task(orderbook_loop()))
        loop_tasks.append(asyncio.create_task(reconcile_loop()))
    # NAV loop independent of external APIs
    if settings.app_env != "test":
        loop_tasks.append(asyncio.create_task(nav_loop()))
    if loop_tasks:
        # keep reference to first for shutdown; others tracked in list
        bg_task = loop_tasks[0]
        app_.state._bg_tasks = loop_tasks
    yield
    # Shutdown
    try:
        await doma_poll_service.close()
    except Exception:
        logger.exception("Error closing Doma Poll service client")
    if hasattr(app_, 'state') and hasattr(app_.state, '_bg_tasks'):
        for t in app_.state._bg_tasks:
            t.cancel()
        for t in app_.state._bg_tasks:
            try:
                await t
            except Exception:
                pass
    logger.info("[shutdown] API shutting down")

app = FastAPI(title="DomaCross API", version="0.1.0", lifespan=lifespan)

# WebSocket connections
websocket_connections: List[WebSocket] = []

# Basic CORS for local dev web app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(competitions.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")
app.include_router(poll.router, prefix="/api/v1")
app.include_router(domains.router, prefix="/api/v1")
app.include_router(valuation.router, prefix="/api/v1")
app.include_router(market.router, prefix="/api/v1")
app.include_router(etf.router, prefix="/api/v1")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages
            await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        websocket_connections.remove(websocket)

@app.get("/")
def root():
    logger.info("Root endpoint accessed")
    return {"service": "domacross-api", "status": "ok"}

@app.get("/metrics")
def metrics():
    # Basic Prometheus-style exposition without external lib
    lines = []
    from app.services.doma_poll_service import doma_poll_service as dps
    # Access attributes defensively to satisfy type checkers in minimalist env
    last_poll_time = getattr(dps, "last_poll_time", None)
    last_event_time = getattr(dps, "last_event_time", None)
    total_events_processed = getattr(dps, "total_events_processed", None)
    if last_poll_time:
        try:
            lines.append(f"doma_last_poll_timestamp {int(last_poll_time.timestamp())}")
        except Exception:
            pass
    if last_event_time:
        try:
            lines.append(f"doma_last_event_timestamp {int(last_event_time.timestamp())}")
        except Exception:
            pass
    if total_events_processed is not None:
        lines.append(f"doma_events_processed_total {total_events_processed}")
    # Snapshot metrics require quick DB count (lightweight)
    try:
        from app.database import SessionLocal
        from app.models.database import OrderbookSnapshot, Valuation, Listing, Offer, Domain, DomainETF
        from app.services.reconciliation_service import reconciliation_service as rs
        from app.services.nav_service import nav_service as ns
        session = SessionLocal()
        try:
            lines.append(f"orderbook_snapshots_total {session.query(OrderbookSnapshot).count()}")
            lines.append(f"valuations_total {session.query(Valuation).count()}")
            lines.append(f"listings_total {session.query(Listing).count()}")
            lines.append(f"offers_total {session.query(Offer).count()}")
            lines.append(f"domains_total {session.query(Domain).count()}")
            if rs.last_run:
                lines.append(f"reconciliation_last_run {int(rs.last_run.timestamp())}")
            if ns.last_run:
                lines.append(f"nav_last_run {int(ns.last_run.timestamp())}")
            lines.append(f"nav_total_recomputes {ns.total_recomputes}")
            now_ts = int(__import__('time').time())
            for eid, nav_ts in session.query(DomainETF.id, DomainETF.nav_updated_at).all():
                if nav_ts:
                    age = max(0, now_ts - int(nav_ts.timestamp()))
                    lines.append(f"etf_nav_age_seconds{{etf_id=\"{eid}\"}} {age}")
        finally:
            session.close()
    except Exception:
        lines.append("metrics_collection_error 1")
    return "\n".join(lines) + "\n"
