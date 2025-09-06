# Real-Time Event Schemas

| Event Type | Core Fields | Optional / Notes |
|------------|-------------|------------------|
| listing_created | id, domain, seller, price, contract, token_id | Optimistic replacement keyed by (contract, token_id) |
| listing_filled | id | Removes active listing, triggers PnL/leaderboard delta upstream |
| listing_cancelled | id | Marks inactive |
| offer_created | id, domain, offerer, price | currency_symbol (future) |
| offer_cancelled | id | Marks inactive |
| offer_accepted | id | Often paired with listing_filled |
| valuation_update | domain, value, previous_value?, change_pct?, model_version | change_pct client-derivable if absent |
| leaderboard_delta | user, score, delta | Session aggregation, non-authoritative |
| nav_update | nav? | If nav omitted client may refetch REST nav/per-share |
| fee_accrual | event_type, etf_symbol, amount, nav | MANAGEMENT_FEE_ACCRUAL / PERFORMANCE_FEE_ACCRUAL |
| etf_flow | flow_type (ISSUE|REDEEM), etf_symbol, shares, nav_per_share | Drives flow charts, counters |
| risk_flag | trade_id, flag_type | WASH_LIKELY / SELF_CROSS / CIRCULAR_PATTERN / RAPID_FLIP |
| epoch_distributed | epoch_id, competition_id, reward_pool | Reward distribution broadcast |

Replay dispatch additionally emits a browser CustomEvent `doma-replay-event` with identical payload for components listening outside websocket flow.

Optimistic events may include `_optimistic: true` (internal) and are auto-evicted on timeout if no authoritative event reconciles.

Planned additions: dispute_opened, dispute_resolved, trade_executed (execution quality), anomaly_score.# Real-Time Event & WebSocket Protocol

This document describes the lightweight real-time channel used by the app (FastAPI backend + Next.js frontend) for streaming orderbook domain activity, competitions telemetry, and marketplace lifecycle events.

## Connection

```
ws://<API_HOST>/ws?events=<comma-separated>&competitions=<comma-separated>
```

- `events` (optional): server will still emit a `hello` even if absent; filtering can be refined later via SUB command.
- `competitions` (optional): restricts scoped events to these competition IDs.

## Handshake / Heartbeat

On connect server emits:
```json
{"type":"hello","seq":<current_seq>,"ts":<unix_ms?>}
```

Client should persist the highest `seq` applied (we store in `localStorage` under `rt_seq`).

Heartbeat: client may send:
```json
{"action":"PING"}
```
Server replies `{"type":"pong"}`. Idle PING recommended every ~30s if no traffic.

## Subscription Commands

Runtime filtering (optional; query params are initial coarse filter):
```
{"action":"SUB","events":["listing_created","offer_created"],"competitions":["comp123"]}
{"action":"UNSUB"}
```

Ack events:
- `subscribed`
- `unsubscribed`

## Sequencing & Gap Recovery

All broadcast business events include monotonically increasing integer `seq` and `ts` timestamp (server-assigned). Client logic:
1. Maintain `lastSeq` (persist between sessions).
2. For incoming event with `seq`:
   - If `seq` > `lastSeq + 1` => GAP detected. Trigger a resync fetch (current implementation: full refetch of listings & offers) and mark a transient UI banner.
   - If `seq` <= `lastSeq` => stale/duplicate; drop.
   - Else apply and update `lastSeq`.

Future enhancement: differential backfill endpoint using `since_seq` to avoid full reload.

## Event Catalog

| Event | Description | Key Fields |
|-------|-------------|------------|
| hello | Initial handshake | seq, ts |
| trade | Domain trade (placeholder) | domain, price, side |
| nav_update | ETF NAV recalculation | (none) |
| leaderboard_delta | Leaderboard incremental change | competition_id, user_id, portfolio_value, rank |
| listing_created | Listing entered | id, domain, price, seller, competition_id |
| listing_filled | Listing filled | id, domain, price, seller, buyer, competition_id |
| listing_cancelled | Listing cancelled | id, domain, price, seller, competition_id |
| offer_created | Offer placed | id, domain, price, offerer, competition_id |
| offer_accepted | Offer accepted | id, domain, price, offerer, seller, competition_id |
| offer_cancelled | Offer cancelled | id, domain, price, offerer, competition_id |
| subscribed | Subscription acknowledgment | events, competitions |
| unsubscribed | Unsubscribe acknowledgment | (none) |

(Additional valuation/dispute/incentive events defined for future UI integration.)

## Optimistic UI Guidelines

Listings & offers are inserted locally with temporary IDs (`temp-...`) pending authoritative event. If server event duplicates an existing ID the client de-dupes. Failure path timeouts clear stale optimistic entries after 15–30s.

## Replay (Planned)

`useReplay` hook can ingest captured ordered events; future UI will allow export/import JSON with contiguous `seq` enabling offline demos. Storage location TBD (IndexedDB or file download).

## Security Notes

- No auth gating currently on the websocket path (intended for public market data). When private user events are added, move to token-auth & per-connection permission scoping.
- Input commands validated by minimal schema; unrecognized commands echoed presently.

## Backfill Strategy (Future)

Introduce REST endpoints:
- `GET /api/v1/listings?since_seq=<n>`
- `GET /api/v1/offers?since_seq=<n>`
Returning objects with their originating create `seq` so client can patch without full reload.

## Versioning

`/events/schema` exposes event set + version integer. Client may warn if version mismatch triggers required upgrade.

---
Last updated: (auto) – include offer lifecycle and sequence persistence details.
