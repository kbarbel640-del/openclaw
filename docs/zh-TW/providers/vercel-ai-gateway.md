---
title: "Vercel AI Gateway"
summary: "Vercel AI Gateway 設定（驗證 + 模型選擇）"
read_when:
  - 您想要將 Vercel AI Gateway 與 OpenClaw 一起使用
  - 您需要 API 金鑰的環境變數或 CLI 驗證選項
x-i18n:
  source_path: providers/vercel-ai-gateway.md
  source_hash: 2bf1687c1152c6e1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:19Z
---

# Vercel AI Gateway

[Vercel AI Gateway](https://vercel.com/ai-gateway) 提供統一的 API，可透過單一端點存取數百種模型。

- 提供者：`vercel-ai-gateway`
- 驗證：`AI_GATEWAY_API_KEY`
- API：相容於 Anthropic Messages

## 快速開始

1. 設定 API 金鑰（建議：將其儲存在 Gateway 閘道器 中）：

```bash
openclaw onboard --auth-choice ai-gateway-api-key
```

2. 設定預設模型：

```json5
{
  agents: {
    defaults: {
      model: { primary: "vercel-ai-gateway/anthropic/claude-opus-4.6" },
    },
  },
}
```

## 非互動式範例

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice ai-gateway-api-key \
  --ai-gateway-api-key "$AI_GATEWAY_API_KEY"
```

## 環境注意事項

若 Gateway 閘道器 以常駐程式（launchd/systemd）執行，請確保 `AI_GATEWAY_API_KEY`
可供該程序使用（例如，在 `~/.openclaw/.env` 中，或透過
`env.shellEnv`）。
