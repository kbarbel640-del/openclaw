---
summary: „Matrix‑Unterstützungsstatus, Funktionen und Konfiguration“
read_when:
  - Arbeiten an Funktionen des Matrix‑Kanals
title: „Matrix“
x-i18n:
  source_path: channels/matrix.md
  source_hash: 923ff717cf14d01c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:38Z
---

# Matrix (Plugin)

Matrix ist ein offenes, dezentrales Messaging‑Protokoll. OpenClaw verbindet sich als Matrix‑**Benutzer**
auf einem beliebigen Homeserver, daher benötigen Sie ein Matrix‑Konto für den Bot. Sobald er angemeldet ist, können Sie dem Bot Direktnachrichten senden
oder ihn in Räume (Matrix „Groups“) einladen. Beeper ist ebenfalls eine gültige Client‑Option,
erfordert jedoch, dass E2EE aktiviert ist.

Status: unterstützt über Plugin (@vector-im/matrix-bot-sdk). Direktnachrichten, Räume, Threads, Medien, Reaktionen,
Umfragen (Senden + Poll‑Start als Text), Standort sowie E2EE (mit Krypto‑Unterstützung).

## Plugin erforderlich

Matrix wird als Plugin ausgeliefert und ist nicht im Core‑Install enthalten.

Installation über die CLI (npm‑Registry):

```bash
openclaw plugins install @openclaw/matrix
```

Lokaler Checkout (bei Ausführung aus einem Git‑Repo):

```bash
openclaw plugins install ./extensions/matrix
```

Wenn Sie Matrix während der Konfiguration/Einführung auswählen und ein Git‑Checkout erkannt wird,
bietet OpenClaw den lokalen Installationspfad automatisch an.

Details: [Plugins](/plugin)

## Einrichtung

1. Installieren Sie das Matrix‑Plugin:
   - Von npm: `openclaw plugins install @openclaw/matrix`
   - Von einem lokalen Checkout: `openclaw plugins install ./extensions/matrix`
2. Erstellen Sie ein Matrix‑Konto auf einem Homeserver:
   - Durchsuchen Sie Hosting‑Optionen unter [https://matrix.org/ecosystem/hosting/](https://matrix.org/ecosystem/hosting/)
   - Oder hosten Sie ihn selbst.
3. Besorgen Sie ein Zugriffstoken für das Bot‑Konto:
   - Verwenden Sie die Matrix‑Login‑API mit `curl` auf Ihrem Homeserver:

   ```bash
   curl --request POST \
     --url https://matrix.example.org/_matrix/client/v3/login \
     --header 'Content-Type: application/json' \
     --data '{
     "type": "m.login.password",
     "identifier": {
       "type": "m.id.user",
       "user": "your-user-name"
     },
     "password": "your-password"
   }'
   ```

   - Ersetzen Sie `matrix.example.org` durch die URL Ihres Homeservers.
   - Oder setzen Sie `channels.matrix.userId` + `channels.matrix.password`: OpenClaw ruft denselben
     Login‑Endpunkt auf, speichert das Zugriffstoken in `~/.openclaw/credentials/matrix/credentials.json`
     und verwendet es beim nächsten Start erneut.

4. Konfigurieren Sie die Zugangsdaten:
   - Env: `MATRIX_HOMESERVER`, `MATRIX_ACCESS_TOKEN` (oder `MATRIX_USER_ID` + `MATRIX_PASSWORD`)
   - Oder Konfiguration: `channels.matrix.*`
   - Wenn beides gesetzt ist, hat die Konfiguration Vorrang.
   - Mit Zugriffstoken: Die Benutzer‑ID wird automatisch über `/whoami` abgerufen.
   - Wenn gesetzt, sollte `channels.matrix.userId` die vollständige Matrix‑ID sein (Beispiel: `@bot:example.org`).
5. Starten Sie das Gateway neu (oder schließen Sie die Einführung ab).
6. Starten Sie eine Direktnachricht mit dem Bot oder laden Sie ihn aus einem beliebigen Matrix‑Client in einen Raum ein
   (Element, Beeper usw.; siehe https://matrix.org/ecosystem/clients/). Beeper erfordert E2EE,
   daher setzen Sie `channels.matrix.encryption: true` und verifizieren Sie das Gerät.

Minimale Konfiguration (Zugriffstoken, Benutzer‑ID automatisch abgerufen):

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      dm: { policy: "pairing" },
    },
  },
}
```

E2EE‑Konfiguration (Ende‑zu‑Ende‑Verschlüsselung aktiviert):

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      encryption: true,
      dm: { policy: "pairing" },
    },
  },
}
```

## Verschlüsselung (E2EE)

Ende‑zu‑Ende‑Verschlüsselung wird **unterstützt** über das Rust‑Crypto‑SDK.

Aktivieren Sie sie mit `channels.matrix.encryption: true`:

- Wenn das Krypto‑Modul geladen wird, werden verschlüsselte Räume automatisch entschlüsselt.
- Ausgehende Medien werden beim Senden in verschlüsselte Räume verschlüsselt.
- Bei der ersten Verbindung fordert OpenClaw die Geräteverifizierung von Ihren anderen Sitzungen an.
- Verifizieren Sie das Gerät in einem anderen Matrix‑Client (Element usw.), um den Schlüsselaustausch zu aktivieren.
- Wenn das Krypto‑Modul nicht geladen werden kann, ist E2EE deaktiviert und verschlüsselte Räume werden nicht entschlüsselt;
  OpenClaw protokolliert eine Warnung.
- Wenn Fehler zu fehlenden Krypto‑Modulen auftreten (z. B. `@matrix-org/matrix-sdk-crypto-nodejs-*`),
  erlauben Sie Build‑Skripte für `@matrix-org/matrix-sdk-crypto-nodejs` und führen Sie
  `pnpm rebuild @matrix-org/matrix-sdk-crypto-nodejs` aus oder laden Sie das Binary mit
  `node node_modules/@matrix-org/matrix-sdk-crypto-nodejs/download-lib.js` herunter.

Der Krypto‑Status wird pro Konto + Zugriffstoken in
`~/.openclaw/matrix/accounts/<account>/<homeserver>__<user>/<token-hash>/crypto/`
(SQLite‑Datenbank) gespeichert. Der Sync‑Status liegt daneben in `bot-storage.json`.
Wenn sich das Zugriffstoken (Gerät) ändert, wird ein neuer Store erstellt und der Bot muss
für verschlüsselte Räume erneut verifiziert werden.

**Geräteverifizierung:**
Wenn E2EE aktiviert ist, fordert der Bot beim Start eine Verifizierung von Ihren anderen Sitzungen an.
Öffnen Sie Element (oder einen anderen Client) und genehmigen Sie die Verifizierungsanfrage, um Vertrauen herzustellen.
Nach der Verifizierung kann der Bot Nachrichten in verschlüsselten Räumen entschlüsseln.

## Routing‑Modell

- Antworten gehen immer zurück zu Matrix.
- Direktnachrichten teilen sich die Hauptsitzung des Agenten; Räume werden Gruppen‑Sitzungen zugeordnet.

## Zugriffskontrolle (Direktnachrichten)

- Standard: `channels.matrix.dm.policy = "pairing"`. Unbekannte Absender erhalten einen Kopplungscode.
- Genehmigen über:
  - `openclaw pairing list matrix`
  - `openclaw pairing approve matrix <CODE>`
- Öffentliche Direktnachrichten: `channels.matrix.dm.policy="open"` plus `channels.matrix.dm.allowFrom=["*"]`.
- `channels.matrix.dm.allowFrom` akzeptiert vollständige Matrix‑Benutzer‑IDs (Beispiel: `@user:server`). Der Assistent löst Anzeigenamen zu Benutzer‑IDs auf, wenn die Verzeichnissuche eine einzelne exakte Übereinstimmung findet.

## Räume (Groups)

- Standard: `channels.matrix.groupPolicy = "allowlist"` (erwähnungsbasiert). Verwenden Sie `channels.defaults.groupPolicy`, um den Standard zu überschreiben, wenn nicht gesetzt.
- Erlaubnisliste für Räume mit `channels.matrix.groups` (Raum‑IDs oder Aliase; Namen werden zu IDs aufgelöst, wenn die Verzeichnissuche eine einzelne exakte Übereinstimmung findet):

```json5
{
  channels: {
    matrix: {
      groupPolicy: "allowlist",
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
      groupAllowFrom: ["@owner:example.org"],
    },
  },
}
```

- `requireMention: false` aktiviert Auto‑Antworten in diesem Raum.
- `groups."*"` kann Standardwerte für die Erwähnungs‑Steuerung über Räume hinweg setzen.
- `groupAllowFrom` beschränkt, welche Absender den Bot in Räumen auslösen können (vollständige Matrix‑Benutzer‑IDs).
- Pro‑Raum‑`users`‑Erlaubnislisten können Absender innerhalb eines bestimmten Raums weiter einschränken (verwenden Sie vollständige Matrix‑Benutzer‑IDs).
- Der Konfigurations‑Assistent fragt nach Raum‑Erlaubnislisten (Raum‑IDs, Aliase oder Namen) und löst Namen nur bei einer exakten, eindeutigen Übereinstimmung auf.
- Beim Start löst OpenClaw Raum‑/Benutzernamen in Erlaubnislisten zu IDs auf und protokolliert die Zuordnung; nicht aufgelöste Einträge werden für das Matching ignoriert.
- Einladungen werden standardmäßig automatisch angenommen; steuern Sie dies mit `channels.matrix.autoJoin` und `channels.matrix.autoJoinAllowlist`.
- Um **keine Räume** zuzulassen, setzen Sie `channels.matrix.groupPolicy: "disabled"` (oder behalten Sie eine leere Erlaubnisliste).
- Legacy‑Schlüssel: `channels.matrix.rooms` (gleiche Struktur wie `groups`).

## Threads

- Antwort‑Threading wird unterstützt.
- `channels.matrix.threadReplies` steuert, ob Antworten in Threads bleiben:
  - `off`, `inbound` (Standard), `always`
- `channels.matrix.replyToMode` steuert Reply‑to‑Metadaten, wenn nicht in einem Thread geantwortet wird:
  - `off` (Standard), `first`, `all`

## Funktionen

| Funktion          | Status                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Direktnachrichten | ✅ Unterstützt                                                                                       |
| Räume             | ✅ Unterstützt                                                                                       |
| Threads           | ✅ Unterstützt                                                                                       |
| Medien            | ✅ Unterstützt                                                                                       |
| E2EE              | ✅ Unterstützt (Krypto‑Modul erforderlich)                                                           |
| Reaktionen        | ✅ Unterstützt (Senden/Lesen über Werkzeuge)                                                         |
| Umfragen          | ✅ Senden unterstützt; eingehende Poll‑Starts werden in Text umgewandelt (Antworten/Enden ignoriert) |
| Standort          | ✅ Unterstützt (Geo‑URI; Höhe ignoriert)                                                             |
| Native Befehle    | ✅ Unterstützt                                                                                       |

## Konfigurationsreferenz (Matrix)

Vollständige Konfiguration: [Konfiguration](/gateway/configuration)

Anbieteroptionen:

- `channels.matrix.enabled`: Kanalstart aktivieren/deaktivieren.
- `channels.matrix.homeserver`: Homeserver‑URL.
- `channels.matrix.userId`: Matrix‑Benutzer‑ID (optional mit Zugriffstoken).
- `channels.matrix.accessToken`: Zugriffstoken.
- `channels.matrix.password`: Passwort für den Login (Token wird gespeichert).
- `channels.matrix.deviceName`: Anzeigename des Geräts.
- `channels.matrix.encryption`: E2EE aktivieren (Standard: false).
- `channels.matrix.initialSyncLimit`: Initiales Sync‑Limit.
- `channels.matrix.threadReplies`: `off | inbound | always` (Standard: eingehend).
- `channels.matrix.textChunkLimit`: Größe von ausgehendem Text‑Chunking (Zeichen).
- `channels.matrix.chunkMode`: `length` (Standard) oder `newline`, um vor der Längen‑Aufteilung an Leerzeilen (Absatzgrenzen) zu trennen.
- `channels.matrix.dm.policy`: `pairing | allowlist | open | disabled` (Standard: Kopplung).
- `channels.matrix.dm.allowFrom`: DM‑Erlaubnisliste (vollständige Matrix‑Benutzer‑IDs). `open` erfordert `"*"`. Der Assistent löst Namen, wenn möglich, zu IDs auf.
- `channels.matrix.groupPolicy`: `allowlist | open | disabled` (Standard: Erlaubnisliste).
- `channels.matrix.groupAllowFrom`: Erlaubte Absender für Gruppennachrichten (vollständige Matrix‑Benutzer‑IDs).
- `channels.matrix.allowlistOnly`: Erlaubnislisten‑Regeln für Direktnachrichten + Räume erzwingen.
- `channels.matrix.groups`: Gruppen‑Erlaubnisliste + Map für Pro‑Raum‑Einstellungen.
- `channels.matrix.rooms`: Legacy‑Gruppen‑Erlaubnisliste/Konfiguration.
- `channels.matrix.replyToMode`: Reply‑to‑Modus für Threads/Tags.
- `channels.matrix.mediaMaxMb`: Medienlimit ein/ausgehend (MB).
- `channels.matrix.autoJoin`: Einladungsbehandlung (`always | allowlist | off`, Standard: immer).
- `channels.matrix.autoJoinAllowlist`: Erlaubte Raum‑IDs/Aliase für Auto‑Join.
- `channels.matrix.actions`: Pro‑Aktion‑Werkzeug‑Gating (Reaktionen/Nachrichten/Pins/MemberInfo/ChannelInfo).
