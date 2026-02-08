---
summary: "Routing-Regeln pro Kanal (WhatsApp, Telegram, Discord, Slack) und geteilter Kontext"
read_when:
  - Aendern des Kanal-Routings oder des Inbox-Verhaltens
title: "Kanal-Routing"
x-i18n:
  source_path: concepts/channel-routing.md
  source_hash: 1a322b5187e32c82
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:58Z
---

# Kanaele & Routing

OpenClaw leitet Antworten **zurueck an den Kanal, aus dem eine Nachricht stammt**. Das
Modell waehlt keinen Kanal; das Routing ist deterministisch und wird durch die
Host-Konfiguration gesteuert.

## Zentrale Begriffe

- **Kanal**: `whatsapp`, `telegram`, `discord`, `slack`, `signal`, `imessage`, `webchat`.
- **AccountId**: kanalbezogene Konto-Instanz (falls unterstuetzt).
- **AgentId**: ein isolierter Arbeitsbereich + Sitzungsspeicher („Gehirn“).
- **SessionKey**: der Bucket-Schluessel zum Speichern des Kontexts und zur Steuerung der Nebenlaeufigkeit.

## Formen von Session-Keys (Beispiele)

Direktnachrichten werden zur **Haupt**-Sitzung des Agenten zusammengefasst:

- `agent:<agentId>:<mainKey>` (Standard: `agent:main:main`)

Gruppen und Kanaele bleiben pro Kanal isoliert:

- Gruppen: `agent:<agentId>:<channel>:group:<id>`
- Kanaele/Raeume: `agent:<agentId>:<channel>:channel:<id>`

Threads:

- Slack/Discord-Threads haengen `:thread:<threadId>` an den Basis-Key an.
- Telegram-Forenthemen betten `:topic:<topicId>` in den Gruppen-Key ein.

Beispiele:

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## Routing-Regeln (wie ein Agent ausgewaehlt wird)

Das Routing waehlt **einen Agenten** fuer jede eingehende Nachricht:

1. **Exakter Peer-Match** (`bindings` mit `peer.kind` + `peer.id`).
2. **Guild-Match** (Discord) ueber `guildId`.
3. **Team-Match** (Slack) ueber `teamId`.
4. **Account-Match** (`accountId` auf dem Kanal).
5. **Kanal-Match** (beliebiges Konto auf diesem Kanal).
6. **Standard-Agent** (`agents.list[].default`, sonst erster Listeneintrag, Fallback zu `main`).

Der gefundene Agent bestimmt, welcher Arbeitsbereich und welcher Sitzungsspeicher verwendet werden.

## Broadcast-Gruppen (mehrere Agenten ausfuehren)

Broadcast-Gruppen ermoeglichen es, **mehrere Agenten** fuer denselben Peer auszufuehren,
**wenn OpenClaw normalerweise antworten wuerde** (zum Beispiel: in WhatsApp-Gruppen, nach Mention-/Aktivierungs-Gating).

Konfiguration:

```json5
{
  broadcast: {
    strategy: "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"],
    "+15555550123": ["support", "logger"],
  },
}
```

Siehe: [Broadcast Groups](/broadcast-groups).

## Konfigurationsuebersicht

- `agents.list`: benannte Agenten-Definitionen (Arbeitsbereich, Modell usw.).
- `bindings`: Zuordnung eingehender Kanaele/Konten/Peers zu Agenten.

Beispiel:

```json5
{
  agents: {
    list: [{ id: "support", name: "Support", workspace: "~/.openclaw/workspace-support" }],
  },
  bindings: [
    { match: { channel: "slack", teamId: "T123" }, agentId: "support" },
    { match: { channel: "telegram", peer: { kind: "group", id: "-100123" } }, agentId: "support" },
  ],
}
```

## Sitzungsspeicherung

Sitzungsspeicher liegen unter dem Statusverzeichnis (Standard `~/.openclaw`):

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- JSONL-Transkripte liegen neben dem Speicher

Sie koennen den Speicherpfad ueber `session.store` und `{agentId}`-Templating ueberschreiben.

## WebChat-Verhalten

WebChat verbindet sich mit dem **ausgewaehlten Agenten** und verwendet standardmaessig
die Hauptsitzung des Agenten. Dadurch ermoeglicht WebChat, den kanaluebergreifenden Kontext
dieses Agenten an einem Ort zu sehen.

## Antwortkontext

Eingehende Antworten enthalten:

- `ReplyToId`, `ReplyToBody` und `ReplyToSender`, sofern verfuegbar.
- Zitierter Kontext wird als `[Replying to ...]`-Block an `Body` angehaengt.

Dies ist ueber alle Kanaele hinweg konsistent.
