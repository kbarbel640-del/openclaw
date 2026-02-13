"""
Data Feeder - 数据投喂器
只做一件事：获取数据 + 生成图表 + 输出基本雷达信息
不做任何决策。决策由 Eden (AI) 完成。
"""

import sys
import json
from pathlib import Path
from datetime import datetime
import pandas as pd

# 强制设置输出编码为 UTF-8 (解决 Cron 报错)
sys.stdout.reconfigure(encoding='utf-8')

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False

# 导入工具库
sys.path.insert(0, str(Path(__file__).parent))
from smc_analyzer import SMCAnalyzer
from chart_drawer import SMCChartDrawer
from smc_radar import SMCRadar
from mt5_info import MT5InfoReader

class DataFeeder:
    def __init__(self, symbol: str = "XAUUSD"):
        self.symbol = symbol
        self.output_dir = Path(__file__).parent / "output"
        self.charts_dir = self.output_dir / "charts"
        self.charts_dir.mkdir(parents=True, exist_ok=True)
        
        self.radar = SMCRadar()
        self.analyzer = SMCAnalyzer()
        self.drawer = SMCChartDrawer(output_dir=str(self.charts_dir))
        self.mt5_reader = MT5InfoReader()
        
    def init_mt5(self):
        if not MT5_AVAILABLE: return False
        if not mt5.initialize(): return False
        return True
        
    def get_data(self, timeframe, bars):
        tf_map = {"M15": mt5.TIMEFRAME_M15, "H1": mt5.TIMEFRAME_H1}
        rates = mt5.copy_rates_from_pos(self.symbol, tf_map[timeframe], 0, bars)
        if rates is None: return None
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        df = df.rename(columns={'tick_volume': 'volume'})
        return df[['time', 'open', 'high', 'low', 'close', 'volume']]

    def run(self):
        if not self.init_mt5():
            print("ERROR: MT5 Connection Failed")
            return
            
        now = datetime.now()
        timestamp_str = now.strftime('%Y-%m-%d %H:%M:%S')
        print(f"FEEDER_START: {self.symbol} at {now.strftime('%H:%M')}")
        
        # 1. 运行雷达
        radar_output = self.radar.scan(self.symbol)
        
        # 准备关键位数据 (Session High/Low)
        key_levels = []
        for lvl in radar_output.session_levels:
            key_levels.append({
                "price": lvl.high,
                "label": f"{lvl.session} High",
                "color": "blue",
                "style": "--" if lvl.is_swept_high else "-"
            })
            key_levels.append({
                "price": lvl.low,
                "label": f"{lvl.session} Low",
                "color": "purple",
                "style": "--" if lvl.is_swept_low else "-"
            })
        
        # 2. 生成/复用 H1 图表 (整点生成，其他复用)
        latest_h1 = None
        for f in sorted(self.charts_dir.glob(f"{self.symbol}_H1_*.png"), reverse=True):
            latest_h1 = f
            break
            
        is_h1_new = False
        if now.minute < 15 or latest_h1 is None:
            df_h1 = self.get_data("H1", 250)
            h1_res = self.analyzer.analyze(df_h1, self.symbol, "H1")
            h1_chart_path = self.drawer.draw(
                df_h1, h1_res, 
                title=f"{self.symbol} H1 Context", 
                show_pd_zones=False,
                key_levels=key_levels
            )
            latest_h1 = Path(h1_chart_path)
            is_h1_new = True
            print(f"  [H1] Generated New Chart: {latest_h1.name}")
        else:
            print(f"  [H1] Reusing Cached Chart: {latest_h1.name}")
        
        # 3. 生成 M15 图表 (每次生成)
        df_m15 = self.get_data("M15", 1000)
        m15_res = self.analyzer.analyze(df_m15, self.symbol, "M15")
        # 增加显示范围: 300根
        df_m15_plot = df_m15.tail(300).reset_index(drop=True)
        m15_chart = self.drawer.draw(
            df_m15_plot, m15_res, 
            title=f"{self.symbol} M15 Trigger",
            key_levels=key_levels
        )
        print(f"  [M15] Generated New Chart: {Path(m15_chart).name}")
        
        # 4. 获取账户与风控信息
        account = self.mt5_reader.get_account_info()
        positions = self.mt5_reader.get_positions(self.symbol)
        liquidity = self.mt5_reader.check_liquidity(self.symbol)
        
        risk_money = account.balance * 0.01 if account else 0
        est_sl_pips = 50 
        est_lot = risk_money / (est_sl_pips * 10) if risk_money > 0 else 0
        
        # 5. 输出给 Eden 的“食材”
        output = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "price": df_m15['close'].iloc[-1],
            "radar_text": radar_output.to_message(),
            "h1_chart": str(latest_h1),
            "m15_chart": str(m15_chart),
            "market_state": {
                "balance": account.balance if account else 0,
                "equity": account.equity if account else 0,
                "positions_count": len(positions),
                "spread_status": liquidity.get("spread_status", "unknown"),
                "rec_lot_size_1pct": round(est_lot, 2)
            }
        }
        
        with open(self.output_dir / "latest_feed.json", "w") as f:
            json.dump(output, f, indent=2)
            
        print("FEEDER_OUTPUT_JSON_START")
        print(json.dumps(output, indent=2))
        print("FEEDER_OUTPUT_JSON_END")
        
        mt5.shutdown()

if __name__ == "__main__":
    DataFeeder().run()
