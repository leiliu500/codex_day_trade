import { RiskEngine } from "../core/risk.js";
import type { EntrySignal, OptionContract, SymbolConfig } from "../core/types.js";
import { atr, ema, rvol, vwap } from "../strategy/indicators.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Test failed: ${message}`);
  }
}

function testIndicators(): void {
  const closes = [100, 101, 102, 103, 104, 105];
  const emaValue = ema(closes, 3);
  assert(emaValue > 100 && emaValue <= 105, "EMA should be within expected range");

  const bars = closes.map((c, i) => ({
    timestamp: new Date(2024, 0, 1, 9, i).toISOString(),
    open: c - 0.5,
    high: c + 0.5,
    low: c - 1,
    close: c,
    volume: 1000 + i * 50
  }));

  assert(atr(bars, 3) > 0, "ATR should be positive");
  assert(vwap(bars) > 0, "VWAP should be positive");
  assert(rvol([...bars, { ...bars.at(-1)!, volume: 3000 }], 3) > 1, "RVOL should reflect higher last bar volume");
}

function testRiskEnginePlanAndExit(): void {
  const engine = new RiskEngine(1000, 250, 100);

  const cfg: SymbolConfig = {
    symbol: "SPY",
    timeframeMinutes: 1,
    minSignalStrength: 0.6,
    maxOpenTrades: 1,
    cooldownSeconds: 600,
    maxSpreadPct: 1.5,
    minOptionOpenInterest: 1000,
    minOptionVolume: 100,
    minRewardRisk: 0.9
  };

  const signal: EntrySignal = {
    side: "bullish",
    setup: "trend_pullback",
    strength: 0.8,
    reason: ["trend_up"],
    invalidationPrice: 100,
    targetPrice: 102
  };

  const contract: OptionContract = {
    symbol: "SPY240621C00520000",
    expiration: "2024-06-21",
    strike: 520,
    optionType: "call",
    delta: 0.5,
    ask: 2,
    bid: 1.99,
    openInterest: 5000,
    volume: 500
  };

  const plan = engine.planTrade(cfg, signal, contract);
  assert(plan !== null, "Risk engine should return a trade plan for valid input");

  const position = engine.onTradeOpened(plan!);
  assert(position.maxHoldingMinutes === plan!.maxHoldingMinutes, "Position should inherit max holding minutes");

  const decision1 = engine.evaluateManagedExit(position, plan!.takeProfit1 + 0.01);
  assert(decision1 === "trim_half", "First TP reach should request trim");

  const decision2 = engine.evaluateManagedExit(position, plan!.takeProfit1 + 0.02);
  assert(decision2 !== "trim_half", "TP1 trim should only happen once");

  const decision3 = engine.evaluateManagedExit(position, position.currentStop - 0.01);
  assert(decision3 === "close_all", "Breaching stop should close position");
}

function run(): void {
  const tests: Array<{ name: string; fn: () => void }> = [
    { name: "indicators", fn: testIndicators },
    { name: "risk_engine", fn: testRiskEnginePlanAndExit }
  ];

  for (const test of tests) {
    test.fn();
    console.log(`PASS ${test.name}`);
  }

  console.log("All tests passed.");
}

run();
