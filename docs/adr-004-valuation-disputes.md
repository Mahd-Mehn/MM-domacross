# ADR: Valuation Dispute Quorum & Resolution Policy

Status: Draft
Date: 2025-09-04

## Context
Participants may challenge a domain valuation they believe is materially inaccurate. An on-chain oracle is planned but current valuations are off-chain heuristics. A lightweight governance mechanism is required to: (a) signal potential mispricing, (b) clamp valuation effects pending review, and (c) allow admin adjudication while preserving an immutable audit trail.

## Decision
1. A dispute may be opened per domain when none is currently OPEN.
2. Opening snapshots the quorum threshold `threshold` (default from settings at time of creation) to ensure predictability if global config changes mid-lifecycle.
3. Votes are unary positive support increments (no down-vote) simplifying quorum semantics.
4. When `votes >= threshold` the dispute enters a QUORUM-REACHED state implicitly (status still OPEN) and valuation service treats the domain as "disputed" for clamping logic.
5. Admin resolves with ACCEPT (status -> RESOLVED) or REJECT (status -> REJECTED). Either path ends the clamp.
6. Post-resolution votes are rejected (validation enforced in tests).
7. WebSocket events provide transparency:
   - `dispute_quorum` when votes cross threshold.
   - `dispute_resolved` when admin acts.
8. Audit events recorded for open, each vote, quorum reach, and resolution with integrity hash chain.

## Rationale
- Snapshot threshold prevents governance instability if configuration is tuned frequently.
- Unary vote avoids ambiguity of net-sum and simplifies off-chain data structures.
- Admin final adjudication maintains velocity while a fuller community governance module is designed.

## Alternatives Considered
- Token-weighted voting (rejected: introduces dependency on token balances prematurely).
- Time-based auto resolution after grace period (deferred; may be added with expiry semantics + auto REJECT or ACCEPT heuristic).

## Consequences
- Requires manual resolution which could create backlog—mitigated by low anticipated dispute volume early.
- Lack of negative vote means disputes can only escalate, not be countered by peers; acceptable for MVP clamp mechanism.

## Future Extensions
- Expiry / SLA: auto-expire unresolved disputes after X hours.
- Negative votes & conflict resolution scoring.
- Multiple concurrent disputes if valuation model versions differ (scoped disputes).
- On-chain anchoring of dispute state once oracle is live.

## Metrics / Success
- Median time from quorum to resolution < 24h.
- < 5% disputes unresolved past 48h.
- Clamp prevents >50% of extreme outlier valuation usages in reward computations.

## References
- `apps/api/app/routers/valuation.py` dispute endpoints.
- `docs/EVENTS.md` dispute event schemas.
