# Day1 日報 — 2026-02-03 (Mon)

## 今日完成

### 【架構】服務化框架設計（模組拆分）✅

**產出**：`24bet-service-architecture-v2.md`

**核心決策**：
1. 基於現有 fetchers/formatters 架構重組，不重寫
2. 數據源：TiDB + Matomo（兩源）
3. 新增 `ConnectionManager` — TiDB 連線池 + Matomo SSH 隧道複用
4. 新增 `ReportService` — 統一報表生成介面 `generate(report_type, date)`
5. 為 Week2 Telegram 按鈕查詢鋪路

**架構變化**：
```
現有                           →  重構後
main.py (CLI only)             →  app.py (CLI + serve 模式)
每個 fetcher 各自建連線         →  共享 ConnectionManager
串行執行                       →  可並發（共享連線）
只能定時推送                    →  支援按需查詢
```

**現有報表（全部保留，邏輯不動）**：
- Phase 0: Funnel 日報
- Phase 1: Cohort 日報
- Phase 2.0: 渠道週報
- Phase 2.1: 用戶價值日報

## 明日計劃
- Day2：路由規範 — 定義 fetcher/formatter/delivery 介面合約

---

## Google Sheet 備注更新

| 欄位 | 值 |
|------|-----|
| 任務名稱 | 【架構】服務化框架設計（模組拆分） |
| Jira | — |
| 負責人 | Andrew |
| 當前進度 | 100% |
| 預計工時D | 1 |
| 開始時間 | 2026-02-03 |
| 結束時間 | 2026-02-03 |
| 實際用時D | 1 |
| 狀態 | ✅ 完成 |
| 備注 | 產出架構設計文件 v2；基於現有 Phase 0-3 報表體系，拆分 fetch/format/delivery 三層 + ConnectionManager 連線複用 + ReportService 統一介面；為 Week2 按鈕查詢鋪路 |

---

## 明日站立會議稿（≤1 分鐘）

### 上週成果（30%）
上週完成了期中報告整理和二月計劃規劃，已跟 Jack 確認四週 sprint 排程。

### 本月計劃（20%）
二月四週：架構重構 → 互動核心 → 春節輕量迭代 → 日期篩選。目標是把現有日報系統從「只能推」升級到「能推也能查」。

### 本週計劃（50%）
Week1 聚焦服務化框架：
- ✅ **今天**：模組拆分設計完成，產出架構文件
- 📋 **明天**：路由規範，定義各模組介面合約
- 📋 **週三**：並發處理方案設計
- 📋 **週四**：測試站驗證並發能力
- 📋 **週五**：核心骨架實現，新舊輸出比對驗證
