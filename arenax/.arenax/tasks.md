# DomaCross Tasks Plan (Production-Ready)

Version: 1.0
Date: September 3, 2025

Status keys: pending | in_progress | blocked | done
Priority: high | medium | low
Owners: FE (Frontend), BE (Backend), SC (Smart Contracts), DO (DevOps), QA (Quality), PM (Product)

## Epic 0 — Monorepo, CI/CD, and Local Dev

- [ ] Bootstrap monorepo structure with workspaces (pnpm) and apps/packages
  - Owner: DO
  - Priority: high
  - Estimate: 0.5d
  - Dependencies: none
  - Deliverables: `apps/web`, `apps/api`, `contracts`, `packages/shared`, root configs
  - Acceptance: repo builds locally; workspace scripts run; README updated

- [ ] Dockerize web, api; compose for local dev (web+api+db+redis)
  - Owner: DO
  - Priority: high
  - Estimate: 1d
  - Dependencies: repo bootstrap
  - Deliverables: `infra/docker/Dockerfile.web`, `infra/docker/Dockerfile.api`, `docker-compose.yml`
  - Acceptance: `docker compose up` exposes web at 3000, api at 8000; health endpoints pass

- [ ] CI pipelines (PR: lint/test/build; Main: stage deploy)
  - Owner: DO
  - Priority: high
  - Estimate: 1d
  - Dependencies: dockerization
  - Deliverables: `.github/workflows/*`
  - Acceptance: PR checks required; artifacts built; staging deploy job triggers on main

## Epic 1 — Smart Contracts (Core)

- [ ] Implement `CompetitionFactory.sol` with createCompetition + event
  - Owner: SC
  - Priority: high
  - Estimate: 1d
  - Dependencies: none
  - Deliverables: `contracts/CompetitionFactory.sol`, unit tests
  - Acceptance: tests cover event emission and parameter propagation; coverage > 90%

- [ ] Implement `Competition.sol` with join(), participant tracking, Ownable
  - Owner: SC
  - Priority: high
  - Estimate: 1.5d
  - Dependencies: factory
  - Deliverables: `contracts/Competition.sol`, unit tests
  - Acceptance: reentrancy, duplicate checks; time window checks; payable entryFee exact; tests green

- [ ] Implement `ValuationOracle.sol` (Ownable) with set/getDomainPrice
  - Owner: SC
  - Priority: medium
  - Estimate: 0.5d
  - Dependencies: none
  - Deliverables: `contracts/ValuationOracle.sol`, unit tests
  - Acceptance: onlyOwner guard; events; tests green

- [ ] Implement `PortfolioTracker.sol` with updatePortfolioValue
  - Owner: SC
  - Priority: medium
  - Estimate: 1d
  - Dependencies: oracle
  - Deliverables: `contracts/PortfolioTracker.sol`, unit tests
  - Acceptance: aggregate valuation logic correct; tests green

- [ ] Hardhat config, scripts, and deployment per env (staging/prod)
  - Owner: SC
  - Priority: high
  - Estimate: 1d
  - Dependencies: contracts
  - Deliverables: `hardhat.config.ts`, `scripts/deploy.ts`, network configs
  - Acceptance: testnet deploy outputs addresses; artifacts stored; gas reports generated

- [ ] Static analysis and security checks (slither, mythril), OZ upgrades review
  - Owner: SC
  - Priority: high
  - Estimate: 1d
  - Dependencies: contract code complete
  - Deliverables: reports in CI, remediation PRs
  - Acceptance: no high/critical issues open; CI gate enforced

## Epic 2 — Backend API (FastAPI) and DB

- [ ] Initialize FastAPI project structure (routers, services, models, schemas)
  - Owner: BE
  - Priority: high
  - Estimate: 1d
  - Dependencies: monorepo
  - Deliverables: `apps/api` scaffold; uvicorn entrypoint; health endpoint
  - Acceptance: `GET /health` returns 200 and build info

- [ ] Database setup with SQLAlchemy models + Alembic migrations
  - Owner: BE
  - Priority: high
  - Estimate: 1d
  - Dependencies: API scaffold
  - Deliverables: models for users, competitions, participants, trades; migration scripts
  - Acceptance: migration up/down works; unique constraints enforced

- [ ] JWT auth via SIWE (nonce issue/verify), RS256 keys, refresh
  - Owner: BE
  - Priority: high
  - Estimate: 1.5d
  - Dependencies: DB (auth_nonces)
  - Deliverables: routes `/auth/nonce`, `/auth/verify`, `/auth/logout`; key management
  - Acceptance: signature verify with wallet; JWT issued; expiry and revocation validated in tests

- [ ] Users endpoints: create, get by wallet
  - Owner: BE
  - Priority: high
  - Estimate: 0.5d
  - Dependencies: auth
  - Deliverables: `POST /api/v1/users`, `GET /api/v1/users/{wallet}`
  - Acceptance: 201 on first connect; idempotent; 404 for unknown wallet on GET

- [ ] Competitions endpoints: list, detail, leaderboard
  - Owner: BE
  - Priority: high
  - Estimate: 1d
  - Dependencies: DB models
  - Deliverables: `GET /api/v1/competitions`, `GET /api/v1/competitions/{id}`, `GET /api/v1/competitions/{id}/leaderboard`
  - Acceptance: filters (TLD, chain, duration); pagination; typed responses

- [ ] Portfolio endpoints: aggregate and history
  - Owner: BE
  - Priority: medium
  - Estimate: 1d
  - Dependencies: integrations
  - Deliverables: `GET /api/v1/portfolio/{wallet}`, `/api/v1/portfolio/{wallet}/history`
  - Acceptance: returns data from cache if fresh; falls back to compute; JSON schema validated

- [ ] Event indexer workers (Celery): CompetitionCreated, ParticipantJoined
  - Owner: BE
  - Priority: high
  - Estimate: 1.5d
  - Dependencies: contracts deployed, RPC access
  - Deliverables: jobs to poll/subscribe; chain_offsets table; retry with backoff
  - Acceptance: idempotent persistence; lag < 3 blocks in staging

- [ ] Portfolio valuation workers: fetch Doma rarity, Alchemy prices; write snapshots
  - Owner: BE
  - Priority: medium
  - Estimate: 1.5d
  - Dependencies: external API keys
  - Deliverables: scheduled tasks; cache in Redis; DB snapshots
  - Acceptance: p95 < 1.5s per wallet; results consistent with oracle caps

- [ ] API docs (OpenAPI) and SDK types in `packages/shared`
  - Owner: BE
  - Priority: medium
  - Estimate: 0.5d
  - Dependencies: endpoints
  - Deliverables: OpenAPI json; generated client/types
  - Acceptance: web uses types; CI ensures drift detection

## Epic 3 — Frontend (Next.js)

- [ ] App scaffold with Tailwind, shadcn/ui, Zustand, viem
  - Owner: FE
  - Priority: high
  - Estimate: 1d
  - Dependencies: monorepo
  - Deliverables: base layout, theme, design tokens
  - Acceptance: loads locally with health banner

- [ ] Wallet connect flow (MetaMask, WalletConnect v2) + SIWE auth
  - Owner: FE
  - Priority: high
  - Estimate: 1d
  - Dependencies: API auth endpoints
  - Deliverables: connect button; signature prompt; JWT handling (httpOnly cookie or memory)
  - Acceptance: authenticated requests work; 401 triggers re-auth

- [ ] Competitions list page with filters and search
  - Owner: FE
  - Priority: high
  - Estimate: 1d
  - Dependencies: competitions API
  - Deliverables: `/competitions`
  - Acceptance: server-side data fetch; pagination; empty/error states; skeletons

- [ ] Competition detail page with join flow and live leaderboard
  - Owner: FE
  - Priority: high
  - Estimate: 2d
  - Dependencies: SC join(), API leaderboard
  - Deliverables: `/competitions/[id]`; on-chain join; tx receipts UI; real-time leaderboard
  - Acceptance: successful join reflected in UI; errors surfaced; leaderboard updates < 60s

- [ ] Dashboard with portfolio value, P&L, holdings
  - Owner: FE
  - Priority: medium
  - Estimate: 1.5d
  - Dependencies: portfolio API
  - Deliverables: `/dashboard` with charts (Recharts)
  - Acceptance: renders for test wallets; loading and error UX covered

- [ ] Trader profile page (public)
  - Owner: FE
  - Priority: medium
  - Estimate: 1d
  - Dependencies: leaderboard and portfolio endpoints
  - Deliverables: `/profile/[address]`
  - Acceptance: view any address; deep linkable; SEO metadata present

- [ ] Copy-trade UX (confirm modal and batched actions)
  - Owner: FE
  - Priority: low
  - Estimate: 1d
  - Dependencies: backend strategy endpoints (read-only), on-chain actions per user
  - Deliverables: UI only for hackathon; executes user's own trades after confirmation
  - Acceptance: no custody of user funds; clear disclaimers; actions are explicit

## Epic 4 — Cross-Chain + Doma Integration

- [ ] Doma tokenization guidance and deep links (testnet.d3.app)
  - Owner: FE
  - Priority: medium
  - Estimate: 0.5d
  - Dependencies: none
  - Deliverables: CTA and docs in UI; eligibility checks
  - Acceptance: users can tokenize and return to join competition

- [ ] Doma Bridge integration points (contract addresses/config in env)
  - Owner: BE
  - Priority: medium
  - Estimate: 1d
  - Dependencies: contracts deployed
  - Deliverables: config management; UI affordances
  - Acceptance: verified domain movement path documented and tested

- [ ] Doma State Sync consumption in backend for cross-chain portfolio
  - Owner: BE
  - Priority: high
  - Estimate: 1.5d
  - Dependencies: state sync APIs
  - Deliverables: consumer service; reconciliation logic; alerts on drift
  - Acceptance: cross-chain data reflected within 60s; correctness checks pass

## Epic 5 — Infra, Security, Observability

- [ ] Terraform: ECS Fargate services for web and api; ALB + WAF; IAM
  - Owner: DO
  - Priority: high
  - Estimate: 2d
  - Dependencies: docker images
  - Deliverables: `infra/terraform/*`
  - Acceptance: staging env comes up with HTTPS; ALB health checks pass

- [ ] Terraform: RDS Postgres 15 and ElastiCache Redis 7
  - Owner: DO
  - Priority: high
  - Estimate: 1d
  - Dependencies: VPC modules
  - Deliverables: DB/Redis with parameter groups, security groups
  - Acceptance: API connects via secrets; automated backups enabled

- [ ] Secrets management (AWS Secrets Manager, SSM params)
  - Owner: DO
  - Priority: high
  - Estimate: 0.5d
  - Dependencies: infra baseline
  - Deliverables: JWT keys, DB creds, RPC URLs, API keys stored securely
  - Acceptance: no secrets in repo; rotations documented

- [ ] Logging/metrics/tracing (OpenTelemetry + CloudWatch dashboards)
  - Owner: BE/DO
  - Priority: medium
  - Estimate: 1d
  - Dependencies: staging env
  - Deliverables: structured logs, request metrics, traces
  - Acceptance: dashboards with p95 latency, error rates; alerts configured

- [ ] Rate limiting and abuse protection (Redis-based + WAF rules)
  - Owner: BE/DO
  - Priority: medium
  - Estimate: 0.5d
  - Dependencies: Redis
  - Deliverables: middleware; WAF rule set (bot, geo)
  - Acceptance: 429 on bursts; false positive rate < 1%

## Epic 6 — Quality, Testing, and Release

- [ ] Unit tests (API, contracts); integration tests; e2e smoke flows
  - Owner: QA/BE/SC/FE
  - Priority: high
  - Estimate: 2d
  - Dependencies: core features
  - Deliverables: test suites and CI reports
  - Acceptance: > 85% API/FE, > 90% SC coverage; e2e join + leaderboard pass

- [ ] Security review and fixes; dependency scanning (Dependabot/Snyk)
  - Owner: SC/BE/DO
  - Priority: high
  - Estimate: 1d
  - Dependencies: feature completion
  - Deliverables: audit findings addressed; CI gates
  - Acceptance: no critical vulns; signed images; SBOM generated

- [ ] Performance testing and hardening
  - Owner: BE/FE
  - Priority: medium
  - Estimate: 1d
  - Dependencies: staging env
  - Deliverables: k6/Gatling scripts; profiling results; caching tuned
  - Acceptance: API p95 < 250ms; leaderboard freshness < 60s; indexer lag < 3 blocks

- [ ] Runbooks and operational docs
  - Owner: DO/BE
  - Priority: medium
  - Estimate: 0.5d
  - Dependencies: observability in place
  - Deliverables: incident, rollback, reindex, secrets rotation procedures
  - Acceptance: PM/DO sign-off; linked in README

## Milestones and Timeline (Testnet)

- Sprint 0 (2 days): Monorepo, Docker, CI
- Sprint 1 (5 days): Contracts core + deploy + indexer baseline
- Sprint 2 (5 days): Auth, Users, Competitions list/detail
- Sprint 3 (5 days): Join flow, Portfolio aggregation, Dashboard
- Sprint 4 (5 days): Leaderboard, Profiles, Copy-trade UX
- Sprint 5 (5 days): Cross-chain (State Sync), Hardening, Perf, Release

## Risk Register (Actionable)

- [ ] RPC/Provider instability — implement multi-endpoint fallback and exponential backoff
  - Owner: BE
  - Priority: high
  - Acceptance: failover verified in staging; alerts on error spikes

- [ ] Oracle price manipulation — cap deviations; compare against medians; circuit breakers
  - Owner: BE/SC
  - Priority: high
  - Acceptance: tests simulate anomalies; system enters safe mode

- [ ] High gas or chain congestion — queue non-critical jobs; user messaging in UI
  - Owner: FE/BE
  - Priority: medium
  - Acceptance: degraded mode documented and tested

## Deliverables Checklist (Go/No-Go)

- [ ] Contracts deployed to Doma testnet; addresses documented and loaded via env
- [ ] API available over HTTPS with health, auth, competitions, portfolio endpoints
- [ ] Frontend with connect, competitions list/detail, join, leaderboard, dashboard, profiles
- [ ] Observability dashboards + alerts; runbooks
- [ ] Security scans green; penetration test checklist complete
- [ ] Load test meets SLOs; DR restore tested from backup
