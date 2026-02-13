---
name: silicon-trader
description: Use when you need to trade like a human using an SMC (Smart Money Concept) quant system: scan markets, analyze charts, manage trade memory, and execute trades via MT5.
version: "3.1.0"
author: Eden for Alpha Quant Pro
metadata:
  openclaw:
    emoji: 🤖
    requires:
      pip:
        - package: MetaTrader5
          version: ">=5.0.45"
    install:
      - label: "Install MT5 dependencies"
        command: "uv pip install MetaTrader5 pandas"
    run:
      - label: "Data feeder (scan markets)"
        command: "python scripts/data_feeder.py"
      - label: "Trade executor (place orders)"
        command: "python scripts/trade_executor.py"
      - label: "SMC radar (key levels)"
        command: "python scripts/smc_radar.py"
      - label: "Chart drawer (visuals)"
        command: "python scripts/chart_drawer.py"
      - label: "Scan memory (trade history)"
        command: "python scripts/scan_memory.py"
---

# Silicon Trader Skill

本 Skill 是一套完整的 AI 交易员工具箱。

## 🛠️ 工具清单 (Toolbox)

此 Skill 包含以下核心 Python 脚本，各司其职：

| 工具脚本 | 用途 | 核心功能 |
|---|---|---|
| **`python data_feeder.py`** | **👁️ 感知 (Eyes)** | 连接 MT5，获取行情/账户数据，生成带指标的图表。 |
| **`python trade_executor.py`** | **✋ 执行 (Hands)** | 发送交易指令到 MT5，并将交易结果写入记忆库。 |
| **`python smc_radar.py`** | **📡 雷达 (Radar)** | 扫描关键价位 (Session H/L) 和强力 FVG。 |
| **`python chart_drawer.py`** | **🎨 绘图 (Artist)** | 绘制 H1/M15 K线图，叠加 OB/FVG/ATR/Volume。 |
| **`python scan_memory.py`** | **🧠 记忆 (Memory)** | 读写 JSON 数据库，记录每一次的分析预期与结果。 |

## 🚀 快速开始

**请务必首先阅读工作流文档：**
👉 [WORKFLOW.md](WORKFLOW.md)

该文档详细定义了：
1.  操作步骤 (SOP)
2.  认知逻辑 (Cognition)
3.  工具调用 (Tools)

## 📂 核心文件索引

*   **流程**: `WORKFLOW.md`
*   **策略**: `strategies/FINAL_SMC_STRATEGY.md`
*   **视觉**: `strategies/VISUAL_ANALYSIS.md`
*   **入口**: `python data_feeder.py`
*   **执行**: `python trade_executor.py`