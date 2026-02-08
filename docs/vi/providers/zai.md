---
summary: "Su dung Z.AI (cac mo hinh GLM) voi OpenClaw"
read_when:
  - Ban muon su dung cac mo hinh Z.AI / GLM trong OpenClaw
  - Ban can thiet lap ZAI_API_KEY don gian
title: "Z.AI"
x-i18n:
  source_path: providers/zai.md
  source_hash: 2c24bbad86cf86c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:07Z
---

# Z.AI

Z.AI la nen tang API cho cac mo hinh **GLM**. Nen tang nay cung cap cac REST API cho GLM va su dung khoa API
de xac thuc. Hay tao khoa API cua ban trong bang dieu khien Z.AI. OpenClaw su dung nha cung cap `zai`
voi khoa API Z.AI.

## Thiet lap CLI

```bash
openclaw onboard --auth-choice zai-api-key
# or non-interactive
openclaw onboard --zai-api-key "$ZAI_API_KEY"
```

## Doan cau hinh

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## Ghi chu

- Cac mo hinh GLM co san duoi dang `zai/<model>` (vi du: `zai/glm-4.7`).
- Xem [/providers/glm](/providers/glm) de tong quan ve ho mo hinh.
- Z.AI su dung xac thuc Bearer voi khoa API cua ban.
