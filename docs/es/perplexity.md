---
summary: "Configuracion de Perplexity Sonar para web_search"
read_when:
  - Quiere usar Perplexity Sonar para busqueda web
  - Necesita PERPLEXITY_API_KEY o configuracion de OpenRouter
title: "Perplexity Sonar"
x-i18n:
  source_path: perplexity.md
  source_hash: 264d08e62e3bec85
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:23Z
---

# Perplexity Sonar

OpenClaw puede usar Perplexity Sonar para la herramienta `web_search`. Puede conectarse
a traves de la API directa de Perplexity o mediante OpenRouter.

## Opciones de API

### Perplexity (directo)

- URL base: https://api.perplexity.ai
- Variable de entorno: `PERPLEXITY_API_KEY`

### OpenRouter (alternativa)

- URL base: https://openrouter.ai/api/v1
- Variable de entorno: `OPENROUTER_API_KEY`
- Admite creditos prepagados/cripto.

## Ejemplo de configuracion

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

## Cambio desde Brave

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

Si tanto `PERPLEXITY_API_KEY` como `OPENROUTER_API_KEY` estan configurados, configure
`tools.web.search.perplexity.baseUrl` (o `tools.web.search.perplexity.apiKey`)
para desambiguar.

Si no se configura una URL base, OpenClaw elige un valor predeterminado segun la fuente de la clave de API:

- `PERPLEXITY_API_KEY` o `pplx-...` → Perplexity directo (`https://api.perplexity.ai`)
- `OPENROUTER_API_KEY` o `sk-or-...` → OpenRouter (`https://openrouter.ai/api/v1`)
- Formatos de clave desconocidos → OpenRouter (alternativa segura)

## Modelos

- `perplexity/sonar` — preguntas y respuestas rapidas con busqueda web
- `perplexity/sonar-pro` (predeterminado) — razonamiento de varios pasos + busqueda web
- `perplexity/sonar-reasoning-pro` — investigacion profunda

Consulte [Herramientas web](/tools/web) para la configuracion completa de web_search.
