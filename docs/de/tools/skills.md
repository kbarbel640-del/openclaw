---
summary: "Skills: verwaltet vs. Workspace, Gating-Regeln und Konfigurations-/Env-Verkabelung"
read_when:
  - Hinzufügen oder Ändern von Skills
  - Ändern von Skill-Gating oder Lade-Regeln
title: "Skills"
x-i18n:
  source_path: tools/skills.md
  source_hash: 54685da5885600b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:09Z
---

# Skills (OpenClaw)

OpenClaw verwendet **[AgentSkills](https://agentskills.io)-kompatible** Skill-Ordner, um dem Agenten den Umgang mit Werkzeugen beizubringen. Jeder Skill ist ein Verzeichnis, das eine `SKILL.md` mit YAML-Frontmatter und Anweisungen enthält. OpenClaw lädt **gebündelte Skills** plus optionale lokale Overrides und filtert sie zur Ladezeit anhand von Umgebung, Konfiguration und Vorhandensein von Binaries.

## Speicherorte und Priorität

Skills werden aus **drei** Orten geladen:

1. **Gebündelte Skills**: werden mit der Installation ausgeliefert (npm-Paket oder OpenClaw.app)
2. **Verwaltete/lokale Skills**: `~/.openclaw/skills`
3. **Workspace-Skills**: `<workspace>/skills`

Bei Namenskonflikten gilt folgende Priorität:

`<workspace>/skills` (höchste) → `~/.openclaw/skills` → gebündelte Skills (niedrigste)

Zusätzlich können Sie über `skills.load.extraDirs` in `~/.openclaw/openclaw.json` weitere Skill-Ordner (niedrigste Priorität) konfigurieren.

## Pro-Agent- vs. geteilte Skills

In **Multi-Agent**-Setups hat jeder Agent seinen eigenen Workspace. Das bedeutet:

- **Pro-Agent-Skills** liegen in `<workspace>/skills` und gelten nur für diesen Agenten.
- **Geteilte Skills** liegen in `~/.openclaw/skills` (verwaltet/lokal) und sind
  für **alle Agenten** auf derselben Maschine sichtbar.
- **Geteilte Ordner** können auch über `skills.load.extraDirs` (niedrigste Priorität)
  hinzugefügt werden, wenn Sie ein gemeinsames Skill-Paket für mehrere Agenten verwenden möchten.

Existiert derselbe Skillname an mehr als einem Ort, gilt die übliche Priorität:
Workspace gewinnt, dann verwaltet/lokal, dann gebündelt.

## Plugins + Skills

Plugins können eigene Skills ausliefern, indem sie `skills`-Verzeichnisse in
`openclaw.plugin.json` auflisten (Pfade relativ zum Plugin-Root). Plugin-Skills werden geladen,
wenn das Plugin aktiviert ist, und nehmen an den normalen Skill-Prioritätsregeln teil.
Sie können sie über `metadata.openclaw.requires.config` im Konfigurationseintrag des Plugins steuern.
Siehe [Plugins](/plugin) für Erkennung/Konfiguration und [Tools](/tools) für die
Werkzeugoberfläche, die diese Skills vermitteln.

## ClawHub (Installieren + Synchronisieren)

ClawHub ist das öffentliche Skills-Register für OpenClaw. Stöbern Sie unter
https://clawhub.com. Nutzen Sie es zum Entdecken, Installieren, Aktualisieren
und Sichern von Skills. Vollständige Anleitung: [ClawHub](/tools/clawhub).

Häufige Abläufe:

- Einen Skill in Ihren Workspace installieren:
  - `clawhub install <skill-slug>`
- Alle installierten Skills aktualisieren:
  - `clawhub update --all`
- Synchronisieren (Scannen + Updates veröffentlichen):
  - `clawhub sync --all`

Standardmäßig installiert `clawhub` in `./skills` unter Ihrem aktuellen
Arbeitsverzeichnis (oder fällt auf den konfigurierten OpenClaw-Workspace zurück).
OpenClaw übernimmt dies in der nächsten Sitzung als `<workspace>/skills`.

## Sicherheitshinweise

- Behandeln Sie Skills von Drittanbietern als **nicht vertrauenswürdigen Code**. Lesen Sie sie vor dem Aktivieren.
- Bevorzugen Sie für nicht vertrauenswürdige Eingaben und riskante Werkzeuge Ausführungen in einer Sandbox. Siehe [Sandboxing](/gateway/sandboxing).
- `skills.entries.*.env` und `skills.entries.*.apiKey` injizieren Geheimnisse in den **Host**-Prozess
  für diesen Agenten-Turn (nicht in die Sandbox). Halten Sie Geheimnisse aus Prompts und Logs heraus.
- Für ein umfassenderes Bedrohungsmodell und Checklisten siehe [Security](/gateway/security).

## Format (AgentSkills + Pi-kompatibel)

`SKILL.md` muss mindestens enthalten:

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
---
```

Hinweise:

- Wir folgen der AgentSkills-Spezifikation für Layout/Intention.
- Der vom eingebetteten Agenten verwendete Parser unterstützt nur **einzeilige** Frontmatter-Schlüssel.
- `metadata` sollte ein **einzeiliges JSON-Objekt** sein.
- Verwenden Sie `{baseDir}` in den Anweisungen, um auf den Skill-Ordnerpfad zu verweisen.
- Optionale Frontmatter-Schlüssel:
  - `homepage` — URL, die in der macOS-Skills-UI als „Website“ angezeigt wird (auch über `metadata.openclaw.homepage` unterstützt).
  - `user-invocable` — `true|false` (Standard: `true`). Wenn `true`, wird der Skill als Benutzer-Slash-Befehl bereitgestellt.
  - `disable-model-invocation` — `true|false` (Standard: `false`). Wenn `true`, wird der Skill aus dem Modell-Prompt ausgeschlossen (weiterhin über Benutzeraufruf verfügbar).
  - `command-dispatch` — `tool` (optional). Wenn auf `tool` gesetzt, umgeht der Slash-Befehl das Modell und dispatcht direkt an ein Werkzeug.
  - `command-tool` — Werkzeugname, der aufgerufen wird, wenn `command-dispatch: tool` gesetzt ist.
  - `command-arg-mode` — `raw` (Standard). Für Tool-Dispatch werden die rohen Argumente an das Werkzeug weitergereicht (keine Core-Analyse).

    Das Werkzeug wird mit folgenden Parametern aufgerufen:
    `{ command: "<raw args>", commandName: "<slash command>", skillName: "<skill name>" }`.

## Gating (Filter zur Ladezeit)

OpenClaw **filtert Skills zur Ladezeit** mithilfe von `metadata` (einzeiliges JSON):

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["uv"], "env": ["GEMINI_API_KEY"], "config": ["browser.enabled"] },
        "primaryEnv": "GEMINI_API_KEY",
      },
  }
---
```

Felder unter `metadata.openclaw`:

- `always: true` — Skill immer einschließen (andere Gates überspringen).
- `emoji` — optionales Emoji, das von der macOS-Skills-UI verwendet wird.
- `homepage` — optionale URL, die in der macOS-Skills-UI als „Website“ angezeigt wird.
- `os` — optionale Liste von Plattformen (`darwin`, `linux`, `win32`). Falls gesetzt, ist der Skill nur auf diesen Betriebssystemen zulässig.
- `requires.bins` — Liste; jedes Element muss auf `PATH` existieren.
- `requires.anyBins` — Liste; mindestens eines muss auf `PATH` existieren.
- `requires.env` — Liste; die Umgebungsvariable muss existieren **oder** in der Konfiguration bereitgestellt sein.
- `requires.config` — Liste von `openclaw.json`-Pfaden, die truthy sein müssen.
- `primaryEnv` — Name der Umgebungsvariable, die mit `skills.entries.<name>.apiKey` verknüpft ist.
- `install` — optionales Array von Installer-Spezifikationen, die von der macOS-Skills-UI verwendet werden (brew/node/go/uv/download).

Hinweis zu Sandboxing:

- `requires.bins` wird zur Ladezeit des Skills auf dem **Host** geprüft.
- Wenn ein Agent in einer Sandbox läuft, muss das Binary außerdem **im Container** vorhanden sein.
  Installieren Sie es über `agents.defaults.sandbox.docker.setupCommand` (oder ein benutzerdefiniertes Image).
  `setupCommand` wird einmal ausgeführt, nachdem der Container erstellt wurde.
  Paketinstallationen erfordern außerdem ausgehenden Netzwerkzugang, ein beschreibbares Root-FS und einen Root-Benutzer in der Sandbox.
  Beispiel: Der Skill `summarize` (`skills/summarize/SKILL.md`) benötigt die `summarize`-CLI
  im Sandbox-Container, um dort ausgeführt zu werden.

Installer-Beispiel:

```markdown
---
name: gemini
description: Use Gemini CLI for coding assistance and Google search lookups.
metadata:
  {
    "openclaw":
      {
        "emoji": "♊️",
        "requires": { "bins": ["gemini"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "gemini-cli",
              "bins": ["gemini"],
              "label": "Install Gemini CLI (brew)",
            },
          ],
      },
  }
---
```

Hinweise:

- Wenn mehrere Installer aufgeführt sind, wählt das Gateway eine **einzelne** bevorzugte Option (brew, wenn verfügbar, sonst node).
- Wenn alle Installer `download` sind, listet OpenClaw jeden Eintrag auf, damit Sie die verfügbaren Artefakte sehen können.
- Installer-Spezifikationen können `os: ["darwin"|"linux"|"win32"]` enthalten, um Optionen nach Plattform zu filtern.
- Node-Installationen berücksichtigen `skills.install.nodeManager` in `openclaw.json` (Standard: npm; Optionen: npm/pnpm/yarn/bun).
  Dies betrifft nur **Skill-Installationen**; die Gateway-Laufzeit sollte weiterhin Node sein
  (Bun wird für WhatsApp/Telegram nicht empfohlen).
- Go-Installationen: Wenn `go` fehlt und `brew` verfügbar ist, installiert das Gateway Go zuerst über Homebrew und setzt `GOBIN` nach Möglichkeit auf Homebrews `bin`.
- Download-Installationen: `url` (erforderlich), `archive` (`tar.gz` | `tar.bz2` | `zip`), `extract` (Standard: automatisch, wenn ein Archiv erkannt wird), `stripComponents`, `targetDir` (Standard: `~/.openclaw/tools/<skillKey>`).

Ist kein `metadata.openclaw` vorhanden, ist der Skill immer zulässig (sofern
nicht in der Konfiguration deaktiviert oder bei gebündelten Skills durch `skills.allowBundled` blockiert).

## Konfigurations-Overrides (`~/.openclaw/openclaw.json`)

Gebündelte/verwaltete Skills können ein- und ausgeschaltet sowie mit Env-Werten versorgt werden:

```json5
{
  skills: {
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
        config: {
          endpoint: "https://example.invalid",
          model: "nano-pro",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

Hinweis: Wenn der Skillname Bindestriche enthält, setzen Sie den Schlüssel in Anführungszeichen (JSON5 erlaubt zitierte Schlüssel).

Konfigurationsschlüssel entsprechen standardmäßig dem **Skillnamen**. Definiert ein Skill
`metadata.openclaw.skillKey`, verwenden Sie diesen Schlüssel unter `skills.entries`.

Regeln:

- `enabled: false` deaktiviert den Skill, selbst wenn er gebündelt/installiert ist.
- `env`: wird **nur dann** injiziert, wenn die Variable im Prozess noch nicht gesetzt ist.
- `apiKey`: Komfortfunktion für Skills, die `metadata.openclaw.primaryEnv` deklarieren.
- `config`: optionaler Container für benutzerdefinierte, skill-spezifische Felder; benutzerdefinierte Schlüssel müssen hier liegen.
- `allowBundled`: optionale Allowlist **nur für gebündelte** Skills. Falls gesetzt, sind nur die in der Liste enthaltenen gebündelten Skills zulässig (verwaltete/Workspace-Skills bleiben unbeeinflusst).

## Umgebungsinjektion (pro Agentenlauf)

Wenn ein Agentenlauf startet, führt OpenClaw Folgendes aus:

1. Liest die Skill-Metadaten.
2. Wendet etwaige `skills.entries.<key>.env` oder `skills.entries.<key>.apiKey` auf
   `process.env` an.
3. Baut den System-Prompt mit **zulässigen** Skills.
4. Stellt die ursprüngliche Umgebung nach Ende des Laufs wieder her.

Dies ist **auf den Agentenlauf beschränkt**, nicht auf eine globale Shell-Umgebung.

## Sitzungs-Snapshot (Performance)

OpenClaw erstellt einen Snapshot der zulässigen Skills **beim Start einer Sitzung** und verwendet diese Liste für nachfolgende Turns in derselben Sitzung wieder. Änderungen an Skills oder Konfiguration werden mit der nächsten neuen Sitzung wirksam.

Skills können sich auch während einer Sitzung aktualisieren, wenn der Skills-Watcher aktiviert ist oder wenn ein neuer zulässiger Remote-Node erscheint (siehe unten). Verstehen Sie dies als **Hot Reload**: Die aktualisierte Liste wird beim nächsten Agenten-Turn übernommen.

## Remote-macOS-Nodes (Linux-Gateway)

Wenn das Gateway unter Linux läuft, aber ein **macOS-Node** verbunden ist **mit erlaubtem `system.run`** (Exec-Approvals-Sicherheit nicht auf `deny` gesetzt), kann OpenClaw macOS-exklusive Skills als zulässig behandeln, wenn die erforderlichen Binaries auf diesem Node vorhanden sind. Der Agent sollte diese Skills über das Werkzeug `nodes` ausführen (typischerweise `nodes.run`).

Dies beruht darauf, dass der Node seine Befehlsunterstützung meldet und auf einer Binärprüfung über `system.run`. Geht der macOS-Node später offline, bleiben die Skills sichtbar; Aufrufe können fehlschlagen, bis der Node wieder verbunden ist.

## Skills-Watcher (Auto-Refresh)

Standardmäßig überwacht OpenClaw Skill-Ordner und erhöht den Skills-Snapshot, wenn sich `SKILL.md`-Dateien ändern. Konfigurieren Sie dies unter `skills.load`:

```json5
{
  skills: {
    load: {
      watch: true,
      watchDebounceMs: 250,
    },
  },
}
```

## Token-Auswirkungen (Skills-Liste)

Wenn Skills zulässig sind, injiziert OpenClaw eine kompakte XML-Liste der verfügbaren Skills in den System-Prompt (über `formatSkillsForPrompt` in `pi-coding-agent`). Die Kosten sind deterministisch:

- **Basis-Overhead (nur bei ≥1 Skill):** 195 Zeichen.
- **Pro Skill:** 97 Zeichen + die Länge der XML-escaped `<name>`-, `<description>`- und `<location>`-Werte.

Formel (Zeichen):

```
total = 195 + Σ (97 + len(name_escaped) + len(description_escaped) + len(location_escaped))
```

Hinweise:

- XML-Escaping erweitert `& < > " '` zu Entitäten (`&amp;`, `&lt;` usw.) und erhöht damit die Länge.
- Token-Anzahlen variieren je nach Modell-Tokenizer. Eine grobe OpenAI-ähnliche Schätzung liegt bei ~4 Zeichen/Token, also **97 Zeichen ≈ 24 Tokens** pro Skill plus Ihre tatsächlichen Feldlängen.

## Lebenszyklus verwalteter Skills

OpenClaw liefert einen Basissatz an Skills als **gebündelte Skills** mit der
Installation aus (npm-Paket oder OpenClaw.app). `~/.openclaw/skills` existiert für lokale
Overrides (z. B. zum Pinnen/Patche eines Skills, ohne die gebündelte Kopie zu ändern).
Workspace-Skills gehören den Benutzern und überschreiben beide bei Namenskonflikten.

## Konfigurationsreferenz

Siehe [Skills-Konfiguration](/tools/skills-config) für das vollständige Konfigurationsschema.

## Suchen Sie nach weiteren Skills?

Stöbern Sie unter https://clawhub.com.

---
