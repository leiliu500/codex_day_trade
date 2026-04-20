# codex_day_trade

Multi-symbol **TypeScript options day-trading framework** using Alpaca paper APIs.

## What changed (v2)

This revision replaces the placeholder-style first implementation with a more practical system:

- no runtime validation dependency (`zod`) to reduce deployment friction,
- stronger per-symbol isolation with independent worker loops,
- richer entry filtering from real intraday bars (EMA/VWAP/ATR/RVOL),
- stricter options contract liquidity gates (OI, volume, spread),
- profit-protection logic (break-even + trailing exit + scale-out).

## Architecture

### Shared infrastructure

- `AlpacaClient`: market data + order adapter.
- `RiskEngine`: global/day risk and symbol-level controls.
- `TradeCoordinator`: orchestrates workers and lifecycle.

### Isolated symbol processes

Each symbol runs through its own `SymbolEngine` worker timer with independent cycle state:

- one symbol timing or API failure does not block others,
- signal cooldown is tracked per symbol,
- max open positions is enforced per symbol,
- per-symbol parameter tuning is possible through config map.

## Strategy logic

### Entry quality (maximize good entries)

System rejects poor conditions first:

- spread too wide,
- extreme IV regime,
- weak relative volume.

Then evaluates setups:

1. opening range breakout,
2. trend-pullback with EMA + VWAP alignment.

### Loss control (minimize bad losses)

- max daily loss lock,
- max loss per trade,
- fixed initial premium stop,
- symbol cooldown after rejected setup.

### Profit protection (maximize retained profits)

- partial take-profit at TP1 (trim half),
- move stop to break-even after initial extension,
- trailing behavior from max premium seen,
- full exit at TP2 or stop/trailing invalidation.
- hard time-based exit via max holding minutes.

## Files

- `src/config.ts` – env parsing and symbol config generation.
- `src/alpaca/client.ts` – Alpaca HTTP integration.
- `src/strategy/indicators.ts` – EMA/VWAP/ATR/RVOL.
- `src/strategy/signal.ts` – entry setup scoring/filtering.
- `src/core/risk.ts` – lockouts, sizing, and managed exits.
- `src/engine/symbolEngine.ts` – per-symbol entry + management cycle.
- `src/engine/coordinator.ts` – symbol worker orchestration.

## Setup

```bash
cp .env.example .env
npm install
npm run build
npm run test
```

Run:

```bash
node --env-file=.env dist/index.js
```

## Important notes

- Default endpoints are paper trading only.
- Validate slippage assumptions before considering live deployment.
- Never commit real API credentials.
