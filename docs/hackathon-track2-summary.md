# Hackathon Track 2 Summary – Trading Competitions & Portfolio Tools

## Purpose
DomaCross converts tokenized domains into an actively tradable, yield-bearing portfolio asset by combining:
- Real-time competition engine with seasons & epochs
- Transparent valuation oracle (multi-factor + dispute clamp + ensemble roadmap)
- ETF abstraction (issuance/redemption, NAV history, fee accrual & APY)
- Live-ops replay + deterministic dataset for instant demo spin-up

## Impact Levers
| Lever | Mechanism | On-Chain / Usage Effect |
|-------|-----------|-------------------------|
| Frequent Trades | Leaderboard delta rewards and season incentives | Sustained transaction volume |
| Valuation Transparency | Factors + chosen_source / confidence | Reduces info asymmetry → more bids/listings |
| ETF Wrapper | NAV + fee accrual + APY + flows | Additional issuance/redemption txs & economic narrative |
| Replayable Dataset | JSONL manifest & seed script | Faster onboarding; reproducible judging |
| Risk & Execution Metrics | Slippage & participant risk panels | Improves trader retention & iteration |

## Doma Protocol Integration
- Domain token primitives valued & ranked
- Orderbook snapshot + listing/offer models prepared for chain/event ingestion
- Policy & whitelist endpoints mimic governance constraints
- Settlement verification endpoints with Merkle snapshot scaffolding

## Ensemble Roadmap
1. Heuristic blend (current) with fallback chain (trade_vwap → orderbook_mid → floor → decay)
2. Stub external oracle & ML signals blended via weights
3. Confidence multiplier based on dispersion; provenance metadata persisted
4. Future: plug in real Doma oracle or L2 aggregator feed; optional ML (ridge/regression) using historical NAV & trade density

## Differentiators
- Deterministic full replay (fast judge demo) + UI manifest switch
- Dispute + override system that clamps valuations until resolved (stability)
- ETF economics (fees, revenue share) introduced early for sustainable yield narrative
- Explicit anti‑abuse heuristics (wash trade, self-cross, circular pattern, rapid flip) with websocket events

## Pending Before Submission
- Architecture & economic diagrams
- MIT License addition
- 3–5 min recorded walkthrough
- Stress / latency mini-report (scripts)

## Quick Demo Flow
1. Seed data & start services
2. Enable Demo Mode (`?demo=1`) → select Full manifest → play
3. Show live leaderboard & valuation panel updates
4. Display ETF NAV & Flow charts; trigger fee distribution
5. Open valuation factors (confidence + chosen_source)
6. (Optional) Open dispute & show valuation clamp

---
Concise artifact for judges & reviewers.
