import { AlpacaClient } from "../alpaca/client.js";
import { RiskEngine } from "../core/risk.js";
import type { SymbolConfig } from "../core/types.js";
import { SymbolEngine } from "./symbolEngine.js";

interface Worker {
  symbol: string;
  timer?: ReturnType<typeof setInterval>;
  busy: boolean;
  engine: SymbolEngine;
}

export class TradeCoordinator {
  private readonly workers: Worker[];

  constructor(
    configs: SymbolConfig[],
    private readonly pollSeconds: number,
    client: AlpacaClient,
    risk: RiskEngine
  ) {
    this.workers = configs.map((cfg) => ({
      symbol: cfg.symbol,
      busy: false,
      engine: new SymbolEngine(cfg, client, risk)
    }));
  }

  start(): void {
    for (const worker of this.workers) {
      worker.timer = setInterval(async () => {
        if (worker.busy) {
          return;
        }

        worker.busy = true;
        try {
          await worker.engine.runCycle();
        } catch (error) {
          console.error(`[${worker.symbol}] cycle error`, error);
        } finally {
          worker.busy = false;
        }
      }, this.pollSeconds * 1000);
    }

    console.log(`Trade coordinator started for: ${this.workers.map((w) => w.symbol).join(", ")}`);
  }

  stop(): void {
    for (const worker of this.workers) {
      if (worker.timer) {
        clearInterval(worker.timer);
        worker.timer = undefined;
      }
    }
  }
}
