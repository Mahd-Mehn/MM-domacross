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

