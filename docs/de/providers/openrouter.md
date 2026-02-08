---
summary: „Verwenden Sie die einheitliche API von OpenRouter, um in OpenClaw auf viele Modelle zuzugreifen“
read_when:
  - Sie moechten einen einzelnen API-Schluessel fuer viele LLMs
  - Sie moechten Modelle ueber OpenRouter in OpenClaw ausfuehren
title: „OpenRouter“
x-i18n:
  source_path: providers/openrouter.md
  source_hash: b7e29fc9c456c64d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:14Z
---

# OpenRouter

OpenRouter stellt eine **einheitliche API** bereit, die Anfragen ueber einen einzigen Endpunkt und API-Schluessel an viele Modelle weiterleitet. Sie ist OpenAI-kompatibel, sodass die meisten OpenAI-SDKs funktionieren, wenn Sie die Basis-URL umstellen.

## CLI-Einrichtung

```bash
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_API_KEY"
```

## Konfigurationsausschnitt

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

## Hinweise

- Modell-Referenzen sind `openrouter/<provider>/<model>`.
- Fuer weitere Modell-/Anbieteroptionen siehe [/concepts/model-providers](/concepts/model-providers).
- OpenRouter verwendet unter der Haube einen Bearer-Token mit Ihrem API-Schluessel.
