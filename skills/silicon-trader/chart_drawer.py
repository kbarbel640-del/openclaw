"""
SMC Chart Drawer - K线图表绘制器
绘制带SMC标注的K线图（OB、FVG、Premium/Discount等）

Author: Eden for Alpha Quant Pro
Version: 1.1.0 (Fixed Ticks)
"""

import pandas as pd
import numpy as np
import mplfinance as mpf
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Rectangle
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from smc_analyzer import SMCAnalyzer, AnalysisResult, OrderBlock, FairValueGap, Trend


class SMCChartDrawer:
    """SMC图表绘制器"""
    
    def __init__(
        self,
        style: str = "charles",
        figsize: Tuple[int, int] = (20, 12),
        output_dir: str = "./charts"
    ):
        self.style = style
        self.figsize = figsize
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 颜色配置
        self.colors = {
            'bull_ob': '#26a69a80',       # 多头OB - 绿色半透明
            'bear_ob': '#ef535080',       # 空头OB - 红色半透明
            'bull_ob_used': '#26a69a30',  # 已触及多头OB
            'bear_ob_used': '#ef535030',  # 已触及空头OB
            'bull_fvg': '#00796b50',      # 多头FVG - 青色
            'bear_fvg': '#c6282850',      # 空头FVG - 深红
            'pd_line': '#ffeb3b',         # Premium/Discount分界线
            'premium_zone': '#ef535020',  # 溢价区背景
            'discount_zone': '#26a69a20', # 贴现区背景
            'swing_high': '#ff5722',      # Swing High标记
            'swing_low': '#4caf50',       # Swing Low标记
        }
    
    def draw(
        self,
        df: pd.DataFrame,
        result: AnalysisResult,
        title: Optional[str] = None,
        show_pd_zones: bool = True,
        show_swing_points: bool = True,
        save: bool = True,
        show: bool = False,
        key_levels: List[dict] = None
    ) -> Optional[str]:
        """
        绘制SMC分析图表
        """
        # 准备数据
        df = df.copy()
        df.columns = [c.lower() for c in df.columns]
        df['time'] = pd.to_datetime(df['time'])
        df = df.set_index('time')
        
        # 计算动能指标
        high_low = df['high'] - df['low']
        high_close = (df['high'] - df['close'].shift()).abs()
        low_close = (df['low'] - df['close'].shift()).abs()
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = ranges.max(axis=1)
        df['atr'] = true_range.rolling(14).mean()
        
        df['ema20'] = df['close'].ewm(span=20, adjust=False).mean()
        
        # 绘图样式
        mc = mpf.make_marketcolors(up='#26a69a', down='#ef5350', inherit=True)
        s = mpf.make_mpf_style(base_mpf_style=self.style, marketcolors=mc)
        
        add_plots = [
            mpf.make_addplot(df['atr'], panel=2, color='orange', ylabel='ATR', secondary_y=False),
            mpf.make_addplot(df['ema20'], color='cyan', width=0.8)
        ]
        
        # 计算Y轴刻度 (关键修正逻辑)
        y_min = df['low'].min()
        y_max = df['high'].max()
        
        # 明确区分 H1 和 M15 的刻度
        if result.timeframe == "H1":
            y_tick_step = 60
            x_tick_step = 12
        elif result.timeframe == "M15":
            y_tick_step = 15
            x_tick_step = 12
        else:
            y_tick_step = 25
            x_tick_step = 20
            
        print(f"DEBUG: Frame={result.timeframe}, Y-Step={y_tick_step}, X-Step={x_tick_step}")
            
        start_tick = (y_min // y_tick_step) * y_tick_step
        yticks = np.arange(start_tick, y_max + y_tick_step * 2, y_tick_step)

        # 创建图表
        fig, axes = mpf.plot(
            df,
            type='candle',
            style=s,
            figsize=self.figsize,
            returnfig=True,
            title=title or f"{result.symbol} {result.timeframe} - SMC Dynamics",
            ylabel='Price',
            volume=True,
            volume_panel=1,
            addplot=add_plots,
            panel_ratios=(6, 2, 2),
            datetime_format='%H:%M',
            xrotation=0,
            show_nontrading=False # 确保索引对齐
        )
        
        ax = axes[0]
        # 强制设置 Y 轴刻度
        ax.set_yticks(yticks)
        ax.set_yticklabels([f"{y:.0f}" for y in yticks])
        
        # 强制设置 X 轴刻度 (每 N 根 K 线)
        # mplfinance 的 X 轴是基于整数索引的 (0, 1, 2...)
        n_candles = len(df)
        x_ticks = np.arange(0, n_candles, x_tick_step)
        
        # 获取对应的时间标签
        # 注意：df.index 已经是 datetime 对象
        x_labels = [df.index[i].strftime('%H:%M') for i in x_ticks if i < n_candles]
        
        # 应用到主图和附图
        for axis in axes:
            axis.set_xticks(x_ticks)
            # 只有最下面的图显示标签
            if axis == axes[-1] or axis == axes[-2]: # ATR or Volume panel
                 axis.set_xticklabels(x_labels)
        
        # 绘制关键位
        if key_levels:
            x_min, x_max = 0, len(df) - 1
            for level in key_levels:
                price = level['price']
                label = level['label']
                color = level.get('color', 'blue')
                linestyle = level.get('style', '--')
                linewidth = level.get('width', 1.0)
                
                ax.axhline(y=price, color=color, linestyle=linestyle, linewidth=linewidth, alpha=0.8)
                ax.text(x_max + 1, price, f" {label}", color=color, fontsize=8, verticalalignment='center')

        x_min, x_max = 0, len(df) - 1
        
        if show_pd_zones:
            self._draw_pd_zones(ax, df, result, x_min, x_max)
        
        self._draw_order_blocks(ax, df, result.active_obs)
        self._draw_fvgs(ax, df, [fvg for fvg in result.active_fvgs if not fvg.is_filled])
        
        if show_swing_points:
            self._draw_swing_points(ax, df, result)
        
        self._draw_info_panel(ax, result)
        
        filepath = None
        if save:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{result.symbol}_{result.timeframe}_{timestamp}.png"
            filepath = self.output_dir / filename
            fig.savefig(filepath, dpi=150, bbox_inches='tight', facecolor='white')
            print(f"图表已保存: {filepath}")
        
        if show:
            plt.show()
        else:
            plt.close(fig)
        
        return str(filepath) if filepath else None
    
    def _draw_pd_zones(self, ax, df: pd.DataFrame, result: AnalysisResult, x_min: int, x_max: int):
        """绘制Premium/Discount区域"""
        ax.axhline(
            y=result.dealing_range_mid,
            color=self.colors['pd_line'],
            linestyle='--',
            linewidth=1.5,
            alpha=0.8,
            label='0.5 (P/D Line)'
        )
        ax.axhspan(result.dealing_range_mid, result.dealing_range_high, alpha=0.1, color='red', label='Premium')
        ax.axhspan(result.dealing_range_low, result.dealing_range_mid, alpha=0.1, color='green', label='Discount')
        ax.text(x_max + 1, (result.dealing_range_high + result.dealing_range_mid) / 2, 'PREMIUM', color='red', fontsize=9, fontweight='bold', verticalalignment='center')
        ax.text(x_max + 1, (result.dealing_range_low + result.dealing_range_mid) / 2, 'DISCOUNT', color='green', fontsize=9, fontweight='bold', verticalalignment='center')
    
    def _draw_order_blocks(self, ax, df: pd.DataFrame, obs: List[OrderBlock]):
        """绘制Order Blocks"""
        for ob in obs:
            try:
                x_start = df.index.get_loc(ob.timestamp)
            except KeyError:
                continue
            x_end = len(df) - 1
            width = x_end - x_start + 5
            color = self.colors['bull_ob_used'] if ob.is_used else self.colors['bull_ob']
            edge_color = '#26a69a'
            if not ob.is_bullish:
                color = self.colors['bear_ob_used'] if ob.is_used else self.colors['bear_ob']
                edge_color = '#ef5350'
            rect = Rectangle((x_start, ob.bottom), width, ob.top - ob.bottom, facecolor=color, edgecolor=edge_color, linewidth=1, linestyle='-' if not ob.is_used else ':', alpha=0.7)
            ax.add_patch(rect)
            label = "Bull OB" if ob.is_bullish else "Bear OB"
            ax.text(x_start + 1, ob.top, label, fontsize=7, color=edge_color, verticalalignment='bottom')
    
    def _draw_fvgs(self, ax, df: pd.DataFrame, fvgs: List[FairValueGap]):
        """绘制Fair Value Gaps"""
        for fvg in fvgs:
            try:
                x_start = df.index.get_loc(fvg.timestamp)
            except KeyError:
                continue
            x_end = len(df) - 1
            width = x_end - x_start + 5
            color = self.colors['bull_fvg'] if fvg.is_bullish else self.colors['bear_fvg']
            edge_color = '#00796b' if fvg.is_bullish else '#c62828'
            rect = Rectangle((x_start, fvg.bottom), width, fvg.top - fvg.bottom, facecolor=color, edgecolor=edge_color, linewidth=1, linestyle='--', alpha=0.5)
            ax.add_patch(rect)
            label = "FVG↑" if fvg.is_bullish else "FVG↓"
            ax.text(x_start + 1, (fvg.top + fvg.bottom) / 2, label, fontsize=6, color=edge_color, verticalalignment='center')
    
    def _draw_swing_points(self, ax, df: pd.DataFrame, result: AnalysisResult):
        """绘制Swing High/Low点"""
        high_idx = df['high'].idxmax()
        low_idx = df['low'].idxmin()
        high_pos = df.index.get_loc(high_idx)
        low_pos = df.index.get_loc(low_idx)
        ax.annotate('SH', xy=(high_pos, df.loc[high_idx, 'high']), xytext=(high_pos, df.loc[high_idx, 'high'] + (result.dealing_range_high - result.dealing_range_low) * 0.05), fontsize=8, color=self.colors['swing_high'], fontweight='bold', ha='center')
        ax.annotate('SL', xy=(low_pos, df.loc[low_idx, 'low']), xytext=(low_pos, df.loc[low_idx, 'low'] - (result.dealing_range_high - result.dealing_range_low) * 0.05), fontsize=8, color=self.colors['swing_low'], fontweight='bold', ha='center')
    
    def _draw_info_panel(self, ax, result: AnalysisResult):
        """绘制信息面板"""
        info_text = (f"Trend: {result.trend.name}\nZone: {'PREMIUM' if result.is_in_premium else 'DISCOUNT'}\nDR: {result.dealing_range_low:.2f} - {result.dealing_range_high:.2f}\nMid: {result.dealing_range_mid:.2f}\nActive OBs: {len(result.active_obs)}\nActive FVGs: {len(result.active_fvgs)}")
        props = dict(boxstyle='round,pad=0.5', facecolor='black', alpha=0.7)
        ax.text(0.02, 0.98, info_text, transform=ax.transAxes, fontsize=9, verticalalignment='top', fontfamily='monospace', color='white', bbox=props)

if __name__ == "__main__":
    pass
