---
summary: 「OpenClaw 中的 OAuth：權杖交換、儲存與多帳號模式」
read_when:
  - 你想了解 OpenClaw 的 OAuth 端到端流程
  - 你遇到權杖失效／登出問題
  - 你想使用 setup-token 或 OAuth 驗證流程
  - 你想要多個帳號或設定檔路由
title: 「OAuth」
x-i18n:
  source_path: concepts/oauth.md
  source_hash: af714bdadc4a8929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:01Z
---

# OAuth

OpenClaw 透過 OAuth 支援提供此機制的提供者之「訂閱驗證」（尤其是 **OpenAI Codex（ChatGPT OAuth）**）。對於 Anthropic 訂閱，請使用 **setup-token** 流程。本頁說明：

- OAuth **權杖交換**（PKCE）的運作方式
- 權杖 **儲存** 在哪裡（以及原因）
- 如何處理 **多個帳號**（設定檔 + 每個工作階段覆寫）

OpenClaw 也支援內建自家 OAuth 或 API 金鑰流程的 **provider plugins**。可透過以下方式執行：

```bash
openclaw models auth login --provider <id>
```

## 權杖匯集點（為什麼需要它）

OAuth 提供者通常會在登入／更新流程中鑄造 **新的更新權杖**。某些提供者（或 OAuth 用戶端）會在為相同使用者／應用程式發出新權杖時，使舊的更新權杖失效。

實際症狀：

- 你同時透過 OpenClaw _以及_ Claude Code／Codex CLI 登入 → 其中一個之後會隨機被「登出」

為了降低此情況，OpenClaw 將 `auth-profiles.json` 視為 **權杖匯集點**：

- 執行階段只從 **單一位置** 讀取憑證
- 我們可以保留多個設定檔並進行可預期的路由

## 儲存（權杖存放位置）

祕密資料以 **每個代理程式** 為單位儲存：

- 驗證設定檔（OAuth + API 金鑰）：`~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- 執行階段快取（自動管理；請勿編輯）：`~/.openclaw/agents/<agentId>/agent/auth.json`

僅供舊版匯入使用的檔案（仍支援，但非主要儲存）：

- `~/.openclaw/credentials/oauth.json`（首次使用時匯入至 `auth-profiles.json`）

以上全部也會遵循 `$OPENCLAW_STATE_DIR`（狀態目錄覆寫）。完整參考：[/gateway/configuration](/gateway/configuration#auth-storage-oauth--api-keys)

## Anthropic setup-token（訂閱驗證）

在任何機器上執行 `claude setup-token`，然後貼到 OpenClaw：

```bash
openclaw models auth setup-token --provider anthropic
```

如果你在其他地方產生了權杖，請手動貼上：

```bash
openclaw models auth paste-token --provider anthropic
```

驗證：

```bash
openclaw models status
```

## OAuth 交換（登入如何運作）

OpenClaw 的互動式登入流程實作於 `@mariozechner/pi-ai`，並接線至精靈／指令。

### Anthropic（Claude Pro/Max）setup-token

流程型態：

1. 執行 `claude setup-token`
2. 將權杖貼到 OpenClaw
3. 儲存為權杖驗證設定檔（不更新）

精靈路徑為 `openclaw onboard` → 驗證選擇 `setup-token`（Anthropic）。

### OpenAI Codex（ChatGPT OAuth）

流程型態（PKCE）：

1. 產生 PKCE verifier／challenge + 隨機 `state`
2. 開啟 `https://auth.openai.com/oauth/authorize?...`
3. 嘗試在 `http://127.0.0.1:1455/auth/callback` 擷取回呼
4. 若回呼無法綁定（或你在遠端／無頭環境），請貼上重新導向 URL／代碼
5. 於 `https://auth.openai.com/oauth/token` 進行交換
6. 從存取權杖擷取 `accountId` 並儲存 `{ access, refresh, expires, accountId }`

精靈路徑為 `openclaw onboard` → 驗證選擇 `openai-codex`。

## 更新 + 到期

設定檔會儲存一個 `expires` 時間戳記。

在執行階段：

- 若 `expires` 在未來 → 使用已儲存的存取權杖
- 若已到期 → 更新（在檔案鎖下）並覆寫已儲存的憑證

更新流程是自動的；一般不需要手動管理權杖。

## 多帳號（設定檔）+ 路由

兩種模式：

### 1) 建議：分離代理程式

如果你希望「個人」與「工作」完全不互相影響，請使用隔離的代理程式（獨立的工作階段 + 憑證 + 工作區）：

```bash
openclaw agents add work
openclaw agents add personal
```

接著為每個代理程式設定驗證（精靈），並將聊天路由至正確的代理程式。

### 2) 進階：單一代理程式中的多個設定檔

`auth-profiles.json` 支援同一提供者的多個設定檔 ID。

選擇使用哪個設定檔：

- 透過設定排序進行全域設定（`auth.order`）
- 透過 `/model ...@<profileId>` 進行每個工作階段覆寫

範例（工作階段覆寫）：

- `/model Opus@anthropic:work`

查看有哪些設定檔 ID：

- `openclaw channels list --json`（顯示 `auth[]`）

相關文件：

- [/concepts/model-failover](/concepts/model-failover)（輪替 + 冷卻規則）
- [/tools/slash-commands](/tools/slash-commands)（指令介面）
