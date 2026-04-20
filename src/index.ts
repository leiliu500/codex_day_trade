import { AlpacaClient } from "./alpaca/client.js";
import { appConfig } from "./config.js";
import { RiskEngine } from "./core/risk.js";
import { TradeCoordinator } from "./engine/coordinator.js";

function boot(): void {
  const client = new AlpacaClient(
    appConfig.alpacaApiKey,
    appConfig.alpacaSecretKey,
    appConfig.alpacaBaseUrl,
    appConfig.alpacaDataUrl
  );

  const riskEngine = new RiskEngine(
    appConfig.maxDailyLossUsd,
    appConfig.maxLossPerTradeUsd,
    appConfig.riskPerTradeUsd
  );

  const coordinator = new TradeCoordinator(appConfig.symbols, appConfig.pollSeconds, client, riskEngine);
  coordinator.start();

  const shutdown = () => {
    console.log("Shutting down option system...");
    coordinator.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

boot();
