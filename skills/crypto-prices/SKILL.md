---
name: crypto-prices
description: "Get real-time cryptocurrency prices, market data, and portfolio tracking. No API key required."
homepage: https://www.coingecko.com/en/api
metadata:
  {
    "openclaw":
      {
        "emoji": "🪙",
        "requires": { "bins": ["curl", "jq"] },
        "install":
          [
            {
              "id": "brew-jq",
              "kind": "brew",
              "formula": "jq",
              "bins": ["jq"],
              "label": "Install jq (brew)",
            },
            {
              "id": "apt-jq",
              "kind": "apt",
              "package": "jq",
              "bins": ["jq"],
              "label": "Install jq (apt)",
            },
          ],
      },
  }
---

# Crypto Price Tracker

Get real-time cryptocurrency prices using free public APIs. **No API key required.**

Uses CoinGecko API (free tier: 10-30 calls/minute).

## Quick Price Checks

### Get Bitcoin price

```bash
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd" | jq -r '"Bitcoin: $" + (.bitcoin.usd | tostring)'
```

### Get multiple coin prices

```bash
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,cardano&vs_currencies=usd" | jq -r 'to_entries[] | "\(.key): $\(.value.usd)"'
```

### Get price with 24h change

```bash
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true" | jq -r 'to_entries[] | "\(.key): $\(.value.usd) (\(.value.usd_24h_change | . * 100 | round / 100)%)"'
```

## Detailed Coin Data

### Full market data for a coin

```bash
curl -s "https://api.coingecko.com/api/v3/coins/bitcoin" | jq '{
  name: .name,
  symbol: .symbol,
  price_usd: .market_data.current_price.usd,
  market_cap: .market_data.market_cap.usd,
  volume_24h: .market_data.total_volume.usd,
  change_24h: .market_data.price_change_percentage_24h,
  change_7d: .market_data.price_change_percentage_7d,
  ath: .market_data.ath.usd,
  ath_date: .market_data.ath_date.usd
}'
```

### Get coin by symbol (search first)

```bash
# Find coin ID by symbol (e.g., SOL)
curl -s "https://api.coingecko.com/api/v3/search?query=sol" | jq -r '.coins[0] | "\(.id): \(.name) (\(.symbol))"'
```

## Market Overview

### Top 10 coins by market cap

```bash
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1" | jq -r '.[] | "\(.market_cap_rank). \(.name) (\(.symbol | ascii_upcase)): $\(.current_price) (\(.price_change_percentage_24h | . * 100 | round / 100)%)"'
```

### Top gainers (24h)

```bash
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=percent_change_24h_desc&per_page=10&page=1" | jq -r '.[] | select(.price_change_percentage_24h > 0) | "\(.name): +\(.price_change_percentage_24h | . * 100 | round / 100)%"'
```

### Top losers (24h)

```bash
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=percent_change_24h_asc&per_page=10&page=1" | jq -r '.[] | select(.price_change_percentage_24h < 0) | "\(.name): \(.price_change_percentage_24h | . * 100 | round / 100)%"'
```

## Trending & Popular

### Trending coins (what's hot)

```bash
curl -s "https://api.coingecko.com/api/v3/search/trending" | jq -r '.coins[].item | "\(.score + 1). \(.name) (\(.symbol)) - Rank #\(.market_cap_rank)"'
```

### Global market stats

```bash
curl -s "https://api.coingecko.com/api/v3/global" | jq '{
  total_market_cap: .data.total_market_cap.usd,
  total_volume_24h: .data.total_volume.usd,
  btc_dominance: .data.market_cap_percentage.btc,
  eth_dominance: .data.market_cap_percentage.eth,
  active_cryptocurrencies: .data.active_cryptocurrencies,
  market_cap_change_24h: .data.market_cap_change_percentage_24h_usd
}'
```

## Portfolio Tracking

### Calculate portfolio value

```bash
# Define your holdings (coin_id:amount)
holdings="bitcoin:0.5 ethereum:2 solana:100"

# Get prices and calculate
ids=$(echo $holdings | tr ' ' '\n' | cut -d: -f1 | tr '\n' ',' | sed 's/,$//')
prices=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=$ids&vs_currencies=usd")

echo "$holdings" | tr ' ' '\n' | while IFS=: read coin amount; do
  price=$(echo $prices | jq -r ".$coin.usd")
  value=$(echo "$amount * $price" | bc)
  printf "%s: %s × $%s = $%.2f\n" "$coin" "$amount" "$price" "$value"
done
```

## Price Alerts (One-liner)

### Check if Bitcoin is above/below threshold

```bash
# Alert if BTC > $100,000
price=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd" | jq -r '.bitcoin.usd')
echo "BTC: \$$price" && [ $(echo "$price > 100000" | bc) -eq 1 ] && echo "🚀 BTC broke $100k!"
```

## Historical Data

### Get 30-day price history

```bash
curl -s "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30" | jq -r '.prices | .[-1][1] as $current | .[0][1] as $start | "30d ago: $\($start | round) → Now: $\($current | round) (\((($current - $start) / $start * 100) | . * 100 | round / 100)%)"'
```

## Common Coin IDs

Use these IDs with the API:

| Symbol | Coin ID       |
| ------ | ------------- |
| BTC    | bitcoin       |
| ETH    | ethereum      |
| SOL    | solana        |
| ADA    | cardano       |
| XRP    | ripple        |
| DOT    | polkadot      |
| DOGE   | dogecoin      |
| AVAX   | avalanche-2   |
| MATIC  | matic-network |
| LINK   | chainlink     |
| UNI    | uniswap       |
| ATOM   | cosmos        |

## Notes

- **Rate limits**: Free tier allows 10-30 calls/minute
- **Coin IDs**: Use full IDs (e.g., "bitcoin") not symbols (e.g., "BTC")
- **Currencies**: Supports USD, EUR, GBP, JPY, etc. (use `vs_currencies=eur`)
- **jq required**: Install with `brew install jq` or `apt install jq`
- **Price accuracy**: Data is typically 1-5 minutes delayed

## Alternative: CoinCap API

Another free API option:

```bash
# Bitcoin price via CoinCap
curl -s "https://api.coincap.io/v2/assets/bitcoin" | jq -r '"Bitcoin: $" + .data.priceUsd'

# Top 10 assets
curl -s "https://api.coincap.io/v2/assets?limit=10" | jq -r '.data[] | "\(.rank). \(.name): $\(.priceUsd | tonumber | . * 100 | round / 100)"'
```
