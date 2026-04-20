import type { SymbolConfig } from "./core/types.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number in ${name}: ${raw}`);
  }
  return parsed;
}

const symbols = (process.env.SYMBOLS ?? "SPY,QQQ")
  .split(",")
  .map((v) => v.trim().toUpperCase())
  .filter(Boolean);

const sharedSymbolConfig = {
  timeframeMinutes: 1 as const,
  minSignalStrength: num("MIN_SIGNAL_STRENGTH", 0.6),
  maxOpenTrades: Math.max(1, Math.floor(num("MAX_OPEN_TRADES_PER_SYMBOL", 1))),
  cooldownSeconds: Math.max(30, Math.floor(num("COOLDOWN_SECONDS", 600))),
  maxSpreadPct: num("MAX_SPREAD_PCT", 0.8),
  minOptionOpenInterest: Math.max(100, Math.floor(num("MIN_OPTION_OI", 1000))),
  minOptionVolume: Math.max(10, Math.floor(num("MIN_OPTION_VOLUME", 100))),
  minRewardRisk: num("MIN_RR", 1.8)
};

export const appConfig = {
  alpacaApiKey: required("ALPACA_API_KEY"),
  alpacaSecretKey: required("ALPACA_SECRET_KEY"),
  alpacaBaseUrl: process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets",
  alpacaDataUrl: process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets",
  pollSeconds: Math.max(5, Math.floor(num("POLL_SECONDS", 15))),
  maxDailyLossUsd: num("MAX_DAILY_LOSS", 1_000),
  maxLossPerTradeUsd: num("MAX_LOSS_PER_TRADE", 250),
  riskPerTradeUsd: num("RISK_PER_TRADE", 100),
  symbols: symbols.map<SymbolConfig>((symbol) => ({ symbol, ...sharedSymbolConfig }))
};
