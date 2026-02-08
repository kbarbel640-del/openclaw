---
summary: „Verwenden Sie Z.AI (GLM-Modelle) mit OpenClaw“
read_when:
  - Sie möchten Z.AI / GLM-Modelle in OpenClaw verwenden
  - Sie benötigen eine einfache ZAI_API_KEY-Einrichtung
title: „Z.AI“
x-i18n:
  source_path: providers/zai.md
  source_hash: 2c24bbad86cf86c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:13Z
---

# Z.AI

Z.AI ist die API-Plattform für **GLM**-Modelle. Sie stellt REST-APIs für GLM bereit und verwendet API-Schlüssel
zur Authentifizierung. Erstellen Sie Ihren API-Schlüssel in der Z.AI-Konsole. OpenClaw verwendet den Anbieter `zai`
mit einem Z.AI-API-Schlüssel.

## CLI-Einrichtung

```bash
openclaw onboard --auth-choice zai-api-key
# or non-interactive
openclaw onboard --zai-api-key "$ZAI_API_KEY"
```

## Konfigurationsausschnitt

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## Hinweise

- GLM-Modelle sind als `zai/<model>` verfügbar (Beispiel: `zai/glm-4.7`).
- Siehe [/providers/glm](/providers/glm) fuer alle Details zur Modellfamilien-Übersicht.
- Z.AI verwendet Bearer-Authentifizierung mit Ihrem API-Schlüssel.
