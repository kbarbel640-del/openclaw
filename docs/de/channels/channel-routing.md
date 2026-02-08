---
summary: „Routing-Regeln pro Kanal (WhatsApp, Telegram, Discord, Slack) und gemeinsam genutzter Kontext“
read_when:
  - „Ändern des Kanal-Routings oder des Inbox-Verhaltens“
title: „Kanal-Routing“
x-i18n:
  source_path: channels/channel-routing.md
  source_hash: cfc2cade2984225d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:48Z
---

# Kanäle & Routing

OpenClaw leitet Antworten **zurück an den Kanal, aus dem eine Nachricht stammt**. Das
Modell wählt keinen Kanal aus; das Routing ist deterministisch und wird durch die
Host‑Konfiguration gesteuert.

## Zentrale Begriffe

- **Kanal**: `whatsapp`, `telegram`, `discord`, `slack`, `signal`, `imessage`, `webchat`.
- **AccountId**: kanalbezogene Account‑Instanz (sofern unterstützt).
- **AgentId**: ein isolierter Arbeitsbereich + Sitzungsspeicher („Gehirn“).
- **SessionKey**: der Bucket‑Schlüssel zum Speichern von Kontext und zur Steuerung der Nebenläufigkeit.

## Session‑Key‑Formen (Beispiele)

Direktnachrichten werden zur **Haupt**‑Sitzung des Agenten zusammengeführt:

- `agent:<agentId>:<mainKey>` (Standard: `agent:main:main`)

Gruppen und Kanäle bleiben pro Kanal isoliert:

- Gruppen: `agent:<agentId>:<channel>:group:<id>`
- Kanäle/Räume: `agent:<agentId>:<channel>:channel:<id>`

Threads:

- Slack/Discord‑Threads hängen `:thread:<threadId>` an den Basisschlüssel an.
- Telegram‑Foren‑Themen betten `:topic:<topicId>` in den Gruppenschlüssel ein.

Beispiele:

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## Routing‑Regeln (wie ein Agent ausgewählt wird)

Das Routing wählt **einen Agenten** für jede eingehende Nachricht aus:

1. **Exakte Peer‑Übereinstimmung** (`bindings` mit `peer.kind` + `peer.id`).
2. **Guild‑Übereinstimmung** (Discord) über `guildId`.
3. **Team‑Übereinstimmung** (Slack) über `teamId`.
4. **Account‑Übereinstimmung** (`accountId` auf dem Kanal).
5. **Kanal‑Übereinstimmung** (beliebiger Account auf diesem Kanal).
6. **Standard‑Agent** (`agents.list[].default`, andernfalls erster Listeneintrag, Fallback zu `main`).

Der gefundene Agent bestimmt, welcher Arbeitsbereich und welcher Sitzungsspeicher verwendet werden.

## Broadcast‑Gruppen (mehrere Agenten ausführen)

Broadcast‑Gruppen ermöglichen es, **mehrere Agenten** für denselben Peer auszuführen, **wenn OpenClaw normalerweise antworten würde** (zum Beispiel: in WhatsApp‑Gruppen, nach Erwähnungs‑/Aktivierungs‑Gating).

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

Siehe: [Broadcast Groups](/channels/broadcast-groups).

## Konfigurationsübersicht

- `agents.list`: benannte Agent‑Definitionen (Arbeitsbereich, Modell usw.).
- `bindings`: Zuordnung eingehender Kanäle/Accounts/Peers zu Agenten.

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

## Sitzungsspeicher

Sitzungsspeicher liegen unter dem State‑Verzeichnis (Standard `~/.openclaw`):

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- JSONL‑Transkripte liegen neben dem Speicher

Sie können den Speicherpfad über `session.store` und `{agentId}`‑Templating überschreiben.

## WebChat‑Verhalten

WebChat verbindet sich mit dem **ausgewählten Agenten** und verwendet standardmäßig
die Hauptsitzung des Agenten. Dadurch können Sie in WebChat kanalübergreifenden Kontext
für diesen Agenten an einem Ort einsehen.

## Antwortkontext

Eingehende Antworten enthalten:

- `ReplyToId`, `ReplyToBody` und `ReplyToSender`, sofern verfügbar.
- Zitierter Kontext wird als `[Replying to ...]`‑Block an `Body` angehängt.

Dies ist kanalübergreifend konsistent.
