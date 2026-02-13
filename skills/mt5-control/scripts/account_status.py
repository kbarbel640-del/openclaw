#!/usr/bin/env python3
"""
MT5 Account Status Checker
Quick display of account info, balance, and open positions
"""
import MetaTrader5 as mt5

try:
    # Initialize MT5
    if not mt5.initialize():
        print(f"❌ MT5 initialize failed: {mt5.last_error()}")
        print("Make sure MT5 terminal is running and logged in.")
        exit(1)

    # Get account info
    account = mt5.account_info()
    if not account:
        print("❌ Failed to get account info")
        mt5.shutdown()
        exit(1)

    print("=" * 60)
    print("📊 MT5 Account Status")
    print("=" * 60)
    print(f"🏦 Server:    {account.server}")
    print(f"👤 Login:     {account.login}")
    print(f"💱 Currency:  {account.currency}")
    print(f"💵 Balance:   {account.balance:,.2f}")
    print(f"💎 Equity:    {account.equity:,.2f}")
    print(f"📊 Margin:    {account.margin:,.2f}")
    print(f"🆓 Free:      {account.margin_free:,.2f}")
    print(f"📈 Level:     {account.margin_level:.2f}%" if account.margin_level > 0 else "📈 Level:     N/A")
    print(f"💰 Profit:    {account.profit:+,.2f}")

    # Get open positions
    positions = mt5.positions_get()
    if positions:
        print("\n" + "=" * 60)
        print(f"📝 Open Positions ({len(positions)})")
        print("=" * 60)
        total_profit = 0

        for pos in positions:
            direction = "🟢 BUY " if pos.type == mt5.POSITION_TYPE_BUY else "🔴 SELL"
            profit_class = "✅ " if pos.profit >= 0 else "❌ "
            profit_str = f"{profit_class}{pos.profit:+,.2f}"

            print(f"{direction} {pos.symbol:<10} | Vol: {pos.volume:>6.2f} | @ {pos.price_open:.{pos.symbol_info_point if hasattr(pos, 'symbol_info_point') else 5}f} | P/L: {profit_str}")
            total_profit += pos.profit

        print("-" * 60)
        total_class = "✅" if total_profit >= 0 else "❌"
        print(f"{total_class} Total Floating P/L: {total_profit:+,.2f} {account.currency}")
    else:
        print("\n✅ No open positions")

    # Get recent orders (last 24 hours)
    from datetime import datetime, timedelta
    from_date = datetime.now() - timedelta(hours=24)
    to_date = datetime.now()
    orders = mt5.history_orders_get(from_date, to_date)

    if orders:
        print("\n" + "=" * 60)
        print(f"📜 Recent Orders (Last 24h): {len(orders)}")
        print("=" * 60)

        # Group by type
        buys = len([o for o in orders if o.type == mt5.ORDER_TYPE_BUY])
        sells = len([o for o in orders if o.type == mt5.ORDER_TYPE_SELL])
        print(f"Buys: {buys} | Sells: {sells}")

except Exception as e:
    print(f"❌ Error: {e}")
finally:
    mt5.shutdown()
