import type { EntrySignal, MarketSnapshot } from "../core/types.js";

function openingRangeBreak(snapshot: MarketSnapshot): EntrySignal | null {
  const sessionBars = snapshot.bars.slice(-30);
  if (sessionBars.length < 20) return null;

  const openingRange = snapshot.bars.slice(0, 15);
  const openingHigh = Math.max(...openingRange.map((b) => b.high));
  const openingLow = Math.min(...openingRange.map((b) => b.low));

  const strength = Number((0.35 + (snapshot.rvol > 1.2 ? 0.15 : 0) + (snapshot.spreadPct < 0.5 ? 0.2 : 0)).toFixed(2));
  if (snapshot.price > openingHigh) {
    return {
      side: "bullish",
      setup: "opening_range_breakout",
      strength,
      reason: ["orb_up", "volume_confirmed", "spread_ok"],
      invalidationPrice: openingLow,
      targetPrice: snapshot.price + (openingHigh - openingLow) * 1.1
    };
  }

  if (snapshot.price < openingLow) {
    return {
      side: "bearish",
      setup: "opening_range_breakout",
      strength,
      reason: ["orb_down", "volume_confirmed", "spread_ok"],
      invalidationPrice: openingHigh,
      targetPrice: snapshot.price - (openingHigh - openingLow) * 1.1
    };
  }

  return null;
}

function trendPullback(snapshot: MarketSnapshot): EntrySignal | null {
  const bullishTrend = snapshot.emaFast > snapshot.emaSlow && snapshot.price > snapshot.vwap;
  const bearishTrend = snapshot.emaFast < snapshot.emaSlow && snapshot.price < snapshot.vwap;

  if (!bullishTrend && !bearishTrend) return null;

  const strength = Number((0.45 + (snapshot.rvol > 1 ? 0.1 : 0) + (snapshot.ivRank < 0.75 ? 0.1 : 0)).toFixed(2));
  return {
    side: bullishTrend ? "bullish" : "bearish",
    setup: "trend_pullback",
    strength,
    reason: [bullishTrend ? "trend_up" : "trend_down", "vwap_aligned", "iv_ok"],
    invalidationPrice: bullishTrend ? snapshot.price - snapshot.atr : snapshot.price + snapshot.atr,
    targetPrice: bullishTrend ? snapshot.price + snapshot.atr * 1.8 : snapshot.price - snapshot.atr * 1.8
  };
}

export function evaluateEntry(snapshot: MarketSnapshot): EntrySignal | null {
  if (snapshot.spreadPct > 0.9 || snapshot.ivRank > 0.92 || snapshot.rvol < 0.7) {
    return null;
  }

  const orb = openingRangeBreak(snapshot);
  if (orb) return orb;

  return trendPullback(snapshot);
}
