---
summary: "macOS-Skills-Einstellungsoberfläche und Gateway-gestützter Status"
read_when:
  - Aktualisieren der macOS-Skills-Einstellungsoberfläche
  - Ändern der Skills-Zugriffssteuerung oder des Installationsverhaltens
title: "Skills"
x-i18n:
  source_path: platforms/mac/skills.md
  source_hash: ecd5286bbe49eed8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:01Z
---

# Skills (macOS)

Die macOS-App stellt OpenClaw Skills über das Gateway bereit; sie parst Skills nicht lokal.

## Datenquelle

- `skills.status` (Gateway) liefert alle Skills sowie Berechtigung und fehlende Anforderungen
  (einschließlich Allowlist-Sperren für gebündelte Skills).
- Anforderungen werden aus `metadata.openclaw.requires` in jedem `SKILL.md` abgeleitet.

## Installationsaktionen

- `metadata.openclaw.install` definiert Installationsoptionen (brew/node/go/uv).
- Die App ruft `skills.install` auf, um Installer auf dem Gateway-Host auszuführen.
- Das Gateway stellt nur einen bevorzugten Installer bereit, wenn mehrere angegeben sind
  (brew, wenn verfügbar, andernfalls der Node-Manager aus `skills.install`, standardmäßig npm).

## Umgebungs-/API-Schlüssel

- Die App speichert Schlüssel in `~/.openclaw/openclaw.json` unter `skills.entries.<skillKey>`.
- `skills.update` patcht `enabled`, `apiKey` und `env`.

## Remote-Modus

- Installation und Konfigurationsaktualisierungen erfolgen auf dem Gateway-Host (nicht auf dem lokalen Mac).
