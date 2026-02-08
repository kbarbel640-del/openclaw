---
summary: "Supportstatus, Funktionen und Konfiguration für Nextcloud Talk"
read_when:
  - Arbeit an Nextcloud-Talk-Kanalfunktionen
title: "Nextcloud Talk"
x-i18n:
  source_path: channels/nextcloud-talk.md
  source_hash: 4062946ebf333903
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:29Z
---

# Nextcloud Talk (Plugin)

Status: unterstützt über ein Plugin (Webhook-Bot). Direktnachrichten, Räume, Reaktionen und Markdown-Nachrichten werden unterstützt.

## Plugin erforderlich

Nextcloud Talk wird als Plugin bereitgestellt und ist nicht im Core-Installationspaket enthalten.

Installation über die CLI (npm-Registry):

```bash
openclaw plugins install @openclaw/nextcloud-talk
```

Lokaler Checkout (bei Ausführung aus einem Git-Repository):

```bash
openclaw plugins install ./extensions/nextcloud-talk
```

Wenn Sie Nextcloud Talk während der Konfiguration/Einfuehrung auswählen und ein Git-Checkout erkannt wird,
bietet OpenClaw den lokalen Installationspfad automatisch an.

Details: [Plugins](/plugin)

## Schnellstart (Anfaenger)

1. Installieren Sie das Nextcloud-Talk-Plugin.
2. Erstellen Sie auf Ihrem Nextcloud-Server einen Bot:
   ```bash
   ./occ talk:bot:install "OpenClaw" "<shared-secret>" "<webhook-url>" --feature reaction
   ```
3. Aktivieren Sie den Bot in den Einstellungen des Zielraums.
4. Konfigurieren Sie OpenClaw:
   - Konfiguration: `channels.nextcloud-talk.baseUrl` + `channels.nextcloud-talk.botSecret`
   - Oder Umgebungsvariable: `NEXTCLOUD_TALK_BOT_SECRET` (nur Standardkonto)
5. Starten Sie das Gateway neu (oder schliessen Sie die Einfuehrung ab).

Minimale Konfiguration:

```json5
{
  channels: {
    "nextcloud-talk": {
      enabled: true,
      baseUrl: "https://cloud.example.com",
      botSecret: "shared-secret",
      dmPolicy: "pairing",
    },
  },
}
```

## Hinweise

- Bots koennen keine Direktnachrichten initiieren. Der Benutzer muss dem Bot zuerst schreiben.
- Die Webhook-URL muss vom Gateway erreichbar sein; setzen Sie `webhookPublicUrl`, wenn Sie sich hinter einem Proxy befinden.
- Medien-Uploads werden von der Bot-API nicht unterstuetzt; Medien werden als URLs gesendet.
- Die Webhook-Payload unterscheidet nicht zwischen Direktnachrichten und Raeumen; setzen Sie `apiUser` + `apiPassword`, um Raumtyp-Abfragen zu aktivieren (andernfalls werden Direktnachrichten als Raeume behandelt).

## Zugriffskontrolle (Direktnachrichten)

- Standard: `channels.nextcloud-talk.dmPolicy = "pairing"`. Unbekannte Absender erhalten einen Pairing-Code.
- Genehmigung ueber:
  - `openclaw pairing list nextcloud-talk`
  - `openclaw pairing approve nextcloud-talk <CODE>`
- Oeffentliche Direktnachrichten: `channels.nextcloud-talk.dmPolicy="open"` plus `channels.nextcloud-talk.allowFrom=["*"]`.
- `allowFrom` entspricht nur Nextcloud-Benutzer-IDs; Anzeigenamen werden ignoriert.

## Raeume (Gruppen)

- Standard: `channels.nextcloud-talk.groupPolicy = "allowlist"` (Erwaehnung erforderlich).
- Raeume ueber eine Allowlist mit `channels.nextcloud-talk.rooms` erlauben:

```json5
{
  channels: {
    "nextcloud-talk": {
      rooms: {
        "room-token": { requireMention: true },
      },
    },
  },
}
```

- Um keine Raeume zuzulassen, lassen Sie die Allowlist leer oder setzen Sie `channels.nextcloud-talk.groupPolicy="disabled"`.

## Funktionen

| Funktion          | Status             |
| ----------------- | ------------------ |
| Direktnachrichten | Unterstuetzt       |
| Raeume            | Unterstuetzt       |
| Threads           | Nicht unterstuetzt |
| Medien            | Nur URL            |
| Reaktionen        | Unterstuetzt       |
| Native Befehle    | Nicht unterstuetzt |

## Konfigurationsreferenz (Nextcloud Talk)

Vollstaendige Konfiguration: [Configuration](/gateway/configuration)

Anbieteroptionen:

- `channels.nextcloud-talk.enabled`: Kanalstart aktivieren/deaktivieren.
- `channels.nextcloud-talk.baseUrl`: URL der Nextcloud-Instanz.
- `channels.nextcloud-talk.botSecret`: Gemeinsames Geheimnis des Bots.
- `channels.nextcloud-talk.botSecretFile`: Pfad zur Geheimnisdatei.
- `channels.nextcloud-talk.apiUser`: API-Benutzer fuer Raumabfragen (Erkennung von Direktnachrichten).
- `channels.nextcloud-talk.apiPassword`: API-/App-Passwort fuer Raumabfragen.
- `channels.nextcloud-talk.apiPasswordFile`: Pfad zur API-Passwortdatei.
- `channels.nextcloud-talk.webhookPort`: Webhook-Listener-Port (Standard: 8788).
- `channels.nextcloud-talk.webhookHost`: Webhook-Host (Standard: 0.0.0.0).
- `channels.nextcloud-talk.webhookPath`: Webhook-Pfad (Standard: /nextcloud-talk-webhook).
- `channels.nextcloud-talk.webhookPublicUrl`: Extern erreichbare Webhook-URL.
- `channels.nextcloud-talk.dmPolicy`: `pairing | allowlist | open | disabled`.
- `channels.nextcloud-talk.allowFrom`: Direktnachrichten-Allowlist (Benutzer-IDs). `open` erfordert `"*"`.
- `channels.nextcloud-talk.groupPolicy`: `allowlist | open | disabled`.
- `channels.nextcloud-talk.groupAllowFrom`: Gruppen-Allowlist (Benutzer-IDs).
- `channels.nextcloud-talk.rooms`: Raumbezogene Einstellungen und Allowlist.
- `channels.nextcloud-talk.historyLimit`: Gruppen-Historienlimit (0 deaktiviert).
- `channels.nextcloud-talk.dmHistoryLimit`: Direktnachrichten-Historienlimit (0 deaktiviert).
- `channels.nextcloud-talk.dms`: Pro-Direktnachricht-Ueberschreibungen (historyLimit).
- `channels.nextcloud-talk.textChunkLimit`: Groesse der ausgehenden Text-Chunks (Zeichen).
- `channels.nextcloud-talk.chunkMode`: `length` (Standard) oder `newline`, um vor dem Laengen-Chunking an Leerzeilen (Absatzgrenzen) zu trennen.
- `channels.nextcloud-talk.blockStreaming`: Block-Streaming fuer diesen Kanal deaktivieren.
- `channels.nextcloud-talk.blockStreamingCoalesce`: Feinabstimmung fuer das Zusammenfassen von Block-Streaming.
- `channels.nextcloud-talk.mediaMaxMb`: Eingehende Medienbegrenzung (MB).
