---
summary: "Websuche- und Abrufwerkzeuge (Brave Search API, Perplexity direkt/OpenRouter)"
read_when:
  - Sie moechten web_search oder web_fetch aktivieren
  - Sie benoetigen die Einrichtung eines Brave Search API-Schluessels
  - Sie moechten Perplexity Sonar fuer die Websuche verwenden
title: "Web-Werkzeuge"
x-i18n:
  source_path: tools/web.md
  source_hash: f5f25d2b40ccf1e5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:01Z
---

# Web-Werkzeuge

OpenClaw liefert zwei leichtgewichtige Web-Werkzeuge:

- `web_search` — Durchsucht das Web ueber die Brave Search API (Standard) oder Perplexity Sonar (direkt oder ueber OpenRouter).
- `web_fetch` — HTTP-Abruf + lesbare Extraktion (HTML → Markdown/Text).

Dies ist **keine** Browser-Automatisierung. Fuer JS-lastige Seiten oder Logins verwenden Sie das
[Browser tool](/tools/browser).

## Funktionsweise

- `web_search` ruft Ihren konfigurierten Anbieter auf und gibt Ergebnisse zurueck.
  - **Brave** (Standard): liefert strukturierte Ergebnisse (Titel, URL, Snippet).
  - **Perplexity**: liefert KI-synthetisierte Antworten mit Zitaten aus der Echtzeit-Websuche.
- Ergebnisse werden pro Suchanfrage 15 Minuten lang zwischengespeichert (konfigurierbar).
- `web_fetch` fuehrt einen einfachen HTTP-GET aus und extrahiert lesbaren Inhalt
  (HTML → Markdown/Text). JavaScript wird **nicht** ausgefuehrt.
- `web_fetch` ist standardmaessig aktiviert (sofern nicht explizit deaktiviert).

## Auswahl eines Suchanbieters

| Anbieter             | Vorteile                                      | Nachteile                                    | API-Schluessel                                 |
| -------------------- | --------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| **Brave** (Standard) | Schnell, strukturierte Ergebnisse, Free-Tier  | Klassische Suchergebnisse                    | `BRAVE_API_KEY`                                |
| **Perplexity**       | KI-synthetisierte Antworten, Zitate, Echtzeit | Erfordert Perplexity- oder OpenRouter-Zugang | `OPENROUTER_API_KEY` oder `PERPLEXITY_API_KEY` |

Siehe [Brave Search setup](/brave-search) und [Perplexity Sonar](/perplexity) fuer anbieterspezifische Details.

Legen Sie den Anbieter in der Konfiguration fest:

```json5
{
  tools: {
    web: {
      search: {
        provider: "brave", // or "perplexity"
      },
    },
  },
}
```

Beispiel: Wechsel zu Perplexity Sonar (direkte API):

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

## Einen Brave-API-Schluessel erhalten

1. Erstellen Sie ein Brave Search API-Konto unter https://brave.com/search/api/
2. Waehlen Sie im Dashboard den Tarif **Data for Search** (nicht „Data for AI“) und generieren Sie einen API-Schluessel.
3. Fuehren Sie `openclaw configure --section web` aus, um den Schluessel in der Konfiguration zu speichern (empfohlen), oder setzen Sie `BRAVE_API_KEY` in Ihrer Umgebung.

Brave bietet einen Free-Tier sowie kostenpflichtige Plaene; pruefen Sie im Brave-API-Portal die
aktuellen Limits und Preise.

### Wo der Schluessel gesetzt wird (empfohlen)

**Empfohlen:** Fuehren Sie `openclaw configure --section web` aus. Dadurch wird der Schluessel in
`~/.openclaw/openclaw.json` unter `tools.web.search.apiKey` gespeichert.

**Umgebungsalternative:** Setzen Sie `BRAVE_API_KEY` in der Gateway-Prozessumgebung.
Bei einer Gateway-Installation legen Sie ihn in `~/.openclaw/.env` ab (oder in Ihrer
Service-Umgebung). Siehe [Env vars](/help/faq#how-does-openclaw-load-environment-variables).

## Perplexity verwenden (direkt oder ueber OpenRouter)

Perplexity-Sonar-Modelle verfuegen ueber integrierte Websuchfunktionen und liefern KI-synthetisierte
Antworten mit Zitaten. Sie koennen sie ueber OpenRouter verwenden (keine Kreditkarte erforderlich –
unterstuetzt Krypto/Prepaid).

### Einen OpenRouter-API-Schluessel erhalten

1. Erstellen Sie ein Konto unter https://openrouter.ai/
2. Laden Sie Guthaben auf (unterstuetzt Krypto, Prepaid oder Kreditkarte)
3. Generieren Sie in den Kontoeinstellungen einen API-Schluessel

### Perplexity-Suche einrichten

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "perplexity",
        perplexity: {
          // API key (optional if OPENROUTER_API_KEY or PERPLEXITY_API_KEY is set)
          apiKey: "sk-or-v1-...",
          // Base URL (key-aware default if omitted)
          baseUrl: "https://openrouter.ai/api/v1",
          // Model (defaults to perplexity/sonar-pro)
          model: "perplexity/sonar-pro",
        },
      },
    },
  },
}
```

**Umgebungsalternative:** Setzen Sie `OPENROUTER_API_KEY` oder `PERPLEXITY_API_KEY` in der Gateway-
Umgebung. Bei einer Gateway-Installation legen Sie ihn in `~/.openclaw/.env` ab.

Wenn keine Basis-URL gesetzt ist, waehlt OpenClaw einen Standard basierend auf der Quelle des API-Schluessels:

- `PERPLEXITY_API_KEY` oder `pplx-...` → `https://api.perplexity.ai`
- `OPENROUTER_API_KEY` oder `sk-or-...` → `https://openrouter.ai/api/v1`
- Unbekannte Schluesselformate → OpenRouter (sicherer Fallback)

### Verfuegbare Perplexity-Modelle

| Modell                            | Beschreibung                             | Am besten geeignet fuer   |
| --------------------------------- | ---------------------------------------- | ------------------------- |
| `perplexity/sonar`                | Schnelle Q&A mit Websuche                | Schnelle Nachschlagewerke |
| `perplexity/sonar-pro` (Standard) | Mehrstufiges Schlussfolgern mit Websuche | Komplexe Fragen           |
| `perplexity/sonar-reasoning-pro`  | Chain-of-Thought-Analyse                 | Tiefgehende Recherche     |

## web_search

Durchsucht das Web mit Ihrem konfigurierten Anbieter.

### Anforderungen

- `tools.web.search.enabled` darf nicht `false` sein (Standard: aktiviert)
- API-Schluessel fuer Ihren gewaehlten Anbieter:
  - **Brave**: `BRAVE_API_KEY` oder `tools.web.search.apiKey`
  - **Perplexity**: `OPENROUTER_API_KEY`, `PERPLEXITY_API_KEY` oder `tools.web.search.perplexity.apiKey`

### Konfiguration

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        apiKey: "BRAVE_API_KEY_HERE", // optional if BRAVE_API_KEY is set
        maxResults: 5,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
      },
    },
  },
}
```

### Werkzeugparameter

- `query` (erforderlich)
- `count` (1–10; Standard aus der Konfiguration)
- `country` (optional): 2-stelliger Laendercode fuer regionenspezifische Ergebnisse (z. B. „DE“, „US“, „ALL“). Wenn weggelassen, waehlt Brave seine Standardregion.
- `search_lang` (optional): ISO-Sprachcode fuer Suchergebnisse (z. B. „de“, „en“, „fr“)
- `ui_lang` (optional): ISO-Sprachcode fuer UI-Elemente
- `freshness` (optional, nur Brave): Filter nach Entdeckungszeit (`pd`, `pw`, `pm`, `py` oder `YYYY-MM-DDtoYYYY-MM-DD`)

**Beispiele:**

```javascript
// German-specific search
await web_search({
  query: "TV online schauen",
  count: 10,
  country: "DE",
  search_lang: "de",
});

// French search with French UI
await web_search({
  query: "actualités",
  country: "FR",
  search_lang: "fr",
  ui_lang: "fr",
});

// Recent results (past week)
await web_search({
  query: "TMBG interview",
  freshness: "pw",
});
```

## web_fetch

Ruft eine URL ab und extrahiert lesbaren Inhalt.

### Anforderungen

- `tools.web.fetch.enabled` darf nicht `false` sein (Standard: aktiviert)
- Optionaler Firecrawl-Fallback: Setzen Sie `tools.web.fetch.firecrawl.apiKey` oder `FIRECRAWL_API_KEY`.

### Konfiguration

```json5
{
  tools: {
    web: {
      fetch: {
        enabled: true,
        maxChars: 50000,
        maxCharsCap: 50000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
        maxRedirects: 3,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        readability: true,
        firecrawl: {
          enabled: true,
          apiKey: "FIRECRAWL_API_KEY_HERE", // optional if FIRECRAWL_API_KEY is set
          baseUrl: "https://api.firecrawl.dev",
          onlyMainContent: true,
          maxAgeMs: 86400000, // ms (1 day)
          timeoutSeconds: 60,
        },
      },
    },
  },
}
```

### Werkzeugparameter

- `url` (erforderlich, nur http/https)
- `extractMode` (`markdown` | `text`)
- `maxChars` (lange Seiten kuerzen)

Hinweise:

- `web_fetch` verwendet zuerst Readability (Extraktion des Hauptinhalts), dann Firecrawl (falls konfiguriert). Wenn beides fehlschlaegt, gibt das Werkzeug einen Fehler zurueck.
- Firecrawl-Anfragen verwenden standardmaessig den Bot-Umgehungsmodus und cachen Ergebnisse.
- `web_fetch` sendet standardmaessig einen Chrome-aehnlichen User-Agent und `Accept-Language`; ueberschreiben Sie bei Bedarf `userAgent`.
- `web_fetch` blockiert private/interne Hostnamen und prueft Weiterleitungen erneut (Begrenzung mit `maxRedirects`).
- `maxChars` wird auf `tools.web.fetch.maxCharsCap` begrenzt.
- `web_fetch` ist eine Best-Effort-Extraktion; einige Seiten benoetigen das Browser-Werkzeug.
- Siehe [Firecrawl](/tools/firecrawl) fuer Schluessel-Einrichtung und Servicedetails.
- Antworten werden zwischengespeichert (Standard: 15 Minuten), um wiederholte Abrufe zu reduzieren.
- Wenn Sie Werkzeugprofile/Allowlists verwenden, fuegen Sie `web_search`/`web_fetch` oder `group:web` hinzu.
- Wenn der Brave-Schluessel fehlt, gibt `web_search` einen kurzen Einrichtungshinweis mit Dokumentationslink zurueck.
