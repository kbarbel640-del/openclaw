---
summary: "使用 Z.AI（GLM 模型）搭配 OpenClaw"
read_when:
  - 您想在 OpenClaw 中使用 Z.AI / GLM 模型
  - 您需要簡單的 ZAI_API_KEY 設定
title: "Z.AI"
x-i18n:
  source_path: providers/zai.md
  source_hash: 2c24bbad86cf86c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:18Z
---

# Z.AI

Z.AI 是 **GLM** 模型的 API 平台。它為 GLM 提供 REST API，並使用 API 金鑰進行身分驗證。請在 Z.AI 主控台建立您的 API 金鑰。OpenClaw 透過 Z.AI API 金鑰使用 `zai` 提供者。

## CLI 設定

```bash
openclaw onboard --auth-choice zai-api-key
# or non-interactive
openclaw onboard --zai-api-key "$ZAI_API_KEY"
```

## 設定片段

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## 注意事項

- GLM 模型可作為 `zai/<model>` 使用（例如：`zai/glm-4.7`）。
- 請參閱 [/providers/glm](/providers/glm) 以了解模型家族總覽。
- Z.AI 使用 Bearer 驗證搭配您的 API 金鑰。
