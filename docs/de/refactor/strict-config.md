---
summary: "Strikte Konfigurationsvalidierung + nur-Doctor-Migrationen"
read_when:
  - Beim Entwerfen oder Implementieren von Konfigurationsvalidierungsverhalten
  - Beim Arbeiten an Konfigurationsmigrationen oder Doctor-Workflows
  - Beim Umgang mit Plugin-Konfigurationsschemata oder Plugin-Lade-Gating
title: "Strikte Konfigurationsvalidierung"
x-i18n:
  source_path: refactor/strict-config.md
  source_hash: 5bc7174a67d2234e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:21Z
---

# Strikte Konfigurationsvalidierung (nur-Doctor-Migrationen)

## Ziele

- **Unbekannte Konfigurationsschlüssel überall ablehnen** (Root + verschachtelt).
- **Plugin-Konfiguration ohne Schema ablehnen**; dieses Plugin nicht laden.
- **Legacy-Auto-Migration beim Laden entfernen**; Migrationen laufen ausschließlich über Doctor.
- **Doctor beim Start automatisch ausführen (Dry-Run)**; bei Ungültigkeit nicht-diagnostische Befehle blockieren.

## Nicht-Ziele

- Abwärtskompatibilität beim Laden (Legacy-Schlüssel werden nicht automatisch migriert).
- Stilles Verwerfen nicht erkannter Schlüssel.

## Strikte Validierungsregeln

- Die Konfiguration muss auf jeder Ebene exakt dem Schema entsprechen.
- Unbekannte Schlüssel sind Validierungsfehler (keine Durchleitung auf Root- oder verschachtelter Ebene).
- `plugins.entries.<id>.config` muss durch das Schema des Plugins validiert werden.
  - Fehlt einem Plugin ein Schema, **Plugin-Laden ablehnen** und einen klaren Fehler anzeigen.
- Unbekannte `channels.<id>`-Schlüssel sind Fehler, sofern kein Plugin-Manifest die Kanal-ID deklariert.
- Plugin-Manifeste (`openclaw.plugin.json`) sind für alle Plugins erforderlich.

## Durchsetzung von Plugin-Schemata

- Jedes Plugin stellt ein striktes JSON-Schema für seine Konfiguration bereit (inline im Manifest).
- Plugin-Ladeablauf:
  1. Plugin-Manifest + Schema auflösen (`openclaw.plugin.json`).
  2. Konfiguration gegen das Schema validieren.
  3. Bei fehlendem Schema oder ungültiger Konfiguration: Plugin-Laden blockieren, Fehler erfassen.
- Die Fehlermeldung enthält:
  - Plugin-ID
  - Grund (fehlendes Schema / ungültige Konfiguration)
  - Pfad(e), bei denen die Validierung fehlgeschlagen ist
- Deaktivierte Plugins behalten ihre Konfiguration, aber Doctor + Logs zeigen eine Warnung an.

## Doctor-Ablauf

- Doctor wird **jedes Mal** ausgeführt, wenn die Konfiguration geladen wird (standardmäßig Dry-Run).
- Wenn die Konfiguration ungültig ist:
  - Zusammenfassung + umsetzbare Fehler ausgeben.
  - Anweisung: `openclaw doctor --fix`.
- `openclaw doctor --fix`:
  - Wendet Migrationen an.
  - Entfernt unbekannte Schlüssel.
  - Schreibt die aktualisierte Konfiguration.

## Befehls-Gating (wenn die Konfiguration ungültig ist)

Erlaubt (nur Diagnose):

- `openclaw doctor`
- `openclaw logs`
- `openclaw health`
- `openclaw help`
- `openclaw status`
- `openclaw gateway status`

Alles andere muss hart fehlschlagen mit: „Konfiguration ungültig. Führen Sie `openclaw doctor --fix` aus.“

## Fehler-UX-Format

- Einzelne Überschrift mit Zusammenfassung.
- Gruppierte Abschnitte:
  - Unbekannte Schlüssel (vollständige Pfade)
  - Legacy-Schlüssel / benötigte Migrationen
  - Plugin-Ladefehler (Plugin-ID + Grund + Pfad)

## Implementierungs-Berührungspunkte

- `src/config/zod-schema.ts`: Root-Durchleitung entfernen; überall strikte Objekte.
- `src/config/zod-schema.providers.ts`: Strikte Kanal-Schemata sicherstellen.
- `src/config/validation.ts`: Bei unbekannten Schlüsseln fehlschlagen; keine Legacy-Migrationen anwenden.
- `src/config/io.ts`: Legacy-Auto-Migrationen entfernen; Doctor-Dry-Run immer ausführen.
- `src/config/legacy*.ts`: Nutzung ausschließlich zu Doctor verschieben.
- `src/plugins/*`: Schema-Registry + Gating hinzufügen.
- CLI-Befehls-Gating in `src/cli`.

## Tests

- Ablehnung unbekannter Schlüssel (Root + verschachtelt).
- Plugin ohne Schema → Plugin-Laden mit klarem Fehler blockiert.
- Ungültige Konfiguration → Gateway-Start blockiert, außer für Diagnosebefehle.
- Doctor-Dry-Run automatisch; `doctor --fix` schreibt korrigierte Konfiguration.
