import { AlpacaClient } from "../alpaca/client.js";
import { RiskEngine } from "../core/risk.js";
import type { SymbolConfig } from "../core/types.js";
import { evaluateEntry } from "../strategy/signal.js";

export class SymbolEngine {
  constructor(
    private readonly cfg: SymbolConfig,
    private readonly client: AlpacaClient,
    private readonly risk: RiskEngine
  ) {}

  async runCycle(): Promise<void> {
    await this.manageOpenPositions();

    const riskDecision = this.risk.canOpenTrade(this.cfg);
    if (!riskDecision.allowed) {
      return;
    }

    const snapshot = await this.client.getMarketSnapshot(this.cfg.symbol);
    const signal = evaluateEntry(snapshot);
    if (!signal || signal.strength < this.cfg.minSignalStrength) {
      this.risk.onRejectedSetup(this.cfg.symbol, Math.floor(this.cfg.cooldownSeconds / 4));
      return;
    }

    const contract = await this.client.findContract(
      this.cfg.symbol,
      signal.side === "bullish" ? "call" : "put",
      this.cfg.minOptionOpenInterest,
      this.cfg.minOptionVolume
    );

    const tradePlan = this.risk.planTrade(this.cfg, signal, contract);
    if (!tradePlan) {
      this.risk.onRejectedSetup(this.cfg.symbol, this.cfg.cooldownSeconds);
      return;
    }

    await this.client.submitEntryOrder(tradePlan);
    this.risk.onTradeOpened(tradePlan);
    console.log(
      `[${this.cfg.symbol}] ENTRY ${tradePlan.optionSymbol} qty=${tradePlan.quantity} at ${tradePlan.entryLimit} ${tradePlan.reason}`
    );
  }

  private async manageOpenPositions(): Promise<void> {
    const positions = this.risk.getOpenPositions(this.cfg.symbol);
    for (const position of positions) {
      const optionMid = await this.client.getOptionMid(position.optionSymbol);
      const heldMinutes = (Date.now() - new Date(position.openedAt).getTime()) / 60_000;
      if (heldMinutes >= position.maxHoldingMinutes) {
        await this.client.submitExitOrder(position, position.quantity);
        const realizedMid = optionMid > 0 ? optionMid : position.entryPrice;
        const pnl = (realizedMid - position.entryPrice) * 100 * position.quantity;
        this.risk.onTradeClosed(position.symbol, position.optionSymbol, pnl);
        console.log(`[${this.cfg.symbol}] EXIT ${position.optionSymbol} reason=max_hold_minutes pnl=${pnl.toFixed(2)}`);
        continue;
      }

      if (optionMid <= 0) {
        continue;
      }

      const action = this.risk.evaluateManagedExit(position, optionMid);
      if (action === "trim_half" && position.quantity > 1) {
        const trimQty = Math.floor(position.quantity / 2);
        await this.client.submitExitOrder(position, trimQty);
        position.quantity -= trimQty;
      }

      if (action === "close_all") {
        await this.client.submitExitOrder(position, position.quantity);
        const pnl = (optionMid - position.entryPrice) * 100 * position.quantity;
        this.risk.onTradeClosed(position.symbol, position.optionSymbol, pnl);
        console.log(`[${this.cfg.symbol}] EXIT ${position.optionSymbol} pnl=${pnl.toFixed(2)}`);
      }
    }
  }
}
