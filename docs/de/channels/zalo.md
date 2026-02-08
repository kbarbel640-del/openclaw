---
summary: "Supportstatus, Funktionen und Konfiguration des Zalo-Bots"
read_when:
  - Arbeit an Zalo-Funktionen oder Webhooks
title: "Zalo"
x-i18n:
  source_path: channels/zalo.md
  source_hash: 0311d932349f9641
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:41Z
---

# Zalo (Bot API)

Status: experimentell. Nur Direktnachrichten; Gruppen kommen laut Zalo-Dokumentation bald.

## Plugin erforderlich

Zalo wird als Plugin ausgeliefert und ist nicht im Core-Installationspaket enthalten.

- Installation via CLI: `openclaw plugins install @openclaw/zalo`
- Oder **Zalo** waehrend der Einfuehrung auswaehlen und die Installationsabfrage bestaetigen
- Details: [Plugins](/plugin)

## Schnellstart (Anfaenger)

1. Installieren Sie das Zalo-Plugin:
   - Aus einem Source-Checkout: `openclaw plugins install ./extensions/zalo`
   - Von npm (falls veroeffentlicht): `openclaw plugins install @openclaw/zalo`
   - Oder waehlen Sie **Zalo** in der Einfuehrung und bestaetigen Sie die Installationsabfrage
2. Setzen Sie das Token:
   - Env: `ZALO_BOT_TOKEN=...`
   - Oder Konfiguration: `channels.zalo.botToken: "..."`.
3. Starten Sie das Gateway neu (oder schliessen Sie die Einfuehrung ab).
4. DM-Zugriff ist standardmaessig per Pairing; bestaetigen Sie den Pairing-Code beim ersten Kontakt.

Minimale Konfiguration:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

## Was es ist

Zalo ist eine auf Vietnam fokussierte Messaging-App; ihre Bot API ermoeglicht dem Gateway, einen Bot fuer 1:1-Unterhaltungen zu betreiben.
Sie eignet sich gut fuer Support oder Benachrichtigungen, bei denen eine deterministische Rueckleitung zu Zalo gewuenscht ist.

- Ein vom Gateway verwalteter Zalo Bot API-Kanal.
- Deterministische Weiterleitung: Antworten gehen zurueck zu Zalo; das Modell waehlt keine Kanaele.
- DMs teilen die Hauptsitzung des Agenten.
- Gruppen werden noch nicht unterstuetzt (Zalo-Dokumentation: „coming soon“).

## Einrichtung (schneller Weg)

### 1) Bot-Token erstellen (Zalo Bot Platform)

1. Gehen Sie zu **https://bot.zaloplatforms.com** und melden Sie sich an.
2. Erstellen Sie einen neuen Bot und konfigurieren Sie seine Einstellungen.
3. Kopieren Sie das Bot-Token (Format: `12345689:abc-xyz`).

### 2) Token konfigurieren (Env oder Konfiguration)

Beispiel:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

Env-Option: `ZALO_BOT_TOKEN=...` (funktioniert nur fuer das Standardkonto).

Unterstuetzung mehrerer Konten: Verwenden Sie `channels.zalo.accounts` mit kontospezifischen Tokens und optional `name`.

3. Starten Sie das Gateway neu. Zalo startet, sobald ein Token aufgeloest wird (Env oder Konfiguration).
4. DM-Zugriff ist standardmaessig Pairing. Bestaetigen Sie den Code beim ersten Kontakt mit dem Bot.

## Funktionsweise (Verhalten)

- Eingehende Nachrichten werden in den gemeinsamen Kanal-Umschlag mit Medienplatzhaltern normalisiert.
- Antworten werden immer in denselben Zalo-Chat zurueckgeleitet.
- Standardmaessig Long-Polling; Webhook-Modus verfuegbar mit `channels.zalo.webhookUrl`.

## Limits

- Ausgehender Text wird auf 2000 Zeichen gestueckelt (Zalo-API-Limit).
- Medien-Downloads/-Uploads sind durch `channels.zalo.mediaMaxMb` begrenzt (Standard 5).
- Streaming ist standardmaessig blockiert, da das 2000-Zeichen-Limit Streaming weniger nuetzlich macht.

## Zugriffskontrolle (DMs)

### DM-Zugriff

- Standard: `channels.zalo.dmPolicy = "pairing"`. Unbekannte Absender erhalten einen Pairing-Code; Nachrichten werden ignoriert, bis die Freigabe erfolgt (Codes laufen nach 1 Stunde ab).
- Freigabe ueber:
  - `openclaw pairing list zalo`
  - `openclaw pairing approve zalo <CODE>`
- Pairing ist der Standard-Token-Austausch. Details: [Pairing](/start/pairing)
- `channels.zalo.allowFrom` akzeptiert numerische Benutzer-IDs (keine Username-Aufloesung verfuegbar).

## Long-Polling vs. Webhook

- Standard: Long-Polling (keine oeffentliche URL erforderlich).
- Webhook-Modus: Setzen Sie `channels.zalo.webhookUrl` und `channels.zalo.webhookSecret`.
  - Das Webhook-Secret muss 8–256 Zeichen lang sein.
  - Die Webhook-URL muss HTTPS verwenden.
  - Zalo sendet Events mit dem Header `X-Bot-Api-Secret-Token` zur Verifizierung.
  - Gateway HTTP verarbeitet Webhook-Anfragen unter `channels.zalo.webhookPath` (standardmaessig der Pfad der Webhook-URL).

**Hinweis:** getUpdates (Polling) und Webhook sind laut Zalo-API-Dokumentation gegenseitig ausschliessend.

## Unterstuetzte Nachrichtentypen

- **Textnachrichten**: Vollstaendige Unterstuetzung mit 2000-Zeichen-Stueckelung.
- **Bildnachrichten**: Eingehende Bilder herunterladen und verarbeiten; Bilder senden ueber `sendPhoto`.
- **Sticker**: Protokolliert, aber nicht vollstaendig verarbeitet (keine Agentenantwort).
- **Nicht unterstuetzte Typen**: Protokolliert (z. B. Nachrichten von geschuetzten Benutzern).

## Funktionen

| Feature           | Status                                   |
| ----------------- | ---------------------------------------- |
| Direktnachrichten | ✅ Unterstuetzt                          |
| Gruppen           | ❌ Coming soon (laut Zalo-Dokumentation) |
| Medien (Bilder)   | ✅ Unterstuetzt                          |
| Reaktionen        | ❌ Nicht unterstuetzt                    |
| Threads           | ❌ Nicht unterstuetzt                    |
| Umfragen          | ❌ Nicht unterstuetzt                    |
| Native Befehle    | ❌ Nicht unterstuetzt                    |
| Streaming         | ⚠️ Blockiert (2000-Zeichen-Limit)        |

## Zustellziele (CLI/Cron)

- Verwenden Sie eine Chat-ID als Ziel.
- Beispiel: `openclaw message send --channel zalo --target 123456789 --message "hi"`.

## Fehlerbehebung

**Bot reagiert nicht:**

- Pruefen Sie, ob das Token gueltig ist: `openclaw channels status --probe`
- Verifizieren Sie, dass der Absender freigegeben ist (Pairing oder allowFrom)
- Pruefen Sie die Gateway-Logs: `openclaw logs --follow`

**Webhook erhaelt keine Events:**

- Stellen Sie sicher, dass die Webhook-URL HTTPS verwendet
- Verifizieren Sie, dass das Secret-Token 8–256 Zeichen lang ist
- Bestaetigen Sie, dass der Gateway-HTTP-Endpunkt unter dem konfigurierten Pfad erreichbar ist
- Pruefen Sie, dass getUpdates-Polling nicht laeuft (gegenseitig ausschliessend)

## Konfigurationsreferenz (Zalo)

Vollstaendige Konfiguration: [Configuration](/gateway/configuration)

Anbieteroptionen:

- `channels.zalo.enabled`: Kanalstart aktivieren/deaktivieren.
- `channels.zalo.botToken`: Bot-Token von der Zalo Bot Platform.
- `channels.zalo.tokenFile`: Token aus Dateipfad lesen.
- `channels.zalo.dmPolicy`: `pairing | allowlist | open | disabled` (Standard: Pairing).
- `channels.zalo.allowFrom`: DM-Allowlist (Benutzer-IDs). `open` erfordert `"*"`. Der Assistent fragt nach numerischen IDs.
- `channels.zalo.mediaMaxMb`: Medienlimit eingehend/ausgehend (MB, Standard 5).
- `channels.zalo.webhookUrl`: Webhook-Modus aktivieren (HTTPS erforderlich).
- `channels.zalo.webhookSecret`: Webhook-Secret (8–256 Zeichen).
- `channels.zalo.webhookPath`: Webhook-Pfad auf dem Gateway-HTTP-Server.
- `channels.zalo.proxy`: Proxy-URL fuer API-Anfragen.

Optionen fuer mehrere Konten:

- `channels.zalo.accounts.<id>.botToken`: Token pro Konto.
- `channels.zalo.accounts.<id>.tokenFile`: Token-Datei pro Konto.
- `channels.zalo.accounts.<id>.name`: Anzeigename.
- `channels.zalo.accounts.<id>.enabled`: Konto aktivieren/deaktivieren.
- `channels.zalo.accounts.<id>.dmPolicy`: DM-Richtlinie pro Konto.
- `channels.zalo.accounts.<id>.allowFrom`: Allowlist pro Konto.
- `channels.zalo.accounts.<id>.webhookUrl`: Webhook-URL pro Konto.
- `channels.zalo.accounts.<id>.webhookSecret`: Webhook-Secret pro Konto.
- `channels.zalo.accounts.<id>.webhookPath`: Webhook-Pfad pro Konto.
- `channels.zalo.accounts.<id>.proxy`: Proxy-URL pro Konto.
