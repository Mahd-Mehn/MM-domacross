# ADR-009: Real-Time Event & Replay Architecture

Status: Accepted 2025-09-06  
Related Phase: Phase 9 – Real-Time & Frontend Integration  
Supersedes: N/A  
References: `docs/EVENTS.md`, `apps/web/components/TradingInterface.tsx`, `LeaderboardPanel.tsx`, `ValuationPanel.tsx`, `ReplayControls.tsx`, `events/store.ts`

## Context
Phase 9 required a production-lean (judge-demo focused) real-time layer enabling:

1. Unified WebSocket event stream (listings/offers lifecycle, valuation updates, leaderboard deltas).
2. Deterministic sequencing + incremental REST backfill (`since_seq`) for gap recovery.
3. Optimistic UI for listing / offer creation with reconciliation based on (contract, tokenId) identity.
4. Session-scoped in-memory aggregation for leaderboard deltas (lightweight, no persistence requirement yet).
5. Valuation live updates decoupled from factor transparency (factor breakdown UI deferred).
6. Replay & capture mechanism (export/import + timed playback) without polluting authoritative seq ordering.
7. Multi-currency offer flow, including dynamic decimals & persisted user preference.

## Decision
Adopt a thin, extensible event envelope streamed over a single WebSocket endpoint with query-parameter filtering for both event types and competition scope:

`wss://<host>/ws?events=trade,valuation_update,leaderboard_delta,...&competitions=<id>`

Core decisions:
* Sequencing: Monotonic `seq` attributed at emission; clients persist last seen `seq` (localStorage) and request differential backfill via REST on gap detection.
* Reconciliation: Optimistic provisional entries tagged (`temp-*`) replaced on authoritative event match by domain identity tuple.
* Leaderboard: Use `leaderboard_delta` additive semantics; client aggregates top N for low-latency UI; defer persistence and rank reconciliation conflicts to a later phase.
* Valuation: Emit simplified `valuation_update` events; factor transparency remains a separate REST concern; future enrichment (confidence_score) earmarked.
* Replay: Maintain a client-side circular buffer (configurable size). Replay dispatches synthetic DOM events on a separate channel (`replay:` prefix) so it cannot perturb live sequencing logic.
* Extensibility: Event schema catalog lives in `docs/EVENTS.md`; new event types must declare minimal required fields and optional enrichment.

## Alternatives Considered
* Multiple WebSocket namespaces per concern – rejected for demo scope complexity; filtering via query provides sufficient isolation.
* Server-driven replay injection – deferred; client-only replay keeps backend stateless for demo.
* Persistent leaderboard materialization in this phase – postponed to reduce surface area before core economics validation.

## Consequences
Positive:
* Rapid feature iteration (add event → update catalog → consume) with minimal infra churn.
* Deterministic recovery path for transient disconnects.
* Replay tooling accelerates judge demos & debugging.

Negative / Debt:
* Session-only leaderboard can diverge from future authoritative persistent leaderboard.
* No auth scoping yet; private / privileged event channels must be added (future ADR).
* Optimistic orphan eviction (never reconciled provisional events) not yet implemented.
* Factor transparency panel (UI) missing – valuation insight limited to topline numbers.

## Status Mapping to Phase 9 Tasks
| Task | Phase 9 Item | Status Rationale |
|------|--------------|------------------|
| WebSocket Event Layer | Unified stream + filtering implemented | DONE |
| Client Subscription Granularity | `events=` + `competitions=` params | DONE |
| Frontend Live Leaderboard Auto-Update | `LeaderboardPanel` aggregates deltas | DONE (session scope) |
| Frontend Valuation Transparency Panel | Factor breakdown UI not built | NOT STARTED |
| Optimistic Trade / Valuation Updates | Optimistic listings/offers + valuation updates present | PARTIAL (trade fill UI minimal) |
| Replay Capability | `ReplayControls` + export/import + speed | DONE |

## Follow-Ups
1. Add eviction timer for unreconciled provisional events.
2. Introduce authenticated websocket scopes (private balances / admin ops).
3. Persist leaderboard snapshots server-side & merge with deltas.
4. Implement Valuation Transparency UI (factors + confidence bands) once confidence_score emitted.
5. Timeline scrubber & labeled playback markers for advanced replay UX.

## Decision Owners
Primary: Real-Time / Frontend lead (current active contributor).  
Reviewers: Backend sequencing & valuation maintainers.

## Acceptance
Merged after validation that: gap recovery works (manual disconnect test), optimistic reconciliation replaces provisional entries, replay does not alter seq state, and multi-currency offers correctly handle decimals.
