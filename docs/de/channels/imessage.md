---
summary: "Legacy‑iMessage‑Unterstützung über imsg (JSON‑RPC über stdio). Neue Setups sollten BlueBubbles verwenden."
read_when:
  - Einrichten der iMessage‑Unterstützung
  - Debugging von iMessage Senden/Empfangen
title: iMessage
x-i18n:
  source_path: channels/imessage.md
  source_hash: 7c8c276701528b8d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:36Z
---

# iMessage (Legacy: imsg)

> **Empfohlen:** Verwenden Sie [BlueBubbles](/channels/bluebubbles) für neue iMessage‑Setups.
>
> Der Kanal `imsg` ist eine Legacy‑Integration über eine externe CLI und kann in einer zukünftigen Version entfernt werden.

Status: Legacy‑Integration über externe CLI. Der Gateway startet `imsg rpc` (JSON‑RPC über stdio).

## Schnellstart (Einsteiger)

1. Stellen Sie sicher, dass „Nachrichten“ auf diesem Mac angemeldet ist.
2. Installieren Sie `imsg`:
   - `brew install steipete/tap/imsg`
3. Konfigurieren Sie OpenClaw mit `channels.imessage.cliPath` und `channels.imessage.dbPath`.
4. Starten Sie den Gateway und genehmigen Sie alle macOS‑Abfragen (Automation + Vollzugriff auf Festplatte).

Minimale Konfiguration:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "/usr/local/bin/imsg",
      dbPath: "/Users/<you>/Library/Messages/chat.db",
    },
  },
}
```

## Was es ist

- iMessage‑Kanal auf Basis von `imsg` unter macOS.
- Deterministisches Routing: Antworten gehen immer zurück zu iMessage.
- Direktnachrichten teilen sich die Hauptsitzung des Agenten; Gruppen sind isoliert (`agent:<agentId>:imessage:group:<chat_id>`).
- Wenn ein Thread mit mehreren Teilnehmern mit `is_group=false` ankommt, können Sie ihn dennoch isolieren, indem Sie `chat_id` mit `channels.imessage.groups` verwenden (siehe „Gruppenähnliche Threads“ unten).

## Config‑Schreibzugriffe

Standardmäßig darf iMessage Konfigurationsupdates schreiben, die durch `/config set|unset` ausgelöst werden (erfordert `commands.config: true`).

Deaktivieren mit:

```json5
{
  channels: { imessage: { configWrites: false } },
}
```

## Anforderungen

- macOS mit angemeldeten Nachrichten.
- Vollzugriff auf Festplatte für OpenClaw + `imsg` (Zugriff auf die Nachrichten‑DB).
- Automation‑Berechtigung beim Senden.
- `channels.imessage.cliPath` kann auf jeden Befehl zeigen, der stdin/stdout proxyt (z. B. ein Wrapper‑Skript, das per SSH zu einem anderen Mac verbindet und `imsg rpc` ausführt).

## Setup (Schnellpfad)

1. Stellen Sie sicher, dass „Nachrichten“ auf diesem Mac angemeldet ist.
2. Konfigurieren Sie iMessage und starten Sie den Gateway.

### Dedizierter Bot‑macOS‑Benutzer (für isolierte Identität)

Wenn der Bot von einer **separaten iMessage‑Identität** senden soll (und Ihre persönlichen Nachrichten sauber bleiben sollen), verwenden Sie eine dedizierte Apple‑ID + einen dedizierten macOS‑Benutzer.

1. Erstellen Sie eine dedizierte Apple‑ID (Beispiel: `my-cool-bot@icloud.com`).
   - Apple kann eine Telefonnummer für Verifizierung / 2FA verlangen.
2. Erstellen Sie einen macOS‑Benutzer (Beispiel: `openclawhome`) und melden Sie sich dort an.
3. Öffnen Sie „Nachrichten“ in diesem macOS‑Benutzer und melden Sie sich mit der Bot‑Apple‑ID bei iMessage an.
4. Aktivieren Sie „Remote Login“ (Systemeinstellungen → Allgemein → Teilen → Remote Login).
5. Installieren Sie `imsg`:
   - `brew install steipete/tap/imsg`
6. Richten Sie SSH so ein, dass `ssh <bot-macos-user>@localhost true` ohne Passwort funktioniert.
7. Richten Sie `channels.imessage.accounts.bot.cliPath` auf einen SSH‑Wrapper aus, der `imsg` als Bot‑Benutzer ausführt.

Hinweis zum ersten Start: Senden/Empfangen kann GUI‑Genehmigungen (Automation + Vollzugriff auf Festplatte) im _Bot‑macOS‑Benutzer_ erfordern. Wenn `imsg rpc` festzustecken scheint oder beendet wird, melden Sie sich bei diesem Benutzer an (Bildschirmfreigabe hilft), führen Sie einmalig `imsg chats --limit 1` / `imsg send ...` aus, genehmigen Sie die Abfragen und versuchen Sie es erneut.

Beispiel‑Wrapper (`chmod +x`). Ersetzen Sie `<bot-macos-user>` durch Ihren tatsächlichen macOS‑Benutzernamen:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run an interactive SSH once first to accept host keys:
#   ssh <bot-macos-user>@localhost true
exec /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=5 -T <bot-macos-user>@localhost \
  "/usr/local/bin/imsg" "$@"
```

Beispiel‑Konfiguration:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      accounts: {
        bot: {
          name: "Bot",
          enabled: true,
          cliPath: "/path/to/imsg-bot",
          dbPath: "/Users/<bot-macos-user>/Library/Messages/chat.db",
        },
      },
    },
  },
}
```

Für Setups mit nur einem Konto verwenden Sie flache Optionen (`channels.imessage.cliPath`, `channels.imessage.dbPath`) anstelle der `accounts`‑Map.

### Remote/SSH‑Variante (optional)

Wenn Sie iMessage auf einem anderen Mac betreiben möchten, setzen Sie `channels.imessage.cliPath` auf einen Wrapper, der `imsg` auf dem entfernten macOS‑Host über SSH ausführt. OpenClaw benötigt nur stdio.

Beispiel‑Wrapper:

```bash
#!/usr/bin/env bash
exec ssh -T gateway-host imsg "$@"
```

**Remote‑Anhänge:** Wenn `cliPath` über SSH auf einen Remote‑Host zeigt, referenzieren Anhang‑Pfade in der Nachrichten‑Datenbank Dateien auf der entfernten Maschine. OpenClaw kann diese automatisch per SCP abrufen, indem Sie `channels.imessage.remoteHost` setzen:

```json5
{
  channels: {
    imessage: {
      cliPath: "~/imsg-ssh", // SSH wrapper to remote Mac
      remoteHost: "user@gateway-host", // for SCP file transfer
      includeAttachments: true,
    },
  },
}
```

Wenn `remoteHost` nicht gesetzt ist, versucht OpenClaw, dies automatisch zu erkennen, indem der SSH‑Befehl in Ihrem Wrapper‑Skript geparst wird. Eine explizite Konfiguration wird für Zuverlässigkeit empfohlen.

#### Remote‑Mac über Tailscale (Beispiel)

Wenn der Gateway auf einem Linux‑Host/VM läuft, iMessage aber auf einem Mac ausgeführt werden muss, ist Tailscale die einfachste Brücke: Der Gateway kommuniziert über das Tailnet mit dem Mac, führt `imsg` per SSH aus und holt Anhänge per SCP zurück.

Architektur:

```
┌──────────────────────────────┐          SSH (imsg rpc)          ┌──────────────────────────┐
│ Gateway host (Linux/VM)      │──────────────────────────────────▶│ Mac with Messages + imsg │
│ - openclaw gateway           │          SCP (attachments)        │ - Messages signed in     │
│ - channels.imessage.cliPath  │◀──────────────────────────────────│ - Remote Login enabled   │
└──────────────────────────────┘                                   └──────────────────────────┘
              ▲
              │ Tailscale tailnet (hostname or 100.x.y.z)
              ▼
        user@gateway-host
```

Konkretes Konfigurationsbeispiel (Tailscale‑Hostname):

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "~/.openclaw/scripts/imsg-ssh",
      remoteHost: "bot@mac-mini.tailnet-1234.ts.net",
      includeAttachments: true,
      dbPath: "/Users/bot/Library/Messages/chat.db",
    },
  },
}
```

Beispiel‑Wrapper (`~/.openclaw/scripts/imsg-ssh`):

```bash
#!/usr/bin/env bash
exec ssh -T bot@mac-mini.tailnet-1234.ts.net imsg "$@"
```

Hinweise:

- Stellen Sie sicher, dass der Mac bei „Nachrichten“ angemeldet ist und „Remote Login“ aktiviert ist.
- Verwenden Sie SSH‑Schlüssel, damit `ssh bot@mac-mini.tailnet-1234.ts.net` ohne Abfragen funktioniert.
- `remoteHost` sollte dem SSH‑Ziel entsprechen, damit SCP Anhänge abrufen kann.

Mehrkonten‑Unterstützung: Verwenden Sie `channels.imessage.accounts` mit kontospezifischer Konfiguration und optionalem `name`. Siehe [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) für das gemeinsame Muster. Committen Sie `~/.openclaw/openclaw.json` nicht (enthält oft Tokens).

## Zugriffskontrolle (Direktnachrichten + Gruppen)

Direktnachrichten:

- Standard: `channels.imessage.dmPolicy = "pairing"`.
- Unbekannte Absender erhalten einen Pairing‑Code; Nachrichten werden ignoriert, bis sie genehmigt sind (Codes laufen nach 1 Stunde ab).
- Genehmigen über:
  - `openclaw pairing list imessage`
  - `openclaw pairing approve imessage <CODE>`
- Pairing ist der Standard‑Token‑Austausch für iMessage‑Direktnachrichten. Details: [Pairing](/start/pairing)

Gruppen:

- `channels.imessage.groupPolicy = open | allowlist | disabled`.
- `channels.imessage.groupAllowFrom` steuert, wer in Gruppen auslösen kann, wenn `allowlist` gesetzt ist.
- Mention‑Gating verwendet `agents.list[].groupChat.mentionPatterns` (oder `messages.groupChat.mentionPatterns`), da iMessage keine nativen Mention‑Metadaten hat.
- Multi‑Agent‑Override: Setzen Sie agentenspezifische Muster unter `agents.list[].groupChat.mentionPatterns`.

## Funktionsweise (Verhalten)

- `imsg` streamt Nachrichtenereignisse; der Gateway normalisiert sie in das gemeinsame Channel‑Envelope.
- Antworten werden immer an dieselbe Chat‑ID oder denselben Handle zurückgeroutet.

## Gruppenähnliche Threads (`is_group=false`)

Einige iMessage‑Threads können mehrere Teilnehmer haben, aber dennoch mit `is_group=false` ankommen, abhängig davon, wie „Nachrichten“ die Chat‑Kennung speichert.

Wenn Sie explizit einen `chat_id` unter `channels.imessage.groups` konfigurieren, behandelt OpenClaw diesen Thread als „Gruppe“ für:

- Sitzungsisolation (separater `agent:<agentId>:imessage:group:<chat_id>`‑Sitzungsschlüssel)
- Gruppen‑Allowlisting / Mention‑Gating‑Verhalten

Beispiel:

```json5
{
  channels: {
    imessage: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "42": { requireMention: false },
      },
    },
  },
}
```

Dies ist nützlich, wenn Sie für einen bestimmten Thread eine isolierte Persönlichkeit/ein isoliertes Modell möchten (siehe [Multi‑Agent‑Routing](/concepts/multi-agent)). Für Dateisystem‑Isolation siehe [Sandboxing](/gateway/sandboxing).

## Medien + Limits

- Optionale Anhangsaufnahme über `channels.imessage.includeAttachments`.
- Medienlimit über `channels.imessage.mediaMaxMb`.

## Limits

- Ausgehender Text wird auf `channels.imessage.textChunkLimit` gestückelt (Standard 4000).
- Optionales Newline‑Chunking: Setzen Sie `channels.imessage.chunkMode="newline"`, um vor dem Längen‑Chunking an Leerzeilen (Absatzgrenzen) zu trennen.
- Medien‑Uploads sind durch `channels.imessage.mediaMaxMb` begrenzt (Standard 16).

## Adressierung / Zustellziele

Bevorzugen Sie `chat_id` für stabiles Routing:

- `chat_id:123` (bevorzugt)
- `chat_guid:...`
- `chat_identifier:...`
- direkte Handles: `imessage:+1555` / `sms:+1555` / `user@example.com`

Chats auflisten:

```
imsg chats --limit 20
```

## Konfigurationsreferenz (iMessage)

Vollständige Konfiguration: [Konfiguration](/gateway/configuration)

Anbieteroptionen:

- `channels.imessage.enabled`: Kanalstart aktivieren/deaktivieren.
- `channels.imessage.cliPath`: Pfad zu `imsg`.
- `channels.imessage.dbPath`: Pfad zur Nachrichten‑DB.
- `channels.imessage.remoteHost`: SSH‑Host für SCP‑Anhangsübertragung, wenn `cliPath` auf einen Remote‑Mac zeigt (z. B. `user@gateway-host`). Wird automatisch aus dem SSH‑Wrapper erkannt, falls nicht gesetzt.
- `channels.imessage.service`: `imessage | sms | auto`.
- `channels.imessage.region`: SMS‑Region.
- `channels.imessage.dmPolicy`: `pairing | allowlist | open | disabled` (Standard: Pairing).
- `channels.imessage.allowFrom`: DM‑Allowlist (Handles, E‑Mails, E.164‑Nummern oder `chat_id:*`). `open` erfordert `"*"`. iMessage hat keine Benutzernamen; verwenden Sie Handles oder Chat‑Ziele.
- `channels.imessage.groupPolicy`: `open | allowlist | disabled` (Standard: Allowlist).
- `channels.imessage.groupAllowFrom`: Gruppen‑Absender‑Allowlist.
- `channels.imessage.historyLimit` / `channels.imessage.accounts.*.historyLimit`: maximale Anzahl von Gruppen‑Nachrichten, die als Kontext einbezogen werden (0 deaktiviert).
- `channels.imessage.dmHistoryLimit`: DM‑Verlaufslimit in Benutzerzügen. Benutzerbezogene Overrides: `channels.imessage.dms["<handle>"].historyLimit`.
- `channels.imessage.groups`: gruppenspezifische Defaults + Allowlist (verwenden Sie `"*"` für globale Defaults).
- `channels.imessage.includeAttachments`: Anhänge in den Kontext aufnehmen.
- `channels.imessage.mediaMaxMb`: Eingehendes/ausgehendes Medienlimit (MB).
- `channels.imessage.textChunkLimit`: Größe ausgehender Chunks (Zeichen).
- `channels.imessage.chunkMode`: `length` (Standard) oder `newline`, um vor dem Längen‑Chunking an Leerzeilen (Absatzgrenzen) zu trennen.

Zugehörige globale Optionen:

- `agents.list[].groupChat.mentionPatterns` (oder `messages.groupChat.mentionPatterns`).
- `messages.responsePrefix`.
