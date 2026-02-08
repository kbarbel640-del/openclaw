---
summary: "Agent-Arbeitsbereich: Speicherort, Layout und Backup-Strategie"
read_when:
  - Sie muessen den Agent-Arbeitsbereich oder dessen Dateilayout erklaeren
  - Sie moechten einen Agent-Arbeitsbereich sichern oder migrieren
title: "Agent-Arbeitsbereich"
x-i18n:
  source_path: concepts/agent-workspace.md
  source_hash: 84c550fd89b5f247
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:04Z
---

# Agent-Arbeitsbereich

Der Arbeitsbereich ist das Zuhause des Agenten. Er ist das einzige Arbeitsverzeichnis, das fuer Dateitools und fuer den Arbeitsbereichskontext verwendet wird. Halten Sie ihn privat und behandeln Sie ihn wie Gedaechtnis.

Dies ist getrennt von `~/.openclaw/`, wo Konfiguration, Zugangsdaten und Sitzungen gespeichert werden.

**Wichtig:** Der Arbeitsbereich ist das **Standard-cwd**, keine harte Sandbox. Werkzeuge loesen relative Pfade gegen den Arbeitsbereich auf, aber absolute Pfade koennen weiterhin andere Bereiche des Hosts erreichen, sofern Sandboxing nicht aktiviert ist. Wenn Sie Isolation benoetigen, verwenden Sie [`agents.defaults.sandbox`](/gateway/sandboxing) (und/oder eine agentenspezifische Sandbox-Konfiguration). Wenn Sandboxing aktiviert ist und `workspaceAccess` nicht `"rw"` ist, arbeiten Werkzeuge innerhalb eines Sandbox-Arbeitsbereichs unter `~/.openclaw/sandboxes`, nicht in Ihrem Host-Arbeitsbereich.

## Standard-Speicherort

- Standard: `~/.openclaw/workspace`
- Wenn `OPENCLAW_PROFILE` gesetzt ist und nicht `"default"`, wird der Standard zu
  `~/.openclaw/workspace-<profile>`.
- Ueberschreiben in `~/.openclaw/openclaw.json`:

```json5
{
  agent: {
    workspace: "~/.openclaw/workspace",
  },
}
```

`openclaw onboard`, `openclaw configure` oder `openclaw setup` erstellen den Arbeitsbereich und initialisieren die Bootstrap-Dateien, falls sie fehlen.

Wenn Sie die Arbeitsbereichsdateien bereits selbst verwalten, koennen Sie die Erstellung der Bootstrap-Dateien deaktivieren:

```json5
{ agent: { skipBootstrap: true } }
```

## Zusaetzliche Arbeitsbereichsordner

Aeltere Installationen koennen `~/openclaw` erstellt haben. Mehrere Arbeitsbereichsverzeichnisse parallel zu behalten, kann zu verwirrender Authentifizierung oder Zustandsdrift fuehren, da immer nur ein Arbeitsbereich aktiv ist.

**Empfehlung:** Halten Sie einen einzelnen aktiven Arbeitsbereich. Wenn Sie die zusaetzlichen Ordner nicht mehr verwenden, archivieren Sie sie oder verschieben Sie sie in den Papierkorb (zum Beispiel `trash ~/openclaw`). Wenn Sie absichtlich mehrere Arbeitsbereiche behalten, stellen Sie sicher, dass `agents.defaults.workspace` auf den aktiven zeigt.

`openclaw doctor` warnt, wenn zusaetzliche Arbeitsbereichsverzeichnisse erkannt werden.

## Dateizuordnung im Arbeitsbereich (was jede Datei bedeutet)

Dies sind die Standarddateien, die OpenClaw im Arbeitsbereich erwartet:

- `AGENTS.md`
  - Arbeitsanweisungen fuer den Agenten und wie er Gedaechtnis verwenden soll.
  - Wird zu Beginn jeder Sitzung geladen.
  - Guter Ort fuer Regeln, Prioritaeten und Details zum „Wie verhalten“.

- `SOUL.md`
  - Persona, Ton und Grenzen.
  - Wird in jeder Sitzung geladen.

- `USER.md`
  - Wer der Benutzer ist und wie er angesprochen werden soll.
  - Wird in jeder Sitzung geladen.

- `IDENTITY.md`
  - Name, Vibe und Emoji des Agenten.
  - Wird waehrend des Bootstrap-Rituals erstellt/aktualisiert.

- `TOOLS.md`
  - Notizen zu Ihren lokalen Werkzeugen und Konventionen.
  - Steuert nicht die Verfuegbarkeit von Werkzeugen; dient nur als Orientierung.

- `HEARTBEAT.md`
  - Optionale kleine Checkliste fuer Heartbeat-Laeufe.
  - Halten Sie sie kurz, um Tokenverbrauch zu vermeiden.

- `BOOT.md`
  - Optionale Start-Checkliste, die beim Gateway-Neustart ausgefuehrt wird, wenn interne Hooks aktiviert sind.
  - Halten Sie sie kurz; verwenden Sie das Message-Tool fuer ausgehende Sends.

- `BOOTSTRAP.md`
  - Einmaliges Erststart-Ritual.
  - Wird nur fuer einen brandneuen Arbeitsbereich erstellt.
  - Loeschen Sie sie, nachdem das Ritual abgeschlossen ist.

- `memory/YYYY-MM-DD.md`
  - Taegliches Gedaechtnisprotokoll (eine Datei pro Tag).
  - Empfohlen, heute + gestern beim Sitzungsstart zu lesen.

- `MEMORY.md` (optional)
  - Kuratiertes Langzeitgedaechtnis.
  - Nur in der Haupt-, privaten Sitzung laden (nicht in geteilten/Gruppenkontexten).

Siehe [Memory](/concepts/memory) fuer den Workflow und das automatische Gedaechtnis-Flush.

- `skills/` (optional)
  - Arbeitsbereichsspezifische Skills.
  - Ueberschreibt verwaltete/gebuendelte Skills bei Namenskonflikten.

- `canvas/` (optional)
  - Canvas-UI-Dateien fuer Node-Anzeigen (zum Beispiel `canvas/index.html`).

Wenn eine Bootstrap-Datei fehlt, injiziert OpenClaw einen „missing file“-Marker in die Sitzung und faehrt fort. Grosse Bootstrap-Dateien werden beim Injizieren gekuerzt; passen Sie das Limit mit `agents.defaults.bootstrapMaxChars` an (Standard: 20000). `openclaw setup` kann fehlende Standardwerte neu erstellen, ohne bestehende Dateien zu ueberschreiben.

## Was NICHT im Arbeitsbereich ist

Diese liegen unter `~/.openclaw/` und sollten NICHT in das Arbeitsbereichs-Repo committed werden:

- `~/.openclaw/openclaw.json` (Konfiguration)
- `~/.openclaw/credentials/` (OAuth-Tokens, API-Schluessel)
- `~/.openclaw/agents/<agentId>/sessions/` (Sitzungstranskripte + Metadaten)
- `~/.openclaw/skills/` (verwaltete Skills)

Wenn Sie Sitzungen oder Konfiguration migrieren muessen, kopieren Sie sie separat und halten Sie sie aus der Versionsverwaltung heraus.

## Git-Backup (empfohlen, privat)

Behandeln Sie den Arbeitsbereich als privates Gedaechtnis. Legen Sie ihn in einem **privaten** Git-Repo ab, damit er gesichert und wiederherstellbar ist.

Fuehren Sie diese Schritte auf der Maschine aus, auf der das Gateway laeuft (dort befindet sich der Arbeitsbereich).

### 1) Repository initialisieren

Wenn Git installiert ist, werden brandneue Arbeitsbereiche automatisch initialisiert. Wenn dieser Arbeitsbereich noch kein Repo ist, fuehren Sie aus:

```bash
cd ~/.openclaw/workspace
git init
git add AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md HEARTBEAT.md memory/
git commit -m "Add agent workspace"
```

### 2) Privates Remote hinzufuegen (einsteigerfreundliche Optionen)

Option A: GitHub-Web-UI

1. Erstellen Sie ein neues **privates** Repository auf GitHub.
2. Initialisieren Sie es nicht mit einer README (vermeidet Merge-Konflikte).
3. Kopieren Sie die HTTPS-Remote-URL.
4. Fuegen Sie das Remote hinzu und pushen Sie:

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

Option B: GitHub CLI (`gh`)

```bash
gh auth login
gh repo create openclaw-workspace --private --source . --remote origin --push
```

Option C: GitLab-Web-UI

1. Erstellen Sie ein neues **privates** Repository auf GitLab.
2. Initialisieren Sie es nicht mit einer README (vermeidet Merge-Konflikte).
3. Kopieren Sie die HTTPS-Remote-URL.
4. Fuegen Sie das Remote hinzu und pushen Sie:

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

### 3) Laufende Aktualisierungen

```bash
git status
git add .
git commit -m "Update memory"
git push
```

## Keine Geheimnisse committen

Selbst in einem privaten Repo sollten Sie vermeiden, Geheimnisse im Arbeitsbereich zu speichern:

- API-Schluessel, OAuth-Tokens, Passwoerter oder private Zugangsdaten.
- Alles unter `~/.openclaw/`.
- Roh-Dumps von Chats oder sensible Anhaenge.

Wenn Sie sensible Referenzen speichern muessen, verwenden Sie Platzhalter und bewahren Sie das echte Geheimnis woanders auf (Passwortmanager, Umgebungsvariablen oder `~/.openclaw/`).

Vorgeschlagener `.gitignore`-Starter:

```gitignore
.DS_Store
.env
**/*.key
**/*.pem
**/secrets*
```

## Arbeitsbereich auf eine neue Maschine verschieben

1. Klonen Sie das Repo an den gewuenschten Pfad (Standard `~/.openclaw/workspace`).
2. Setzen Sie `agents.defaults.workspace` in `~/.openclaw/openclaw.json` auf diesen Pfad.
3. Fuehren Sie `openclaw setup --workspace <path>` aus, um fehlende Dateien zu initialisieren.
4. Wenn Sie Sitzungen benoetigen, kopieren Sie `~/.openclaw/agents/<agentId>/sessions/` separat von der alten Maschine.

## Erweiterte Hinweise

- Multi-Agent-Routing kann unterschiedliche Arbeitsbereiche pro Agent verwenden. Siehe [Channel routing](/concepts/channel-routing) fuer die Routing-Konfiguration.
- Wenn `agents.defaults.sandbox` aktiviert ist, koennen Nicht-Hauptsitzungen pro Sitzung Sandbox-Arbeitsbereiche unter `agents.defaults.sandbox.workspaceRoot` verwenden.
