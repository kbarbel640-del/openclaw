# 24Bet 服務化框架設計 — 模組拆分方案

> Week1 Day1 交付物 | 2026-02-03

## 📍 現狀分析

當前代碼分佈在兩個位置，職責混雜：

```
scripts/                    # 「什麼都做」的腳本堆
├── daily_summary.py        # 收集3源數據 + 生成摘要 + git push
├── unified_data_service.py # Clarity/TiDB/Matomo 收集器
├── analyze_clarity_trends.py
├── data_sources/           # 數據源連接器
│   ├── tidb.py
│   ├── matomo.py
│   ├── clarity.py
│   └── gemini_summarizer.py
└── ...各種一次性腳本

mcp-matomo/src/             # MCP Server（Maya 人格）
├── server.py               # MCP 工具定義
├── api_client.py           # Matomo HTTP API
├── db_client.py            # Matomo DB（SSH 隧道）
└── tools/
```

### 問題
1. **耦合嚴重**：`daily_summary.py` 同時負責收集、分析、輸出、git
2. **重複實現**：Matomo 連接在 `scripts/data_sources/matomo.py` 和 `mcp-matomo/src/api_client.py` 各寫一次
3. **無法並發**：三個數據源串行收集，TiDB 慢時全部卡住
4. **無錯誤隔離**：一個數據源掛了，整個 daily_summary 失敗

---

## 🏗️ 服務化模組拆分

### 目標架構

```
services/
├── core/                       # 核心共用
│   ├── config.py               # 統一配置（環境變數、連線資訊）
│   ├── logger.py               # 統一日誌
│   └── models.py               # 數據模型（dataclass/pydantic）
│
├── collectors/                  # 數據收集層（每個獨立、可並發）
│   ├── base.py                 # BaseCollector 抽象類
│   ├── matomo_collector.py     # Matomo API + DB（合併兩處實現）
│   ├── tidb_collector.py       # TiDB 留存/存款數據
│   └── clarity_collector.py    # Clarity 前端行為數據
│
├── analyzers/                   # 分析層（消費 collectors 的輸出）
│   ├── base.py                 # BaseAnalyzer 抽象類
│   ├── daily_analyzer.py       # 每日摘要分析
│   ├── retention_analyzer.py   # 留存專項分析
│   └── funnel_analyzer.py      # 漏斗分析
│
├── reporters/                   # 輸出層（消費 analyzers 的結果）
│   ├── markdown_reporter.py    # 生成 .md 報告
│   ├── telegram_reporter.py    # 推送到 Telegram
│   └── sheet_reporter.py       # 更新 Google Sheet
│
└── orchestrator.py              # 編排器：調度 collect → analyze → report
```

### 模組職責定義

| 模組 | 輸入 | 輸出 | 依賴 |
|------|------|------|------|
| `core/config` | 環境變數 | Config 物件 | 無 |
| `collectors/*` | Config + 日期範圍 | `RawData` dataclass | core |
| `analyzers/*` | `RawData` | `AnalysisResult` dataclass | core, collectors |
| `reporters/*` | `AnalysisResult` | 文件/訊息 | core, analyzers |
| `orchestrator` | CLI 參數 | 調度流程 | 全部 |

---

## 📐 核心介面設計

### BaseCollector

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Optional, Dict, Any

@dataclass
class CollectorResult:
    source: str           # "matomo" | "tidb" | "clarity"
    date: date
    status: str           # "ok" | "error" | "partial"
    metrics: Dict[str, Any]
    error: Optional[str] = None
    collected_at: Optional[str] = None

class BaseCollector(ABC):
    """所有數據收集器的基類"""

    @abstractmethod
    async def collect(self, target_date: date) -> CollectorResult:
        """收集指定日期的數據"""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """檢查數據源是否可用"""
        ...
```

### Orchestrator（支援並發）

```python
import asyncio

class Orchestrator:
    def __init__(self, collectors, analyzers, reporters):
        self.collectors = collectors
        self.analyzers = analyzers
        self.reporters = reporters

    async def run(self, target_date: date):
        # Step 1: 並發收集（互不阻塞）
        results = await asyncio.gather(
            *[c.collect(target_date) for c in self.collectors],
            return_exceptions=True  # 一個掛了不影響其他
        )

        # Step 2: 分析
        raw_data = {r.source: r for r in results if isinstance(r, CollectorResult)}
        analysis = await self.analyze(raw_data)

        # Step 3: 輸出
        await asyncio.gather(
            *[r.report(analysis) for r in self.reporters]
        )
```

---

## 🔀 遷移路徑（不破壞現有功能）

| 步驟 | 做什麼 | 風險 |
|------|--------|------|
| 1 | 建立 `services/core/` + `models.py` | 零（新增檔案） |
| 2 | 把 `data_sources/*.py` 包裝成 `collectors/`，保留原檔案 | 零（新增 wrapper） |
| 3 | 新 `orchestrator.py` 調用 collectors，輸出與 `daily_summary.py` 相同格式 | 低（可 A/B 比對） |
| 4 | 驗證輸出一致後，`daily_summary.py` 改為調用 orchestrator | 低 |
| 5 | 移除 `scripts/data_sources/` 中的重複代碼 | 中（需確認無其他引用） |

---

## ⏱️ Week1 時間分配建議

| Day | 任務 | 產出 |
|-----|------|------|
| Mon (Day1) | ✅ 模組拆分設計（本文件） | 架構文件 |
| Tue (Day2) | 路由規範：定義 collector/analyzer/reporter 的介面合約 | interfaces.py |
| Wed (Day3) | 並發處理方案：asyncio.gather + 超時 + 重試策略 | concurrency_design.md |
| Thu (Day4) | 並發驗證：在測試站跑 3 源並發收集 | test_concurrent.py |
| Fri (Day5) | 核心骨架實現：services/ 目錄 + BaseCollector + Orchestrator | 可運行代碼 |

---

## 💡 設計原則

1. **每個 collector 獨立部署** — 一個掛了不影響其他
2. **介面統一** — 所有 collector 返回 `CollectorResult`，分析器不關心數據從哪來
3. **向後兼容** — 遷移期間 `daily_summary.py` 繼續能跑
4. **可觀測** — 每個模組自帶 health_check + 日誌
