---
summary: „Verhalten von Gruppenchats ueber verschiedene Oberflaechen hinweg (WhatsApp/Telegram/Discord/Slack/Signal/iMessage/Microsoft Teams)“
read_when:
  - Aendern des Gruppenchats-Verhaltens oder der Mention-Gating-Logik
title: „Gruppen“
x-i18n:
  source_path: concepts/groups.md
  source_hash: b727a053edf51f6e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:14Z
---

# Gruppen

OpenClaw behandelt Gruppenchats ueber alle Oberflaechen hinweg konsistent: WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Microsoft Teams.

## Einsteiger-Einfuehrung (2 Minuten)

OpenClaw „lebt“ in Ihren eigenen Messaging-Konten. Es gibt keinen separaten WhatsApp-Bot-Benutzer.
Wenn **Sie** in einer Gruppe sind, kann OpenClaw diese Gruppe sehen und dort antworten.

Standardverhalten:

- Gruppen sind eingeschraenkt (`groupPolicy: "allowlist"`).
- Antworten erfordern eine Erwaehnung, sofern Sie Mention Gating nicht explizit deaktivieren.

Uebersetzung: erlaubte Absender koennen OpenClaw durch eine Erwaehnung ausloesen.

> TL;DR
>
> - **DM-Zugriff** wird durch `*.allowFrom` gesteuert.
> - **Gruppenzugriff** wird durch `*.groupPolicy` + Allowlists (`*.groups`, `*.groupAllowFrom`) gesteuert.
> - **Ausloesen von Antworten** wird durch Mention Gating (`requireMention`, `/activation`) gesteuert.

Schneller Ablauf (was mit einer Gruppennachricht passiert):

```
groupPolicy? disabled -> drop
groupPolicy? allowlist -> group allowed? no -> drop
requireMention? yes -> mentioned? no -> store for context only
otherwise -> reply
```

![Ablauf von Gruppennachrichten](/images/groups-flow.svg)

Wenn Sie moechten...
| Ziel | Einstellung |
|------|-------------|
| Alle Gruppen erlauben, aber nur auf @Erwaehnungen antworten | `groups: { "*": { requireMention: true } }` |
| Alle Gruppenantworten deaktivieren | `groupPolicy: "disabled"` |
| Nur bestimmte Gruppen | `groups: { "<group-id>": { ... } }` (kein `"*"`-Schluessel) |
| Nur Sie koennen in Gruppen ausloesen | `groupPolicy: "allowlist"`, `groupAllowFrom: ["+1555..."]` |

## Sitzungs-Schluessel

- Gruppensitzungen verwenden `agent:<agentId>:<channel>:group:<id>`-Sitzungs-Schluessel (Raeume/Kanaele verwenden `agent:<agentId>:<channel>:channel:<id>`).
- Telegram-Forum-Themen fuegen `:topic:<threadId>` zur Gruppen-ID hinzu, sodass jedes Thema eine eigene Sitzung hat.
- Direktchats verwenden die Hauptsitzung (oder pro Absender, wenn konfiguriert).
- Heartbeats werden fuer Gruppensitzungen uebersprungen.

## Muster: persoenliche DMs + oeffentliche Gruppen (einzelner Agent)

Ja — das funktioniert gut, wenn Ihr „persoenlicher“ Verkehr **DMs** und Ihr „oeffentlicher“ Verkehr **Gruppen** sind.

Warum: Im Einzelagentenmodus landen DMs typischerweise in der **Haupt**-Sitzung (`agent:main:main`), waehrend Gruppen immer **nicht-Haupt**-Sitzungs-Schluessel (`agent:main:<channel>:group:<id>`) verwenden. Wenn Sie Sandboxing mit `mode: "non-main"` aktivieren, laufen diese Gruppensitzungen in Docker, waehrend Ihre Haupt-DM-Sitzung auf dem Host verbleibt.

Dies gibt Ihnen ein Agenten-„Gehirn“ (gemeinsamer Workspace + Speicher), aber zwei Ausfuehrungsmodi:

- **DMs**: volle Werkzeuge (Host)
- **Gruppen**: Sandbox + eingeschraenkte Werkzeuge (Docker)

> Wenn Sie wirklich getrennte Workspaces/Personas benoetigen („persoenlich“ und „oeffentlich“ duerfen sich niemals mischen), verwenden Sie einen zweiten Agenten + Bindings. Siehe [Multi-Agent Routing](/concepts/multi-agent).

Beispiel (DMs auf dem Host, Gruppen in der Sandbox + nur Messaging-Werkzeuge):

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

Moechten Sie statt „kein Host-Zugriff“ lieber „Gruppen koennen nur Ordner X sehen“? Behalten Sie `workspaceAccess: "none"` bei und binden Sie nur erlaubte Pfade in die Sandbox ein:

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

- Konfigurationsschluessel und Standardwerte: [Gateway configuration](/gateway/configuration#agentsdefaultssandbox)
- Debugging, warum ein Werkzeug blockiert ist: [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)
- Details zu Bind-Mounts: [Sandboxing](/gateway/sandboxing#custom-bind-mounts)

## Anzeige-Beschriftungen

- UI-Beschriftungen verwenden `displayName`, wenn verfuegbar, formatiert als `<channel>:<token>`.
- `#room` ist fuer Raeume/Kanaele reserviert; Gruppenchats verwenden `g-<slug>` (kleingeschrieben, Leerzeichen -> `-`, `#@+._-` beibehalten).

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
| `"open"`      | Gruppen umgehen Allowlists; Mention Gating gilt weiterhin.                |
| `"disabled"`  | Blockiert alle Gruppennachrichten vollstaendig.                           |
| `"allowlist"` | Erlaubt nur Gruppen/Raeume, die der konfigurierten Allowlist entsprechen. |

Hinweise:

- `groupPolicy` ist getrennt von Mention Gating (das @Erwaehnungen erfordert).
- WhatsApp/Telegram/Signal/iMessage/Microsoft Teams: verwenden `groupAllowFrom` (Fallback: explizites `allowFrom`).
- Discord: Allowlist verwendet `channels.discord.guilds.<id>.channels`.
- Slack: Allowlist verwendet `channels.slack.channels`.
- Matrix: Allowlist verwendet `channels.matrix.groups` (Raum-IDs, Aliase oder Namen). Verwenden Sie `channels.matrix.groupAllowFrom`, um Absender einzuschraenken; pro Raum `users`-Allowlists werden ebenfalls unterstuetzt.
- Gruppen-DMs werden separat gesteuert (`channels.discord.dm.*`, `channels.slack.dm.*`).
- Telegram-Allowlist kann Benutzer-IDs (`"123456789"`, `"telegram:123456789"`, `"tg:123456789"`) oder Benutzernamen (`"@alice"` oder `"alice"`) abgleichen; Praefixe sind nicht case-sensitiv.
- Standard ist `groupPolicy: "allowlist"`; wenn Ihre Gruppen-Allowlist leer ist, werden Gruppennachrichten blockiert.

Schnelles mentales Modell (Auswertungsreihenfolge fuer Gruppennachrichten):

1. `groupPolicy` (offen/deaktiviert/Allowlist)
2. Gruppen-Allowlists (`*.groups`, `*.groupAllowFrom`, kanal-spezifische Allowlist)
3. Mention Gating (`requireMention`, `/activation`)

## Mention Gating (Standard)

Gruppennachrichten erfordern eine Erwaehnung, sofern dies nicht pro Gruppe ueberschrieben wird. Standardwerte liegen pro Subsystem unter `*.groups."*"`.

Das Antworten auf eine Bot-Nachricht zaehlt als implizite Erwaehnung (wenn der Kanal Reply-Metadaten unterstuetzt). Dies gilt fuer Telegram, WhatsApp, Slack, Discord und Microsoft Teams.

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

- `mentionPatterns` sind case-insensitive Regexe.
- Oberflaechen mit expliziten Erwaehnungen passieren weiterhin; Muster sind ein Fallback.
- Pro-Agent-Ueberschreibung: `agents.list[].groupChat.mentionPatterns` (nuetzlich, wenn mehrere Agenten eine Gruppe teilen).
- Mention Gating wird nur erzwungen, wenn Mention-Erkennung moeglich ist (native Erwaehnungen oder `mentionPatterns` sind konfiguriert).
- Discord-Standardwerte liegen in `channels.discord.guilds."*"` (pro Guild/Kanal ueberschreibbar).
- Gruppenverlaufs-Kontext wird ueber Kanaele hinweg einheitlich umschlossen und ist **nur-ausstehend** (Nachrichten, die wegen Mention Gating uebersprungen wurden); verwenden Sie `messages.groupChat.historyLimit` fuer den globalen Standard und `channels.<channel>.historyLimit` (oder `channels.<channel>.accounts.*.historyLimit`) fuer Ueberschreibungen. Setzen Sie `0`, um zu deaktivieren.

## Gruppen-/Kanal-Werkzeugbeschraenkungen (optional)

Einige Kanal-Konfigurationen unterstuetzen die Einschraenkung, welche Werkzeuge **innerhalb einer bestimmten Gruppe/eines Raums/eines Kanals** verfuegbar sind.

- `tools`: Werkzeuge fuer die gesamte Gruppe erlauben/verbieten.
- `toolsBySender`: Absender-spezifische Ueberschreibungen innerhalb der Gruppe (Schluessel sind Absender-IDs/Benutzernamen/E-Mail-Adressen/Telefonnummern je nach Kanal). Verwenden Sie `"*"` als Wildcard.

Aufloesungsreihenfolge (am spezifischsten gewinnt):

1. Gruppen-/Kanal-`toolsBySender`-Treffer
2. Gruppen-/Kanal-`tools`
3. Standard (`"*"`) `toolsBySender`-Treffer
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

- Gruppen-/Kanal-Werkzeugbeschraenkungen werden zusaetzlich zur globalen/Agenten-Werkzeugrichtlinie angewendet (Verbot gewinnt weiterhin).
- Einige Kanaele verwenden unterschiedliche Verschachtelungen fuer Raeume/Kanaele (z. B. Discord `guilds.*.channels.*`, Slack `channels.*`, MS Teams `teams.*.channels.*`).

## Gruppen-Allowlists

Wenn `channels.whatsapp.groups`, `channels.telegram.groups` oder `channels.imessage.groups` konfiguriert ist, fungieren die Schluessel als Gruppen-Allowlist. Verwenden Sie `"*"`, um alle Gruppen zu erlauben und dennoch das Standard-Mention-Verhalten festzulegen.

Haefige Absichten (Copy/Paste):

1. Alle Gruppenantworten deaktivieren

```json5
{
  channels: { whatsapp: { groupPolicy: "disabled" } },
}
```

2. Nur bestimmte Gruppen erlauben (WhatsApp)

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

3. Alle Gruppen erlauben, aber Erwaehnung verlangen (explizit)

```json5
{
  channels: {
    whatsapp: {
      groups: { "*": { requireMention: true } },
    },
  },
}
```

4. Nur der Eigentuemer kann in Gruppen ausloesen (WhatsApp)

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

## Aktivierung (nur Eigentuemer)

Gruppeneigentuemer koennen die Aktivierung pro Gruppe umschalten:

- `/activation mention`
- `/activation always`

Der Eigentuemer wird durch `channels.whatsapp.allowFrom` bestimmt (oder die eigene E.164 des Bots, wenn nicht gesetzt). Senden Sie den Befehl als eigenstaendige Nachricht. Andere Oberflaechen ignorieren derzeit `/activation`.

## Kontextfelder

Eingehende Gruppen-Payloads setzen:

- `ChatType=group`
- `GroupSubject` (falls bekannt)
- `GroupMembers` (falls bekannt)
- `WasMentioned` (Ergebnis des Mention Gating)
- Telegram-Forum-Themen enthalten zusaetzlich `MessageThreadId` und `IsForum`.

Der System-Prompt des Agenten enthaelt beim ersten Zug einer neuen Gruppensitzung eine Gruppen-Einfuehrung. Sie erinnert das Modell daran, wie ein Mensch zu antworten, Markdown-Tabellen zu vermeiden und keine literalen `\n`-Sequenzen zu tippen.

## iMessage-Besonderheiten

- Bevorzugen Sie `chat_id:<id>` beim Routing oder Allowlisting.
- Chats auflisten: `imsg chats --limit 20`.
- Gruppenantworten gehen immer an dieselbe `chat_id` zurueck.

## WhatsApp-Besonderheiten

Siehe [Group messages](/concepts/group-messages) fuer WhatsApp-spezifisches Verhalten (Verlaufsinjektion, Details zur Mention-Behandlung).
