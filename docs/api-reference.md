# API Reference (Snapshot)

Generated from the FastAPI OpenAPI schema. To refresh:
```bash
cd apps/api
python -m scripts.export_openapi --out ../../docs/api-schema.json
```

Primary groups:
- Auth & Users
- Competitions / Seasons / Incentives
- Portfolio & Valuations
- Listings / Offers / Trades
- ETF & Settlement
- Policy / KYC
- Replay & Events

See `api-schema.json` for full machine-readable contract (importable into Postman / Insomnia / Stoplight).

Future: generate redoc / scalar embed, prune internal fields, add curl examples.

## Hackathon Extension Endpoints

### Governance Risk Parameters
GET `/api/v1/governance/risk`

POST `/api/v1/governance/risk` (admin)
Request body example:
```json
{
	"trade_max_notional_per_tx": 25000,
	"portfolio_max_concentration_bps": 6500
}
```

### Basket (Derived Asset Prototype)
POST `/api/v1/baskets/create`
```json
{
	"domains": ["alpha.eth","beta.eth"],
	"weights_bps": [6000,4000],
	"token_uri": "ipfs://Qm..."
}
```
GET `/api/v1/baskets/list`
POST `/api/v1/baskets/{id}/redeem`

### Prize Escrow
POST `/api/v1/prize/create`
```json
{
	"competition_id": 1,
	"start_time": 1725600000,
	"end_time": 1725686400
}
```
POST `/api/v1/prize/{escrow_id}/finalize`
```json
{
	"winner_wallet": "0xabc..."
}
```
Emitted websocket event:
```json
{
	"type": "winner_claim",
	"competition_id": 1,
	"winner_wallet": "0xabc...",
	"escrow_id": 2
}
```
