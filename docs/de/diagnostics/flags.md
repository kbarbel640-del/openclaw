---
summary: "Diagnose-Flags für gezielte Debug-Logs"
read_when:
  - Sie benötigen gezielte Debug-Logs, ohne globale Logging-Stufen zu erhöhen
  - Sie müssen subsystem-spezifische Logs für den Support erfassen
title: "Diagnose-Flags"
x-i18n:
  source_path: diagnostics/flags.md
  source_hash: daf0eca0e6bd1cbc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:14Z
---

# Diagnose-Flags

Diagnose-Flags ermöglichen es Ihnen, gezielte Debug-Logs zu aktivieren, ohne überall ausführliches Logging einzuschalten. Flags sind optional (Opt-in) und haben keine Wirkung, sofern ein Subsystem sie nicht prüft.

## Funktionsweise

- Flags sind Zeichenketten (Groß-/Kleinschreibung wird ignoriert).
- Sie können Flags in der Konfiguration oder per Umgebungsvariablen-Override aktivieren.
- Platzhalter (Wildcards) werden unterstützt:
  - `telegram.*` passt auf `telegram.http`
  - `*` aktiviert alle Flags

## Aktivieren über die Konfiguration

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

Mehrere Flags:

```json
{
  "diagnostics": {
    "flags": ["telegram.http", "gateway.*"]
  }
}
```

Starten Sie das Gateway nach dem Ändern der Flags neu.

## Umgebungsvariablen-Override (einmalig)

```bash
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

Alle Flags deaktivieren:

```bash
OPENCLAW_DIAGNOSTICS=0
```

## Ziel der Logs

Flags schreiben Logs in die standardmäßige Diagnose-Logdatei. Standardmäßig:

```
/tmp/openclaw/openclaw-YYYY-MM-DD.log
```

Wenn Sie `logging.file` setzen, wird stattdessen dieser Pfad verwendet. Logs sind im JSONL-Format (ein JSON-Objekt pro Zeile). Die Maskierung (Redaction) gilt weiterhin gemäß `logging.redactSensitive`.

## Logs extrahieren

Wählen Sie die neueste Logdatei aus:

```bash
ls -t /tmp/openclaw/openclaw-*.log | head -n 1
```

Nach Telegram-HTTP-Diagnosen filtern:

```bash
rg "telegram http error" /tmp/openclaw/openclaw-*.log
```

Oder beim Reproduzieren live verfolgen:

```bash
tail -f /tmp/openclaw/openclaw-$(date +%F).log | rg "telegram http error"
```

Für entfernte Gateways können Sie außerdem `openclaw logs --follow` verwenden (siehe [/cli/logs](/cli/logs)).

## Hinweise

- Wenn `logging.level` höher gesetzt ist als `warn`, können diese Logs unterdrückt werden. Der Standardwert `info` ist ausreichend.
- Flags können bedenkenlos aktiviert bleiben; sie beeinflussen lediglich das Log-Volumen des jeweiligen Subsystems.
- Verwenden Sie [/logging](/logging), um Log-Ziele, -Stufen und Maskierung zu ändern.
