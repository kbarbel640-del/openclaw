---
summary: „Wiederholungsrichtlinie für ausgehende Anbieteraufrufe“
read_when:
  - Aktualisieren des Wiederholungsverhaltens oder der Standardwerte des Anbieters
  - Debuggen von Anbieter-Sendefehlern oder Ratenbegrenzungen
title: „Wiederholungsrichtlinie“
x-i18n:
  source_path: concepts/retry.md
  source_hash: 55bb261ff567f46c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:59Z
---

# Wiederholungsrichtlinie

## Ziele

- Wiederholung pro HTTP-Anfrage, nicht pro mehrstufigem Ablauf.
- Reihenfolge bewahren, indem nur der aktuelle Schritt wiederholt wird.
- Duplizierung nicht-idempotenter Operationen vermeiden.

## Standardwerte

- Versuche: 3
- Maximale Verzögerungsobergrenze: 30000 ms
- Jitter: 0,1 (10 Prozent)
- Anbieter-Standardwerte:
  - Telegram Mindestverzögerung: 400 ms
  - Discord Mindestverzögerung: 500 ms

## Verhalten

### Discord

- Wiederholt nur bei Rate-Limit-Fehlern (HTTP 429).
- Verwendet `retry_after`, wenn verfügbar, andernfalls exponentielles Backoff.

### Telegram

- Wiederholt bei transienten Fehlern (429, Timeout, Connect/Reset/Closed, vorübergehend nicht verfügbar).
- Verwendet `retry_after`, wenn verfügbar, andernfalls exponentielles Backoff.
- Markdown-Parsefehler werden nicht wiederholt; stattdessen erfolgt ein Fallback auf Klartext.

## Konfiguration

Legen Sie die Wiederholungsrichtlinie pro Anbieter in `~/.openclaw/openclaw.json` fest:

```json5
{
  channels: {
    telegram: {
      retry: {
        attempts: 3,
        minDelayMs: 400,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
    discord: {
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

## Hinweise

- Wiederholungen gelten pro Anfrage (Nachrichtenversand, Medien-Upload, Reaktion, Umfrage, Sticker).
- Zusammengesetzte Abläufe wiederholen keine bereits abgeschlossenen Schritte.
