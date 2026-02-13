"""
Silicon Trader - 自动图表分析器
支持命令行参数: python chart_analyzer.py [SYMBOL] [TIMEFRAME] [BARS]
"""

import MetaTrader5 as mt5
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Rectangle
from datetime import datetime, timedelta
import numpy as np
import sys
import os

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

# 时间框架映射
TIMEFRAME_MAP = {
    '1M': mt5.TIMEFRAME_M1,
    '5M': mt5.TIMEFRAME_M5,
    '15M': mt5.TIMEFRAME_M15,
    '30M': mt5.TIMEFRAME_M30,
    '1H': mt5.TIMEFRAME_H1,
    '4H': mt5.TIMEFRAME_H4,
    'D1': mt5.TIMEFRAME_D1,
    'W1': mt5.TIMEFRAME_W1,
}

def get_data(symbol, timeframe, bars):
    """从MT5获取数据"""
    if not mt5.initialize():
        print(f"MT5初始化失败: {mt5.last_error()}")
        return None
    
    # 确保symbol在市场观察中
    if not mt5.symbol_select(symbol, True):
        print(f"无法选择品种 {symbol}")
        mt5.shutdown()
        return None
    
    rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, bars)
    mt5.shutdown()
    
    if rates is None or len(rates) == 0:
        print("获取数据失败")
        return None
    
    df = pd.DataFrame(rates)
    df['time'] = pd.to_datetime(df['time'], unit='s')
    return df

def find_swing_points(df, window=5):
    """找摆动高低点"""
    highs = []
    lows = []
    
    for i in range(window, len(df) - window):
        if df['high'].iloc[i] == df['high'].iloc[i-window:i+window+1].max():
            highs.append((i, df['high'].iloc[i]))
        if df['low'].iloc[i] == df['low'].iloc[i-window:i+window+1].min():
            lows.append((i, df['low'].iloc[i]))
    
    return highs, lows

def find_order_blocks(df, swing_highs, swing_lows):
    """找Order Block"""
    obs = []
    
    # 看涨OB
    for idx, low in swing_lows[-5:]:
        for j in range(idx-1, max(0, idx-10), -1):
            if df['close'].iloc[j] < df['open'].iloc[j]:
                obs.append({
                    'type': 'bullish',
                    'idx': j,
                    'high': df['high'].iloc[j],
                    'low': df['low'].iloc[j],
                    'time': df['time'].iloc[j]
                })
                break
    
    # 看跌OB
    for idx, high in swing_highs[-5:]:
        for j in range(idx-1, max(0, idx-10), -1):
            if df['close'].iloc[j] > df['open'].iloc[j]:
                obs.append({
                    'type': 'bearish',
                    'idx': j,
                    'high': df['high'].iloc[j],
                    'low': df['low'].iloc[j],
                    'time': df['time'].iloc[j]
                })
                break
    
    return obs

def find_fvg(df):
    """找Fair Value Gap"""
    fvgs = []
    
    for i in range(2, len(df)):
        # 看涨FVG
        if df['high'].iloc[i-2] < df['low'].iloc[i]:
            gap = df['low'].iloc[i] - df['high'].iloc[i-2]
            avg_body = abs(df['close'].iloc[i-1] - df['open'].iloc[i-1])
            if avg_body > 0 and gap > 0.5 * avg_body:
                fvgs.append({
                    'type': 'bullish',
                    'idx': i-1,
                    'high': df['low'].iloc[i],
                    'low': df['high'].iloc[i-2],
                    'time': df['time'].iloc[i-1]
                })
        
        # 看跌FVG
        if df['low'].iloc[i-2] > df['high'].iloc[i]:
            gap = df['low'].iloc[i-2] - df['high'].iloc[i]
            avg_body = abs(df['close'].iloc[i-1] - df['open'].iloc[i-1])
            if avg_body > 0 and gap > 0.5 * avg_body:
                fvgs.append({
                    'type': 'bearish',
                    'idx': i-1,
                    'high': df['low'].iloc[i-2],
                    'low': df['high'].iloc[i],
                    'time': df['time'].iloc[i-1]
                })
    
    return fvgs[-10:] if len(fvgs) > 10 else fvgs

def detect_choch_bos(df, swing_highs, swing_lows):
    """检测CHoCH和BOS"""
    signals = []
    
    # 简化版：检测最近的结构变化
    if len(swing_highs) >= 2 and len(swing_lows) >= 2:
        last_high = swing_highs[-1]
        prev_high = swing_highs[-2]
        last_low = swing_lows[-1]
        prev_low = swing_lows[-2]
        
        # 检测趋势
        if last_high[1] > prev_high[1] and last_low[1] > prev_low[1]:
            signals.append({'type': 'uptrend', 'desc': 'HH-HL结构'})
        elif last_high[1] < prev_high[1] and last_low[1] < prev_low[1]:
            signals.append({'type': 'downtrend', 'desc': 'LH-LL结构'})
        else:
            signals.append({'type': 'ranging', 'desc': '震荡结构'})
    
    return signals

def plot_chart(df, swing_highs, swing_lows, obs, fvgs, symbol, tf_name, output_path):
    """画图"""
    fig, ax = plt.subplots(figsize=(18, 10), facecolor='#0d1117')
    ax.set_facecolor('#0d1117')
    
    # 只显示最近100根K线
    display_bars = min(100, len(df))
    df_plot = df.tail(display_bars).reset_index(drop=True)
    offset = len(df) - display_bars
    
    # 画K线
    for i, row in df_plot.iterrows():
        color = '#00c853' if row['close'] >= row['open'] else '#ff1744'
        ax.plot([i, i], [row['low'], row['high']], color=color, linewidth=1)
        body_bottom = min(row['open'], row['close'])
        body_height = abs(row['close'] - row['open'])
        if body_height == 0:
            body_height = 0.01
        rect = Rectangle((i-0.35, body_bottom), 0.7, body_height, 
                         facecolor=color, edgecolor=color)
        ax.add_patch(rect)
    
    # 画Order Block (延伸到图表右边缘)
    for ob in obs:
        adj_idx = ob['idx'] - offset
        if 0 <= adj_idx < display_bars:
            color = '#4CAF50' if ob['type'] == 'bullish' else '#f44336'
            width = display_bars - adj_idx + 5
            rect = Rectangle((adj_idx - 0.5, ob['low']), 
                             width, ob['high'] - ob['low'],
                             facecolor=color, alpha=0.25, edgecolor=color, linewidth=1.5)
            ax.add_patch(rect)
            label = 'OB+' if ob['type'] == 'bullish' else 'OB-'
            ax.text(adj_idx + 0.5, ob['high'] + (ob['high']-ob['low'])*0.1, 
                   f"{label} {ob['high']:.1f}-{ob['low']:.1f}", 
                   color=color, fontsize=8, fontweight='bold',
                   bbox=dict(boxstyle='round,pad=0.2', facecolor='#0d1117', 
                            edgecolor=color, alpha=0.8))
    
    # 画FVG
    for fvg in fvgs:
        adj_idx = fvg['idx'] - offset
        if 0 <= adj_idx < display_bars:
            color = '#2196F3' if fvg['type'] == 'bullish' else '#FF9800'
            width = display_bars - adj_idx + 5
            rect = Rectangle((adj_idx - 0.5, fvg['low']), 
                             width, fvg['high'] - fvg['low'],
                             facecolor=color, alpha=0.15, edgecolor=color, 
                             linewidth=1, linestyle='--')
            ax.add_patch(rect)
    
    # 画流动性水平线
    for idx, high in swing_highs[-8:]:
        adj_idx = idx - offset
        if -5 <= adj_idx < display_bars:
            ax.axhline(y=high, color='#ffd600', linestyle=':', alpha=0.6, linewidth=1)
            if 0 <= adj_idx < display_bars:
                ax.scatter([adj_idx], [high], color='#ffd600', s=80, marker='v', 
                          zorder=5, edgecolors='white', linewidths=0.5)
    
    for idx, low in swing_lows[-8:]:
        adj_idx = idx - offset
        if -5 <= adj_idx < display_bars:
            ax.axhline(y=low, color='#00bcd4', linestyle=':', alpha=0.6, linewidth=1)
            if 0 <= adj_idx < display_bars:
                ax.scatter([adj_idx], [low], color='#00bcd4', s=80, marker='^', 
                          zorder=5, edgecolors='white', linewidths=0.5)
    
    # 当前价格线
    current_price = df_plot['close'].iloc[-1]
    ax.axhline(y=current_price, color='#ffffff', linestyle='-', linewidth=2, alpha=0.9)
    ax.text(display_bars - 1, current_price, f'  {current_price:.2f}', color='white', 
           fontsize=11, verticalalignment='center', fontweight='bold',
           bbox=dict(boxstyle='round,pad=0.3', facecolor='#1976D2', edgecolor='none'))
    
    # 标题
    trend = detect_choch_bos(df, swing_highs, swing_lows)
    trend_text = trend[0]['desc'] if trend else '分析中'
    ax.set_title(f'{symbol} {tf_name} | 当前: {current_price:.2f} | 结构: {trend_text}', 
                color='white', fontsize=14, fontweight='bold', pad=15,
                loc='left')
    
    # 时间戳
    ax.text(0.99, 0.02, f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}", 
           transform=ax.transAxes, color='gray', fontsize=8, 
           ha='right', va='bottom')
    
    ax.set_xlabel('K线', color='white', fontsize=10)
    ax.set_ylabel('价格', color='white', fontsize=10)
    ax.tick_params(colors='white', labelsize=9)
    ax.grid(True, alpha=0.1, color='white')
    
    # 图例
    legend_elements = [
        mpatches.Patch(facecolor='#4CAF50', alpha=0.25, label='多头OB'),
        mpatches.Patch(facecolor='#f44336', alpha=0.25, label='空头OB'),
        mpatches.Patch(facecolor='#2196F3', alpha=0.15, label='多头FVG'),
        mpatches.Patch(facecolor='#FF9800', alpha=0.15, label='空头FVG'),
        plt.Line2D([0], [0], marker='v', color='#ffd600', label='BSL', 
                  markersize=10, linestyle='None'),
        plt.Line2D([0], [0], marker='^', color='#00bcd4', label='SSL', 
                  markersize=10, linestyle='None'),
    ]
    legend = ax.legend(handles=legend_elements, loc='upper right', 
                      facecolor='#0d1117', labelcolor='white', 
                      framealpha=0.9, fontsize=9)
    legend.get_frame().set_edgecolor('white')
    
    for spine in ax.spines.values():
        spine.set_color('white')
        spine.set_alpha(0.2)
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, facecolor='#0d1117', edgecolor='none',
                bbox_inches='tight')
    plt.close()
    return output_path

def analyze(symbol="XAUUSD", tf_name="15M", bars=200):
    """主分析函数"""
    timeframe = TIMEFRAME_MAP.get(tf_name.upper(), mt5.TIMEFRAME_M15)
    
    print(f"分析 {symbol} {tf_name}...")
    df = get_data(symbol, timeframe, bars)
    if df is None:
        return None
    
    print(f"获取到 {len(df)} 根K线")
    print(f"当前价格: {df['close'].iloc[-1]:.2f}")
    
    swing_highs, swing_lows = find_swing_points(df)
    print(f"摆动点: {len(swing_highs)}高 {len(swing_lows)}低")
    
    obs = find_order_blocks(df, swing_highs, swing_lows)
    print(f"Order Block: {len(obs)}个")
    
    fvgs = find_fvg(df)
    print(f"FVG: {len(fvgs)}个")
    
    output_path = rf"C:\Users\User\.openclaw\workspace\{symbol}_{tf_name}_analysis.png"
    plot_chart(df, swing_highs, swing_lows, obs, fvgs, symbol, tf_name, output_path)
    print(f"图表已保存: {output_path}")
    
    # 生成分析摘要
    trend = detect_choch_bos(df, swing_highs, swing_lows)
    summary = {
        'symbol': symbol,
        'timeframe': tf_name,
        'price': df['close'].iloc[-1],
        'trend': trend[0] if trend else {'type': 'unknown', 'desc': '无法判断'},
        'ob_count': len(obs),
        'fvg_count': len(fvgs),
        'output_path': output_path
    }
    
    return summary

if __name__ == "__main__":
    # 命令行参数: python chart_analyzer.py [SYMBOL] [TIMEFRAME] [BARS]
    symbol = sys.argv[1] if len(sys.argv) > 1 else "XAUUSD"
    tf = sys.argv[2] if len(sys.argv) > 2 else "15M"
    bars = int(sys.argv[3]) if len(sys.argv) > 3 else 200
    
    result = analyze(symbol, tf, bars)
    if result:
        print(f"\n=== 分析完成 ===")
        print(f"品种: {result['symbol']} {result['timeframe']}")
        print(f"价格: {result['price']:.2f}")
        print(f"趋势: {result['trend']['desc']}")
        print(f"OB: {result['ob_count']}个 | FVG: {result['fvg_count']}个")
        print(f"图表: {result['output_path']}")
