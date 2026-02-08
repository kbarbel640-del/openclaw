---
summary: "Wie OpenClaw Apple-Gerätemodellkennungen für verständliche Namen in der macOS-App bereitstellt."
read_when:
  - Beim Aktualisieren von Zuordnungen für Gerätemodellkennungen oder NOTICE-/Lizenzdateien
  - Beim Ändern der Anzeige von Gerätenamen in der Instances-UI
title: "Gerätemodell-Datenbank"
x-i18n:
  source_path: reference/device-models.md
  source_hash: 1d99c2538a0d8fdd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:20Z
---

# Gerätemodell-Datenbank (verständliche Namen)

Die macOS-Begleit-App zeigt in der **Instances**-UI verständliche Apple-Gerätemodellnamen an, indem Apple-Modellkennungen (z. B. `iPad16,6`, `Mac16,6`) auf für Menschen lesbare Namen abgebildet werden.

Die Zuordnung wird als JSON bereitgestellt unter:

- `apps/macos/Sources/OpenClaw/Resources/DeviceModels/`

## Datenquelle

Derzeit beziehen wir die Zuordnung aus dem MIT-lizenzierten Repository:

- `kyle-seongwoo-jun/apple-device-identifiers`

Um Builds deterministisch zu halten, sind die JSON-Dateien auf bestimmte Upstream-Commits fixiert (vermerkt in `apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md`).

## Aktualisieren der Datenbank

1. Wählen Sie die Upstream-Commits aus, auf die Sie fixieren möchten (einen für iOS, einen für macOS).
2. Aktualisieren Sie die Commit-Hashes in `apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md`.
3. Laden Sie die JSON-Dateien erneut herunter, fixiert auf diese Commits:

```bash
IOS_COMMIT="<commit sha for ios-device-identifiers.json>"
MAC_COMMIT="<commit sha for mac-device-identifiers.json>"

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${IOS_COMMIT}/ios-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/ios-device-identifiers.json

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${MAC_COMMIT}/mac-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/mac-device-identifiers.json
```

4. Stellen Sie sicher, dass `apps/macos/Sources/OpenClaw/Resources/DeviceModels/LICENSE.apple-device-identifiers.txt` weiterhin dem Upstream entspricht (ersetzen Sie sie, falls sich die Upstream-Lizenz ändert).
5. Verifizieren Sie, dass die macOS-App fehlerfrei baut (keine Warnungen):

```bash
swift build --package-path apps/macos
```
