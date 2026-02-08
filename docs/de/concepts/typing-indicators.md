---
summary: "Wann OpenClaw Tippindikatoren anzeigt und wie Sie diese abstimmen"
read_when:
  - Ändern des Verhaltens oder der Standardwerte für Tippindikatoren
title: "Tippindikatoren"
x-i18n:
  source_path: concepts/typing-indicators.md
  source_hash: 8ee82d02829c4ff5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:09Z
---

# Tippindikatoren

Tippindikatoren werden an den Chat-Kanal gesendet, während ein Run aktiv ist. Verwenden Sie
`agents.defaults.typingMode`, um zu steuern, **wann** das Tippen beginnt, und `typingIntervalSeconds`,
um zu steuern, **wie oft** es aktualisiert wird.

## Standardwerte

Wenn `agents.defaults.typingMode` **nicht gesetzt** ist, behält OpenClaw das Legacy-Verhalten bei:

- **Direktchats**: Tippen beginnt sofort, sobald der Modell-Loop startet.
- **Gruppenchats mit Erwähnung**: Tippen beginnt sofort.
- **Gruppenchats ohne Erwähnung**: Tippen beginnt erst, wenn der Nachrichtentext zu streamen beginnt.
- **Heartbeat-Runs**: Tippen ist deaktiviert.

## Modi

Setzen Sie `agents.defaults.typingMode` auf einen der folgenden Werte:

- `never` — kein Tippindikator, niemals.
- `instant` — Tippen beginnt **sobald der Modell-Loop startet**, selbst wenn der Run
  später nur das stille Antwort-Token zurückgibt.
- `thinking` — Tippen beginnt beim **ersten Reasoning-Delta** (erfordert
  `reasoningLevel: "stream"` für den Run).
- `message` — Tippen beginnt beim **ersten nicht-stillen Text-Delta** (ignoriert
  das stille `NO_REPLY`-Token).

Reihenfolge nach „wie früh es auslöst“:
`never` → `message` → `thinking` → `instant`

## Konfiguration

```json5
{
  agent: {
    typingMode: "thinking",
    typingIntervalSeconds: 6,
  },
}
```

Sie können Modus oder Takt pro Sitzung überschreiben:

```json5
{
  session: {
    typingMode: "message",
    typingIntervalSeconds: 4,
  },
}
```

## Hinweise

- Der Modus `message` zeigt kein Tippen für ausschließlich stille Antworten (z. B. das `NO_REPLY`-
  Token, das zur Unterdrückung der Ausgabe verwendet wird).
- `thinking` wird nur ausgelöst, wenn der Run Reasoning streamt (`reasoningLevel: "stream"`).
  Wenn das Modell keine Reasoning-Deltas ausgibt, beginnt das Tippen nicht.
- Heartbeats zeigen niemals Tippen an, unabhängig vom Modus.
- `typingIntervalSeconds` steuert die **Aktualisierungsfrequenz**, nicht den Startzeitpunkt.
  Der Standardwert beträgt 6 Sekunden.
