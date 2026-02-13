"""
Strategy Loader - 策略加载器
负责将 FINAL_SMC_STRATEGY.md 的核心逻辑转化为代码可用的数据结构
"""

from dataclasses import dataclass
from typing import List, Dict

@dataclass
class EntryRule:
    direction: str
    conditions: List[str]
    entry_point: str
    stop_loss: str
    take_profit: List[str]

@dataclass
class Strategy:
    name: str
    version: str
    
    # 第一层：机器雷达参数
    radar_settings: Dict[str, float]  # e.g., {'fvg_strength': 0.5}
    
    # 第二层：人类决策逻辑
    context_questions: List[str]      # H1 全局审视问题
    sweep_checks: List[str]           # 猎杀确认检查
    
    # 第三层：执行规则
    long_setup: EntryRule
    short_setup: EntryRule
    
    # 第四层：风控
    risk_limits: Dict[str, float]     # e.g., {'daily_loss': -0.03}
    
    # 视觉复核清单 (Eden Use)
    eden_checklist: List[str]

class StrategyLoader:
    """加载最终策略逻辑"""
    
    def parse_smc_strategy(self) -> Strategy:
        """
        返回 FINAL_SMC_STRATEGY.md 的代码化表示
        """
        return Strategy(
            name="Silicon Trader Final",
            version="3.0.0",
            
            # 1. 机器雷达
            radar_settings={
                "fvg_strength_threshold": 0.5,  # Gap > 0.5 * AvgBody
                "session_asia": [0, 8],
                "session_london": [8, 16],
                "session_ny": [13, 21]
            },
            
            # 2. 人类决策 (定性分析)
            context_questions=[
                "价格是否在 H1 强阻力/支撑区?",
                "H1 趋势是延续还是反转?",
                "今天的交易偏向 (Bias) 是什么?"
            ],
            sweep_checks=[
                "价格是否刚刚冲破了 Asia High 或 London Low?",
                "是否留下了长影线 (假突破)?",
                "如果我是机构，刚才拿到了谁的止损?"
            ],
            
            # 3. 执行规则
            long_setup=EntryRule(
                direction="Long",
                conditions=["H1 Bias != Bearish", "M15 in Discount (<0.5)", "Bullish OB/FVG"],
                entry_point="FVG 50% 回抽位 (首选) 或 OB 边缘",
                stop_loss="扫荡点 (Sweep Low) 下方 10-15 pips",
                take_profit=["1:2 盈亏比 (减仓推保本)", "对向流动性池 (前高)"]
            ),
            short_setup=EntryRule(
                direction="Short",
                conditions=["H1 Bias != Bullish", "M15 in Premium (>0.5)", "Bearish OB/FVG"],
                entry_point="FVG 50% 回抽位 (首选) 或 OB 边缘",
                stop_loss="扫荡点 (Sweep High) 上方 10-15 pips",
                take_profit=["1:2 盈亏比 (减仓推保本)", "对向流动性池 (前低)"]
            ),
            
            # 4. 风控
            risk_limits={
                "daily_loss_pct": 3.0,    # 3% 停机
                "max_consecutive_loss": 3, # 3连亏暂停
                "risk_per_trade": 1.0      # 1% 单笔
            },
            
            # 5. Eden 视觉复核清单
            eden_checklist=[
                "H1 趋势: 清晰吗？还是在震荡？",
                "流动性: 亚盘高低点被扫了吗？",
                "P/D 位置: 做多在 Discount 吗？做空在 Premium 吗？",
                "OB 质量: 是'最后一根蜡烛'吗？后面有 FVG 吗？",
                "预期核实: 现在的价格行为，符合我 15 分钟前的预期吗？"
            ]
        )

# 测试
if __name__ == "__main__":
    loader = StrategyLoader()
    strategy = loader.parse_smc_strategy()
    print(f"已加载策略: {strategy.name} v{strategy.version}")
    print("\n[Eden Checklist]")
    for item in strategy.eden_checklist:
        print(f"- {item}")
