"""
Trade Executor - 交易执行器
负责：MT5下单 + 写入交易记忆
支持：市价单 (Market) 和 限价单 (Limit)
"""

import sys
import argparse
import csv
from datetime import datetime
from pathlib import Path

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False

sys.path.insert(0, str(Path(__file__).parent))
from trading_memory import TradingMemory, Trade

class TradeExecutor:
    def __init__(self):
        self.memory = TradingMemory()
        
    def init_mt5(self):
        if not MT5_AVAILABLE:
            print("❌ MT5模块未安装")
            return False
        if not mt5.initialize():
            print(f"❌ MT5初始化失败: {mt5.last_error()}")
            return False
        return True

    def log_to_csv(self, ticket, open_time, type_str, size, symbol, price, sl, tp, comment):
        """记录到 CSV 文件 (模拟 MT5 格式)"""
        csv_file = self.memory.memory_dir / "paper_trades.csv"
        file_exists = csv_file.exists()
        
        try:
            with open(csv_file, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                # 表头
                if not file_exists:
                    writer.writerow(["Ticket", "Open Time", "Type", "Size", "Item", "Price", "S/L", "T/P", "Comment"])
                
                # 数据行
                writer.writerow([
                    ticket, 
                    open_time, 
                    type_str, 
                    size, 
                    symbol, 
                    price, 
                    sl, 
                    tp, 
                    comment
                ])
            print(f"📊 已写入 CSV 记录: {csv_file}")
        except Exception as e:
            print(f"⚠️ CSV 写入失败: {e}")

    def execute(self, symbol, direction, volume, sl, tp, reason, tags, is_paper=False, limit_price=0.0):
        if not self.init_mt5():
            return

        # 准备订单类型
        action_type = mt5.TRADE_ACTION_PENDING if limit_price > 0 else mt5.TRADE_ACTION_DEAL
        
        if direction == "BUY":
            order_type = mt5.ORDER_TYPE_BUY_LIMIT if limit_price > 0 else mt5.ORDER_TYPE_BUY
            price = limit_price if limit_price > 0 else mt5.symbol_info_tick(symbol).ask
        else:
            order_type = mt5.ORDER_TYPE_SELL_LIMIT if limit_price > 0 else mt5.ORDER_TYPE_SELL
            price = limit_price if limit_price > 0 else mt5.symbol_info_tick(symbol).bid

        request = {
            "action": action_type,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": 20,
            "magic": 232323,
            "comment": reason[:31],  # MT5 limit 31 chars
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        # 纸上模式
        if is_paper:
            print(f"📝 PAPER TRADE: {direction} {symbol} @ {price}, SL={sl}, TP={tp}")
            ticket = 999999
            exec_price = price
            res_comment = "Paper Trade"
        else:
            # 实盘模式
            print(f"DEBUG: Sending Request: {request}")
            result = mt5.order_send(request)
            if result is None:
                print(f"❌ 订单发送失败 (None): {mt5.last_error()}")
                mt5.shutdown()
                return

            if result.retcode != mt5.TRADE_RETCODE_DONE:
                print(f"❌ 订单失败: {result.comment} ({result.retcode})")
                mt5.shutdown()
                return
            
            print(f"🚀 订单提交成功, Ticket: {result.order}")
            ticket = result.order
            exec_price = result.price
            res_comment = result.comment

        # 4. 写入记忆 JSON
        trade_dir = "Long" if direction == "BUY" else "Short"
        trade = Trade(
            id="",
            symbol=symbol,
            direction=trade_dir,
            entry_time=datetime.now().isoformat(),
            entry_price=exec_price,
            stop_loss=sl,
            take_profit=tp,
            size=volume,
            signal_reason=reason,
            status="open"
        )
        self.memory.add_trade(trade)
        
        # 5. 写入 CSV
        type_str = "buy" if direction == "BUY" else "sell"
        if limit_price > 0: type_str += " limit"
        
        self.log_to_csv(
            ticket,
            datetime.now().strftime("%Y.%m.%d %H:%M:%S"),
            type_str,
            volume,
            symbol,
            exec_price,
            sl,
            tp,
            reason
        )
        
        mt5.shutdown()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--direction", required=True, choices=["BUY", "SELL"])
    parser.add_argument("--volume", type=float, default=0.01)
    parser.add_argument("--sl", type=float, required=True)
    parser.add_argument("--tp", type=float, required=True)
    parser.add_argument("--price", type=float, help="挂单价格 (不填则为市价)", default=0.0)
    parser.add_argument("--reason", default="SMC Signal")
    parser.add_argument("--tags", default="")
    parser.add_argument("--paper", action="store_true", help="启用纸上回测模式")
    
    args = parser.parse_args()
    
    executor = TradeExecutor()
    executor.execute(
        args.symbol, 
        args.direction, 
        args.volume, 
        args.sl, 
        args.tp, 
        args.reason,
        args.tags,
        args.paper,
        args.price
    )
