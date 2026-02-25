---
summary: "OpenGraph.io provider for web_fetch (AI-powered prompt injection protection)"
read_when:
  - You want OpenGraph.io-backed web extraction
  - You need prompt injection protection for scraped content
  - You want an OpenGraph.io API key setup
title: "OpenGraph.io"
---

# OpenGraph.io

OpenClaw can use **OpenGraph.io** as a fallback extractor for `web_fetch`. It extracts
readable content from web pages and — uniquely — offers **AI-powered prompt injection
sanitization** via the `ai_sanitize` parameter. This protects AI agents from malicious
instructions embedded in scraped web content.

## Get an API key

1. Sign up at [dashboard.opengraph.io](https://dashboard.opengraph.io/register) — free tier available.
2. Store the App ID in config or set `OPENGRAPH_APP_ID` in the gateway environment.

## Configure OpenGraph.io

```json5
{
  tools: {
    web: {
      fetch: {
        opengraph: {
          apiKey: "YOUR_OPENGRAPH_APP_ID",
          baseUrl: "https://opengraph.io",    // default
          aiSanitize: true,                    // default — scans for prompt injection
          aiSanitizeMode: "sanitize",          // "sanitize" (default) or "flag"
          timeoutSeconds: 60,
        },
      },
    },
  },
}
```

Notes:

- `opengraph.enabled` defaults to true when an API key is present.
- `aiSanitize` enables AI-powered scanning of scraped content for prompt injection attempts (default: `true`).
- `aiSanitizeMode`:
  - `"sanitize"` (default) — when injection is detected, returns the cleaned/safe content.
  - `"flag"` — when injection is detected, returns the original content with a warning.

## AI Sanitization (Prompt Injection Protection)

When `aiSanitize` is enabled, OpenGraph.io scans extracted content for prompt injection
patterns — text designed to manipulate AI agents into following malicious instructions.

If injection is detected:
- A warning is logged: `OpenGraph.io AI sanitizer detected potential prompt injection in this content.`
- In **sanitize** mode: the cleaned content (`safeContent`) is returned instead of the raw content.
- In **flag** mode: the original content is returned alongside the warning, letting the caller decide.

This is especially valuable for autonomous agents that fetch arbitrary URLs, as it provides
an additional layer of defense beyond OpenClaw's built-in external content wrapping.

## How `web_fetch` uses OpenGraph.io

`web_fetch` extraction order:

1. Readability (local)
2. OpenGraph.io (if configured)
3. Firecrawl (if configured)
4. Basic HTML cleanup (last fallback)

OpenGraph.io is tried before Firecrawl in the fallback chain. Both can be configured
simultaneously — OpenGraph.io will be attempted first, and Firecrawl serves as an
additional fallback if OpenGraph.io fails.

See [Web tools](/tools/web) for the full web tool setup.
