---
summary: "Ueberblick ueber die GLM-Modellfamilie + Verwendung in OpenClaw"
read_when:
  - Sie moechten GLM-Modelle in OpenClaw verwenden
  - Sie benoetigen die Modellbenennungskonvention und Einrichtung
title: "GLM-Modelle"
x-i18n:
  source_path: providers/glm.md
  source_hash: 2d7b457f033f26f2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:08Z
---

# GLM-Modelle

GLM ist eine **Modellfamilie** (kein Unternehmen), die ueber die Z.AI-Plattform verfuegbar ist. In OpenClaw werden GLM-
Modelle ueber den Anbieter `zai` und Modell-IDs wie `zai/glm-4.7` angesprochen.

## CLI-Einrichtung

```bash
openclaw onboard --auth-choice zai-api-key
```

## Konfigurationsausschnitt

```json5
{
  env: { ZAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "zai/glm-4.7" } } },
}
```

## Hinweise

- GLM-Versionen und -Verfuegbarkeit koennen sich aendern; pruefen Sie die Z.AI-Dokumentation fuer den neuesten Stand.
- Beispielhafte Modell-IDs sind unter anderem `glm-4.7` und `glm-4.6`.
- Fuer Anbieterdetails siehe [/providers/zai](/providers/zai).
