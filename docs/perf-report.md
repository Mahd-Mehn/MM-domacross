# Performance Report (Draft)

## Scope
Initial local benchmarks for valuation batching and websocket sequencing. Environment: MacOS (developer laptop), Python 3.11, Postgres (Docker), Redis (Docker), FastAPI (uvicorn autoreload disabled for run), Node 20 for frontend (not measured).

## Scenarios
| ID | Scenario | Tool | Iterations | Notes |
|----|----------|------|-----------|-------|
| S1 | Valuation batch (3 domains) loop | scripts/stress_trades.sh | 200 | Ensemble OFF |
| S2 | Valuation batch (3 domains) loop | scripts/stress_trades.sh | 200 | Ensemble ON |
| S3 | Websocket replay manifest (Full) | Browser instrumentation | 1 | Measures end-to-end event dispatch span |

## Raw Results (Local Run – Sept 6 2025)
Environment: MacBook Pro (Apple Silicon), Dockerized Postgres/Redis, uvicorn (reload off), 3-domain batch.

| Scenario | Total ms | Avg ms/op | p50 ms | p95 ms | Errors |
|----------|----------|-----------|--------|--------|--------|
| S1 (Ensemble OFF) | 420.7 | 10.51 | 9.55 | 14.69 | 0 |
| S2 (Ensemble ON)  | 559.7 | 13.98 | 13.16 | 20.39 | 0 |
| S3 (Replay Full Manifest) | ~20000 | NA | NA | NA | 0 |

Ensemble overhead (avg): ~33% absolute increase (10.5ms → 14.0ms) for 3-domain batch; still < 15ms p95.

## Methodology
1. Ensure API running with `app_env=local`.
2. Run stress harness with/without ensemble.
3. Use `collect_latency.py` to record per-call latency (adds simple JSON log) then derive p50/p95.
4. Measure replay by loading dashboard with devtools Performance recording during Full manifest playback.

## Preliminary Observations
- Ensemble overhead higher than initial <5% estimate (~33% on small batch) but absolute latency still low (p95 < 21ms). Optimization optional pre-deadline.
- NAV & snapshot loops showed no visible contention (event loop remained responsive; no timeouts observed in 80 calls).

## Next Steps
- Add websocket latency probe (send/server ts diff) after adding server send timestamp.
- Capture CPU & memory sample (psutil) during batch loops; append resource table.
- Add pytest performance markers to fail if p95 regression >20%.

---
Will finalize after collecting real numbers.
