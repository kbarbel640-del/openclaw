---
summary: "OpenClaw 如何輪替驗證設定檔，並在模型之間進行回退"
read_when:
  - 診斷驗證設定檔輪替、冷卻時間，或模型回退行為
  - 更新驗證設定檔或模型的回退規則
title: "模型回退"
x-i18n:
  source_path: concepts/model-failover.md
  source_hash: eab7c0633824d941
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:04Z
---

# 模型回退

OpenClaw 以兩個階段處理失敗情況：

1. **驗證設定檔輪替**：在目前的提供者內進行。
2. **模型回退**：回退到 `agents.defaults.model.fallbacks` 中的下一個模型。

本文件說明執行階段規則，以及支撐這些規則的資料。

## 驗證儲存（金鑰 + OAuth）

OpenClaw 同時為 API 金鑰與 OAuth 權杖使用 **驗證設定檔**。

- 機密資料存放於 `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`（舊版：`~/.openclaw/agent/auth-profiles.json`）。
- 設定檔 `auth.profiles` / `auth.order` 僅包含 **中繼資料 + 路由**（不含機密）。
- 舊版僅供匯入的 OAuth 檔案：`~/.openclaw/credentials/oauth.json`（首次使用時匯入至 `auth-profiles.json`）。

更多細節：[/concepts/oauth](/concepts/oauth)

憑證類型：

- `type: "api_key"` → `{ provider, key }`
- `type: "oauth"` → `{ provider, access, refresh, expires, email? }`（部分提供者另含 `projectId`/`enterpriseUrl`）

## 設定檔 ID

OAuth 登入會建立不同的設定檔，讓多個帳號可以共存。

- 預設：在無法取得電子郵件時使用 `provider:default`。
- 含電子郵件的 OAuth：`provider:<email>`（例如 `google-antigravity:user@gmail.com`）。

設定檔位於 `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` 中的 `profiles` 之下。

## 輪替順序

當某個提供者有多個設定檔時，OpenClaw 依下列順序選擇：

1. **明確設定**：`auth.order[provider]`（若有設定）。
2. **已設定的設定檔**：`auth.profiles`，並依提供者篩選。
3. **已儲存的設定檔**：`auth-profiles.json` 中屬於該提供者的項目。

若未設定明確順序，OpenClaw 會使用循環（round‑robin）順序：

- **主要鍵**：設定檔類型（**OAuth 優先於 API 金鑰**）。
- **次要鍵**：`usageStats.lastUsed`（在各類型內由最舊到最新）。
- **冷卻中／已停用的設定檔** 會被移到最後，並依最早到期時間排序。

### 工作階段黏著性（有利於快取）

OpenClaw **會在每個工作階段固定所選的驗證設定檔**，以保持提供者快取的熱度。
它**不會**在每次請求時輪替。固定的設定檔會持續使用，直到：

- 工作階段被重置（`/new` / `/reset`）
- 壓縮完成（壓縮計數遞增）
- 設定檔進入冷卻或被停用

透過 `/model …@<profileId>` 進行的手動選擇，會為該工作階段設定 **使用者覆寫**，
在新的工作階段開始前不會自動輪替。

自動固定的設定檔（由工作階段路由器選擇）被視為 **偏好**：
會先嘗試它，但在遇到速率限制／逾時時，OpenClaw 可能會輪替到其他設定檔。
使用者固定的設定檔會鎖定在該設定檔；若其失敗且已設定模型回退，
OpenClaw 會改為移動到下一個模型，而不是切換設定檔。

### 為何 OAuth 看起來會「消失」

如果你對同一提供者同時擁有 OAuth 設定檔與 API 金鑰設定檔，未固定時，循環機制可能會在訊息之間切換。若要強制使用單一設定檔：

- 使用 `auth.order[provider] = ["provider:profileId"]` 進行固定，或
- 透過 `/model …` 使用每個工作階段的覆寫（在你的 UI／聊天介面支援時）指定設定檔覆寫。

## 冷卻時間

當設定檔因驗證／速率限制錯誤（或看起來像速率限制的逾時）而失敗時，
OpenClaw 會將其標記為冷卻中，並移動到下一個設定檔。
格式錯誤／無效請求錯誤（例如 Cloud Code Assist 工具呼叫 ID 驗證失敗）
也被視為需要回退，並使用相同的冷卻機制。

冷卻時間採用指數退避：

- 1 分鐘
- 5 分鐘
- 25 分鐘
- 1 小時（上限）

狀態儲存在 `auth-profiles.json` 的 `usageStats` 下：

```json
{
  "usageStats": {
    "provider:profile": {
      "lastUsed": 1736160000000,
      "cooldownUntil": 1736160600000,
      "errorCount": 2
    }
  }
}
```

## 計費停用

計費／點數不足（例如「點數不足」／「點數餘額過低」）也被視為需要回退，
但通常不是暫時性問題。OpenClaw 不會使用短暫冷卻，
而是將設定檔標記為 **已停用**（較長的退避），並輪替到下一個設定檔／提供者。

狀態儲存在 `auth-profiles.json`：

```json
{
  "usageStats": {
    "provider:profile": {
      "disabledUntil": 1736178000000,
      "disabledReason": "billing"
    }
  }
}
```

預設值：

- 計費退避從 **5 小時** 開始，每次計費失敗倍增，並以 **24 小時** 為上限。
- 若設定檔在 **24 小時** 內未再失敗，退避計數會重置（可設定）。

## 模型回退

若某提供者的所有設定檔都失敗，OpenClaw 會移動到
`agents.defaults.model.fallbacks` 中的下一個模型。這適用於驗證失敗、速率限制，以及
在設定檔輪替用盡後的逾時（其他錯誤不會推進回退）。

當執行時使用模型覆寫（hooks 或 CLI），回退仍會在嘗試任何已設定的回退後，
最終結束於 `agents.defaults.model.primary`。

## 相關設定

請參閱 [Gateway configuration](/gateway/configuration) 了解：

- `auth.profiles` / `auth.order`
- `auth.cooldowns.billingBackoffHours` / `auth.cooldowns.billingBackoffHoursByProvider`
- `auth.cooldowns.billingMaxHours` / `auth.cooldowns.failureWindowHours`
- `agents.defaults.model.primary` / `agents.defaults.model.fallbacks`
- `agents.defaults.imageModel` 路由

另請參閱 [Models](/concepts/models) 以取得更完整的模型選擇與回退概覽。
