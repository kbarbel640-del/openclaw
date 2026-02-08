---
summary: „Verhalten von Gruppenchats über Oberflächen hinweg (WhatsApp/Telegram/Discord/Slack/Signal/iMessage/Microsoft Teams)“
read_when:
  - Ändern des Verhaltens von Gruppenchats oder der Erwähnungs-Gating-Regeln
title: „Gruppen“
x-i18n:
  source_path: channels/groups.md
  source_hash: 5380e07ea01f4a8f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:02Z
---

# Gruppen

OpenClaw behandelt Gruppenchats über alle Oberflächen hinweg konsistent: WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Microsoft Teams.

## Einführung für Einsteiger (2 Minuten)

OpenClaw „lebt“ auf Ihren eigenen Messaging-Konten. Es gibt keinen separaten WhatsApp-Bot-Benutzer.
Wenn **Sie** in einer Gruppe sind, kann OpenClaw diese Gruppe sehen und dort antworten.

Standardverhalten:

- Gruppen sind eingeschränkt (`groupPolicy: "allowlist"`).
- Antworten erfordern eine Erwähnung, sofern Sie das Erwähnungs-Gating nicht explizit deaktivieren.

Übersetzung: freigegebene Absender können OpenClaw durch Erwähnen auslösen.

> TL;DR
>
> - **Direktnachrichten-Zugriff** wird durch `*.allowFrom` gesteuert.
> - **Gruppenzugriff** wird durch `*.groupPolicy` + Allowlisten (`*.groups`, `*.groupAllowFrom`) gesteuert.
> - **Antwortauslösung** wird durch Erwähnungs-Gating gesteuert (`requireMention`, `/activation`).

Schneller Ablauf (was mit einer Gruppennachricht passiert):

```
groupPolicy? disabled -> drop
groupPolicy? allowlist -> group allowed? no -> drop
requireMention? yes -> mentioned? no -> store for context only
otherwise -> reply
```

![Ablauf von Gruppennachrichten](/images/groups-flow.svg)

Wenn Sie möchten …

| Ziel                                                       | Was einzustellen ist                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| Alle Gruppen erlauben, aber nur bei @Erwähnungen antworten | `groups: { "*": { requireMention: true } }`                |
| Alle Gruppenantworten deaktivieren                         | `groupPolicy: "disabled"`                                  |
| Nur bestimmte Gruppen                                      | `groups: { "<group-id>": { ... } }` (kein Schlüssel `"*"`) |
| Nur Sie können in Gruppen auslösen                         | `groupPolicy: "allowlist"`, `groupAllowFrom: ["+1555..."]` |

## Sitzungsschlüssel

- Gruppensitzungen verwenden Sitzungsschlüssel `agent:<agentId>:<channel>:group:<id>` (Räume/Kanäle verwenden `agent:<agentId>:<channel>:channel:<id>`).
- Telegram-Forenthemen fügen `:topic:<threadId>` zur Gruppen-ID hinzu, sodass jedes Thema eine eigene Sitzung hat.
- Direktchats verwenden die Hauptsitzung (oder pro Absender, wenn konfiguriert).
- Heartbeats werden für Gruppensitzungen übersprungen.

## Muster: persönliche Direktnachrichten + öffentliche Gruppen (einzelner Agent)

Ja — das funktioniert gut, wenn Ihr „persönlicher“ Verkehr aus **Direktnachrichten** und Ihr „öffentlicher“ Verkehr aus **Gruppen** besteht.

Warum: Im Einzelagentenmodus landen Direktnachrichten typischerweise in der **Haupt**-Sitzung (`agent:main:main`), während Gruppen immer **nicht‑Haupt**-Sitzungsschlüssel verwenden (`agent:main:<channel>:group:<id>`). Wenn Sie Sandboxing mit `mode: "non-main"` aktivieren, laufen diese Gruppensitzungen in Docker, während Ihre Haupt‑Direktnachrichten-Sitzung auf dem Host bleibt.

Das ergibt ein Agenten-„Gehirn“ (gemeinsamer Workspace + Speicher), aber zwei Ausführungsarten:

- **Direktnachrichten**: volle Werkzeuge (Host)
- **Gruppen**: Sandbox + eingeschränkte Werkzeuge (Docker)

> Wenn Sie wirklich getrennte Workspaces/Personas benötigen („persönlich“ und „öffentlich“ dürfen sich niemals mischen), verwenden Sie einen zweiten Agenten + Bindings. Siehe [Multi-Agent Routing](/concepts/multi-agent).

Beispiel (Direktnachrichten auf dem Host, Gruppen in der Sandbox + nur Messaging-Werkzeuge):

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // groups/channels are non-main -> sandboxed
        scope: "session", // strongest isolation (one container per group/channel)
        workspaceAccess: "none",
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        // If allow is non-empty, everything else is blocked (deny still wins).
        allow: ["group:messaging", "group:sessions"],
        deny: ["group:runtime", "group:fs", "group:ui", "nodes", "cron", "gateway"],
      },
    },
  },
}
```

Möchten Sie „Gruppen dürfen nur Ordner X sehen“ statt „kein Host-Zugriff“? Behalten Sie `workspaceAccess: "none"` bei und mounten Sie nur freigegebene Pfade in die Sandbox:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
        docker: {
          binds: [
            // hostPath:containerPath:mode
            "~/FriendsShared:/data:ro",
          ],
        },
      },
    },
  },
}
```

Verwandt:

- Konfigurationsschlüssel und Standardwerte: [Gateway-Konfiguration](/gateway/configuration#agentsdefaultssandbox)
- Debugging, warum ein Werkzeug blockiert ist: [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)
- Details zu Bind-Mounts: [Sandboxing](/gateway/sandboxing#custom-bind-mounts)

## Anzeige-Labels

- UI-Labels verwenden `displayName`, wenn verfügbar, formatiert als `<channel>:<token>`.
- `#room` ist für Räume/Kanäle reserviert; Gruppenchats verwenden `g-<slug>` (kleingeschrieben, Leerzeichen → `-`, `#@+._-` beibehalten).

## Gruppenrichtlinie

Steuern Sie, wie Gruppen-/Raumnachrichten pro Kanal behandelt werden:

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "disabled", // "open" | "disabled" | "allowlist"
      groupAllowFrom: ["+15551234567"],
    },
    telegram: {
      groupPolicy: "disabled",
      groupAllowFrom: ["123456789", "@username"],
    },
    signal: {
      groupPolicy: "disabled",
      groupAllowFrom: ["+15551234567"],
    },
    imessage: {
      groupPolicy: "disabled",
      groupAllowFrom: ["chat_id:123"],
    },
    msteams: {
      groupPolicy: "disabled",
      groupAllowFrom: ["user@org.com"],
    },
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        GUILD_ID: { channels: { help: { allow: true } } },
      },
    },
    slack: {
      groupPolicy: "allowlist",
      channels: { "#general": { allow: true } },
    },
    matrix: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["@owner:example.org"],
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
    },
  },
}
```

| Richtlinie    | Verhalten                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| `"open"`      | Gruppen umgehen Allowlisten; Erwähnungs-Gating gilt weiterhin.            |
| `"disabled"`  | Alle Gruppennachrichten vollständig blockieren.                           |
| `"allowlist"` | Nur Gruppen/Räume zulassen, die der konfigurierten Allowlist entsprechen. |

Hinweise:

- `groupPolicy` ist getrennt vom Erwähnungs-Gating (das @Erwähnungen erfordert).
- WhatsApp/Telegram/Signal/iMessage/Microsoft Teams: verwenden Sie `groupAllowFrom` (Fallback: explizites `allowFrom`).
- Discord: Allowlist verwendet `channels.discord.guilds.<id>.channels`.
- Slack: Allowlist verwendet `channels.slack.channels`.
- Matrix: Allowlist verwendet `channels.matrix.groups` (Raum-IDs, Aliase oder Namen). Verwenden Sie `channels.matrix.groupAllowFrom`, um Absender einzuschränken; per Raum sind auch `users`-Allowlisten unterstützt.
- Gruppen-Direktnachrichten werden separat gesteuert (`channels.discord.dm.*`, `channels.slack.dm.*`).
- Telegram-Allowlisten können Benutzer-IDs (`"123456789"`, `"telegram:123456789"`, `"tg:123456789"`) oder Benutzernamen (`"@alice"` oder `"alice"`) abgleichen; Präfixe sind nicht groß-/kleinschreibungssensitiv.
- Standard ist `groupPolicy: "allowlist"`; wenn Ihre Gruppen-Allowlist leer ist, werden Gruppennachrichten blockiert.

Schnelles mentales Modell (Auswertungsreihenfolge für Gruppennachrichten):

1. `groupPolicy` (open/disabled/allowlist)
2. Gruppen-Allowlisten (`*.groups`, `*.groupAllowFrom`, kanalspezifische Allowlist)
3. Erwähnungs-Gating (`requireMention`, `/activation`)

## Erwähnungs-Gating (Standard)

Gruppennachrichten erfordern eine Erwähnung, sofern dies nicht pro Gruppe überschrieben wird. Standardwerte liegen pro Subsystem unter `*.groups."*"`.

Das Antworten auf eine Bot-Nachricht zählt als implizite Erwähnung (wenn der Kanal Antwort-Metadaten unterstützt). Dies gilt für Telegram, WhatsApp, Slack, Discord und Microsoft Teams.

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
        "123@g.us": { requireMention: false },
      },
    },
    telegram: {
      groups: {
        "*": { requireMention: true },
        "123456789": { requireMention: false },
      },
    },
    imessage: {
      groups: {
        "*": { requireMention: true },
        "123": { requireMention: false },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          mentionPatterns: ["@openclaw", "openclaw", "\\+15555550123"],
          historyLimit: 50,
        },
      },
    ],
  },
}
```

Hinweise:

- `mentionPatterns` sind nicht groß-/kleinschreibungssensitive Regexe.
- Oberflächen mit expliziten Erwähnungen werden weiterhin durchgelassen; Muster dienen als Fallback.
- Pro-Agent-Override: `agents.list[].groupChat.mentionPatterns` (nützlich, wenn mehrere Agenten eine Gruppe teilen).
- Erwähnungs-Gating wird nur erzwungen, wenn eine Erwähnungserkennung möglich ist (native Erwähnungen oder konfigurierte `mentionPatterns`).
- Discord-Standards liegen in `channels.discord.guilds."*"` (pro Guild/Kanal überschreibbar).
- Der Gruppenkontext-Verlauf wird kanalübergreifend einheitlich verpackt und ist **nur ausstehend** (Nachrichten, die wegen Erwähnungs-Gating übersprungen wurden); verwenden Sie `messages.groupChat.historyLimit` für den globalen Standard und `channels.<channel>.historyLimit` (oder `channels.<channel>.accounts.*.historyLimit`) für Overrides. Setzen Sie `0`, um dies zu deaktivieren.

## Gruppen-/Kanal-Werkzeugeinschränkungen (optional)

Einige Kanal-Konfigurationen unterstützen das Einschränken, welche Werkzeuge **innerhalb einer bestimmten Gruppe/eines Raums/eines Kanals** verfügbar sind.

- `tools`: Werkzeuge für die gesamte Gruppe erlauben/verbieten.
- `toolsBySender`: Pro-Absender-Overrides innerhalb der Gruppe (Schlüssel sind Absender-IDs/Benutzernamen/E-Mail-Adressen/Tel.-Nummern je nach Kanal). Verwenden Sie `"*"` als Platzhalter.

Auflösungsreihenfolge (das Spezifischste gewinnt):

1. Gruppen-/Kanal-`toolsBySender`-Abgleich
2. Gruppen-/Kanal-`tools`
3. Standard (`"*"`) `toolsBySender`-Abgleich
4. Standard (`"*"`) `tools`

Beispiel (Telegram):

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { tools: { deny: ["exec"] } },
        "-1001234567890": {
          tools: { deny: ["exec", "read", "write"] },
          toolsBySender: {
            "123456789": { alsoAllow: ["exec"] },
          },
        },
      },
    },
  },
}
```

Hinweise:

- Gruppen-/Kanal-Werkzeugeinschränkungen werden zusätzlich zur globalen/Agenten-Werkzeugrichtlinie angewendet (Verbote haben weiterhin Vorrang).
- Einige Kanäle verwenden eine andere Verschachtelung für Räume/Kanäle (z. B. Discord `guilds.*.channels.*`, Slack `channels.*`, MS Teams `teams.*.channels.*`).

## Gruppen-Allowlisten

Wenn `channels.whatsapp.groups`, `channels.telegram.groups` oder `channels.imessage.groups` konfiguriert ist, wirken die Schlüssel als Gruppen-Allowlist. Verwenden Sie `"*"`, um alle Gruppen zuzulassen und dennoch das Standard-Erwähnungsverhalten festzulegen.

Häufige Intentionen (Kopieren/Einfügen):

1. Alle Gruppenantworten deaktivieren

```json5
{
  channels: { whatsapp: { groupPolicy: "disabled" } },
}
```

2. Nur bestimmte Gruppen zulassen (WhatsApp)

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "123@g.us": { requireMention: true },
        "456@g.us": { requireMention: false },
      },
    },
  },
}
```

3. Alle Gruppen zulassen, aber Erwähnung verlangen (explizit)

```json5
{
  channels: {
    whatsapp: {
      groups: { "*": { requireMention: true } },
    },
  },
}
```

4. Nur der Eigentümer kann in Gruppen auslösen (WhatsApp)

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## Aktivierung (nur Eigentümer)

Gruppeneigentümer können die Aktivierung pro Gruppe umschalten:

- `/activation mention`
- `/activation always`

Der Eigentümer wird durch `channels.whatsapp.allowFrom` bestimmt (oder die eigene E.164 des Bots, wenn nicht gesetzt). Senden Sie den Befehl als eigenständige Nachricht. Andere Oberflächen ignorieren derzeit `/activation`.

## Kontextfelder

Eingehende Gruppen-Payloads setzen:

- `ChatType=group`
- `GroupSubject` (falls bekannt)
- `GroupMembers` (falls bekannt)
- `WasMentioned` (Ergebnis des Erwähnungs-Gatings)
- Telegram-Forenthemen enthalten zusätzlich `MessageThreadId` und `IsForum`.

Der System-Prompt des Agenten enthält beim ersten Zug einer neuen Gruppensitzung eine Gruppeneinführung. Sie erinnert das Modell daran, wie ein Mensch zu antworten, Markdown-Tabellen zu vermeiden und keine wörtlichen `\n`-Sequenzen zu tippen.

## iMessage-spezifisches

- Bevorzugen Sie `chat_id:<id>` beim Routing oder bei Allowlisten.
- Chats auflisten: `imsg chats --limit 20`.
- Gruppenantworten gehen immer an dieselbe `chat_id` zurück.

## WhatsApp-spezifisches

Siehe [Gruppennachrichten](/channels/group-messages) für WhatsApp-spezifisches Verhalten (History-Injektion, Details zur Erwähnungshandhabung).
