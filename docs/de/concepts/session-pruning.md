---
summary: „Session-Pruning: Trimmen von Werkzeugergebnissen zur Reduzierung von Kontextaufblähung“
read_when:
  - Sie möchten das Wachstum des LLM-Kontexts durch Werkzeugausgaben reduzieren
  - Sie optimieren agents.defaults.contextPruning
x-i18n:
  source_path: concepts/session-pruning.md
  source_hash: 9b0aa2d1abea7050
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:07Z
---

# Session-Pruning

Session-Pruning trimmt **alte Werkzeugergebnisse** aus dem In-Memory-Kontext unmittelbar vor jedem LLM-Aufruf. Es schreibt die On-Disk-Sitzungshistorie **nicht** um (`*.jsonl`).

## Wann es ausgeführt wird

- Wenn `mode: "cache-ttl"` aktiviert ist und der letzte Anthropic-Aufruf für die Sitzung älter ist als `ttl`.
- Betrifft nur die Nachrichten, die für diese Anfrage an das Modell gesendet werden.
- Nur aktiv für Anthropic-API-Aufrufe (und OpenRouter-Anthropic-Modelle).
- Für beste Ergebnisse stimmen Sie `ttl` auf Ihr Modell `cacheControlTtl` ab.
- Nach einem Prune wird das TTL-Fenster zurückgesetzt, sodass nachfolgende Anfragen den Cache behalten, bis `ttl` erneut abläuft.

## Intelligente Standardwerte (Anthropic)

- **OAuth- oder Setup-Token**-Profile: `cache-ttl`-Pruning aktivieren und Heartbeat auf `1h` setzen.
- **API-Key**-Profile: `cache-ttl`-Pruning aktivieren, Heartbeat auf `30m` setzen und `cacheControlTtl` standardmäßig auf `1h` für Anthropic-Modelle setzen.
- Wenn Sie einen dieser Werte explizit setzen, überschreibt OpenClaw sie **nicht**.

## Was dies verbessert (Kosten + Cache-Verhalten)

- **Warum prunen:** Anthropic-Prompt-Caching gilt nur innerhalb der TTL. Wenn eine Sitzung länger als die TTL inaktiv ist, cached die nächste Anfrage den vollständigen Prompt erneut, sofern Sie ihn nicht vorher trimmen.
- **Was günstiger wird:** Pruning reduziert die **cacheWrite**-Größe für diese erste Anfrage nach Ablauf der TTL.
- **Warum das Zurücksetzen der TTL wichtig ist:** Sobald Pruning ausgeführt wurde, setzt sich das Cache-Fenster zurück, sodass Folgeanfragen den frisch gecachten Prompt wiederverwenden können, statt die komplette Historie erneut zu cachen.
- **Was es nicht tut:** Pruning fügt keine Tokens hinzu und „verdoppelt“ keine Kosten; es ändert nur, was bei dieser ersten Anfrage nach der TTL gecacht wird.

## Was gepruned werden kann

- Nur `toolResult`-Nachrichten.
- Benutzer- und Assistenten-Nachrichten werden **niemals** verändert.
- Die letzten `keepLastAssistants` Assistenten-Nachrichten sind geschützt; Werkzeugergebnisse nach diesem Cutoff werden nicht gepruned.
- Wenn es nicht genügend Assistenten-Nachrichten gibt, um den Cutoff festzulegen, wird Pruning übersprungen.
- Werkzeugergebnisse mit **Bildblöcken** werden übersprungen (niemals getrimmt/geleert).

## Schätzung des Kontextfensters

Pruning verwendet ein geschätztes Kontextfenster (Zeichen ≈ Tokens × 4). Das Basisfenster wird in dieser Reihenfolge ermittelt:

1. `models.providers.*.models[].contextWindow`-Override.
2. Modell-Definition `contextWindow` (aus dem Modell-Register).
3. Standard `200000` Tokens.

Wenn `agents.defaults.contextTokens` gesetzt ist, wird es als Obergrenze (min) für das ermittelte Fenster behandelt.

## Modus

### cache-ttl

- Pruning wird nur ausgeführt, wenn der letzte Anthropic-Aufruf älter ist als `ttl` (Standard `5m`).
- Beim Ausführen: gleiches Soft-Trim- + Hard-Clear-Verhalten wie zuvor.

## Soft- vs. Hard-Pruning

- **Soft-Trim**: nur für übergroße Werkzeugergebnisse.
  - Behält Kopf + Ende, fügt `...` ein und hängt eine Notiz mit der ursprünglichen Größe an.
  - Überspringt Ergebnisse mit Bildblöcken.
- **Hard-Clear**: ersetzt das gesamte Werkzeugergebnis durch `hardClear.placeholder`.

## Werkzeugauswahl

- `tools.allow` / `tools.deny` unterstützen `*`-Wildcards.
- Deny hat Vorrang.
- Abgleich ist nicht case-sensitiv.
- Leere Allow-Liste ⇒ alle Werkzeuge erlaubt.

## Interaktion mit anderen Limits

- Eingebaute Werkzeuge kürzen ihre eigene Ausgabe bereits; Session-Pruning ist eine zusätzliche Schicht, die verhindert, dass sich in lang laufenden Chats zu viele Werkzeugausgaben im Modellkontext ansammeln.
- Kompaktierung ist separat: Kompaktierung fasst zusammen und persistiert, Pruning ist transient pro Anfrage. Siehe [/concepts/compaction](/concepts/compaction).

## Standardwerte (wenn aktiviert)

- `ttl`: `"5m"`
- `keepLastAssistants`: `3`
- `softTrimRatio`: `0.3`
- `hardClearRatio`: `0.5`
- `minPrunableToolChars`: `50000`
- `softTrim`: `{ maxChars: 4000, headChars: 1500, tailChars: 1500 }`
- `hardClear`: `{ enabled: true, placeholder: "[Old tool result content cleared]" }`

## Beispiele

Standard (aus):

```json5
{
  agent: {
    contextPruning: { mode: "off" },
  },
}
```

TTL-bewusstes Pruning aktivieren:

```json5
{
  agent: {
    contextPruning: { mode: "cache-ttl", ttl: "5m" },
  },
}
```

Pruning auf bestimmte Werkzeuge beschränken:

```json5
{
  agent: {
    contextPruning: {
      mode: "cache-ttl",
      tools: { allow: ["exec", "read"], deny: ["*image*"] },
    },
  },
}
```

Siehe Konfigurationsreferenz: [Gateway Configuration](/gateway/configuration)
