# Realtime Event Catalog

Version: 1 (protocol draft)  
Status: Stable (current events) / Planned (future section)

## Overview
The WebSocket stream provides low-latency updates for trades, portfolio / competition state, and (soon) valuations.  
All messages are single JSON objects with a top-level `type` discriminator. Non-event control frames also use `type` (e.g. `subscribed`).

Endpoint (current): `/ws`  
Query Param (optional): `events=trade,leaderboard_delta` (comma-separated).  
If omitted, defaults to ALL current event types. You can later narrow or change via SUB / UNSUB control frames.

Authentication: (Assumption) Anonymous for now. If an auth token is later added it will be supplied as `?token=...` or via `Authorization: Bearer <token>` header during upgrade (note: some browsers restrict custom headers unless using libs). Not enforced yet.

Heartbeat: Not currently implemented. Clients should implement an application-level idle timeout (e.g. 60s) and reconnect if no messages. Planned: periodic `{ "type": "ping", "ts": <iso> }`.

## Connection & Handshake Flow
1. Client opens `wss://<host>/ws?events=trade,leaderboard_delta`  
2. Server validates & registers event filter (or ALL).  
3. Server sends ack:
```json
{ "type": "subscribed", "events": ["trade","leaderboard_delta"], "version": 1 }
```
4. Stream of event objects begins.

### Dynamic Subscription Control Frames
You may change the filter without reconnecting.

Client -> Server SUB example:
```json
{ "action": "SUB", "events": ["trade", "leaderboard_delta", "valuation_update"] }
```
Server ack:
```json
{ "type": "subscribed", "events": ["trade","leaderboard_delta","valuation_update"] }
```

Client -> Server UNSUB example (remove specific):
```json
{ "action": "UNSUB", "events": ["trade"] }
```
If `events` omitted for UNSUB it clears all (silences stream) until a new SUB.

Server sends:
```json
{ "type": "unsubscribed", "events": ["trade"], "remaining": ["leaderboard_delta","valuation_update"] }
```

Error (unknown event):
```json
{ "type": "error", "code": "UNKNOWN_EVENT", "detail": "foo_bar is not a valid event" }
```

## General Envelope Schema
Each event extends the base shape:
```ts
interface BaseEvent {
	type: string;        // discriminator
	ts?: string;         // optional ISO 8601 timestamp (may be added gradually)
	v?: number;          // optional per-event schema version (for future breaking changes)
}
```

## Current Event Types

### trade
Emitted when a (simulated) trade is recorded.
```json
{
	"type": "trade",
	"trade_id": 123,
	"domain": "example.tld",
	"side": "BUY",               // BUY | SELL
	"price": "123.45",           // decimal as string for precision
	"quantity": "1",             // future-proof; currently 1
	"participant_id": 42,
	"competition_id": 1,
	"ts": "2025-09-04T12:34:56.789Z"
}
```

### nav_update
Signals NAV / internal snapshot loop completed (aggregation or valuation drift pass).
```json
{ "type": "nav_update", "ts": "2025-09-04T12:35:10.000Z" }
```

### valuation_update
Broadcasts domain valuation refreshes including optional deltas and confidence.
```json
{
	"type": "valuation_update",
	"domain": "alpha.one",
	"value": "100.00",
	"previous_value": "100.00",
	"change_pct": 0.0,
	"confidence": 0.62,
	"chosen_source": "heuristic",
	"placeholder_created": true,
	"ts": "2025-09-06T10:12:00.000Z"
}
```

### leaderboard_delta
Partial update conveying only changed participants (typically rank window top N or those impacted by a trade).
```json
{
	"type": "leaderboard_delta",
	"competition_id": 1,
	"window": 50,                      // size target for tracked delta window
	"updates": [
		{
			"participant_id": 10,
			"user_id": 7,
			"rank": 3,
			"portfolio_value": "456.78",
			"realized_pnl": "12.34",
			"unrealized_pnl": "5.67",
			"turnover_ratio": 0.18,
			"concentration_index": 0.27,    // HHI normalized 0..1
			"sharpe_like": 1.42              // risk-free adjusted metric
		}
	],
	"ts": "2025-09-04T12:35:12.000Z"
}
```

### risk_flag
Heuristic risk marker for anomalous or potentially manipulative trades.
```json
{
	"type": "risk_flag",
	"trade_id": 555,
	"flag_type": "WASH_LIKELY",    // enumeration subject to expansion
	"severity": "medium",          // optional
	"ts": "2025-09-04T12:35:15.120Z"
}
```

	Additional flag_type values now emitted:

	- RAPID_FLIP: >3 alternating-side trades on the same domain by the same participant in a 10 minute window.
	- SELF_CROSS: Opposite-side trade by same participant within 30 seconds (tight wash/self-cross heuristic).
	- CIRCULAR_PATTERN: Domain traded among >=3 distinct participants then returns to origin participant within 10 minutes.

	Event payload remains minimal {type, trade_id, flag_type[, severity, ts]}. Rich contextual details (e.g. against_trade_id, flip_count, participant chain) are stored in database `trade_risk_flags.details` but intentionally not broadcast to reduce payload size and prevent strategy leakage.

### epoch_distributed
Emitted after reward distribution for an epoch within a competition.
```json
{
	"type": "epoch_distributed",
	"competition_id": 1,
	"epoch_index": 0,
	"reward_count": 25,              // number of participant rewards written
	"ts": "2025-09-04T12:40:00.000Z"
}
```

### subscribed / unsubscribed
Control acknowledgements. See handshake examples above.

### error
Indicates a protocol or subscription issue (non-fatal unless `code` implies disconnect).
```json
{ "type": "error", "code": "UNKNOWN_EVENT", "detail": "foo_bar" }
```

## Planned / Reserved Event Types

### dispute_quorum
Emitted when a valuation dispute crosses its quorum threshold. Valuation clamp becomes active until resolution.
```json
{
	"type": "dispute_quorum",
	"domain": "example.tld",
	"dispute_id": 42,
	"votes": 3,
	"threshold": 3,
	"ts": "2025-09-04T12:50:00.000Z"
}
```

### dispute_resolved
Emitted when an admin resolves or rejects a valuation dispute (clamp lifted).
```json
{
	"type": "dispute_resolved",
	"domain": "example.tld",
	"dispute_id": 42,
	"final_status": "RESOLVED",  // RESOLVED | REJECTED
	"ts": "2025-09-04T13:05:10.000Z"
}
```

### valuation_update
Broadcasts domain valuation refreshes. Includes previous_value/change_pct when prior valuation exists.
```json
{
	"type": "valuation_update",
	"domain": "example.tld",
	"value": "101.23",
	"previous_value": "99.75",
	"change_pct": 1.48,
	"model_version": "v1.0",
	"ts": "2025-09-04T12:45:00.000Z"
}
```

### valuation_update (future enrichment)
May add factor contribution breakdown when surfaced directly.
```json
{
	"type": "valuation_update",
	"domain": "example.tld",
	"value": "101.23",
	"previous_value": "99.75",
	"change_pct": 1.48,
	"model_version": "v1.0",
	"factors": {
		"floor_contrib": 0.40,
		"offers_contrib": 0.20,
		"listings_contrib": 0.15,
		"scarcity_contrib": 0.15,
		"quality_contrib": 0.10
	},
	"ts": "2025-09-04T12:45:00.000Z"
}
```

### ping (planned)
Server heartbeat for liveness. Client should respond with `pong` (echo or simple ack) if required.

### system_notice (planned)
Operational announcements (maintenance windows, model upgrades, competition resets).

### kyc_status (planned)
User KYC status change broadcast (after admin approval/rejection).
```json
{ "type": "kyc_status", "user_id": 7, "status": "APPROVED", "ts": "2025-09-06T12:00:00Z" }
```

### policy_change (planned)
Admin policy mutation (whitelist, governance config). Minimizes polling for admin panels.
```json
{ "type": "policy_change", "action": "WHITELIST_ADD", "target": "example.eth", "admin_user_id": 1, "ts": "2025-09-06T12:01:00Z" }
```

## Subscription Semantics (Detailed)
- Initial query parameter sets starting filter.  
- SUB without prior UNSUB replaces the entire filter set (idempotent).  
- UNSUB with subset removes only those; with no list removes all.  
- Receiving `error` for a SUB does not alter the existing filter unless `code` is `FILTER_REPLACED_PARTIAL`; in the draft we keep it simple (reject atomically).  
- Unknown actions ignored with an `error` frame.

## Backfill & Consistency Strategy
Because the stream is best-effort and not replayable, clients SHOULD:  
1. On connect (or reconnect) call REST endpoints for authoritative state (leaderboard, valuations).  
2. Apply incoming deltas only if they reference a known competition / participant; otherwise fetch that entity.  
3. Periodically (e.g. every 60s) reconcile portfolio values to mitigate missed frames.

## Versioning & Evolution
- Global catalog version (`version` in `subscribed` ack) increments on any breaking change to semantics.  
- Per-event `v` field increments for schema-level breaking changes limited to that event.  
- Additive fields: never increment (non-breaking).  
- Field removal / type change: breaking.  
- Deprecation policy: mark field with `deprecated: true` (planned meta addition) for at least one minor version before removal.

## Reliability & Delivery Guarantees
- Transport: in-process fan-out (no persistence).  
- Ordering: Not strictly guaranteed across different event types; within a type generally chronological but may interleave.  
- At-least-once: Possible duplicates (clients should de-dup by (`type`,`trade_id`) etc.).  
- Loss: Possible during server restarts or network disruption.  
- Mitigation: periodic REST refresh + idempotent client state application.

## Sample Client Snippets

JavaScript (browser):
```js
const ws = new WebSocket('wss://api.example.com/ws?events=trade,leaderboard_delta');

ws.onopen = () => {
	console.log('connected');
	// later: ws.send(JSON.stringify({ action: 'SUB', events: ['valuation_update'] }));
};

ws.onmessage = ev => {
	const msg = JSON.parse(ev.data);
	switch (msg.type) {
		case 'trade': /* update UI */ break;
		case 'leaderboard_delta': /* merge deltas */ break;
		case 'error': console.warn('WS error', msg); break;
	}
};

ws.onclose = () => setTimeout(() => location.reload(), 2000);
```

Python (asyncio):
```python
import asyncio, json, websockets

async def run():
		async with websockets.connect('wss://api.example.com/ws?events=trade') as ws:
				await ws.send(json.dumps({ 'action': 'SUB', 'events': ['trade','leaderboard_delta'] }))
				async for raw in ws:
						msg = json.loads(raw)
						if msg['type'] == 'trade':
								pass  # handle trade

asyncio.run(run())
```

## Minimal Client State Integration (Recommended)
1. Fetch `/competitions/{id}/leaderboard/full` on load.  
2. Connect WebSocket with `leaderboard_delta`.  
3. Apply deltas (update or insert participant rows).  
4. On reconnect or detection of gap (e.g. sequence mismatch when we later add `seq`): refetch full leaderboard.

## Security Considerations (Planned)
- Rate limiting for SUB/UNSUB thrash.  
- Optional signed token verifying competition access.  
- Future: per-user scoped events (private trades) delivered on isolated channels (would require auth before enabling).

## Implementation Notes (Server Side – High Level)
- Connection object holds a `set[str]` of subscribed event types.  
- Broadcast helpers iterate connections & filter.  
- For high-frequency events (trades), batching could be introduced (aggregate within 250ms window). Not implemented yet.  
- Potential optimization: maintain per-event subscriber index for O(k) fan-out; trivial currently due to low scale.

## Glossary
- HHI (Herfindahl–Hirschman Index): Sum of squared position weights measuring concentration.  
- Sharpe-like: (Return - Risk-free) / Volatility over rolling window (configurable) using simplified variance estimator.

## Change Log
v1 (current): Initial catalog with detailed schemas, control frames, and planned events.
v1.1: Added valuation_update (current section), expanded risk_flag documentation, placeholder_created flag.


