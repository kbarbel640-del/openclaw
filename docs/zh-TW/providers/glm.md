---
summary: "GLM 模型家族總覽 + 在 OpenClaw 中的使用方式"
read_when:
  - 你想在 OpenClaw 中使用 GLM 模型
  - 你需要模型命名規範與設定方式
title: "GLM 模型"
x-i18n:
  source_path: providers/glm.md
  source_hash: 2d7b457f033f26f2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:14Z
---

# GLM 模型

GLM 是一個**模型家族**（不是公司），可透過 Z.AI 平台取得。在 OpenClaw 中，GLM
模型是透過 `zai` 提供者存取，並使用如 `zai/glm-4.7` 的模型 ID。

## CLI 設定

```bash
openclaw onboard --auth-choice zai-api-key
```

## 設定片段

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## 注意事項

- GLM 版本與可用性可能會變更；請查看 Z.AI 的文件以取得最新資訊。
- 範例模型 ID 包含 `glm-4.7` 與 `glm-4.6`。
- 提供者的詳細資訊，請參閱 [/providers/zai](/providers/zai)。
