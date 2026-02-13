"""
SMC Radar - 极简雷达版
机器只做三件事: 时段高低点 + FVG过滤 + 多周期警报

Author: Eden for Alpha Quant Pro
Version: 2.0.0

理念: 机器做减法，人做决策
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum

try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    MT5_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════════════════
# 数据结构
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class SessionLevel:
    """时段高低点"""
    session: str  # "Asia" / "London" / "NY"
    high: float
    low: float
    high_time: datetime
    low_time: datetime
    is_swept_high: bool = False
    is_swept_low: bool = False
    
    def to_message(self) -> str:
        swept_high = " ⚡SWEPT" if self.is_swept_high else ""
        swept_low = " ⚡SWEPT" if self.is_swept_low else ""
        return (
            f"{self.session} High: {self.high:.2f}{swept_high}\n"
            f"{self.session} Low:  {self.low:.2f}{swept_low}"
        )


@dataclass
class StrongFVG:
    """强动能FVG（已过滤）"""
    timeframe: str
    top: float
    bottom: float
    is_bullish: bool
    strength_ratio: float  # gap_size / avg_body
    timestamp: datetime
    is_filled: bool = False
    
    @property
    def mid(self) -> float:
        return (self.top + self.bottom) / 2
    
    def to_message(self) -> str:
        direction = "Bull" if self.is_bullish else "Bear"
        status = "(已填补)" if self.is_filled else "(未填补)"
        return f"{self.timeframe} {direction} FVG: {self.bottom:.2f} - {self.top:.2f} {status}"


@dataclass
class HTFAlert:
    """多周期警报"""
    alert_type: str  # "HTF_OB" / "HTF_FVG" / "SESSION_LEVEL"
    description: str
    htf_timeframe: str
    price_zone: Tuple[float, float]
    timestamp: datetime
    
    def to_message(self) -> str:
        return f"🚨 {self.description}"


@dataclass
class RadarOutput:
    """雷达输出"""
    symbol: str
    timestamp: datetime
    current_price: float
    
    # 三件事
    session_levels: List[SessionLevel]
    strong_fvgs: List[StrongFVG]
    htf_alerts: List[HTFAlert]
    
    # 图表路径
    chart_paths: List[str] = field(default_factory=list)
    
    def to_message(self) -> str:
        lines = [
            "═" * 45,
            f"🎯 SMC RADAR - {self.symbol}",
            f"时间: {self.timestamp.strftime('%Y-%m-%d %H:%M')} GMT+8",
            f"当前价格: {self.current_price:.2f}",
            "═" * 45,
            "",
            "📍 SESSION LEVELS (流动性池)",
        ]
        
        for sl in self.session_levels:
            lines.append(sl.to_message())
        
        lines.extend(["", "⚡ STRONG FVG (已过滤弱信号)"])
        
        if self.strong_fvgs:
            for fvg in self.strong_fvgs:
                lines.append(f"• {fvg.to_message()}")
        else:
            lines.append("• 无强FVG")
        
        if self.htf_alerts:
            lines.extend(["", "🚨 HTF ALERTS"])
            for alert in self.htf_alerts:
                lines.append(alert.to_message())
        
        if self.chart_paths:
            lines.extend(["", "📊 CHARTS"])
            for path in self.chart_paths:
                lines.append(f"• {path}")
        
        lines.extend([
            "",
            "═" * 45,
            "👁️ 等待Eden视觉复核...",
            "═" * 45,
        ])
        
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════════
# SMC Radar 核心
# ═══════════════════════════════════════════════════════════════════════════════

class SMCRadar:
    """极简雷达 - 只做三件事"""
    
    # 时段定义 (UTC)
    SESSIONS = {
        "Asia": (0, 8),      # 00:00 - 08:00 UTC
        "London": (8, 16),   # 08:00 - 16:00 UTC
        "NY": (13, 21),      # 13:00 - 21:00 UTC
    }
    
    TIMEFRAME_MAP = {
        "M1": mt5.TIMEFRAME_M1 if MT5_AVAILABLE else 1,
        "M5": mt5.TIMEFRAME_M5 if MT5_AVAILABLE else 5,
        "M15": mt5.TIMEFRAME_M15 if MT5_AVAILABLE else 15,
        "H1": mt5.TIMEFRAME_H1 if MT5_AVAILABLE else 60,
        "H4": mt5.TIMEFRAME_H4 if MT5_AVAILABLE else 240,
    }
    
    def __init__(
        self,
        fvg_strength_threshold: float = 0.5,  # FVG需 > 0.5倍平均实体
        avg_body_period: int = 20,             # 平均实体计算周期
    ):
        self.fvg_strength_threshold = fvg_strength_threshold
        self.avg_body_period = avg_body_period
        self.mt5_initialized = False
    
    def init_mt5(self) -> bool:
        """初始化MT5"""
        if not MT5_AVAILABLE:
            return False
        if self.mt5_initialized:
            return True
        if not mt5.initialize():
            return False
        self.mt5_initialized = True
        return True
    
    def shutdown(self):
        """关闭"""
        if self.mt5_initialized and MT5_AVAILABLE:
            mt5.shutdown()
            self.mt5_initialized = False
    
    def get_ohlcv(self, symbol: str, timeframe: str, bars: int = 1000) -> Optional[pd.DataFrame]:
        """获取K线数据"""
        if not MT5_AVAILABLE or not self.mt5_initialized:
            return self._mock_data(bars)
        
        tf = self.TIMEFRAME_MAP.get(timeframe)
        if tf is None:
            return None
        
        rates = mt5.copy_rates_from_pos(symbol, tf, 0, bars)
        if rates is None:
            return None
        
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        df = df.rename(columns={'tick_volume': 'volume'})
        return df[['time', 'open', 'high', 'low', 'close', 'volume']]
    
    def _mock_data(self, bars: int) -> pd.DataFrame:
        """模拟数据"""
        import random
        dates = pd.date_range(end=datetime.now(), periods=bars, freq='15min')
        price = 2650.0
        data = []
        for dt in dates:
            change = random.uniform(-5, 5)
            o = price
            c = price + change
            h = max(o, c) + random.uniform(0, 3)
            l = min(o, c) - random.uniform(0, 3)
            price = c
            data.append({'time': dt, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': 1000})
        return pd.DataFrame(data)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 任务1: 时段高低点
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_session_levels(self, df: pd.DataFrame) -> List[SessionLevel]:
        """获取时段高低点"""
        levels = []
        
        # 获取今天和昨天的日期
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        
        for session_name, (start_hour, end_hour) in self.SESSIONS.items():
            # 找到该时段的K线
            session_data = df[
                (df['time'].dt.hour >= start_hour) & 
                (df['time'].dt.hour < end_hour) &
                (df['time'].dt.date >= yesterday)
            ]
            
            if session_data.empty:
                continue
            
            high_idx = session_data['high'].idxmax()
            low_idx = session_data['low'].idxmin()
            
            session_high = session_data.loc[high_idx, 'high']
            session_low = session_data.loc[low_idx, 'low']
            high_time = session_data.loc[high_idx, 'time']
            low_time = session_data.loc[low_idx, 'time']
            
            # 检查是否被扫荡
            current_price = df['close'].iloc[-1]
            recent_high = df['high'].iloc[-20:].max()
            recent_low = df['low'].iloc[-20:].min()
            
            is_swept_high = recent_high > session_high
            is_swept_low = recent_low < session_low
            
            levels.append(SessionLevel(
                session=session_name,
                high=session_high,
                low=session_low,
                high_time=high_time,
                low_time=low_time,
                is_swept_high=is_swept_high,
                is_swept_low=is_swept_low,
            ))
        
        return levels
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 任务2: FVG真伪过滤
    # ═══════════════════════════════════════════════════════════════════════════
    
    def get_strong_fvgs(self, df: pd.DataFrame, timeframe: str) -> List[StrongFVG]:
        """获取强动能FVG（过滤弱信号）"""
        strong_fvgs = []
        
        # 计算平均K线实体
        df['body'] = abs(df['close'] - df['open'])
        avg_body = df['body'].rolling(self.avg_body_period).mean()
        
        current_price = df['close'].iloc[-1]
        
        for i in range(2, len(df)):
            if pd.isna(avg_body.iloc[i]):
                continue
            
            # 多头FVG: 第三根低点 > 第一根高点
            if df['low'].iloc[i] > df['high'].iloc[i-2]:
                gap_size = df['low'].iloc[i] - df['high'].iloc[i-2]
                strength = gap_size / avg_body.iloc[i] if avg_body.iloc[i] > 0 else 0
                
                # 只保留强FVG
                if strength >= self.fvg_strength_threshold:
                    fvg_bottom = df['high'].iloc[i-2]
                    fvg_top = df['low'].iloc[i]
                    is_filled = current_price < fvg_bottom
                    
                    strong_fvgs.append(StrongFVG(
                        timeframe=timeframe,
                        top=fvg_top,
                        bottom=fvg_bottom,
                        is_bullish=True,
                        strength_ratio=strength,
                        timestamp=df['time'].iloc[i-1],
                        is_filled=is_filled,
                    ))
            
            # 空头FVG: 第三根高点 < 第一根低点
            if df['high'].iloc[i] < df['low'].iloc[i-2]:
                gap_size = df['low'].iloc[i-2] - df['high'].iloc[i]
                strength = gap_size / avg_body.iloc[i] if avg_body.iloc[i] > 0 else 0
                
                if strength >= self.fvg_strength_threshold:
                    fvg_top = df['low'].iloc[i-2]
                    fvg_bottom = df['high'].iloc[i]
                    is_filled = current_price > fvg_top
                    
                    strong_fvgs.append(StrongFVG(
                        timeframe=timeframe,
                        top=fvg_top,
                        bottom=fvg_bottom,
                        is_bullish=False,
                        strength_ratio=strength,
                        timestamp=df['time'].iloc[i-1],
                        is_filled=is_filled,
                    ))
        
        # 只返回未填补的最近N个FVG
        unfilled = [fvg for fvg in strong_fvgs if not fvg.is_filled]
        return unfilled[-10:]  # 最近10个
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 任务3: 多周期警报
    # ═══════════════════════════════════════════════════════════════════════════
    
    def check_htf_alerts(
        self, 
        current_price: float,
        htf_fvgs: List[StrongFVG],
        session_levels: List[SessionLevel]
    ) -> List[HTFAlert]:
        """检查是否触及高周期POI"""
        alerts = []
        now = datetime.now()
        
        # 检查H1 FVG
        for fvg in htf_fvgs:
            if fvg.timeframe in ["H1", "H4"] and not fvg.is_filled:
                if fvg.bottom <= current_price <= fvg.top:
                    direction = "Bull" if fvg.is_bullish else "Bear"
                    alerts.append(HTFAlert(
                        alert_type="HTF_FVG",
                        description=f"价格进入 {fvg.timeframe} {direction} FVG 区域 ({fvg.bottom:.2f}-{fvg.top:.2f})",
                        htf_timeframe=fvg.timeframe,
                        price_zone=(fvg.bottom, fvg.top),
                        timestamp=now,
                    ))
        
        # 检查Session Levels
        for sl in session_levels:
            # 价格接近时段高点
            if abs(current_price - sl.high) / sl.high < 0.001:  # 0.1%以内
                alerts.append(HTFAlert(
                    alert_type="SESSION_LEVEL",
                    description=f"价格触及 {sl.session} High ({sl.high:.2f})",
                    htf_timeframe="Session",
                    price_zone=(sl.high - 1, sl.high + 1),
                    timestamp=now,
                ))
            
            # 价格接近时段低点
            if abs(current_price - sl.low) / sl.low < 0.001:
                alerts.append(HTFAlert(
                    alert_type="SESSION_LEVEL",
                    description=f"价格触及 {sl.session} Low ({sl.low:.2f})",
                    htf_timeframe="Session",
                    price_zone=(sl.low - 1, sl.low + 1),
                    timestamp=now,
                ))
        
        return alerts
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 主扫描
    # ═══════════════════════════════════════════════════════════════════════════
    
    def scan(self, symbol: str = "XAUUSD") -> RadarOutput:
        """运行雷达扫描"""
        self.init_mt5()
        
        # 获取数据
        df_m15 = self.get_ohlcv(symbol, "M15", 1000)
        df_h1 = self.get_ohlcv(symbol, "H1", 250)
        
        if df_m15 is None:
            raise Exception("无法获取M15数据")
        
        current_price = df_m15['close'].iloc[-1]
        
        # 任务1: 时段高低点
        session_levels = self.get_session_levels(df_m15)
        
        # 任务2: FVG过滤
        m15_fvgs = self.get_strong_fvgs(df_m15, "M15")
        h1_fvgs = self.get_strong_fvgs(df_h1, "H1") if df_h1 is not None else []
        all_fvgs = m15_fvgs + h1_fvgs
        
        # 任务3: HTF警报
        htf_alerts = self.check_htf_alerts(current_price, h1_fvgs, session_levels)
        
        return RadarOutput(
            symbol=symbol,
            timestamp=datetime.now(),
            current_price=current_price,
            session_levels=session_levels,
            strong_fvgs=all_fvgs,
            htf_alerts=htf_alerts,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 测试
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    radar = SMCRadar()
    
    print("🎯 SMC Radar 启动...")
    print(f"FVG强度阈值: {radar.fvg_strength_threshold}")
    print()
    
    output = radar.scan("XAUUSD")
    print(output.to_message())
    
    radar.shutdown()
