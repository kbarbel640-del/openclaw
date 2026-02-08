---
summary: "Zeitzonenbehandlung für Agenten, Umschläge und Prompts"
read_when:
  - Sie müssen verstehen, wie Zeitstempel für das Modell normalisiert werden
  - Konfigurieren der Benutzerzeitzone für System-Prompts
title: "Zeitzonen"
x-i18n:
  source_path: concepts/timezone.md
  source_hash: 9ee809c96897db11
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:09Z
---

# Zeitzonen

OpenClaw standardisiert Zeitstempel, sodass das Modell eine **einheitliche Referenzzeit** sieht.

## Nachrichtenumschläge (standardmäßig lokal)

Eingehende Nachrichten werden in einen Umschlag verpackt wie:

```
[Provider ... 2026-01-05 16:26 PST] message text
```

Der Zeitstempel im Umschlag ist **standardmäßig host-lokal**, mit Minutenpräzision.

Sie können dies überschreiben mit:

```json5
{
  agents: {
    defaults: {
      envelopeTimezone: "local", // "utc" | "local" | "user" | IANA timezone
      envelopeTimestamp: "on", // "on" | "off"
      envelopeElapsed: "on", // "on" | "off"
    },
  },
}
```

- `envelopeTimezone: "utc"` verwendet UTC.
- `envelopeTimezone: "user"` verwendet `agents.defaults.userTimezone` (fällt auf die Host-Zeitzone zurück).
- Verwenden Sie eine explizite IANA-Zeitzone (z. B. `"Europe/Vienna"`) für einen festen Offset.
- `envelopeTimestamp: "off"` entfernt absolute Zeitstempel aus den Umschlag-Headern.
- `envelopeElapsed: "off"` entfernt Suffixe für verstrichene Zeit (der `+2m`‑Stil).

### Beispiele

**Lokal (Standard):**

```
[Signal Alice +1555 2026-01-18 00:19 PST] hello
```

**Feste Zeitzone:**

```
[Signal Alice +1555 2026-01-18 06:19 GMT+1] hello
```

**Verstrichene Zeit:**

```
[Signal Alice +1555 +2m 2026-01-18T05:19Z] follow-up
```

## Tool-Payloads (rohe Anbieterdaten + normalisierte Felder)

Tool-Aufrufe (`channels.discord.readMessages`, `channels.slack.readMessages` usw.) geben **rohe Zeitstempel des Anbieters** zurück.
Zusätzlich hängen wir normalisierte Felder zur Konsistenz an:

- `timestampMs` (UTC-Epoch-Millisekunden)
- `timestampUtc` (ISO‑8601‑UTC‑String)

Rohe Anbieterfelder bleiben erhalten.

## Benutzerzeitzone für den System-Prompt

Setzen Sie `agents.defaults.userTimezone`, um dem Modell die lokale Zeitzone des Benutzers mitzuteilen. Ist sie
nicht gesetzt, ermittelt OpenClaw die **Host-Zeitzone zur Laufzeit** (kein Konfigurationsschreiben).

```json5
{
  agents: { defaults: { userTimezone: "America/Chicago" } },
}
```

Der System-Prompt enthält:

- den Abschnitt `Current Date & Time` mit lokaler Zeit und Zeitzone
- `Time format: 12-hour` oder `24-hour`

Sie können das Prompt-Format mit `agents.defaults.timeFormat` steuern (`auto` | `12` | `24`).

Siehe [Date & Time](/date-time) für das vollständige Verhalten und Beispiele.
