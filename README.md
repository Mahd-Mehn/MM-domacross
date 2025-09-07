# DomaCross: Cross-Chain Domain Trading Competitions & Transparent Domain ETF Pipeline

> Hackathon Submission – Doma Protocol DomainFi Builders (Track 2: Trading Competitions & Portfolio Tools)

---

## 📌 Executive Summary

DomaCross converts opaque domain NFT speculation into a transparent, auditable competitive arena that graduates proven traders into ETF‑style domain portfolio managers. It combines:

* Competition lifecycle & live performance telemetry (valuations, trades, risk, execution quality).
* Multi-factor valuation oracle (trade VWAP, orderbook mid, top bid soft floor, last sale median, time‑decayed anchor, dispute clamp, ensemble stub) producing reproducible fair values.
* Integrity substrate (rolling hash chain + periodic Merkle snapshots + signature stub) for verifiable settlement and emission provenance.
* ETF NAV & fee accrual engine enabling passive exposure and secondary transaction vectors (issuance/redemption arbitrage, APY capture).
* Deterministic replay dataset & JSONL manifests for instant judge verification, regression safety, and analytics reproducibility.

This pipeline aligns incentives: transparency → confidence → tighter spreads → higher turnover → richer NAV & fee signals → targeted emissions → sustained liquidity → credible track record → ETF capital inflow.

---

## 🏁 Hackathon Context & Submission Alignment

| Item                          | Summary                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Track                         | **Track 2 – Trading Competitions & Portfolio Tools**                                                                                                                                                   |
| Core Thesis                   | Turn domain NFTs (RWA-style primitives) into an actively tradable, yield-bearing competitive asset class via on‑chain portfolio competitions + ETF abstraction.                                              |
| Problem                       | Fragmented price discovery & opaque domain valuation hamper liquidity and composability.                                                                                                                      |
| Solution                      | Real‑time competition engine + transparent valuation oracle + ETF wrapper producing NAV, flows, fees & APY → drives repeat transactions and data-rich on-chain activity.                                    |
| Doma Integration              | Uses Doma testnet domains,  orderbook & marketplace ingestion via the sdk, oracle-style valuation factors, whitelist / policy hooks, and on‑chain settlement proof paths.                                   |
| On‑Chain Impact Levers       | High-frequency leaderboard updates, valuation batch triggers, issuance/redemption flows for ETF shares, fee accrual/distribution events, dispute + governance actions.                                        |
| Differentiators               | Replayable full demo dataset (JSONL), valuation transparency (factors + confidence), ensemble (multi-source) roadmap, anti‑abuse risk flags, deterministic seeded competition enabling instant judge review. |
| Current Status (Sept 6, 2025) | Phase 9 complete (live-ops, transparency, demo mode). Extended valuation (top_bid + last_sale_median). Next: custody & prize escrow contracts, multi-oracle adapter, basket tokenization.                     |

### 🧾 Hackathon Submission Capsule (Track 2 Compliance)

> This capsule gives judges a single, copy/paste friendly summary of required submission artifacts and Track 2 alignment. Fill any `TODO` items before final submission.

| Requirement / Element | Status | Location / Link / Notes |
| --------------------- | ------ | ----------------------- |
| Track Selected | ✅ | Track 2 – Trading Competitions & Portfolio Tools |
| Public GitHub Repo | ✅ | This repository (MIT licensed) |
| Doma Protocol Usage (explicit) | ✅ | See “Doma Testnet Integration (Hackathon Scope)” below |
| Competition & Leaderboard Implementation | ✅ | Live: backend + websocket events (`leaderboard_delta`) |
| On‑Chain / Contract Layer | 🚧 | Stub contracts deployed (list in Contracts Address Table) – custody & escrow next |
| Valuation Heuristics / Oracles | ✅ (heuristics), 🚧 (multi-oracle) | Factors: VWAP, orderbook_mid, top_bid, last_sale_median, decay; external oracle adapter planned Phase 10 |
| Whitelisted Operations / Policy Hooks | ✅ (API / policy endpoints) | `policy/*` endpoints + whitelist gating logic (contracts whitelist pending) |
| Derived / Basket / ETF Mechanic | ✅ (ETF service scaffold), 🚧 (on-chain basket token) | NAV computation + fee events; basket tokenization roadmap Phase 11 |
| Prize Escrow & Automated Distribution | 🚧 | Manual/stub flow; escrow contract in roadmap Phase 10 |
| Promotion / Strategy Vault Path | ✅ (event & stub design) | Winner promotion hook (StrategyVault stub) planned post-settlement |
| Replay & Deterministic Dataset | ✅ | `seed_demo_dataset` + `demo-manifest.*.jsonl` |
| Integrity / Auditability | ✅ | Rolling hash + Merkle snapshots + audit export endpoints |
| Risk / Anti‑Abuse Controls | ✅ (backend) | Wash / rapid flip / self-cross / circular pattern flags |
| KYC / Governance Hooks | ✅ (API) | Policy & KYC endpoints; gating of reward claims |
| Demo Video (Recorded) | 🚧 (TODO) | Placeholder: `https://youtu.be/VIDEO_ID_TODO` |
| Live / Test Deployment (Optional) | 🚧 | Placeholder: `https://demo.domacross.xyz` |
| Project X/Twitter Account | 🚧 (TODO) | Placeholder: `https://twitter.com/DomaCrossApp` |
| Contract Addresses Table | 🚧 | Add table below before submission |
| Metrics Snapshot (tx count, participants) | 🚧 | Provide quick script outputs (see Metrics Collection section) |
| Ambassador Challenges (Bonus) | Optional | Note any completed in PR description if done |

#### Contract Addresses (Testnet – Fill Prior to Submission)

| Contract | Address | Notes |
| -------- | ------- | ----- |
| CompetitionFactory | `0x________` | Deploy via Hardhat script; emits CompetitionCreated |
| Competition (example) | `0x________` | Created instance for demo (ID 1) |
| ValuationOracle (stub) | `0x________` | Emits factor events (planned) |
| PrizeEscrow (planned) | `—` | To deploy Phase 10 |
| BasketToken / NAV (planned) | `—` | Snapshot or dynamic basket token |

> Keep this table minimal & accurate; remove planned rows if not deployed.

#### Doma Testnet Integration (Hackathon Scope vs Roadmap)

| Aspect | Implemented Now | Roadmap Extension |
| ------ | ---------------- | ----------------- |
| Domain Entity Ingestion | SDK / API stubs + local dataset | Live streaming from Doma marketplace events |
| Valuation Factors | Heuristic multi-factor (see list) | External oracle weighting + ML confidence refinement |
| Competition Lifecycle | Backend state + events | Fully on-chain custody / settlement proofs |
| Whitelist & Policy | API enforced | Contract-level operation allow-list + timelock governance |
| Derived Instruments | NAV service scaffold | Basket token mint/redeem + secondary liquidity pool |
| Prize Flow | Manual claim stub | Automated escrow contract + PrizeClaimed event |

#### Metrics Collection (Populate Before Final Submission)

Run after a realistic 5–10 minute session (scripted or replay) to produce transparent numbers:

```bash
# Count total trades (fills)
psql $DATABASE_URL -c "select count(*) from trades;"

# Unique active participants
psql $DATABASE_URL -c "select count(distinct wallet_address) from competition_participants;"

# Valuation snapshots produced
psql $DATABASE_URL -c "select count(*) from valuations;"

# Current leaderboard (top 5)
psql $DATABASE_URL -c "select wallet_address, score from leaderboard_entries order by score desc limit 5;"
```

Paste the outputs into a short “Metrics Snapshot” subsection or attach as an image in the demo video description.

#### Final Submission TODOs Checklist

- [ ] Insert final demo video URL
- [ ] Insert Twitter handle & ensure at least 1 pinned teaser tweet
- [ ] Populate contract addresses table
- [ ] Capture metrics snapshot & insert outputs
- [ ] (Optional) Deploy temporary public demo & add URL
- [ ] Verify LICENSE & README unchanged except for completion updates
- [ ] Run replay script successfully (document exit code 0)

---

### Judging Criteria Mapping

| Criteria                          | Weight | How Addressed                                                                                                                                                                                                                                      |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Innovation                        | 40%    | ETF abstraction + dispute-aware valuation + deterministic replay + integrity chain + ensemble roadmap (multi‑oracle + ML confidence) + execution & risk telemetry.                                                                               |
| Doma Integration & Onchain Impact | 30%    | Domain valuation & trading events reference Doma tokenized domains; ingestion & orderbook snapshot stubs ready; settlement verification, whitelist/KYC, policy governance, NAV + fee accrual designed for on-chain metrics (tx volume, NAV churn). |
| Usability                         | 20%    | Next.js dashboard: live leaderboard, valuation panel, ETF NAV/flow charts, replay mode (Sample/Full manifests), compact risk/execution charts, pause & refresh controls. Deterministic seed script = zero-friction spin‑up.                       |
| Demo Quality                      | 10%    | Full JSONL manifest + toggle, scripted dataset seeding, panels synchronized to replay, EVENTS.md schemas, clear demo path below.                                                                                                                   |

### Key Dates & Timeline (Hackathon)

| Milestone              | Date (UTC)   |
| ---------------------- | ------------ |
| Pre‑Registration Open | Aug 9 2025   |
| Submissions Open       | Aug 16 2025  |
| Submission Deadline    | Sept 12 2025 |
| Winners Announced      | Oct 3 2025   |

### Submission Checklist (Repository Artifacts)

| Requirement                    | Status | Location / Notes                                                      |
| ------------------------------ | ------ | --------------------------------------------------------------------- |
| Public GitHub Repo             | ✅     | This repository                                                       |
| Doma Usage Description         | ✅     | Sections: Doma Integration & Architecture, Track Fit guide            |
| Track Goal Alignment           | ✅     | This README (Track Fit) +`docs/hackathon-track2-summary.md`         |
| Demo & Walkthrough (recording) | 🚧     | To be added (`/docs/demo-playbook.md`) – script + commands present |
| Active Project X/Twitter       | 🚧     | Placeholder handle to be inserted before submission                   |
| Ensemble / Valuation Evidence  | ✅     | Transparency endpoint + factors + chosen_source (ensemble stub)       |
| Replay / Deterministic Dataset | ✅     | `seed_demo_dataset.py` + `demo-manifest.*.jsonl`                  |
| Governance / Policy + KYC      | ✅     | Policy & KYC endpoints (README section)                               |
| On-Chain Settlement Proof Path | ✅     | Competition settlement contract + backend verification endpoints      |

> License: MIT license included (see `LICENSE`).

---

## 📚 Table of Contents

1. Executive Summary
2. Hackathon Alignment
3. Quick Start
4. Architecture Layering
5. Valuation Methodology & Ensemble Roadmap
6. Competition Lifecycle & Data Flows
7. Integrity & Audit Chain
8. Economic & Incentive Loop
9. Policy / KYC / Governance & Risk Controls
10. Events & API Surface
11. Replay & Demo Guide
12. Roadmap (Phase Matrix)
13. Deployment & Production Notes
14. Testing & Performance
15. Contributing / License / Support

---

---

A decentralized platform for competitive domain trading built on Doma's multi-chain infrastructure.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL
- Redis
- Docker & Docker Compose

### 1. Environment Setup

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Required: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
# Optional: Blockchain RPC URLs, JWT keys
```

### 2. Start Infrastructure

```bash
# Start databases and services
docker-compose up -d db redis

# Wait for services to be ready
sleep 10
```

### 3. Setup Backend

```bash
cd apps/api

# Install dependencies
pip install -r requirements.txt

# (Optional) Deterministic seeded dataset + replay manifests
python -m app.cli.seed_demo_dataset

# Start API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Enable ensemble valuation (optional):

```bash
export VALUATION_USE_ENSEMBLE=1  # restart API if already running
```

### 4. Setup Frontend

```bash
cd apps/web

# Install dependencies
npm install

# Start development server
npm run dev
```

### 5. Deploy Smart Contracts (Optional)

```bash
cd contracts

# Install dependencies
npm install

# Deploy to local network
npx hardhat run scripts/deploy.ts --network hardhat

# Or deploy to testnet (configure .env first)
npx hardhat run scripts/deploy.ts --network doma_testnet
```

## 🏗️ Architecture (Layered)

| Layer | Responsibility | Key Artifacts |
|-------|----------------|---------------|
| UI / App | User workflows, telemetry visualization, replay, optimistic UX | Next.js app, React Query hooks (`useOrderbookActions`, valuation panel, risk charts) |
| API Core | Competition lifecycle, valuation batches, ETF NAV, rewards, risk metrics, policy, KYC | FastAPI routers & services (`valuation_service`, `metrics_service`, `audit_service`) |
| Persistence | Durable state & analytical factors | PostgreSQL (domains, trades, listings/offers, valuations, audit_events, merkle_snapshots, governance, competitions, escrow) |
| Integrity | Tamper evidence & cryptographic summarization | Rolling SHA-256 integrity hash + periodic Merkle snapshots + (stub) signature |
| Valuation Oracle | Multi-factor fair value & dispute dampening | Heuristic blend + orderbook mid + top bid + last sale median + decay + ensemble stub |
| Incentives | Emissions + retroactive KYC claim gating | Epoch reward processing, gated reward claim endpoints |
| Contracts (current) | Competition / oracle scaffolding | Solidity stubs (Hardhat) |
| Contracts (next) | Custody, prize escrow, basket tokenization, multi-oracle commit | Roadmap phases 10–12 |

### Runtime Flow Snapshot
Listings/offers & trades → factor snapshots → valuation batch → valuation_update & leaderboard_delta → NAV recompute & fee accrual → audit events → Merkle snapshot → emissions distribution (risk & performance aware) → replay / export.

## 🔍 Valuation Methodology & Roadmap

| Component | Status | Role |
|-----------|--------|------|
| Trade VWAP (recent window) | ✅ | Primary liquidity anchor when sample threshold met |
| Orderbook Mid (median of medians) | ✅ | Structural price reference |
| Top Bid Soft Floor | ✅ | Avoids drift far below active liquidity intent |
| Last Sale Median | ✅ | Robust executed price central tendency |
| Decayed Prior Anchor | ✅ | Temporal smoothing & fallback | 
| Dispute Clamp | ✅ | Stability during contested shifts |
| Ensemble External Oracle Stub | ✅ | Multi-source convergence scaffold |
| ML Adaptive Regressor (variance aware) | ✅ | Smoothing & dynamic confidence | 
| Multi-Oracle Aggregator | 🚧 | Weighted consensus + staleness penalties |
| Basket / Derived Asset NAV Inputs | Planned | Extend factor graph to synthetic instruments |

Confidence heuristic currently = inverse relative dispersion (heuristic vs stub vs ML). Will expand with real oracle adapters + quorum weighting + penalty for stale feeds.

Soft Floor Logic: if final < 70% of top bid → blended lift midpoint between final and 70% * top bid (caps undervaluation without fully overriding fundamentals).

Dispute Handling: OPEN dispute with votes ≥ threshold clamps valuation to prior (prevents manipulation cascades into NAV & rewards).

Integrity of Factors: Each valuation insertion records raw component values & weights for audit & reproducibility.

---

### Frontend (Next.js + TypeScript)

- **Location**: `apps/web/`
- **Features**: Wallet connection, competition browsing, dashboard
- **Tech Stack**: Next.js, React, Tailwind CSS, Wagmi, React Query

### Backend (FastAPI + Python)

- **Location**: `apps/api/`
- **Features**: Authentication, competition management, portfolio tracking
- **Tech Stack**: FastAPI, SQLAlchemy, PostgreSQL, Redis

### Smart Contracts (Solidity)

- **Location**: `contracts/`
- **Features**: Competition logic, portfolio tracking, prize distribution
- **Tech Stack**: Hardhat, OpenZeppelin, Solidity

## 📁 Project Structure

```
├── apps/
│   ├── api/                 # FastAPI backend
│   │   ├── app/
│   │   │   ├── models/      # Database models
│   │   │   ├── routers/     # API endpoints
│   │   │   ├── schemas/     # Pydantic schemas
│   │   │   ├── services/    # Business logic
│   │   │   └── main.py      # FastAPI app
│   │   ├── requirements.txt
│   │   └── seed.py          # Database seeder
│   └── web/                 # Next.js frontend
│       ├── app/             # Next.js app router
│       ├── components/      # React components
│       ├── lib/             # Utilities
│       └── package.json
├── contracts/               # Solidity smart contracts
│   ├── contracts/           # Contract source files
│   ├── scripts/             # Deployment scripts
│   ├── test/                # Contract tests
│   └── hardhat.config.ts
├── infra/                   # Infrastructure configs
│   └── docker/              # Dockerfiles
├── docker-compose.yml       # Local development setup
└── .env.example             # Environment template
```

## 📚 Docs Index

| Topic                 | Path                                         | Notes                                     |
| --------------------- | -------------------------------------------- | ----------------------------------------- |
| Track 2 Summary       | `docs/hackathon-track2-summary.md`         | Condensed judging alignment               |
| Demo Playbook         | `docs/demo-playbook.md`                    | Narrated 3–5 min script & flow           |
| Architecture Overview | `docs/architecture-overview.md`            | Diagram placeholder (to finalize)         |
| Secret Handling       | `docs/secret-handling.md`                  | Dev vs prod guidance & rotation roadmap   |
| Performance Report    | `docs/perf-report.md`                      | Populate with p50/p95 using scripts       |
| Ensemble Sample       | `docs/samples/ensemble-sample.json`        | Chosen source + confidence example        |
| Valuation ADR         | `docs/adr/adr-001-valuation-heuristic.md`  | Accepted (heuristic + ensemble stub)      |
| Incentives ADR        | `docs/adr/adr-002-incentives-emissions.md` | Accepted (composite metrics)              |
| Events Schema         | `EVENTS.md`                                | Completed (v1.1 valuation + placeholders) |

> Pending before submission: diagrams, ADRs, EVENTS.md, populated perf metrics.

## 📈 Economic Narrative & Yield Flow

The system creates a self-reinforcing loop: transparent valuations → tighter spreads → higher trade velocity → richer NAV signal → credible ETF share issuance/redemption → fee accrual → emissions + rewards recycling into further activity.

### Flow Diagram (Concept)

```
 User Trades ↔ Listings/Offers -----> Trade Events -----> Competition Engine (score updates)
      |                                    |                     |
      v                                    v                     v
   Orderbook State ----------------> Valuation Engine ------> Valuation Events
      |                                    |                     |
      +--> External Oracle / ML (future)    |                     |
                          v                     |
                      ETF NAV Service  <-----------+
                          |
                  Fees / Flows / APY Events
                          |
                          v
                    Incentive Scheduler (emissions)
                          |
                          v
                    Participant Rewards → More Trading
```

### Value Drivers

| Driver                | Mechanism                                       | Outcome                         |
| --------------------- | ----------------------------------------------- | ------------------------------- |
| Transparency          | Factor + confidence panel                       | Trust & fair pricing perception |
| Replay Dataset        | Instant walkthrough & analytics reproducibility | Faster onboarding               |
| ETF Wrapper           | Aggregates domain set into single NAV share     | Attracts passive liquidity      |
| Emissions             | Rewards diversified, performant activity        | Sustains early liquidity        |
| Settlement Provenance | Cryptographic audit chain + Merkle roots        | Verifiable integrity            |

## 🗺️ Architecture Diagram (Mermaid)

Below is the rendered mermaid diagram (GitHub-supported). Source also in `docs/architecture-diagram.mmd`.

```mermaid
flowchart LR
   subgraph User & Client
      A[User Actions]
      UI[Next.js Dashboard]
   end
   A --> UI
   UI -->|REST / WS| API[(FastAPI Backend)]
   subgraph Trading
      L[Listings]
      O[Offers]
      T[Trades]
      DS[(Domain State)]
   end
   API --> L
   API --> O
   L --> T
   O --> T
   T --> DS
   L --> DS
   O --> DS
   subgraph Valuation
      VE[Valuation Engine\n(factors)] --> EN[Ensemble Stub]
   end
   DS --> VE
   EN --> VEVT{{valuation_update}}
   subgraph Competition
      CE[Competition Engine]
      LEAD{{leaderboard_delta}}
   end
   T --> CE
   VEVT --> CE
   CE --> LEAD
   subgraph ETF
      NAV[ETF NAV Service]
      FEES{{fee/flow events}}
   end
   DS --> NAV
   VE --> NAV
   NAV --> FEES
   NAV --> APY[(NAV/APY History)]
   subgraph Incentives
      EM[Emission Scheduler]
      RW[Rewards]
   end
   CE --> EM
   FEES --> EM
   EM --> RW --> A
   subgraph Integrity
      AE[Audit Events]
      MS[Merkle Snapshots]
   end
   T --> AE
   CE --> AE
   FEES --> AE
   VEVT --> AE
   AE --> MS
   subgraph Risk
      RG[Risk Heuristics]
      RF{{risk_flag}}
   end
   T --> RG --> RF
   RF --> CE
   classDef ws fill=#e3f2fd,stroke=#2196f3,color=#0d47a1
   class VEVT,LEAD,FEES,RF ws
```

## 🔑 Key Features

- **Wallet Authentication**: EIP-191 signature-based auth
- **Competition Management**: Create, join, and track competitions
- **Portfolio Tracking**: Real-time portfolio valuation
- **Leaderboard System**: Rank participants by performance
- **Real-Time Trading Feed**: WebSocket sequencing with gap detection + incremental backfill (`since_seq`)
- **Listings & Offers Lifecycle**: Create / buy / cancel listings, create / accept / cancel offers (SDK-first)
- **Optimistic UI Updates**: Temp entries reconciled via contract+token mapping
- **Event Store & Activity Feed**: In-memory circular buffer (capture + export/import replay)
- **Replay Controls**: Capture toggle, export/import JSON, timed playback with speed control
- **Demo Dataset & Full Replay Manifest**: Deterministic seed script + comprehensive 20s manifest (listings/offers/fills/cancels/valuations/NAV/flows/fees)
- **Valuation Panel**: Live `valuation_update` event digestion with delta % computation
- **Leaderboard Panel**: Session-scope live score aggregation from `leaderboard_delta`
- **Offer Multi-Currency Support**: Dynamic supported currencies enumeration + correct decimals handling
- **Cross-Chain Ready**: Architecture supports multiple blockchains
- **Database Schema**: Complete PostgreSQL schema
- **API Endpoints**: RESTful APIs for all features
- **Smart Contracts**: Competition, portfolio, and oracle contracts
- **Frontend UI**: Modern React components with Tailwind CSS

### 🚧 In Progress

- **Advanced Trading Enhancements**: Extended order types, batch actions
- **Prize Distribution**: Automated winner payouts
- **Cross-Chain Integration**: Doma bridge integration
- **Playback UX Improvements**: Timeline scrubber & label overlay for replay mode
- **Auth Hardening**: WebSocket auth tokens for private event scopes
- **On-Chain Event Backfill**: Historical sync & reorg safety
- **Valuation Ensemble (Phase 10)**: Optional multi-source blend (heuristic + external oracle stub + ML placeholder) with confidence multiplier – toggle via `VALUATION_USE_ENSEMBLE=1` (see `docs/samples/ensemble-sample.json`).

### Track 2 (Trading Competitions & Portfolio Tools) Fit

Competitive domain trading drives order flow; ETF abstraction & valuation fairness mechanisms create repeatable reasons to transact (rebalancing, arbitrage of mispriced domains, fee & APY capture). The platform surfaces:

- Real-time leaderboards (incentivizes frequent domain trades)
- Transparent valuations (reduces information asymmetry; boosts confident bidding/listing)
- ETF issuance/redemption & fee events (secondary transaction vector)
- Replay / synthetic dataset (accelerates user onboarding & judge verification)
- Risk & execution quality metrics (surface trading performance insights -> retention)

## � Testing

## 🔄 Real-Time Architecture Overview

| Component             | Description                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebSocket Sequencing  | Every event assigned a monotonically increasing `seq`; clients persist last applied seq in `localStorage` (`rt_seq`).                             |
| Gap Detection         | If incoming `seq > last_seq + 1`, client triggers incremental backfill via REST using `?since_seq=<last_seq>`.                                      |
| Differential Backfill | `/api/v1/listings` & `/api/v1/offers` accept `since_seq` returning only newly created active entries.                                             |
| Optimistic Entries    | Temporary IDs (`temp-*`) inserted immediately; replaced when authoritative `listing_created` / `offer_created` arrives (match by contract+token). |
| Event Store           | Lightweight in-memory buffer (max 300) with capture toggle; supports replay export/import JSON (versioned).                                             |
| Replay Controls       | UI allows capture enable/disable, export, import, and timed playback dispatching events as custom `doma-replay-event`.                                |
| Panels                | Valuation panel consumes `valuation_update`; leaderboard panel aggregates `leaderboard_delta`.                                                      |

### Event Types (Frontend Focus)

`listing_created`, `listing_filled`, `listing_cancelled`, `offer_created`, `offer_accepted`, `offer_cancelled`, `valuation_update`, `leaderboard_delta`

### Optimistic Replacement Logic

Listings & offers initially rendered with `temp-*` IDs; when the real event shares contract + tokenId, temp entry is replaced preserving insertion order.

## 🎛 Replay & Capture Usage

1. Ensure activity is generating events (listings/offers or valuation batch calls).
2. In Dashboard -> Recent Activity card, toggle Capture (green = on).
3. Perform actions, then Export to download `events_capture.json`.
4. Import the same (or modified) file and click Replay. Panels listening to `doma-replay-event` update without touching live seq state.
5. Adjust speed (200ms, 500ms, 1000ms) for slower/faster playback.

### 🎬 Demo Dataset & Replay Mode

A deterministic demo dataset + expanded replay manifest enables instant showcase without manual actions.

Seed the dataset:

```bash
cd apps/api
python -m app.cli.seed_demo_dataset
```

Start services then open the dashboard with `?demo=1` to enable Demo Mode controls:

```
http://localhost:3000/dashboard?demo=1
```

Manifests:

- `demo/demo-manifest.sample.jsonl` (minimal quick run)
- `demo/demo-manifest.full.jsonl` (~20s sequence: listings / offers / fills / cancels / valuations across 10 domains + ETF NAV, flows, fee accruals, leaderboard deltas)

Switch manifests via the Sample / Full buttons in the Demo Replay section of `LiveOpsPanel`.

## 💱 Multi-Currency Offers

Offer form fetches supported currencies via SDK (`getSupportedCurrencies`). Selected currency's decimals determine unit conversion (`parseUnits` equivalent via `viem`). Last chosen currency persists in `localStorage` (`offer_currency`).

## 📊 Valuation Updates

`POST /valuation/batch` triggers server-side valuation computations. Backend emits `valuation_update` with optional `previous_value` & `change_pct`. Frontend panel computes delta fallback if not provided and lists most recent per domain.

## 🧩 Leaderboard Deltas

`leaderboard_delta` events accumulate session scores per address. Client aggregates in-memory (no persistence yet) and renders top 25. Future work: merge with server authoritative rankings & add paging.

## 🔐 Pending Hardening Items

- WebSocket authentication (token / signature) for private scopes.
- Replay isolation guardrails (currently separate custom event channel; maintain).
- Rate-limited backfill on repeated gap triggers.
- Cleanup of stale optimistic entries if authoritative event never arrives (time-based eviction).

### Smart Contracts

```bash
cd contracts
npx hardhat test
```

### API

```bash
cd apps/api
# Run with pytest or manual testing
pytest -q
```

#### Audit Export Resume Test

We provide a JSONL audit export with cursor-based resumption:

Endpoint: `GET /api/v1/settlement/audit-export?limit=5000&after_id=<last_id>` (admin only)

## 🛡️ Anti-Abuse & Risk Controls

| Control                                  | Description                                                | Trigger / Window                                       | Persistence                                             |
| ---------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Rate Limiting                            | Per-wallet & per-IP token bucket                           | N trades/min (configurable burst)                      | In-memory + Redis ZSET (timestamps)                     |
| Circuit Breaker                          | Halts trading on extreme NAV move                          | Absolute NAV move >= threshold bps over rolling window | In-memory + Redis key with TTL                          |
| Wash Trade Detection                     | Opposite side trade by same participant on domain          | 120s window                                            | DB `trade_risk_flags` + websocket `risk_flag` event |
| Rapid Flip Detection                     | >=3 flips (side changes) then new trade flags              | 10m window                                             | DB + websocket                                          |
| Self-Cross                               | Opposite side within 30s (tighter wash)                    | 30s window                                             | DB + websocket                                          |
| Circular Pattern                         | Domain traded among ≥3 participants and returns to origin | 10m sequence scan                                      | DB + websocket                                          |
| Idempotent Redemption Intent             | Prevent duplicate redemption creation                      | Idempotency-Key header                                 | `idempotency_keys` table                              |
| Idempotent Competition Settlement Submit | Prevent duplicate settlement submissions                   | Idempotency-Key header                                 | `idempotency_keys` table                              |

### Redis Behavior

If `REDIS_URL` is set:

- Rate limiting buckets stored as sorted sets: `abuse:bucket:<wallet_or_ip>`
- Circuit breaker flag stored as `abuse:circuit_breaker` with TTL = breaker window.
  Fallback gracefully degrades to in-memory structures if Redis unreachable.

### WebSocket Risk Events

Clients subscribe using: `GET /ws?events=risk_flag`.
Payload shape:

```json
{ "type": "risk_flag", "trade_id": <int>, "flag_type": "WASH_LIKELY|RAPID_FLIP|SELF_CROSS|CIRCULAR_PATTERN" }
```

Events are emitted synchronously after trade processing; tests assert contract.

### Extensibility Roadmap

- Expand idempotency to issuance / other settlement intents.
- Add anomaly scoring (z-score on trade frequency) feeding a `ANOMALY` flag.
- Persistence of rolling participant metrics for ML-based flagging.

## 📝 Policy, Whitelisting & KYC (Phase 7)

| Component          | Endpoint(s)                                                               | Description                                                                                              |
| ------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Domain Whitelist   | `GET/POST/DELETE /api/v1/policy/whitelist`                              | Admin CRUD for allowed domains (if any active entries exist all listings/offers/buys restricted to set)  |
| Governance Config  | `GET /api/v1/policy/config`, `POST /api/v1/policy/config/{key}`       | Key/value config store for tunable governance parameters (JSON values)                                   |
| KYC Requests       | `POST /api/v1/policy/kyc/request`                                       | User submits optional document hash for verification                                                     |
| KYC Review         | `GET /api/v1/policy/kyc/requests` + `POST .../approve                   | reject`                                                                                                  |
| Admin Action Audit | `GET /api/v1/policy/audit`                                              | Immutable log of admin policy actions (whitelist, KYC, config)                                           |
| Reward KYC Gating  | (server internal)                                                         | Epoch reward distribution zeroes reward_amount for non‑KYC users (raw amount preserved for later claim) |
| Reward Claim       | `POST /api/v1/competitions/{competition_id}/epochs/{epoch_index}/claim` | User reclaims previously gated reward once KYC passes (retroactive)                                      |

KYC Flow:

1. User calls submit endpoint (status=PENDING).
2. Admin reviews pending queue, approves (sets `kyc_verified=true`) or rejects (status=REJECTED with notes).
3. Distribution logic writes both `raw_reward_amount` and gated `reward_amount`. Non‑verified users get `reward_amount=0` but retain `raw_reward_amount` for later claim.
4. After approval, user calls claim endpoint to set `reward_amount = raw_reward_amount` and mark `claimed_at` (idempotent).

Admin Authentication: wallets listed in `ADMIN_WALLETS_ENV` (comma or JSON list) are treated as admins on startup; plus per‑user `is_admin` boolean allows manual elevation.

Whitelist Enforcement Logic: Listing / offer / buy endpoints query active whitelist rows. If any exist, domain must be present or a 400 error (`domain not whitelisted`) is returned. ETF creation already enforced previously.

Audit Coverage: Every policy change inserts `admin_action_audit` row: action types include `WHITELIST_ADD`, `WHITELIST_DEACTIVATE`, `GOV_CONFIG_CREATE`, `GOV_CONFIG_UPDATE`, `KYC_APPROVE`, `KYC_REJECT`, `WHITELIST_REACTIVATE`.

Realtime Events (emitted over `/ws` when subscribed):

- `policy_change` (subtype: whitelist_add|whitelist_reactivate|whitelist_deactivate|config_upsert)
- `kyc_status` (status transitions: PENDING, APPROVED, REJECTED)
- `reward_claim` (user successfully claims retroactive reward)

Roadmap Additions (remaining / future hardening):

- On-chain settlement verification for claimed rewards.
- Admin UI live refresh via websocket (already receiving events; add optimistic update patterns).
- KYC document storage off-chain with signed hash anchoring.

Headers returned:

* `X-Next-Cursor`: last event id in the batch (use as `after_id` to resume)
* `X-Integrity-OK`: `true|false` if integrity chain verification passed when `verify_integrity=true`

Example pagination loop (pseudo):

```python
cursor = None
while True:
   params = {'limit': 2000}
   if cursor:
      params['after_id'] = cursor
   r = GET('/settlement/audit-export', params)
   lines = r.text.strip().split('\n') if r.text else []
   if not lines: break
   process(lines)
   cursor = r.headers.get('X-Next-Cursor')
   if not cursor: break
```

Streaming variant: `GET /api/v1/settlement/audit-export/stream` (server-sent JSONL until exhaustion) supports large range pulls without manual batching.

Integrity check: pass `verify_integrity=true` to recompute the rolling `integrity_hash` chain server‑side and expose `X-Integrity-OK` (non-stream) or per-line `integrity_ok` (stream).

#### Dispute WebSocket Events

Events schema (`GET /events/schema`) now includes:

* `dispute_quorum`: { domain, dispute_id, votes, threshold }
* `dispute_resolved`: { domain, dispute_id, final_status }

Subscribe via websocket:

```
ws = new WebSocket('ws://localhost:8000/ws');
ws.onopen = () => ws.send('SUB dispute_quorum,dispute_resolved');
```

Frontend component `DisputeBanner` listens and displays live dispute status for a domain.

See ADR for governance rationale: `docs/adr/adr-valuation-disputes.md`.

#### Ingestion / Merkle Snapshot Limitations (Phase 4)

Current implementation:

* Periodic Merkle incremental snapshot every 120s (`merkle_loop`).
* On-chain event ingestion: stubbed (blockchain receipt verification exists; continuous on-chain scan not yet implemented).
* Orderbook + reconciliation loops run only when external base URL provided.

Deferred / Not Yet Implemented:

* Full historical on-chain event backfill & gap reorg handling.
* Persistent external queue / dead-letter for failed snapshot operations.
* Parallel shard aggregation for very large audit logs (> millions events).

Mitigations / Next Steps:

1. Introduce block range cursor table and lightweight chain scanner task.
2. Add periodic integrity self-audit endpoint to compare DB chain vs recomputed digest offline.
3. Provide CLI utility to backfill snapshots for archival export.

Warnings: Pydantic v1-style config deprecation warnings are filtered in tests (see `pytest.ini`). Migration to Pydantic v2 style is a backlog item.

### Admin Gating & Settlement UI

The settlement admin panel (competition payout submission & verification) is gated client-side by the environment variable:

`NEXT_PUBLIC_ADMIN_WALLETS=0xAdmin1,0xAdmin2;0xAdmin3`

Accepted delimiters: comma, semicolon, or whitespace. Wallet addresses are matched case-insensitively. Only listed addresses will see the Settlement (Admin Demo) section on a competition detail page. Backend endpoints performing sensitive actions also enforce server-side checks using `settings.admin_wallets` loaded from API env (`ADMIN_WALLETS`).

To configure locally:

```
# apps/web/.env.local
NEXT_PUBLIC_ADMIN_WALLETS=0xB47269260Ae1bD614FDc37ADA0eB04Cdb93c5E95,0x364d11a2c51F235063b7DB5b60957aE2ea91ACEE

# apps/api/.env (or parent .env consumed by backend)
ADMIN_WALLETS=0xB47269260Ae1bD614FDc37ADA0eB04Cdb93c5E95,0x364d11a2c51F235063b7DB5b60957aE2ea91ACEE
```

If a user is not in the list, the admin UI does not render and protected endpoints return 403.

### Frontend

```bash
cd apps/web
npm run build  # Check for build errors
```

## 🚢 Deployment

### Doma Integration Notes

While certain marketplace / orderbook ingestion paths are stubbed for hackathon pacing, the abstraction points are in place:

- `orderbook_snapshot_service` & valuation factor `orderbook_mid` already integrated.
- Ingestion toggles (`enable_raw_chain_ingest`, `enable_chain_marketplace_events`) gate heavier sync when real RPC endpoints configured.
- Policy & whitelist endpoints mimic governance / permission channels for curated competitions.
- Merkle snapshot & settlement proof flows pave path to verifiable rewards distribution.

### Demo Script (Abbreviated)

1. Seed dataset: `python -m app.cli.seed_demo_dataset`.
2. Start API & Web; open `?demo=1` dashboard.
3. Toggle Full manifest; start replay → observe listings/offers/fills/valuations.
4. Open Valuation Transparency panel for a domain; note factors & chosen_source.
5. View ETF NAV / Flow charts; show fee accrual & (optionally) trigger distribution endpoint.
6. (Optional) Trigger a valuation batch; watch live `valuation_update` delta.
7. (Optional) Show dispute open & vote endpoints → observe clamp behavior.

Full scripted narration: `docs/demo-playbook.md` (includes recommended timestamps & talking points).

---

### Production Setup

1. Configure production environment variables
2. Deploy smart contracts to Doma testnet/mainnet
3. Build and deploy API to cloud (Railway, Heroku, etc.)
4. Build and deploy frontend to Vercel/Netlify
5. Set up monitoring and logging

### Docker Deployment

```bash
# Build all services
docker-compose build

# Start production stack
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: See `/docs` folder (coming soon)

---

Built with ❤️ for the Doma ecosystem Monorepo

Local-first dev on your VM with an AWS Terraform skeleton for later migration.

- Web: Next.js (apps/web)
- API: FastAPI (apps/api)
- Contracts: Hardhat (contracts)
- Docker: infra/docker/* and docker-compose.yml
- Terraform: infra/terraform/* (AWS skeleton)

## Quickstart (Local VM)

1. Copy envs
   cp .env.example .env
2. Start stack
   docker compose up --build

- Web: http://localhost:3000
- API: https://8000-01k4gmg9q2k5psffk18y0q47h1.cloudspaces.litng.ai/health
- Postgres: localhost:5432 (in container)
- Redis: localhost:6379 (in container)

## AWS (Later)

- See infra/terraform/ for skeleton modules (ECS/RDS/Redis/ALB/WAF/Secrets).
- Provide variables via tfvars and AWS credentials.

## Marketplace Data & Hooks

React Query hooks implemented (apps/web/lib/hooks):

- useDomain(name): consolidated domain + top listings/offers + latest valuation
- useListings(name), useOffers(name), useValuation(name): focused slices
- useValuationBatch(domains[]): batch valuation POST /api/v1/valuation/batch
- useCurrencies(): static currency metadata (extensible)
- useOrderbook(name): pulls live orderbook (SDK if available) every 15–20s
- useBuyDomain(), useMakeOffer(): trading mutations (SDK-first, API fallback placeholders)

Component: DomainMarketPanel (apps/web/components) demonstrates integration; navigate to /market/{domainName}.

Next steps: backend trading endpoints, real fee preview integration, websocket push for deltas.

### Schema Update (Marketplace Orders)

Added `external_order_id` columns to `listings` and `offers` for SDK order ID mapping. Create a new Alembic migration:

1. alembic revision -m "add external order ids" --autogenerate
2. alembic upgrade head

### Listing Expiry & Cleanup

Listings now include an `expires_at` timestamp (auto-set using `LISTING_TTL_DAYS`, default 30).

Admin-only endpoint to deactivate expired listings:

`DELETE /api/v1/market/expired/listings`

### Offer Acceptance

Accept an existing (active) offer via:

`POST /api/v1/market/accept-offer` with `offer_id` or `external_order_id`.

Frontend hook: `useAcceptOffer()` (gracefully falls back if SDK `acceptOffer` not yet available).

### Trade Attribution

Trades recorded from buys and accepted offers now only attribute to participants active within competitions whose time window currently includes the trade timestamp. This avoids polluting historical or future competitions with out-of-window trades.

Environment variable:

`LISTING_TTL_DAYS=30`  # adjust to shorten or lengthen default listing lifetime.

Run new migration adding `expires_at` to listings:

1. alembic revision -m "add listing expires_at" --autogenerate
2. alembic upgrade head

## 🔐 Settlement Provenance & Verification

The platform implements cryptographic provenance for settlement and fee events:

1. Every significant action records an `AuditEvent` with an integrity hash chain (`integrity_hash` links to the previous canonical JSON).
2. Periodic `MerkleSnapshot` rows are created from all audit event leaves; each snapshot root is RSA-signed (ephemeral or configured keys) and optionally anchorable on-chain (stubbed).
3. Clients fetch proofs via `/api/v1/settlement/audit-events/{id}/merkle-proof` or batched `/api/v1/settlement/snapshot-with-proofs`.
4. Public key exposed at `/api/v1/settlement/public-key` with strong caching + ETag for local verification of signatures.
5. Streaming export endpoints (`/api/v1/settlement/audit-export` and `/api/v1/settlement/audit-export/stream`) support JSONL export and optional integrity re-verification (sets `X-Integrity-OK` header or inline `integrity_ok` flags).

### Redemption Verification Flow

Redemption lifecycle:

1. Create intent: `POST /api/v1/etfs/{id}/redeem/intent`
2. Execute: `POST /api/v1/etfs/{id}/redeem/execute/{intent_id}?tx_hash=...` (records execution + audit event).
3. Submit proof (optional source of tx hash if not provided earlier): `POST /api/v1/settlement/etfs/{id}/redemption-proof/{intent_id}`.
4. On-chain semantic verification: `POST /api/v1/settlement/etfs/{id}/redemption-verify/{intent_id}` (auto-discovers tx hash from latest proof if not passed).
5. After success, `verified_onchain` flag gates finalization logic (execute endpoints require prior verification for subsequent settlement-sensitive actions).

Semantic checks (centralized in `app/services/redemption_validation.py`):

- Transaction status == 1
- Block number present
- `gasUsed >= REDEMPTION_MIN_GAS_USED`
- Log count >= `REDEMPTION_MIN_LOGS`
- Optional `to` address match (`REDEMPTION_CONTRACT_ADDRESS`)
- Optional event topic0 presence (`REDEMPTION_EXPECTED_EVENT_TOPIC0`)
- Optional minimum native value (`REDEMPTION_MIN_VALUE_WEI`)

Response contains: `verified`, `block`, `gas_used`, `log_count`, and `audit_event_id` when newly verified (plus `already` on idempotent re-checks).

### On-Chain Marketplace Event Ingestion (Phase 4 Enhancement)

When `ENABLE_RAW_CHAIN_INGEST=true` and `DOMAIN_MARKETPLACE_CONTRACT_ADDRESS` are provided, the background chain scanner decodes `DomainMarketplace` events directly from logs:

Parsed events:

* `OrderCreated(orderId, seller, domainContract, tokenId, price)` → emits `CHAIN_ORDER_CREATED` audit event.
* `TradeExecuted(tradeId, buyer, seller, price)` → emits `CHAIN_TRADE_EXECUTED` audit event and records a placeholder `Trade` row (domain attribution TBD once full ABI indexing added).

Config flags (env vars):

* `ENABLE_CHAIN_MARKETPLACE_EVENTS=true` (defaults on; gated by raw ingest flag)
* `DOMAIN_MARKETPLACE_CONTRACT_ADDRESS=0x...` (lowercased match)

Safety & Reorg Handling: shallow reorgs up to 6 blocks trigger rewind of the cursor preserving idempotency of audit chain (later events simply recompute integrity linkage). Deep reorgs are out-of-scope for hackathon context.

Future improvements:

1. Full ABI decoding for all parameters (domain contract + tokenId) and domain name resolution.
2. Backfill historical ranges beyond current head-window.
3. Persistent reorg journal for deterministic reconciliation.

Persistent Order Attribution Cache (Completed):
Added `marketplace_order_cache` table + in-memory mirror. Each `OrderCreated` persists order metadata; `TradeExecuted` first attempts direct orderId match (assumes interim tradeId==orderId semantics) then heuristics (seller+price). Fulfillment updates the cache with tx hash and block time enabling restart-safe attribution and future settlement provenance queries.

### Audit Export Resumable Verification Tests

Test coverage ensures:

* Cursor-based resume (`test_audit_export_resume_cursor`).
* Merkle snapshot generation and single-event proof reconstruction (`test_merkle_snapshot_and_proof`).
* Streaming export integrity flags.

Add new tests for on-chain marketplace decoding as ABI details stabilize (placeholder events currently logged). A future `test_chain_marketplace_ingest.py` will assert:

1. Given synthetic logs for `OrderCreated` / `TradeExecuted`, corresponding audit events persist.
2. Integrity hash chain remains continuous across decoded and polled events.
3. Trade placeholder row creation (until enriched attribution implemented).

### Environment Variables (Settlement / Verification)

| Variable                             | Description                                                             | Example              |
| ------------------------------------ | ----------------------------------------------------------------------- | -------------------- |
| `REDEMPTION_CONTRACT_ADDRESS`      | (Optional) Expected contract address for redemption tx `to` field.    | `0xabc...`         |
| `REDEMPTION_EXPECTED_EVENT_TOPIC0` | (Optional) Keccak hash of expected Redemption event (topic0).           | `0x1234...`        |
| `REDEMPTION_MIN_LOGS`              | Minimum number of logs required.                                        | `1`                |
| `REDEMPTION_MIN_GAS_USED`          | Minimum gasUsed threshold for semantic validity.                        | `60000`            |
| `REDEMPTION_MIN_VALUE_WEI`         | (Optional) Minimum native value (wei) required in tx.                   | `1000000000000000` |
| `REDEMPTION_WETH_CONTRACT_ADDRESS` | (Optional) WETH token address to allow heuristic ERC20 value inference. | `0xC02a...`        |

### Local Signature Verification

1. Fetch snapshot + proof(s).
2. Reconstruct leaf inclusion → derive root by hashing proof path.
3. Fetch public key (cache ETag).
4. Verify RSA signature (PKCS#1 v1.5 / SHA-256) over the hex root string.
5. Optionally verify audit integrity chain separately (stream export with `verify_integrity=true`).

### Testing the Validation Helper

Run focused tests:

```bash
cd apps/api
pytest -k redemption_validation_helper -q
```

The test suite covers success and each semantic failure reason (status, missing block, gas, logs, contract, topic, min value).
