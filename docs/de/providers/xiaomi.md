---
summary: „Verwenden Sie Xiaomi MiMo (mimo-v2-flash) mit OpenClaw“
read_when:
  - Sie moechten Xiaomi-MiMo-Modelle in OpenClaw verwenden
  - Sie muessen XIAOMI_API_KEY einrichten
title: „Xiaomi MiMo“
x-i18n:
  source_path: providers/xiaomi.md
  source_hash: 366fd2297b2caf8c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:14Z
---

# Xiaomi MiMo

Xiaomi MiMo ist die API-Plattform fuer **MiMo**-Modelle. Sie stellt REST-APIs bereit, die mit den
Formaten von OpenAI und Anthropic kompatibel sind, und verwendet API-Schluessel zur Authentifizierung.
Erstellen Sie Ihren API-Schluessel in der
[Xiaomi MiMo Console](https://platform.xiaomimimo.com/#/console/api-keys).
OpenClaw verwendet den Anbieter `xiaomi` mit einem Xiaomi-MiMo-API-Schluessel.

## Modelluebersicht

- **mimo-v2-flash**: Kontextfenster mit 262.144 Tokens, kompatibel mit der Anthropic Messages API.
- Basis-URL: `https://api.xiaomimimo.com/anthropic`
- Autorisierung: `Bearer $XIAOMI_API_KEY`

## CLI-Einrichtung

```bash
openclaw onboard --auth-choice xiaomi-api-key
# or non-interactive
openclaw onboard --auth-choice xiaomi-api-key --xiaomi-api-key "$XIAOMI_API_KEY"
```

## Konfigurationsausschnitt

```json5
{
  env: { XIAOMI_API_KEY: "your-key" },
  agents: { defaults: { model: { primary: "xiaomi/mimo-v2-flash" } } },
  models: {
    mode: "merge",
    providers: {
      xiaomi: {
        baseUrl: "https://api.xiaomimimo.com/anthropic",
        api: "anthropic-messages",
        apiKey: "XIAOMI_API_KEY",
        models: [
          {
            id: "mimo-v2-flash",
            name: "Xiaomi MiMo V2 Flash",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 262144,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Hinweise

- Modell-Referenz: `xiaomi/mimo-v2-flash`.
- Der Anbieter wird automatisch eingebunden, wenn `XIAOMI_API_KEY` gesetzt ist (oder ein Authentifizierungsprofil existiert).
- Siehe [/concepts/model-providers](/concepts/model-providers) fuer die Anbieterregeln.
