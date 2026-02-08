---
summary: 「使用量追蹤介面與憑證需求」
read_when:
  - 「你正在串接提供者的使用量／配額介面」
  - 「你需要說明使用量追蹤行為或驗證需求」
title: 「使用量追蹤」
x-i18n:
  source_path: concepts/usage-tracking.md
  source_hash: 6f6ed2a70329b2a6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:07Z
---

# 使用量追蹤

## 這是什麼

- 直接從提供者的使用量端點拉取使用量／配額。
- 不提供成本估算；僅顯示提供者回報的時間視窗。

## 會出現在哪裡

- 聊天中的 `/status`：含有豐富表情符號的狀態卡，顯示工作階段權杖 + 預估成本（僅限 API key）。當可用時，會顯示**目前模型提供者**的使用量。
- 聊天中的 `/usage off|tokens|full`：每則回應的使用量頁腳（OAuth 僅顯示權杖）。
- 聊天中的 `/usage cost`：由 OpenClaw 工作階段日誌彙整的本地成本摘要。
- CLI：`openclaw status --usage` 會輸出各提供者的完整明細。
- CLI：`openclaw channels list` 會在提供者設定旁顯示相同的使用量快照（使用 `--no-usage` 可略過）。
- macOS 選單列：Context 底下的「Usage」區段（僅在可用時顯示）。

## 提供者 + 憑證

- **Anthropic (Claude)**：驗證設定檔中的 OAuth 權杖。
- **GitHub Copilot**：驗證設定檔中的 OAuth 權杖。
- **Gemini CLI**：驗證設定檔中的 OAuth 權杖。
- **Antigravity**：驗證設定檔中的 OAuth 權杖。
- **OpenAI Codex**：驗證設定檔中的 OAuth 權杖（存在時使用 accountId）。
- **MiniMax**：API key（程式設計方案金鑰；`MINIMAX_CODE_PLAN_KEY` 或 `MINIMAX_API_KEY`）；使用 5 小時的程式設計方案時間視窗。
- **z.ai**：透過 環境變數／設定／驗證儲存庫 的 API key。

若不存在相符的 OAuth／API 憑證，使用量將被隱藏。
