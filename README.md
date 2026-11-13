# Roblox Up-and-Coming Forecast v2

This program forecasts the top 10 games in the Roblox Up-and-Coming chart.

## Method

The approach uses Rank-Diffusion Monte Carlo simulation:
- 2500 Monte Carlo paths
- 72-hour window simulation
- Rank-dependent volatility and drift
- Per-place temperature calibration
- Seeded PRNG (mulberry32 + Box-Muller) for determinism

This implementation rejects momentum-based approaches as they were shown to underperform in backtests.

## Constants

- NSIM: 2500
- SEED: 12345
- UNNAMED: 0.35
- TOP_N_PER_PLACE: 60
- MIN_P: 0.008
- SD_SCALE: 0.8

## Running

The program reads from `MAKEFUN_INPUT_DIR` (default: `/input`) and writes to `MAKEFUN_OUTPUT_DIR` (default: `/output`).

```bash
node main.ts
```
