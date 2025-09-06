# ADR-002: Incentive & Emission Model

Status: Accepted  
Date: 2025-09-06  
Decision Driver: Sustain liquidity & fair competition through multi-metric reward weighting while resisting gaming.

## Context
Emissions drive early liquidity but naive volume-only programs invite wash trading. Need balanced composite metrics (PnL realism, diversification) plus dynamic scaling when participation is low.

## Metrics
| Metric | Purpose | Notes |
|--------|---------|-------|
| Normalized Volume | Encourage throughput | Excludes flagged trades |
| Realized PnL | Reward profitable execution | Realized only, cost-basis tracked |
| Turnover Ratio | Incentivize active rotation | Prevent idling |
| Concentration (inverse HHI) | Promote diversification | Penalizes over-concentration |

Weights set per schedule (basis points). Bonus tiers applied post-aggregation (early join, volume threshold, holding duration).

## Emission Scaling
If participants < `min_participants_full_emission`, emissions linearly reduced by `emission_reduction_factor_bps` floor to preserve treasury.

## Anti-Gaming
Risk-flagged trades excluded from all metric aggregators. Duplicate intent protection via idempotency keys. Planned anomaly scoring for pattern outliers.

## Alternatives
1. Flat per-trade reward (wash prone).  
2. Pure PnL (discourages volume & discovery).  
3. Liquidity mining by stake only (unrelated to skill).  

## Decision
Composite weighted scoring with additive bonuses and dynamic emission scaling; final points -> proportional emission allocation.

## Consequences
Positive: Balanced, harder to game single dimension.  
Negative: More complex to explain (mitigated via summary endpoint & docs).  

## Future Enhancements
* Time decay weighting (recent trades count more).  
* Global cross-competition meta rewards.  
* ML anomaly flag integration gating rewards.  
