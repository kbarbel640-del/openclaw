---
title: "Vercel AI Gateway"
summary: "Einrichtung des Vercel AI Gateway (Authentifizierung + Modellauswahl)"
read_when:
  - Sie moechten Vercel AI Gateway mit OpenClaw verwenden
  - Sie benoetigen die API-Schluessel-Umgebungsvariable oder die CLI-Authentifizierungsoption
x-i18n:
  source_path: providers/vercel-ai-gateway.md
  source_hash: 2bf1687c1152c6e1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:16Z
---

# Vercel AI Gateway

Das [Vercel AI Gateway](https://vercel.com/ai-gateway) stellt eine einheitliche API bereit, um ueber einen einzigen Endpunkt auf Hunderte von Modellen zuzugreifen.

- Anbieter: `vercel-ai-gateway`
- Authentifizierung: `AI_GATEWAY_API_KEY`
- API: kompatibel mit Anthropic Messages

## Schnellstart

1. Setzen Sie den API-Schluessel (empfohlen: speichern Sie ihn fuer das Gateway):

```bash
openclaw onboard --auth-choice ai-gateway-api-key
```

2. Legen Sie ein Standardmodell fest:

```json5
{
  agents: {
    defaults: {
      model: { primary: "vercel-ai-gateway/anthropic/claude-opus-4.6" },
    },
  },
}
```

## Nicht-interaktives Beispiel

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice ai-gateway-api-key \
  --ai-gateway-api-key "$AI_GATEWAY_API_KEY"
```

## Umgebungs-Hinweis

Wenn das Gateway als Daemon (launchd/systemd) ausgefuehrt wird, stellen Sie sicher, dass `AI_GATEWAY_API_KEY`
diesem Prozess zur Verfuegung steht (zum Beispiel in `~/.openclaw/.env` oder ueber
`env.shellEnv`).
