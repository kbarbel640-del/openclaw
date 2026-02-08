---
summary: "在 OpenClaw 中透過 API 金鑰或 setup-token 使用 Anthropic Claude"
read_when:
  - 你想在 OpenClaw 中使用 Anthropic 模型
  - 你想使用 setup-token 而非 API 金鑰
title: "Anthropic"
x-i18n:
  source_path: providers/anthropic.md
  source_hash: 5e50b3bca35be37e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:19Z
---

# Anthropic（Claude）

Anthropic 建立了 **Claude** 模型家族，並透過 API 提供存取。
在 OpenClaw 中，你可以使用 API 金鑰或 **setup-token** 進行驗證。

## 選項 A：Anthropic API 金鑰

**最適合：** 標準 API 存取與依用量計費。
請在 Anthropic Console 中建立你的 API 金鑰。

### CLI 設定

```bash
openclaw onboard
# choose: Anthropic API key

# or non-interactive
openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY"
```

### 設定片段

```json5
{
  env: { ANTHROPIC_API_KEY: "sk-ant-..." },
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## 提示快取（Anthropic API）

OpenClaw 支援 Anthropic 的提示快取功能。這是 **僅限 API**；訂閱驗證不會套用快取設定。

### 設定

在你的模型設定中使用 `cacheRetention` 參數：

| 值      | 快取期間 | 說明                       |
| ------- | -------- | -------------------------- |
| `none`  | 不快取   | 停用提示快取               |
| `short` | 5 分鐘   | API 金鑰驗證的預設值       |
| `long`  | 1 小時   | 延長快取（需要 beta 旗標） |

```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": {
          params: { cacheRetention: "long" },
        },
      },
    },
  },
}
```

### 預設值

使用 Anthropic API 金鑰驗證時，OpenClaw 會自動為所有 Anthropic 模型套用 `cacheRetention: "short"`（5 分鐘快取）。你可以在設定中明確設定 `cacheRetention` 來覆寫此行為。

### 舊版參數

較舊的 `cacheControlTtl` 參數仍支援以維持向後相容性：

- `"5m"` 對應到 `short`
- `"1h"` 對應到 `long`

我們建議遷移至新的 `cacheRetention` 參數。

OpenClaw 針對 Anthropic API 請求包含 `extended-cache-ttl-2025-04-11` beta 旗標；
若你覆寫提供者標頭，請保留它（請參閱 [/gateway/configuration](/gateway/configuration)）。

## 選項 B：Claude setup-token

**最適合：** 使用你的 Claude 訂閱。

### 如何取得 setup-token

Setup-token 由 **Claude Code CLI** 建立，而非 Anthropic Console。你可以在 **任何機器** 上執行：

```bash
claude setup-token
```

將權杖貼入 OpenClaw（精靈：**Anthropic token（貼上 setup-token）**），或在 Gateway 閘道器 主機上執行：

```bash
openclaw models auth setup-token --provider anthropic
```

如果你是在不同的機器上產生權杖，請貼上：

```bash
openclaw models auth paste-token --provider anthropic
```

### CLI 設定

```bash
# Paste a setup-token during onboarding
openclaw onboard --auth-choice setup-token
```

### 設定片段

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## 備註

- 使用 `claude setup-token` 產生 setup-token 並貼上，或在 Gateway 閘道器 主機上執行 `openclaw models auth setup-token`。
- 若在 Claude 訂閱中看到「OAuth token refresh failed …」，請使用 setup-token 重新驗證。請參閱 [/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription](/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription)。
- 驗證細節與重用規則請見 [/concepts/oauth](/concepts/oauth)。

## 疑難排解

**401 錯誤／權杖突然失效**

- Claude 訂閱驗證可能會過期或被撤銷。請重新執行 `claude setup-token`
  並貼上到 **Gateway 閘道器 主機**。
- 若 Claude CLI 登入位於不同的機器，請在 Gateway 閘道器 主機上使用
  `openclaw models auth paste-token --provider anthropic`。

**找不到提供者「anthropic」的 API 金鑰**

- 驗證是 **依代理程式**。新的代理程式不會繼承主要代理程式的金鑰。
- 重新為該代理程式執行入門引導，或在 Gateway 閘道器 主機上貼上 setup-token／API 金鑰，然後使用 `openclaw models status` 驗證。

**找不到設定檔 `anthropic:default` 的憑證**

- 執行 `openclaw models status` 以查看目前啟用的驗證設定檔。
- 重新執行入門引導，或為該設定檔貼上 setup-token／API 金鑰。

**沒有可用的驗證設定檔（全部處於冷卻／不可用）**

- 檢查 `openclaw models status --json` 是否包含 `auth.unusableProfiles`。
- 新增另一個 Anthropic 設定檔，或等待冷卻結束。

更多資訊：[/gateway/troubleshooting](/gateway/troubleshooting) 與 [/help/faq](/help/faq)。
