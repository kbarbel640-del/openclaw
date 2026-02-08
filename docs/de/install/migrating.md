---
summary: „Verschieben (migrieren) einer OpenClaw-Installation von einer Maschine auf eine andere“
read_when:
  - Sie ziehen OpenClaw auf einen neuen Laptop/Server um
  - Sie möchten Sitzungen, Authentifizierung und Kanal-Logins (WhatsApp usw.) beibehalten
title: „Migrationsleitfaden“
x-i18n:
  source_path: install/migrating.md
  source_hash: 604d862c4bf86e79
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:48Z
---

# Migration von OpenClaw auf eine neue Maschine

Dieser Leitfaden migriert ein OpenClaw Gateway von einer Maschine auf eine andere, **ohne die Einführung erneut durchzuführen**.

Die Migration ist konzeptionell einfach:

- Kopieren Sie das **State-Verzeichnis** (`$OPENCLAW_STATE_DIR`, Standard: `~/.openclaw/`) — dies umfasst Konfiguration, Authentifizierung, Sitzungen und Kanalstatus.
- Kopieren Sie Ihren **Workspace** (`~/.openclaw/workspace/` standardmäßig) — dieser enthält Ihre Agent-Dateien (Speicher, Prompts usw.).

Es gibt jedoch häufige Stolperfallen rund um **Profile**, **Berechtigungen** und **unvollständige Kopien**.

## Bevor Sie beginnen (was Sie migrieren)

### 1) Ermitteln Sie Ihr State-Verzeichnis

Die meisten Installationen verwenden den Standard:

- **State-Verzeichnis:** `~/.openclaw/`

Es kann jedoch abweichen, wenn Sie Folgendes verwenden:

- `--profile <name>` (wird oft zu `~/.openclaw-<profile>/`)
- `OPENCLAW_STATE_DIR=/some/path`

Wenn Sie unsicher sind, führen Sie auf der **alten** Maschine aus:

```bash
openclaw status
```

Achten Sie in der Ausgabe auf Hinweise auf `OPENCLAW_STATE_DIR` / Profil. Wenn Sie mehrere Gateways betreiben, wiederholen Sie dies für jedes Profil.

### 2) Ermitteln Sie Ihren Workspace

Häufige Standards:

- `~/.openclaw/workspace/` (empfohlener Workspace)
- ein benutzerdefinierter Ordner, den Sie erstellt haben

Ihr Workspace ist der Ort, an dem Dateien wie `MEMORY.md`, `USER.md` und `memory/*.md` liegen.

### 3) Verstehen Sie, was erhalten bleibt

Wenn Sie **sowohl** das State-Verzeichnis als auch den Workspace kopieren, behalten Sie:

- Gateway-Konfiguration (`openclaw.json`)
- Authentifizierungsprofile / API-Schlüssel / OAuth-Tokens
- Sitzungsverlauf + Agent-Status
- Kanalstatus (z. B. WhatsApp-Login/Sitzung)
- Ihre Workspace-Dateien (Speicher, Skills-Notizen usw.)

Wenn Sie **nur** den Workspace kopieren (z. B. über Git), behalten Sie **nicht**:

- Sitzungen
- Zugangsdaten
- Kanal-Logins

Diese befinden sich unter `$OPENCLAW_STATE_DIR`.

## Migrationsschritte (empfohlen)

### Schritt 0 — Backup erstellen (alte Maschine)

Stoppen Sie auf der **alten** Maschine zuerst das Gateway, damit sich Dateien während des Kopierens nicht ändern:

```bash
openclaw gateway stop
```

(Optional, aber empfohlen) archivieren Sie das State-Verzeichnis und den Workspace:

```bash
# Adjust paths if you use a profile or custom locations
cd ~
tar -czf openclaw-state.tgz .openclaw

tar -czf openclaw-workspace.tgz .openclaw/workspace
```

Wenn Sie mehrere Profile/State-Verzeichnisse haben (z. B. `~/.openclaw-main`, `~/.openclaw-work`), archivieren Sie jedes.

### Schritt 1 — OpenClaw auf der neuen Maschine installieren

Installieren Sie auf der **neuen** Maschine die CLI (und ggf. Node):

- Siehe: [Install](/install)

In diesem Stadium ist es in Ordnung, wenn die Einführung ein frisches `~/.openclaw/` erstellt — Sie überschreiben es im nächsten Schritt.

### Schritt 2 — State-Verzeichnis + Workspace auf die neue Maschine kopieren

Kopieren Sie **beides**:

- `$OPENCLAW_STATE_DIR` (Standard `~/.openclaw/`)
- Ihren Workspace (Standard `~/.openclaw/workspace/`)

Gängige Vorgehensweisen:

- `scp` der Tarballs und Entpacken
- `rsync -a` über SSH
- externes Laufwerk

Stellen Sie nach dem Kopieren sicher:

- Versteckte Verzeichnisse wurden eingeschlossen (z. B. `.openclaw/`)
- Die Dateibesitzrechte sind korrekt für den Benutzer, der das Gateway ausführt

### Schritt 3 — Doctor ausführen (Migrationen + Service-Reparatur)

Auf der **neuen** Maschine:

```bash
openclaw doctor
```

Doctor ist der „sichere, langweilige“ Befehl. Er repariert Services, wendet Konfigurationsmigrationen an und warnt vor Abweichungen.

Danach:

```bash
openclaw gateway restart
openclaw status
```

## Häufige Stolperfallen (und wie Sie sie vermeiden)

### Stolperfalle: Profil- / State-Verzeichnis-Mismatch

Wenn Sie das alte Gateway mit einem Profil (oder `OPENCLAW_STATE_DIR`) betrieben haben und das neue Gateway ein anderes verwendet, sehen Sie Symptome wie:

- Konfigurationsänderungen greifen nicht
- Kanäle fehlen / sind abgemeldet
- Leerer Sitzungsverlauf

Behebung: Starten Sie das Gateway/den Service mit **demselben** Profil/State-Verzeichnis, das Sie migriert haben, und führen Sie dann erneut aus:

```bash
openclaw doctor
```

### Stolperfalle: Kopieren nur von `openclaw.json`

`openclaw.json` reicht nicht aus. Viele Anbieter speichern ihren Status unter:

- `$OPENCLAW_STATE_DIR/credentials/`
- `$OPENCLAW_STATE_DIR/agents/<agentId>/...`

Migrieren Sie immer den gesamten Ordner `$OPENCLAW_STATE_DIR`.

### Stolperfalle: Berechtigungen / Besitzrechte

Wenn Sie als Root kopiert oder Benutzer gewechselt haben, kann das Gateway möglicherweise keine Zugangsdaten/Sitzungen lesen.

Behebung: Stellen Sie sicher, dass State-Verzeichnis und Workspace dem Benutzer gehören, der das Gateway ausführt.

### Stolperfalle: Migration zwischen Remote-/Local-Modi

- Wenn Ihre UI (WebUI/TUI) auf ein **remote** Gateway zeigt, besitzt der Remote-Host den Sitzungsspeicher + Workspace.
- Die Migration Ihres Laptops verschiebt nicht den Status des Remote-Gateways.

Wenn Sie im Remote-Modus sind, migrieren Sie den **Gateway-Host**.

### Stolperfalle: Geheimnisse in Backups

`$OPENCLAW_STATE_DIR` enthält Geheimnisse (API-Schlüssel, OAuth-Tokens, WhatsApp-Zugangsdaten). Behandeln Sie Backups wie Produktionsgeheimnisse:

- verschlüsselt speichern
- Weitergabe über unsichere Kanäle vermeiden
- Schlüssel rotieren, wenn Sie eine Offenlegung vermuten

## Verifikations-Checkliste

Bestätigen Sie auf der neuen Maschine:

- `openclaw status` zeigt, dass das Gateway läuft
- Ihre Kanäle sind weiterhin verbunden (z. B. erfordert WhatsApp kein erneutes Koppeln)
- Das Dashboard öffnet sich und zeigt bestehende Sitzungen
- Ihre Workspace-Dateien (Speicher, Konfigurationen) sind vorhanden

## Verwandt

- [Doctor](/gateway/doctor)
- [Gateway troubleshooting](/gateway/troubleshooting)
- [Wo speichert OpenClaw seine Daten?](/help/faq#where-does-openclaw-store-its-data)
