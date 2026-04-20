export type Side = "bullish" | "bearish";

export interface SymbolConfig {
  symbol: string;
  timeframeMinutes: 1;
  minSignalStrength: number;
  maxOpenTrades: number;
  cooldownSeconds: number;
  maxSpreadPct: number;
  minOptionOpenInterest: number;
  minOptionVolume: number;
  minRewardRisk: number;
}

export interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSnapshot {
  symbol: string;
  bars: Bar[];
  price: number;
  emaFast: number;
  emaSlow: number;
  vwap: number;
  atr: number;
  rvol: number;
  ivRank: number;
  spreadPct: number;
  timestamp: string;
}

export interface EntrySignal {
  side: Side;
  setup: "trend_pullback" | "opening_range_breakout" | "mean_reversion";
  strength: number;
  reason: string[];
  invalidationPrice: number;
  targetPrice: number;
}

export interface OptionContract {
  symbol: string;
  expiration: string;
  strike: number;
  optionType: "call" | "put";
  delta: number;
  ask: number;
  bid: number;
  openInterest: number;
  volume: number;
}

export interface TradePlan {
  symbol: string;
  optionSymbol: string;
  side: Side;
  quantity: number;
  entryLimit: number;
  initialStop: number;
  breakEvenTrigger: number;
  trailingStopOffset: number;
  takeProfit1: number;
  takeProfit2: number;
  maxHoldingMinutes: number;
  reason: string;
}

export interface PositionState {
  symbol: string;
  optionSymbol: string;
  side: Side;
  quantity: number;
  entryPrice: number;
  currentStop: number;
  trailingStopOffset: number;
  breakEvenTrigger: number;
  takeProfit1: number;
  takeProfit2: number;
  tp1Filled: boolean;
  maxHoldingMinutes: number;
  openedAt: string;
  maxSeenPremium: number;
}

export interface RiskDecision {
  allowed: boolean;
  reason: string;
}
