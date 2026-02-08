---
summary: "CLI-Referenz fuer `openclaw hooks` (Agent-Hooks)"
read_when:
  - Sie moechten Agent-Hooks verwalten
  - Sie moechten Hooks installieren oder aktualisieren
title: "Hooks"
x-i18n:
  source_path: cli/hooks.md
  source_hash: e2032e61ff4b9135
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:48Z
---

# `openclaw hooks`

Verwalten Sie Agent-Hooks (ereignisgesteuerte Automatisierungen fuer Befehle wie `/new`, `/reset` und den Gateway-Start).

Verwandt:

- Hooks: [Hooks](/hooks)
- Plugin-Hooks: [Plugins](/plugin#plugin-hooks)

## Alle Hooks auflisten

```bash
openclaw hooks list
```

Listet alle erkannten Hooks aus Workspace-, verwalteten und gebuendelten Verzeichnissen auf.

**Optionen:**

- `--eligible`: Nur geeignete Hooks anzeigen (Voraussetzungen erfuellt)
- `--json`: Ausgabe als JSON
- `-v, --verbose`: Detaillierte Informationen einschliesslich fehlender Voraussetzungen anzeigen

**Beispielausgabe:**

```
Hooks (4/4 ready)

Ready:
  🚀 boot-md ✓ - Run BOOT.md on gateway startup
  📝 command-logger ✓ - Log all command events to a centralized audit file
  💾 session-memory ✓ - Save session context to memory when /new command is issued
  😈 soul-evil ✓ - Swap injected SOUL content during a purge window or by random chance
```

**Beispiel (ausfuehrlich):**

```bash
openclaw hooks list --verbose
```

Zeigt fehlende Voraussetzungen fuer nicht geeignete Hooks an.

**Beispiel (JSON):**

```bash
openclaw hooks list --json
```

Gibt strukturiertes JSON fuer die programmgesteuerte Nutzung zurueck.

## Hook-Informationen abrufen

```bash
openclaw hooks info <name>
```

Zeigt detaillierte Informationen zu einem bestimmten Hook an.

**Argumente:**

- `<name>`: Hook-Name (z. B. `session-memory`)

**Optionen:**

- `--json`: Ausgabe als JSON

**Beispiel:**

```bash
openclaw hooks info session-memory
```

**Ausgabe:**

```
💾 session-memory ✓ Ready

Save session context to memory when /new command is issued

Details:
  Source: openclaw-bundled
  Path: /path/to/openclaw/hooks/bundled/session-memory/HOOK.md
  Handler: /path/to/openclaw/hooks/bundled/session-memory/handler.ts
  Homepage: https://docs.openclaw.ai/hooks#session-memory
  Events: command:new

Requirements:
  Config: ✓ workspace.dir
```

## Hook-Eignung pruefen

```bash
openclaw hooks check
```

Zeigt eine Zusammenfassung des Eignungsstatus der Hooks an (wie viele bereit vs. nicht bereit sind).

**Optionen:**

- `--json`: Ausgabe als JSON

**Beispielausgabe:**

```
Hooks Status

Total hooks: 4
Ready: 4
Not ready: 0
```

## Einen Hook aktivieren

```bash
openclaw hooks enable <name>
```

Aktiviert einen bestimmten Hook, indem er Ihrer Konfiguration (`~/.openclaw/config.json`) hinzugefuegt wird.

**Hinweis:** Von Plugins verwaltete Hooks zeigen `plugin:<id>` in `openclaw hooks list` an und
koennen hier nicht aktiviert/deaktiviert werden. Aktivieren/deaktivieren Sie stattdessen das Plugin.

**Argumente:**

- `<name>`: Hook-Name (z. B. `session-memory`)

**Beispiel:**

```bash
openclaw hooks enable session-memory
```

**Ausgabe:**

```
✓ Enabled hook: 💾 session-memory
```

**Was dies bewirkt:**

- Prueft, ob der Hook existiert und geeignet ist
- Aktualisiert `hooks.internal.entries.<name>.enabled = true` in Ihrer Konfiguration
- Speichert die Konfiguration auf der Festplatte

**Nach dem Aktivieren:**

- Starten Sie den Gateway neu, damit Hooks neu geladen werden (Neustart der Menuleisten-App unter macOS oder Neustart Ihres Gateway-Prozesses in der Entwicklung).

## Einen Hook deaktivieren

```bash
openclaw hooks disable <name>
```

Deaktiviert einen bestimmten Hook durch Aktualisieren Ihrer Konfiguration.

**Argumente:**

- `<name>`: Hook-Name (z. B. `command-logger`)

**Beispiel:**

```bash
openclaw hooks disable command-logger
```

**Ausgabe:**

```
⏸ Disabled hook: 📝 command-logger
```

**Nach dem Deaktivieren:**

- Starten Sie den Gateway neu, damit Hooks neu geladen werden

## Hooks installieren

```bash
openclaw hooks install <path-or-spec>
```

Installiert ein Hook-Paket aus einem lokalen Ordner/Archiv oder von npm.

**Was dies bewirkt:**

- Kopiert das Hook-Paket nach `~/.openclaw/hooks/<id>`
- Aktiviert die installierten Hooks in `hooks.internal.entries.*`
- Zeichnet die Installation unter `hooks.internal.installs` auf

**Optionen:**

- `-l, --link`: Verknuepft ein lokales Verzeichnis statt zu kopieren (fuegt es zu `hooks.internal.load.extraDirs` hinzu)

**Unterstuetzte Archive:** `.zip`, `.tgz`, `.tar.gz`, `.tar`

**Beispiele:**

```bash
# Local directory
openclaw hooks install ./my-hook-pack

# Local archive
openclaw hooks install ./my-hook-pack.zip

# NPM package
openclaw hooks install @openclaw/my-hook-pack

# Link a local directory without copying
openclaw hooks install -l ./my-hook-pack
```

## Hooks aktualisieren

```bash
openclaw hooks update <id>
openclaw hooks update --all
```

Aktualisiert installierte Hook-Pakete (nur npm-Installationen).

**Optionen:**

- `--all`: Alle verfolgten Hook-Pakete aktualisieren
- `--dry-run`: Anzeigen, was sich aendern wuerde, ohne zu schreiben

## Gebuendelte Hooks

### session-memory

Speichert den Sitzungs-Kontext im Speicher, wenn Sie `/new` ausfuehren.

**Aktivieren:**

```bash
openclaw hooks enable session-memory
```

**Ausgabe:** `~/.openclaw/workspace/memory/YYYY-MM-DD-slug.md`

**Siehe:** [session-memory documentation](/hooks#session-memory)

### command-logger

Protokolliert alle Befehlsereignisse in einer zentralen Audit-Datei.

**Aktivieren:**

```bash
openclaw hooks enable command-logger
```

**Ausgabe:** `~/.openclaw/logs/commands.log`

**Protokolle anzeigen:**

```bash
# Recent commands
tail -n 20 ~/.openclaw/logs/commands.log

# Pretty-print
cat ~/.openclaw/logs/commands.log | jq .

# Filter by action
grep '"action":"new"' ~/.openclaw/logs/commands.log | jq .
```

**Siehe:** [command-logger documentation](/hooks#command-logger)

### soul-evil

Tauscht injizierte `SOUL.md`-Inhalte waehrend eines Bereinigungsfensters oder mit zufaelliger Wahrscheinlichkeit gegen `SOUL_EVIL.md` aus.

**Aktivieren:**

```bash
openclaw hooks enable soul-evil
```

**Siehe:** [SOUL Evil Hook](/hooks/soul-evil)

### boot-md

Fuehrt `BOOT.md` aus, wenn der Gateway startet (nachdem Kanaele gestartet wurden).

**Ereignisse**: `gateway:startup`

**Aktivieren**:

```bash
openclaw hooks enable boot-md
```

**Siehe:** [boot-md documentation](/hooks#boot-md)
