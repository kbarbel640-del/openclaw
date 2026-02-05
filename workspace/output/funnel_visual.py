#!/usr/bin/env python3
"""BG666 轉化漏斗視覺化"""

import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# 數據
# 全量歷史
all_time = {
    'registered': 949211,
    'first': 332535,
    'second': 178579,
    'third': 126525,
    'fourth': 99553
}

# 近 30 天
recent_30d = {
    'registered': 30234,
    'first': 14047,
    'second': 7199,  # 14047 - 6848
    'third': 4573,   # 7199 - 2626
    'fourth': 3147   # 4573 - 1426
}

fig, axes = plt.subplots(1, 2, figsize=(16, 8))

# 漏斗圖函數
def draw_funnel(ax, data, title):
    stages = ['註冊', '首充', '二充', '三充', '四充']
    values = [data['registered'], data['first'], data['second'], data['third'], data['fourth']]
    
    colors = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6']
    
    # 計算轉化率
    rates = [100]
    for i in range(1, len(values)):
        rates.append(values[i] / values[i-1] * 100)
    
    # 繪製橫向條形圖
    y_pos = range(len(stages))
    bars = ax.barh(y_pos, values, color=colors, height=0.6)
    
    ax.set_yticks(y_pos)
    ax.set_yticklabels(stages, fontsize=12)
    ax.invert_yaxis()
    ax.set_xlabel('用戶數', fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    
    # 添加數值標籤
    for i, (bar, v, r) in enumerate(zip(bars, values, rates)):
        if i == 0:
            label = f'{v:,}'
        else:
            label = f'{v:,} ({r:.1f}%)'
        ax.text(bar.get_width() + max(values)*0.02, bar.get_y() + bar.get_height()/2,
                label, va='center', fontsize=10)
    
    ax.set_xlim(0, max(values) * 1.3)

# 繪製兩個漏斗
draw_funnel(axes[0], all_time, '全量歷史數據')
draw_funnel(axes[1], recent_30d, '近 30 天新用戶')

# 添加對比表格
comparison_text = """
轉化率對比:
─────────────────────────────
環節          全量    近30天   變化
─────────────────────────────
註冊→首充    35.0%   46.5%   ↑11.5%
首充→二充    53.7%   51.2%   ↓2.5%
二充→三充    70.9%   63.5%   ↓7.4%
三充→四充    78.7%   68.8%   ↓9.9%
─────────────────────────────
"""

fig.text(0.5, 0.02, comparison_text, ha='center', fontsize=10, 
         family='monospace', bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

plt.tight_layout()
plt.subplots_adjust(bottom=0.25)
plt.savefig('/Users/sulaxd/clawd/output/bg666_funnel.png', dpi=150, bbox_inches='tight')
print('圖表已保存: /Users/sulaxd/clawd/output/bg666_funnel.png')

# 同時輸出文字報告
print()
print("=" * 60)
print("BG666 轉化漏斗深度分析")
print("=" * 60)
print()
print("【全量歷史 vs 近30天對比】")
print()
print(f"{'環節':<12} {'全量':>12} {'近30天':>12} {'變化':>10}")
print("-" * 50)
print(f"{'註冊→首充':<10} {'35.0%':>12} {'46.5%':>12} {'↑11.5%':>10}")
print(f"{'首充→二充':<10} {'53.7%':>12} {'51.2%':>12} {'↓2.5%':>10}")
print(f"{'二充→三充':<10} {'70.9%':>12} {'63.5%':>12} {'↓7.4%':>10}")
print(f"{'三充→四充':<10} {'78.7%':>12} {'68.8%':>12} {'↓9.9%':>10}")
print()
print("=" * 60)
print("【關鍵洞察】")
print("=" * 60)
print()
print("✅ 好消息：近30天「註冊→首充」提升 11.5%（35%→46.5%）")
print("   可能原因：新用戶激勵活動、首充優惠生效")
print()
print("⚠️ 警示：近30天後續留存下降")
print("   - 首充→二充：53.7% → 51.2%（↓2.5%）")
print("   - 二充→三充：70.9% → 63.5%（↓7.4%）")
print("   - 三充→四充：78.7% → 68.8%（↓9.9%）")
print()
print("📌 建議：")
print("   1. 保持首充激勵策略，效果明顯")
print("   2. 加強「首充→二充」轉化（T+1 觸達、二充獎勵）")
print("   3. 調查近期留存下降原因（遊戲體驗？支付問題？）")
