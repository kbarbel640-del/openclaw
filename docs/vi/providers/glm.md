---
summary: "Tong quan ve ho mo hinh GLM + cach su dung trong OpenClaw"
read_when:
  - Ban muon dung cac mo hinh GLM trong OpenClaw
  - Ban can quy uoc dat ten mo hinh va thiet lap
title: "Cac mo hinh GLM"
x-i18n:
  source_path: providers/glm.md
  source_hash: 2d7b457f033f26f2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:01Z
---

# Cac mo hinh GLM

GLM la **ho mo hinh** (khong phai cong ty) co san thong qua nen tang Z.AI. Trong OpenClaw, cac mo hinh GLM
duoc truy cap thong qua nha cung cap `zai` va cac ID mo hinh nhu `zai/glm-4.7`.

## Thiet lap CLI

```bash
openclaw onboard --auth-choice zai-api-key
```

## Doan cau hinh

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## Ghi chu

- Phien ban va tinh san co cua GLM co the thay doi; hay kiem tra tai lieu cua Z.AI de cap nhat moi nhat.
- Vi du ve ID mo hinh bao gom `glm-4.7` va `glm-4.6`.
- De biet them chi tiet ve nha cung cap, xem [/providers/zai](/providers/zai).
