---
summary: "Streaming- und Chunking-Verhalten (Block-Antworten, Draft-Streaming, Limits)"
read_when:
  - Erklären, wie Streaming oder Chunking auf Kanälen funktioniert
  - Ändern des Block-Streamings oder des Channel-Chunking-Verhaltens
  - Debuggen von doppelten/frühen Block-Antworten oder Draft-Streaming
title: "Streaming und Chunking"
x-i18n:
  source_path: concepts/streaming.md
  source_hash: f014eb1898c4351b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:17Z
---

# Streaming + Chunking

OpenClaw hat zwei separate „Streaming“-Ebenen:

- **Block-Streaming (Kanäle):** gibt abgeschlossene **Blöcke** aus, während der Assistent schreibt. Dies sind normale Kanalnachrichten (keine Token-Deltas).
- **Token-artiges Streaming (nur Telegram):** aktualisiert eine **Draft-Blase** mit Teiltext während der Generierung; die finale Nachricht wird am Ende gesendet.

Es gibt derzeit **kein echtes Token-Streaming** zu externen Kanalnachrichten. Telegram-Draft-Streaming ist die einzige Oberfläche für Teil-Streaming.

## Block-Streaming (Kanalnachrichten)

Block-Streaming sendet Assistenten-Ausgaben in groben Chunks, sobald sie verfügbar sind.

```
Model output
  └─ text_delta/events
       ├─ (blockStreamingBreak=text_end)
       │    └─ chunker emits blocks as buffer grows
       └─ (blockStreamingBreak=message_end)
            └─ chunker flushes at message_end
                   └─ channel send (block replies)
```

Legende:

- `text_delta/events`: Modell-Stream-Ereignisse (können bei nicht streamenden Modellen spärlich sein).
- `chunker`: `EmbeddedBlockChunker` unter Anwendung von Minimal-/Maximalgrenzen + Umbruchpräferenz.
- `channel send`: tatsächliche ausgehende Nachrichten (Block-Antworten).

**Steuerungen:**

- `agents.defaults.blockStreamingDefault`: `"on"`/`"off"` (standardmäßig aus).
- Kanal-Overrides: `*.blockStreaming` (und Varianten pro Account), um `"on"`/`"off"` pro Kanal zu erzwingen.
- `agents.defaults.blockStreamingBreak`: `"text_end"` oder `"message_end"`.
- `agents.defaults.blockStreamingChunk`: `{ minChars, maxChars, breakPreference? }`.
- `agents.defaults.blockStreamingCoalesce`: `{ minChars?, maxChars?, idleMs? }` (gestreamte Blöcke vor dem Senden zusammenführen).
- Harte Kanalobergrenze: `*.textChunkLimit` (z. B. `channels.whatsapp.textChunkLimit`).
- Kanal-Chunk-Modus: `*.chunkMode` (`length` Standard, `newline` teilt an Leerzeilen (Absatzgrenzen) vor dem Längen-Chunking).
- Discord-Soft-Cap: `channels.discord.maxLinesPerMessage` (Standard 17) teilt hohe Antworten, um UI-Clipping zu vermeiden.

**Grenzsemantik:**

- `text_end`: streamt Blöcke, sobald der Chunker ausgibt; Flush bei jedem `text_end`.
- `message_end`: wartet, bis die Assistenten-Nachricht abgeschlossen ist, und flusht dann den gepufferten Output.

`message_end` nutzt weiterhin den Chunker, wenn der gepufferte Text `maxChars` überschreitet, sodass am Ende mehrere Chunks ausgegeben werden können.

## Chunking-Algorithmus (Low-/High-Bounds)

Block-Chunking wird durch `EmbeddedBlockChunker` implementiert:

- **Low Bound:** nicht ausgeben, bis der Puffer >= `minChars` ist (außer erzwungen).
- **High Bound:** bevorzugt Splits vor `maxChars`; wenn erzwungen, Split bei `maxChars`.
- **Umbruchpräferenz:** `paragraph` → `newline` → `sentence` → `whitespace` → harter Umbruch.
- **Code-Fences:** niemals innerhalb von Fences splitten; wenn bei `maxChars` erzwungen, Fence schließen + erneut öffnen, um gültiges Markdown zu erhalten.

`maxChars` wird auf das Kanal-`textChunkLimit` begrenzt, sodass pro Kanal definierte Caps nicht überschritten werden können.

## Koaleszieren (gestreamte Blöcke zusammenführen)

Wenn Block-Streaming aktiviert ist, kann OpenClaw **aufeinanderfolgende Block-Chunks zusammenführen**
bevor sie gesendet werden. Das reduziert „Single-Line-Spam“ und liefert dennoch
progressive Ausgaben.

- Koaleszieren wartet auf **Leerlaufpausen** (`idleMs`) vor dem Flush.
- Puffer sind durch `maxChars` begrenzt und flushen, wenn sie diese überschreiten.
- `minChars` verhindert das Senden winziger Fragmente, bis genügend Text akkumuliert
  ist (der finale Flush sendet immer den verbleibenden Text).
- Der Verbinder wird aus `blockStreamingChunk.breakPreference` abgeleitet
  (`paragraph` → `\n\n`, `newline` → `\n`, `sentence` → Leerzeichen).
- Kanal-Overrides sind über `*.blockStreamingCoalesce` verfügbar (einschließlich Konfigurationen pro Account).
- Der Standardwert für Koaleszieren `minChars` wird für Signal/Slack/Discord auf 1500 erhöht, sofern nicht überschrieben.

## Menschlich wirkendes Tempo zwischen Blöcken

Wenn Block-Streaming aktiviert ist, können Sie eine **randomisierte Pause** zwischen
Block-Antworten hinzufügen (nach dem ersten Block). Dadurch wirken Antworten mit mehreren Blasen
natürlicher.

- Konfiguration: `agents.defaults.humanDelay` (Override pro Agent über `agents.list[].humanDelay`).
- Modi: `off` (Standard), `natural` (800–2500 ms), `custom` (`minMs`/`maxMs`).
- Gilt nur für **Block-Antworten**, nicht für finale Antworten oder Tool-Zusammenfassungen.

## „Chunks streamen oder alles“

Dies bildet ab auf:

- **Chunks streamen:** `blockStreamingDefault: "on"` + `blockStreamingBreak: "text_end"` (ausgeben während der Generierung). Nicht-Telegram-Kanäle benötigen zusätzlich `*.blockStreaming: true`.
- **Alles am Ende streamen:** `blockStreamingBreak: "message_end"` (einmal flushen, ggf. mehrere Chunks bei sehr langen Texten).
- **Kein Block-Streaming:** `blockStreamingDefault: "off"` (nur finale Antwort).

**Kanalhinweis:** Für Nicht-Telegram-Kanäle ist Block-Streaming **aus, sofern nicht**
`*.blockStreaming` explizit auf `true` gesetzt ist. Telegram kann Drafts streamen
(`channels.telegram.streamMode`) ohne Block-Antworten.

Erinnerung zum Konfigurationsort: Die Standardwerte von `blockStreaming*` liegen unter
`agents.defaults`, nicht in der Root-Konfiguration.

## Telegram-Draft-Streaming (token-artig)

Telegram ist der einzige Kanal mit Draft-Streaming:

- Verwendet die Bot-API `sendMessageDraft` in **Privatchats mit Topics**.
- `channels.telegram.streamMode: "partial" | "block" | "off"`.
  - `partial`: Draft-Updates mit dem neuesten Stream-Text.
  - `block`: Draft-Updates in gechunkten Blöcken (gleiche Chunker-Regeln).
  - `off`: kein Draft-Streaming.
- Draft-Chunk-Konfiguration (nur für `streamMode: "block"`): `channels.telegram.draftChunk` (Standardwerte: `minChars: 200`, `maxChars: 800`).
- Draft-Streaming ist getrennt vom Block-Streaming; Block-Antworten sind standardmäßig aus und werden auf Nicht-Telegram-Kanälen nur durch `*.blockStreaming: true` aktiviert.
- Die finale Antwort ist weiterhin eine normale Nachricht.
- `/reasoning stream` schreibt Begründungen in die Draft-Blase (nur Telegram).

Wenn Draft-Streaming aktiv ist, deaktiviert OpenClaw das Block-Streaming für diese Antwort, um Doppel-Streaming zu vermeiden.

```
Telegram (private + topics)
  └─ sendMessageDraft (draft bubble)
       ├─ streamMode=partial → update latest text
       └─ streamMode=block   → chunker updates draft
  └─ final reply → normal message
```

Legende:

- `sendMessageDraft`: Telegram-Draft-Blase (keine echte Nachricht).
- `final reply`: normales Senden einer Telegram-Nachricht.
