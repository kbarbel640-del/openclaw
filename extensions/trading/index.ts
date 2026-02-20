import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerTradingCli } from "./src/cli.js";
import {
  handleBuyCommand,
  handlePortfolioCommand,
  handlePriceCommand,
  handleSellCommand,
} from "./src/commands.js";
import {
  TradingConfigSchema,
  resolveTradingConfig,
  validateProviderConfig,
  type TradingConfig,
} from "./src/config.js";
import { AlpacaProvider } from "./src/providers/alpaca.js";
import { MockProvider } from "./src/providers/mock.js";
import type { BrokerProvider } from "./src/types.js";

// =============================================================================
// Config Schema (parse + uiHints)
// =============================================================================

const tradingConfigSchema = {
  parse(value: unknown): TradingConfig {
    const raw =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    const enabled = typeof raw.enabled === "boolean" ? raw.enabled : false;
    const provider = raw.provider ?? (enabled ? "mock" : "mock");

    return TradingConfigSchema.parse({
      ...raw,
      enabled,
      provider,
    });
  },
  uiHints: {
    provider: {
      label: "Broker Provider",
      help: "Use alpaca for live/paper trading, or mock for dev/no-network.",
    },
    apiKey: { label: "API Key", sensitive: true },
    apiSecret: { label: "API Secret", sensitive: true },
    paperTrading: { label: "Paper Trading" },
    baseUrl: { label: "Base URL Override", advanced: true },
  },
};

// =============================================================================
// Tool Schemas (TypeBox)
// =============================================================================

const PortfolioToolSchema = Type.Object({});

const PriceToolSchema = Type.Object({
  symbol: Type.String({ description: "Ticker symbol (e.g. AAPL, MSFT, BTC/USD)" }),
});

const OrderToolSchema = Type.Object({
  symbol: Type.String({ description: "Ticker symbol (e.g. AAPL, BTC/USD)" }),
  qty: Type.Number({ description: "Number of shares/units to trade" }),
  side: Type.Union([Type.Literal("buy"), Type.Literal("sell")], {
    description: "Order direction",
  }),
  type: Type.Union([Type.Literal("market"), Type.Literal("limit")], {
    description: "Order type",
  }),
  limitPrice: Type.Optional(
    Type.Number({ description: "Limit price (required for limit orders)" }),
  ),
});

// =============================================================================
// Provider Factory
// =============================================================================

function createProvider(config: TradingConfig): BrokerProvider {
  switch (config.provider) {
    case "alpaca":
      return new AlpacaProvider(config);
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Unknown trading provider: ${config.provider}`);
  }
}

// =============================================================================
// Plugin Definition
// =============================================================================

const tradingPlugin = {
  id: "trading",
  name: "Trading",
  description: "Portfolio tracking and price quotes via Alpaca Markets (or mock provider).",
  configSchema: tradingConfigSchema,
  register(api: OpenClawPluginApi) {
    const config = resolveTradingConfig(tradingConfigSchema.parse(api.pluginConfig));
    const validation = validateProviderConfig(config);

    // Lazy provider initialization
    let provider: BrokerProvider | null = null;

    const ensureProvider = async (): Promise<BrokerProvider> => {
      if (!config.enabled) {
        throw new Error("Trading plugin is disabled in config");
      }
      if (!validation.valid) {
        throw new Error(validation.errors.join("; "));
      }
      if (!provider) {
        provider = createProvider(config);
      }
      return provider;
    };

    // -------------------------------------------------------------------------
    // Agent Tools
    // -------------------------------------------------------------------------

    api.registerTool({
      name: "trading_portfolio",
      label: "Trading Portfolio",
      description:
        "Get the current trading account status, all open positions, and P&L summary. " +
        "Use this when the user asks about their portfolio, positions, account balance, or P&L.",
      parameters: PortfolioToolSchema,
      async execute() {
        try {
          const p = await ensureProvider();
          const [account, positions] = await Promise.all([p.getAccount(), p.getPositions()]);
          const totalUnrealizedPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0);
          const payload = { account, positions, totalUnrealizedPL };
          return {
            content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
            details: payload,
          };
        } catch (err) {
          const payload = { error: err instanceof Error ? err.message : String(err) };
          return {
            content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
            details: payload,
          };
        }
      },
    });

    api.registerTool({
      name: "trading_price",
      label: "Trading Price",
      description:
        "Get the current price and change for a stock or crypto symbol. " +
        "Use this when the user asks about the price of a specific ticker.",
      parameters: PriceToolSchema,
      async execute(_toolCallId, params) {
        try {
          const symbol = typeof params?.symbol === "string" ? params.symbol.trim() : "";
          if (!symbol) {
            throw new Error("symbol is required");
          }
          const p = await ensureProvider();
          const quote = await p.getQuote(symbol);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(quote, null, 2) }],
            details: quote,
          };
        } catch (err) {
          const payload = { error: err instanceof Error ? err.message : String(err) };
          return {
            content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
            details: payload,
          };
        }
      },
    });

    api.registerTool({
      name: "trading_order",
      label: "Trading Order",
      description:
        "Place a buy or sell order for a stock or crypto symbol. " +
        "Use this when the user asks to buy or sell shares, place an order, or execute a trade. " +
        "Supports market and limit orders. " +
        "WARNING: sell orders in live mode are irreversible.",
      parameters: OrderToolSchema,
      async execute(_toolCallId, params) {
        try {
          const symbol = typeof params?.symbol === "string" ? params.symbol.trim() : "";
          const qty = typeof params?.qty === "number" ? params.qty : NaN;
          const side = params?.side as "buy" | "sell" | undefined;
          const type = params?.type as "market" | "limit" | undefined;
          const limitPrice = typeof params?.limitPrice === "number" ? params.limitPrice : undefined;

          if (!symbol) throw new Error("symbol is required");
          if (!qty || qty <= 0) throw new Error("qty must be a positive number");
          if (side !== "buy" && side !== "sell") throw new Error("side must be buy or sell");
          if (type !== "market" && type !== "limit")
            throw new Error("type must be market or limit");
          if (type === "limit" && limitPrice === undefined) {
            throw new Error("limitPrice is required for limit orders");
          }

          const p = await ensureProvider();
          const result = await p.placeOrder({ symbol, qty, side, type, limitPrice });
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
            details: result,
          };
        } catch (err) {
          const payload = { error: err instanceof Error ? err.message : String(err) };
          return {
            content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
            details: payload,
          };
        }
      },
    });

    // -------------------------------------------------------------------------
    // Auto-reply Commands (bypass LLM)
    // -------------------------------------------------------------------------

    api.registerCommand({
      name: "portfolio",
      description: "Show portfolio summary with positions and P&L.",
      handler: async () => {
        try {
          const p = await ensureProvider();
          const text = await handlePortfolioCommand(p);
          return { text };
        } catch (err) {
          return {
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            isError: true,
          };
        }
      },
    });

    api.registerCommand({
      name: "price",
      description: "Get the current price of a symbol. Usage: /price <SYMBOL>",
      acceptsArgs: true,
      handler: async (ctx) => {
        try {
          const symbol = ctx.args?.trim() ?? "";
          const p = await ensureProvider();
          const text = await handlePriceCommand(p, symbol);
          return { text };
        } catch (err) {
          return {
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            isError: true,
          };
        }
      },
    });

    api.registerCommand({
      name: "buy",
      description:
        "Place a buy order. Usage: /buy <SYMBOL> <QTY> [limit <PRICE>]\n" +
        "  /buy AAPL 10           — market buy\n" +
        "  /buy AAPL 10 limit 150 — limit buy @ $150",
      acceptsArgs: true,
      handler: async (ctx) => {
        try {
          const p = await ensureProvider();
          const text = await handleBuyCommand(p, ctx.args?.trim() ?? "");
          return { text };
        } catch (err) {
          return {
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            isError: true,
          };
        }
      },
    });

    api.registerCommand({
      name: "sell",
      description:
        "Place a sell order. Usage: /sell <SYMBOL> <QTY> [limit <PRICE>]\n" +
        "  /sell AAPL 5           — market sell\n" +
        "  /sell AAPL 5 limit 180 — limit sell @ $180\n" +
        "⚠️  Warning: sell orders in live mode are irreversible.",
      acceptsArgs: true,
      handler: async (ctx) => {
        try {
          const p = await ensureProvider();
          const text = await handleSellCommand(p, ctx.args?.trim() ?? "");
          return { text };
        } catch (err) {
          return {
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            isError: true,
          };
        }
      },
    });

    // -------------------------------------------------------------------------
    // CLI Commands
    // -------------------------------------------------------------------------

    api.registerCli(
      ({ program }) =>
        registerTradingCli({
          program,
          ensureProvider,
          logger: api.logger,
        }),
      { commands: ["trading"] },
    );

    // -------------------------------------------------------------------------
    // Background Service (lazy init)
    // -------------------------------------------------------------------------

    api.registerService({
      id: "trading",
      start: async () => {
        if (!config.enabled) {
          return;
        }
        try {
          await ensureProvider();
        } catch (err) {
          api.logger.error(
            `[trading] Failed to initialize provider: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      },
      stop: async () => {
        provider = null;
      },
    });
  },
};

export default tradingPlugin;
