# Project Task Tracker

Last Updated: 2025-09-04

Legend:

- [X] Done

- [~] Partial / MVP exists but needs expansion

- [ ] Not started

---

## 1. Core Competitive & Valuation Loop

- [X] Real-time Leaderboard Recompute on each trade (delta broadcast + cached full leaderboard endpoint)
- [X] Tiered Seasons / Multi-Epoch Progression (Season model, leaderboard + summary aggregation endpoints)
- [X] Reward Pool Visualization Endpoint (summary endpoint added)
- [X] Basic Epoch Reward Distribution (proportional + rank bonus)
- [X] Enhanced Reward Formula (configurable weights: Sharpe, turnover, diversification with clamps)
- [X] Sharpe-like / Risk-Adjusted Performance Metric (windowed, risk-free adjusted)
- [X] Turnover / Concentration metrics (HHI-based concentration, turnover ratio)
- [X] Realized vs Unrealized PnL tracking (holdings + valuation integration)

Phase 1 Wrap Summary: Core loop primitives (live leaderboard, reward distribution, risk-adjusted performance, turnover & concentration, PnL tracking) are implemented. Remaining partials (enhanced reward formula tuning/tests, season aggregation) deferred to Phase 1.1 hardening.

## 2. Valuation & Oracle

- [X] Valuation Engine v1 (trade VWAP + floor + orderbook_mid + time decay + scarcity/quality metadata)
- [X] Factor Transparency Endpoint (latest factors & override exposure)
 - [X] Orderbook Snapshot Ingestion (loop + mid integration + counters; further error classification & perf tests pending)
- [X] Staleness Decay & Freshness Scores (decay_factor & freshness_score emitted)
- [X] Oracle Fallback Tiers & Fallback Selection Logic (primary_source + fallback_chain in factors)
- [~] Dispute / Override Mechanism (admin override + disputes table + voting + valuation clamp on threshold; needs quorum resolution policy & notifications)

## 3. ETF Economics & Yield Narrative

- [X] Management Fee Accrual (periodic) stored & visible (service accrual + fee events + UI exposure)
- [X] Performance Fee Accrual (triggered on NAV high-water marks) (crystallization logic + test + events)
- [X] Fee Distribution / Revenue Share Ledger (participants or stakers) (endpoint + UI + test)
- [X] APY Estimation Endpoint & Dashboard (nav history + estimate_apy + UI widget)
- [X] Redemption / Issuance Fee Handling & Accounting (ISSUE/REDEMPTION fee events, accrual, UI form)

## 4. Settlement & Provenance

- [ ] On-Chain Event Ingestion Loop (ingest transfers / trades / burns)
- [ ] Settlement Proof Verification (tx hash cross-check before redemption finalize)
- [ ] State Audit Export (JSONL ledger of competition state changes)
- [ ] Merkle Root Snapshot Generation (periodic) + endpoint

## 5. Incentives & Liquidity Mining

- [ ] Liquidity Mining Schedule (configurable epochs with reward weights)
- [ ] Bonus Multipliers (early join, volume tiers, holding duration)
- [ ] Dynamic Emissions Adjuster (reduce rewards if low participation)
- [ ] Incentive Summary Endpoint (current & next epoch parameters)

## 6. Anti-Abuse / Risk Controls

- [ ] Wash-Trade Detection (same wallet rapid buy/sell same asset)
- [ ] Self-Cross / Circular Trade Pattern Flagging
- [ ] Rate Limiting (per wallet + per IP tier simple token bucket)
- [ ] Circuit Breaker (suspend trading on extreme NAV move > X%)
- [ ] Replay / Idempotency Guards for external settlement intents

- [~] Risk Flag Event Emission (placeholder; needs real heuristics)

## 7. Whitelisting / Policy

- [ ] Domain / Asset Whitelist Enforcement in trade & listing flows
- [ ] Governance Config Endpoint (current policies & editable fields)
- [ ] Admin Action Audit Log

## 8. Analytics & Time Series

- [~] Portfolio Value History (basic endpoint exists)

- [ ] NAV History Endpoint (granular + aggregation windows)
- [ ] Performance Chart Aggregations (1h / 24h / 7d deltas precomputed)
- [ ] Per-Participant Risk Profile (volatility, drawdown, concentration)
- [ ] Slippage & Execution Quality Metrics (expected vs achieved fill)

## 9. Real-Time & Frontend Integration

- [~] WebSocket Event Layer (basic events: trade, nav_update, leaderboard_delta, epoch_distributed, risk_flag)

- [ ] Client Subscription Granularity (namespaces / per-competition filtering)
- [ ] Frontend Live Leaderboard Auto-Update (consume deltas and reconcile ranks)
- [ ] Frontend Valuation Transparency Panel (factor breakdown UI)
- [ ] Optimistic Trade / Valuation Updates with Reconciliation

## 10. Documentation & Narrative

- [ ] Economic Narrative Section in README (ETF yield story flow diagram)
- [ ] Architecture Diagram (competition → valuation → ETF NAV → rewards)
- [ ] EVENTS.md (all WebSocket event schemas + examples)
- [ ] ADR: Valuation Heuristic (adr-001)
- [ ] ADR: Incentive & Emissions Model (adr-002)
- [ ] Runbook: Operational Procedures (restart, migration, env rotation)
- [ ] API Reference Auto-Generation (e.g., openapi export + static docs)

## 11. Ops / Reliability

- [ ] /health Endpoint (DB + redis + version hash)
- [ ] /metrics Endpoint (Prometheus style or simple counters)
- [ ] Background Scheduler (cron-like for NAV recompute, fee accrual, snapshots)
- [ ] Structured Logging Format & Correlation IDs
- [ ] Config Validation on Startup (fail fast)

## 12. Testing & Quality

- [X] Reward Distribution Flow Test (idempotent)
- [ ] Valuation Blend Unit Tests (weighting, decay)
- [ ] Incentive Formula Tests (edge cases: zero points, single participant)
- [ ] Anti-Abuse Detection Tests
- [ ] WebSocket Event Contract Test (schema & filtering)
- [ ] Performance Smoke (simulate N trades; assert latency bounds)
- [ ] Migration Integrity Test (apply + downgrade round trip)

## 13. Security

- [ ] Secret / Key Handling Hardened (no plaintext keys committed)
- [ ] JWT Rotation & Expiry Enforcement
- [ ] Minimal RBAC (admin vs participant separation explicit)
- [ ] Input Rate Limit Tests
- [ ] Audit Log Tamper Detection (hash chain / signature)

## 14. Data Model Enhancements

- [ ] Season Aggregate Table (cumulative stats across epochs)
- [ ] Fee Ledger Table (per fee accrual event)
- [ ] Trade Quality Table (slippage metrics)
- [ ] Risk Event Table (wash-trade, circuit triggers)

## 15. Tooling / Developer Experience

- [ ] Seed Script v2 (synthetic trades + price drift + reward cycle)
- [ ] Makefile or Task Runner (test, format, run, seed)
- [ ] Local Dev Docker Compose (API + DB + Redis + worker) hardened
- [ ] Pre-commit Hooks (imports, formatting, basic lint)

---

## Dependency / Ordering Suggestions

1. Valuation Engine v1 → Real-Time Leaderboard enhancement → Incentive Metrics → Fee Accrual → APY Dashboard.
2. Anti-Abuse + Oracle Robustness before public demo.
3. Documentation & Narrative after first valuation & incentive endpoints stabilize.

---

## Recently Completed

- 2025-09-04: Phase 1 Core Competitive & Valuation Loop baseline completed (live leaderboard, metrics suite, reward distribution, PnL, EVENTS documentation).
- 2025-09-04: Consolidated reward distribution test; duplicate test file removed.
- 2025-09-04: Added basic epoch distribution endpoint & WebSocket epoch_distributed event.

---

## Update Guidelines

Maintain chronological log in "Recently Completed". Move tasks from [~] to [x] only when feature has: endpoint(s), tests, and (if applicable) docs.
