---
summary: "OpenClaw 如何建構提示脈絡，並回報權杖用量與成本"
read_when:
  - 說明權杖用量、成本或脈絡視窗時
  - 除錯脈絡成長或壓縮行為時
title: "權杖使用與成本"
x-i18n:
  source_path: token-use.md
  source_hash: cc914080a809ada2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:58Z
---

# 權杖使用與成本

OpenClaw 追蹤的是 **tokens**，而不是字元。Tokens 依模型而異，但多數 OpenAI 風格模型在英文文字中平均約每個 token 為 ~4 個字元。

## 系統提示如何建構

OpenClaw 會在每次執行時組裝自己的系統提示。內容包含：

- 工具清單 + 簡短描述
- Skills 清單（僅中繼資料；指令會在需要時以 `read` 載入）
- 自我更新指示
- 工作區 + 啟動檔案（`AGENTS.md`、`SOUL.md`、`TOOLS.md`、`IDENTITY.md`、`USER.md`、`HEARTBEAT.md`、`BOOTSTRAP.md`（在新增時））。大型檔案會由 `agents.defaults.bootstrapMaxChars` 截斷（預設：20000）。
- 時間（UTC + 使用者時區）
- 回覆標籤 + 心跳行為
- 執行期中繼資料（主機 / OS / 模型 / 思考）

完整拆解請見 [System Prompt](/concepts/system-prompt)。

## 什麼會計入脈絡視窗

模型接收的所有內容都會計入脈絡上限：

- 系統提示（上述所有區段）
- 對話歷史（使用者 + 助手訊息）
- 工具呼叫與工具結果
- 附件 / 逐字稿（圖片、音訊、檔案）
- 壓縮摘要與修剪產物
- 提供者包裝或安全標頭（不可見，但仍會計入）

實務上的拆解（依注入的檔案、工具、Skills 與系統提示大小）請使用 `/context list` 或 `/context detail`。另見 [Context](/concepts/context)。

## 如何查看目前的權杖用量

在聊天中使用：

- `/status` → 顯示 **表情符號豐富的狀態卡**，包含工作階段模型、脈絡用量、
  上一次回覆的輸入 / 輸出 tokens，以及 **估計成本**（僅 API 金鑰）。
- `/usage off|tokens|full` → 為每則回覆附加 **逐回應用量頁尾**。
  - 於每個工作階段持續生效（儲存為 `responseUsage`）。
  - OAuth 驗證 **隱藏成本**（僅顯示 tokens）。
- `/usage cost` → 顯示來自 OpenClaw 工作階段日誌的本機成本摘要。

其他介面：

- **TUI / Web TUI：** 支援 `/status` + `/usage`。
- **CLI：** `openclaw status --usage` 與 `openclaw channels list` 顯示
  提供者配額視窗（非逐回應成本）。

## 成本估算（顯示時）

成本是依你的模型定價設定進行估算：

```
models.providers.<provider>.models[].cost
```

以上為 **每 100 萬 tokens 的美元（USD）**，適用於 `input`、`output`、`cacheRead` 與
`cacheWrite`。若缺少定價，OpenClaw 僅顯示 tokens。OAuth tokens
不會顯示美元成本。

## 快取 TTL 與修剪影響

提供者的提示快取僅在快取 TTL 視窗內適用。OpenClaw 可選擇性執行 **cache-ttl 修剪**：當快取 TTL 到期後修剪工作階段，接著重設快取視窗，讓後續請求能重用新近快取的脈絡，而非重新快取完整歷史。當工作階段在 TTL 之後閒置時，這能降低快取寫入成本。

請在 [Gateway 閘道器 設定](/gateway/configuration) 中設定，並於 [Session pruning](/concepts/session-pruning) 查看行為細節。

心跳可在閒置間隔期間讓快取保持 **warm**。若你的模型快取 TTL 為 `1h`，將心跳間隔設為略低於該值（例如 `55m`），即可避免重新快取完整提示，降低快取寫入成本。

對於 Anthropic API 定價，快取讀取相較於輸入 tokens 便宜許多，而快取寫入則以較高倍數計費。最新費率與 TTL 倍數請參閱 Anthropic 的提示快取定價：
https://docs.anthropic.com/docs/build-with-claude/prompt-caching

### 範例：用心跳讓 1 小時快取保持 warm

```yaml
agents:
  defaults:
    model:
      primary: "anthropic/claude-opus-4-6"
    models:
      "anthropic/claude-opus-4-6":
        params:
          cacheRetention: "long"
    heartbeat:
      every: "55m"
```

## 降低權杖壓力的小技巧

- 使用 `/compact` 來摘要冗長的工作階段。
- 在你的工作流程中修剪大型工具輸出。
- 保持 skill 描述精簡（skill 清單會被注入提示）。
- 對於冗長、探索性的工作，優先選擇較小的模型。

精確的 skill 清單負擔公式請見 [Skills](/tools/skills)。
