# ADR-004: Policy, Whitelisting & KYC Architecture

Status: Accepted  
Date: 2025-09-06

## Context
Phase 7 introduces governance & compliance primitives required for prize distribution and controlled listing scope. We need:
- Domain whitelist to constrain tradable assets during controlled demos or compliance windows.
- Governance configuration key/value store for adjustable parameters without redeploy.
- Off-chain KYC workflow with admin approval to gate monetary reward distribution.
- Immutable audit of admin actions to satisfy provenance & future attestations.
- Reward distribution gating: non‑KYC participants should not receive prize payouts.

## Decision
Implement new relational tables:
- `domain_whitelist(domain_name, active)` (already existed, now CRUD surfaced)
- `governance_config(key unique, value JSON, updated_at)`
- `kyc_requests(user_id, status=PENDING|APPROVED|REJECTED, document_hash, notes, reviewed_at)`
- `admin_action_audit(admin_user_id, action_type, target, meta, created_at)`
- Extend `users` with `is_admin`, `kyc_verified` booleans.

Expose FastAPI router `/api/v1/policy/*` for:
- Whitelist list/add/deactivate
- Config list/upsert
- KYC submit/list/approve/reject
- Admin audit listing

Whitelist enforcement added to listing, offer, and buy endpoints (if any active rows variable restricts universe). Reward distribution zeroes out `reward_amount` for non‑`kyc_verified` users; they can be retrospectively paid after KYC by re-running distribution (future enhancement: separate claim process referencing merkle proofs).

Admin identity derived from environment list (`ADMIN_WALLETS_ENV`) plus persisted `is_admin` flag to allow elevation. Every admin action records typed audit entry (WHITELIST_ADD, GOV_CONFIG_UPDATE, KYC_APPROVE, etc.).

## Alternatives Considered
1. On-chain allowlist smart contract: heavier integration; deferred until later compliance phase.
2. Embedding governance values in static config: reduces flexibility and requires deploy for changes.
3. Directly marking users KYC without request table: loses traceability & approval workflow.

## Consequences
Pros:
- Minimal overhead database primitives, fast iteration.
- Clear extensibility path to emit websocket events for UI real-time admin panels.
- Separation between KYC request objects and final user flag reduces accidental approvals.

Cons / Risks:
- Off-chain storage of KYC status requires eventual anchoring or evidence export for audits.
- No granular role-based permissions beyond admin vs user yet (future: fine-grained policy scopes).

## Follow-Up Actions
- Add websocket events: `kyc_status` (user_id, status), `policy_change` (type, target).
- Build Next.js admin dashboard pages (whitelist table, KYC queue, config editor) consuming new API.
- Implement prize claim endpoint requiring `kyc_verified` + merkle proof (post distribution) enabling late KYC.
- Add scheduled job to re-check rewards for newly KYC-approved users (optional backfill).
- Emit audit events into main `audit_events` table for inclusion in merkle snapshots (optional).

## Security & Integrity
- All admin endpoints enforce `is_admin` guard; admin wallet seeds loaded at startup.
- Audit trail immutable by convention (no update/delete endpoints provided).
- Document hashes stored optionally; no PII persisted in repository.

## Testing
- Added `test_policy_phase7.py` validating whitelist enforcement & KYC approve path with audit presence (skips if JWT keys absent, ephemeral keys recommended in test env).

