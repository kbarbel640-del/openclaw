---
summary: "Einrichtung der Brave Search API fuer web_search"
read_when:
  - Sie moechten Brave Search fuer web_search verwenden
  - Sie benoetigen einen BRAVE_API_KEY oder Plandetails
title: "Brave Search"
x-i18n:
  source_path: brave-search.md
  source_hash: cdcb037b092b8a10
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:15Z
---

# Brave Search API

OpenClaw verwendet Brave Search als Standardanbieter fuer `web_search`.

## API-Schluessel erhalten

1. Erstellen Sie ein Brave-Search-API-Konto unter https://brave.com/search/api/
2. Waehlen Sie im Dashboard den **Data for Search**-Plan und generieren Sie einen API-Schluessel.
3. Speichern Sie den Schluessel in der Konfiguration (empfohlen) oder setzen Sie `BRAVE_API_KEY` in der Gateway-Umgebung.

## Konfigurationsbeispiel

```json5
{
  tools: {
    web: {
      search: {
        provider: "brave",
        apiKey: "BRAVE_API_KEY_HERE",
        maxResults: 5,
        timeoutSeconds: 30,
      },
    },
  },
}
```

## Hinweise

- Der Data-for-AI-Plan ist **nicht** kompatibel mit `web_search`.
- Brave bietet eine kostenlose Stufe sowie kostenpflichtige Plaene; pruefen Sie das Brave-API-Portal auf aktuelle Limits.

Siehe [Web tools](/tools/web) fuer die vollstaendige web_search-Konfiguration.
