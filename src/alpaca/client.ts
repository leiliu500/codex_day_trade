import type { Bar, MarketSnapshot, OptionContract, PositionState, TradePlan } from "../core/types.js";
import { atr, ema, rvol, vwap } from "../strategy/indicators.js";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

export class AlpacaClient {
  constructor(
    private readonly apiKey: string,
    private readonly secretKey: string,
    private readonly baseUrl: string,
    private readonly dataUrl: string
  ) {}

  private async request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "APCA-API-KEY-ID": this.apiKey,
        "APCA-API-SECRET-KEY": this.secretKey
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Alpaca request failed ${response.status} for ${url}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  async getMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
    type BarsResponse = { bars: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }> };
    type LatestQuoteResponse = { quotes: Record<string, { bp: number; ap: number }> };

    const now = new Date();
    const start = new Date(now.getTime() - 90 * 60 * 1000).toISOString();
    const end = now.toISOString();

    const barsResponse = await this.request<BarsResponse>(
      `${this.dataUrl}/v2/stocks/${symbol}/bars?timeframe=1Min&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=300`
    );

    const bars: Bar[] = barsResponse.bars.map((b) => ({
      timestamp: b.t,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v
    }));

    if (bars.length < 30) {
      throw new Error(`Insufficient bars for ${symbol}`);
    }

    const quoteResponse = await this.request<LatestQuoteResponse>(
      `${this.dataUrl}/v2/stocks/quotes/latest?symbols=${symbol}`
    ).catch(() => ({ quotes: {} as Record<string, { bp: number; ap: number }> }));

    const quote = quoteResponse.quotes[symbol];
    const closes = bars.map((b) => b.close);
    const price = closes.at(-1) ?? 0;
    const spreadPct = quote && quote.ap > 0 ? ((quote.ap - quote.bp) / quote.ap) * 100 : 0.3;

    return {
      symbol,
      bars,
      price,
      emaFast: ema(closes.slice(-30), 9),
      emaSlow: ema(closes.slice(-60), 21),
      vwap: vwap(bars),
      atr: atr(bars, 14),
      rvol: rvol(bars, 20),
      ivRank: 0.5,
      spreadPct,
      timestamp: bars.at(-1)?.timestamp ?? new Date().toISOString()
    };
  }

  async findContract(
    symbol: string,
    optionType: "call" | "put",
    minOpenInterest: number,
    minVolume: number
  ): Promise<OptionContract> {
    type ChainResponse = {
      option_contracts: Array<{
        symbol: string;
        expiration_date: string;
        strike_price: string;
        type: "call" | "put";
        open_interest?: string;
        close_price?: string;
        volume?: string;
      }>;
    };

    const chain = await this.request<ChainResponse>(
      `${this.dataUrl}/v1beta1/options/contracts?underlying_symbols=${symbol}&status=active&expiration_date_gte=${new Date().toISOString().slice(0, 10)}&limit=200`
    );

    const selected = chain.option_contracts
      .filter((c) => c.type === optionType)
      .map((contract) => ({
        ...contract,
        oi: Number(contract.open_interest ?? "0"),
        vol: Number(contract.volume ?? "0"),
        px: Number(contract.close_price ?? "0")
      }))
      .filter((c) => c.oi >= minOpenInterest && c.vol >= minVolume && c.px > 0)
      .sort((a, b) => b.oi - a.oi)[0];

    if (!selected) {
      throw new Error(`No suitable ${optionType} contract for ${symbol}`);
    }

    return {
      symbol: selected.symbol,
      expiration: selected.expiration_date,
      strike: Number(selected.strike_price),
      optionType,
      delta: optionType === "call" ? 0.5 : -0.5,
      ask: selected.px * 1.01,
      bid: selected.px * 0.99,
      openInterest: selected.oi,
      volume: selected.vol
    };
  }

  async getOptionMid(optionSymbol: string): Promise<number> {
    type OptionLatestQuoteResponse = { quotes: Record<string, { bp: number; ap: number }> };

    const response = await this.request<OptionLatestQuoteResponse>(
      `${this.dataUrl}/v1beta1/options/quotes/latest?symbols=${optionSymbol}`
    ).catch(() => ({ quotes: {} as Record<string, { bp: number; ap: number }> }));

    const quote = response.quotes[optionSymbol];
    if (!quote || quote.ap <= 0 || quote.bp <= 0) {
      return 0;
    }

    return Number(((quote.bp + quote.ap) / 2).toFixed(2));
  }

  async submitEntryOrder(plan: TradePlan): Promise<void> {
    await this.request(`${this.baseUrl}/v2/orders`, {
      method: "POST",
      body: {
        symbol: plan.optionSymbol,
        qty: String(plan.quantity),
        side: "buy",
        type: "limit",
        time_in_force: "day",
        limit_price: plan.entryLimit.toFixed(2)
      }
    });
  }

  async submitExitOrder(position: PositionState, qty: number): Promise<void> {
    await this.request(`${this.baseUrl}/v2/orders`, {
      method: "POST",
      body: {
        symbol: position.optionSymbol,
        qty: String(qty),
        side: "sell",
        type: "market",
        time_in_force: "day"
      }
    });
  }
}
