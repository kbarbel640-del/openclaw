---
name: mt5-control
description: Use when you need to control MetaTrader 5 terminal for automated trading, account management, or market data analysis via Python API (requires MT5 terminal running).
metadata:
  openclaw:
    emoji: 📈
    requires:
      pip:
        - package: MetaTrader5
          version: ">=5.0.45"
    install:
      - label: "Install MetaTrader5"
        command: "uv pip install MetaTrader5 pandas pytz"
---

# MT5 Control

Control MetaTrader 5 (MT5) terminal via Python API for automated trading and account management.

## Prerequisites

### Install MetaTrader5 Python Library

```bash
pip install MetaTrader5 pandas pytz
```

### Launch MT5 Terminal

Before any Python API operations, MT5 terminal must be running:

```bash
# Windows - Find and launch MT5
# Common paths (adjust to your installation):
# C:\Program Files\MetaTrader 5\terminal64.exe
# C:\Users\%USERNAME%\AppData\Roaming\MetaQuotes\Terminal\{terminal-id}\terminal64.exe

# Quick launch (if in PATH)
terminal64.exe

# Or by searching:
powershell -Command "Start-Process 'C:\Program Files\MetaTrader 5\terminal64.exe'"
```

## Quick Start

### 1. Initialize MT5 Connection

```python
import MetaTrader5 as mt5

# Initialize MT5
if not mt5.initialize():
    print(f"MT5 initialize failed: {mt5.last_error()}")
    mt5.shutdown()
```

### 2. Get Account Info

```python
# Get account information
account_info = mt5.account_info()
if account_info:
    print(f"Balance: {account_info.balance}")
    print(f"Equity: {account_info.equity}")
    print(f"Margin: {account_info.margin}")
    print(f"Free Margin: {account_info.margin_free}")
    print(f"Profit: {account_info.profit}")
```

### 3. Get Current Positions

```python
# Get all open positions
positions = mt5.positions_get()
if positions:
    for position in positions:
        print(f"Symbol: {position.symbol}, Ticket: {position.ticket}")
        print(f"Type: {'BUY' if position.type == 0 else 'SELL'}")
        print(f"Volume: {position.volume}")
        print(f"Price: {position.price_open}")
        print(f"Profit: {position.profit}")
```

## Trading Operations

### Place a Market Order

```python
def place_order(symbol, order_type, volume, price=None, sl=None, tp=None, comment=""):
    """
    Place a market order

    Args:
        symbol: Trading symbol (e.g., "EURUSD", "XAUUSD")
        order_type: "BUY" or "SELL"
        volume: Lot size (e.g., 0.01, 0.1, 1.0)
        price: Optional price (for pending orders)
        sl: Stop loss price
        tp: Take profit price
        comment: Order comment

    Returns:
        Order ticket or None
    """
    # Get symbol info for validation
    symbol_info = mt5.symbol_info(symbol)
    if not symbol_info:
        print(f"Symbol {symbol} not found")
        return None

    # Get current price
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        print(f"Failed to get tick for {symbol}")
        return None

    # Determine order type and price
    if order_type.upper() == "BUY":
        order_type_code = mt5.ORDER_TYPE_BUY
        price = tick.ask
        request_price = tick.ask
    elif order_type.upper() == "SELL":
        order_type_code = mt5.ORDER_TYPE_SELL
        price = tick.bid
        request_price = tick.bid
    else:
        print(f"Invalid order type: {order_type}")
        return None

    # Create order request
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": float(volume),
        "type": order_type_code,
        "price": request_price,
        "sl": float(sl) if sl else 0.0,
        "tp": float(tp) if tp else 0.0,
        "deviation": 20,
        "magic": 234000,
        "comment": comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    # Send order
    result = mt5.order_send(request)
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"Order failed: {result.comment}")
        return None

    print(f"Order placed successfully. Ticket: {result.order}")
    return result.order
```

### Close a Position

```python
def close_position(ticket):
    """
    Close a position by ticket number

    Args:
        ticket: Position ticket number

    Returns:
        True if successful, False otherwise
    """
    position = mt5.positions_get(ticket=ticket)
    if not position or len(position) == 0:
        print(f"Position {ticket} not found")
        return False

    position = position[0]

    # Determine close direction
    if position.type == mt5.POSITION_TYPE_BUY:
        order_type = mt5.ORDER_TYPE_SELL
        price = mt5.symbol_info_tick(position.symbol).bid
    else:
        order_type = mt5.ORDER_TYPE_BUY
        price = mt5.symbol_info_tick(position.symbol).ask

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": position.symbol,
        "volume": position.volume,
        "type": order_type,
        "position": ticket,
        "price": price,
        "deviation": 20,
        "magic": 234000,
        "comment": "Close position",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request)
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"Close failed: {result.comment}")
        return False

    print(f"Position {ticket} closed successfully")
    return True
```

## Market Data

### Get Symbol Tick Data

```python
# Get current tick for EURUSD
tick = mt5.symbol_info_tick("EURUSD")
if tick:
    print(f"EURUSD Ask: {tick.ask}, Bid: {tick.bid}, Spread: {tick.ask - tick.bid}")
    print(f"Volume: {tick.volume}")
```

### Get Historical Data (OHLCV)

```python
import pandas as pd
from datetime import datetime, timedelta

# Get 100 bars of EURUSD M5 (5-minute) data
symbol = "EURUSD"
timeframe = mt5.TIMEFRAME_M5  # Options: M1, M5, M15, M30, H1, H4, D1, W1, MN1
count = 100

# Get rates
rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)

# Convert to DataFrame
df = pd.DataFrame(rates)
df['time'] = pd.to_datetime(df['time'], unit='s')

print(df.head())
# Output: time, open, high, low, close, tick_volume, spread, real_volume
```

### Get Order History

```python
from datetime import datetime, timedelta

# Get orders from last 7 days
from_date = datetime.now() - timedelta(days=7)
to_date = datetime.now()

orders = mt5.history_orders_get(from_date, to_date)
if orders:
    for order in orders:
        print(f"Ticket: {order.ticket}, Type: {order.type}, Volume: {order.volume}")
        print(f"Price: {order.price}, State: {order.state}")
```

## Workflows

### Workflow 1: Check Account Status

```python
import MetaTrader5 as mt5

if not mt5.initialize():
    print("Failed to initialize MT5")
    exit()

account = mt5.account_info()
if account:
    print(f"""
=== Account Summary ===
Login: {account.login}
Server: {account.server}
Currency: {account.currency}
Balance: {account.balance:.2f}
Equity: {account.equity:.2f}
Margin: {account.margin:.2f}
Free Margin: {account.margin_free:.2f}
Margin Level: {account.margin_level:.2f}%
Profit: {account.profit:.2f}
""")

# Display open positions
positions = mt5.positions_get()
if positions:
    print(f"\n=== Open Positions ({len(positions)}) ===")
    total_profit = 0
    for pos in positions:
        direction = "BUY" if pos.type == mt5.POSITION_TYPE_BUY else "SELL"
        profit_class = "+" if pos.profit >= 0 else ""
        print(f"{direction} {pos.symbol} | Volume: {pos.volume} | Profit: {profit_class}{pos.profit:.2f}")
        total_profit += pos.profit
    print(f"\nTotal Floating P/L: {total_profit:.2f}")
else:
    print("\nNo open positions")

mt5.shutdown()
```

### Workflow 2: Quick Trade from Terminal

```bash
# Launch MT5 first
powershell -Command "Start-Process 'C:\Program Files\MetaTrader 5\terminal64.exe'"

# Then run Python script to place trade
python -c "
import MetaTrader5 as mt5
mt5.initialize()
place_order('EURUSD', 'BUY', 0.01)
mt5.shutdown()
"
```

### Workflow 3: Close All Positions

```python
import MetaTrader5 as mt5

if not mt5.initialize():
    print("Failed to initialize MT5")
    exit()

positions = mt5.positions_get()
if not positions:
    print("No open positions")
    exit()

closed = 0
for position in positions:
    if close_position(position.ticket):
        closed += 1

print(f"Closed {closed}/{len(positions)} positions")
mt5.shutdown()
```

## Common Tasks

### List Available Symbols

```python
symbols = mt5.symbols_get()
print(f"Total symbols: {len(symbols)}")

# Filter for forex pairs
forex = [s.name for s in symbols if s.path.startswith("Forex")]
print(f"Forex pairs: {len(forex)}")
print(forex[:10])  # First 10
```

### Get Symbol Specification

```python
symbol = "EURUSD"
info = mt5.symbol_info(symbol)
if info:
    print(f"Symbol: {info.name}")
    print(f"Base currency: {info.currency_base}")
    print(f"Digits: {info.digits}")
    print(f"Spread: {info.spread}")
    print(f"Point: {info.point}")
    print(f"Trade contract size: {info.trade_contract_size}")
    print(f"Volume min/max/step: {info.volume_min}/{info.volume_max}/{info.volume_step}")
```

### Check Connection Status

```python
import MetaTrader5 as mt5

if mt5.initialize():
    print("MT5 connected successfully")
    print(f"Terminal info: {mt5.terminal_info().community_account}")
    print(f"Trade allowed: {mt5.terminal_info().trade_allowed}")
    mt5.shutdown()
else:
    print(f"MT5 connection failed: {mt5.last_error()}")
```

## Terminal Commands

### Launch MT5

```bash
# Direct launch
"C:\Program Files\MetaTrader 5\terminal64.exe"

# With specific profile
"C:\Program Files\MetaTrader 5\terminal64.exe" /profile:MyProfile

# Portable mode (if configured)
"C:\Program Files\MetaTrader 5\terminal64.exe" /portable

# Auto-login
"C:\Program Files\MetaTrader 5\terminal64.exe" /login:123456 /server:MetaQuotes-Demo /password:password123
```

### Check if MT5 is Running

```powershell
# Check process
Get-Process | Where-Object {$_.ProcessName -like "*terminal*" -or $_.ProcessName -like "*mt5*"}

# Find MT5 window
powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle -like '*MetaTrader*'}"
```

### Kill MT5 Process

```powershell
# Force close
Stop-Process -Name "terminal64" -Force

# Or window close (safer)
powershell -Command "Get-Process terminal64 | ForEach-Object { $_.CloseMainWindow() }"
```

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "MT5 initialize failed" | MT5 terminal not running | Launch terminal64.exe first |
| "Symbol not found" | Symbol not subscribed to market watch | Add symbol in MT5 market watch |
| "Trade disabled" | Trading not enabled in settings | Enable trading in MT5 options |
| "Invalid volume" | Volume outside min/max | Check symbol info for valid lots |
| "Not enough money" | Insufficient margin | Check free margin before trading |

### Enable API Access in MT5

1. Open MT5 Terminal
2. Go to Tools → Options → Expert Advisors
3. Check "Allow automated trading"
4. Check "Allow DLL imports" if needed
5. If running script from outside MT5, you may need to login via API:

```python
# Login with credentials
mt5.initialize(login=123456, server="MetaQuotes-Demo", password="your_password")
```

## Important Notes

⚠️ **Trading Risk**: Real money trading involves risk. Test on demo accounts first.

⚠️ **Terminal Must Be Running**: Python API requires MT5 terminal to be running and logged in.

⚠️ **Filling Modes**: Different brokers use different order filling modes (IOC, FOK, GTC). Check broker requirements.

⚠️ **Error Handling**: Always check return codes and handle errors appropriately.

## Timeframes Reference

| Code | Timeframe | Type |
|------|-----------|------|
| `mt5.TIMEFRAME_M1` | 1 minute | M1 |
| `mt5.TIMEFRAME_M5` | 5 minutes | M5 |
| `mt5.TIMEFRAME_M15` | 15 minutes | M15 |
| `mt5.TIMEFRAME_M30` | 30 minutes | M30 |
| `mt5.TIMEFRAME_H1` | 1 hour | H1 |
| `mt5.TIMEFRAME_H4` | 4 hours | H4 |
| `mt5.TIMEFRAME_D1` | Daily | D1 |
| `mt5.TIMEFRAME_W1` | Weekly | W1 |
| `mt5.TIMEFRAME_MN1` | Monthly | MN1 |

## Order Types Reference

| Type | Code | Description |
|------|------|-------------|
| BUY | `mt5.ORDER_TYPE_BUY` | Market buy order |
| SELL | `mt5.ORDER_TYPE_SELL` | Market sell order |
| BUY LIMIT | `mt5.ORDER_TYPE_BUY_LIMIT` | Pending buy below price |
| SELL LIMIT | `mt5.ORDER_TYPE_SELL_LIMIT` | Pending sell above price |
| BUY STOP | `mt5.ORDER_TYPE_BUY_STOP` | Pending buy above price |
| SELL STOP | `mt5.ORDER_TYPE_SELL_STOP` | Pending sell below price |