---
summary: "Schritte zur Gesundheitsprüfung der Kanalkonnektivität"
read_when:
  - Diagnose der Gesundheit des WhatsApp-Kanals
title: "Gesundheitsprüfungen"
x-i18n:
  source_path: gateway/health.md
  source_hash: 74f242e98244c135
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:26Z
---

# Gesundheitsprüfungen (CLI)

Kurze Anleitung zur Überprüfung der Kanalkonnektivität ohne Rätselraten.

## Schnellprüfungen

- `openclaw status` — lokale Zusammenfassung: Gateway-Erreichbarkeit/-Modus, Update-Hinweis, Alter der verknüpften Kanal-Authentifizierung, Sitzungen + jüngste Aktivität.
- `openclaw status --all` — vollständige lokale Diagnose (nur lesend, farbig, sicher zum Einfügen für Debugging).
- `openclaw status --deep` — prüft zusätzlich das laufende Gateway (kanalspezifische Prüfungen, wenn unterstützt).
- `openclaw health --json` — fordert vom laufenden Gateway einen vollständigen Gesundheitsstatus an (nur WS; kein direkter Baileys-Socket).
- Senden Sie `/status` als eigenständige Nachricht in WhatsApp/WebChat, um eine Statusantwort zu erhalten, ohne den Agenten aufzurufen.
- Logs: tail `/tmp/openclaw/openclaw-*.log` und filtern Sie nach `web-heartbeat`, `web-reconnect`, `web-auto-reply`, `web-inbound`.

## Tiefgehende Diagnose

- Zugangsdaten auf dem Datenträger: `ls -l ~/.openclaw/credentials/whatsapp/<accountId>/creds.json` (mtime sollte aktuell sein).
- Sitzungs-Speicher: `ls -l ~/.openclaw/agents/<agentId>/sessions/sessions.json` (Pfad kann in der Konfiguration überschrieben werden). Anzahl und jüngste Empfänger werden über `status` angezeigt.
- Neuverknüpfungsablauf: `openclaw channels logout && openclaw channels login --verbose` bei Statuscodes 409–515 oder wenn `loggedOut` in den Logs erscheint. (Hinweis: Der QR-Login-Ablauf startet nach der Kopplung einmalig automatisch neu bei Status 515.)

## Wenn etwas fehlschlägt

- `logged out` oder Status 409–515 → Neuverknüpfen mit `openclaw channels logout` und anschließend `openclaw channels login`.
- Gateway nicht erreichbar → starten Sie es: `openclaw gateway --port 18789` (verwenden Sie `--force`, wenn der Port belegt ist).
- Keine eingehenden Nachrichten → bestätigen Sie, dass das verknüpfte Telefon online ist und der Absender erlaubt ist (`channels.whatsapp.allowFrom`); für Gruppenchats stellen Sie sicher, dass Allowlist- und Erwähnungsregeln übereinstimmen (`channels.whatsapp.groups`, `agents.list[].groupChat.mentionPatterns`).

## Dedizierter „health“-Befehl

`openclaw health --json` fordert vom laufenden Gateway dessen Gesundheitsstatus an (keine direkten Kanal-Sockets aus der CLI). Er meldet – sofern verfügbar – verknüpfte Zugangsdaten/Authentifizierungsalter, Zusammenfassungen der kanalspezifischen Prüfungen, eine Zusammenfassung des Sitzungs-Speichers sowie die Dauer der Prüfung. Er beendet sich mit einem Nicht-Null-Code, wenn das Gateway nicht erreichbar ist oder die Prüfung fehlschlägt/timeoutet. Verwenden Sie `--timeout <ms>`, um den Standardwert von 10 s zu überschreiben.
