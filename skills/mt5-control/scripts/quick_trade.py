#!/usr/bin/env python3
"""
Quick Trade Script for MT5
Usage: python quick_trade.py EURUSD BUY 0.01
"""
import sys
import MetaTrader5 as mt5

def place_order(symbol, order_type, volume, sl=None, tp=None, comment="Eden"):
    """Place a market order"""
    # Validate symbol
    symbol_info = mt5.symbol_info(symbol)
    if not symbol_info:
        print(f"❌ Symbol '{symbol}' not found")
        return None

    # Enable symbol for trading (if needed)
    if not symbol_info.visible:
        if not mt5.symbol_select(symbol, True):
            print(f"❌ Failed to select symbol '{symbol}'")
            return None

    # Get current tick
    tick = mt5.symbol_info_tick(symbol)
    if not tick:
        print(f"❌ Failed to get tick for '{symbol}'")
        return None

    # Parse order type
    order_type = order_type.upper()
    if order_type == "BUY":
        order_type_code = mt5.ORDER_TYPE_BUY
        price = tick.ask
        direction_str = "🟢 BUY"
    elif order_type == "SELL":
        order_type_code = mt5.ORDER_TYPE_SELL
        price = tick.bid
        direction_str = "🔴 SELL"
    else:
        print(f"❌ Invalid order type: {order_type}. Use BUY or SELL")
        return None

    # Validate volume
    min_lot = symbol_info.volume_min
    max_lot = symbol_info.volume_max
    lot_step = symbol_info.volume_step

    try:
        volume = float(volume)
    except ValueError:
        print(f"❌ Invalid volume: {volume}")
        return None

    if volume < min_lot or volume > max_lot:
        print(f"❌ Volume must be between {min_lot} and {max_lot}")
        return None

    # Round to step
    volume = round(volume / lot_step) * lot_step

    # Build order request
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": order_type_code,
        "price": price,
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

    print("\n" + "=" * 60)
    print(f"📊 Order Result")
    print("=" * 60)
    print(f"Symbol:    {symbol}")
    print(f"Direction: {direction_str}")
    print(f"Volume:    {volume}")
    print(f"Price:     {price}")
    if sl:
        print(f"SL:        {sl}")
    if tp:
        print(f"TP:        {tp}")
    print("-" * 60)
    print(f"Return Code: {result.retcode}")
    print(f"Comment:     {result.comment}")

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"❌ Order failed!")
        return None

    print(f"✅ Order placed successfully!")
    print(f"🎫 Ticket: {result.order}")
    return result.order


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python quick_trade.py SYMBOL TYPE VOLUME [SL] [TP] [COMMENT]")
        print("Example: python quick_trade.py EURUSD BUY 0.01")
        print("Example: python quick_trade.py XAUUSD SELL 0.1 2400 2300 \"Gold Short\"")
        sys.exit(1)

    symbol = sys.argv[1].upper()
    order_type = sys.argv[2]
    volume = sys.argv[3]
    sl = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] != "NONE" else None
    tp = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "NONE" else None
    comment = sys.argv[6] if len(sys.argv) > 6 else "Eden"

    if not mt5.initialize():
        print(f"❌ MT5 initialize failed: {mt5.last_error()}")
        print("Make sure MT5 terminal is running!")
        sys.exit(1)

    try:
        place_order(symbol, order_type, volume, sl, tp, comment)
    finally:
        mt5.shutdown()
