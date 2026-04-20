import type { Bar } from "../core/types.js";

export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  return values.slice(1).reduce((acc, value) => value * k + acc * (1 - k), values[0]);
}

export function atr(bars: Bar[], period = 14): number {
  if (bars.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const prevClose = bars[i - 1].close;
    const current = bars[i];
    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose)
    );
    trs.push(trueRange);
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / Math.max(slice.length, 1);
}

export function vwap(bars: Bar[]): number {
  let cumulativePv = 0;
  let cumulativeVolume = 0;
  for (const bar of bars) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativePv += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;
  }
  return cumulativeVolume === 0 ? bars.at(-1)?.close ?? 0 : cumulativePv / cumulativeVolume;
}

export function rvol(bars: Bar[], lookback = 20): number {
  if (bars.length < lookback + 1) return 1;
  const recent = bars.at(-1)?.volume ?? 0;
  const avg = bars.slice(-1 - lookback, -1).reduce((acc, b) => acc + b.volume, 0) / lookback;
  return avg === 0 ? 1 : recent / avg;
}
