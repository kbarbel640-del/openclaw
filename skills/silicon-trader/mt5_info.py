"""
MT5 Info Reader - MT5账户和市场信息读取
读取持仓、资金、流动性（点差/市场深度）

Author: Eden for Alpha Quant Pro
Version: 1.0.0
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Optional
from datetime import datetime

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False


@dataclass
class AccountInfo:
    """账户信息"""
    login: int
    server: str
    balance: float
    equity: float
    margin: float
    free_margin: float
    margin_level: float  # 保证金水平 %
    profit: float        # 浮动盈亏
    currency: str
    leverage: int
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    def to_message(self) -> str:
        profit_emoji = "🟢" if self.profit >= 0 else "🔴"
        return (
            f"💰 **账户状态**\n"
            f"账户: {self.login} @ {self.server}\n"
            f"余额: ${self.balance:,.2f}\n"
            f"净值: ${self.equity:,.2f}\n"
            f"可用保证金: ${self.free_margin:,.2f}\n"
            f"保证金水平: {self.margin_level:.1f}%\n"
            f"{profit_emoji} 浮动盈亏: ${self.profit:+,.2f}\n"
            f"杠杆: 1:{self.leverage}"
        )


@dataclass
class Position:
    """持仓信息"""
    ticket: int
    symbol: str
    type: str  # "Long" / "Short"
    volume: float
    open_price: float
    current_price: float
    sl: Optional[float]
    tp: Optional[float]
    profit: float
    swap: float
    open_time: str
    magic: int
    comment: str
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @property
    def pnl_pips(self) -> float:
        """计算盈亏点数（简化版）"""
        if self.type == "Long":
            return (self.current_price - self.open_price)
        else:
            return (self.open_price - self.current_price)
    
    def to_message(self) -> str:
        emoji = "🟢" if self.profit >= 0 else "🔴"
        direction = "📈" if self.type == "Long" else "📉"
        
        lines = [
            f"{direction} **{self.symbol}** {self.type} x{self.volume}",
            f"开仓: {self.open_price:.5f} → 当前: {self.current_price:.5f}",
            f"{emoji} 盈亏: ${self.profit:+.2f}",
        ]
        
        if self.sl:
            lines.append(f"🛑 SL: {self.sl:.5f}")
        if self.tp:
            lines.append(f"🎯 TP: {self.tp:.5f}")
        
        lines.append(f"开仓时间: {self.open_time}")
        
        return "\n".join(lines)


@dataclass
class SymbolInfo:
    """品种信息（流动性相关）"""
    symbol: str
    bid: float
    ask: float
    spread: float          # 点差 (points)
    spread_float: bool     # 是否浮动点差
    volume_min: float      # 最小交易量
    volume_max: float      # 最大交易量
    volume_step: float     # 交易量步长
    trade_stops_level: int # 最小止损距离 (points)
    trade_mode: str        # 交易模式
    digits: int            # 小数位数
    point: float           # 点值
    swap_long: float       # 多头隔夜利息
    swap_short: float      # 空头隔夜利息
    session_open: bool     # 当前是否可交易
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @property
    def spread_pips(self) -> float:
        """点差（以pips计）"""
        # 对于外汇: Digits=5 (0.00001) -> Pip=0.0001 (10 points)
        # 对于日元: Digits=3 (0.001) -> Pip=0.01 (10 points)
        # 对于黄金: Digits=2 (0.01) -> Pip=0.1 (10 points)
        if self.digits in [5, 3, 2]:
            return self.spread / 10
        return self.spread
    
    def to_message(self) -> str:
        session_status = "✅ 可交易" if self.session_open else "⏸️ 休市"
        spread_status = "🟢" if self.spread_pips < 3 else "🟡" if self.spread_pips < 5 else "🔴"
        
        return (
            f"📊 **{self.symbol}** 市场信息\n"
            f"Bid/Ask: {self.bid:.5f} / {self.ask:.5f}\n"
            f"{spread_status} 点差: {self.spread_pips:.1f} pips {'(浮动)' if self.spread_float else '(固定)'}\n"
            f"最小止损距离: {self.trade_stops_level} points\n"
            f"交易量: {self.volume_min} - {self.volume_max} (步长 {self.volume_step})\n"
            f"隔夜利息: Long {self.swap_long:+.2f} / Short {self.swap_short:+.2f}\n"
            f"状态: {session_status}"
        )


@dataclass
class MarketSnapshot:
    """市场快照（完整信息）"""
    timestamp: str
    account: AccountInfo
    positions: List[Position]
    symbol_info: Dict[str, SymbolInfo]
    
    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "account": self.account.to_dict(),
            "positions": [p.to_dict() for p in self.positions],
            "symbol_info": {k: v.to_dict() for k, v in self.symbol_info.items()},
        }
    
    @property
    def total_exposure(self) -> float:
        """总敞口（所有持仓的总盈亏）"""
        return sum(p.profit for p in self.positions)
    
    @property
    def position_count(self) -> int:
        return len(self.positions)
    
    def get_position_by_symbol(self, symbol: str) -> List[Position]:
        return [p for p in self.positions if p.symbol == symbol]
    
    def to_summary(self) -> str:
        """生成简洁摘要"""
        lines = [
            f"⏰ {self.timestamp}",
            f"💰 余额: ${self.account.balance:,.2f} | 净值: ${self.account.equity:,.2f}",
            f"📊 持仓: {self.position_count}笔 | 浮盈亏: ${self.account.profit:+,.2f}",
        ]
        
        if self.positions:
            lines.append("---")
            for p in self.positions[:5]:  # 最多显示5笔
                emoji = "🟢" if p.profit >= 0 else "🔴"
                lines.append(f"{emoji} {p.symbol} {p.type} ${p.profit:+.2f}")
            if len(self.positions) > 5:
                lines.append(f"... 还有 {len(self.positions) - 5} 笔")
        
        return "\n".join(lines)


class MT5InfoReader:
    """MT5信息读取器"""
    
    def __init__(self):
        self.initialized = False
    
    def init(self) -> bool:
        """初始化MT5连接"""
        if not MT5_AVAILABLE:
            print("❌ MetaTrader5模块未安装")
            return False
        
        if self.initialized:
            return True
        
        if not mt5.initialize():
            print(f"❌ MT5初始化失败: {mt5.last_error()}")
            return False
        
        self.initialized = True
        return True
    
    def shutdown(self):
        """关闭连接"""
        if self.initialized and MT5_AVAILABLE:
            mt5.shutdown()
            self.initialized = False
    
    def get_account_info(self) -> Optional[AccountInfo]:
        """获取账户信息"""
        if not self.init():
            return None
        
        info = mt5.account_info()
        if info is None:
            return None
        
        return AccountInfo(
            login=info.login,
            server=info.server,
            balance=info.balance,
            equity=info.equity,
            margin=info.margin,
            free_margin=info.margin_free,
            margin_level=info.margin_level if info.margin_level else 0,
            profit=info.profit,
            currency=info.currency,
            leverage=info.leverage,
        )
    
    def get_positions(self, symbol: str = None) -> List[Position]:
        """获取持仓信息"""
        if not self.init():
            return []
        
        if symbol:
            positions = mt5.positions_get(symbol=symbol)
        else:
            positions = mt5.positions_get()
        
        if positions is None:
            return []
        
        result = []
        for p in positions:
            pos_type = "Long" if p.type == mt5.POSITION_TYPE_BUY else "Short"
            result.append(Position(
                ticket=p.ticket,
                symbol=p.symbol,
                type=pos_type,
                volume=p.volume,
                open_price=p.price_open,
                current_price=p.price_current,
                sl=p.sl if p.sl > 0 else None,
                tp=p.tp if p.tp > 0 else None,
                profit=p.profit,
                swap=p.swap,
                open_time=datetime.fromtimestamp(p.time).strftime("%Y-%m-%d %H:%M:%S"),
                magic=p.magic,
                comment=p.comment,
            ))
        
        return result
    
    def get_symbol_info(self, symbol: str) -> Optional[SymbolInfo]:
        """获取品种信息（流动性）"""
        if not self.init():
            return None
        
        info = mt5.symbol_info(symbol)
        if info is None:
            return None
        
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return None
        
        # 判断交易模式
        trade_modes = {
            mt5.SYMBOL_TRADE_MODE_DISABLED: "禁止交易",
            mt5.SYMBOL_TRADE_MODE_LONGONLY: "只能做多",
            mt5.SYMBOL_TRADE_MODE_SHORTONLY: "只能做空",
            mt5.SYMBOL_TRADE_MODE_CLOSEONLY: "只能平仓",
            mt5.SYMBOL_TRADE_MODE_FULL: "完全交易",
        }
        trade_mode = trade_modes.get(info.trade_mode, "未知")
        
        return SymbolInfo(
            symbol=symbol,
            bid=tick.bid,
            ask=tick.ask,
            spread=info.spread,
            spread_float=info.spread_float,
            volume_min=info.volume_min,
            volume_max=info.volume_max,
            volume_step=info.volume_step,
            trade_stops_level=info.trade_stops_level,
            trade_mode=trade_mode,
            digits=info.digits,
            point=info.point,
            swap_long=info.swap_long,
            swap_short=info.swap_short,
            session_open=info.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL,
        )
    
    def get_market_snapshot(self, symbols: List[str] = None) -> Optional[MarketSnapshot]:
        """获取完整市场快照"""
        if not self.init():
            return None
        
        symbols = symbols or ["XAUUSD"]
        
        account = self.get_account_info()
        if account is None:
            return None
        
        positions = self.get_positions()
        
        symbol_info = {}
        for sym in symbols:
            info = self.get_symbol_info(sym)
            if info:
                symbol_info[sym] = info
        
        return MarketSnapshot(
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            account=account,
            positions=positions,
            symbol_info=symbol_info,
        )
    
    def check_liquidity(self, symbol: str) -> Dict:
        """检查流动性（点差和可交易性）"""
        info = self.get_symbol_info(symbol)
        if info is None:
            return {"status": "error", "message": "无法获取品种信息"}
        
        # 点差评估
        spread_pips = info.spread_pips
        if spread_pips < 2:
            spread_status = "excellent"
            spread_msg = "点差极佳"
        elif spread_pips < 4:  # 放宽到 4
            spread_status = "good"
            spread_msg = "点差正常"
        elif spread_pips < 6:  # 放宽到 6
            spread_status = "fair"
            spread_msg = "点差偏高"
        else:
            spread_status = "poor"
            spread_msg = "点差过高，建议等待"
        
        # 可交易性
        tradeable = info.session_open and info.trade_mode == "完全交易"
        
        return {
            "status": "ok",
            "symbol": symbol,
            "spread_pips": spread_pips,
            "spread_status": spread_status,
            "spread_message": spread_msg,
            "tradeable": tradeable,
            "trade_mode": info.trade_mode,
            "min_stop_distance": info.trade_stops_level,
            "recommendation": "可以交易" if tradeable and spread_status in ["excellent", "good"] else "暂缓交易"
        }


# 测试
if __name__ == "__main__":
    reader = MT5InfoReader()
    
    if reader.init():
        print("=" * 50)
        
        # 账户信息
        account = reader.get_account_info()
        if account:
            print(account.to_message())
        
        print("\n" + "-" * 50)
        
        # 持仓
        positions = reader.get_positions()
        print(f"📊 当前持仓: {len(positions)}笔")
        for p in positions:
            print(p.to_message())
            print()
        
        print("-" * 50)
        
        # 品种信息
        for symbol in ["XAUUSD", "EURUSD"]:
            info = reader.get_symbol_info(symbol)
            if info:
                print(info.to_message())
                print()
        
        print("-" * 50)
        
        # 流动性检查
        liquidity = reader.check_liquidity("XAUUSD")
        print(f"流动性检查: {liquidity}")
        
        reader.shutdown()
    else:
        print("MT5未连接")
