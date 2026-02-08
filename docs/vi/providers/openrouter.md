---
summary: "Su dung API thong nhat cua OpenRouter de truy cap nhieu mo hinh trong OpenClaw"
read_when:
  - Ban muon mot khoa API duy nhat cho nhieu LLM
  - Ban muon chay cac mo hinh thong qua OpenRouter trong OpenClaw
title: "OpenRouter"
x-i18n:
  source_path: providers/openrouter.md
  source_hash: b7e29fc9c456c64d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:10Z
---

# OpenRouter

OpenRouter cung cap mot **API thong nhat** dinh tuyen cac yeu cau den nhieu mo hinh phia sau mot
diem cuoi va mot khoa API duy nhat. No tuong thich OpenAI, vi vay hau het cac SDK OpenAI hoat dong bang cach chuyen doi base URL.

## Thiet lap CLI

```bash
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_API_KEY"
```

## Doan cau hinh

```json5
{
  env: { OPENROUTER_API_KEY: "sk-or-..." },
  agents: {
    defaults: {
      model: { primary: "openrouter/anthropic/claude-sonnet-4-5" },
    },
  },
}
```

## Ghi chu

- Tham chieu model la `openrouter/<provider>/<model>`.
- De biet them cac tuy chon model/nha cung cap, xem [/concepts/model-providers](/concepts/model-providers).
- OpenRouter su dung Bearer token voi khoa API cua ban o ben trong.
