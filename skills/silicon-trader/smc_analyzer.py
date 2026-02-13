"""
SMC Analyzer - Smart Money Concepts 分析器
用于检测 Order Block、FVG、BOS/CHoCH、Premium/Discount

Author: Eden for Alpha Quant Pro
Version: 1.0.0
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import List, Optional, Tuple
from enum import Enum
from datetime import datetime


class Trend(Enum):
    BULLISH = 1
    BEARISH = -1
    RANGING = 0


class POIType(Enum):
    BULLISH_OB = "bull_ob"
    BEARISH_OB = "bear_ob"
    BULLISH_FVG = "bull_fvg"
    BEARISH_FVG = "bear_fvg"


@dataclass
class SwingPoint:
    """Swing High/Low 点"""
    index: int
    price: float
    is_high: bool
    timestamp: datetime


@dataclass
class OrderBlock:
    """Order Block"""
    index: int
    top: float
    bottom: float
    is_bullish: bool
    caused_bos: bool
    has_fvg: bool
    is_used: bool
    is_valid: bool
    timestamp: datetime
    
    @property
    def mid_price(self) -> float:
        return (self.top + self.bottom) / 2


@dataclass
class FairValueGap:
    """Fair Value Gap"""
    index: int
    top: float
    bottom: float
    is_bullish: bool
    is_filled: bool
    timestamp: datetime
    
    @property
    def size(self) -> float:
        return self.top - self.bottom


@dataclass
class StructureBreak:
    """BOS/CHoCH 结构突破"""
    index: int
    price: float
    is_bos: bool  # True=BOS(趋势延续), False=CHoCH(反转)
    is_bullish: bool
    timestamp: datetime


@dataclass
class AnalysisResult:
    """分析结果"""
    symbol: str
    timeframe: str
    timestamp: datetime
    trend: Trend
    dealing_range_high: float
    dealing_range_low: float
    dealing_range_mid: float
    is_in_premium: bool
    active_obs: List[OrderBlock]
    active_fvgs: List[FairValueGap]
    recent_breaks: List[StructureBreak]
    signals: List[str]
    
    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "timestamp": self.timestamp.isoformat(),
            "trend": self.trend.name,
            "dealing_range": {
                "high": self.dealing_range_high,
                "low": self.dealing_range_low,
                "mid": self.dealing_range_mid,
            },
            "zone": "PREMIUM" if self.is_in_premium else "DISCOUNT",
            "active_obs": len(self.active_obs),
            "active_fvgs": len(self.active_fvgs),
            "signals": self.signals,
        }


class SMCAnalyzer:
    """Smart Money Concepts 分析器"""
    
    def __init__(
        self,
        swing_length: int = 5,
        ob_min_size_atr_pct: float = 0.1,
        ob_max_age: int = 100,
        fvg_min_ratio: float = 0.3,
        use_pd_filter: bool = True,
        use_time_filter: bool = False,
        london_start_utc: int = 8,
        ny_start_utc: int = 13,
        session_window_hours: int = 1,
    ):
        self.swing_length = swing_length
        self.ob_min_size_atr_pct = ob_min_size_atr_pct
        self.ob_max_age = ob_max_age
        self.fvg_min_ratio = fvg_min_ratio
        self.use_pd_filter = use_pd_filter
        self.use_time_filter = use_time_filter
        self.london_start_utc = london_start_utc
        self.ny_start_utc = ny_start_utc
        self.session_window_hours = session_window_hours
        
        # 内部状态
        self.swing_highs: List[SwingPoint] = []
        self.swing_lows: List[SwingPoint] = []
        self.order_blocks: List[OrderBlock] = []
        self.fvgs: List[FairValueGap] = []
        self.structure_breaks: List[StructureBreak] = []
        self.trend = Trend.RANGING
    
    def analyze(self, df: pd.DataFrame, symbol: str = "XAUUSD", timeframe: str = "M15") -> AnalysisResult:
        """
        分析K线数据
        
        Args:
            df: DataFrame with columns ['time', 'open', 'high', 'low', 'close', 'volume']
            symbol: 交易品种
            timeframe: 时间周期
        
        Returns:
            AnalysisResult
        """
        # 重置状态
        self._reset()
        
        # 确保数据格式正确
        df = self._prepare_data(df)
        
        # 计算ATR
        atr = self._calculate_atr(df, period=14)
        
        # 1. 检测Swing Points
        self._detect_swing_points(df)
        
        # 2. 计算Dealing Range
        dr_high, dr_low = self._get_dealing_range()
        dr_mid = (dr_high + dr_low) / 2
        
        # 3. 检测结构突破 (BOS/CHoCH)
        self._detect_structure_breaks(df)
        
        # 4. 更新趋势
        self._update_trend()
        
        # 5. 检测Order Blocks
        self._detect_order_blocks(df, atr, dr_mid)
        
        # 6. 检测FVG
        self._detect_fvgs(df, dr_high - dr_low, dr_mid)
        
        # 7. 更新OB/FVG状态（触及、失效等）
        current_price = df['close'].iloc[-1]
        current_high = df['high'].iloc[-1]
        current_low = df['low'].iloc[-1]
        self._update_ob_status(current_price, current_high, current_low)
        self._update_fvg_status(current_high, current_low)
        
        # 8. 生成信号
        signals = self._generate_signals(current_price, dr_mid)
        
        # 9. 构建结果
        is_in_premium = current_price > dr_mid
        active_obs = [ob for ob in self.order_blocks if ob.is_valid and not ob.is_used]
        active_fvgs = [fvg for fvg in self.fvgs if not fvg.is_filled]
        
        # 只保留最近N个OB和FVG（极简雷达）
        max_obs = 10
        max_fvgs = 5
        active_obs = active_obs[-max_obs:] if len(active_obs) > max_obs else active_obs
        active_fvgs = active_fvgs[-max_fvgs:] if len(active_fvgs) > max_fvgs else active_fvgs
        
        return AnalysisResult(
            symbol=symbol,
            timeframe=timeframe,
            timestamp=df['time'].iloc[-1],
            trend=self.trend,
            dealing_range_high=dr_high,
            dealing_range_low=dr_low,
            dealing_range_mid=dr_mid,
            is_in_premium=is_in_premium,
            active_obs=active_obs,
            active_fvgs=active_fvgs,
            recent_breaks=self.structure_breaks[-5:] if self.structure_breaks else [],
            signals=signals,
        )
    
    def _reset(self):
        """重置内部状态"""
        self.swing_highs = []
        self.swing_lows = []
        self.order_blocks = []
        self.fvgs = []
        self.structure_breaks = []
        self.trend = Trend.RANGING
    
    def _prepare_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """准备数据"""
        df = df.copy()
        
        # 确保列名小写
        df.columns = [c.lower() for c in df.columns]
        
        # 确保time列是datetime
        if not pd.api.types.is_datetime64_any_dtype(df['time']):
            df['time'] = pd.to_datetime(df['time'])
        
        return df.reset_index(drop=True)
    
    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        """计算ATR"""
        high = df['high']
        low = df['low']
        close = df['close']
        
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(window=period).mean()
        
        return atr
    
    def _detect_swing_points(self, df: pd.DataFrame):
        """检测Swing High/Low"""
        n = self.swing_length
        
        for i in range(n, len(df) - n):
            # Swing High: 当前高点比左右n根K线都高
            is_swing_high = all(df['high'].iloc[i] > df['high'].iloc[i-j] for j in range(1, n+1)) and \
                           all(df['high'].iloc[i] > df['high'].iloc[i+j] for j in range(1, n+1))
            
            # Swing Low: 当前低点比左右n根K线都低
            is_swing_low = all(df['low'].iloc[i] < df['low'].iloc[i-j] for j in range(1, n+1)) and \
                          all(df['low'].iloc[i] < df['low'].iloc[i+j] for j in range(1, n+1))
            
            if is_swing_high:
                self.swing_highs.append(SwingPoint(
                    index=i,
                    price=df['high'].iloc[i],
                    is_high=True,
                    timestamp=df['time'].iloc[i]
                ))
            
            if is_swing_low:
                self.swing_lows.append(SwingPoint(
                    index=i,
                    price=df['low'].iloc[i],
                    is_high=False,
                    timestamp=df['time'].iloc[i]
                ))
    
    def _get_dealing_range(self) -> Tuple[float, float]:
        """获取当前Dealing Range（最近的有效Swing High/Low）"""
        if not self.swing_highs or not self.swing_lows:
            return 0.0, 0.0
        
        # 取最近的swing high和swing low
        last_high = self.swing_highs[-1].price
        last_low = self.swing_lows[-1].price
        
        return last_high, last_low
    
    def _detect_structure_breaks(self, df: pd.DataFrame):
        """检测BOS和CHoCH"""
        if len(self.swing_highs) < 2 or len(self.swing_lows) < 2:
            return
        
        # 简化逻辑：检查收盘价是否突破前一个swing点
        for i in range(1, len(df)):
            close = df['close'].iloc[i]
            
            # 检查是否突破前高
            for sh in self.swing_highs:
                if sh.index < i and close > sh.price:
                    # 判断是BOS还是CHoCH
                    is_bos = self.trend == Trend.BULLISH
                    self.structure_breaks.append(StructureBreak(
                        index=i,
                        price=sh.price,
                        is_bos=is_bos,
                        is_bullish=True,
                        timestamp=df['time'].iloc[i]
                    ))
                    break
            
            # 检查是否突破前低
            for sl in self.swing_lows:
                if sl.index < i and close < sl.price:
                    is_bos = self.trend == Trend.BEARISH
                    self.structure_breaks.append(StructureBreak(
                        index=i,
                        price=sl.price,
                        is_bos=is_bos,
                        is_bullish=False,
                        timestamp=df['time'].iloc[i]
                    ))
                    break
    
    def _update_trend(self):
        """根据最近的结构突破更新趋势"""
        if not self.structure_breaks:
            return
        
        last_break = self.structure_breaks[-1]
        if last_break.is_bullish:
            self.trend = Trend.BULLISH
        else:
            self.trend = Trend.BEARISH
    
    def _detect_order_blocks(self, df: pd.DataFrame, atr: pd.Series, dr_mid: float):
        """检测Order Blocks"""
        for i in range(1, len(df) - 1):
            # 跳过ATR无效的数据
            if pd.isna(atr.iloc[i]):
                continue
            
            # 多头OB: 阴线后阳线反转
            bull_ob = (df['close'].iloc[i-1] < df['open'].iloc[i-1] and  # 前一根是阴线
                      df['close'].iloc[i] > df['open'].iloc[i] and       # 当前是阳线
                      df['low'].iloc[i] < df['low'].iloc[i-1])           # 新低
            
            # 空头OB: 阳线后阴线反转
            bear_ob = (df['close'].iloc[i-1] > df['open'].iloc[i-1] and  # 前一根是阳线
                      df['close'].iloc[i] < df['open'].iloc[i] and       # 当前是阴线
                      df['high'].iloc[i] > df['high'].iloc[i-1])         # 新高
            
            if bull_ob or bear_ob:
                ob_top = df['high'].iloc[i-1]
                ob_bottom = df['low'].iloc[i-1]
                ob_size = ob_top - ob_bottom
                
                # 尺寸过滤
                if ob_size < atr.iloc[i] * self.ob_min_size_atr_pct:
                    continue
                
                # Premium/Discount过滤
                ob_mid = (ob_top + ob_bottom) / 2
                if self.use_pd_filter:
                    if bull_ob and ob_mid > dr_mid:
                        continue  # 多头OB应该在贴现区
                    if bear_ob and ob_mid < dr_mid:
                        continue  # 空头OB应该在溢价区
                
                self.order_blocks.append(OrderBlock(
                    index=i-1,
                    top=ob_top,
                    bottom=ob_bottom,
                    is_bullish=bull_ob,
                    caused_bos=False,  # TODO: 后续检查
                    has_fvg=False,     # TODO: 后续检查
                    is_used=False,
                    is_valid=True,
                    timestamp=df['time'].iloc[i-1]
                ))
    
    def _detect_fvgs(self, df: pd.DataFrame, dr_size: float, dr_mid: float):
        """检测Fair Value Gaps"""
        for i in range(2, len(df)):
            # 多头FVG: 第三根K线低点 > 第一根K线高点
            bull_fvg = df['low'].iloc[i] > df['high'].iloc[i-2]
            
            # 空头FVG: 第三根K线高点 < 第一根K线低点
            bear_fvg = df['high'].iloc[i] < df['low'].iloc[i-2]
            
            if bull_fvg:
                fvg_top = df['low'].iloc[i]
                fvg_bottom = df['high'].iloc[i-2]
                fvg_size = fvg_top - fvg_bottom
                
                # 尺寸过滤
                if dr_size > 0 and fvg_size / dr_size < self.fvg_min_ratio:
                    continue
                
                # Premium/Discount过滤
                fvg_mid = (fvg_top + fvg_bottom) / 2
                if self.use_pd_filter and fvg_mid > dr_mid:
                    continue
                
                self.fvgs.append(FairValueGap(
                    index=i-1,
                    top=fvg_top,
                    bottom=fvg_bottom,
                    is_bullish=True,
                    is_filled=False,
                    timestamp=df['time'].iloc[i-1]
                ))
            
            if bear_fvg:
                fvg_top = df['low'].iloc[i-2]
                fvg_bottom = df['high'].iloc[i]
                fvg_size = fvg_top - fvg_bottom
                
                # 尺寸过滤
                if dr_size > 0 and fvg_size / dr_size < self.fvg_min_ratio:
                    continue
                
                # Premium/Discount过滤
                fvg_mid = (fvg_top + fvg_bottom) / 2
                if self.use_pd_filter and fvg_mid < dr_mid:
                    continue
                
                self.fvgs.append(FairValueGap(
                    index=i-1,
                    top=fvg_top,
                    bottom=fvg_bottom,
                    is_bullish=False,
                    is_filled=False,
                    timestamp=df['time'].iloc[i-1]
                ))
    
    def _update_ob_status(self, current_price: float, current_high: float, current_low: float):
        """更新Order Block状态"""
        for ob in self.order_blocks:
            if not ob.is_valid:
                continue
            
            # 检查是否被触及
            if ob.is_bullish and current_low <= ob.top:
                ob.is_used = True
            if not ob.is_bullish and current_high >= ob.bottom:
                ob.is_used = True
            
            # 检查是否失效（被实体穿透）
            if ob.is_bullish and current_price < ob.bottom:
                ob.is_valid = False
            if not ob.is_bullish and current_price > ob.top:
                ob.is_valid = False
    
    def _update_fvg_status(self, current_high: float, current_low: float):
        """更新FVG状态"""
        for fvg in self.fvgs:
            # 检查是否被填补
            if fvg.is_bullish and current_low <= fvg.bottom:
                fvg.is_filled = True
            if not fvg.is_bullish and current_high >= fvg.top:
                fvg.is_filled = True
    
    def _generate_signals(self, current_price: float, dr_mid: float) -> List[str]:
        """生成交易信号"""
        signals = []
        
        zone = "PREMIUM" if current_price > dr_mid else "DISCOUNT"
        signals.append(f"当前区域: {zone}")
        signals.append(f"趋势: {self.trend.name}")
        
        # 检查活跃的OB
        active_bull_obs = [ob for ob in self.order_blocks if ob.is_bullish and ob.is_valid and not ob.is_used]
        active_bear_obs = [ob for ob in self.order_blocks if not ob.is_bullish and ob.is_valid and not ob.is_used]
        
        if active_bull_obs and zone == "DISCOUNT":
            closest_ob = min(active_bull_obs, key=lambda ob: abs(ob.top - current_price))
            signals.append(f"⚡ 多头机会: 贴现区有{len(active_bull_obs)}个多头OB待触及")
            signals.append(f"   最近OB区间: {closest_ob.bottom:.2f} - {closest_ob.top:.2f}")
        
        if active_bear_obs and zone == "PREMIUM":
            closest_ob = min(active_bear_obs, key=lambda ob: abs(ob.bottom - current_price))
            signals.append(f"⚡ 空头机会: 溢价区有{len(active_bear_obs)}个空头OB待触及")
            signals.append(f"   最近OB区间: {closest_ob.bottom:.2f} - {closest_ob.top:.2f}")
        
        # 检查FVG
        unfilled_fvgs = [fvg for fvg in self.fvgs if not fvg.is_filled]
        if unfilled_fvgs:
            signals.append(f"📊 未填补FVG: {len(unfilled_fvgs)}个")
        
        return signals


# 测试用
if __name__ == "__main__":
    # 创建测试数据
    import random
    
    dates = pd.date_range(start='2024-01-01', periods=200, freq='15min')
    price = 2000.0
    data = []
    
    for dt in dates:
        change = random.uniform(-5, 5)
        o = price
        c = price + change
        h = max(o, c) + random.uniform(0, 3)
        l = min(o, c) - random.uniform(0, 3)
        price = c
        data.append({'time': dt, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': random.randint(1000, 5000)})
    
    df = pd.DataFrame(data)
    
    analyzer = SMCAnalyzer()
    result = analyzer.analyze(df, symbol="XAUUSD", timeframe="M15")
    
    print("=" * 50)
    print(f"分析结果: {result.symbol} {result.timeframe}")
    print(f"趋势: {result.trend.name}")
    print(f"Dealing Range: {result.dealing_range_low:.2f} - {result.dealing_range_high:.2f}")
    print(f"中点: {result.dealing_range_mid:.2f}")
    print(f"当前区域: {'PREMIUM' if result.is_in_premium else 'DISCOUNT'}")
    print(f"活跃OB: {len(result.active_obs)}")
    print(f"活跃FVG: {len(result.active_fvgs)}")
    print("-" * 50)
    print("信号:")
    for sig in result.signals:
        print(f"  {sig}")
