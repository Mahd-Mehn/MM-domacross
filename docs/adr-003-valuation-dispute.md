# ADR-003: Valuation Dispute & Override Workflow

Status: Accepted  
Date: 2025-09-04  
Supersedes: None  
Related: ADR-001 (Valuation Heuristic - TBD), ADR-002 (Incentive Model - TBD)

## Context
Domain valuations feed reward calculations, ETF NAV, and trading UX. Sudden spikes can be manipulated or reflect anomalous data (illiquid trades, spoofed orderbook). A lightweight, transparent dispute mechanism is required to freeze (clamp) valuations while community / admin review occurs, without halting all valuation factor computation.

## Goals
- Allow any authenticated participant to open a dispute on a domain's valuation.
- Accumulate affirmative votes until a quorum threshold is reached.
- While quorum-active and before resolution, clamp the effective valuation to the prior value to prevent drift.
- Preserve full factor computation for transparency (so users can still inspect prospective value).
- Provide explicit admin override & resolution endpoints.
- Emit audit + websocket events for lifecycle transitions (open, vote, quorum, resolve).

## Non-Goals
- Complex negative voting / slashing logic.
- Weighted or stake-based governance (future extension).
- Automatic dispute resolution without human/admin action.

## Data Model Additions
Table: `domain_valuation_disputes`
- `id`
- `domain_name`
- `reason` (optional)
- `status`: OPEN | RESOLVED | REJECTED
- `votes`: running positive vote count
- `threshold`: snapshot of quorum threshold at creation time (so later config changes do not retroactively alter active disputes)
- `created_by_user_id`, `created_at`, `resolved_at`

## Configuration
Env / Settings:
- `VALUATION_DISPUTE_VOTE_THRESHOLD` (default 3) — number of affirmative votes required to trigger quorum status.

## Lifecycle & Semantics
1. OPEN: Created via `POST /valuation/dispute`. If an existing OPEN dispute exists for the domain, it is reused.
2. VOTE: `POST /valuation/dispute/vote` increments vote count (idempotency not enforced MVP). Each vote logs an audit event.
3. QUORUM: When `votes >= threshold`, a quorum audit + websocket event is emitted (`type: dispute_quorum`). Dispute remains OPEN until explicitly resolved; valuation engine reads this state to clamp output.
4. RESOLUTION: Admin calls `POST /valuation/dispute/resolve?dispute_id=...&accept=bool` resulting in status RESOLVED (accepted) or REJECTED. Websocket event `dispute_resolved` emitted.

## Valuation Clamp Logic
Within `ValuationService.value_domains`:
- If an OPEN dispute exists AND `votes >= threshold`, computed blended value is replaced by previous valuation (prev_val) to freeze price movement.
- Factors still record raw blended components and mark `disputed: true`, `dispute_votes: N`.

## Overrides Interaction
Admin overrides (separate table) supersede disputes implicitly for pricing display (override path not blocked by dispute clamp). Disputes do not delete overrides; operators must manage override expirations separately.

## Events & Observability
Audit Event Types:
- `VALUATION_DISPUTE_OPENED`
- `VALUATION_DISPUTE_VOTE`
- `VALUATION_DISPUTE_QUORUM`
- `VALUATION_DISPUTE_RESOLVED`

WebSocket Broadcasts:
- `dispute_quorum` { domain, dispute_id, votes, threshold }
- `dispute_resolved` { domain, dispute_id, final_status }

Clients may subscribe and update UI badges / banners for disputed domains.

## Alternatives Considered
- Automatic resolution after timeout: deferred for simplicity.
- Percentage-based quorum (votes / holders): requires holder snapshot complexity; omitted.
- Negative votes: invites griefing without stake weighting.

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Spam disputes | Re-use existing OPEN dispute; optional future rate limit per user/domain. |
| Sybil voting | Threshold kept low; future enhancement: weight by participation or holdings. |
| Frozen valuations exploited | Admin oversight + override ability. |

## Future Extensions
- Add dispute expiration (auto REJECT if not resolved in window).
- Weighted voting based on stake or competition rank.
- Rich notification / email hooks.
- Merge with governance / proposal framework.

## Decision
Implement MVP dispute quorum with valuation clamp and audit + websocket transparency; accept manual admin resolution path.

## Status Impact
Marks Dispute / Override mechanism feature closer to completion pending comprehensive tests & UI enhancements.
