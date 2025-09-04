# ADR-001: Domain Valuation Heuristic v1

Status: Accepted  
Date: 2025-09-04

## Context
We require a transparent, explainable valuation for domain-like assets to drive: 
1. Unrealized PnL computation. 
2. ETF NAV estimation and portfolio metrics. 
3. Incentive weighting (future).

## Goals
- Deterministic, cheap to compute on-demand or batch.  
- Factor transparency: each component exposed for UI exploration.  
- Reasonable ranking signal even with sparse orderbook depth.  
- Extensible toward ML / advanced weighting later.

## Factors (v1)
| Factor | Weight | Description | Notes |
|--------|--------|-------------|-------|
| Floor Price | 0.40 | Last known recorded floor listing price | Skipped if absent |
| Offer Median | 0.20 | Median price of active BUY interest | Skipped if none |
| Listing Median | 0.15 | Median of active SELL listings | Skipped if none |
| Scarcity | 0.15 | (baseline_anchor * scarcity_factor) | scarcity = 1 / log(tld_count+10) clamped [0.1,2] |
| Name Quality | 0.10 | (baseline_anchor * quality_score) | quality blends length & vowel ratio |

baseline_anchor = first available of (floor, listing_median, offer_median, 100 default).

## Name Quality Heuristic
core = label before '.'
length_score = 1 - abs((len(core)-6)/10), clamped >=0.  
vowel_balance = 1 - abs( (vowel_ratio) - 0.4 ).  
quality = 0.6 * length_score + 0.4 * vowel_balance, min 0.

## Scarcity Factor
If TLD missing: 0.5.  
count = frequency of domains with same TLD.  
raw = 1 / log(count + 10) -> clamp 0.1..2.0.

## Computation
Take available factors with weights; renormalize by sum(weights present).  
final_value = quantize(0.01) of weighted sum.

## Persistence
Table `valuations`: store value, version, factors JSON.  
`domains.last_estimated_value` updated each valuation.  
Used by metrics service to compute unrealized PnL for holdings.

## Limitations / Future Work
- No time decay: stale floor/offer data treated same as fresh.  
- No orderbook depth or trade velocity weighting.  
- Scarcity is global frequency, not liquidity-adjusted.  
- Quality heuristic naive (not NLP / semantics).  
- Single model version; no A/B runner.  
- Ignores volatility or recent trend momentum.

## Upgrade Path (v2+)
1. Add time-decay weighting for old floor/trade data.  
2. Integrate orderbook mid-price & depth curve (supply/demand).  
3. Momentum/mean-reversion factor (recent return slope).  
4. Penalize outlier single listings vs consensus.  
5. Multi-model ensemble with confidence interval.

## Decision
Adopt v1 heuristic for hackathon to power transparent valuations; evolve iteratively with clear versioning.
