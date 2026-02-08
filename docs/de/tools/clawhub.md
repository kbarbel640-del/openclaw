---
summary: „ClawHub-Leitfaden: öffentliches Skills-Register + CLI-Workflows“
read_when:
  - Einführung von ClawHub für neue Nutzer
  - Installieren, Suchen oder Veröffentlichen von Skills
  - Erläuterung von ClawHub-CLI-Flags und Synchronisationsverhalten
title: „ClawHub“
x-i18n:
  source_path: tools/clawhub.md
  source_hash: b572473a11246357
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:55Z
---

# ClawHub

ClawHub ist das **öffentliche Skills-Register für OpenClaw**. Es ist ein kostenloser Dienst: Alle Skills sind öffentlich, offen und für alle sichtbar, um geteilt und wiederverwendet zu werden. Ein Skill ist lediglich ein Ordner mit einer `SKILL.md`-Datei (plus unterstützenden Textdateien). Sie können Skills in der Web-App durchsuchen oder die CLI verwenden, um Skills zu suchen, zu installieren, zu aktualisieren und zu veröffentlichen.

Website: [clawhub.ai](https://clawhub.ai)

## Was ClawHub ist

- Ein öffentliches Register für OpenClaw-Skills.
- Ein versionierter Speicher für Skill-Bundles und Metadaten.
- Eine Oberfläche zur Erkennung über Suche, Tags und Nutzungssignale.

## Wie es funktioniert

1. Ein Nutzer veröffentlicht ein Skill-Bundle (Dateien + Metadaten).
2. ClawHub speichert das Bundle, parst die Metadaten und weist eine Version zu.
3. Das Register indexiert den Skill für Suche und Erkennung.
4. Nutzer durchsuchen, laden herunter und installieren Skills in OpenClaw.

## Was Sie tun können

- Neue Skills und neue Versionen bestehender Skills veröffentlichen.
- Skills nach Name, Tags oder Suche entdecken.
- Skill-Bundles herunterladen und ihre Dateien prüfen.
- Skills melden, die missbräuchlich oder unsicher sind.
- Wenn Sie Moderator sind: ausblenden, einblenden, löschen oder sperren.

## Für wen das ist (einsteigerfreundlich)

Wenn Sie Ihrem OpenClaw-Agenten neue Fähigkeiten hinzufügen möchten, ist ClawHub der einfachste Weg, Skills zu finden und zu installieren. Sie müssen nicht wissen, wie das Backend funktioniert. Sie können:

- Skills in Alltagssprache suchen.
- Einen Skill in Ihren Workspace installieren.
- Skills später mit einem Befehl aktualisieren.
- Ihre eigenen Skills sichern, indem Sie sie veröffentlichen.

## Schnellstart (nicht technisch)

1. Installieren Sie die CLI (siehe nächsten Abschnitt).
2. Suchen Sie nach etwas, das Sie benötigen:
   - `clawhub search "calendar"`
3. Installieren Sie einen Skill:
   - `clawhub install <skill-slug>`
4. Starten Sie eine neue OpenClaw-Sitzung, damit der neue Skill geladen wird.

## CLI installieren

Wählen Sie eine Option:

```bash
npm i -g clawhub
```

```bash
pnpm add -g clawhub
```

## Wie es in OpenClaw eingebunden ist

Standardmäßig installiert die CLI Skills unter `./skills` in Ihrem aktuellen Arbeitsverzeichnis. Wenn ein OpenClaw-Workspace konfiguriert ist, greift `clawhub` auf diesen Workspace zurück, sofern Sie `--workdir` (oder `CLAWHUB_WORKDIR`) nicht überschreiben. OpenClaw lädt Workspace-Skills aus `<workspace>/skills` und übernimmt sie in der **nächsten** Sitzung. Wenn Sie bereits `~/.openclaw/skills` oder gebündelte Skills verwenden, haben Workspace-Skills Vorrang.

Weitere Details dazu, wie Skills geladen, geteilt und eingeschränkt werden, finden Sie unter
[Skills](/tools/skills).

## Überblick über das Skill-System

Ein Skill ist ein versioniertes Bundle von Dateien, das OpenClaw beibringt, eine bestimmte Aufgabe auszuführen. Jede Veröffentlichung erstellt eine neue Version, und das Register führt eine Versionshistorie, damit Nutzer Änderungen prüfen können.

Ein typischer Skill umfasst:

- Eine `SKILL.md`-Datei mit der primären Beschreibung und Nutzung.
- Optionale Konfigurationen, Skripte oder unterstützende Dateien, die vom Skill verwendet werden.
- Metadaten wie Tags, Zusammenfassung und Installationsanforderungen.

ClawHub nutzt Metadaten, um die Erkennung zu ermöglichen und Skill-Fähigkeiten sicher bereitzustellen. Das Register verfolgt außerdem Nutzungssignale (wie Sterne und Downloads), um Ranking und Sichtbarkeit zu verbessern.

## Was der Dienst bietet (Funktionen)

- **Öffentliches Durchsuchen** von Skills und ihrem `SKILL.md`-Inhalt.
- **Suche** auf Basis von Embeddings (Vektorsuche), nicht nur von Schlüsselwörtern.
- **Versionierung** mit Semver, Changelogs und Tags (einschließlich `latest`).
- **Downloads** als ZIP pro Version.
- **Sterne und Kommentare** für Community-Feedback.
- **Moderationsfunktionen** für Freigaben und Prüfungen.
- **CLI-freundliche API** für Automatisierung und Skripting.

## Sicherheit und Moderation

ClawHub ist standardmäßig offen. Jeder kann Skills hochladen, aber ein GitHub-Konto muss mindestens eine Woche alt sein, um veröffentlichen zu können. Dies verlangsamt Missbrauch, ohne legitime Mitwirkende zu blockieren.

Meldungen und Moderation:

- Jeder angemeldete Nutzer kann einen Skill melden.
- Meldegründe sind erforderlich und werden protokolliert.
- Jeder Nutzer kann gleichzeitig bis zu 20 aktive Meldungen haben.
- Skills mit mehr als 3 eindeutigen Meldungen werden standardmäßig automatisch ausgeblendet.
- Moderatoren können ausgeblendete Skills einsehen, sie wieder einblenden, löschen oder Nutzer sperren.
- Missbrauch der Meldefunktion kann zu Kontosperren führen.

Interessiert daran, Moderator zu werden? Fragen Sie im OpenClaw-Discord und kontaktieren Sie einen Moderator oder Maintainer.

## CLI-Befehle und Parameter

Globale Optionen (gelten für alle Befehle):

- `--workdir <dir>`: Arbeitsverzeichnis (Standard: aktuelles Verzeichnis; Fallback auf OpenClaw-Workspace).
- `--dir <dir>`: Skills-Verzeichnis, relativ zum Arbeitsverzeichnis (Standard: `skills`).
- `--site <url>`: Basis-URL der Website (Browser-Login).
- `--registry <url>`: Basis-URL der Registry-API.
- `--no-input`: Eingabeaufforderungen deaktivieren (nicht interaktiv).
- `-V, --cli-version`: CLI-Version ausgeben.

Auth:

- `clawhub login` (Browser-Flow) oder `clawhub login --token <token>`
- `clawhub logout`
- `clawhub whoami`

Optionen:

- `--token <token>`: API-Token einfügen.
- `--label <label>`: Bezeichnung für gespeicherte Browser-Login-Tokens (Standard: `CLI token`).
- `--no-browser`: Keinen Browser öffnen (erfordert `--token`).

Suche:

- `clawhub search "query"`
- `--limit <n>`: Maximale Ergebnisse.

Installieren:

- `clawhub install <slug>`
- `--version <version>`: Eine bestimmte Version installieren.
- `--force`: Überschreiben, wenn der Ordner bereits existiert.

Aktualisieren:

- `clawhub update <slug>`
- `clawhub update --all`
- `--version <version>`: Auf eine bestimmte Version aktualisieren (nur einzelner Slug).
- `--force`: Überschreiben, wenn lokale Dateien keiner veröffentlichten Version entsprechen.

Auflisten:

- `clawhub list` (liest `.clawhub/lock.json`).

Veröffentlichen:

- `clawhub publish <path>`
- `--slug <slug>`: Skill-Slug.
- `--name <name>`: Anzeigename.
- `--version <version>`: Semver-Version.
- `--changelog <text>`: Changelog-Text (kann leer sein).
- `--tags <tags>`: Kommagetrennte Tags (Standard: `latest`).

Löschen/Wiederherstellen (nur Eigentümer/Admin):

- `clawhub delete <slug> --yes`
- `clawhub undelete <slug> --yes`

Sync (lokale Skills scannen + neue/aktualisierte veröffentlichen):

- `clawhub sync`
- `--root <dir...>`: Zusätzliche Scan-Wurzeln.
- `--all`: Alles ohne Rückfragen hochladen.
- `--dry-run`: Anzeigen, was hochgeladen würde.
- `--bump <type>`: `patch|minor|major` für Updates (Standard: `patch`).
- `--changelog <text>`: Changelog für nicht interaktive Updates.
- `--tags <tags>`: Kommagetrennte Tags (Standard: `latest`).
- `--concurrency <n>`: Registry-Prüfungen (Standard: 4).

## Häufige Workflows für Agenten

### Nach Skills suchen

```bash
clawhub search "postgres backups"
```

### Neue Skills herunterladen

```bash
clawhub install my-skill-pack
```

### Installierte Skills aktualisieren

```bash
clawhub update --all
```

### Ihre Skills sichern (veröffentlichen oder synchronisieren)

Für einen einzelnen Skill-Ordner:

```bash
clawhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0 --tags latest
```

Um viele Skills auf einmal zu scannen und zu sichern:

```bash
clawhub sync --all
```

## Erweiterte Details (technisch)

### Versionierung und Tags

- Jede Veröffentlichung erstellt eine neue **Semver**-`SkillVersion`.
- Tags (wie `latest`) verweisen auf eine Version; durch Verschieben von Tags können Sie ein Rollback durchführen.
- Changelogs sind pro Version angehängt und können beim Synchronisieren oder Veröffentlichen von Updates leer sein.

### Lokale Änderungen vs. Registry-Versionen

Aktualisierungen vergleichen den lokalen Skill-Inhalt mit Registry-Versionen anhand eines Inhalts-Hashes. Wenn lokale Dateien keiner veröffentlichten Version entsprechen, fragt die CLI vor dem Überschreiben nach (oder erfordert `--force` bei nicht interaktiven Läufen).

### Sync-Scan und Fallback-Wurzeln

`clawhub sync` scannt zuerst Ihr aktuelles Arbeitsverzeichnis. Wenn keine Skills gefunden werden, greift es auf bekannte Legacy-Speicherorte zurück (zum Beispiel `~/openclaw/skills` und `~/.openclaw/skills`). Dies dient dazu, ältere Skill-Installationen ohne zusätzliche Flags zu finden.

### Speicher und Lockfile

- Installierte Skills werden unter `.clawhub/lock.json` in Ihrem Arbeitsverzeichnis erfasst.
- Auth-Tokens werden in der ClawHub-CLI-Konfigurationsdatei gespeichert (Überschreiben über `CLAWHUB_CONFIG_PATH`).

### Telemetrie (Installationszahlen)

Wenn Sie `clawhub sync` ausführen, während Sie angemeldet sind, sendet die CLI eine minimale Momentaufnahme zur Berechnung von Installationszahlen. Sie können dies vollständig deaktivieren:

```bash
export CLAWHUB_DISABLE_TELEMETRY=1
```

## Umgebungsvariablen

- `CLAWHUB_SITE`: Überschreibt die Website-URL.
- `CLAWHUB_REGISTRY`: Überschreibt die Registry-API-URL.
- `CLAWHUB_CONFIG_PATH`: Überschreibt den Speicherort für Token/Konfiguration der CLI.
- `CLAWHUB_WORKDIR`: Überschreibt das Standard-Arbeitsverzeichnis.
- `CLAWHUB_DISABLE_TELEMETRY=1`: Deaktiviert Telemetrie bei `sync`.
