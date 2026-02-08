---
title: "Cloudflare AI Gateway"
summary: "Einrichtung von Cloudflare AI Gateway (Authentifizierung + Modellauswahl)"
read_when:
  - Sie moechten Cloudflare AI Gateway mit OpenClaw verwenden
  - Sie benoetigen die Account-ID, die Gateway-ID oder die API-Schluessel-Umgebungsvariable
x-i18n:
  source_path: providers/cloudflare-ai-gateway.md
  source_hash: db77652c37652ca2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:09Z
---

# Cloudflare AI Gateway

Cloudflare AI Gateway sitzt vor den APIs der Anbieter und ermoeglicht Ihnen, Analysen, Caching und Kontrollen hinzuzufuegen. Fuer Anthropic verwendet OpenClaw die Anthropic Messages API ueber Ihren Gateway-Endpunkt.

- Anbieter: `cloudflare-ai-gateway`
- Basis-URL: `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic`
- Standardmodell: `cloudflare-ai-gateway/claude-sonnet-4-5`
- API-Schluessel: `CLOUDFLARE_AI_GATEWAY_API_KEY` (Ihr Anbieter-API-Schluessel fuer Anfragen ueber den Gateway)

Fuer Anthropic-Modelle verwenden Sie Ihren Anthropic-API-Schluessel.

## Schnellstart

1. Legen Sie den Anbieter-API-Schluessel und die Gateway-Details fest:

```bash
openclaw onboard --auth-choice cloudflare-ai-gateway-api-key
```

2. Legen Sie ein Standardmodell fest:

```json5
{
  agents: {
    defaults: {
      model: { primary: "cloudflare-ai-gateway/claude-sonnet-4-5" },
    },
  },
}
```

## Nicht-interaktives Beispiel

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice cloudflare-ai-gateway-api-key \
  --cloudflare-ai-gateway-account-id "your-account-id" \
  --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
  --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY"
```

## Authentifizierte Gateways

Wenn Sie die Gateway-Authentifizierung in Cloudflare aktiviert haben, fuegen Sie den Header `cf-aig-authorization` hinzu (dies zusaetzlich zu Ihrem Anbieter-API-Schluessel).

```json5
{
  models: {
    providers: {
      "cloudflare-ai-gateway": {
        headers: {
          "cf-aig-authorization": "Bearer <cloudflare-ai-gateway-token>",
        },
      },
    },
  },
}
```

## Hinweis zur Umgebung

Wenn der Gateway als Daemon laeuft (launchd/systemd), stellen Sie sicher, dass `CLOUDFLARE_AI_GATEWAY_API_KEY` diesem Prozess zur Verfuegung steht (zum Beispiel in `~/.openclaw/.env` oder ueber `env.shellEnv`).
