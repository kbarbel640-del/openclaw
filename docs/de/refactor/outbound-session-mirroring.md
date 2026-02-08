---
title: Refaktorierung der Spiegelung ausgehender Sitzungen (Issue #1520)
description: Track outbound session mirroring refactor notes, decisions, tests, and open items.
x-i18n:
  source_path: refactor/outbound-session-mirroring.md
  source_hash: b88a72f36f7b6d8a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:25Z
---

# Refaktorierung der Spiegelung ausgehender Sitzungen (Issue #1520)

## Status

- In Arbeit.
- Core- und Plugin-Kanal-Routing für ausgehende Spiegelung aktualisiert.
- Gateway-Senden leitet nun die Ziel-Sitzung ab, wenn sessionKey weggelassen wird.

## Kontext

Ausgehende Sendungen wurden in die _aktuelle_ Agenten-Sitzung (Werkzeug-Sitzungsschlüssel) gespiegelt, statt in die Zielkanal-Sitzung. Eingehendes Routing verwendet Kanal-/Peer-Sitzungsschlüssel, sodass ausgehende Antworten in der falschen Sitzung landeten und Ziele beim Erstkontakt oft keine Sitzungseinträge hatten.

## Ziele

- Ausgehende Nachrichten in den Sitzungsschlüssel des Zielkanals spiegeln.
- Sitzungseinträge bei ausgehenden Nachrichten erstellen, wenn sie fehlen.
- Thread-/Topic-Scoping an eingehenden Sitzungsschlüsseln ausrichten.
- Core-Kanäle sowie gebündelte Erweiterungen abdecken.

## Implementierungsübersicht

- Neuer Helper für ausgehendes Sitzungsrouting:
  - `src/infra/outbound/outbound-session.ts`
  - `resolveOutboundSessionRoute` erstellt den Ziel-sessionKey mit `buildAgentSessionKey` (dmScope + identityLinks).
  - `ensureOutboundSessionEntry` schreibt minimale `MsgContext` über `recordSessionMetaFromInbound`.
- `runMessageAction` (send) leitet den Ziel-sessionKey ab und übergibt ihn an `executeSendAction` zur Spiegelung.
- `message-tool` spiegelt nicht mehr direkt; es löst nur agentId aus dem aktuellen Sitzungsschlüssel auf.
- Der Plugin-Sendepfad spiegelt über `appendAssistantMessageToSessionTranscript` unter Verwendung des abgeleiteten sessionKey.
- Gateway-Senden leitet einen Ziel-Sitzungsschlüssel ab, wenn keiner bereitgestellt wird (Standard-Agent), und stellt einen Sitzungseintrag sicher.

## Thread-/Topic-Behandlung

- Slack: replyTo/threadId -> `resolveThreadSessionKeys` (Suffix).
- Discord: threadId/replyTo -> `resolveThreadSessionKeys` mit `useSuffix=false`, um eingehend zu entsprechen (Thread-Kanal-ID grenzt die Sitzung bereits ein).
- Telegram: Topic-IDs werden über `buildTelegramGroupPeerId` auf `chatId:topic:<id>` abgebildet.

## Abgedeckte Erweiterungen

- Matrix, MS Teams, Mattermost, BlueBubbles, Nextcloud Talk, Zalo, Zalo Personal, Nostr, Tlon.
- Hinweise:
  - Mattermost-Ziele entfernen nun `@` für das DM-Sitzungsschlüssel-Routing.
  - Zalo Personal verwendet die DM-Peer-Art für 1:1-Ziele (Gruppe nur, wenn `group:` vorhanden ist).
  - BlueBubbles-Gruppenziele entfernen `chat_*`-Präfixe, um eingehenden Sitzungsschlüsseln zu entsprechen.
  - Slack-Auto-Thread-Spiegelung gleicht Kanal-IDs unabhängig von Groß-/Kleinschreibung ab.
  - Gateway-Senden setzt bereitgestellte Sitzungsschlüssel vor der Spiegelung auf Kleinbuchstaben.

## Entscheidungen

- **Ableitung des Gateway-Sende-Sitzungsschlüssels**: Wenn `sessionKey` bereitgestellt wird, verwenden. Wenn weggelassen, einen sessionKey aus Ziel + Standard-Agent ableiten und dorthin spiegeln.
- **Erstellung von Sitzungseinträgen**: Immer `recordSessionMetaFromInbound` mit an eingehende Formate angepasstem `Provider/From/To/ChatType/AccountId/Originating*` verwenden.
- **Zielnormalisierung**: Ausgehendes Routing verwendet aufgelöste Ziele (nach `resolveChannelTarget`), wenn verfügbar.
- **Groß-/Kleinschreibung von Sitzungsschlüsseln**: Sitzungsschlüssel beim Schreiben und während Migrationen kanonisch in Kleinbuchstaben umwandeln.

## Hinzugefügte/Aktualisierte Tests

- `src/infra/outbound/outbound-session.test.ts`
  - Slack-Thread-Sitzungsschlüssel.
  - Telegram-Topic-Sitzungsschlüssel.
  - dmScope identityLinks mit Discord.
- `src/agents/tools/message-tool.test.ts`
  - Leitet agentId aus dem Sitzungsschlüssel ab (kein sessionKey durchgereicht).
- `src/gateway/server-methods/send.test.ts`
  - Leitet den Sitzungsschlüssel ab, wenn er weggelassen wird, und erstellt einen Sitzungseintrag.

## Offene Punkte / Follow-ups

- Das Voice-Call-Plugin verwendet benutzerdefinierte `voice:<phone>`-Sitzungsschlüssel. Das ausgehende Mapping ist hier nicht standardisiert; falls das Message-Tool Voice-Call-Sendungen unterstützen soll, explizites Mapping hinzufügen.
- Bestätigen, ob ein externes Plugin nicht standardisierte `From/To`-Formate jenseits des gebündelten Sets verwendet.

## Geänderte Dateien

- `src/infra/outbound/outbound-session.ts`
- `src/infra/outbound/outbound-send-service.ts`
- `src/infra/outbound/message-action-runner.ts`
- `src/agents/tools/message-tool.ts`
- `src/gateway/server-methods/send.ts`
- Tests in:
  - `src/infra/outbound/outbound-session.test.ts`
  - `src/agents/tools/message-tool.test.ts`
  - `src/gateway/server-methods/send.test.ts`
