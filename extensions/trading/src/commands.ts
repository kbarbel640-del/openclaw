import type { BrokerProvider, OrderSide, OrderType, Position } from "./types.js";

// =============================================================================
// Auto-reply command handlers (bypass LLM)
// =============================================================================

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatPercent(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function formatPosition(p: Position): string {
  const pl = `${formatMoney(p.unrealizedPL)} (${formatPercent(p.unrealizedPLPercent)})`;
  return `${p.symbol}: ${p.qty} shares @ ${formatMoney(p.avgEntryPrice)} → ${formatMoney(p.currentPrice)} | P&L: ${pl}`;
}

export async function handlePortfolioCommand(provider: BrokerProvider): Promise<string> {
  const [account, positions] = await Promise.all([provider.getAccount(), provider.getPositions()]);

  const lines: string[] = [
    "📊 Portfolio Summary",
    `Equity: ${formatMoney(account.equity)}`,
    `Cash: ${formatMoney(account.cash)}`,
    `Buying Power: ${formatMoney(account.buyingPower)}`,
    `Day P&L: ${formatMoney(account.dayPL)} (${formatPercent(account.dayPLPercent)})`,
    "",
  ];

  if (positions.length === 0) {
    lines.push("No open positions.");
  } else {
    lines.push(`Positions (${positions.length}):`);
    for (const p of positions) {
      lines.push(`  ${formatPosition(p)}`);
    }
  }

  return lines.join("\n");
}

export async function handleBuyCommand(provider: BrokerProvider, args: string): Promise<string> {
  return handleOrderCommand(provider, "buy", args);
}

export async function handleSellCommand(provider: BrokerProvider, args: string): Promise<string> {
  return handleOrderCommand(provider, "sell", args);
}

async function handleOrderCommand(
  provider: BrokerProvider,
  side: OrderSide,
  args: string,
): Promise<string> {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const symbol = parts[0];
  const qty = Number(parts[1]);

  if (!symbol || !parts[1]) {
    return (
      `Usage: /${side} <SYMBOL> <QTY> [limit <PRICE>]\n` +
      `  /${side} AAPL 10            — market ${side}\n` +
      `  /${side} AAPL 10 limit 150  — limit ${side} @ $150`
    );
  }

  if (isNaN(qty) || qty <= 0) {
    return `Error: qty must be a positive number (got "${parts[1]}")`;
  }

  let orderType: OrderType = "market";
  let limitPrice: number | undefined;

  if (parts[2]?.toLowerCase() === "limit") {
    if (!parts[3]) {
      return `Error: limit order requires a price — e.g. /${side} ${symbol} ${qty} limit 150`;
    }
    limitPrice = Number(parts[3]);
    if (isNaN(limitPrice) || limitPrice <= 0) {
      return `Error: limit price must be a positive number (got "${parts[3]}")`;
    }
    orderType = "limit";
  }

  const result = await provider.placeOrder({ symbol, qty, side, type: orderType, limitPrice });

  const sideLabel = side === "buy" ? "Buy" : "Sell";
  const orderDesc =
    orderType === "limit" && result.limitPrice !== undefined
      ? `${result.qty} shares (limit @ ${formatMoney(result.limitPrice)})`
      : `${result.qty} shares (market)`;

  const warning =
    side === "sell" && provider.name !== "mock"
      ? "\n⚠️  Warning: sell orders in live mode are irreversible."
      : "";

  return [
    `✅ ${sideLabel} Order Submitted`,
    `${result.symbol}: ${orderDesc}`,
    `Status: ${result.status} | ID: ${result.id}`,
    warning,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function handlePriceCommand(
  provider: BrokerProvider,
  symbol: string,
): Promise<string> {
  if (!symbol) {
    return "Usage: /price <SYMBOL>  (e.g., /price AAPL)";
  }

  const quote = await provider.getQuote(symbol);
  const sign = quote.change >= 0 ? "+" : "";
  return [
    `💰 ${quote.symbol}`,
    `Price: ${formatMoney(quote.lastPrice)}`,
    `Change: ${sign}${formatMoney(quote.change)} (${formatPercent(quote.changePercent)})`,
    quote.volume > 0 ? `Volume: ${quote.volume.toLocaleString("en-US")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
