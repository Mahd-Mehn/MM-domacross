# ADR-001: Domain Valuation Heuristic & Ensemble Stub

Status: Accepted  
Date: 2025-09-06  
Decision Driver: Transparent, explainable baseline pricing with forward extensibility for multi-source blending.

## Context
Reliable, low-latency domain valuation is central to: leaderboard fairness, ETF NAV accuracy, incentive weighting (PnL realism), and future collateral / lending use-cases. We require: (1) deterministic, easily reproducible baseline factors, (2) extensibility for external oracle + ML enrichment, (3) dispute & risk guardrails.

## Forces
| Force | Description |
|-------|-------------|
| Latency | Valuation batch invoked frequently; must finish < 50ms (few domains) locally. |
| Transparency | Judges & users must see factor contributions and confidence. |
| Extensibility | External feeds + ML regression later without refactor. |
| Stability vs Reactivity | Avoid over-reacting to thin order flow while capturing real shifts. |
| Determinism | Seeded demo + reproducible valuations for audit/export. |

## Decision
Implement a weighted multi-factor heuristic producing a base value + confidence. When `VALUATION_USE_ENSEMBLE=1`, wrap heuristic output in an ensemble stub selecting a `chosen_source` (currently still heuristic) and computing dispersion-based confidence placeholder.

### Factors (Current)
| Factor | Source | Rationale | Weight (initial) |
|--------|--------|-----------|------------------|
| Floor / recent listing midpoint | Local listings snapshot | Market ask anchor | 0.30 |
| Recent accepted offers midpoint | Local offers snapshot | Bid realism | 0.20 |
| Orderbook mid (if ext snapshot) | External (stub / future SDK) | External liquidity signal | 0.15 |
| Historical trade VWAP (rolling) | Trades table | Executed market consensus | 0.25 |
| Scarcity / quality scalar | Static heuristic (length, chars) | Premium adjustment | 0.10 |

Normalization: each available factor scaled to 0..1 relative domain class baselines; missing factors re-normalize weights.

### Confidence
Heuristic path: starts at 0.60 then adjusted ± small deltas for factor coverage & disagreement. Ensemble path: (future) standard deviation across model outputs -> mapped to 0.0–1.0.

### Placeholder Domains
Batch endpoint auto-creates `Domain` row for unseen names (placeholder flag). Placeholder valuations get low confidence and badge in UI; encourages early activity without 500 errors (replaces earlier skip logic).

### Dispute Clamp
Open disputes crossing quorum temporarily freeze upward adjustments (clamping to min(previous, new)) until resolved.

## Alternatives Considered
1. Pure external oracle first: rejected (dependency risk, no transparency baseline).  
2. Immediate ML model: rejected (insufficient labeled features during hackathon timeframe).  
3. On-chain only pricing: rejected (latency & sparse data).  

## Consequences
Positive: clear factor table; easy judge verification; safe evolution to ensemble.  
Negative: heuristic can be gamed via synthetic listings/offers (mitigated by risk flags + future weighting dampening).  

## Future Work
* External oracle adapter registry (`sources/` directory).  
* Feature vector builder + lightweight ridge regression.  
* Confidence calibration via backtesting variance.  
* Factor-level dispute granularity.  

## Status Tracking
Implemented: factors, placeholder domain auto-create, dispute clamp stub, ensemble toggle.  
Pending: external + ML real outputs, confidence dispersion, persistence of factor snapshots.
