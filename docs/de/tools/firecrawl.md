---
summary: "Firecrawl-Fallback fuer web_fetch (Anti-Bot + zwischengespeicherte Extraktion)"
read_when:
  - Sie moechten eine Firecrawl-gestuetzte Web-Extraktion
  - Sie benoetigen einen Firecrawl-API-Schluessel
  - Sie moechten Anti-Bot-Extraktion fuer web_fetch
title: "Firecrawl"
x-i18n:
  source_path: tools/firecrawl.md
  source_hash: 08a7ad45b41af412
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:45Z
---

# Firecrawl

OpenClaw kann **Firecrawl** als Fallback-Extraktor fuer `web_fetch` verwenden. Es handelt sich um einen gehosteten
Dienst zur Inhaltsextraktion, der Bot-Umgehung und Caching unterstuetzt, was
bei JS-lastigen Websites oder Seiten hilft, die einfache HTTP-Abrufe blockieren.

## API-Schluessel erhalten

1. Erstellen Sie ein Firecrawl-Konto und generieren Sie einen API-Schluessel.
2. Speichern Sie ihn in der Konfiguration oder setzen Sie `FIRECRAWL_API_KEY` in der Gateway-Umgebung.

## Firecrawl konfigurieren

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

Hinweise:

- `firecrawl.enabled` ist standardmaessig auf true gesetzt, wenn ein API-Schluessel vorhanden ist.
- `maxAgeMs` steuert, wie alt zwischengespeicherte Ergebnisse sein duerfen (ms). Standard sind 2 Tage.

## Stealth / Bot-Umgehung

Firecrawl stellt einen **Proxy-Modus**-Parameter zur Bot-Umgehung bereit (`basic`, `stealth` oder `auto`).
OpenClaw verwendet fuer Firecrawl-Anfragen immer `proxy: "auto"` plus `storeInCache: true`.
Wenn der Proxy weggelassen wird, verwendet Firecrawl standardmaessig `auto`. `auto` wiederholt den Versuch mit Stealth-Proxys, wenn ein grundlegender Versuch fehlschlaegt, was moeglicherweise mehr Credits verbraucht
als reines Basic-Scraping.

## Wie `web_fetch` Firecrawl verwendet

Reihenfolge der `web_fetch`-Extraktion:

1. Readability (lokal)
2. Firecrawl (falls konfiguriert)
3. Grundlegende HTML-Bereinigung (letzter Fallback)

Siehe [Web tools](/tools/web) fuer die vollstaendige Einrichtung der Web-Tools.
