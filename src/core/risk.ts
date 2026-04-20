import type { EntrySignal, OptionContract, PositionState, RiskDecision, SymbolConfig, TradePlan } from "./types.js";

export class RiskEngine {
  private realizedPnlUsd = 0;
  private readonly openPositions = new Map<string, PositionState[]>();
  private readonly cooldownUntilEpoch = new Map<string, number>();

  constructor(
    private readonly maxDailyLossUsd: number,
    private readonly maxLossPerTradeUsd: number,
    private readonly riskPerTradeUsd: number
  ) {}

  canOpenTrade(cfg: SymbolConfig): RiskDecision {
    if (this.realizedPnlUsd <= -Math.abs(this.maxDailyLossUsd)) {
      return { allowed: false, reason: "daily_loss_lock" };
    }

    if ((this.openPositions.get(cfg.symbol)?.length ?? 0) >= cfg.maxOpenTrades) {
      return { allowed: false, reason: "max_open_positions" };
    }

    const cooldownUntil = this.cooldownUntilEpoch.get(cfg.symbol) ?? 0;
    if (Date.now() < cooldownUntil) {
      return { allowed: false, reason: "symbol_cooldown" };
    }

    return { allowed: true, reason: "ok" };
  }

  planTrade(cfg: SymbolConfig, signal: EntrySignal, contract: OptionContract): TradePlan | null {
    const spreadPct = ((contract.ask - contract.bid) / Math.max(contract.ask, 0.01)) * 100;
    if (spreadPct > cfg.maxSpreadPct) return null;

    const stop = Number((contract.ask * 0.7).toFixed(2));
    const riskPerContract = (contract.ask - stop) * 100;
    const quantity = Math.floor(this.riskPerTradeUsd / Math.max(riskPerContract, 1));

    if (quantity < 1 || riskPerContract * quantity > this.maxLossPerTradeUsd) {
      return null;
    }

    const takeProfit1 = Number((contract.ask * 1.3).toFixed(2));
    const takeProfit2 = Number((contract.ask * 1.65).toFixed(2));
    const rr = (takeProfit1 - contract.ask) / Math.max(contract.ask - stop, 0.01);
    if (rr < cfg.minRewardRisk) return null;

    return {
      symbol: cfg.symbol,
      optionSymbol: contract.symbol,
      side: signal.side,
      quantity,
      entryLimit: Number((contract.bid + (contract.ask - contract.bid) * 0.35).toFixed(2)),
      initialStop: stop,
      breakEvenTrigger: Number((contract.ask * 1.12).toFixed(2)),
      trailingStopOffset: Number((contract.ask * 0.18).toFixed(2)),
      takeProfit1,
      takeProfit2,
      maxHoldingMinutes: 45,
      reason: `${signal.setup}:${signal.reason.join("|")}`
    };
  }

  onTradeOpened(plan: TradePlan): PositionState {
    const position: PositionState = {
      symbol: plan.symbol,
      optionSymbol: plan.optionSymbol,
      side: plan.side,
      quantity: plan.quantity,
      entryPrice: plan.entryLimit,
      currentStop: plan.initialStop,
      trailingStopOffset: plan.trailingStopOffset,
      breakEvenTrigger: plan.breakEvenTrigger,
      takeProfit1: plan.takeProfit1,
      takeProfit2: plan.takeProfit2,
      tp1Filled: false,
      maxHoldingMinutes: plan.maxHoldingMinutes,
      openedAt: new Date().toISOString(),
      maxSeenPremium: plan.entryLimit
    };
    const positions = this.openPositions.get(plan.symbol) ?? [];
    positions.push(position);
    this.openPositions.set(plan.symbol, positions);
    return position;
  }

  evaluateManagedExit(position: PositionState, currentPremium: number): "hold" | "trim_half" | "close_all" {
    position.maxSeenPremium = Math.max(position.maxSeenPremium, currentPremium);

    if (currentPremium >= position.breakEvenTrigger) {
      position.currentStop = Math.max(position.currentStop, position.entryPrice);
    }

    const trailingStop = Number((position.maxSeenPremium - position.trailingStopOffset).toFixed(2));
    if (trailingStop > position.currentStop) {
      position.currentStop = trailingStop;
    }

    if (currentPremium <= position.currentStop) return "close_all";

    if (!position.tp1Filled && currentPremium >= position.takeProfit1) {
      position.tp1Filled = true;
      return "trim_half";
    }

    if (currentPremium >= position.takeProfit2) {
      return "close_all";
    }

    return "hold";
  }

  onTradeClosed(symbol: string, optionSymbol: string, pnlUsd: number): void {
    this.realizedPnlUsd += pnlUsd;
    const positions = this.openPositions.get(symbol) ?? [];
    this.openPositions.set(
      symbol,
      positions.filter((p) => p.optionSymbol !== optionSymbol)
    );
  }

  onRejectedSetup(symbol: string, cooldownSeconds: number): void {
    this.cooldownUntilEpoch.set(symbol, Date.now() + cooldownSeconds * 1000);
  }

  getOpenPositions(symbol: string): PositionState[] {
    return this.openPositions.get(symbol) ?? [];
  }
}
