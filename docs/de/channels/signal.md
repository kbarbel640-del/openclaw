---
summary: "Signal-Unterstützung über signal-cli (JSON-RPC + SSE), Einrichtung und Nummernmodell"
read_when:
  - Einrichten der Signal-Unterstützung
  - Debugging von Senden/Empfangen bei Signal
title: "Signal"
x-i18n:
  source_path: channels/signal.md
  source_hash: ca4de8b3685017f5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:36Z
---

# Signal (signal-cli)

Status: externe CLI-Integration. Das Gateway spricht über HTTP JSON-RPC + SSE mit `signal-cli`.

## Quick setup (beginner)

1. Verwenden Sie eine **separate Signal-Nummer** für den Bot (empfohlen).
2. Installieren Sie `signal-cli` (Java erforderlich).
3. Verknüpfen Sie das Bot-Gerät und starten Sie den Daemon:
   - `signal-cli link -n "OpenClaw"`
4. Konfigurieren Sie OpenClaw und starten Sie das Gateway.

Minimale Konfiguration:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

## Was es ist

- Signal-Kanal über `signal-cli` (keine eingebettete libsignal).
- Deterministisches Routing: Antworten gehen immer zurück zu Signal.
- Direktnachrichten teilen sich die Hauptsitzung des Agenten; Gruppen sind isoliert (`agent:<agentId>:signal:group:<groupId>`).

## Konfigurationsschreibzugriffe

Standardmäßig darf Signal Konfigurationsupdates schreiben, die durch `/config set|unset` ausgelöst werden (erfordert `commands.config: true`).

Deaktivieren mit:

```json5
{
  channels: { signal: { configWrites: false } },
}
```

## Das Nummernmodell (wichtig)

- Das Gateway verbindet sich mit einem **Signal-Gerät** (dem `signal-cli`-Konto).
- Wenn Sie den Bot auf **Ihrem persönlichen Signal-Konto** betreiben, ignoriert er Ihre eigenen Nachrichten (Schleifenschutz).
- Für „Ich schreibe dem Bot und er antwortet“ verwenden Sie eine **separate Bot-Nummer**.

## Setup (schneller Pfad)

1. Installieren Sie `signal-cli` (Java erforderlich).
2. Verknüpfen Sie ein Bot-Konto:
   - `signal-cli link -n "OpenClaw"` und scannen Sie dann den QR-Code in Signal.
3. Konfigurieren Sie Signal und starten Sie das Gateway.

Beispiel:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

Multi-Account-Unterstützung: Verwenden Sie `channels.signal.accounts` mit kontospezifischer Konfiguration und optional `name`. Siehe [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) für das gemeinsame Muster.

## Externer Daemon-Modus (httpUrl)

Wenn Sie `signal-cli` selbst verwalten möchten (langsame JVM-Cold-Starts, Container-Init oder geteilte CPUs), führen Sie den Daemon separat aus und verweisen Sie OpenClaw darauf:

```json5
{
  channels: {
    signal: {
      httpUrl: "http://127.0.0.1:8080",
      autoStart: false,
    },
  },
}
```

Dies überspringt das automatische Starten und die Startwartezeit innerhalb von OpenClaw. Für langsame Starts beim Auto-Spawn setzen Sie `channels.signal.startupTimeoutMs`.

## Zugriffskontrolle (Direktnachrichten + Gruppen)

Direktnachrichten:

- Standard: `channels.signal.dmPolicy = "pairing"`.
- Unbekannte Absender erhalten einen Kopplungscode; Nachrichten werden ignoriert, bis sie genehmigt sind (Codes laufen nach 1 Stunde ab).
- Genehmigen über:
  - `openclaw pairing list signal`
  - `openclaw pairing approve signal <CODE>`
- Kopplung ist der Standard-Token-Austausch für Signal-Direktnachrichten. Details: [Pairing](/start/pairing)
- Absender nur mit UUID (von `sourceUuid`) werden als `uuid:<id>` in `channels.signal.allowFrom` gespeichert.

Gruppen:

- `channels.signal.groupPolicy = open | allowlist | disabled`.
- `channels.signal.groupAllowFrom` steuert, wer in Gruppen auslösen darf, wenn `allowlist` gesetzt ist.

## Wie es funktioniert (Verhalten)

- `signal-cli` läuft als Daemon; das Gateway liest Ereignisse über SSE.
- Eingehende Nachrichten werden in das gemeinsame Kanal-Envelope normalisiert.
- Antworten werden immer an dieselbe Nummer oder Gruppe zurückgeroutet.

## Medien + Limits

- Ausgehender Text wird auf `channels.signal.textChunkLimit` aufgeteilt (Standard 4000).
- Optionale Zeilenumbruch-Aufteilung: Setzen Sie `channels.signal.chunkMode="newline"`, um vor der Längenaufteilung an Leerzeilen (Absatzgrenzen) zu splitten.
- Anhänge werden unterstützt (Base64 aus `signal-cli` abgerufen).
- Standard-Medienlimit: `channels.signal.mediaMaxMb` (Standard 8).
- Verwenden Sie `channels.signal.ignoreAttachments`, um das Herunterladen von Medien zu überspringen.
- Der Gruppenverlaufs-Kontext verwendet `channels.signal.historyLimit` (oder `channels.signal.accounts.*.historyLimit`), mit Fallback auf `messages.groupChat.historyLimit`. Setzen Sie `0`, um dies zu deaktivieren (Standard 50).

## Tippen + Lesebestätigungen

- **Tippen-Indikatoren**: OpenClaw sendet Tipp-Signale über `signal-cli sendTyping` und aktualisiert sie, während eine Antwort läuft.
- **Lesebestätigungen**: Wenn `channels.signal.sendReadReceipts` true ist, leitet OpenClaw Lesebestätigungen für erlaubte Direktnachrichten weiter.
- Signal-cli stellt keine Lesebestätigungen für Gruppen bereit.

## Reaktionen (Nachrichten-Werkzeug)

- Verwenden Sie `message action=react` mit `channel=signal`.
- Ziele: Absender E.164 oder UUID (verwenden Sie `uuid:<id>` aus der Kopplungs-Ausgabe; eine nackte UUID funktioniert ebenfalls).
- `messageId` ist der Signal-Zeitstempel der Nachricht, auf die Sie reagieren.
- Gruppenreaktionen erfordern `targetAuthor` oder `targetAuthorUuid`.

Beispiele:

```
message action=react channel=signal target=uuid:123e4567-e89b-12d3-a456-426614174000 messageId=1737630212345 emoji=🔥
message action=react channel=signal target=+15551234567 messageId=1737630212345 emoji=🔥 remove=true
message action=react channel=signal target=signal:group:<groupId> targetAuthor=uuid:<sender-uuid> messageId=1737630212345 emoji=✅
```

Konfiguration:

- `channels.signal.actions.reactions`: Reaktionsaktionen aktivieren/deaktivieren (Standard true).
- `channels.signal.reactionLevel`: `off | ack | minimal | extensive`.
  - `off`/`ack` deaktiviert Agent-Reaktionen (Nachrichten-Werkzeug `react` gibt einen Fehler aus).
  - `minimal`/`extensive` aktiviert Agent-Reaktionen und setzt die Anleitungsebene.
- Konto-spezifische Überschreibungen: `channels.signal.accounts.<id>.actions.reactions`, `channels.signal.accounts.<id>.reactionLevel`.

## Zustellziele (CLI/Cron)

- Direktnachrichten: `signal:+15551234567` (oder einfaches E.164).
- UUID-Direktnachrichten: `uuid:<id>` (oder nackte UUID).
- Gruppen: `signal:group:<groupId>`.
- Benutzernamen: `username:<name>` (falls von Ihrem Signal-Konto unterstützt).

## Konfigurationsreferenz (Signal)

Vollständige Konfiguration: [Configuration](/gateway/configuration)

Anbieteroptionen:

- `channels.signal.enabled`: Kanalstart aktivieren/deaktivieren.
- `channels.signal.account`: E.164 für das Bot-Konto.
- `channels.signal.cliPath`: Pfad zu `signal-cli`.
- `channels.signal.httpUrl`: vollständige Daemon-URL (überschreibt Host/Port).
- `channels.signal.httpHost`, `channels.signal.httpPort`: Daemon-Bindung (Standard 127.0.0.1:8080).
- `channels.signal.autoStart`: Daemon automatisch starten (Standard true, wenn `httpUrl` nicht gesetzt).
- `channels.signal.startupTimeoutMs`: Start-Wartezeit in ms (Limit 120000).
- `channels.signal.receiveMode`: `on-start | manual`.
- `channels.signal.ignoreAttachments`: Download von Anhängen überspringen.
- `channels.signal.ignoreStories`: Stories vom Daemon ignorieren.
- `channels.signal.sendReadReceipts`: Lesebestätigungen weiterleiten.
- `channels.signal.dmPolicy`: `pairing | allowlist | open | disabled` (Standard: Kopplung).
- `channels.signal.allowFrom`: Direktnachrichten-Allowlist (E.164 oder `uuid:<id>`). `open` erfordert `"*"`. Signal hat keine Benutzernamen; verwenden Sie Telefon-/UUID-IDs.
- `channels.signal.groupPolicy`: `open | allowlist | disabled` (Standard: Allowlist).
- `channels.signal.groupAllowFrom`: Gruppen-Absender-Allowlist.
- `channels.signal.historyLimit`: maximale Anzahl an Gruppennachrichten als Kontext (0 deaktiviert).
- `channels.signal.dmHistoryLimit`: Verlaufslimit für Direktnachrichten in Benutzer-Turns. Benutzer-spezifische Überschreibungen: `channels.signal.dms["<phone_or_uuid>"].historyLimit`.
- `channels.signal.textChunkLimit`: ausgehende Chunk-Größe (Zeichen).
- `channels.signal.chunkMode`: `length` (Standard) oder `newline`, um vor der Längenaufteilung an Leerzeilen (Absatzgrenzen) zu splitten.
- `channels.signal.mediaMaxMb`: Medienlimit für eingehend/ausgehend (MB).

Zugehörige globale Optionen:

- `agents.list[].groupChat.mentionPatterns` (Signal unterstützt keine nativen Erwähnungen).
- `messages.groupChat.mentionPatterns` (globaler Fallback).
- `messages.responsePrefix`.
