---
summary: "Überwachen des OAuth-Ablaufs für Modellanbieter"
read_when:
  - Einrichten der Überwachung oder von Warnmeldungen zum Auth-Ablauf
  - Automatisieren von Claude Code / Codex OAuth-Aktualisierungsprüfungen
title: "Auth-Überwachung"
x-i18n:
  source_path: automation/auth-monitoring.md
  source_hash: eef179af9545ed7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:09Z
---

# Auth-Überwachung

OpenClaw stellt den Gesundheitsstatus des OAuth-Ablaufs über `openclaw models status` bereit. Nutzen Sie dies für
Automatisierung und Alarmierung; Skripte sind optionale Extras für Telefon-Workflows.

## Bevorzugt: CLI-Prüfung (portabel)

```bash
openclaw models status --check
```

Exit-Codes:

- `0`: OK
- `1`: abgelaufene oder fehlende Anmeldedaten
- `2`: läuft bald ab (innerhalb von 24 h)

Dies funktioniert in cron/systemd und erfordert keine zusätzlichen Skripte.

## Optionale Skripte (Ops / Telefon-Workflows)

Diese befinden sich unter `scripts/` und sind **optional**. Sie setzen SSH-Zugriff auf den
Gateway-Host voraus und sind auf systemd + Termux abgestimmt.

- `scripts/claude-auth-status.sh` verwendet jetzt `openclaw models status --json` als
  maßgebliche Quelle (mit Fallback auf direkte Dateizugriffe, falls die CLI nicht verfügbar ist),
  daher halten Sie `openclaw` auf `PATH` für Timer.
- `scripts/auth-monitor.sh`: cron/systemd-Timerziel; sendet Warnmeldungen (ntfy oder Telefon).
- `scripts/systemd/openclaw-auth-monitor.{service,timer}`: systemd-Benutzertimer.
- `scripts/claude-auth-status.sh`: Claude Code + OpenClaw Auth-Checker (vollständig/json/einfach).
- `scripts/mobile-reauth.sh`: geführter Re-Auth-Ablauf über SSH.
- `scripts/termux-quick-auth.sh`: Ein-Tipp-Widget-Status + Öffnen der Auth-URL.
- `scripts/termux-auth-widget.sh`: vollständiger geführter Widget-Ablauf.
- `scripts/termux-sync-widget.sh`: Synchronisierung von Claude Code-Anmeldedaten → OpenClaw.

Wenn Sie keine Telefonautomatisierung oder systemd-Timer benötigen, überspringen Sie diese Skripte.
