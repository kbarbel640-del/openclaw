---
summary: „Einrichtung, Konfiguration und Nutzung des LINE Messaging API Plugins“
read_when:
  - Sie moechten OpenClaw mit LINE verbinden
  - Sie benoetigen die Einrichtung von LINE-Webhooks und Zugangsdaten
  - Sie moechten LINE-spezifische Nachrichtenoptionen nutzen
title: LINE
x-i18n:
  source_path: channels/line.md
  source_hash: 8fbac126786f95b9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:26Z
---

# LINE (Plugin)

LINE verbindet sich mit OpenClaw ueber die LINE Messaging API. Das Plugin laeuft als
Webhook-Empfaenger auf dem Gateway und verwendet Ihr Channel-Access-Token und das
Channel-Secret zur Authentifizierung.

Status: ueber Plugin unterstuetzt. Direktnachrichten, Gruppenchats, Medien, Standorte,
Flex-Nachrichten, Vorlagen-Nachrichten und Schnellantworten werden unterstuetzt.
Reaktionen und Threads werden nicht unterstuetzt.

## Plugin erforderlich

Installieren Sie das LINE-Plugin:

```bash
openclaw plugins install @openclaw/line
```

Lokaler Checkout (bei Ausfuehrung aus einem Git-Repository):

```bash
openclaw plugins install ./extensions/line
```

## Einrichtung

1. Erstellen Sie ein LINE Developers-Konto und oeffnen Sie die Konsole:
   https://developers.line.biz/console/
2. Erstellen (oder waehlen) Sie einen Anbieter und fuegen Sie einen **Messaging API**-Kanal hinzu.
3. Kopieren Sie das **Channel access token** und das **Channel secret** aus den Kanaleinstellungen.
4. Aktivieren Sie **Use webhook** in den Messaging-API-Einstellungen.
5. Setzen Sie die Webhook-URL auf Ihren Gateway-Endpunkt (HTTPS erforderlich):

```
https://gateway-host/line/webhook
```

Das Gateway antwortet auf die Webhook-Verifizierung von LINE (GET) und eingehende
Ereignisse (POST). Wenn Sie einen benutzerdefinierten Pfad benoetigen, setzen Sie
`channels.line.webhookPath` oder `channels.line.accounts.<id>.webhookPath` und aktualisieren Sie die URL entsprechend.

## Konfiguration

Minimale Konfiguration:

```json5
{
  channels: {
    line: {
      enabled: true,
      channelAccessToken: "LINE_CHANNEL_ACCESS_TOKEN",
      channelSecret: "LINE_CHANNEL_SECRET",
      dmPolicy: "pairing",
    },
  },
}
```

Umgebungsvariablen (nur Standardkonto):

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

Token-/Secret-Dateien:

```json5
{
  channels: {
    line: {
      tokenFile: "/path/to/line-token.txt",
      secretFile: "/path/to/line-secret.txt",
    },
  },
}
```

Mehrere Konten:

```json5
{
  channels: {
    line: {
      accounts: {
        marketing: {
          channelAccessToken: "...",
          channelSecret: "...",
          webhookPath: "/line/marketing",
        },
      },
    },
  },
}
```

## Zugriffskontrolle

Direktnachrichten verwenden standardmaessig eine Kopplung. Unbekannte Absender
erhalten einen Kopplungscode und ihre Nachrichten werden ignoriert, bis sie genehmigt
wurden.

```bash
openclaw pairing list line
openclaw pairing approve line <CODE>
```

Allowlists und Richtlinien:

- `channels.line.dmPolicy`: `pairing | allowlist | open | disabled`
- `channels.line.allowFrom`: erlaubte LINE-Benutzer-IDs fuer Direktnachrichten
- `channels.line.groupPolicy`: `allowlist | open | disabled`
- `channels.line.groupAllowFrom`: erlaubte LINE-Benutzer-IDs fuer Gruppen
- Pro-Gruppen-Ueberschreibungen: `channels.line.groups.<groupId>.allowFrom`

LINE-IDs sind gross-/kleinschreibungssensitiv. Gueltige IDs sehen wie folgt aus:

- Benutzer: `U` + 32 Hex-Zeichen
- Gruppe: `C` + 32 Hex-Zeichen
- Raum: `R` + 32 Hex-Zeichen

## Nachrichtenverhalten

- Text wird bei 5000 Zeichen segmentiert.
- Markdown-Formatierung wird entfernt; Codebloecke und Tabellen werden nach Moeglichkeit
  in Flex-Karten umgewandelt.
- Streaming-Antworten werden gepuffert; LINE erhaelt vollstaendige Segmente mit einer
  Ladeanimation, waehrend der Agent arbeitet.
- Medien-Downloads sind durch `channels.line.mediaMaxMb` begrenzt (Standard: 10).

## Kanaldaten (Rich Messages)

Verwenden Sie `channelData.line`, um Schnellantworten, Standorte, Flex-Karten oder
Vorlagen-Nachrichten zu senden.

```json5
{
  text: "Here you go",
  channelData: {
    line: {
      quickReplies: ["Status", "Help"],
      location: {
        title: "Office",
        address: "123 Main St",
        latitude: 35.681236,
        longitude: 139.767125,
      },
      flexMessage: {
        altText: "Status card",
        contents: {
          /* Flex payload */
        },
      },
      templateMessage: {
        type: "confirm",
        text: "Proceed?",
        confirmLabel: "Yes",
        confirmData: "yes",
        cancelLabel: "No",
        cancelData: "no",
      },
    },
  },
}
```

Das LINE-Plugin enthaelt ausserdem einen `/card`-Befehl fuer Flex-
Nachrichten-Presets:

```
/card info "Welcome" "Thanks for joining!"
```

## Fehlerbehebung

- **Webhook-Verifizierung schlaegt fehl:** Stellen Sie sicher, dass die Webhook-URL HTTPS
  verwendet und `channelSecret` mit der LINE-Konsole uebereinstimmt.
- **Keine eingehenden Ereignisse:** Bestaetigen Sie, dass der Webhook-Pfad mit
  `channels.line.webhookPath` uebereinstimmt und dass das Gateway von LINE erreichbar ist.
- **Fehler beim Medien-Download:** Erhoehen Sie `channels.line.mediaMaxMb`, wenn Medien das
  Standardlimit ueberschreiten.
