from fastapi import FastAPI, WebSocket
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from .routers import health, auth, competitions, users, portfolio, poll, domains, valuation, market, etf, seasons
import logging
from typing import List
import asyncio
from app.services.blockchain_service import blockchain_service
from app.services.doma_poll_service import doma_poll_service
from app.services.orderbook_snapshot_service import orderbook_snapshot_service
from app.services.reconciliation_service import reconciliation_service
from app.services.nav_service import nav_service
from app.services.snapshot_service import snapshot_service
from app.config import settings
from app.database import SessionLocal
from app.models.database import Domain
from decimal import Decimal

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
                # choose domains with recent activity (valuations or trades) simple heuristic: last_estimated_value not null order by first_seen desc
                from app.models.database import Domain, Trade
                recent_domains = [d.name for d in db.query(Domain).filter(Domain.last_estimated_value != None).order_by(Domain.first_seen_at.desc()).limit(25)]  # noqa: E711
                if not recent_domains:
                    recent_domains = [d.name for d in db.query(Domain).order_by(Domain.first_seen_at.desc()).limit(10)]
                await orderbook_snapshot_service.snapshot_once(db, recent_domains)
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
                # After NAV recompute, take a lightweight snapshot (per-share history) less frequently (every run here)
                snapshot_service.snapshot_once()
                # Broadcast minimal nav update event
                await broadcast_event({"type": "nav_update"})
            except Exception:
                logger.exception("[nav] run failed")
            await asyncio.sleep(interval)

    async def fast_snapshot_loop():
        interval = 60  # 1 minute for portfolio value & nav per-share snapshots
        logger.info("[snapshot] loop started interval=%ss", interval)
        while True:
            try:
                snapshot_service.snapshot_once()
                # Simple valuation drift simulation (placeholder until real model): decay or nudge last_estimated_value
                db = SessionLocal()
                domains = db.query(Domain).limit(50).all()
                for d in domains:
                    base = Decimal(d.last_estimated_value or 100)
                    # +/- up to 1% pseudo-random based on name hash
                    delta_seed = (hash(d.name) + int(asyncio.get_running_loop().time())) % 200 - 100
                    adj = Decimal(delta_seed) / Decimal(10000)
                    new_val = base * (Decimal(1) + adj)
                    d.last_estimated_value = new_val
                db.commit()
                db.close()
            except Exception:
                logger.exception("[snapshot] run failed")
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
        loop_tasks.append(asyncio.create_task(fast_snapshot_loop()))
    if loop_tasks:
        # keep reference to first for shutdown; others tracked in list
        bg_task = loop_tasks[0]
    setattr(app_.state, '_bg_tasks', loop_tasks)
    yield
    # Shutdown
    try:
        await doma_poll_service.close()
    except Exception:
        logger.exception("Error closing Doma Poll service client")
    bg_list = getattr(app_.state, '_bg_tasks', [])
    for t in bg_list:
            t.cancel()
    for t in bg_list:
            try:
                await t
            except Exception:
                pass
    logger.info("[shutdown] API shutting down")

app = FastAPI(title="DomaCross API", version="0.1.0", lifespan=lifespan)

from .broadcast import websocket_connections, set_connection_filter, broadcast_event

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
app.include_router(seasons.router, prefix="/api/v1")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, events: str | None = None):
    await websocket.accept()
    websocket_connections.append(websocket)
    if events:
        requested = [e.strip() for e in events.split(',') if e.strip()]
        if requested:
            set_connection_filter(websocket, requested)
    try:
        while True:
            data = await websocket.receive_text()
            if data.startswith('SUB '):
                evs = [e.strip() for e in data[4:].split(',') if e.strip()]
                set_connection_filter(websocket, evs)
                await websocket.send_json({'type': 'subscribed', 'events': evs})
            elif data.startswith('UNSUB'):
                set_connection_filter(websocket, None)
                await websocket.send_json({'type': 'unsubscribed'})
            else:
                await websocket.send_json({'type': 'echo', 'data': data})
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        try:
            websocket_connections.remove(websocket)
        except ValueError:
            pass
        set_connection_filter(websocket, None)

@app.get('/events/schema')
def events_schema():
    return {
        'version': 1,
        'events': {
            'trade': {'desc': 'A trade event', 'fields': ['domain','price','side']},
            'nav_update': {'desc': 'ETF NAV(s) recomputed', 'fields': []},
            'leaderboard_delta': {'desc': 'Leaderboard change', 'fields': ['competition_id','user_id','portfolio_value','rank']},
            'risk_flag': {'desc': 'Trade risk flag', 'fields': ['trade_id','flag_type']},
            'epoch_distributed': {'desc': 'Epoch rewards distributed', 'fields': ['competition_id','epoch_index']},
            'subscribed': {'desc': 'Ack for subscription', 'fields': ['events']},
            'unsubscribed': {'desc': 'Ack for unsubscribe', 'fields': []},
        }
    }

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
    # Orderbook & valuation counters
    try:
        from app.services.orderbook_snapshot_service import orderbook_snapshot_service as oss
        lines.append(f"orderbook_requests_total {oss.total_requests}")
        lines.append(f"orderbook_failures_total {oss.total_failures}")
        lines.append(f"orderbook_snapshots_total {oss.total_snapshots}")
    except Exception:
        pass
    try:
        from app.services.valuation_service import valuation_service as vs
        lines.append(f"valuation_batches_total {vs.total_batches}")
        lines.append(f"valuation_records_total {vs.total_valuations}")
    except Exception:
        pass
    return "\n".join(lines) + "\n"
