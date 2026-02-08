---
summary: „Übersicht zur Kopplung: Genehmigen Sie, wer Ihnen Direktnachrichten senden darf und welche Knoten beitreten können“
read_when:
  - Einrichten der DM-Zugriffskontrolle
  - Koppeln eines neuen iOS/Android-Knotens
  - Überprüfen der OpenClaw-Sicherheitslage
title: „Kopplung“
x-i18n:
  source_path: start/pairing.md
  source_hash: 5a0539932f905536
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:33Z
---

# Kopplung

„Kopplung“ ist der explizite Schritt der **Eigentümerfreigabe** von OpenClaw.
Er wird an zwei Stellen verwendet:

1. **DM-Kopplung** (wer mit dem Bot sprechen darf)
2. **Knoten-Kopplung** (welche Geräte/Knoten dem Gateway-Netzwerk beitreten dürfen)

Sicherheitskontext: [Security](/gateway/security)

## 1) DM-Kopplung (eingehender Chat-Zugriff)

Wenn ein Kanal mit der DM-Richtlinie `pairing` konfiguriert ist, erhalten unbekannte Absender einen Kurzcode und ihre Nachricht wird **nicht verarbeitet**, bis Sie sie genehmigen.

Standard-DM-Richtlinien sind dokumentiert unter: [Security](/gateway/security)

Kopplungscodes:

- 8 Zeichen, Großbuchstaben, keine mehrdeutigen Zeichen (`0O1I`).
- **Laufen nach 1 Stunde ab**. Der Bot sendet die Kopplungsnachricht nur, wenn eine neue Anfrage erstellt wird (ungefähr einmal pro Stunde und Absender).
- Ausstehende DM-Kopplungsanfragen sind standardmäßig auf **3 pro Kanal** begrenzt; zusätzliche Anfragen werden ignoriert, bis eine abläuft oder genehmigt wird.

### Einen Absender genehmigen

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

Unterstützte Kanäle: `telegram`, `whatsapp`, `signal`, `imessage`, `discord`, `slack`.

### Wo der Zustand gespeichert wird

Gespeichert unter `~/.openclaw/credentials/`:

- Ausstehende Anfragen: `<channel>-pairing.json`
- Genehmigte Allowlist: `<channel>-allowFrom.json`

Behandeln Sie diese als sensibel (sie steuern den Zugriff auf Ihren Assistenten).

## 2) Knoten-Geräte-Kopplung (iOS/Android/macOS/headless Knoten)

Knoten verbinden sich mit dem Gateway als **Geräte** mit `role: node`. Das Gateway
erstellt eine Geräte-Kopplungsanfrage, die genehmigt werden muss.

### Ein Knotengerät genehmigen

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

### Wo der Zustand gespeichert wird

Gespeichert unter `~/.openclaw/devices/`:

- `pending.json` (kurzlebig; ausstehende Anfragen laufen ab)
- `paired.json` (gekoppelte Geräte + Tokens)

### Hinweise

- Die ältere `node.pair.*`-API (CLI: `openclaw nodes pending/approve`) ist ein
  separates, gatewayeigenes Kopplungsspeicherwerk. WS-Knoten erfordern weiterhin Geräte-Kopplung.

## Verwandte Dokumente

- Sicherheitsmodell + Prompt Injection: [Security](/gateway/security)
- Sicheres Aktualisieren (Doctor ausführen): [Updating](/install/updating)
- Kanal-Konfigurationen:
  - Telegram: [Telegram](/channels/telegram)
  - WhatsApp: [WhatsApp](/channels/whatsapp)
  - Signal: [Signal](/channels/signal)
  - BlueBubbles (iMessage): [BlueBubbles](/channels/bluebubbles)
  - iMessage (Legacy): [iMessage](/channels/imessage)
  - Discord: [Discord](/channels/discord)
  - Slack: [Slack](/channels/slack)
