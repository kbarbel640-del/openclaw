---
title: "Vercel AI Gateway"
summary: "Thiet lap Vercel AI Gateway (xac thuc + chon mo hinh)"
read_when:
  - Ban muon su dung Vercel AI Gateway voi OpenClaw
  - Ban can bien moi truong khoa API hoac lua chon xac thuc qua CLI
x-i18n:
  source_path: providers/vercel-ai-gateway.md
  source_hash: 2bf1687c1152c6e1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:12Z
---

# Vercel AI Gateway

[Vercel AI Gateway](https://vercel.com/ai-gateway) cung cap mot API thong nhat de truy cap hang tram mo hinh thong qua mot diem cuoi duy nhat.

- Provider: `vercel-ai-gateway`
- Xac thuc: `AI_GATEWAY_API_KEY`
- API: Tuong thich Anthropic Messages

## Khoi dong nhanh

1. Dat khoa API (khuyen nghi: luu tru cho Gateway):

```bash
openclaw onboard --auth-choice ai-gateway-api-key
```

2. Dat mo hinh mac dinh:

```json5
{
  agents: {
    defaults: {
      model: { primary: "vercel-ai-gateway/anthropic/claude-opus-4.6" },
    },
  },
}
```

## Vi du khong tuong tac

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice ai-gateway-api-key \
  --ai-gateway-api-key "$AI_GATEWAY_API_KEY"
```

## Luu y ve moi truong

Neu Gateway chay nhu mot daemon (launchd/systemd), hay dam bao `AI_GATEWAY_API_KEY`
co san cho tien trinh do (vi du, trong `~/.openclaw/.env` hoac thong qua
`env.shellEnv`).
