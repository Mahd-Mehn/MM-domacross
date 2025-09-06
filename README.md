# DomaCross: Cross-Chain Domain Trading Competitions

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

# Seed database with test data
python seed.py

# Start API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
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

## 🏗️ Architecture

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

## 🔑 Key Features

### ✅ Implemented
- **Wallet Authentication**: EIP-191 signature-based auth
- **Competition Management**: Create, join, and track competitions
- **Portfolio Tracking**: Real-time portfolio valuation
- **Leaderboard System**: Rank participants by performance
- **Cross-Chain Ready**: Architecture supports multiple blockchains
- **Database Schema**: Complete PostgreSQL schema
- **API Endpoints**: RESTful APIs for all features
- **Smart Contracts**: Competition, portfolio, and oracle contracts
- **Frontend UI**: Modern React components with Tailwind CSS

### 🚧 In Progress
- **Real-time Updates**: WebSocket connections for live data
- **Advanced Trading**: Domain buying/selling interface
- **Prize Distribution**: Automated winner payouts
- **Cross-Chain Integration**: Doma bridge integration

## 🧪 Testing

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

| Control | Description | Trigger / Window | Persistence |
|---------|-------------|------------------|-------------|
| Rate Limiting | Per-wallet & per-IP token bucket | N trades/min (configurable burst) | In-memory + Redis ZSET (timestamps) |
| Circuit Breaker | Halts trading on extreme NAV move | Absolute NAV move >= threshold bps over rolling window | In-memory + Redis key with TTL |
| Wash Trade Detection | Opposite side trade by same participant on domain | 120s window | DB `trade_risk_flags` + websocket `risk_flag` event |
| Rapid Flip Detection | >=3 flips (side changes) then new trade flags | 10m window | DB + websocket |
| Self-Cross | Opposite side within 30s (tighter wash) | 30s window | DB + websocket |
| Circular Pattern | Domain traded among ≥3 participants and returns to origin | 10m sequence scan | DB + websocket |
| Idempotent Redemption Intent | Prevent duplicate redemption creation | Idempotency-Key header | `idempotency_keys` table |
| Idempotent Competition Settlement Submit | Prevent duplicate settlement submissions | Idempotency-Key header | `idempotency_keys` table |

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
- API: http://localhost:8000/health
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

| Variable | Description | Example |
|----------|-------------|---------|
| `REDEMPTION_CONTRACT_ADDRESS` | (Optional) Expected contract address for redemption tx `to` field. | `0xabc...` |
| `REDEMPTION_EXPECTED_EVENT_TOPIC0` | (Optional) Keccak hash of expected Redemption event (topic0). | `0x1234...` |
| `REDEMPTION_MIN_LOGS` | Minimum number of logs required. | `1` |
| `REDEMPTION_MIN_GAS_USED` | Minimum gasUsed threshold for semantic validity. | `60000` |
| `REDEMPTION_MIN_VALUE_WEI` | (Optional) Minimum native value (wei) required in tx. | `1000000000000000` |
| `REDEMPTION_WETH_CONTRACT_ADDRESS` | (Optional) WETH token address to allow heuristic ERC20 value inference. | `0xC02a...` |

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

