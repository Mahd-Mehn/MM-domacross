# ADR-003: Anti-Abuse & Risk Control Architecture

Date: 2025-09-06
Status: Accepted
Context Version: Phase 6 completion (heuristics + persistence + contract tests)

## Context
The competitive domain trading platform requires proactive mitigation of abusive behaviors (wash trades, self-crossing, rapid flipping) and systemic risk (extreme NAV moves). Initial implementation used in-memory heuristics only, lacking persistence across restarts and unified event surfacing.

## Decision
Implement a layered Anti-Abuse module ("AbuseGuard" + Post-Trade Heuristics) with:

1. Heuristic Flagging (synchronous, deterministic):
   - WASH_LIKELY: opposite side trade by same participant on same domain within 120s.
   - RAPID_FLIP: >=3 side changes in prior 10m before current trade.
   - SELF_CROSS: opposite side within 30s (stricter wash subset).
   - CIRCULAR_PATTERN: domain traded among ≥3 distinct participants returning to origin inside 10m window.
2. Rate Limiting: per-wallet + per-IP token bucket (configurable burst) with Redis ZSET-based persistence when available.
3. Circuit Breaker: triggers when cumulative NAV move exceeds configured bps within rolling window; persisted via Redis key TTL; auto-clears if movement normalizes (<5% divergence from window start).
4. Idempotency: header-based replay guards for redemption intent creation and competition settlement submissions using `idempotency_keys` table.
5. Event Emission: minimal `risk_flag` websocket payload for UI and external audit consumers.

## Rationale
- Synchronous heuristics ensure flags are attached to the canonical trade record without race conditions.
- Minimal payload reduces websocket bandwidth and avoids leaking PII/account structure.
- Redis optionality permits local dev without infra overhead while enabling horizontal scaling in production.
- Header-based idempotency avoids heavier request body hashing and supports client retriable semantics.

## Alternatives Considered
- Async background detector: rejected for increased complexity and potential ordering ambiguity.
- Full ML anomaly detection: deferred (insufficient labeled data, complexity risk pre-MVP).
- Global rate limiting via reverse proxy only: insufficient granularity (needs per-wallet logic).

## Persistence Model
| Concern | In-Memory | Redis | Database |
|---------|-----------|-------|----------|
| Rate bucket timestamps | ✅ | ZSET per key | ❌ |
| Circuit breaker flag | ✅ | Key TTL | ❌ |
| Risk flags | ❌ | ❌ | ✅ (`trade_risk_flags`) |
| Idempotency keys | ❌ | ❌ | ✅ (`idempotency_keys`) |

## Data Model Additions
- `trade_risk_flags` (id, trade_id, flag_type, details JSON, created_at)
- `idempotency_keys` (key, route, created_at)

## Testing Strategy
- Unit tests for each heuristic (wash, rapid flip, self-cross, circular) creating synthetic trade sequences.
- WebSocket contract test verifying presence & schema of `risk_flag` events.
- Idempotency tests for redemption and competition settlement submit.
- Circuit breaker and rate limiting functional tests.

## Security & Integrity
- Flags are advisory (no automatic trade cancellation yet) to avoid false-positive user disruption.
- Extension path: escalate certain repeated flags to temporary participant throttling.
- Future: sign or hash risk events for tamper-evident replay logs.

## Drawbacks
- Heuristic thresholds static; may require tuning or participant-specific dynamic baselines.
- Redis TTL-based persistence may miss edge NAV moves if outage >= window.

## Follow-Up Actions
- Add issuance intent idempotency.
- Introduce anomaly score + ML pipeline (ADR future).
- Add admin dashboard for live risk flag stream & breaker status.
- Implement participant-level penalty/lockout after X flags in rolling window.

## Status Tracking
Referenced in `tasks.md` (Section 6). README updated with summary table.

## Decision Owners
Engineering / Risk Controls WG.
