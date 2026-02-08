---
summary: "Status, Funktionen und Konfiguration der Discord-Bot-Unterstützung"
read_when:
  - Arbeiten an Discord-Kanal-Funktionen
title: "Discord"
x-i18n:
  source_path: channels/discord.md
  source_hash: 9bebfe8027ff1972
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:05Z
---

# Discord (Bot API)

Status: bereit für Direktnachrichten und Guild-Textkanäle über das offizielle Discord-Bot-Gateway.

## Schnellstart (Einsteiger)

1. Erstellen Sie einen Discord-Bot und kopieren Sie das Bot-Token.
2. Aktivieren Sie in den Discord-App-Einstellungen **Message Content Intent** (und **Server Members Intent**, wenn Sie Allowlists oder Namensauflösungen verwenden möchten).
3. Setzen Sie das Token für OpenClaw:
   - Env: `DISCORD_BOT_TOKEN=...`
   - Oder Config: `channels.discord.token: "..."`.
   - Wenn beides gesetzt ist, hat die Konfiguration Vorrang (Env-Fallback gilt nur für das Standardkonto).
4. Laden Sie den Bot mit Nachrichtenberechtigungen auf Ihren Server ein (erstellen Sie einen privaten Server, wenn Sie nur Direktnachrichten möchten).
5. Starten Sie das Gateway.
6. DM-Zugriff ist standardmäßig gekoppelt; genehmigen Sie den Pairing-Code beim ersten Kontakt.

Minimale Konfiguration:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

## Ziele

- Mit OpenClaw über Discord-Direktnachrichten oder Guild-Kanäle sprechen.
- Direktchats werden in der Hauptsitzung des Agenten zusammengeführt (Standard `agent:main:main`); Guild-Kanäle bleiben als `agent:<agentId>:discord:channel:<channelId>` isoliert (Anzeigenamen verwenden `discord:<guildSlug>#<channelSlug>`).
- Gruppen-DMs werden standardmäßig ignoriert; aktivieren Sie sie über `channels.discord.dm.groupEnabled` und beschränken Sie sie optional über `channels.discord.dm.groupChannels`.
- Deterministisches Routing beibehalten: Antworten gehen immer an den Kanal zurück, aus dem sie eingegangen sind.

## Funktionsweise

1. Erstellen Sie eine Discord-Anwendung → Bot, aktivieren Sie die benötigten Intents (DMs + Guild-Nachrichten + Nachrichteninhalt) und kopieren Sie das Bot-Token.
2. Laden Sie den Bot mit den erforderlichen Berechtigungen auf Ihren Server ein, um dort Nachrichten zu lesen/zu senden.
3. Konfigurieren Sie OpenClaw mit `channels.discord.token` (oder `DISCORD_BOT_TOKEN` als Fallback).
4. Starten Sie das Gateway; es startet den Discord-Kanal automatisch, wenn ein Token verfügbar ist (Konfiguration zuerst, Env-Fallback) und `channels.discord.enabled` nicht `false` ist.
   - Wenn Sie Env-Variablen bevorzugen, setzen Sie `DISCORD_BOT_TOKEN` (ein Konfigurationsblock ist optional).
5. Direktchats: Verwenden Sie `user:<id>` (oder eine `<@id>`-Erwähnung) beim Zustellen; alle Turns landen in der gemeinsamen `main`-Sitzung. Reine numerische IDs sind mehrdeutig und werden abgelehnt.
6. Guild-Kanäle: Verwenden Sie `channel:<channelId>` für die Zustellung. Erwähnungen sind standardmäßig erforderlich und können pro Guild oder pro Kanal gesetzt werden.
7. Direktchats: Standardmäßig sicher über `channels.discord.dm.policy` (Standard: `"pairing"`). Unbekannte Absender erhalten einen Pairing-Code (läuft nach 1 Stunde ab); genehmigen Sie über `openclaw pairing approve discord <code>`.
   - Um das alte „für alle offen“-Verhalten beizubehalten: setzen Sie `channels.discord.dm.policy="open"` und `channels.discord.dm.allowFrom=["*"]`.
   - Für eine harte Allowlist: setzen Sie `channels.discord.dm.policy="allowlist"` und listen Sie Absender in `channels.discord.dm.allowFrom`.
   - Um alle DMs zu ignorieren: setzen Sie `channels.discord.dm.enabled=false` oder `channels.discord.dm.policy="disabled"`.
8. Gruppen-DMs werden standardmäßig ignoriert; aktivieren Sie sie über `channels.discord.dm.groupEnabled` und beschränken Sie sie optional über `channels.discord.dm.groupChannels`.
9. Optionale Guild-Regeln: setzen Sie `channels.discord.guilds`, keyed nach Guild-ID (bevorzugt) oder Slug, mit kanalweisen Regeln.
10. Optionale native Befehle: `commands.native` ist standardmäßig `"auto"` (ein für Discord/Telegram, aus für Slack). Überschreiben mit `channels.discord.commands.native: true|false|"auto"`; `false` löscht zuvor registrierte Befehle. Textbefehle werden über `commands.text` gesteuert und müssen als eigenständige `/...`-Nachrichten gesendet werden. Verwenden Sie `commands.useAccessGroups: false`, um Zugriffsgruppenprüfungen für Befehle zu umgehen.
    - Vollständige Befehlsliste + Konfiguration: [Slash commands](/tools/slash-commands)
11. Optionaler Guild-Kontextverlauf: setzen Sie `channels.discord.historyLimit` (Standard 20, Fallback auf `messages.groupChat.historyLimit`), um beim Antworten auf eine Erwähnung die letzten N Guild-Nachrichten als Kontext einzubeziehen. Setzen Sie `0`, um dies zu deaktivieren.
12. Reaktionen: Der Agent kann Reaktionen über das Werkzeug `discord` auslösen (gesteuert durch `channels.discord.actions.*`).
    - Semantik zum Entfernen von Reaktionen: siehe [/tools/reactions](/tools/reactions).
    - Das Werkzeug `discord` wird nur bereitgestellt, wenn der aktuelle Kanal Discord ist.
13. Native Befehle verwenden isolierte Sitzungsschlüssel (`agent:<agentId>:discord:slash:<userId>`) statt der gemeinsamen `main`-Sitzung.

Hinweis: Die Namens→ID-Auflösung nutzt die Guild-Mitgliedersuche und erfordert **Server Members Intent**; wenn der Bot keine Mitglieder suchen kann, verwenden Sie IDs oder `<@id>`-Erwähnungen.  
Hinweis: Slugs sind kleingeschrieben, Leerzeichen werden durch `-` ersetzt. Kanalnamen werden ohne führendes `#` gesluggt.  
Hinweis: Guild-Kontext-`[from:]`-Zeilen enthalten `author.tag` + `id`, um ping-bereite Antworten zu erleichtern.

## Konfigurationsschreibzugriffe

Standardmäßig darf Discord Konfigurationsupdates schreiben, die durch `/config set|unset` ausgelöst werden (erfordert `commands.config: true`).

Deaktivieren mit:

```json5
{
  channels: { discord: { configWrites: false } },
}
```

## Eigenen Bot erstellen

Dies ist die Einrichtung im „Discord Developer Portal“ zum Ausführen von OpenClaw in einem Server-(Guild-)Kanal wie `#help`.

### 1) Discord-App + Bot-Benutzer erstellen

1. Discord Developer Portal → **Applications** → **New Application**
2. In Ihrer App:
   - **Bot** → **Add Bot**
   - Kopieren Sie das **Bot Token** (dieses tragen Sie in `DISCORD_BOT_TOKEN` ein)

### 2) Benötigte Gateway-Intents aktivieren

Discord blockiert „privilegierte Intents“, sofern sie nicht explizit aktiviert werden.

In **Bot** → **Privileged Gateway Intents** aktivieren:

- **Message Content Intent** (erforderlich, um Nachrichtentext in den meisten Guilds zu lesen; ohne ihn sehen Sie „Used disallowed intents“ oder der Bot verbindet sich, reagiert aber nicht)
- **Server Members Intent** (empfohlen; erforderlich für einige Mitglieder-/Benutzerabfragen und Allowlist-Abgleiche in Guilds)

**Presence Intent** wird in der Regel **nicht** benötigt. Das Setzen der eigenen Bot-Präsenz (Aktion `setPresence`) nutzt Gateway OP3 und benötigt diesen Intent nicht; er ist nur nötig, wenn Sie Präsenz-Updates anderer Guild-Mitglieder empfangen möchten.

### 3) Einladungs-URL erzeugen (OAuth2 URL Generator)

In Ihrer App: **OAuth2** → **URL Generator**

**Scopes**

- ✅ `bot`
- ✅ `applications.commands` (erforderlich für native Befehle)

**Bot Permissions** (minimale Basis)

- ✅ Kanäle anzeigen
- ✅ Nachrichten senden
- ✅ Nachrichtenverlauf lesen
- ✅ Links einbetten
- ✅ Dateien anhängen
- ✅ Reaktionen hinzufügen (optional, aber empfohlen)
- ✅ Externe Emojis / Sticker verwenden (optional; nur falls gewünscht)

Vermeiden Sie **Administrator**, es sei denn, Sie debuggen und vertrauen dem Bot vollständig.

Kopieren Sie die generierte URL, öffnen Sie sie, wählen Sie Ihren Server aus und installieren Sie den Bot.

### 4) IDs ermitteln (Guild/Benutzer/Kanal)

Discord verwendet überall numerische IDs; die OpenClaw-Konfiguration bevorzugt IDs.

1. Discord (Desktop/Web) → **User Settings** → **Advanced** → **Developer Mode** aktivieren
2. Rechtsklick:
   - Servername → **Copy Server ID** (Guild-ID)
   - Kanal (z. B. `#help`) → **Copy Channel ID**
   - Ihr Benutzer → **Copy User ID**

### 5) OpenClaw konfigurieren

#### Token

Setzen Sie das Bot-Token per Env-Var (auf Servern empfohlen):

- `DISCORD_BOT_TOKEN=...`

Oder per Konfiguration:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

Multi-Account-Unterstützung: Verwenden Sie `channels.discord.accounts` mit konto­spezifischen Tokens und optionalem `name`. Siehe [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) für das gemeinsame Muster.

#### Allowlist + Kanal-Routing

Beispiel „ein Server, nur ich erlaubt, nur #help erlaubt“:

```json5
{
  channels: {
    discord: {
      enabled: true,
      dm: { enabled: false },
      guilds: {
        YOUR_GUILD_ID: {
          users: ["YOUR_USER_ID"],
          requireMention: true,
          channels: {
            help: { allow: true, requireMention: true },
          },
        },
      },
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

Hinweise:

- `requireMention: true` bedeutet, dass der Bot nur antwortet, wenn er erwähnt wird (empfohlen für gemeinsame Kanäle).
- `agents.list[].groupChat.mentionPatterns` (oder `messages.groupChat.mentionPatterns`) zählen ebenfalls als Erwähnungen für Guild-Nachrichten.
- Multi-Agent-Override: Setzen Sie agentenspezifische Muster unter `agents.list[].groupChat.mentionPatterns`.
- Wenn `channels` vorhanden ist, werden alle nicht aufgeführten Kanäle standardmäßig abgelehnt.
- Verwenden Sie einen `"*"`-Kanal-Eintrag, um Standards für alle Kanäle anzuwenden; explizite Kanal-Einträge überschreiben den Wildcard.
- Threads erben die Konfiguration des Elternkanals (Allowlist, `requireMention`, Skills, Prompts usw.), sofern Sie die Thread-Kanal-ID nicht explizit hinzufügen.
- Owner-Hinweis: Wenn eine guild- oder kanal­spezifische `users`-Allowlist auf den Absender passt, behandelt OpenClaw diesen Absender im System-Prompt als Owner. Für einen globalen Owner über Kanäle hinweg setzen Sie `commands.ownerAllowFrom`.
- Vom Bot verfasste Nachrichten werden standardmäßig ignoriert; setzen Sie `channels.discord.allowBots=true`, um sie zuzulassen (eigene Nachrichten bleiben gefiltert).
- Warnung: Wenn Sie Antworten auf andere Bots erlauben (`channels.discord.allowBots=true`), verhindern Sie Bot-zu-Bot-Schleifen mit `requireMention`, `channels.discord.guilds.*.channels.<id>.users`-Allowlists und/oder klaren Guardrails in `AGENTS.md` und `SOUL.md`.

### 6) Funktion prüfen

1. Starten Sie das Gateway.
2. Senden Sie in Ihrem Serverkanal: `@Krill hello` (oder wie auch immer Ihr Bot heißt).
3. Wenn nichts passiert: prüfen Sie **Fehlerbehebung** unten.

### Fehlerbehebung

- Zuerst: `openclaw doctor` und `openclaw channels status --probe` ausführen (umsetzbare Warnungen + schnelle Audits).
- **„Used disallowed intents“**: Aktivieren Sie **Message Content Intent** (und wahrscheinlich **Server Members Intent**) im Developer Portal und starten Sie das Gateway neu.
- **Bot verbindet sich, antwortet aber nie in einem Guild-Kanal**:
  - Fehlender **Message Content Intent**, oder
  - Fehlende Kanalberechtigungen (Anzeigen/Senden/Verlauf lesen), oder
  - Ihre Konfiguration erfordert Erwähnungen und Sie haben den Bot nicht erwähnt, oder
  - Ihre Guild-/Kanal-Allowlist verweigert Kanal/Benutzer.
- **`requireMention: false` aber weiterhin keine Antworten**:
- `channels.discord.groupPolicy` ist standardmäßig **allowlist**; setzen Sie es auf `"open"` oder fügen Sie einen Guild-Eintrag unter `channels.discord.guilds` hinzu (optional Kanäle unter `channels.discord.guilds.<id>.channels` einschränken).
  - Wenn Sie nur `DISCORD_BOT_TOKEN` setzen und nie einen `channels.discord`-Abschnitt erstellen, setzt die Laufzeit
    `groupPolicy` standardmäßig auf `open`. Fügen Sie `channels.discord.groupPolicy`,
    `channels.defaults.groupPolicy` oder eine Guild-/Kanal-Allowlist hinzu, um es abzusichern.
- `requireMention` muss unter `channels.discord.guilds` (oder einem spezifischen Kanal) stehen. `channels.discord.requireMention` auf Top-Level wird ignoriert.
- **Berechtigungs-Audits** (`channels status --probe`) prüfen nur numerische Kanal-IDs. Wenn Sie Slugs/Namen als `channels.discord.guilds.*.channels`-Schlüssel verwenden, kann das Audit Berechtigungen nicht verifizieren.
- **DMs funktionieren nicht**: `channels.discord.dm.enabled=false`, `channels.discord.dm.policy="disabled"` oder Sie wurden noch nicht genehmigt (`channels.discord.dm.policy="pairing"`).
- **Exec-Genehmigungen in Discord**: Discord unterstützt eine **Button-UI** für Exec-Genehmigungen in DMs (Einmal erlauben / Immer erlauben / Ablehnen). `/approve <id> ...` ist nur für weitergeleitete Genehmigungen und löst die Button-Prompts von Discord nicht. Wenn Sie `❌ Failed to submit approval: Error: unknown approval id` sehen oder die UI nie erscheint, prüfen Sie:
  - `channels.discord.execApprovals.enabled: true` in Ihrer Konfiguration.
  - Ihre Discord-Benutzer-ID ist in `channels.discord.execApprovals.approvers` aufgeführt (die UI wird nur an Genehmiger gesendet).
  - Verwenden Sie die Buttons im DM-Prompt (**Einmal erlauben**, **Immer erlauben**, **Ablehnen**).
  - Siehe [Exec approvals](/tools/exec-approvals) und [Slash commands](/tools/slash-commands) für den umfassenderen Genehmigungs- und Befehlsablauf.

## Fähigkeiten & Grenzen

- Direktnachrichten und Guild-Textkanäle (Threads werden als separate Kanäle behandelt; Voice wird nicht unterstützt).
- Tippindikatoren werden nach bestem Effort gesendet; Nachrichtenaufteilung nutzt `channels.discord.textChunkLimit` (Standard 2000) und teilt lange Antworten nach Zeilenzahl (`channels.discord.maxLinesPerMessage`, Standard 17).
- Optionale Zeilenumbruch-Aufteilung: setzen Sie `channels.discord.chunkMode="newline"`, um vor der Längenaufteilung an Leerzeilen (Absatzgrenzen) zu trennen.
- Datei-Uploads werden bis zur konfigurierten `channels.discord.mediaMaxMb` unterstützt (Standard 8 MB).
- Erwähnungsbasierte Guild-Antworten standardmäßig, um laute Bots zu vermeiden.
- Antwortkontext wird injiziert, wenn eine Nachricht auf eine andere verweist (zitierter Inhalt + IDs).
- Native Antwort-Threads sind **standardmäßig aus**; aktivieren Sie sie mit `channels.discord.replyToMode` und Antwort-Tags.

## Retry-Richtlinie

Ausgehende Discord-API-Aufrufe wiederholen bei Rate-Limits (429) unter Verwendung von Discord `retry_after` (falls verfügbar), mit exponentiellem Backoff und Jitter. Konfigurieren über `channels.discord.retry`. Siehe [Retry policy](/concepts/retry).

## Konfiguration

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "abc.123",
      groupPolicy: "allowlist",
      guilds: {
        "*": {
          channels: {
            general: { allow: true },
          },
        },
      },
      mediaMaxMb: 8,
      actions: {
        reactions: true,
        stickers: true,
        emojiUploads: true,
        stickerUploads: true,
        polls: true,
        permissions: true,
        messages: true,
        threads: true,
        pins: true,
        search: true,
        memberInfo: true,
        roleInfo: true,
        roles: false,
        channelInfo: true,
        channels: true,
        voiceStatus: true,
        events: true,
        moderation: false,
        presence: false,
      },
      replyToMode: "off",
      dm: {
        enabled: true,
        policy: "pairing", // pairing | allowlist | open | disabled
        allowFrom: ["123456789012345678", "steipete"],
        groupEnabled: false,
        groupChannels: ["openclaw-dm"],
      },
      guilds: {
        "*": { requireMention: true },
        "123456789012345678": {
          slug: "friends-of-openclaw",
          requireMention: false,
          reactionNotifications: "own",
          users: ["987654321098765432", "steipete"],
          channels: {
            general: { allow: true },
            help: {
              allow: true,
              requireMention: true,
              users: ["987654321098765432"],
              skills: ["search", "docs"],
              systemPrompt: "Keep answers short.",
            },
          },
        },
      },
    },
  },
}
```

Ack-Reaktionen werden global über `messages.ackReaction` +
`messages.ackReactionScope` gesteuert. Verwenden Sie `messages.removeAckAfterReply`, um die
Ack-Reaktion nach der Bot-Antwort zu entfernen.

- `dm.enabled`: setzen Sie `false`, um alle DMs zu ignorieren (Standard `true`).
- `dm.policy`: DM-Zugriffskontrolle (`pairing` empfohlen). `"open"` erfordert `dm.allowFrom=["*"]`.
- `dm.allowFrom`: DM-Allowlist (Benutzer-IDs oder Namen). Verwendet von `dm.policy="allowlist"` und für die `dm.policy="open"`-Validierung. Der Assistent akzeptiert Benutzernamen und löst sie zu IDs auf, wenn der Bot Mitglieder suchen kann.
- `dm.groupEnabled`: Gruppen-DMs aktivieren (Standard `false`).
- `dm.groupChannels`: optionale Allowlist für Gruppen-DM-Kanal-IDs oder Slugs.
- `groupPolicy`: steuert die Behandlung von Guild-Kanälen (`open|disabled|allowlist`); `allowlist` erfordert Kanal-Allowlists.
- `guilds`: guild­spezifische Regeln, keyed nach Guild-ID (bevorzugt) oder Slug.
- `guilds."*"`: Standard-Guild-Einstellungen, die angewendet werden, wenn kein expliziter Eintrag existiert.
- `guilds.<id>.slug`: optionaler freundlicher Slug für Anzeigenamen.
- `guilds.<id>.users`: optionale guild­spezifische Benutzer-Allowlist (IDs oder Namen).
- `guilds.<id>.tools`: optionale guild­spezifische Werkzeugrichtlinien-Overrides (`allow`/`deny`/`alsoAllow`), die verwendet werden, wenn der Kanal-Override fehlt.
- `guilds.<id>.toolsBySender`: optionale absender­spezifische Werkzeugrichtlinien-Overrides auf Guild-Ebene (greifen, wenn der Kanal-Override fehlt; `"*"`-Wildcard unterstützt).
- `guilds.<id>.channels.<channel>.allow`: Kanal zulassen/ablehnen, wenn `groupPolicy="allowlist"`.
- `guilds.<id>.channels.<channel>.requireMention`: Erwähnungs-Gating für den Kanal.
- `guilds.<id>.channels.<channel>.tools`: optionale kanal­spezifische Werkzeugrichtlinien-Overrides (`allow`/`deny`/`alsoAllow`).
- `guilds.<id>.channels.<channel>.toolsBySender`: optionale absender­spezifische Werkzeugrichtlinien-Overrides innerhalb des Kanals (`"*"`-Wildcard unterstützt).
- `guilds.<id>.channels.<channel>.users`: optionale kanal­spezifische Benutzer-Allowlist.
- `guilds.<id>.channels.<channel>.skills`: Skill-Filter (weggelassen = alle Skills, leer = keine).
- `guilds.<id>.channels.<channel>.systemPrompt`: zusätzlicher System-Prompt für den Kanal. Discord-Kanalthemen werden als **nicht vertrauenswürdiger** Kontext injiziert (kein System-Prompt).
- `guilds.<id>.channels.<channel>.enabled`: setzen Sie `false`, um den Kanal zu deaktivieren.
- `guilds.<id>.channels`: Kanalregeln (Schlüssel sind Kanal-Slugs oder IDs).
- `guilds.<id>.requireMention`: guild­spezifische Erwähnungspflicht (pro Kanal überschreibbar).
- `guilds.<id>.reactionNotifications`: Reaktions-Systemereignis-Modus (`off`, `own`, `all`, `allowlist`).
- `textChunkLimit`: ausgehende Text-Chunk-Größe (Zeichen). Standard: 2000.
- `chunkMode`: `length` (Standard) teilt nur bei Überschreitung von `textChunkLimit`; `newline` teilt an Leerzeilen (Absatzgrenzen) vor der Längenaufteilung.
- `maxLinesPerMessage`: weiches Maximal-Linienlimit pro Nachricht. Standard: 17.
- `mediaMaxMb`: Begrenzung eingehender Medien, die auf die Festplatte gespeichert werden.
- `historyLimit`: Anzahl jüngster Guild-Nachrichten, die beim Antworten auf eine Erwähnung als Kontext einbezogen werden (Standard 20; Fallback auf `messages.groupChat.historyLimit`; `0` deaktiviert).
- `dmHistoryLimit`: DM-Verlaufsgrenze in Benutzer-Turns. Pro-Benutzer-Overrides: `dms["<user_id>"].historyLimit`.
- `retry`: Retry-Richtlinie für ausgehende Discord-API-Aufrufe (Versuche, minDelayMs, maxDelayMs, jitter).
- `pluralkit`: PluralKit-proxierte Nachrichten auflösen, sodass Systemmitglieder als unterschiedliche Absender erscheinen.
- `actions`: aktion­spezifische Werkzeug-Gates; weglassen, um alle zu erlauben (setzen Sie `false`, um zu deaktivieren).
  - `reactions` (deckt Reagieren + Reaktionen lesen ab)
  - `stickers`, `emojiUploads`, `stickerUploads`, `polls`, `permissions`, `messages`, `threads`, `pins`, `search`
  - `memberInfo`, `roleInfo`, `channelInfo`, `voiceStatus`, `events`
  - `channels` (Kanäle + Kategorien + Berechtigungen erstellen/bearbeiten/löschen)
  - `roles` (Rollen hinzufügen/entfernen, Standard `false`)
  - `moderation` (Timeout/Kick/Ban, Standard `false`)
  - `presence` (Bot-Status/Aktivität, Standard `false`)
- `execApprovals`: Discord-spezifische Exec-Genehmigungs-DMs (Button-UI). Unterstützt `enabled`, `approvers`, `agentFilter`, `sessionFilter`.

Reaktionsbenachrichtigungen verwenden `guilds.<id>.reactionNotifications`:

- `off`: keine Reaktionsereignisse.
- `own`: Reaktionen auf eigene Bot-Nachrichten (Standard).
- `all`: alle Reaktionen auf allen Nachrichten.
- `allowlist`: Reaktionen von `guilds.<id>.users` auf allen Nachrichten (leere Liste deaktiviert).

### PluralKit-(PK-)Unterstützung

Aktivieren Sie PK-Abfragen, damit proxierte Nachrichten auf das zugrunde liegende System + Mitglied aufgelöst werden.
Wenn aktiviert, verwendet OpenClaw die Mitgliederidentität für Allowlists und kennzeichnet den
Absender als `Member (PK:System)`, um unbeabsichtigte Discord-Pings zu vermeiden.

```json5
{
  channels: {
    discord: {
      pluralkit: {
        enabled: true,
        token: "pk_live_...", // optional; required for private systems
      },
    },
  },
}
```

Allowlist-Hinweise (PK aktiviert):

- Verwenden Sie `pk:<memberId>` in `dm.allowFrom`, `guilds.<id>.users` oder kanal­spezifisch in `users`.
- Anzeigenamen von Mitgliedern werden ebenfalls per Name/Slug abgeglichen.
- Abfragen verwenden die **ursprüngliche** Discord-Nachrichten-ID (die vor dem Proxy), sodass
  die PK-API diese nur innerhalb ihres 30‑Minuten-Fensters auflöst.
- Wenn PK-Abfragen fehlschlagen (z. B. privates System ohne Token), werden proxierte Nachrichten
  als Bot-Nachrichten behandelt und verworfen, sofern nicht `channels.discord.allowBots=true` gesetzt ist.

### Standardwerte für Werkzeugaktionen

| Aktionsgruppe  | Standard    | Hinweise                                     |
| -------------- | ----------- | -------------------------------------------- |
| reactions      | aktiviert   | Reagieren + Reaktionen auflisten + emojiList |
| stickers       | aktiviert   | Sticker senden                               |
| emojiUploads   | aktiviert   | Emojis hochladen                             |
| stickerUploads | aktiviert   | Sticker hochladen                            |
| polls          | aktiviert   | Umfragen erstellen                           |
| permissions    | aktiviert   | Kanalberechtigungs-Snapshot                  |
| messages       | aktiviert   | Lesen/Senden/Bearbeiten/Löschen              |
| threads        | aktiviert   | Erstellen/Auflisten/Antworten                |
| pins           | aktiviert   | Anheften/Lösen/Auflisten                     |
| search         | aktiviert   | Nachrichtensuche (Vorschau)                  |
| memberInfo     | aktiviert   | Mitgliederinfo                               |
| roleInfo       | aktiviert   | Rollenliste                                  |
| channelInfo    | aktiviert   | Kanalinfo + Liste                            |
| channels       | aktiviert   | Kanal-/Kategorieverwaltung                   |
| voiceStatus    | aktiviert   | Voice-Status-Abfrage                         |
| events         | aktiviert   | Geplante Events auflisten/erstellen          |
| roles          | deaktiviert | Rollen hinzufügen/entfernen                  |
| moderation     | deaktiviert | Timeout/Kick/Ban                             |
| presence       | deaktiviert | Bot-Status/Aktivität (setPresence)           |

- `replyToMode`: `off` (Standard), `first` oder `all`. Gilt nur, wenn das Modell ein Antwort-Tag enthält.

## Antwort-Tags

Um eine Thread-Antwort anzufordern, kann das Modell ein Tag in seiner Ausgabe enthalten:

- `[[reply_to_current]]` — Antwort auf die auslösende Discord-Nachricht.
- `[[reply_to:<id>]]` — Antwort auf eine bestimmte Nachrichten-ID aus Kontext/Verlauf.
  Aktuelle Nachrichten-IDs werden den Prompts als `[message_id: …]` angehängt; Verlaufseinträge enthalten bereits IDs.

Das Verhalten wird über `channels.discord.replyToMode` gesteuert:

- `off`: Tags ignorieren.
- `first`: Nur der erste ausgehende Chunk/Anhang ist eine Antwort.
- `all`: Jeder ausgehende Chunk/Anhang ist eine Antwort.

Hinweise zum Allowlist-Matching:

- `allowFrom`/`users`/`groupChannels` akzeptieren IDs, Namen, Tags oder Erwähnungen wie `<@id>`.
- Präfixe wie `discord:`/`user:` (Benutzer) und `channel:` (Gruppen-DMs) werden unterstützt.
- Verwenden Sie `*`, um jeden Absender/Kanal zuzulassen.
- Wenn `guilds.<id>.channels` vorhanden ist, werden nicht aufgeführte Kanäle standardmäßig abgelehnt.
- Wenn `guilds.<id>.channels` weggelassen wird, sind alle Kanäle in der allowlisteten Guild erlaubt.
- Um **keine Kanäle** zu erlauben, setzen Sie `channels.discord.groupPolicy: "disabled"` (oder lassen Sie die Allowlist leer).
- Der Konfigurations-Assistent akzeptiert `Guild/Channel`-Namen (öffentlich + privat) und löst sie, wenn möglich, zu IDs auf.
- Beim Start löst OpenClaw Kanal-/Benutzernamen in Allowlists zu IDs auf (wenn der Bot Mitglieder suchen kann)
  und protokolliert die Zuordnung; nicht auflösbare Einträge bleiben wie eingegeben.

Hinweise zu nativen Befehlen:

- Die registrierten Befehle spiegeln die Chat-Befehle von OpenClaw wider.
- Native Befehle beachten dieselben Allowlists wie DMs/Guild-Nachrichten (`channels.discord.dm.allowFrom`, `channels.discord.guilds`, kanal­spezifische Regeln).
- Slash-Befehle können in der Discord-UI für Benutzer sichtbar sein, die nicht allowlistet sind; OpenClaw erzwingt Allowlists bei der Ausführung und antwortet mit „nicht autorisiert“.

## Werkzeugaktionen

Der Agent kann `discord` mit Aktionen wie folgenden aufrufen:

- `react` / `reactions` (Reaktionen hinzufügen oder auflisten)
- `sticker`, `poll`, `permissions`
- `readMessages`, `sendMessage`, `editMessage`, `deleteMessage`
- Lese-/Such-/Pin-Werkzeug-Payloads enthalten normalisierte `timestampMs` (UTC-Epoch-ms) und `timestampUtc` neben rohen Discord-`timestamp`.
- `threadCreate`, `threadList`, `threadReply`
- `pinMessage`, `unpinMessage`, `listPins`
- `searchMessages`, `memberInfo`, `roleInfo`, `roleAdd`, `roleRemove`, `emojiList`
- `channelInfo`, `channelList`, `voiceStatus`, `eventList`, `eventCreate`
- `timeout`, `kick`, `ban`
- `setPresence` (Bot-Aktivität und Online-Status)

Discord-Nachrichten-IDs werden im injizierten Kontext (`[discord message id: …]` und Verlaufslinien) bereitgestellt, sodass der Agent sie gezielt ansprechen kann.
Emojis können Unicode sein (z. B. `✅`) oder benutzerdefinierte Emoji-Syntax wie `<:party_blob:1234567890>`.

## Sicherheit & Betrieb

- Behandeln Sie das Bot-Token wie ein Passwort; bevorzugen Sie die `DISCORD_BOT_TOKEN`-Env-Var auf überwachten Hosts oder sperren Sie die Dateiberechtigungen der Konfiguration.
- Gewähren Sie dem Bot nur die benötigten Berechtigungen (typischerweise Nachrichten lesen/senden).
- Wenn der Bot festhängt oder rate-limitiert ist, starten Sie das Gateway (`openclaw gateway --force`) neu, nachdem Sie bestätigt haben, dass keine anderen Prozesse die Discord-Sitzung belegen.
