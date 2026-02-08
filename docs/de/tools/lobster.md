---
title: Lobster
summary: „Typisierte Workflow-Laufzeit fuer OpenClaw mit fortsetzbaren Genehmigungs-Gates.“
description: Typed workflow runtime for OpenClaw — composable pipelines with approval gates.
read_when:
  - Sie moechten deterministische mehrstufige Workflows mit expliziten Genehmigungen
  - Sie muessen einen Workflow fortsetzen, ohne fruehere Schritte erneut auszufuehren
x-i18n:
  source_path: tools/lobster.md
  source_hash: ff84e65f4be162ad
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:04Z
---

# Lobster

Lobster ist eine Workflow-Shell, mit der OpenClaw mehrstufige Werkzeugsequenzen als eine einzelne, deterministische Operation mit expliziten Genehmigungs-Checkpoints ausfuehren kann.

## Hook

Ihr Assistent kann die Werkzeuge bauen, mit denen er sich selbst verwaltet. Fragen Sie nach einem Workflow, und 30 Minuten spaeter haben Sie eine CLI plus Pipelines, die als ein Aufruf laufen. Lobster ist das fehlende Puzzleteil: deterministische Pipelines, explizite Genehmigungen und fortsetzbarer Zustand.

## Warum

Heute erfordern komplexe Workflows viele Hin-und-her-Werkzeugaufrufe. Jeder Aufruf kostet Tokens, und das LLM muss jeden Schritt orchestrieren. Lobster verlagert diese Orchestrierung in eine typisierte Laufzeit:

- **Ein Aufruf statt vieler**: OpenClaw fuehrt einen Lobster-Werkzeugaufruf aus und erhaelt ein strukturiertes Ergebnis.
- **Genehmigungen integriert**: Nebenwirkungen (E-Mail senden, Kommentar posten) halten den Workflow an, bis sie explizit genehmigt werden.
- **Fortsetzbar**: Angehaltene Workflows geben ein Token zurueck; genehmigen und fortsetzen, ohne alles erneut auszufuehren.

## Warum eine DSL statt normaler Programme?

Lobster ist bewusst klein gehalten. Das Ziel ist nicht „eine neue Sprache“, sondern eine vorhersagbare, KI-freundliche Pipeline-Spezifikation mit erstklassigen Genehmigungen und Resume-Tokens.

- **Genehmigen/Fortsetzen ist integriert**: Ein normales Programm kann einen Menschen auffordern, aber es kann nicht _anhalten und fortsetzen_ mit einem dauerhaften Token, ohne dass Sie diese Laufzeit selbst erfinden.
- **Determinismus + Auditierbarkeit**: Pipelines sind Daten, daher lassen sie sich leicht protokollieren, vergleichen, wiederholen und pruefen.
- **Begrenzte Flaeche fuer KI**: Eine winzige Grammatik + JSON-Piping reduziert „kreative“ Codepfade und macht Validierung realistisch.
- **Sicherheitsrichtlinien eingebaut**: Timeouts, Ausgabebegrenzungen, Sandbox-Pruefungen und Allowlists werden von der Laufzeit erzwungen, nicht von jedem Skript.
- **Weiterhin programmierbar**: Jeder Schritt kann jede CLI oder jedes Skript aufrufen. Wenn Sie JS/TS moechten, erzeugen Sie `.lobster`-Dateien aus Code.

## Wie es funktioniert

OpenClaw startet die lokale `lobster`-CLI im **Tool-Modus** und parst einen JSON-Umschlag aus stdout.
Wenn die Pipeline zur Genehmigung pausiert, gibt das Tool ein `resumeToken` zurueck, damit Sie spaeter fortsetzen koennen.

## Muster: kleine CLI + JSON-Pipes + Genehmigungen

Bauen Sie winzige Befehle, die JSON sprechen, und verketten Sie sie dann zu einem einzigen Lobster-Aufruf. (Beispiel-Befehlsnamen unten — ersetzen Sie sie durch Ihre eigenen.)

```bash
inbox list --json
inbox categorize --json
inbox apply --json
```

```json
{
  "action": "run",
  "pipeline": "exec --json --shell 'inbox list --json' | exec --stdin json --shell 'inbox categorize --json' | exec --stdin json --shell 'inbox apply --json' | approve --preview-from-stdin --limit 5 --prompt 'Apply changes?'",
  "timeoutMs": 30000
}
```

Wenn die Pipeline eine Genehmigung anfordert, setzen Sie mit dem Token fort:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

KI startet den Workflow; Lobster fuehrt die Schritte aus. Genehmigungs-Gates halten Nebenwirkungen explizit und auditierbar.

Beispiel: Eingabeelemente auf Werkzeugaufrufe abbilden:

```bash
gog.gmail.search --query 'newer_than:1d' \
  | openclaw.invoke --tool message --action send --each --item-key message --args-json '{"provider":"telegram","to":"..."}'
```

## Reine JSON-LLM-Schritte (llm-task)

Fuer Workflows, die einen **strukturierten LLM-Schritt** benoetigen, aktivieren Sie das optionale
`llm-task`-Plugin-Werkzeug und rufen es aus Lobster auf. So bleibt der Workflow
deterministisch und erlaubt dennoch Klassifizieren/Zusammenfassen/Entwerfen mit einem Modell.

Aktivieren Sie das Werkzeug:

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

Verwenden Sie es in einer Pipeline:

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": { "subject": "Hello", "body": "Can you help?" },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

Siehe [LLM Task](/tools/llm-task) fuer Details und Konfigurationsoptionen.

## Workflow-Dateien (.lobster)

Lobster kann YAML/JSON-Workflow-Dateien mit den Feldern `name`, `args`, `steps`, `env`, `condition` und `approval` ausfuehren. In OpenClaw-Werkzeugaufrufen setzen Sie `pipeline` auf den Dateipfad.

```yaml
name: inbox-triage
args:
  tag:
    default: "family"
steps:
  - id: collect
    command: inbox list --json
  - id: categorize
    command: inbox categorize --json
    stdin: $collect.stdout
  - id: approve
    command: inbox apply --approve
    stdin: $categorize.stdout
    approval: required
  - id: execute
    command: inbox apply --execute
    stdin: $categorize.stdout
    condition: $approve.approved
```

Hinweise:

- `stdin: $step.stdout` und `stdin: $step.json` uebergeben die Ausgabe eines vorherigen Schritts.
- `condition` (oder `when`) kann Schritte anhand von `$step.approved` sperren.

## Lobster installieren

Installieren Sie die Lobster-CLI auf dem **gleichen Host**, auf dem das OpenClaw Gateway laeuft (siehe das [Lobster-Repo](https://github.com/openclaw/lobster)), und stellen Sie sicher, dass `lobster` in `PATH` enthalten ist.
Wenn Sie einen benutzerdefinierten Binary-Pfad verwenden moechten, uebergeben Sie im Werkzeugaufruf einen **absoluten** `lobsterPath`.

## Werkzeug aktivieren

Lobster ist ein **optionales** Plugin-Werkzeug (standardmaessig nicht aktiviert).

Empfohlen (additiv, sicher):

```json
{
  "tools": {
    "alsoAllow": ["lobster"]
  }
}
```

Oder pro Agent:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "alsoAllow": ["lobster"]
        }
      }
    ]
  }
}
```

Vermeiden Sie die Verwendung von `tools.allow: ["lobster"]`, es sei denn, Sie beabsichtigen, im restriktiven Allowlist-Modus zu laufen.

Hinweis: Allowlists sind fuer optionale Plugins opt-in. Wenn Ihre Allowlist nur
Plugin-Werkzeuge (wie `lobster`) nennt, haelt OpenClaw die Kernwerkzeuge aktiviert. Um Kernwerkzeuge
einzuschraenken, nehmen Sie die Kernwerkzeuge oder -gruppen, die Sie wollen, ebenfalls in die Allowlist auf.

## Beispiel: E-Mail-Triage

Ohne Lobster:

```
User: "Check my email and draft replies"
→ openclaw calls gmail.list
→ LLM summarizes
→ User: "draft replies to #2 and #5"
→ LLM drafts
→ User: "send #2"
→ openclaw calls gmail.send
(repeat daily, no memory of what was triaged)
```

Mit Lobster:

```json
{
  "action": "run",
  "pipeline": "email.triage --limit 20",
  "timeoutMs": 30000
}
```

Gibt einen JSON-Umschlag zurueck (gekuerzt):

```json
{
  "ok": true,
  "status": "needs_approval",
  "output": [{ "summary": "5 need replies, 2 need action" }],
  "requiresApproval": {
    "type": "approval_request",
    "prompt": "Send 2 draft replies?",
    "items": [],
    "resumeToken": "..."
  }
}
```

Benutzer genehmigt → fortsetzen:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

Ein Workflow. Deterministisch. Sicher.

## Werkzeugparameter

### `run`

Fuehrt eine Pipeline im Tool-Modus aus.

```json
{
  "action": "run",
  "pipeline": "gog.gmail.search --query 'newer_than:1d' | email.triage",
  "cwd": "/path/to/workspace",
  "timeoutMs": 30000,
  "maxStdoutBytes": 512000
}
```

Fuehrt eine Workflow-Datei mit Argumenten aus:

```json
{
  "action": "run",
  "pipeline": "/path/to/inbox-triage.lobster",
  "argsJson": "{\"tag\":\"family\"}"
}
```

### `resume`

Setzt einen angehaltenen Workflow nach Genehmigung fort.

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

### Optionale Eingaben

- `lobsterPath`: Absoluter Pfad zur Lobster-Binary (weglassen, um `PATH` zu verwenden).
- `cwd`: Arbeitsverzeichnis fuer die Pipeline (Standard: aktuelles Arbeitsverzeichnis des Prozesses).
- `timeoutMs`: Beendet den Unterprozess, wenn diese Dauer ueberschritten wird (Standard: 20000).
- `maxStdoutBytes`: Beendet den Unterprozess, wenn stdout diese Groesse ueberschreitet (Standard: 512000).
- `argsJson`: JSON-String, der an `lobster run --args-json` uebergeben wird (nur Workflow-Dateien).

## Ausgabe-Umschlag

Lobster gibt einen JSON-Umschlag mit einem von drei Statuswerten zurueck:

- `ok` → erfolgreich abgeschlossen
- `needs_approval` → pausiert; `requiresApproval.resumeToken` ist zum Fortsetzen erforderlich
- `cancelled` → explizit abgelehnt oder abgebrochen

Das Werkzeug stellt den Umschlag sowohl in `content` (formatiertes JSON) als auch in `details` (rohes Objekt) bereit.

## Genehmigungen

Wenn `requiresApproval` vorhanden ist, pruefen Sie die Aufforderung und entscheiden Sie:

- `approve: true` → fortsetzen und Nebenwirkungen ausfuehren
- `approve: false` → abbrechen und den Workflow abschliessen

Verwenden Sie `approve --preview-from-stdin --limit N`, um eine JSON-Vorschau an Genehmigungsanfragen anzuhaengen, ohne eigenes jq/Heredoc-Gefrickel. Resume-Tokens sind jetzt kompakt: Lobster speichert den Resume-Zustand des Workflows in seinem Zustandsverzeichnis und gibt einen kleinen Token-Schluessel zurueck.

## OpenProse

OpenProse passt gut zu Lobster: Verwenden Sie `/prose`, um eine Multi-Agenten-Vorbereitung zu orchestrieren, und fuehren Sie dann eine Lobster-Pipeline fuer deterministische Genehmigungen aus. Wenn ein Prose-Programm Lobster benoetigt, erlauben Sie das `lobster`-Werkzeug fuer Unter-Agenten ueber `tools.subagents.tools`. Siehe [OpenProse](/prose).

## Sicherheit

- **Nur lokaler Unterprozess** — keine Netzwerkaufrufe durch das Plugin selbst.
- **Keine Geheimnisse** — Lobster verwaltet kein OAuth; es ruft OpenClaw-Werkzeuge auf, die dies tun.
- **Sandbox-bewusst** — deaktiviert, wenn der Tool-Kontext sandboxed ist.
- **Gehaertet** — `lobsterPath` muss, falls angegeben, absolut sein; Timeouts und Ausgabebegrenzungen werden erzwungen.

## Fehlerbehebung

- **`lobster subprocess timed out`** → erhoehen Sie `timeoutMs` oder teilen Sie eine lange Pipeline auf.
- **`lobster output exceeded maxStdoutBytes`** → erhoehen Sie `maxStdoutBytes` oder reduzieren Sie die Ausgabegroesse.
- **`lobster returned invalid JSON`** → stellen Sie sicher, dass die Pipeline im Tool-Modus laeuft und nur JSON ausgibt.
- **`lobster failed (code …)`** → fuehren Sie dieselbe Pipeline im Terminal aus, um stderr zu pruefen.

## Mehr erfahren

- [Plugins](/plugin)
- [Plugin-Werkzeugerstellung](/plugins/agent-tools)

## Fallstudie: Community-Workflows

Ein oeffentliches Beispiel: eine „Second-Brain“-CLI + Lobster-Pipelines, die drei Markdown-Tresore verwalten (persoenlich, Partner, gemeinsam). Die CLI gibt JSON fuer Statistiken, Inbox-Listen und Stale-Scans aus; Lobster verketten diese Befehle zu Workflows wie `weekly-review`, `inbox-triage`, `memory-consolidation` und `shared-task-sync`, jeweils mit Genehmigungs-Gates. KI uebernimmt Urteile (Kategorisierung), wenn verfuegbar, und faellt andernfalls auf deterministische Regeln zurueck.

- Thread: https://x.com/plattenschieber/status/2014508656335770033
- Repo: https://github.com/bloomedai/brain-cli
