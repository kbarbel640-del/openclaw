---
summary: „Nachrichtenfluss, Sitzungen, Warteschlangen und Sichtbarkeit von Begründungen“
read_when:
  - Erklären, wie eingehende Nachrichten zu Antworten werden
  - Klärung von Sitzungen, Warteschlangenmodi oder Streaming-Verhalten
  - Dokumentation der Sichtbarkeit von Begründungen und deren Nutzungsauswirkungen
title: „Nachrichten“
x-i18n:
  source_path: concepts/messages.md
  source_hash: 32a1b0c50616c550
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:06Z
---

# Nachrichten

Diese Seite führt zusammen, wie OpenClaw eingehende Nachrichten, Sitzungen, Warteschlangen,
Streaming und die Sichtbarkeit von Begründungen verarbeitet.

## Nachrichtenfluss (auf hoher Ebene)

```
Inbound message
  -> routing/bindings -> session key
  -> queue (if a run is active)
  -> agent run (streaming + tools)
  -> outbound replies (channel limits + chunking)
```

Zentrale Stellschrauben befinden sich in der Konfiguration:

- `messages.*` für Präfixe, Warteschlangen und Gruppenverhalten.
- `agents.defaults.*` für Block-Streaming und Chunking-Standards.
- Kanalüberschreibungen (`channels.whatsapp.*`, `channels.telegram.*` usw.) für Limits und Streaming-Schalter.

Siehe [Konfiguration](/gateway/configuration) fuer alle Details.

## Eingehende Deduplizierung

Kanäle können dieselbe Nachricht nach Neuverbindungen erneut zustellen. OpenClaw hält einen
kurzlebigen Cache, der nach Kanal/Konto/Peer/Sitzung/Nachrichten-ID indiziert ist, sodass doppelte
Zustellungen keinen weiteren Agentenlauf auslösen.

## Eingehendes Debouncing

Schnell aufeinanderfolgende Nachrichten vom **gleichen Absender** können über `messages.inbound` zu
einem einzelnen Agenten-Zug zusammengefasst werden. Debouncing ist pro Kanal + Konversation
begrenzt und verwendet die zuletzt empfangene Nachricht für Antwort-Threading/IDs.

Konfiguration (globaler Standard + kanalweise Überschreibungen):

```json5
{
  messages: {
    inbound: {
      debounceMs: 2000,
      byChannel: {
        whatsapp: 5000,
        slack: 1500,
        discord: 1500,
      },
    },
  },
}
```

Hinweise:

- Debouncing gilt für **reine Textnachrichten**; Medien/Anhänge werden sofort durchgereicht.
- Steuerbefehle umgehen das Debouncing, damit sie eigenständig bleiben.

## Sitzungen und Geräte

Sitzungen gehören dem Gateway, nicht den Clients.

- Direktchats werden auf den Hauptsitzungsschlüssel des Agenten zusammengeführt.
- Gruppen/Kanäle erhalten eigene Sitzungsschlüssel.
- Der Sitzungsspeicher und die Transkripte liegen auf dem Gateway-Host.

Mehrere Geräte/Kanäle können derselben Sitzung zugeordnet sein, der Verlauf wird jedoch nicht
vollständig an jeden Client zurücksynchronisiert. Empfehlung: Verwenden Sie für lange
Unterhaltungen ein primäres Gerät, um divergierenden Kontext zu vermeiden. Die Control UI und die
TUI zeigen stets das vom Gateway gestützte Sitzungstranskript an und sind damit die Quelle der
Wahrheit.

Details: [Sitzungsverwaltung](/concepts/session).

## Eingehende Inhalte und Verlaufskontext

OpenClaw trennt den **Prompt-Body** vom **Command-Body**:

- `Body`: Prompt-Text, der an den Agenten gesendet wird. Dieser kann Kanal-Umschläge und
  optionale Verlaufshüllen enthalten.
- `CommandBody`: Rohtext des Benutzers für die Direktiven-/Befehlsauswertung.
- `RawBody`: Legacy-Alias für `CommandBody` (aus Kompatibilitätsgründen beibehalten).

Wenn ein Kanal Verlauf bereitstellt, verwendet er eine gemeinsame Hülle:

- `[Chat messages since your last reply - for context]`
- `[Current message - respond to this]`

Für **Nicht-Direktchats** (Gruppen/Kanäle/Räume) wird der **aktuelle Nachrichteninhalt** mit dem
Absenderlabel vorangestellt (derselbe Stil wie für Verlaufseinträge). Dadurch bleiben Echtzeit-
und warteschlangen-/verlaufsbasierte Nachrichten im Agenten-Prompt konsistent.

Verlaufspuffer sind **nur ausstehend**: Sie enthalten Gruppennachrichten, die _keinen_ Lauf
ausgelöst haben (zum Beispiel nach Erwähnung begrenzte Nachrichten), und **schließen** Nachrichten
aus, die bereits im Sitzungstranskript enthalten sind.

Das Entfernen von Direktiven gilt nur für den Abschnitt der **aktuellen Nachricht**, sodass der
Verlauf intakt bleibt. Kanäle, die Verlauf einbetten, sollten `CommandBody` (oder
`RawBody`) auf den ursprünglichen Nachrichtentext setzen und `Body` als
kombinierten Prompt beibehalten. Verlaufspuffer sind über `messages.groupChat.historyLimit` (globaler Standard)
sowie kanalweise Überschreibungen wie `channels.slack.historyLimit` oder `channels.telegram.accounts.<id>.historyLimit` konfigurierbar
(setzen Sie `0`, um zu deaktivieren).

## Warteschlangen und Follow-ups

Wenn bereits ein Lauf aktiv ist, können eingehende Nachrichten in die Warteschlange gestellt,
in den aktuellen Lauf gelenkt oder für einen Folgezug gesammelt werden.

- Konfiguration über `messages.queue` (und `messages.queue.byChannel`).
- Modi: `interrupt`, `steer`, `followup`, `collect`, plus Backlog-Varianten.

Details: [Warteschlangen](/concepts/queue).

## Streaming, Chunking und Batching

Block-Streaming sendet Teilantworten, während das Modell Textblöcke erzeugt.
Chunking respektiert Kanal-Textlimits und vermeidet das Aufteilen von Codeblöcken.

Zentrale Einstellungen:

- `agents.defaults.blockStreamingDefault` (`on|off`, standardmäßig aus)
- `agents.defaults.blockStreamingBreak` (`text_end|message_end`)
- `agents.defaults.blockStreamingChunk` (`minChars|maxChars|breakPreference`)
- `agents.defaults.blockStreamingCoalesce` (leerlaufbasiertes Batching)
- `agents.defaults.humanDelay` (menschenähnliche Pause zwischen Blockantworten)
- Kanalüberschreibungen: `*.blockStreaming` und `*.blockStreamingCoalesce` (Nicht-Telegram-Kanäle erfordern explizites `*.blockStreaming: true`)

Details: [Streaming + Chunking](/concepts/streaming).

## Sichtbarkeit von Begründungen und Tokens

OpenClaw kann Modellbegründungen ein- oder ausblenden:

- `/reasoning on|off|stream` steuert die Sichtbarkeit.
- Begründungsinhalte zählen weiterhin zur Token-Nutzung, wenn sie vom Modell erzeugt werden.
- Telegram unterstützt das Streamen von Begründungen in die Entwurfsblase.

Details: [Thinking + Reasoning-Direktiven](/tools/thinking) und [Token-Nutzung](/token-use).

## Präfixe, Threading und Antworten

Die Formatierung ausgehender Nachrichten ist in `messages` zentralisiert:

- `messages.responsePrefix`, `channels.<channel>.responsePrefix` und `channels.<channel>.accounts.<id>.responsePrefix` (Kaskade ausgehender Präfixe) sowie `channels.whatsapp.messagePrefix` (WhatsApp-Eingangspräfix)
- Antwort-Threading über `replyToMode` und kanalweise Standards

Details: [Konfiguration](/gateway/configuration#messages) und die Kanaldokumentation.
