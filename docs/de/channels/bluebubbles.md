---
summary: "iMessage über den BlueBubbles-macOS-Server (REST Senden/Empfangen, Tippen, Reaktionen, Pairing, erweiterte Aktionen)."
read_when:
  - Einrichten des BlueBubbles-Kanals
  - Fehlerbehebung beim Webhook-Pairing
  - Konfiguration von iMessage auf macOS
title: "BlueBubbles"
x-i18n:
  source_path: channels/bluebubbles.md
  source_hash: 1414cf657d347ee7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:34Z
---

# BlueBubbles (macOS REST)

Status: Gebündeltes Plugin, das über HTTP mit dem BlueBubbles-macOS-Server kommuniziert. **Empfohlen für die iMessage-Integration** aufgrund der umfangreicheren API und der einfacheren Einrichtung im Vergleich zum Legacy-imsg-Kanal.

## Übersicht

- Läuft auf macOS über die BlueBubbles-Helfer-App ([bluebubbles.app](https://bluebubbles.app)).
- Empfohlen/getestet: macOS Sequoia (15). macOS Tahoe (26) funktioniert; Bearbeiten ist derzeit auf Tahoe defekt, und Gruppen-Icon-Updates können Erfolg melden, aber nicht synchronisieren.
- OpenClaw kommuniziert über dessen REST-API (`GET /api/v1/ping`, `POST /message/text`, `POST /chat/:id/*`).
- Eingehende Nachrichten kommen über Webhooks; ausgehende Antworten, Tippindikatoren, Lesebestätigungen und Tapbacks sind REST-Aufrufe.
- Anhänge und Sticker werden als eingehende Medien ingestiert (und dem Agenten angezeigt, wenn möglich).
- Pairing/Allowlist funktioniert genauso wie bei anderen Kanälen (`/start/pairing` usw.) mit `channels.bluebubbles.allowFrom` + Pairing-Codes.
- Reaktionen werden als Systemereignisse dargestellt, genau wie bei Slack/Telegram, sodass Agenten sie vor der Antwort „erwähnen“ können.
- Erweiterte Funktionen: Bearbeiten, Zurückziehen, Antwort-Threading, Nachrichteneffekte, Gruppenverwaltung.

## Schnellstart

1. Installieren Sie den BlueBubbles-Server auf Ihrem Mac (folgen Sie den Anweisungen unter [bluebubbles.app/install](https://bluebubbles.app/install)).
2. Aktivieren Sie in der BlueBubbles-Konfiguration die Web-API und setzen Sie ein Passwort.
3. Führen Sie `openclaw onboard` aus und wählen Sie BlueBubbles, oder konfigurieren Sie manuell:
   ```json5
   {
     channels: {
       bluebubbles: {
         enabled: true,
         serverUrl: "http://192.168.1.100:1234",
         password: "example-password",
         webhookPath: "/bluebubbles-webhook",
       },
     },
   }
   ```
4. Richten Sie die BlueBubbles-Webhooks auf Ihr Gateway aus (Beispiel: `https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`).
5. Starten Sie das Gateway; es registriert den Webhook-Handler und startet das Pairing.

## Messages.app aktiv halten (VM / Headless-Setups)

Einige macOS-VM-/Always-on-Setups können dazu führen, dass Messages.app „idle“ wird (eingehende Ereignisse stoppen, bis die App geöffnet bzw. in den Vordergrund gebracht wird). Ein einfacher Workaround ist, **Messages alle 5 Minuten anzustoßen**, mithilfe eines AppleScripts + LaunchAgent.

### 1) AppleScript speichern

Speichern Sie dies als:

- `~/Scripts/poke-messages.scpt`

Beispielskript (nicht interaktiv; stiehlt keinen Fokus):

```applescript
try
  tell application "Messages"
    if not running then
      launch
    end if

    -- Touch the scripting interface to keep the process responsive.
    set _chatCount to (count of chats)
  end tell
on error
  -- Ignore transient failures (first-run prompts, locked session, etc).
end try
```

### 2) LaunchAgent installieren

Speichern Sie dies als:

- `~/Library/LaunchAgents/com.user.poke-messages.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.user.poke-messages</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>/usr/bin/osascript &quot;$HOME/Scripts/poke-messages.scpt&quot;</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>StandardOutPath</key>
    <string>/tmp/poke-messages.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/poke-messages.err</string>
  </dict>
</plist>
```

Hinweise:

- Dies läuft **alle 300 Sekunden** und **beim Login**.
- Der erste Lauf kann macOS-**Automatisierungs**-Aufforderungen auslösen (`osascript` → Messages). Genehmigen Sie diese in derselben Benutzersitzung, die den LaunchAgent ausführt.

Laden Sie ihn:

```bash
launchctl unload ~/Library/LaunchAgents/com.user.poke-messages.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.user.poke-messages.plist
```

## Einführung

BlueBubbles ist im interaktiven Setup-Assistenten verfügbar:

```
openclaw onboard
```

Der Assistent fragt nach:

- **Server-URL** (erforderlich): Adresse des BlueBubbles-Servers (z. B. `http://192.168.1.100:1234`)
- **Passwort** (erforderlich): API-Passwort aus den BlueBubbles-Servereinstellungen
- **Webhook-Pfad** (optional): Standard ist `/bluebubbles-webhook`
- **DM-Richtlinie**: Pairing, Allowlist, offen oder deaktiviert
- **Allowlist**: Telefonnummern, E-Mails oder Chat-Ziele

Sie können BlueBubbles auch per CLI hinzufügen:

```
openclaw channels add bluebubbles --http-url http://192.168.1.100:1234 --password <password>
```

## Zugriffskontrolle (DMs + Gruppen)

DMs:

- Standard: `channels.bluebubbles.dmPolicy = "pairing"`.
- Unbekannte Absender erhalten einen Pairing-Code; Nachrichten werden ignoriert, bis sie genehmigt sind (Codes laufen nach 1 Stunde ab).
- Genehmigen über:
  - `openclaw pairing list bluebubbles`
  - `openclaw pairing approve bluebubbles <CODE>`
- Pairing ist der Standard-Token-Austausch. Details: [Pairing](/start/pairing)

Gruppen:

- `channels.bluebubbles.groupPolicy = open | allowlist | disabled` (Standard: `allowlist`).
- `channels.bluebubbles.groupAllowFrom` steuert, wer in Gruppen auslösen kann, wenn `allowlist` gesetzt ist.

### Erwähnungs-Gating (Gruppen)

BlueBubbles unterstützt Erwähnungs-Gating für Gruppenchats und entspricht dem Verhalten von iMessage/WhatsApp:

- Verwendet `agents.list[].groupChat.mentionPatterns` (oder `messages.groupChat.mentionPatterns`), um Erwähnungen zu erkennen.
- Wenn `requireMention` für eine Gruppe aktiviert ist, antwortet der Agent nur bei Erwähnung.
- Steuerbefehle von autorisierten Absendern umgehen das Erwähnungs-Gating.

Pro-Gruppen-Konfiguration:

```json5
{
  channels: {
    bluebubbles: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true }, // default for all groups
        "iMessage;-;chat123": { requireMention: false }, // override for specific group
      },
    },
  },
}
```

### Befehls-Gating

- Steuerbefehle (z. B. `/config`, `/model`) erfordern Autorisierung.
- Verwendet `allowFrom` und `groupAllowFrom`, um die Befehlsautorisierung zu bestimmen.
- Autorisierte Absender können Steuerbefehle auch ohne Erwähnung in Gruppen ausführen.

## Tippen + Lesebestätigungen

- **Tippindikatoren**: Werden automatisch vor und während der Antwortgenerierung gesendet.
- **Lesebestätigungen**: Gesteuert durch `channels.bluebubbles.sendReadReceipts` (Standard: `true`).
- **Tippindikatoren**: OpenClaw sendet Tippstart-Ereignisse; BlueBubbles beendet das Tippen automatisch beim Senden oder nach Timeout (manuelles Stoppen per DELETE ist unzuverlässig).

```json5
{
  channels: {
    bluebubbles: {
      sendReadReceipts: false, // disable read receipts
    },
  },
}
```

## Erweiterte Aktionen

BlueBubbles unterstützt erweiterte Nachrichtenaktionen, wenn sie in der Konfiguration aktiviert sind:

```json5
{
  channels: {
    bluebubbles: {
      actions: {
        reactions: true, // tapbacks (default: true)
        edit: true, // edit sent messages (macOS 13+, broken on macOS 26 Tahoe)
        unsend: true, // unsend messages (macOS 13+)
        reply: true, // reply threading by message GUID
        sendWithEffect: true, // message effects (slam, loud, etc.)
        renameGroup: true, // rename group chats
        setGroupIcon: true, // set group chat icon/photo (flaky on macOS 26 Tahoe)
        addParticipant: true, // add participants to groups
        removeParticipant: true, // remove participants from groups
        leaveGroup: true, // leave group chats
        sendAttachment: true, // send attachments/media
      },
    },
  },
}
```

Verfügbare Aktionen:

- **react**: Tapback-Reaktionen hinzufügen/entfernen (`messageId`, `emoji`, `remove`)
- **edit**: Eine gesendete Nachricht bearbeiten (`messageId`, `text`)
- **unsend**: Eine Nachricht zurückziehen (`messageId`)
- **reply**: Auf eine bestimmte Nachricht antworten (`messageId`, `text`, `to`)
- **sendWithEffect**: Mit iMessage-Effekt senden (`text`, `to`, `effectId`)
- **renameGroup**: Einen Gruppenchat umbenennen (`chatGuid`, `displayName`)
- **setGroupIcon**: Das Icon/Foto eines Gruppenchats setzen (`chatGuid`, `media`) — instabil auf macOS 26 Tahoe (API kann Erfolg melden, aber das Icon synchronisiert nicht).
- **addParticipant**: Jemanden zu einer Gruppe hinzufügen (`chatGuid`, `address`)
- **removeParticipant**: Jemanden aus einer Gruppe entfernen (`chatGuid`, `address`)
- **leaveGroup**: Einen Gruppenchat verlassen (`chatGuid`)
- **sendAttachment**: Medien/Dateien senden (`to`, `buffer`, `filename`, `asVoice`)
  - Sprachnotizen: Setzen Sie `asVoice: true` mit **MP3**- oder **CAF**-Audio, um als iMessage-Sprachnachricht zu senden. BlueBubbles konvertiert MP3 → CAF beim Senden von Sprachnotizen.

### Nachrichten-IDs (kurz vs. vollständig)

OpenClaw kann _kurze_ Nachrichten-IDs anzeigen (z. B. `1`, `2`), um Tokens zu sparen.

- `MessageSid` / `ReplyToId` können kurze IDs sein.
- `MessageSidFull` / `ReplyToIdFull` enthalten die vollständigen Anbieter-IDs.
- Kurze IDs sind im Speicher; sie können bei Neustart oder Cache-Eviction ablaufen.
- Aktionen akzeptieren kurze oder vollständige `messageId`, kurze IDs erzeugen jedoch Fehler, wenn sie nicht mehr verfügbar sind.

Verwenden Sie vollständige IDs für dauerhafte Automatisierungen und Speicherung:

- Templates: `{{MessageSidFull}}`, `{{ReplyToIdFull}}`
- Kontext: `MessageSidFull` / `ReplyToIdFull` in eingehenden Payloads

Siehe [Configuration](/gateway/configuration) für Template-Variablen.

## Block-Streaming

Steuern Sie, ob Antworten als einzelne Nachricht gesendet oder blockweise gestreamt werden:

```json5
{
  channels: {
    bluebubbles: {
      blockStreaming: true, // enable block streaming (off by default)
    },
  },
}
```

## Medien + Limits

- Eingehende Anhänge werden heruntergeladen und im Medien-Cache gespeichert.
- Medienlimit über `channels.bluebubbles.mediaMaxMb` (Standard: 8 MB).
- Ausgehender Text wird auf `channels.bluebubbles.textChunkLimit` begrenzt (Standard: 4000 Zeichen).

## Konfigurationsreferenz

Vollständige Konfiguration: [Configuration](/gateway/configuration)

Anbieteroptionen:

- `channels.bluebubbles.enabled`: Kanal aktivieren/deaktivieren.
- `channels.bluebubbles.serverUrl`: Basis-URL der BlueBubbles-REST-API.
- `channels.bluebubbles.password`: API-Passwort.
- `channels.bluebubbles.webhookPath`: Webhook-Endpunktpfad (Standard: `/bluebubbles-webhook`).
- `channels.bluebubbles.dmPolicy`: `pairing | allowlist | open | disabled` (Standard: `pairing`).
- `channels.bluebubbles.allowFrom`: DM-Allowlist (Handles, E-Mails, E.164-Nummern, `chat_id:*`, `chat_guid:*`).
- `channels.bluebubbles.groupPolicy`: `open | allowlist | disabled` (Standard: `allowlist`).
- `channels.bluebubbles.groupAllowFrom`: Gruppen-Absender-Allowlist.
- `channels.bluebubbles.groups`: Pro-Gruppen-Konfiguration (`requireMention` usw.).
- `channels.bluebubbles.sendReadReceipts`: Lesebestätigungen senden (Standard: `true`).
- `channels.bluebubbles.blockStreaming`: Block-Streaming aktivieren (Standard: `false`; erforderlich für Streaming-Antworten).
- `channels.bluebubbles.textChunkLimit`: Größe der ausgehenden Blöcke in Zeichen (Standard: 4000).
- `channels.bluebubbles.chunkMode`: `length` (Standard) teilt nur bei Überschreiten von `textChunkLimit`; `newline` teilt an Leerzeilen (Absatzgrenzen) vor der Längenaufteilung.
- `channels.bluebubbles.mediaMaxMb`: Eingehendes Medienlimit in MB (Standard: 8).
- `channels.bluebubbles.historyLimit`: Maximale Gruppen-Nachrichten für Kontext (0 deaktiviert).
- `channels.bluebubbles.dmHistoryLimit`: DM-Historienlimit.
- `channels.bluebubbles.actions`: Bestimmte Aktionen aktivieren/deaktivieren.
- `channels.bluebubbles.accounts`: Multi-Account-Konfiguration.

Zugehörige globale Optionen:

- `agents.list[].groupChat.mentionPatterns` (oder `messages.groupChat.mentionPatterns`).
- `messages.responsePrefix`.

## Adressierung / Zustellziele

Bevorzugen Sie `chat_guid` für stabiles Routing:

- `chat_guid:iMessage;-;+15555550123` (bevorzugt für Gruppen)
- `chat_id:123`
- `chat_identifier:...`
- Direkte Handles: `+15555550123`, `user@example.com`
  - Wenn ein direkter Handle keinen bestehenden DM-Chat hat, erstellt OpenClaw einen über `POST /api/v1/chat/new`. Dies erfordert, dass die BlueBubbles Private API aktiviert ist.

## Sicherheit

- Webhook-Anfragen werden authentifiziert, indem `guid`/`password`-Query-Parameter oder -Header mit `channels.bluebubbles.password` verglichen werden. Anfragen von `localhost` werden ebenfalls akzeptiert.
- Halten Sie das API-Passwort und den Webhook-Endpunkt geheim (behandeln Sie sie wie Zugangsdaten).
- Localhost-Vertrauen bedeutet, dass ein Reverse Proxy auf demselben Host das Passwort unbeabsichtigt umgehen kann. Wenn Sie das Gateway proxien, verlangen Sie Authentifizierung am Proxy und konfigurieren Sie `gateway.trustedProxies`. Siehe [Gateway security](/gateway/security#reverse-proxy-configuration).
- Aktivieren Sie HTTPS + Firewall-Regeln auf dem BlueBubbles-Server, wenn Sie ihn außerhalb Ihres LANs exponieren.

## Fehlerbehebung

- Wenn Tipp-/Leseereignisse nicht mehr funktionieren, prüfen Sie die BlueBubbles-Webhook-Logs und verifizieren Sie, dass der Gateway-Pfad mit `channels.bluebubbles.webhookPath` übereinstimmt.
- Pairing-Codes laufen nach einer Stunde ab; verwenden Sie `openclaw pairing list bluebubbles` und `openclaw pairing approve bluebubbles <code>`.
- Reaktionen erfordern die BlueBubbles Private API (`POST /api/v1/message/react`); stellen Sie sicher, dass die Serverversion diese bereitstellt.
- Bearbeiten/Zürückziehen erfordern macOS 13+ und eine kompatible BlueBubbles-Serverversion. Auf macOS 26 (Tahoe) ist Bearbeiten derzeit aufgrund von Private-API-Änderungen defekt.
- Gruppen-Icon-Updates können auf macOS 26 (Tahoe) instabil sein: Die API kann Erfolg melden, aber das neue Icon synchronisiert nicht.
- OpenClaw blendet bekannte defekte Aktionen basierend auf der macOS-Version des BlueBubbles-Servers automatisch aus. Wenn Bearbeiten auf macOS 26 (Tahoe) dennoch erscheint, deaktivieren Sie es manuell mit `channels.bluebubbles.actions.edit=false`.
- Für Status-/Health-Informationen: `openclaw status --all` oder `openclaw status --deep`.

Für eine allgemeine Referenz zum Kanal-Workflow siehe [Channels](/channels) und den Leitfaden [Plugins](/plugins).
