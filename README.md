# Roblox Up-and-Coming Top-10 Forecaster

This program forecasts the Roblox Up-and-Coming chart's top 10, hour by hour, for 72 hours.

## Method

The approach uses a **rank-diffusion Monte Carlo simulation**:

1.  **Read input:** Starts from the last chart in `history.ndjson`.
2.  **Simulation:** Performs 2500 Monte Carlo paths over a 72-hour window.
3.  **Rank Diffusion:** Games' ranks diffuse based on volatility bands (no drift, no momentum). Volatility is scaled by 0.8.
4.  **Reflection:** When a rank is below 1, it is reflected.
5.  **Ranking:** At each hour, games are sorted by simulated rank.
6.  **Probability Calculation:** Probabilities are calculated based on hours spent at each place, averaged over simulations.
7.  **Final Output:** Top 10 are selected based on highest total probability and lowest expected place.

Player counts are ignored.

## Constants

- `NSIM`: 2500
- `HOURS`: 72
- `SEED`: 12345
- `UNNAMED`: 0.12
- `TOP_N_PER_PLACE`: 60
- `MIN_P`: 0.002
- `SD_SCALE`: 0.8
- `Rank Band Volatility`: rank <= 3: 0.45; rank <= 10: 0.9; rank <= 20: 1.6; rank <= 40: 2.6; above 40: 3.4.

## How to run

```bash
export MAKEFUN_INPUT_DIR=/path/to/input
export MAKEFUN_OUTPUT_DIR=/path/to/output
node main.ts
```
Ensure the input directory contains `task.json` and `history.ndjson`.
