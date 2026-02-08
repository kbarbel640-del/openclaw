---
summary: 「嚴格的設定驗證 + 僅限 doctor 的遷移」
read_when:
  - 設計或實作設定驗證行為時
  - 處理設定遷移或 doctor 工作流程時
  - 處理外掛設定結構描述或外掛載入管控時
title: 「嚴格設定驗證」
x-i18n:
  source_path: refactor/strict-config.md
  source_hash: 5bc7174a67d2234e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:29Z
---

# 嚴格設定驗證（僅限 doctor 的遷移）

## 目標

- **在所有層級拒絕未知的設定金鑰**（根層級 + 巢狀）。
- **拒絕沒有結構描述的外掛設定**；不要載入該外掛。
- **移除載入時的舊版自動遷移**；遷移僅透過 doctor 執行。
- **啟動時自動執行 doctor（dry-run）**；若無效，封鎖非診斷指令。

## 非目標

- 載入時的向後相容（舊版金鑰不會自動遷移）。
- 靜默丟棄無法識別的金鑰。

## 嚴格驗證規則

- 設定必須在每一層級都與結構描述**完全一致**。
- 未知金鑰屬於驗證錯誤（根層級或巢狀皆不允許 passthrough）。
- `plugins.entries.<id>.config` 必須由外掛的結構描述進行驗證。
  - 若外掛缺少結構描述，**拒絕載入外掛**並呈現清楚的錯誤。
- 除非外掛清單宣告了頻道 id，否則未知的 `channels.<id>` 金鑰視為錯誤。
- 所有外掛都**必須**提供外掛清單（`openclaw.plugin.json`）。

## 外掛結構描述強制規範

- 每個外掛都需為其設定提供嚴格的 JSON Schema（內嵌於清單中）。
- 外掛載入流程：
  1. 解析外掛清單 + 結構描述（`openclaw.plugin.json`）。
  2. 依結構描述驗證設定。
  3. 若缺少結構描述或設定無效：封鎖外掛載入，並記錄錯誤。
- 錯誤訊息包含：
  - 外掛 id
  - 原因（缺少結構描述／設定無效）
  - 驗證失敗的路徑
- 停用的外掛會保留其設定，但 Doctor + 日誌會顯示警告。

## Doctor 流程

- 每次載入設定時都會執行 Doctor（預設為 dry-run）。
- 若設定無效：
  - 輸出摘要 + 可採取行動的錯誤。
  - 指示：`openclaw doctor --fix`。
- `openclaw doctor --fix`：
  - 套用遷移。
  - 移除未知金鑰。
  - 寫入更新後的設定。

## 指令管控（設定無效時）

允許（僅限診斷）：

- `openclaw doctor`
- `openclaw logs`
- `openclaw health`
- `openclaw help`
- `openclaw status`
- `openclaw gateway status`

其他所有指令必須硬性失敗並顯示：「設定無效。請執行 `openclaw doctor --fix`。」

## 錯誤 UX 格式

- 單一摘要標題。
- 分組區段：
  - 未知金鑰（完整路徑）
  - 舊版金鑰／需要遷移
  - 外掛載入失敗（外掛 id + 原因 + 路徑）

## 實作接點

- `src/config/zod-schema.ts`：移除根層級 passthrough；所有物件皆採嚴格模式。
- `src/config/zod-schema.providers.ts`：確保嚴格的頻道結構描述。
- `src/config/validation.ts`：未知金鑰即失敗；不要套用舊版遷移。
- `src/config/io.ts`：移除舊版自動遷移；一律執行 doctor dry-run。
- `src/config/legacy*.ts`：將使用方式移至僅由 doctor 執行。
- `src/plugins/*`：新增結構描述登錄與管控。
- `src/cli` 中的 CLI 指令管控。

## 測試

- 未知金鑰拒絕（根層級 + 巢狀）。
- 外掛缺少結構描述 → 封鎖外掛載入並顯示清楚錯誤。
- 設定無效 → 封鎖 Gateway 啟動，僅允許診斷指令。
- Doctor 預設 dry-run；`doctor --fix` 會寫入修正後的設定。
