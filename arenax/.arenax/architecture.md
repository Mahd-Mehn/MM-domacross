# DomaCross Architecture

Version: 1.0
Date: September 3, 2025

## 1. Overview
DomaCross is a cross-chain domain trading competition platform. It enables wallet-based onboarding, time-bound competitions, portfolio tracking across chains, social leaderboards, and domain baskets (ETFs). The system spans a TypeScript Next.js frontend, a Python FastAPI backend with PostgreSQL and Redis, and Solidity smart contracts deployed to Doma-supported EVM chains, integrating Doma Bridge and State Sync.

## 2. Objectives and Non-Goals
- Objectives
  - Provide a secure, scalable, low-latency experience for 100+ users and 1000+ tx during testnet.
  - Support competitions, portfolio valuation, leaderboards, and social profiles.
  - Integrate with Doma tokenized domains and cross-chain state sync.
- Non-Goals
  - Off-chain order book or AMM design (not a DEX).
  - Full mainnet operations initially; focus is testnet-readiness with production-grade standards.

## 3. Monorepo Structure
- apps/
  - web/ (Next.js 14, TypeScript, shadcn/ui, Recharts, Zustand, viem)
  - api/ (FastAPI, SQLAlchemy 2.x, Pydantic v2, Alembic, Celery, Redis)
- contracts/ (Hardhat, Solidity ^0.8.20)
- packages/
  - shared/ (OpenAPI types, Zod/Pydantic models, constants)
- infra/
  - terraform/ (AWS: ECS Fargate, RDS Postgres 15, ElastiCache Redis 7, CloudWatch)
  - docker/ (Dockerfiles, docker-compose for local)
- .github/workflows/ (CI/CD)
- docs/ (additional design docs)

## 4. Technology Versions
- Node.js 20 LTS, pnpm
- Next.js 14.x, TypeScript 5.x, Tailwind 3.4, shadcn/ui, Recharts 2.x, Zustand 4.x, viem 2.x
- Python 3.11, FastAPI 0.111+, SQLAlchemy 2.x, Pydantic v2, Alembic 1.13, Celery 5.3
- PostgreSQL 15, Redis 7
- Hardhat 2.22+, Solidity ^0.8.20, OpenZeppelin 5.x
- Docker 24, Terraform 1.7+

## 5. Environments
- Local: docker-compose for API, DB, Redis; Hardhat local chain or Doma testnet RPC.
- Staging (Doma testnet): ECS services per app, RDS/Redis, CI deploy from main branch.
- Production: same as staging with higher scale; staged release after testnet sign-off.

## 6. Security and Compliance
- Wallet-based auth with SIWE-style JWT issuance (no passwords).
- Principle of least privilege (AWS IAM, scoped DB users). Secrets in AWS Secrets Manager.
- HTTPS everywhere; CSP, HSTS, SameSite cookies (if using cookies), CSRF protection for non-idempotent endpoints when JWT in cookies.
- Reentrancy guards and access control in contracts; pause switches.
- Rate limiting and IP throttling at API gateway (e.g., ALB + WAF) and application level.
- Input validation (Pydantic v2), output schemas, robust error codes.
- Data privacy: store public wallet and optional username only; no PII beyond username.
- Logging: structured JSON, no secrets/keys, log redaction.

## 7. Frontend Architecture (apps/web)
- App Router with server components where applicable.
- State: Zustand slices (auth, competitions, portfolio, ui). Derived selectors for memoized views.
- Data fetching: fetch or axios against FastAPI; retries and exponential backoff.
- Web3: viem client with WalletConnect v2 and MetaMask injected provider.
- UI: shadcn/ui primitives, Tailwind, Recharts for charts.
- Routing
  - `/` marketing and featured comps
  - `/competitions` list with filters (TLD, chain, duration)
  - `/competitions/[id]` details, rules, prize pool, leaderboard
  - `/dashboard` user portfolio, P&L, active comps
  - `/profile/[address]` public trader profile
  - `/settings` username, notifications
- Auth Flow (SIWE-style)
  1) GET `/auth/nonce` from API
  2) User signs nonce with wallet
  3) POST `/auth/verify` with signature -> receive JWT
  4) JWT stored securely (httpOnly cookie preferred; fallback to memory + Bearer for hackathon)
- Error handling: error boundary pages; toast notifications; 401 -> re-auth flow.
- Performance: code-splitting, image optimization, prefetching routes, CDN cache headers.

## 8. Backend Architecture (apps/api)
- FastAPI structure
  - routers/: users, competitions, portfolio, auth, health
  - services/: domain logic (users, comps, portfolio, valuation)
  - models/: SQLAlchemy ORM models, migrations via Alembic
  - schemas/: Pydantic v2 request/response models
  - jobs/: Celery tasks (indexers, portfolio updates, leaderboard snapshots)
  - integrations/: Doma, Alchemy, RPC, WalletConnect server utils
- Authentication
  - Nonce table for SIWE; verify signature with viem/eth_account; mint JWT (RS256) with expiry.
  - Scopes for admin endpoints (create competitions off-chain metadata, maintenance).
- Persistence
  - PostgreSQL 15 with SQLAlchemy 2.x ORM; connection pooling via asyncpg or psycopg3.
  - Redis 7 for: rate limiting, job queues (Celery backend), cache (leaderboards), nonce store.
- Background Processing
  - Celery workers process:
    - Event indexing from contracts (CompetitionCreated, ParticipantJoined)
    - Portfolio valuation refresh (pull oracle, Doma APIs, Alchemy)
    - Leaderboard snapshotting every N minutes
    - Cross-chain state sync reconciliation with Doma State Sync
- API Endpoints (initial)
  - `POST /api/v1/users` create on wallet connect
  - `GET /api/v1/users/{wallet}` profile
  - `GET /api/v1/competitions` list + filters
  - `GET /api/v1/competitions/{id}` details
  - `GET /api/v1/competitions/{id}/leaderboard`
  - `GET /api/v1/portfolio/{wallet}` aggregate holdings
  - `GET /api/v1/portfolio/{wallet}/history`
  - Auth helpers: `GET /auth/nonce`, `POST /auth/verify`, `POST /auth/logout`
- Validation and Errors
  - Consistent error envelope `{code, message, details}`; typed responses via Pydantic.
  - Pagination via cursor-based where appropriate.

## 9. Database Schema
Core tables from spec plus operational tables.
- users(id, wallet_address[unique], username[unique], created_at)
- competitions(id, contract_address[unique], chain_id, name, description, start_time, end_time, entry_fee, rules JSONB)
- participants(id, user_id FK users, competition_id FK competitions, portfolio_value NUMERIC, UNIQUE(user_id, competition_id))
- trades(id, participant_id FK participants, domain_token_address, domain_token_id, trade_type, price, tx_hash[unique], timestamp)
- domain_baskets(id, owner_user_id, name, description, basket_token_address[unique], created_at)
- basket_items(id, basket_id FK domain_baskets, domain_token_address, domain_token_id, weight)
- leaderboard_snapshots(id, competition_id, captured_at, standings JSONB)
- auth_nonces(id, wallet_address, nonce, created_at, consumed_at)
- chain_offsets(id, chain_id, contract_address, last_block_number)
- jobs(id, type, payload JSONB, status, attempts, last_error, created_at, updated_at)
- api_keys(id, name, key_hash, scopes JSONB, created_at)
Indexes on: wallet_address, tx_hash, (competition_id, captured_at), (participant_id, timestamp), contract_address.

## 10. Smart Contracts (contracts/)
- CompetitionFactory.sol
  - createCompetition(startTime, endTime, entryFee, valuationOracle) -> deploys Competition
  - Events: CompetitionCreated(address, startTime, endTime)
- Competition.sol
  - Ownable; immutable config (start, end, entryFee); stores participants; emits ParticipantJoined
  - join() payable validates time window and fee; prevents duplicates
  - Future extension hooks: prize distribution, withdrawal, pause()
- PortfolioTracker.sol
  - Holds valuationOracle; updates per-user competition portfolio values (trusted caller)
  - updatePortfolioValue(user, domainTokens[]) aggregates oracle prices
- ValuationOracle.sol
  - Ownable setDomainPrice(token, price); getDomainPrice(token)
- Security Best Practices
  - OZ Ownable/Pausable; checks-effects-interactions; require guards; bounded loops
- Testing
  - Hardhat + chai/ethers; coverage report; slither static analysis; gas snapshot

## 11. Cross-Chain and Doma Integration
- Doma Bridge: used by users to move tokenized domains into eligible chains for competitions.
- Doma State Sync: backend subscribes to state updates to keep leaderboards coherent across chains.
- Indexer: listens to CompetitionFactory/Competition events on configured chain_ids; persists to DB.
- Portfolio Aggregation: fetch on-chain balances + Doma rarity scores and Alchemy market data; cache results.

## 12. Deployment and Operations
- Frontend
  - Built with Next.js; deployed behind CDN (CloudFront) or Vercel. Env vars for API URL and chain IDs.
- Backend
  - Containerized FastAPI (Uvicorn + Gunicorn workers), autoscaled on ECS Fargate.
  - DB: RDS Postgres 15 with automated backups, read replicas (optional).
  - Redis: ElastiCache primary/replica.
  - Migrations via Alembic on deploy.
- Contracts
  - Hardhat deploy scripts per environment; addresses stored in SSM/Secrets Manager and config JSON.
- CI/CD (GitHub Actions)
  - PR: lint, typecheck, tests, contracts test, build Docker images
  - Main: deploy to staging; tag release -> promote to production

## 13. Observability and SLOs
- Metrics: request rate/latency/error rate, DB QPS/latency, Redis ops, queue depth, indexer lag, chain head lag.
- Tracing: OpenTelemetry in API; propagate request IDs.
- Logging: JSON logs shipped to CloudWatch; alert on error rates and timeouts.
- SLOs (staging)
  - API p95 latency < 250ms, 99.5% availability
  - Indexer lag < 3 blocks
  - Leaderboard freshness < 60s

## 14. Performance and Scalability
- API: async endpoints; DB pooling; Redis caching for leaderboard and portfolio snapshots.
- Frontend: ISR/SSG where possible for non-personalized pages.
- Contracts: gas-optimized storage, events for off-chain processing.
- Backpressure: queue jobs if external APIs are slow; circuit breakers and retries with jitter.

## 15. Risk Management
- External dependency risk (RPC/Alchemy/Doma): multi-endpoint fallback; exponential backoff.
- On-chain valuation correctness: compare sources; sanity checks and caps.
- Time window enforcement: block.timestamp reliance; consider chain time drift.
- Security: audits, slither, mythril, code review gates.

## 16. Runbooks (Staging)
- Incident: elevated 5xx
  - Check API health, DB connections, Redis, recent deploys.
  - Rollback via previous task definition in ECS.
- Indexer behind
  - Inspect chain_offsets; verify RPC; scale workers; replay from last_block_number.
- Contract address mismatch
  - Verify env config and Secrets; redeploy or update API config; backfill DB from events.

## 17. Appendices
- Chain Config Example (Doma testnet)
  - chainId: ${DOMA_TESTNET_CHAIN_ID} (provided via environment variable)
  - rpcUrls: primary ${DOMA_TESTNET_RPC_URL_PRIMARY}, fallback ${DOMA_TESTNET_RPC_URL_FALLBACK}
  - contracts: addresses resolved from AWS Secrets Manager/SSM at startup; never hardcoded in code or repo
- API Error Codes
  - 400 validation_error, 401 unauthorized, 403 forbidden, 404 not_found, 409 conflict, 429 rate_limited, 500 internal
