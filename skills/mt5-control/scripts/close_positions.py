#!/usr/bin/env python3
"""
Close MT5 Positions
Usage: python close_positions.py [ticket]
       python close_positions.py --all    # Close all positions
       python close_positions.py --symbol EURUSD  # Close all EURUSD positions
"""
import sys
import MetaTrader5 as mt5

def close_position(ticket):
    """Close a specific position by ticket"""
    position = mt5.positions_get(ticket=ticket)
    if not position or len(position) == 0:
        print(f"❌ Position {ticket} not found")
        return False

    position = position[0]

    # Determine close direction
    if position.type == mt5.POSITION_TYPE_BUY:
        order_type = mt5.ORDER_TYPE_SELL
        price = mt5.symbol_info_tick(position.symbol).bid
        direction_str = "🔴 SELL to close BUY"
    else:
        order_type = mt5.ORDER_TYPE_BUY
        price = mt5.symbol_info_tick(position.symbol).ask
        direction_str = "🟢 BUY to close SELL"

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

    print(f"\n{'='*60}")
    print(f"📊 Closing Position")
    print(f"{'='*60}")
    print(f"Symbol:    {position.symbol}")
    print(f"Ticket:    {ticket}")
    print(f"Action:    {direction_str}")
    print(f"Volume:    {position.volume}")
    print(f"Price:     {price}")
    print(f"Realized P/L: {position.profit:+,.2f}")
    print(f"{'-'*60}")
    print(f"Return Code: {result.retcode}")
    print(f"Comment:     {result.comment}")

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"❌ Close failed!")
        return False

    print(f"✅ Position {ticket} closed successfully!")
    return True


if __name__ == "__main__":
    if not mt5.initialize():
        print(f"❌ MT5 initialize failed: {mt5.last_error()}")
        sys.exit(1)

    try:
        # Get all positions
        all_positions = mt5.positions_get()

        if not all_positions:
            print("✅ No open positions to close")
            mt5.shutdown()
            sys.exit(0)

        # Logic based on arguments
        if len(sys.argv) < 2:
            # No args - show positions and ask which to close
            print("=" * 60)
            print(f"📝 Open Positions ({len(all_positions)})")
            print("=" * 60)
            for pos in all_positions:
                direction = "🟢 BUY " if pos.type == mt5.POSITION_TYPE_BUY else "🔴 SELL"
                profit_style = "✅" if pos.profit >= 0 else "❌"
                print(f"{direction} {pos.symbol:<10} | Ticket: {pos.ticket} | Vol: {pos.volume} | P/L: {profit_style}{pos.profit:+,.2f}")
            print("\nUsage: python close_positions.py [ticket]")
            print("       python close_positions.py --all")
            print("       python close_positions.py --symbol EURUSD")

        elif sys.argv[1] == "--all":
            # Close all positions
            print(f"\nClosing {len(all_positions)} positions...")

            closed = 0
            failed = 0
            total_pnl = 0

            for pos in all_positions:
                if close_position(pos.ticket):
                    closed += 1
                    total_pnl += pos.profit
                else:
                    failed += 1

            print("\n" + "=" * 60)
            print(f"📊 Summary")
            print("=" * 60)
            print(f"Closed:   {closed}/{len(all_positions)}")
            print(f"Failed:   {failed}")
            print(f"Total P/L: {total_pnl:+,.2f}")

            if failed > 0:
                print("\n⚠️ Some positions failed to close. Check:")
                print("  - Trading is enabled in MT5")
                print("  - Sufficient margin for closing")
                print("  - Market is open for those symbols")

        elif sys.argv[1] == "--symbol":
            # Close all positions for a specific symbol
            if len(sys.argv) < 3:
                print("❌ Please specify symbol: python close_positions.py --symbol EURUSD")
                sys.exit(1)

            symbol = sys.argv[2].upper()
            symbol_positions = [p for p in all_positions if p.symbol == symbol]

            if not symbol_positions:
                print(f"✅ No open positions for {symbol}")
                sys.exit(0)

            print(f"\nClosing {len(symbol_positions)} {symbol} positions...")

            closed = 0
            total_pnl = 0

            for pos in symbol_positions:
                if close_position(pos.ticket):
                    closed += 1
                    total_pnl += pos.profit

            print("\n" + "=" * 60)
            print(f"📊 Summary")
            print("=" * 60)
            print(f"Closed:   {closed}/{len(symbol_positions)}")
            print(f"Total P/L: {total_pnl:+,.2f}")

        else:
            # Close specific ticket
            try:
                ticket = int(sys.argv[1])
                close_position(ticket)
            except ValueError:
                print(f"❌ Invalid ticket number: {sys.argv[1]}")

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        mt5.shutdown()
