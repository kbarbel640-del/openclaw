---
summary: "Nur-JSON-LLM-Aufgaben fuer Workflows (optionales Plugin-Werkzeug)"
read_when:
  - Sie moechten einen reinen JSON-LLM-Schritt innerhalb von Workflows
  - Sie benoetigen schema-validierte LLM-Ausgaben fuer Automatisierung
title: "LLM-Aufgabe"
x-i18n:
  source_path: tools/llm-task.md
  source_hash: b7aa78f179cb0f63
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:47Z
---

# LLM-Aufgabe

`llm-task` ist ein **optionales Plugin-Werkzeug**, das eine reine JSON-LLM-Aufgabe ausfuehrt und
strukturierte Ausgabe zurueckgibt (optional gegen JSON Schema validiert).

Dies ist ideal fuer Workflow-Engines wie Lobster: Sie koennen einen einzelnen LLM-Schritt hinzufuegen,
ohne fuer jeden Workflow eigenen OpenClaw-Code zu schreiben.

## Plugin aktivieren

1. Aktivieren Sie das Plugin:

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  }
}
```

2. Setzen Sie das Werkzeug auf die Allowlist (es ist mit `optional: true` registriert):

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

## Konfiguration (optional)

```json
{
  "plugins": {
    "entries": {
      "llm-task": {
        "enabled": true,
        "config": {
          "defaultProvider": "openai-codex",
          "defaultModel": "gpt-5.2",
          "defaultAuthProfileId": "main",
          "allowedModels": ["openai-codex/gpt-5.3-codex"],
          "maxTokens": 800,
          "timeoutMs": 30000
        }
      }
    }
  }
}
```

`allowedModels` ist eine Allowlist von `provider/model`-Strings. Wenn gesetzt, wird jede Anfrage
ausserhalb der Liste abgelehnt.

## Werkzeugparameter

- `prompt` (String, erforderlich)
- `input` (beliebig, optional)
- `schema` (Objekt, optionales JSON Schema)
- `provider` (String, optional)
- `model` (String, optional)
- `authProfileId` (String, optional)
- `temperature` (Zahl, optional)
- `maxTokens` (Zahl, optional)
- `timeoutMs` (Zahl, optional)

## Ausgabe

Gibt `details.json` zurueck, das das geparste JSON enthaelt (und validiert gegen
`schema`, wenn bereitgestellt).

## Beispiel: Lobster-Workflow-Schritt

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": {
    "subject": "Hello",
    "body": "Can you help?"
  },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

## Sicherheitshinweise

- Das Werkzeug ist **nur JSON** und weist das Modell an, ausschliesslich JSON auszugeben (keine
  Code-Fences, keine Kommentare).
- Fuer diesen Lauf werden dem Modell keine Werkzeuge bereitgestellt.
- Behandeln Sie die Ausgabe als nicht vertrauenswuerdig, sofern Sie nicht mit `schema` validieren.
- Platzieren Sie Freigaben vor jedem Schritt mit Seiteneffekten (senden, posten, ausfuehren).
