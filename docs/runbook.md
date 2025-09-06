# Operations Runbook

Date: 2025-09-06  
Scope: FastAPI backend, WebSocket layer, valuation engine, incentive scheduler, replay subsystem.

## 1. Health & Liveness
| Check | Command / Endpoint | Expected |
|-------|--------------------|----------|
| API liveness | GET /health (add before prod) | 200 JSON {status: ok} |
| DB connectivity | psql \c / alembic upgrade head | Succeeds |
| Scheduler loops | Logs contain 'loop:start' every interval | Continuous |

## 2. Common Procedures
### Restart API
```bash
docker compose restart api
```
If using process manager:
```bash
systemctl restart domacross-api
```

### Apply DB Migration
```bash
alembic upgrade head
```
Rollback (emergency):
```bash
alembic downgrade -1
```

### Rotate Secrets
1. Generate new secret (JWT / signing key).  
2. Store in secret manager / .env (never commit).  
3. Redeploy API (graceful) → old tokens honored until expiry.  

### Clear Replay Buffer (memory pressure)
Restart API or trigger internal endpoint (future) clearing event ring.

## 3. Incident Playbooks
| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| High latency valuations | DB contention / large batch | Inspect slow queries, reduce batch size, scale DB |
| Gaps in listing sequence | Missed websocket frames | Trigger REST backfill since_seq, monitor reconnection rate |
| Repeated integrity hash mismatch | Corrupted audit chain | Halt exports, recompute chain offline, compare digests |
| Excess risk flags | Abuse attempt | Throttle offender IP/wallet, review logs |

## 4. Backups & Retention
Postgres: daily snapshot (retain 7 days).  
Redis: ephemeral (warm cache only).  
Export audit log via streaming endpoint weekly for cold storage.

## 5. Performance Baselines (to fill)
| Path | p50 | p95 | Note |
|------|-----|-----|------|
| /valuation/batch (3 domains) | TBD | TBD | Ensemble OFF |
| /valuation/batch (3 domains) | TBD | TBD | Ensemble ON |

## 6. DR & Recovery
Cold start: apply migrations, seed minimal dataset, enable valuation loops.  
Replay manifest can repopulate UI activity for smoke validation.

## 7. Access Control
Admin wallet list governs policy & settlement endpoints. Rotate by editing env & restart.

## 8. Observability (Planned)
Add /metrics (Prometheus) and structured JSON logs with correlation id.  
Introduce latency histogram for valuation path.
