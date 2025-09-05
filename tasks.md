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

- [ ] Valuation Ensemble (high priority)
	- [ ] Integrate orderbook pricing + oracle price feeds as primary/fallback inputs
	- [ ] Add lightweight ML/heuristic model producing a confidence score per valuation
	- [ ] Emit confidence_score + chosen_source in factor transparency endpoint
	- [ ] Add unit tests & sample model outputs for judge reproducibility

## 3. ETF Economics & Yield Narrative

- [X] Management Fee Accrual (periodic) stored & visible (service accrual + fee events + UI exposure)
- [X] Performance Fee Accrual (triggered on NAV high-water marks) (crystallization logic + test + events)
- [X] Fee Distribution / Revenue Share Ledger (participants or stakers) (endpoint + UI + test)
- [X] APY Estimation Endpoint & Dashboard (nav history + estimate_apy + UI widget)
- [X] Redemption / Issuance Fee Handling & Accounting (ISSUE/REDEMPTION fee events, accrual, UI form)

## 4. Settlement & Provenance

- [X] On-Chain Event Ingestion Loop (block height sync + verification semantics; marketplace order + trade ingestion incl. persistent order cache & attribution)

- [X] Settlement Proof Verification (tx hash semantic cross-check & gating before redemption finalize, gas/log/topic checks)

- [X] State Audit Export (streaming JSONL endpoints, pagination, integrity checks, docs; resume tests deferred but core complete)

- [X] Merkle Root Snapshot Generation (periodic scheduler + endpoint + proofs + signing)

- [X] On-chain Competition Settlement (high priority)
	- [X] Smart contract for competition finalization + USDC prize payouts (CompetitionSettlement.sol + events)
	- [X] Backend flow to submit settlement tx + verify on-chain proof before marking rewards distributed (submit & verify endpoints + semantic log validation)
	- [X] End-to-end test (localnet) and demo script (Hardhat test + settle-competition.ts printing tx hash for verification)

## 5. Incentives & Liquidity Mining

- [X] Liquidity Mining Schedule (configurable epochs with reward weights)
- [X] Bonus Multipliers (early join, volume tiers, holding duration)
- [X] Dynamic Emissions Adjuster (adaptive scaling + reduction floor)
- [X] Incentive Summary Endpoint (current & next epoch parameters, weights, bonuses)

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

- [ ] Offchain Whitelisting & KYC (prize distribution)
	- [ ] Offchain KYC workflow integration (optional: third-party provider) + admin approval flow
	- [ ] Admin UI for whitelist, revoke, and manual payout exceptions
	- [ ] Audit events emitted for KYC/whitelist changes

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

- [ ] Live-Ops UX & Demo Mode (high priority)
	- [ ] Real-time leaderboard with replay capability and progressive loads
	- [ ] Observable demo mode: pre-seeded testnet data + deterministic replay script for judges
	- [ ] Visualize fees, NAV, and ETF create/redemption flows in admin/demo UI
	- [ ] Frontend hooks to pull confidence_score and show valuation confidence bands

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

- [ ] Hardening & Observability (high priority)
	- [ ] Automated stress test harness to simulate high tx volumes (trades + joins) and assert latency/throughput
	- [ ] Prometheus dashboards + alert rules for ingestion/backfill failure, mapping_size regressions, and replay backlog
	- [ ] SLO docs and runbook for incident response (ingestion/backfill/finalization failures)
	- [ ] Smoke tests for settlement flow and replay after service restart

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

- [ ] Marketplace / SDK Purchase Integration
	- [ ] Integrate `@doma-protocol/orderbook-sdk` purchase/listing flows into frontend so users can buy domains directly (demo/testnet)
	- [ ] Expose a simple "Buy" action on domain cards that uses Viem/Wagmi -> SDK flow with progress callbacks
	- [ ] End-to-end test and demo script showing UI -> SDK -> on-chain purchase -> backend ingestion

---

## Track 2 — Judges-ready (Flawless Win) Checklist

Goal: turn the platform from demo-ready into a judges-proof submission for Track 2. Each item should be either [X] Done or [ ] Verified in live testnet demo with artifacts.

- [ ] Demo Script & Video
	- [ ] Short walkthrough video (3-5m) demonstrating: create competition → join → mint USDC (dev) → trade → leaderboard update → settlement payout
	- [ ] Written demo script with exact wallet addresses and timings for judges

- [ ] Seeded Testnet Dataset
	- [ ] Pre-seed competition + wallets + trades so judges can hit "play" on demo mode
	- [ ] Provide deterministic replay tooling and manifest (JSONL of events)

- [ ] Valuation Ensemble Evidence
	- [ ] Show sample valuation outputs with confidence band and chosen_source annotated in factor transparency endpoint
	- [ ] Unit tests and a short tech note describing ensemble weights and fallback chain

- [ ] On-chain Settlement Proof
	- [ ] Smart contract deployed on testnet with verified source and a tx demonstrating USDC payout
	- [ ] Backend shows proof of on-chain settlement (tx hash cross-check, merkle inclusion if applicable)

- [ ] Observability Artifacts
	- [ ] Prometheus metrics screenshot (ingestion rate, mapping_size, backfill success/failures)
	- [ ] Stress test report (N trades, p95 latency, errors) attached to the submission

- [ ] Fraud & Governance Controls
	- [ ] Offchain whitelist/KYC demo for prize distribution with admin approval flow
	- [ ] Admin commands to replay missing events and reconcile leaderboards

- [ ] Marketplace Purchase Flow
	- [ ] Live demo of purchasing a domain using the integrated SDK flow (progress callbacks visible)

- [ ] Submission Artifacts
	- [ ] README appendix with commands to reproduce demo locally + docker-compose for judges
	- [ ] Short troubleshooting runbook for judges (how to restart services, replay events, re-run settlement)

Each item above should be linked inside the repo (or included in the submission bundle) and marked Done/Verified before final submission.

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
- 2025-09-04: Implemented periodic Merkle snapshot scheduler + stub chain ingestion audit events; unified fee event proofs endpoint & frontend integration with optimistic events.
- 2025-09-04: Added Settlement Provenance & Verification README section (Merkle proofs, integrity hash chain, streaming export docs, redemption semantic validation env vars).
 - 2025-09-05: Completed On-chain Competition Settlement (contract, payout events, backend submit/verify with semantic receipt checks, Hardhat test, demo script, frontend admin UI hooks).

---

## Update Guidelines

Maintain chronological log in "Recently Completed". Move tasks from [~] to [x] only when feature has: endpoint(s), tests, and (if applicable) docs.
