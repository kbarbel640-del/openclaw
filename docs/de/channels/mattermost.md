---
summary: „Mattermost-Bot-Einrichtung und OpenClaw-Konfiguration“
read_when:
  - Einrichten von Mattermost
  - Debugging der Mattermost-Routinglogik
title: „Mattermost“
x-i18n:
  source_path: channels/mattermost.md
  source_hash: 57fabe5eb0efbcb8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:25Z
---

# Mattermost (Plugin)

Status: unterstützt über Plugin (Bot-Token + WebSocket-Ereignisse). Kanäle, Gruppen und Direktnachrichten werden unterstützt.
Mattermost ist eine selbst hostbare Team-Messaging-Plattform; Produktdetails und Downloads finden Sie auf der offiziellen Website unter
[mattermost.com](https://mattermost.com).

## Plugin erforderlich

Mattermost wird als Plugin ausgeliefert und ist nicht im Core-Installationsumfang enthalten.

Installation über CLI (npm-Registry):

```bash
openclaw plugins install @openclaw/mattermost
```

Lokaler Checkout (bei Ausführung aus einem Git-Repository):

```bash
openclaw plugins install ./extensions/mattermost
```

Wenn Sie Mattermost während der Konfiguration/Einführung auswählen und ein Git-Checkout erkannt wird,
bietet OpenClaw den lokalen Installationspfad automatisch an.

Details: [Plugins](/plugin)

## Schnellstart

1. Installieren Sie das Mattermost-Plugin.
2. Erstellen Sie ein Mattermost-Botkonto und kopieren Sie das **Bot-Token**.
3. Kopieren Sie die Mattermost-**Basis-URL** (z. B. `https://chat.example.com`).
4. Konfigurieren Sie OpenClaw und starten Sie das Gateway.

Minimale Konfiguration:

```json5
{
  channels: {
    mattermost: {
      enabled: true,
      botToken: "mm-token",
      baseUrl: "https://chat.example.com",
      dmPolicy: "pairing",
    },
  },
}
```

## Umgebungsvariablen (Standardkonto)

Setzen Sie diese auf dem Gateway-Host, wenn Sie Umgebungsvariablen bevorzugen:

- `MATTERMOST_BOT_TOKEN=...`
- `MATTERMOST_URL=https://chat.example.com`

Umgebungsvariablen gelten nur für das **Standardkonto** (`default`). Andere Konten müssen Konfigurationswerte verwenden.

## Chat-Modi

Mattermost antwortet automatisch auf Direktnachrichten. Das Verhalten in Kanälen wird über `chatmode` gesteuert:

- `oncall` (Standard): Antwort nur bei @Erwähnung in Kanälen.
- `onmessage`: Antwort auf jede Kanalnachricht.
- `onchar`: Antwort, wenn eine Nachricht mit einem Trigger-Präfix beginnt.

Konfigurationsbeispiel:

```json5
{
  channels: {
    mattermost: {
      chatmode: "onchar",
      oncharPrefixes: [">", "!"],
    },
  },
}
```

Hinweise:

- `onchar` antwortet weiterhin auf explizite @Erwähnungen.
- `channels.mattermost.requireMention` wird für Legacy-Konfigurationen berücksichtigt, `chatmode` wird jedoch bevorzugt.

## Zugriffskontrolle (Direktnachrichten)

- Standard: `channels.mattermost.dmPolicy = "pairing"` (unbekannte Absender erhalten einen Pairing-Code).
- Genehmigen über:
  - `openclaw pairing list mattermost`
  - `openclaw pairing approve mattermost <CODE>`
- Öffentliche Direktnachrichten: `channels.mattermost.dmPolicy="open"` plus `channels.mattermost.allowFrom=["*"]`.

## Kanäle (Gruppen)

- Standard: `channels.mattermost.groupPolicy = "allowlist"` (Erwähnungs-Gating).
- Zulässige Absender über `channels.mattermost.groupAllowFrom` (Benutzer-IDs oder `@username`).
- Offene Kanäle: `channels.mattermost.groupPolicy="open"` (Erwähnungs-Gating).

## Ziele für ausgehende Zustellung

Verwenden Sie diese Zielformate mit `openclaw message send` oder Cron/Webhooks:

- `channel:<id>` für einen Kanal
- `user:<id>` für eine Direktnachricht
- `@username` für eine Direktnachricht (aufgelöst über die Mattermost-API)

Reine IDs werden als Kanäle behandelt.

## Mehrere Konten

Mattermost unterstützt mehrere Konten unter `channels.mattermost.accounts`:

```json5
{
  channels: {
    mattermost: {
      accounts: {
        default: { name: "Primary", botToken: "mm-token", baseUrl: "https://chat.example.com" },
        alerts: { name: "Alerts", botToken: "mm-token-2", baseUrl: "https://alerts.example.com" },
      },
    },
  },
}
```

## Fehlerbehebung

- Keine Antworten in Kanälen: Stellen Sie sicher, dass der Bot im Kanal ist und erwähnt wird (oncall), verwenden Sie ein Trigger-Präfix (onchar) oder setzen Sie `chatmode: "onmessage"`.
- Authentifizierungsfehler: Prüfen Sie das Bot-Token, die Basis-URL und ob das Konto aktiviert ist.
- Probleme mit mehreren Konten: Umgebungsvariablen gelten nur für das `default`-Konto.
