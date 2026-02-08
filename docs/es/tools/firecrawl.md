---
summary: "Fallback de Firecrawl para web_fetch (anti-bot + extraccion en cache)"
read_when:
  - Quiere extraccion web respaldada por Firecrawl
  - Necesita una clave de API de Firecrawl
  - Quiere extraccion anti-bot para web_fetch
title: "Firecrawl"
x-i18n:
  source_path: tools/firecrawl.md
  source_hash: 08a7ad45b41af412
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:10Z
---

# Firecrawl

OpenClaw puede usar **Firecrawl** como extractor de respaldo para `web_fetch`. Es un servicio alojado de
extraccion de contenido que admite la elusion de bots y el cache, lo que ayuda
con sitios con mucho JS o paginas que bloquean las solicitudes HTTP simples.

## Obtener una clave de API

1. Cree una cuenta de Firecrawl y genere una clave de API.
2. Guárdela en la configuracion o establezca `FIRECRAWL_API_KEY` en el entorno del Gateway.

## Configurar Firecrawl

```json5
{
  tools: {
    web: {
      fetch: {
        firecrawl: {
          apiKey: "FIRECRAWL_API_KEY_HERE",
          baseUrl: "https://api.firecrawl.dev",
          onlyMainContent: true,
          maxAgeMs: 172800000,
          timeoutSeconds: 60,
        },
      },
    },
  },
}
```

Notas:

- `firecrawl.enabled` es verdadero de forma predeterminada cuando hay una clave de API presente.
- `maxAgeMs` controla cuan antiguos pueden ser los resultados en cache (ms). El valor predeterminado es 2 dias.

## Sigilo / elusion de bots

Firecrawl expone un parametro de **modo proxy** para la elusion de bots (`basic`, `stealth` o `auto`).
OpenClaw siempre usa `proxy: "auto"` junto con `storeInCache: true` para las solicitudes a Firecrawl.
Si se omite el proxy, Firecrawl usa de forma predeterminada `auto`. `auto` reintenta con proxies sigilosos si un intento basico falla, lo que puede usar mas creditos
que el scraping solo basico.

## Como `web_fetch` usa Firecrawl

Orden de extraccion de `web_fetch`:

1. Readability (local)
2. Firecrawl (si esta configurado)
3. Limpieza basica de HTML (ultimo recurso)

Consulte [Web tools](/tools/web) para la configuracion completa de la herramienta web.
