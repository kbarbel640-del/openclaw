---
summary: "Slack-Einrichtung fuer den Socket- oder HTTP-Webhook-Modus"
read_when: "Einrichtung von Slack oder Fehlerbehebung im Slack-Socket-/HTTP-Modus"
title: "Slack"
x-i18n:
  source_path: channels/slack.md
  source_hash: 703b4b4333bebfef
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:01Z
---

# Slack

## Socket-Modus (Standard)

### Schnellstart (Anfaenger)

1. Erstellen Sie eine Slack-App und aktivieren Sie den **Socket Mode**.
2. Erstellen Sie ein **App Token** (`xapp-...`) und ein **Bot Token** (`xoxb-...`).
3. Setzen Sie die Tokens fuer OpenClaw und starten Sie den Gateway.

Minimale Konfiguration:

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

### Einrichtung

1. Erstellen Sie eine Slack-App („From scratch“) unter https://api.slack.com/apps.
2. **Socket Mode** → aktivieren. Gehen Sie dann zu **Basic Information** → **App-Level Tokens** → **Generate Token and Scopes** mit dem Scope `connections:write`. Kopieren Sie das **App Token** (`xapp-...`).
3. **OAuth & Permissions** → fuegen Sie Bot-Token-Scopes hinzu (verwenden Sie das Manifest unten). Klicken Sie auf **Install to Workspace**. Kopieren Sie das **Bot User OAuth Token** (`xoxb-...`).
4. Optional: **OAuth & Permissions** → fuegen Sie **User Token Scopes** hinzu (siehe die schreibgeschuetzte Liste unten). Installieren Sie die App erneut und kopieren Sie das **User OAuth Token** (`xoxp-...`).
5. **Event Subscriptions** → aktivieren Sie Events und abonnieren Sie:
   - `message.*` (enthaelt Bearbeitungen/Loeschungen/Thread-Broadcasts)
   - `app_mention`
   - `reaction_added`, `reaction_removed`
   - `member_joined_channel`, `member_left_channel`
   - `channel_rename`
   - `pin_added`, `pin_removed`
6. Laden Sie den Bot in die Kanaele ein, die er lesen soll.
7. Slash Commands → erstellen Sie `/openclaw`, wenn Sie `channels.slack.slashCommand` verwenden. Wenn Sie native Commands aktivieren, fuegen Sie pro integriertem Command einen Slash Command hinzu (gleiche Namen wie `/help`). Nativ ist fuer Slack standardmaessig deaktiviert, ausser Sie setzen `channels.slack.commands.native: true` (global ist `commands.native` standardmaessig `"auto"`, was Slack deaktiviert laesst).
8. App Home → aktivieren Sie den **Messages Tab**, damit Benutzer dem Bot Direktnachrichten senden koennen.

Verwenden Sie das Manifest unten, damit Scopes und Events synchron bleiben.

Multi-Account-Unterstuetzung: Verwenden Sie `channels.slack.accounts` mit konto-spezifischen Tokens und optional `name`. Siehe [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) fuer das gemeinsame Muster.

### OpenClaw-Konfiguration (minimal)

Setzen Sie Tokens ueber Umgebungsvariablen (empfohlen):

- `SLACK_APP_TOKEN=xapp-...`
- `SLACK_BOT_TOKEN=xoxb-...`

Oder ueber die Konfiguration:

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

### User-Token (optional)

OpenClaw kann ein Slack-User-Token (`xoxp-...`) fuer Leseoperationen verwenden (Verlauf,
Pins, Reaktionen, Emoji, Mitgliederinformationen). Standardmaessig bleibt dies schreibgeschuetzt: Lesezugriffe
bevorzugen das User-Token, wenn vorhanden, und Schreibzugriffe verwenden weiterhin das Bot-Token,
sofern Sie nicht explizit optieren. Selbst mit `userTokenReadOnly: false` bleibt das Bot-Token
fuer Schreibzugriffe bevorzugt, wenn es verfuegbar ist.

User-Tokens werden in der Konfigurationsdatei eingerichtet (keine Unterstuetzung ueber Umgebungsvariablen). Fuer
Multi-Account setzen Sie `channels.slack.accounts.<id>.userToken`.

Beispiel mit Bot-, App- und User-Tokens:

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
      userToken: "xoxp-...",
    },
  },
}
```

Beispiel mit explizit gesetztem userTokenReadOnly (User-Token-Schreibzugriffe erlauben):

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "xapp-...",
      botToken: "xoxb-...",
      userToken: "xoxp-...",
      userTokenReadOnly: false,
    },
  },
}
```

#### Token-Verwendung

- Leseoperationen (Verlauf, Reaktionsliste, Pin-Liste, Emoji-Liste, Mitgliederinformationen,
  Suche) bevorzugen das User-Token, wenn konfiguriert, andernfalls das Bot-Token.
- Schreiboperationen (Nachrichten senden/bearbeiten/loeschen, Reaktionen hinzufuegen/entfernen,
  pinnen/entpinnen, Datei-Uploads) verwenden standardmaessig das Bot-Token. Wenn `userTokenReadOnly: false`
  gesetzt ist und kein Bot-Token verfuegbar ist, faellt OpenClaw auf das User-Token zurueck.

### Verlaufskontext

- `channels.slack.historyLimit` (oder `channels.slack.accounts.*.historyLimit`) steuert, wie viele aktuelle Kanal-/Gruppennachrichten in den Prompt eingebunden werden.
- Faellt zurueck auf `messages.groupChat.historyLimit`. Setzen Sie `0`, um dies zu deaktivieren (Standard 50).

## HTTP-Modus (Events API)

Verwenden Sie den HTTP-Webhook-Modus, wenn Ihr Gateway fuer Slack ueber HTTPS erreichbar ist (typisch fuer Server-Deployments).
Der HTTP-Modus verwendet die Events API + Interactivity + Slash Commands mit einer gemeinsamen Request-URL.

### Einrichtung

1. Erstellen Sie eine Slack-App und **deaktivieren Sie den Socket Mode** (optional, wenn Sie nur HTTP verwenden).
2. **Basic Information** → kopieren Sie das **Signing Secret**.
3. **OAuth & Permissions** → installieren Sie die App und kopieren Sie das **Bot User OAuth Token** (`xoxb-...`).
4. **Event Subscriptions** → aktivieren Sie Events und setzen Sie die **Request URL** auf den Webhook-Pfad Ihres Gateways (Standard `/slack/events`).
5. **Interactivity & Shortcuts** → aktivieren und dieselbe **Request URL** setzen.
6. **Slash Commands** → setzen Sie dieselbe **Request URL** fuer Ihre Commands.

Beispiel-Request-URL:
`https://gateway-host/slack/events`

### OpenClaw-Konfiguration (minimal)

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "http",
      botToken: "xoxb-...",
      signingSecret: "your-signing-secret",
      webhookPath: "/slack/events",
    },
  },
}
```

Multi-Account-HTTP-Modus: Setzen Sie `channels.slack.accounts.<id>.mode = "http"` und stellen Sie pro Account eine eindeutige
`webhookPath` bereit, damit jede Slack-App auf ihre eigene URL zeigen kann.

### Manifest (optional)

Verwenden Sie dieses Slack-App-Manifest, um die App schnell zu erstellen (passen Sie Name/Command nach Bedarf an). Schliessen Sie die
User-Scopes ein, wenn Sie ein User-Token konfigurieren moechten.

```json
{
  "display_information": {
    "name": "OpenClaw",
    "description": "Slack connector for OpenClaw"
  },
  "features": {
    "bot_user": {
      "display_name": "OpenClaw",
      "always_online": false
    },
    "app_home": {
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "slash_commands": [
      {
        "command": "/openclaw",
        "description": "Send a message to OpenClaw",
        "should_escape": false
      }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "chat:write",
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "groups:write",
        "im:history",
        "im:read",
        "im:write",
        "mpim:history",
        "mpim:read",
        "mpim:write",
        "users:read",
        "app_mentions:read",
        "reactions:read",
        "reactions:write",
        "pins:read",
        "pins:write",
        "emoji:read",
        "commands",
        "files:read",
        "files:write"
      ],
      "user": [
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "mpim:history",
        "mpim:read",
        "users:read",
        "reactions:read",
        "pins:read",
        "emoji:read",
        "search:read"
      ]
    }
  },
  "settings": {
    "socket_mode_enabled": true,
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "message.channels",
        "message.groups",
        "message.im",
        "message.mpim",
        "reaction_added",
        "reaction_removed",
        "member_joined_channel",
        "member_left_channel",
        "channel_rename",
        "pin_added",
        "pin_removed"
      ]
    }
  }
}
```

Wenn Sie native Commands aktivieren, fuegen Sie pro Command, den Sie bereitstellen moechten, einen `slash_commands`-Eintrag hinzu (entsprechend der `/help`-Liste). Ueberschreiben Sie dies mit `channels.slack.commands.native`.

## Scopes (aktuell vs. optional)

Slacks Conversations API ist typ-spezifisch: Sie benoetigen nur die Scopes fuer die
Konversationstypen, die Sie tatsaechlich verwenden (channels, groups, im, mpim). Siehe
https://docs.slack.dev/apis/web-api/using-the-conversations-api/ fuer die Uebersicht.

### Bot-Token-Scopes (erforderlich)

- `chat:write` (Nachrichten senden/aktualisieren/loeschen ueber `chat.postMessage`)
  https://docs.slack.dev/reference/methods/chat.postMessage
- `im:write` (DMs oeffnen ueber `conversations.open` fuer Benutzer-DMs)
  https://docs.slack.dev/reference/methods/conversations.open
- `channels:history`, `groups:history`, `im:history`, `mpim:history`
  https://docs.slack.dev/reference/methods/conversations.history
- `channels:read`, `groups:read`, `im:read`, `mpim:read`
  https://docs.slack.dev/reference/methods/conversations.info
- `users:read` (Benutzer-Lookup)
  https://docs.slack.dev/reference/methods/users.info
- `reactions:read`, `reactions:write` (`reactions.get` / `reactions.add`)
  https://docs.slack.dev/reference/methods/reactions.get
  https://docs.slack.dev/reference/methods/reactions.add
- `pins:read`, `pins:write` (`pins.list` / `pins.add` / `pins.remove`)
  https://docs.slack.dev/reference/scopes/pins.read
  https://docs.slack.dev/reference/scopes/pins.write
- `emoji:read` (`emoji.list`)
  https://docs.slack.dev/reference/scopes/emoji.read
- `files:write` (Uploads ueber `files.uploadV2`)
  https://docs.slack.dev/messaging/working-with-files/#upload

### User-Token-Scopes (optional, standardmaessig schreibgeschuetzt)

Fuegen Sie diese unter **User Token Scopes** hinzu, wenn Sie `channels.slack.userToken` konfigurieren.

- `channels:history`, `groups:history`, `im:history`, `mpim:history`
- `channels:read`, `groups:read`, `im:read`, `mpim:read`
- `users:read`
- `reactions:read`
- `pins:read`
- `emoji:read`
- `search:read`

### Derzeit nicht benoetigt (aber wahrscheinlich zukuenftig)

- `mpim:write` (nur wenn wir Group-DM-Oeffnen/DM-Start ueber `conversations.open` hinzufuegen)
- `groups:write` (nur wenn wir Private-Channel-Management hinzufuegen: erstellen/umbenennen/einladen/archivieren)
- `chat:write.public` (nur wenn wir in Kanaele posten wollen, in denen der Bot nicht ist)
  https://docs.slack.dev/reference/scopes/chat.write.public
- `users:read.email` (nur wenn wir E-Mail-Felder aus `users.info` benoetigen)
  https://docs.slack.dev/changelog/2017-04-narrowing-email-access
- `files:read` (nur wenn wir mit dem Auflisten/Lesen von Datei-Metadaten beginnen)

## Konfiguration

Slack verwendet nur den Socket-Modus (kein HTTP-Webhook-Server). Stellen Sie beide Tokens bereit:

```json
{
  "slack": {
    "enabled": true,
    "botToken": "xoxb-...",
    "appToken": "xapp-...",
    "groupPolicy": "allowlist",
    "dm": {
      "enabled": true,
      "policy": "pairing",
      "allowFrom": ["U123", "U456", "*"],
      "groupEnabled": false,
      "groupChannels": ["G123"],
      "replyToMode": "all"
    },
    "channels": {
      "C123": { "allow": true, "requireMention": true },
      "#general": {
        "allow": true,
        "requireMention": true,
        "users": ["U123"],
        "skills": ["search", "docs"],
        "systemPrompt": "Keep answers short."
      }
    },
    "reactionNotifications": "own",
    "reactionAllowlist": ["U123"],
    "replyToMode": "off",
    "actions": {
      "reactions": true,
      "messages": true,
      "pins": true,
      "memberInfo": true,
      "emojiList": true
    },
    "slashCommand": {
      "enabled": true,
      "name": "openclaw",
      "sessionPrefix": "slack:slash",
      "ephemeral": true
    },
    "textChunkLimit": 4000,
    "mediaMaxMb": 20
  }
}
```

Tokens koennen auch ueber Umgebungsvariablen bereitgestellt werden:

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`

Ack-Reaktionen werden global ueber `messages.ackReaction` +
`messages.ackReactionScope` gesteuert. Verwenden Sie `messages.removeAckAfterReply`, um die
Ack-Reaktion zu entfernen, nachdem der Bot geantwortet hat.

## Limits

- Ausgehender Text wird in Bloecke von `channels.slack.textChunkLimit` aufgeteilt (Standard 4000).
- Optionale Zeilenumbruch-Chunking: Setzen Sie `channels.slack.chunkMode="newline"`, um vor der Laengenaufteilung an Leerzeilen (Absatzgrenzen) zu trennen.
- Medien-Uploads sind durch `channels.slack.mediaMaxMb` begrenzt (Standard 20).

## Antwort-Threading

Standardmaessig antwortet OpenClaw im Hauptkanal. Verwenden Sie `channels.slack.replyToMode`, um automatisches Threading zu steuern:

| Modus   | Verhalten                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `off`   | **Standard.** Antwort im Hauptkanal. Thread nur, wenn die ausloesende Nachricht bereits in einem Thread war.                                                                                     |
| `first` | Erste Antwort geht in den Thread (unter der ausloesenden Nachricht), nachfolgende Antworten gehen in den Hauptkanal. Nuetzlich, um Kontext sichtbar zu halten und Thread-Unordnung zu vermeiden. |
| `all`   | Alle Antworten gehen in den Thread. Haelt Unterhaltungen zusammen, kann aber die Sichtbarkeit verringern.                                                                                        |

Der Modus gilt sowohl fuer Auto-Antworten als auch fuer Agent-Werkzeugaufrufe (`slack sendMessage`).

### Threading pro Chat-Typ

Sie koennen unterschiedliches Threading-Verhalten pro Chat-Typ konfigurieren, indem Sie `channels.slack.replyToModeByChatType` setzen:

```json5
{
  channels: {
    slack: {
      replyToMode: "off", // default for channels
      replyToModeByChatType: {
        direct: "all", // DMs always thread
        group: "first", // group DMs/MPIM thread first reply
      },
    },
  },
}
```

Unterstuetzte Chat-Typen:

- `direct`: 1:1-DMs (Slack `im`)
- `group`: Gruppen-DMs / MPIMs (Slack `mpim`)
- `channel`: Standardkanaele (oeffentlich/privat)

Prioritaet:

1. `replyToModeByChatType.<chatType>`
2. `replyToMode`
3. Anbieter-Standard (`off`)

Legacy-`channels.slack.dm.replyToMode` wird weiterhin als Fallback fuer `direct` akzeptiert, wenn kein Chat-Typ-Override gesetzt ist.

Beispiele:

Nur DMs threaden:

```json5
{
  channels: {
    slack: {
      replyToMode: "off",
      replyToModeByChatType: { direct: "all" },
    },
  },
}
```

Gruppen-DMs threaden, Kanaele im Root behalten:

```json5
{
  channels: {
    slack: {
      replyToMode: "off",
      replyToModeByChatType: { group: "first" },
    },
  },
}
```

Kanaele threaden, DMs im Root behalten:

```json5
{
  channels: {
    slack: {
      replyToMode: "first",
      replyToModeByChatType: { direct: "off", group: "off" },
    },
  },
}
```

### Manuelle Threading-Tags

Fuer eine feingranulare Steuerung verwenden Sie diese Tags in Agent-Antworten:

- `[[reply_to_current]]` — Antwort auf die ausloesende Nachricht (Thread starten/fortsetzen).
- `[[reply_to:<id>]]` — Antwort auf eine bestimmte Nachrichten-ID.

## Sitzungen + Routing

- DMs teilen sich die `main`-Sitzung (wie WhatsApp/Telegram).
- Kanaele werden auf `agent:<agentId>:slack:channel:<channelId>`-Sitzungen abgebildet.
- Slash Commands verwenden `agent:<agentId>:slack:slash:<userId>`-Sitzungen (Praefix konfigurierbar ueber `channels.slack.slashCommand.sessionPrefix`).
- Wenn Slack kein `channel_type` bereitstellt, leitet OpenClaw es aus dem Kanal-ID-Praefix ab (`D`, `C`, `G`) und verwendet standardmaessig `channel`, um Sitzungsschluessel stabil zu halten.
- Native Command-Registrierung verwendet `commands.native` (globaler Standard `"auto"` → Slack aus) und kann pro Workspace mit `channels.slack.commands.native` ueberschrieben werden. Text-Commands erfordern eigenstaendige `/...`-Nachrichten und koennen mit `commands.text: false` deaktiviert werden. Slack-Slash-Commands werden in der Slack-App verwaltet und nicht automatisch entfernt. Verwenden Sie `commands.useAccessGroups: false`, um Zugriffsgruppenpruefungen fuer Commands zu umgehen.
- Vollstaendige Command-Liste + Konfiguration: [Slash commands](/tools/slash-commands)

## DM-Sicherheit (Pairing)

- Standard: `channels.slack.dm.policy="pairing"` — unbekannte DM-Absender erhalten einen Pairing-Code (laeuft nach 1 Stunde ab).
- Freigabe ueber: `openclaw pairing approve slack <code>`.
- Um jeden zuzulassen: Setzen Sie `channels.slack.dm.policy="open"` und `channels.slack.dm.allowFrom=["*"]`.
- `channels.slack.dm.allowFrom` akzeptiert Benutzer-IDs, @Handles oder E-Mails (werden beim Start aufgeloest, wenn Tokens dies erlauben). Der Assistent akzeptiert Benutzernamen und loest sie waehrend der Einrichtung in IDs auf, wenn Tokens dies erlauben.

## Gruppenrichtlinie

- `channels.slack.groupPolicy` steuert die Kanalbehandlung (`open|disabled|allowlist`).
- `allowlist` erfordert, dass Kanaele in `channels.slack.channels` aufgefuehrt sind.
- Wenn Sie nur `SLACK_BOT_TOKEN`/`SLACK_APP_TOKEN` setzen und niemals einen `channels.slack`-Abschnitt erstellen,
  setzt die Laufzeit `groupPolicy` standardmaessig auf `open`. Fuegen Sie `channels.slack.groupPolicy`,
  `channels.defaults.groupPolicy` oder eine Kanal-Allowlist hinzu, um dies zu sperren.
- Der Konfigurationsassistent akzeptiert `#channel`-Namen und loest sie nach Moeglichkeit in IDs auf
  (oeffentlich + privat); wenn mehrere Treffer existieren, wird der aktive Kanal bevorzugt.
- Beim Start loest OpenClaw Kanal-/Benutzernamen in Allowlists in IDs auf (wenn Tokens dies erlauben)
  und protokolliert die Zuordnung; nicht aufgeloeste Eintraege bleiben wie eingegeben erhalten.
- Um **keine Kanaele** zuzulassen, setzen Sie `channels.slack.groupPolicy: "disabled"` (oder belassen Sie eine leere Allowlist).

Kanaloptionen (`channels.slack.channels.<id>` oder `channels.slack.channels.<name>`):

- `allow`: Kanal erlauben/verbieten, wenn `groupPolicy="allowlist"`.
- `requireMention`: Mention-Gating fuer den Kanal.
- `tools`: optionale, kanal-spezifische Werkzeugrichtlinien-Overrides (`allow`/`deny`/`alsoAllow`).
- `toolsBySender`: optionale, absender-spezifische Werkzeugrichtlinien-Overrides innerhalb des Kanals (Schluessel sind Absender-IDs/@Handles/E-Mails; `"*"`-Wildcard unterstuetzt).
- `allowBots`: Bot-verfasste Nachrichten in diesem Kanal zulassen (Standard: false).
- `users`: optionale, kanal-spezifische Benutzer-Allowlist.
- `skills`: Skill-Filter (weglassen = alle Skills, leer = keine).
- `systemPrompt`: zusaetzlicher System-Prompt fuer den Kanal (kombiniert mit Thema/Zweck).
- `enabled`: setzen Sie `false`, um den Kanal zu deaktivieren.

## Zustellziele

Verwenden Sie diese mit Cron-/CLI-Sends:

- `user:<id>` fuer DMs
- `channel:<id>` fuer Kanaele

## Werkzeugaktionen

Slack-Werkzeugaktionen koennen ueber `channels.slack.actions.*` gesteuert werden:

| Aktionsgruppe | Standard  | Hinweise                         |
| ------------- | --------- | -------------------------------- |
| reactions     | aktiviert | Reagieren + Reaktionen auflisten |
| messages      | aktiviert | Lesen/senden/bearbeiten/loeschen |
| pins          | aktiviert | Pinnen/entpinnen/auflisten       |
| memberInfo    | aktiviert | Mitgliederinformationen          |
| emojiList     | aktiviert | Benutzerdefinierte Emoji-Liste   |

## Sicherheitshinweise

- Schreibzugriffe verwenden standardmaessig das Bot-Token, damit zustandsveraendernde Aktionen auf die
  Bot-Berechtigungen und -Identitaet der App beschraenkt bleiben.
- Das Setzen von `userTokenReadOnly: false` erlaubt die Verwendung des User-Tokens fuer Schreibzugriffe,
  wenn kein Bot-Token verfuegbar ist, was bedeutet, dass Aktionen mit den Rechten des
  installierenden Benutzers ausgefuehrt werden. Behandeln Sie das User-Token als hochprivilegiert
  und halten Sie Aktions-Gates und Allowlists strikt.
- Wenn Sie User-Token-Schreibzugriffe aktivieren, stellen Sie sicher, dass das User-Token die erwarteten
  Schreib-Scopes enthaelt (`chat:write`, `reactions:write`, `pins:write`,
  `files:write`), andernfalls schlagen diese Operationen fehl.

## Hinweise

- Mention-Gating wird ueber `channels.slack.channels` gesteuert (setzen Sie `requireMention` auf `true`); `agents.list[].groupChat.mentionPatterns` (oder `messages.groupChat.mentionPatterns`) zaehlen ebenfalls als Mentions.
- Multi-Agent-Override: Setzen Sie agent-spezifische Muster unter `agents.list[].groupChat.mentionPatterns`.
- Reaktionsbenachrichtigungen folgen `channels.slack.reactionNotifications` (verwenden Sie `reactionAllowlist` mit Modus `allowlist`).
- Bot-verfasste Nachrichten werden standardmaessig ignoriert; aktivieren Sie dies ueber `channels.slack.allowBots` oder `channels.slack.channels.<id>.allowBots`.
- Warnung: Wenn Sie Antworten auf andere Bots erlauben (`channels.slack.allowBots=true` oder `channels.slack.channels.<id>.allowBots=true`), verhindern Sie Bot-zu-Bot-Antwortschleifen mit `requireMention`, `channels.slack.channels.<id>.users`-Allowlists und/oder klaren Guardrails in `AGENTS.md` und `SOUL.md`.
- Fuer das Slack-Werkzeug sind die Semantiken zum Entfernen von Reaktionen in [/tools/reactions](/tools/reactions) beschrieben.
- Anhaenge werden, sofern erlaubt und unterhalb der Groessenbegrenzung, in den Media Store heruntergeladen.
