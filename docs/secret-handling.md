# Secret & Key Handling Guidelines

## Current State
- Example `.env.example` provided; real `.env` files ignored via `.gitignore`.
- Ephemeral JWT keys auto-generated at runtime if not provided via env (`jwt_private_key_b64`, `jwt_public_key_b64`).
- A development RSA key (`jwtRS256.pem`) existed locally; ensure never committed (listed in `.gitignore`).

## Requirements Before Production
| Item | Action |
|------|--------|
| JWT Keys | Provide base64 PEM via environment vars or secret manager (AWS Secrets Manager, etc.). |
| Database Credentials | Inject with infra secrets backend; avoid committed defaults. |
| Doma / RPC API Keys | Store in secret manager, populate container environment at deploy. |
| Terraform Secrets | Reference data sources only; do not commit resolved values. |
| Rotation | Document rotation runbook (pending). |

## Recommended Improvements
1. Add startup check: fail if `app_env=prod` and ephemeral keys generated.
2. Provide `scripts/rotate_jwt_keys.py` (future) writing new pair to secret store.
3. Add hash chain or signature over audit export (integrity strengthening).
4. Optionally encrypt `.env.production` using SOPS with KMS.

## Quick Verification Script
```bash
grep -R "BEGIN RSA PRIVATE" . || echo "No committed private keys"
```

## Environment Variables Checklist
| Variable | Purpose | Required in Prod |
|----------|---------|------------------|
| POSTGRES_* | Database connection | Yes |
| REDIS_URL | Caching / rate limiting | Yes |
| JWT_PRIVATE_KEY_B64 / JWT_PUBLIC_KEY_B64 | Auth tokens | Yes |
| ADMIN_WALLETS_ENV | Admin gating | Yes |
| DOMA_* API keys | Doma protocol integrations | Yes |

---
Keep secrets out of git history; use infrastructure secret stores for production.
