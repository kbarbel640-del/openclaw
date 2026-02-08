---
summary: 「選單列狀態邏輯，以及對使用者顯示的內容」
read_when:
  - 調整 mac 選單 UI 或狀態邏輯時
title: 「選單列」
x-i18n:
  source_path: platforms/mac/menu-bar.md
  source_hash: 8eb73c0e671a76aa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:07Z
---

# 選單列狀態邏輯

## 顯示內容

- 我們會在選單列圖示以及選單中的第一個狀態列，呈現目前代理程式的工作狀態。
- 工作進行中時會隱藏健康狀態；當所有工作階段皆為閒置時才會重新顯示。
- 選單中的「Nodes」區塊只列出 **裝置**（透過 `node.list` 配對的節點），不包含 client／presence 項目。
- 當有提供者使用量快照可用時，「Context」下方會出現一個「Usage」區段。

## 狀態模型

- 工作階段：事件會以 `runId`（每次執行）送達，並在負載中包含 `sessionKey`。「主要」工作階段的鍵為 `main`；若不存在，則回退為最近一次更新的工作階段。
- 優先順序：主要工作階段永遠優先。若主要為活躍狀態，會立即顯示其狀態。若主要為閒置，則顯示最近一次活躍的非主要工作階段。我們不會在活動進行中來回切換；只有在目前工作階段轉為閒置，或主要工作階段變為活躍時才會切換。
- 活動種類：
  - `job`：高階命令執行（`state: started|streaming|done|error`）。
  - `tool`：`phase: start|result`，搭配 `toolName` 與 `meta/args`。

## IconState 列舉（Swift）

- `idle`
- `workingMain(ActivityKind)`
- `workingOther(ActivityKind)`
- `overridden(ActivityKind)`（除錯覆寫）

### ActivityKind → 圖示

- `exec` → 💻
- `read` → 📄
- `write` → ✍️
- `edit` → 📝
- `attach` → 📎
- 預設 → 🛠️

### 視覺對應

- `idle`：一般小生物。
- `workingMain`：帶有圖示徽章、完整著色，以及「工作中」的腿部動畫。
- `workingOther`：帶有圖示徽章、柔和著色，無奔跑動畫。
- `overridden`：不論活動狀態，皆使用所選的圖示／著色。

## 狀態列文字（選單）

- 工作進行中時：`<Session role> · <activity label>`
  - 範例：`Main · exec: pnpm test`、`Other · read: apps/macos/Sources/OpenClaw/AppState.swift`。
- 閒置時：回退顯示健康狀態摘要。

## 事件接收

- 來源：控制頻道 `agent` 事件（`ControlChannel.handleAgentEvent`）。
- 解析欄位：
  - `stream: "job"`，搭配 `data.state` 用於開始／停止。
  - `stream: "tool"`，包含 `data.phase`、`name`，以及可選的 `meta`/`args`。
- 標籤：
  - `exec`：`args.command` 的第一行。
  - `read`/`write`：縮短後的路徑。
  - `edit`：路徑加上由 `meta`/diff 計數推斷的變更類型。
  - 回退：工具名稱。

## 除錯覆寫

- 設定 ▸ Debug ▸「Icon override」選擇器：
  - `System (auto)`（預設）
  - `Working: main`（依工具種類）
  - `Working: other`（依工具種類）
  - `Idle`
- 透過 `@AppStorage("iconOverride")` 儲存；對應至 `IconState.overridden`。

## 測試檢查清單

- 觸發主要工作階段任務：確認圖示立即切換，且狀態列顯示主要標籤。
- 在主要為閒置時觸發非主要工作階段任務：圖示／狀態顯示非主要，並保持穩定直到完成。
- 在其他工作階段仍活躍時啟動主要：圖示立即切換為主要。
- 快速工具連發：確保徽章不會閃爍（工具結果有 TTL 寬限）。
- 當所有工作階段皆為閒置時，健康狀態列會重新出現。
