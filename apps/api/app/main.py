import re
from fastapi import FastAPI, WebSocket
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from .routers import health, auth, competitions, users, portfolio, poll, domains, valuation, market, etf, seasons, settlement, incentives, policy, orderfeed, defi, marketplace, debug
from .routers import prize_escrow, baskets, governance, doma_fractional, sync_status
try:
    from app.services.incentive_service import incentive_service  # type: ignore
except Exception:  # pragma: no cover
    incentive_service = None  # type: ignore
import logging
from typing import List
import asyncio
try:
    from app.services.blockchain_service import blockchain_service  # type: ignore
except Exception: blockchain_service = type('x',(),{'web3':None})()  # type: ignore
try:
    from app.services.doma_poll_service import doma_poll_service  # type: ignore
except Exception: doma_poll_service = type('x',(),{})()  # type: ignore
try:
    from app.services.orderbook_snapshot_service import orderbook_snapshot_service  # type: ignore
except Exception: orderbook_snapshot_service = type('x',(),{})()  # type: ignore
try:
    from app.services.reconciliation_service import reconciliation_service  # type: ignore
except Exception: reconciliation_service = type('x',(),{'run_once':lambda *a,**k:None})()  # type: ignore
try:
    from app.services.backfill_service import backfill_service  # type: ignore
except Exception: backfill_service = type('x',(),{'run_once':lambda *a,**k:{}})()  # type: ignore
try:
    from app.services.nav_service import nav_service  # type: ignore
except Exception: nav_service = type('x',(),{'run_once':lambda *a,**k:None})()  # type: ignore
try:
    from app.services.snapshot_service import snapshot_service  # type: ignore
except Exception: snapshot_service = type('x',(),{'snapshot_once':lambda *a,**k:None})()  # type: ignore
try:
    from app.services.merkle_service import merkle_service  # type: ignore
except Exception: merkle_service = type('x',(),{'snapshot_incremental':lambda *a,**k:None})()  # type: ignore
try:
    from app.services.chain_ingest_service import chain_ingest_service  # type: ignore
except Exception: chain_ingest_service = type('x',(),{'run_once':lambda *a,**k:None})()  # type: ignore
from app.config import settings
from app.database import SessionLocal
try:
    from app.models.database import Domain  # type: ignore
except Exception:
    class Domain:  # type: ignore
        last_estimated_value = None
        first_seen_at = None
from typing import TYPE_CHECKING
if TYPE_CHECKING:  # hinting only; some models may not be present in reduced env
    try:  # pragma: no cover
        from app.models.database import DomainValuationDispute, PollIngestState  # type: ignore
    except Exception:  # pragma: no cover
        pass
from decimal import Decimal
from app.services.abuse_guard import abuse_guard

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
    # Warn if ephemeral JWT keys are in use for prod-like env
    try:
        from base64 import b64decode
        # Heuristic: generated ephemeral keys in config are 2048-bit PKCS8 PEMs; check for typical header pattern length
        priv_b64 = settings.jwt_private_key_b64
        if settings.app_env.lower() in ("prod", "production") and priv_b64:
            decoded = b64decode(priv_b64.encode('utf-8'), validate=False)
            if b"BEGIN PRIVATE KEY" in decoded:
                logger.warning("[security] Production app_env with inline (possibly ephemeral) JWT private key detected. Replace with managed secret before deployment.")
    except Exception:
        logger.exception("[security] Ephemeral key detection failed")
    # Optionally start background poller
    async def poll_loop():
        interval = 21600  # 6 hours - runs 4 times per day
        logger.info("[poll] background poller started interval=%ss (4x daily)", interval)
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
                # choose domains with recent activity (guarded import)
                try:
                    from app.services.doma_subgraph_service import doma_subgraph_service
                    active_domains_from_subgraph = await doma_subgraph_service.get_active_domains(limit=50)
                    domain_names = [d['name'] for d in active_domains_from_subgraph]
                except Exception:
                    logger.exception("[orderbook] Failed to fetch active domains from subgraph, falling back to recent")
                    domain_names = []
                
                if not domain_names:
                    try:
                        from app.models.database import Domain as _D
                        domain_names = [d.name for d in db.query(_D).order_by(_D.first_seen_at.desc()).limit(10)]
                    except Exception:
                        domain_names = []

                if domain_names:
                    await orderbook_snapshot_service.snapshot_once(db, domain_names)
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
        interval = 21600  # 6 hours - runs 4 times per day
        logger.info("[reconcile] loop started interval=%ss (4x daily)", interval)
        while True:
            try:
                await reconciliation_service.run_once(limit=300)
            except Exception:
                logger.exception("[reconcile] run failed")
            await asyncio.sleep(interval)

    async def backfill_loop():
        """Periodic lightweight external_order_id backfill for listings/offers missing an ID.

        Heuristic currently: if tx_hash present & looks like hex, copy it into external_order_id.
        This is a placeholder until richer mapping logic (e.g., orderbook API lookup) is added.
        Runs less frequently to reduce churn.
        """
        interval = 21600  # 6 hours - runs 4 times per day
        logger.info("[backfill] loop started interval=%ss (4x daily)", interval)
        while True:
            try:
                result = await backfill_service.run_once(lookback_minutes=24*60, limit=200)
                if result.get("updated"):
                    logger.info("[backfill] updated=%s", result.get("updated"))
            except Exception:
                logger.exception("[backfill] loop error")
            await asyncio.sleep(interval)

    async def nav_loop():
        interval = 21600  # 6 hours - runs 4 times per day
        logger.info("[nav] loop started interval=%ss (4x daily)", interval)
        while True:
            try:
                nav_service.run_once(stale_seconds=600)
                # After NAV recompute, take a lightweight snapshot (per-share history) less frequently (every run here)
                snapshot_service.snapshot_once()
                # Record nav metric for circuit breaker (approx: average of recent valuations if available)
                try:
                    # Heuristic: take mean of last 10 domain estimated values
                    db_nav = SessionLocal()
                    from sqlalchemy import func as _f
                    avg_val = db_nav.query(_f.avg(Domain.last_estimated_value)).scalar()
                    if avg_val:
                        abuse_guard.record_nav(Decimal(avg_val))
                    db_nav.close()
                except Exception:
                    logger.exception("[nav] nav record failed")
                # Broadcast minimal nav update event
                try:
                    res = broadcast_event({"type": "nav_update"})
                    if asyncio.iscoroutine(res):
                        await res
                except Exception:
                    logger.exception("[nav] broadcast failed")
            except Exception:
                logger.exception("[nav] run failed")
            await asyncio.sleep(interval)

    async def fast_snapshot_loop():
        interval = 21600  # 6 hours - runs 4 times per day
        logger.info("[snapshot] loop started interval=%ss (4x daily)", interval)
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

    async def merkle_loop():
        interval = 21600  # 6 hours - runs 4 times per day
        logger.info("[merkle] loop started interval=%ss (4x daily)", interval)
        from app.database import SessionLocal as _SL
        while True:
            db = _SL()
            try:
                snap = merkle_service.snapshot_incremental(db)
                if snap:
                    logger.info("[merkle] new snapshot root=%s events=%s", snap.merkle_root, snap.event_count)
            except Exception:
                logger.exception("[merkle] snapshot loop error")
                try:
                    db.rollback()
                except Exception:
                    pass
            finally:
                try:
                    db.close()
                except Exception:
                    pass
            await asyncio.sleep(interval)

    async def chain_ingest_loop():
        interval = 30  # poll every 30s
        from app.database import SessionLocal as _SL
        logger.info("[chain] ingest loop started interval=%ss", interval)
        while True:
            db = _SL()
            try:
                processed = chain_ingest_service.run_once(db)
                if processed:
                    logger.info("[chain] processed %s blocks", processed)
            except Exception:
                logger.exception("[chain] ingest error")
            finally:
                try:
                    db.close()
                except Exception:
                    pass
            await asyncio.sleep(interval)

    async def incentive_loop():
        interval = 21600  # 6 hours - runs 4 times per day
        from app.database import SessionLocal as _SL
        logger.info("[incentive] loop started interval=%ss (4x daily)", interval)
        while True:
            db = _SL()
            try:
                if incentive_service:
                    finalized = incentive_service.run_once(db)
                    if finalized:
                        logger.info("[incentive] finalized epochs=%s", finalized)
            except Exception:
                logger.exception("[incentive] loop error")
            finally:
                try:
                    db.close()
                except Exception:
                    pass
            await asyncio.sleep(interval)
    
    async def doma_rank_oracle_loop():
        """DomaRank Oracle - Update valuations every 10 minutes"""
        interval = settings.doma_rank_update_interval_seconds
        logger.info("[doma-rank] oracle loop started interval=%ss", interval)
        try:
            from app.services.doma_rank_oracle_service import doma_rank_oracle_service
            from app.services.doma_subgraph_service import doma_subgraph_service
        except Exception:
            logger.exception("[doma-rank] failed to import services")
            return
        
        while True:
            try:
                # First sync fractional tokens from subgraph
                await doma_subgraph_service.sync_fractional_tokens_to_db()
                # Then update valuations for all tokens
                stats = await doma_rank_oracle_service.update_all_fractional_token_valuations()
                logger.info("[doma-rank] updated valuations: %s", stats)
            except Exception:
                logger.exception("[doma-rank] oracle update failed")
            await asyncio.sleep(interval)

    global bg_task
    loop_tasks: list[asyncio.Task] = []
    
    # Log which services will be enabled
    if settings.enable_background_polling and settings.doma_poll_base_url and settings.doma_poll_api_key and settings.app_env != "test":
        logger.info("[startup] Background polling enabled")
    else:
        logger.info("[startup] Background polling disabled")
        
    if settings.enable_orderbook_snapshots and settings.doma_orderbook_base_url and settings.app_env != "test":
        logger.info("[startup] Orderbook snapshots enabled")
    else:
        logger.info("[startup] Orderbook snapshots disabled")
        
    if settings.enable_reconciliation and settings.doma_orderbook_base_url and settings.app_env != "test":
        logger.info("[startup] Reconciliation enabled")
    else:
        logger.info("[startup] Reconciliation disabled")
        
    # NAV loop independent of external APIs
    if settings.enable_nav_calculations and settings.app_env != "test":
        logger.info("[startup] NAV calculations enabled")
    else:
        logger.info("[startup] NAV calculations disabled")
        
    if settings.enable_backfill_service and settings.app_env != "test":
        logger.info("[startup] Backfill service enabled")
    else:
        logger.info("[startup] Backfill service disabled")
        
    if settings.enable_merkle_service:
        logger.info("[startup] Merkle service enabled")
    else:
        logger.info("[startup] Merkle service disabled")
        
    if settings.enable_raw_chain_ingest:
        logger.info("[startup] Chain ingest enabled")
    else:
        logger.info("[startup] Chain ingest disabled")
        
    # DomaRank Oracle loop - update fractional token valuations
    if settings.enable_doma_rank_oracle and settings.doma_subgraph_url and settings.app_env != "test":
        logger.info("[startup] DomaRank Oracle enabled")
    else:
        logger.info("[startup] DomaRank Oracle disabled")
    
    # Start lightweight thread-based scheduler (periodic merkle snapshot + chain ingest stub)
    try:
        from .background import scheduler
        # Start scheduler in background thread to avoid blocking startup
        import threading
        scheduler_thread = threading.Thread(target=scheduler.start, daemon=True)
        scheduler_thread.start()
        logger.info("[startup] background scheduler started (non-blocking)")
    except Exception:
        logger.exception("Failed to start background scheduler")
    
    # Create a delayed task starter
    async def start_background_tasks_delayed():
        await asyncio.sleep(5)  # Wait 5 seconds for app to be fully ready
        logger.info("[startup] Starting background tasks...")
        
        if settings.enable_background_polling and settings.doma_poll_base_url and settings.doma_poll_api_key and settings.app_env != "test":
            loop_tasks.append(asyncio.create_task(poll_loop()))
            
        if settings.enable_orderbook_snapshots and settings.doma_orderbook_base_url and settings.app_env != "test":
            loop_tasks.append(asyncio.create_task(orderbook_loop()))
            
        if settings.enable_reconciliation and settings.doma_orderbook_base_url and settings.app_env != "test":
            loop_tasks.append(asyncio.create_task(reconcile_loop()))
            
        if settings.enable_nav_calculations and settings.app_env != "test":
            loop_tasks.append(asyncio.create_task(nav_loop()))
            loop_tasks.append(asyncio.create_task(fast_snapshot_loop()))
            
        if settings.enable_backfill_service and settings.app_env != "test":
            loop_tasks.append(asyncio.create_task(backfill_loop()))
            
        if settings.enable_merkle_service:
            loop_tasks.append(asyncio.create_task(merkle_loop()))
            
        if settings.enable_raw_chain_ingest:
            loop_tasks.append(asyncio.create_task(chain_ingest_loop()))
            
        # Incentive loop - always enabled for now
        loop_tasks.append(asyncio.create_task(incentive_loop()))
        
        if settings.enable_doma_rank_oracle and settings.doma_subgraph_url and settings.app_env != "test":
            loop_tasks.append(asyncio.create_task(doma_rank_oracle_loop()))
        
        logger.info("[startup] Background tasks started successfully")
    
    # Start the delayed task starter
    asyncio.create_task(start_background_tasks_delayed())
    
    if loop_tasks:
        bg_task = loop_tasks[0]
    setattr(app_.state, '_bg_tasks', loop_tasks)
    
    yield  # Application is now ready to serve requests
    # Shutdown
    try:
        await doma_poll_service.close()
    except Exception:
        logger.exception("Error closing Doma Poll service client")
    bg_list = getattr(app_.state, '_bg_tasks', [])
    for t in bg_list:
        t.cancel()
    # Wait for tasks to cancel, but ignore CancelledError
    for t in bg_list:
        try:
            await t
        except asyncio.CancelledError:
            pass  # Expected when cancelling tasks
        except Exception:
            logger.exception("Error during task shutdown")
    # Stop scheduler
    try:
        from .background import scheduler
        scheduler.stop()
    except Exception:
        logger.exception("Failed to stop background scheduler")
    logger.info("[shutdown] API shutting down")

app = FastAPI(title="DomaCross API", version="0.1.0", lifespan=lifespan)

from . import broadcast as _bc  # indirect to avoid hard failure in minimal env
websocket_connections = getattr(_bc, 'websocket_connections', [])
set_connection_filter = getattr(_bc, 'set_connection_filter', lambda *a, **k: None)
broadcast_event = getattr(_bc, 'broadcast_event', lambda *a, **k: None)
set_connection_scope = getattr(_bc, 'set_connection_scope', lambda *a, **k: None)

# CORS (support localhost + dynamic cloudspaces preview host pattern)
# A 400 on OPTIONS previously indicated the Origin did not match the static allow_origins list,
# causing the request to fall through to normal routing (and a dependency returned 400) instead of
# CORSMiddleware short-circuiting with 200. We switch to a regex that matches ephemeral preview domains.
_CORS_REGEX = r"^(https?://(localhost|127\.0\.0\.1)(:[0-9]+)?|https://3000-[a-z0-9]+\.cloudspaces\.litng\.ai|https://mm-domacross.*\.vercel\.app|https?://[0-9]{1,3}(?:\.[0-9]{1,3}){3}(:[0-9]+)?)$"
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=_CORS_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Diagnostic middleware (can be removed in production) to log CORS origin mismatches & preflight details
@app.middleware("http")
async def _cors_diagnostics(request, call_next):
    if request.method == "OPTIONS":
        origin = request.headers.get("origin")
        acrm = request.headers.get("access-control-request-method")
        if origin:
            try:
                pattern = re.compile(_CORS_REGEX)
                if not pattern.match(origin):
                    logger.warning("[cors] preflight origin NOT matched regex: %s", origin)
                else:
                    logger.debug("[cors] preflight origin matched: %s method=%s", origin, acrm)
            except Exception:
                logger.exception("[cors] regex failure for origin=%s", origin)
        else:
            logger.warning("[cors] OPTIONS without Origin header path=%s", request.url.path)
    return await call_next(request)

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
app.include_router(settlement.router, prefix="/api/v1")
app.include_router(incentives.router, prefix="/api/v1")
app.include_router(policy.router, prefix="/api/v1")
app.include_router(orderfeed.router)
app.include_router(prize_escrow.router, prefix="/api/v1")
app.include_router(baskets.router, prefix="/api/v1")
app.include_router(governance.router, prefix="/api/v1")
app.include_router(defi.router, prefix="/api/v1/defi")
app.include_router(marketplace.router, prefix="/api/v1")
app.include_router(doma_fractional.router, prefix="/api/v1")
app.include_router(doma_fractional.simple_router, prefix="/api/v1")  # Simple alias endpoints
app.include_router(sync_status.router, prefix="/api/v1")
app.include_router(debug.router, prefix="/api/v1")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, events: str | None = None, competitions: str | None = None):
    await websocket.accept()
    websocket_connections.append(websocket)
    if events:
        requested = [e.strip() for e in events.split(',') if e.strip()]
        if requested:
            set_connection_filter(websocket, requested)
    if competitions:
        comps = [c.strip() for c in competitions.split(',') if c.strip()]
        if comps:
            set_connection_scope(websocket, comps)
    # send initial hello w/ sequence bootstrap (no persistence, so just 0)
    await websocket.send_json({'type': 'hello', 'seq': 0})
    try:
        while True:
            raw = await websocket.receive_text()
            # Simple JSON command support; fallback to legacy SUB prefix
            if raw.startswith('SUB '):
                evs = [e.strip() for e in raw[4:].split(',') if e.strip()]
                set_connection_filter(websocket, evs)
                await websocket.send_json({'type': 'subscribed', 'events': evs})
                continue
            if raw.startswith('UNSUB'):
                set_connection_filter(websocket, None)
                await websocket.send_json({'type': 'unsubscribed'})
                continue
            # Heartbeat: client can send PING; respond with PONG
            if raw == 'PING':
                await websocket.send_json({'type': 'pong'})
                continue
            # Attempt JSON parse for structured commands
            try:
                cmd = None
                import json
                cmd = json.loads(raw)
            except Exception:
                cmd = None
            if cmd and isinstance(cmd, dict):
                action = cmd.get('action')
                if action == 'SUB':
                    evs = cmd.get('events') or []
                    comps = cmd.get('competitions') or []
                    set_connection_filter(websocket, evs if evs else None)
                    set_connection_scope(websocket, comps if comps else None)
                    await websocket.send_json({'type': 'subscribed', 'events': evs, 'competitions': comps})
                elif action == 'UNSUB':
                    set_connection_filter(websocket, None)
                    set_connection_scope(websocket, None)
                    await websocket.send_json({'type': 'unsubscribed'})
                elif action == 'PING':
                    await websocket.send_json({'type': 'pong'})
                else:
                    await websocket.send_json({'type': 'echo', 'data': raw})
            else:
                await websocket.send_json({'type': 'echo', 'data': raw})
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        try:
            websocket_connections.remove(websocket)
        except ValueError:
            pass
        set_connection_filter(websocket, None)
        try:
            from . import broadcast as _bc
            getattr(_bc, 'connection_comp_scopes', {}).pop(id(websocket), None)
        except Exception:
            pass

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
            'incentive_epoch_finalized': {'desc': 'Incentive epoch finalized', 'fields': ['schedule_id','epoch_index','adjusted','actual_emission']},
            'incentive_schedule_created': {'desc': 'Incentive schedule created', 'fields': ['schedule_id','name']},
            'dispute_quorum': {'desc': 'Valuation dispute reached quorum', 'fields': ['domain','dispute_id','votes','threshold']},
            'dispute_resolved': {'desc': 'Valuation dispute resolved or rejected', 'fields': ['domain','dispute_id','final_status']},
            'valuation_update': {'desc': 'Domain valuation updated', 'fields': ['domain','value','previous_value','change_pct','model_version']},
            'listing_created': {'desc': 'Listing created', 'fields': ['id','domain','price','seller','competition_id']},
            'listing_filled': {'desc': 'Listing filled', 'fields': ['id','domain','price','seller','buyer','competition_id']},
            'listing_cancelled': {'desc': 'Listing cancelled', 'fields': ['id','domain','price','seller','competition_id']},
            'offer_created': {'desc': 'Offer created', 'fields': ['id','domain','price','offerer','competition_id']},
            'offer_accepted': {'desc': 'Offer accepted', 'fields': ['id','domain','price','offerer','seller','competition_id']},
            'offer_cancelled': {'desc': 'Offer cancelled', 'fields': ['id','domain','price','offerer','competition_id']},
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
    # Websocket latency snapshot
    try:
        from app.services.metrics_service import get_ws_latency_snapshot
        ws_stats = get_ws_latency_snapshot()
        lines.append(f"ws_broadcast_latency_seconds_p50 {ws_stats['p50']}")
        lines.append(f"ws_broadcast_latency_seconds_p95 {ws_stats['p95']}")
        lines.append(f"ws_broadcast_latency_seconds_avg {ws_stats['avg']}")
        lines.append(f"ws_broadcast_latency_samples {ws_stats['count']}")
    except Exception:
        pass
    # Orderbook & valuation counters
    try:
        from app.services.orderbook_snapshot_service import orderbook_snapshot_service as oss
        if hasattr(oss, 'total_requests'):
            lines.append(f"orderbook_requests_total {getattr(oss,'total_requests')}")
        if hasattr(oss, 'total_failures'):
            lines.append(f"orderbook_failures_total {getattr(oss,'total_failures')}")
        if hasattr(oss, 'total_snapshots'):
            lines.append(f"orderbook_snapshots_total {getattr(oss,'total_snapshots')}")
    except Exception:
        pass
    try:
        from app.services.backfill_service import backfill_service as bfs
        lines.append(f"backfill_runs_total {getattr(bfs,'total_runs',0)}")
        lines.append(f"backfill_updated_total {getattr(bfs,'total_updated',0)}")
        lines.append(f"backfill_scanned_total {getattr(bfs,'total_scanned',0)}")
        lines.append(f"backfill_mapping_size {len(getattr(bfs,'_tx_to_order',{}))}")
    except Exception:
        pass
    try:
        from app.services.valuation_service import valuation_service as vs
        if hasattr(vs, 'total_batches'):
            lines.append(f"valuation_batches_total {getattr(vs,'total_batches')}")
        if hasattr(vs, 'total_valuations'):
            lines.append(f"valuation_records_total {getattr(vs,'total_valuations')}")
    except Exception:
        pass
    return "\n".join(lines) + "\n"

@app.get("/health/ext")
def extended_health():
    DomainValuationDispute = None  # optional model not required
    from sqlalchemy import func as _f
    db = SessionLocal()
    try:
        if DomainValuationDispute:
            open_disputes = db.query(_f.count()).select_from(DomainValuationDispute).filter(DomainValuationDispute.status=='OPEN').scalar() or 0
        else:
            open_disputes = 0
        # Chain ingest state
        last_block = None
        try:
            from app.services.chain_ingest_service import ChainIngestState
            state = db.query(ChainIngestState).first()
            if state:
                last_block = state.last_block
        except Exception:
            pass
        poll_cursor = None
        poll_last_ingested = None
    # Poll ingest state omitted in trimmed environment
        return {
            'service': 'domacross-api',
            'status': 'ok',
            'open_disputes': open_disputes,
            'chain_last_block': last_block,
            'poll_last_event_id': poll_cursor,
            'poll_last_ingested_at': poll_last_ingested,
        }
    finally:
        try:
            db.close()
        except Exception:
            pass
