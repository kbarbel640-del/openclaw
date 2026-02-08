---
summary: „Perplexity-Sonar-Einrichtung fuer web_search“
read_when:
  - Sie moechten Perplexity Sonar fuer die Websuche verwenden
  - Sie benoetigen PERPLEXITY_API_KEY oder eine OpenRouter-Einrichtung
title: „Perplexity Sonar“
x-i18n:
  source_path: perplexity.md
  source_hash: 264d08e62e3bec85
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:49Z
---

# Perplexity Sonar

OpenClaw kann Perplexity Sonar fuer das `web_search`-Werkzeug verwenden. Sie koennen eine Verbindung
ueber die direkte API von Perplexity oder ueber OpenRouter herstellen.

## API-Optionen

### Perplexity (direkt)

- Basis-URL: https://api.perplexity.ai
- Umgebungsvariable: `PERPLEXITY_API_KEY`

### OpenRouter (Alternative)

- Basis-URL: https://openrouter.ai/api/v1
- Umgebungsvariable: `OPENROUTER_API_KEY`
- Unterstuetzt Prepaid-/Krypto-Guthaben.

## Konfigurationsbeispiel

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

## Wechsel von Brave

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-...",
          baseUrl: "https://api.perplexity.ai",
        },
      },
    },
  },
}
```

Wenn sowohl `PERPLEXITY_API_KEY` als auch `OPENROUTER_API_KEY` gesetzt sind, setzen Sie
`tools.web.search.perplexity.baseUrl` (oder `tools.web.search.perplexity.apiKey`),
um eine eindeutige Zuordnung vorzunehmen.

Wenn keine Basis-URL gesetzt ist, waehlt OpenClaw einen Standard basierend auf der Quelle des API-Schluessels:

- `PERPLEXITY_API_KEY` oder `pplx-...` → direktes Perplexity (`https://api.perplexity.ai`)
- `OPENROUTER_API_KEY` oder `sk-or-...` → OpenRouter (`https://openrouter.ai/api/v1`)
- Unbekannte Schluesselformate → OpenRouter (sicherer Fallback)

## Modelle

- `perplexity/sonar` — schnelle Q&A mit Websuche
- `perplexity/sonar-pro` (Standard) — mehrstufiges Schlussfolgern + Websuche
- `perplexity/sonar-reasoning-pro` — Tiefenrecherche

Siehe [Web tools](/tools/web) fuer die vollstaendige web_search-Konfiguration.
