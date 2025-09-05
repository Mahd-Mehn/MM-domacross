## Incentives & Liquidity Mining

This document outlines the Phase 5 incentive mechanics now fully implemented.

### Core Concepts

| Component | Description |
|-----------|-------------|
| Schedule | Defines time-bounded emission program with fixed-length epochs and weight configuration. |
| Epoch | Window over which provisional points accumulate and (optionally) finalize emission distribution. |
| User Points | Per-user normalized metric breakdown with bonuses applied; persisted provisionally each recompute. |

### Metrics & Weights

Weights (basis points) configured per schedule:
- `weight_volume_bps`
- `weight_pnl_bps`
- `weight_turnover_bps`
- `weight_concentration_bps` (applies inverse HHI diversification)

### Bonuses
1. Early Join Bonus (`bonus_early_join_bps`): Applied first epoch a user appears.
2. Volume Tier Bonus (`volume_tier_thresholds`): Array of `{ threshold, bonus_bps }`; highest qualified threshold applied to base points.
3. Holding Duration Bonus (`holding_duration_tiers`): Array of `{ min_minutes, bonus_bps }`; based on minutes held from earliest BUY trade in epoch until epoch end.

Bonus point components are exposed in provisional results: `early_bonus_points`, `volume_bonus_points`, `holding_duration_bonus_points`.

### Dynamic Emissions Adjuster
Finalization scales emission proportionally to participation vs `min_participants_full_emission`, with a floor defined by `emission_reduction_factor_bps`.

### Summary Endpoint
`GET /incentives/schedules/{id}/summary` now returns:
- `current_epoch`, `next_epoch`
- full epoch list (planned/actual, finalized)
- configured weights & bonus tier definitions

### Risk Flag Exclusion
Trades with associated risk flags inside the epoch window are excluded from all metric accumulators.

### Testing
Added tests covering:
- Cost basis & PnL realization
- Risk flag exclusion & normalization
- Volume tier + holding duration bonuses

### Future Enhancements
Potential additions: time-decay weighting, cross-competition global incentives, per-metric caps.
