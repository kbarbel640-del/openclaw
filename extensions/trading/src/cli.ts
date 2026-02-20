import type { Command } from "commander";
import type { BrokerProvider } from "./types.js";

// =============================================================================
// CLI Registration: openclaw trading <subcommand>
// =============================================================================

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export function registerTradingCli(params: {
  program: Command;
  ensureProvider: () => Promise<BrokerProvider>;
  logger: Logger;
}) {
  const { program, ensureProvider } = params;

  const root = program.command("trading").description("Trading portfolio & price utilities");

  root
    .command("status")
    .description("Show account status")
    .action(async () => {
      const provider = await ensureProvider();
      const account = await provider.getAccount();
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(account, null, 2));
    });

  root
    .command("portfolio")
    .description("Show all open positions")
    .action(async () => {
      const provider = await ensureProvider();
      const [account, positions] = await Promise.all([
        provider.getAccount(),
        provider.getPositions(),
      ]);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ account, positions }, null, 2));
    });

  root
    .command("price")
    .description("Get the latest price for a symbol")
    .argument("<symbol>", "Ticker symbol (e.g., AAPL, BTC/USD)")
    .action(async (symbol: string) => {
      const provider = await ensureProvider();
      const quote = await provider.getQuote(symbol);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(quote, null, 2));
    });

  root
    .command("buy")
    .description("Place a market or limit buy order")
    .argument("<symbol>", "Ticker symbol (e.g., AAPL)")
    .argument("<qty>", "Number of shares to buy")
    .option("--limit <price>", "Place a limit order at this price")
    .action(async (symbol: string, qtyStr: string, options: { limit?: string }) => {
      const provider = await ensureProvider();
      const qty = Number(qtyStr);
      const limitPrice = options.limit !== undefined ? Number(options.limit) : undefined;
      const result = await provider.placeOrder({
        symbol,
        qty,
        side: "buy",
        type: options.limit !== undefined ? "limit" : "market",
        limitPrice,
      });
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
    });

  root
    .command("sell")
    .description("Place a market or limit sell order")
    .argument("<symbol>", "Ticker symbol (e.g., AAPL)")
    .argument("<qty>", "Number of shares to sell")
    .option("--limit <price>", "Place a limit order at this price")
    .action(async (symbol: string, qtyStr: string, options: { limit?: string }) => {
      const provider = await ensureProvider();
      const qty = Number(qtyStr);
      const limitPrice = options.limit !== undefined ? Number(options.limit) : undefined;
      const result = await provider.placeOrder({
        symbol,
        qty,
        side: "sell",
        type: options.limit !== undefined ? "limit" : "market",
        limitPrice,
      });
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
    });
}
