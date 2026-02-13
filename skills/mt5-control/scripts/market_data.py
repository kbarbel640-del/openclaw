#!/usr/bin/env python3
"""
Get MT5 Market Data (OHLCV Candles)
Usage: python market_data.py SYMBOL [TIMEFRAME] [COUNT]

Timeframes: M1, M5, M15, M30, H1, H4, D1, W1, MN1
"""
import sys
import pandas as pd
import MetaTrader5 as mt5

# Timeframe mapping
TIMEFRAMES = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
    "W1": mt5.TIMEFRAME_W1,
    "MN1": mt5.TIMEFRAME_MN1,
}

def get_symbol_tick(symbol):
    """Get current tick for a symbol"""
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        print(f"❌ Failed to get tick for {symbol}")
        return None

    spread = tick.ask - tick.bid
    symbol_info = mt5.symbol_info(symbol)
    digits = symbol_info.digits if symbol_info else 5

    print("\n" + "=" * 60)
    print(f"📊 {symbol} Current Price")
    print("=" * 60)
    print(f"🟢 Ask:  {tick.ask:.{digits}f}")
    print(f"🔴 Bid:  {tick.bid:.{digits}f}")
    print(f"📏 Spread: {spread*10**digits:.1f} pips")
    print(f"📦 Volume: {tick.volume:,}")

    return tick


def get_ohlcv_data(symbol, timeframe="H1", count=100):
    """Get OHLCV candle data"""
    # Validate timeframe
    tf_code = TIMEFRAMES.get(timeframe.upper())
    if not tf_code:
        print(f"❌ Invalid timeframe: {timeframe}")
        print(f"Available: {', '.join(TIMEFRAMES.keys())}")
        return None

    # Get rates
    rates = mt5.copy_rates_from_pos(symbol, tf_code, 0, count)

    if rates is None or len(rates) == 0:
        print(f"❌ Failed to get data for {symbol} {timeframe}")
        return None

    # Convert to DataFrame
    df = pd.DataFrame(rates)
    df['time'] = pd.to_datetime(df['time'], unit='s')

    # Calculate candle statistics
    print("\n" + "=" * 60)
    print(f"📊 {symbol} {timeframe} Data (Last {count} bars)")
    print("=" * 60)

    # Show last 5 candles
    print(f"\n{'Time':<20} {'Open':>12} {'High':>12} {'Low':>12} {'Close':>12} {'Volume':>10}")
    print("-" * 80)
    for _, row in df.tail(5).iterrows():
        print(f"{str(row['time']):<20} {row['open']:>12.5f} {row['high']:>12.5f} {row['low']:>12.5f} {row['close']:>12.5f} {row['tick_volume']:>10,}")

    # Statistics
    print("\n📈 Statistics:")
    print(f"  High (period):  {df['high'].max():.5f}")
    print(f"  Low (period):   {df['low'].min():.5f}")
    print(f"  Close (latest): {df['close'].iloc[-1]:.5f}")
    print(f"  Range:          {df['high'].max() - df['low'].min():.5f}")

    # Simple trend detection
    last_close = df['close'].iloc[-1]
    prev_close = df['close'].iloc[-10] if len(df) > 10 else df['close'].iloc[0]
    change_pct = ((last_close - prev_close) / prev_close) * 100

    if change_pct > 0.1:
        trend = "🟢 Bullish ▲"
    elif change_pct < -0.1:
        trend = "🔴 Bearish ▼"
    else:
        trend = "⚪ Neutral"

    print(f"  Trend (10 bars): {trend} ({change_pct:+.2f}%)")

    return df


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python market_data.py SYMBOL [TIMEFRAME] [COUNT]")
        print("\nExamples:")
        print("  python market_data.py EURUSD")
        print("  python market_data.py EURUSD H1 100")
        print("  python market_data.py XAUUSD M5 50")
        print("\nTimeframes: M1, M5, M15, M30, H1, H4, D1, W1, MN1")
        sys.exit(1)

    symbol = sys.argv[1].upper()
    timeframe = sys.argv[2] if len(sys.argv) > 2 else "H1"
    count = int(sys.argv[3]) if len(sys.argv) > 3 else 100

    if not mt5.initialize():
        print(f"❌ MT5 initialize failed: {mt5.last_error()}")
        print("Make sure MT5 terminal is running!")
        sys.exit(1)

    try:
        # Check symbol
        symbol_info = mt5.symbol_info(symbol)
        if not symbol_info:
            print(f"❌ Symbol '{symbol}' not found")
            print("\nTo find available symbols, check MT5 Market Watch window")
            sys.exit(1)

        # Get current tick
        get_symbol_tick(symbol)

        # Get OHLCV data
        df = get_ohlcv_data(symbol, timeframe, count)

        if df is not None:
            # Save to CSV if requested
            if "--csv" in sys.argv:
                filename = f"{symbol}_{timeframe}_data.csv"
                df.to_csv(filename, index=False)
                print(f"\n💾 Saved to: {filename}")

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        mt5.shutdown()
