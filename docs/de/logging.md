---
summary: "Logging-Übersicht: Dateilogs, Konsolenausgabe, CLI-Tailing und die Control UI"
read_when:
  - Sie benötigen eine einsteigerfreundliche Übersicht zum Logging
  - Sie möchten Log-Level oder -Formate konfigurieren
  - Sie führen eine Fehlerbehebung durch und müssen Logs schnell finden
title: "Logging"
x-i18n:
  source_path: logging.md
  source_hash: 884fcf4a906adff3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:03Z
---

# Logging

OpenClaw protokolliert an zwei Stellen:

- **Dateilogs** (JSON-Zeilen), die vom Gateway geschrieben werden.
- **Konsolenausgabe**, die in Terminals und der Control UI angezeigt wird.

Diese Seite erklärt, wo Logs liegen, wie man sie liest und wie man Log-Level und
-formate konfiguriert.

## Wo Logs liegen

Standardmäßig schreibt das Gateway eine rotierende Logdatei unter:

`/tmp/openclaw/openclaw-YYYY-MM-DD.log`

Das Datum verwendet die lokale Zeitzone des Gateway-Hosts.

Sie können dies in `~/.openclaw/openclaw.json` überschreiben:

```json
{
  "logging": {
    "file": "/path/to/openclaw.log"
  }
}
```

## Logs lesen

### CLI: Live-Tail (empfohlen)

Verwenden Sie die CLI, um die Gateway-Logdatei per RPC zu tailen:

```bash
openclaw logs --follow
```

Ausgabemodi:

- **TTY-Sitzungen**: ansprechend, farbig, strukturierte Logzeilen.
- **Nicht-TTY-Sitzungen**: Klartext.
- `--json`: zeilengetrenntes JSON (ein Logereignis pro Zeile).
- `--plain`: erzwingt Klartext in TTY-Sitzungen.
- `--no-color`: deaktiviert ANSI-Farben.

Im JSON-Modus gibt die CLI `type`-getaggte Objekte aus:

- `meta`: Stream-Metadaten (Datei, Cursor, Größe)
- `log`: geparster Logeintrag
- `notice`: Hinweise zu Abschneidung/Rotation
- `raw`: ungeparste Logzeile

Wenn das Gateway nicht erreichbar ist, gibt die CLI einen kurzen Hinweis aus, folgenden Befehl auszuführen:

```bash
openclaw doctor
```

### Control UI (Web)

Der Tab **Logs** der Control UI tailt dieselbe Datei mit `logs.tail`.
Siehe [/web/control-ui](/web/control-ui), um zu erfahren, wie Sie sie öffnen.

### Kanalbezogene Logs

Um Kanalaktivitäten (WhatsApp/Telegram/etc.) zu filtern, verwenden Sie:

```bash
openclaw channels logs --channel whatsapp
```

## Logformate

### Dateilogs (JSONL)

Jede Zeile in der Logdatei ist ein JSON-Objekt. Die CLI und die Control UI parsen diese
Einträge, um strukturierte Ausgaben (Zeit, Level, Subsystem, Nachricht) darzustellen.

### Konsolenausgabe

Konsolenlogs sind **TTY-bewusst** und auf Lesbarkeit formatiert:

- Subsystem-Präfixe (z. B. `gateway/channels/whatsapp`)
- Level-Farbgebung (info/warn/error)
- Optionaler Kompakt- oder JSON-Modus

Die Konsolenformatierung wird über `logging.consoleStyle` gesteuert.

## Logging konfigurieren

Die gesamte Logging-Konfiguration befindet sich unter `logging` in `~/.openclaw/openclaw.json`.

```json
{
  "logging": {
    "level": "info",
    "file": "/tmp/openclaw/openclaw-YYYY-MM-DD.log",
    "consoleLevel": "info",
    "consoleStyle": "pretty",
    "redactSensitive": "tools",
    "redactPatterns": ["sk-.*"]
  }
}
```

### Log-Level

- `logging.level`: Level für **Dateilogs** (JSONL).
- `logging.consoleLevel`: Ausführlichkeitsgrad der **Konsole**.

`--verbose` wirkt sich nur auf die Konsolenausgabe aus; es ändert nicht die Dateilog-Level.

### Konsolenstile

`logging.consoleStyle`:

- `pretty`: benutzerfreundlich, farbig, mit Zeitstempeln.
- `compact`: kompaktere Ausgabe (ideal für lange Sitzungen).
- `json`: JSON pro Zeile (für Logprozessoren).

### Redaktion

Werkzeugzusammenfassungen können sensible Tokens redigieren, bevor sie die Konsole erreichen:

- `logging.redactSensitive`: `off` | `tools` (Standard: `tools`)
- `logging.redactPatterns`: Liste von Regex-Zeichenketten, um den Standardsatz zu überschreiben

Die Redaktion betrifft **nur die Konsolenausgabe** und verändert keine Dateilogs.

## Diagnostik + OpenTelemetry

Diagnostik sind strukturierte, maschinenlesbare Ereignisse für Modellläufe **und**
Telemetrie des Nachrichtenflusses (Webhooks, Warteschlangen, Sitzungszustand). Sie
ersetzen Logs **nicht**; sie existieren, um Metriken, Traces und andere Exporter zu speisen.

Diagnostikereignisse werden im Prozess erzeugt, aber Exporter werden nur angebunden,
wenn Diagnostik **und** das Exporter-Plugin aktiviert sind.

### OpenTelemetry vs. OTLP

- **OpenTelemetry (OTel)**: das Datenmodell + SDKs für Traces, Metriken und Logs.
- **OTLP**: das Wire-Protokoll zum Export von OTel-Daten an einen Collector/Backend.
- OpenClaw exportiert derzeit über **OTLP/HTTP (protobuf)**.

### Exportierte Signale

- **Metriken**: Zähler + Histogramme (Token-Nutzung, Nachrichtenfluss, Warteschlangen).
- **Traces**: Spans für Modellnutzung + Webhook-/Nachrichtenverarbeitung.
- **Logs**: werden über OTLP exportiert, wenn `diagnostics.otel.logs` aktiviert ist. Das Log-
  Volumen kann hoch sein; beachten Sie `logging.level` und Exporter-Filter.

### Diagnostik-Ereigniskatalog

Modellnutzung:

- `model.usage`: Tokens, Kosten, Dauer, Kontext, Anbieter/Modell/Kanal, Sitzungs-IDs.

Nachrichtenfluss:

- `webhook.received`: Webhook-Eingang pro Kanal.
- `webhook.processed`: Webhook verarbeitet + Dauer.
- `webhook.error`: Fehler im Webhook-Handler.
- `message.queued`: Nachricht zur Verarbeitung in die Warteschlange gestellt.
- `message.processed`: Ergebnis + Dauer + optionaler Fehler.

Warteschlange + Sitzung:

- `queue.lane.enqueue`: Enqueue in Command-Queue-Lane + Tiefe.
- `queue.lane.dequeue`: Dequeue aus Command-Queue-Lane + Wartezeit.
- `session.state`: Zustandsübergang der Sitzung + Grund.
- `session.stuck`: Warnung „Sitzung festgefahren“ + Alter.
- `run.attempt`: Metadaten zu Run-Retry/-Versuch.
- `diagnostic.heartbeat`: Aggregierte Zähler (Webhooks/Warteschlange/Sitzung).

### Diagnostik aktivieren (ohne Exporter)

Verwenden Sie dies, wenn Sie Diagnostikereignisse für Plugins oder benutzerdefinierte Sinks verfügbar machen möchten:

```json
{
  "diagnostics": {
    "enabled": true
  }
}
```

### Diagnostik-Flags (gezielte Logs)

Verwenden Sie Flags, um zusätzliche, gezielte Debug-Logs zu aktivieren, ohne `logging.level` zu erhöhen.
Flags sind nicht case-sensitiv und unterstützen Wildcards (z. B. `telegram.*` oder `*`).

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

Env-Override (einmalig):

```
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

Hinweise:

- Flag-Logs gehen in die Standard-Logdatei (dieselbe wie `logging.file`).
- Die Ausgabe wird weiterhin gemäß `logging.redactSensitive` redigiert.
- Vollständiger Leitfaden: [/diagnostics/flags](/diagnostics/flags).

### Export zu OpenTelemetry

Diagnostik kann über das `diagnostics-otel`-Plugin (OTLP/HTTP) exportiert werden. Dies
funktioniert mit jedem OpenTelemetry-Collector/Backend, das OTLP/HTTP akzeptiert.

```json
{
  "plugins": {
    "allow": ["diagnostics-otel"],
    "entries": {
      "diagnostics-otel": {
        "enabled": true
      }
    }
  },
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "endpoint": "http://otel-collector:4318",
      "protocol": "http/protobuf",
      "serviceName": "openclaw-gateway",
      "traces": true,
      "metrics": true,
      "logs": true,
      "sampleRate": 0.2,
      "flushIntervalMs": 60000
    }
  }
}
```

Hinweise:

- Sie können das Plugin auch mit `openclaw plugins enable diagnostics-otel` aktivieren.
- `protocol` unterstützt derzeit nur `http/protobuf`. `grpc` wird ignoriert.
- Metriken umfassen Token-Nutzung, Kosten, Kontextgröße, Laufdauer und Zähler/Histogramme
  des Nachrichtenflusses (Webhooks, Warteschlangen, Sitzungszustand, Warteschlangentiefe/-wartezeit).
- Traces/Metriken können mit `traces` / `metrics` umgeschaltet werden (Standard: an). Traces
  umfassen Modellnutzungs-Spans sowie Webhook-/Nachrichtenverarbeitungs-Spans, wenn aktiviert.
- Setzen Sie `headers`, wenn Ihr Collector Authentifizierung erfordert.
- Unterstützte Umgebungsvariablen: `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_PROTOCOL`.

### Exportierte Metriken (Namen + Typen)

Modellnutzung:

- `openclaw.tokens` (Zähler, Attrs: `openclaw.token`, `openclaw.channel`,
  `openclaw.provider`, `openclaw.model`)
- `openclaw.cost.usd` (Zähler, Attrs: `openclaw.channel`, `openclaw.provider`,
  `openclaw.model`)
- `openclaw.run.duration_ms` (Histogramm, Attrs: `openclaw.channel`,
  `openclaw.provider`, `openclaw.model`)
- `openclaw.context.tokens` (Histogramm, Attrs: `openclaw.context`,
  `openclaw.channel`, `openclaw.provider`, `openclaw.model`)

Nachrichtenfluss:

- `openclaw.webhook.received` (Zähler, Attrs: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.webhook.error` (Zähler, Attrs: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.webhook.duration_ms` (Histogramm, Attrs: `openclaw.channel`,
  `openclaw.webhook`)
- `openclaw.message.queued` (Zähler, Attrs: `openclaw.channel`,
  `openclaw.source`)
- `openclaw.message.processed` (Zähler, Attrs: `openclaw.channel`,
  `openclaw.outcome`)
- `openclaw.message.duration_ms` (Histogramm, Attrs: `openclaw.channel`,
  `openclaw.outcome`)

Warteschlangen + Sitzungen:

- `openclaw.queue.lane.enqueue` (Zähler, Attrs: `openclaw.lane`)
- `openclaw.queue.lane.dequeue` (Zähler, Attrs: `openclaw.lane`)
- `openclaw.queue.depth` (Histogramm, Attrs: `openclaw.lane` oder
  `openclaw.channel=heartbeat`)
- `openclaw.queue.wait_ms` (Histogramm, Attrs: `openclaw.lane`)
- `openclaw.session.state` (Zähler, Attrs: `openclaw.state`, `openclaw.reason`)
- `openclaw.session.stuck` (Zähler, Attrs: `openclaw.state`)
- `openclaw.session.stuck_age_ms` (Histogramm, Attrs: `openclaw.state`)
- `openclaw.run.attempt` (Zähler, Attrs: `openclaw.attempt`)

### Exportierte Spans (Namen + Schlüsselattribute)

- `openclaw.model.usage`
  - `openclaw.channel`, `openclaw.provider`, `openclaw.model`
  - `openclaw.sessionKey`, `openclaw.sessionId`
  - `openclaw.tokens.*` (input/output/cache_read/cache_write/total)
- `openclaw.webhook.processed`
  - `openclaw.channel`, `openclaw.webhook`, `openclaw.chatId`
- `openclaw.webhook.error`
  - `openclaw.channel`, `openclaw.webhook`, `openclaw.chatId`,
    `openclaw.error`
- `openclaw.message.processed`
  - `openclaw.channel`, `openclaw.outcome`, `openclaw.chatId`,
    `openclaw.messageId`, `openclaw.sessionKey`, `openclaw.sessionId`,
    `openclaw.reason`
- `openclaw.session.stuck`
  - `openclaw.state`, `openclaw.ageMs`, `openclaw.queueDepth`,
    `openclaw.sessionKey`, `openclaw.sessionId`

### Sampling + Flushen

- Trace-Sampling: `diagnostics.otel.sampleRate` (0,0–1,0, nur Root-Spans).
- Metrik-Exportintervall: `diagnostics.otel.flushIntervalMs` (min. 1000 ms).

### Protokollhinweise

- OTLP/HTTP-Endpunkte können über `diagnostics.otel.endpoint` oder
  `OTEL_EXPORTER_OTLP_ENDPOINT` gesetzt werden.
- Wenn der Endpunkt bereits `/v1/traces` oder `/v1/metrics` enthält, wird er unverändert verwendet.
- Wenn der Endpunkt bereits `/v1/logs` enthält, wird er unverändert für Logs verwendet.
- `diagnostics.otel.logs` aktiviert den OTLP-Logexport für die Haupt-Logger-Ausgabe.

### Verhalten beim Logexport

- OTLP-Logs verwenden dieselben strukturierten Datensätze, die nach `logging.file` geschrieben werden.
- Beachtet `logging.level` (Dateilog-Level). Konsolen-Redaktion gilt **nicht**
  für OTLP-Logs.
- Installationen mit hohem Volumen sollten Sampling/Filterung im OTLP-Collector bevorzugen.

## Tipps zur Fehlerbehebung

- **Gateway nicht erreichbar?** Führen Sie zuerst `openclaw doctor` aus.
- **Logs leer?** Prüfen Sie, dass das Gateway läuft und in den Dateipfad aus
  `logging.file` schreibt.
- **Mehr Details nötig?** Setzen Sie `logging.level` auf `debug` oder `trace` und versuchen Sie es erneut.
