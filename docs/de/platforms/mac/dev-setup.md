---
summary: "Einrichtungsanleitung für Entwickler, die an der OpenClaw macOS-App arbeiten"
read_when:
  - Einrichten der macOS-Entwicklungsumgebung
title: "macOS-Entwickler-Setup"
x-i18n:
  source_path: platforms/mac/dev-setup.md
  source_hash: 4ea67701bd58b751
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:00Z
---

# macOS-Entwickler-Setup

Diese Anleitung beschreibt die erforderlichen Schritte, um die OpenClaw macOS-Anwendung aus dem Quellcode zu erstellen und auszuführen.

## Voraussetzungen

Bevor Sie die App erstellen, stellen Sie sicher, dass Folgendes installiert ist:

1.  **Xcode 26.2+**: Erforderlich für die Swift-Entwicklung.
2.  **Node.js 22+ & pnpm**: Erforderlich für das Gateway, die CLI und die Packaging-Skripte.

## 1. Abhängigkeiten installieren

Installieren Sie die projektweiten Abhängigkeiten:

```bash
pnpm install
```

## 2. App erstellen und paketieren

Um die macOS-App zu erstellen und in `dist/OpenClaw.app` zu paketieren, führen Sie Folgendes aus:

```bash
./scripts/package-mac-app.sh
```

Wenn Sie kein Apple Developer ID-Zertifikat haben, verwendet das Skript automatisch **Ad-hoc-Signierung** (`-`).

Informationen zu Dev-Ausführungsmodi, Signierungs-Flags und zur Fehlerbehebung bei der Team-ID finden Sie in der README der macOS-App:
https://github.com/openclaw/openclaw/blob/main/apps/macos/README.md

> **Hinweis**: Ad-hoc-signierte Apps können Sicherheitsabfragen auslösen. Wenn die App sofort mit „Abort trap 6“ abstürzt, lesen Sie den Abschnitt [Fehlerbehebung](#troubleshooting).

## 3. CLI installieren

Die macOS-App erwartet eine globale `openclaw` CLI-Installation zur Verwaltung von Hintergrundaufgaben.

**So installieren Sie sie (empfohlen):**

1.  Öffnen Sie die OpenClaw-App.
2.  Wechseln Sie zur Registerkarte **Allgemein** in den Einstellungen.
3.  Klicken Sie auf **„CLI installieren“**.

Alternativ können Sie die Installation manuell durchführen:

```bash
npm install -g openclaw@<version>
```

## Fehlerbehebung

### Build schlägt fehl: Toolchain- oder SDK-Nichtübereinstimmung

Der Build der macOS-App erwartet das neueste macOS-SDK und die Swift-6.2-Toolchain.

**Systemabhängigkeiten (erforderlich):**

- **Neueste über „Softwareupdate“ verfügbare macOS-Version** (erforderlich für die Xcode-26.2-SDKs)
- **Xcode 26.2** (Swift-6.2-Toolchain)

**Prüfungen:**

```bash
xcodebuild -version
xcrun swift --version
```

Wenn die Versionen nicht übereinstimmen, aktualisieren Sie macOS/Xcode und führen Sie den Build erneut aus.

### App stürzt bei Erteilung von Berechtigungen ab

Wenn die App abstürzt, sobald Sie den Zugriff auf **Spracherkennung** oder **Mikrofon** erlauben, kann dies an einem beschädigten TCC-Cache oder einer Signatur-Nichtübereinstimmung liegen.

**Behebung:**

1. Setzen Sie die TCC-Berechtigungen zurück:
   ```bash
   tccutil reset All bot.molt.mac.debug
   ```
2. Falls das nicht hilft, ändern Sie vorübergehend die `BUNDLE_ID` in [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh), um macOS zu einem „Neustart auf leerer Basis“ zu zwingen.

### Gateway bleibt dauerhaft bei „Starting…“

Wenn der Gateway-Status dauerhaft auf „Starting…“ bleibt, prüfen Sie, ob ein Zombie-Prozess den Port belegt:

```bash
openclaw gateway status
openclaw gateway stop

# If you’re not using a LaunchAgent (dev mode / manual runs), find the listener:
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

Wenn ein manueller Lauf den Port belegt, beenden Sie diesen Prozess (Ctrl+C). Als letzte Maßnahme beenden Sie die oben gefundene PID.
