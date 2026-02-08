---
summary: "Exec-Genehmigungen, Allowlists und Sandbox-Escape-Prompts"
read_when:
  - Konfigurieren von Exec-Genehmigungen oder Allowlists
  - Implementieren der Exec-Genehmigungs-UX in der macOS-App
  - Überprüfen von Sandbox-Escape-Prompts und deren Auswirkungen
title: "Exec-Genehmigungen"
x-i18n:
  source_path: tools/exec-approvals.md
  source_hash: 97736427752eb905
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:56Z
---

# Exec-Genehmigungen

Exec-Genehmigungen sind die **Begleit-App-/Node-Host-Schutzmaßnahme**, mit der ein in einer Sandbox befindlicher Agent
Befehle auf einem realen Host ausführen darf (`gateway` oder `node`). Stellen Sie es sich wie eine Sicherheitsverriegelung vor:
Befehle sind nur erlaubt, wenn Richtlinie + Allowlist + (optionale) Benutzerfreigabe übereinstimmen.
Exec-Genehmigungen gelten **zusätzlich** zur Tool-Richtlinie und zur erhöhten Freigabe (es sei denn, „elevated“ ist auf `full` gesetzt, wodurch Genehmigungen übersprungen werden).
Die wirksame Richtlinie ist die **strengere** aus `tools.exec.*` und den Standardwerten der Genehmigungen; wenn ein Genehmigungsfeld fehlt, wird der Wert `tools.exec` verwendet.

Wenn die UI der Begleit-App **nicht verfügbar** ist, wird jede Anfrage, die eine Abfrage erfordert,
durch den **Ask-Fallback** aufgelöst (Standard: verweigern).

## Geltungsbereich

Exec-Genehmigungen werden lokal auf dem Ausführungs-Host erzwungen:

- **Gateway-Host** → `openclaw`-Prozess auf der Gateway-Maschine
- **Node-Host** → Node-Runner (macOS-Begleit-App oder headless Node-Host)

macOS-Aufteilung:

- **Node-Host-Dienst** leitet `system.run` über lokales IPC an die **macOS-App** weiter.
- **macOS-App** erzwingt Genehmigungen + führt den Befehl im UI-Kontext aus.

## Einstellungen und Speicherung

Genehmigungen liegen in einer lokalen JSON-Datei auf dem Ausführungs-Host:

`~/.openclaw/exec-approvals.json`

Beispielschema:

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64url-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny",
    "autoAllowSkills": false
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "askFallback": "deny",
      "autoAllowSkills": true,
      "allowlist": [
        {
          "id": "B0C8C0B3-2C2D-4F8A-9A3C-5A4B3C2D1E0F",
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 1737150000000,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

## Richtlinien-Parameter

### Sicherheit (`exec.security`)

- **deny**: alle Host-Exec-Anfragen blockieren.
- **allowlist**: nur allowlistete Befehle zulassen.
- **full**: alles zulassen (entspricht elevated).

### Ask (`exec.ask`)

- **off**: niemals nachfragen.
- **on-miss**: nur nachfragen, wenn die Allowlist nicht passt.
- **always**: bei jedem Befehl nachfragen.

### Ask-Fallback (`askFallback`)

Wenn eine Abfrage erforderlich ist, aber keine UI erreichbar ist, entscheidet der Fallback:

- **deny**: blockieren.
- **allowlist**: nur zulassen, wenn die Allowlist passt.
- **full**: zulassen.

## Allowlist (pro Agent)

Allowlists sind **pro Agent**. Wenn mehrere Agenten existieren, wechseln Sie in der macOS-App,
welchen Agenten Sie bearbeiten. Muster sind **groß-/kleinschreibungsunabhängige Glob-Matches**.
Muster sollten zu **Binärpfaden** auflösen (Einträge nur mit Basisnamen werden ignoriert).
Legacy-`agents.default`-Einträge werden beim Laden zu `agents.main` migriert.

Beispiele:

- `~/Projects/**/bin/bird`
- `~/.local/bin/*`
- `/opt/homebrew/bin/rg`

Jeder Allowlist-Eintrag verfolgt:

- **id** stabile UUID für die UI-Identität (optional)
- **last used** Zeitstempel
- **last used command**
- **last resolved path**

## Auto-Allow für Skill-CLIs

Wenn **Auto-allow skill CLIs** aktiviert ist, werden von bekannten Skills referenzierte
ausführbare Dateien auf Nodes (macOS-Node oder headless Node-Host) als allowlistet behandelt. Dies verwendet
`skills.bins` über die Gateway-RPC, um die Skill-Bin-Liste abzurufen. Deaktivieren Sie dies, wenn Sie strikte manuelle Allowlists wünschen.

## Safe Bins (nur stdin)

`tools.exec.safeBins` definiert eine kleine Liste von **stdin-only**-Binaries (z. B. `jq`),
die im Allowlist-Modus **ohne** explizite Allowlist-Einträge ausgeführt werden können. Safe Bins lehnen
positionsabhängige Dateiargumente und pfadähnliche Tokens ab, sodass sie nur auf dem eingehenden Stream arbeiten können.
Shell-Verkettungen und Umleitungen werden im Allowlist-Modus nicht automatisch erlaubt.

Shell-Verkettung (`&&`, `||`, `;`) ist erlaubt, wenn jedes Top-Level-Segment die Allowlist erfüllt
(einschließlich Safe Bins oder Skill-Auto-Allow). Umleitungen bleiben im Allowlist-Modus nicht unterstützt.
Command Substitution (`$()` / Backticks) wird während der Allowlist-Analyse abgelehnt, auch innerhalb
doppelter Anführungszeichen; verwenden Sie einfache Anführungszeichen, wenn Sie wörtlichen `$()`-Text benötigen.

Standard-Safe-Bins: `jq`, `grep`, `cut`, `sort`, `uniq`, `head`, `tail`, `tr`, `wc`.

## Bearbeitung in der Control UI

Verwenden Sie die Karte **Control UI → Nodes → Exec-Genehmigungen**, um Standardwerte, pro‑Agent‑Überschreibungen
und Allowlists zu bearbeiten. Wählen Sie einen Geltungsbereich (Standards oder einen Agenten), passen Sie die Richtlinie an,
fügen Sie Allowlist-Muster hinzu oder entfernen Sie sie und klicken Sie dann auf **Save**. Die UI zeigt **last used**‑Metadaten
pro Muster an, damit Sie die Liste übersichtlich halten können.

Der Zielselektor wählt **Gateway** (lokale Genehmigungen) oder einen **Node**. Nodes
müssen `system.execApprovals.get/set` ankündigen (macOS-App oder headless Node-Host).
Wenn ein Node Exec-Genehmigungen noch nicht ankündigt, bearbeiten Sie dessen lokale
`~/.openclaw/exec-approvals.json` direkt.

CLI: `openclaw approvals` unterstützt die Bearbeitung von Gateway oder Node (siehe [Approvals CLI](/cli/approvals)).

## Genehmigungsablauf

Wenn eine Abfrage erforderlich ist, sendet das Gateway `exec.approval.requested` an Operator-Clients.
Die Control UI und die macOS-App lösen dies über `exec.approval.resolve` auf; anschließend leitet das Gateway die
genehmigte Anfrage an den Node-Host weiter.

Wenn Genehmigungen erforderlich sind, gibt das Exec-Tool sofort mit einer Genehmigungs-ID zurück. Verwenden Sie diese ID,
um spätere Systemereignisse zu korrelieren (`Exec finished` / `Exec denied`). Geht vor dem
Timeout keine Entscheidung ein, wird die Anfrage als Genehmigungs-Timeout behandelt und als Ablehnungsgrund angezeigt.

Der Bestätigungsdialog enthält:

- Befehl + Argumente
- cwd
- Agent-ID
- aufgelöster Pfad der ausführbaren Datei
- Host- + Richtlinienmetadaten

Aktionen:

- **Einmal zulassen** → jetzt ausführen
- **Immer zulassen** → zur Allowlist hinzufügen + ausführen
- **Verweigern** → blockieren

## Weiterleitung von Genehmigungen an Chat-Kanäle

Sie können Exec-Genehmigungsabfragen an jeden Chat-Kanal (einschließlich Plugin-Kanälen) weiterleiten und sie mit
`/approve` genehmigen. Dies verwendet die normale Outbound-Delivery-Pipeline.

Konfiguration:

```json5
{
  approvals: {
    exec: {
      enabled: true,
      mode: "session", // "session" | "targets" | "both"
      agentFilter: ["main"],
      sessionFilter: ["discord"], // substring or regex
      targets: [
        { channel: "slack", to: "U12345678" },
        { channel: "telegram", to: "123456789" },
      ],
    },
  },
}
```

Antwort im Chat:

```
/approve <id> allow-once
/approve <id> allow-always
/approve <id> deny
```

### macOS-IPC-Ablauf

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + approvals + system.run)
```

Sicherheitshinweise:

- Unix-Socket-Modus `0600`, Token gespeichert in `exec-approvals.json`.
- Same-UID-Peer-Prüfung.
- Challenge/Response (Nonce + HMAC-Token + Request-Hash) + kurze TTL.

## Systemereignisse

Der Exec-Lebenszyklus wird als Systemmeldungen angezeigt:

- `Exec running` (nur wenn der Befehl den Hinweis-Schwellenwert für „läuft“ überschreitet)
- `Exec finished`
- `Exec denied`

Diese werden in der Sitzung des Agenten gepostet, nachdem der Node das Ereignis meldet.
Gateway-Host-Exec-Genehmigungen senden dieselben Lebenszyklusereignisse, wenn der Befehl beendet ist (und optional, wenn er länger als der Schwellenwert läuft).
Durch Genehmigungen gesteuerte Execs verwenden die Genehmigungs-ID als `runId` in diesen Meldungen zur einfachen Korrelation.

## Auswirkungen

- **full** ist mächtig; bevorzugen Sie nach Möglichkeit Allowlists.
- **ask** hält Sie eingebunden und erlaubt dennoch schnelle Genehmigungen.
- Pro-Agent-Allowlists verhindern, dass Genehmigungen eines Agenten in andere durchsickern.
- Genehmigungen gelten nur für Host-Exec-Anfragen von **autorisierten Absendern**. Nicht autorisierte Absender können kein `/exec` auslösen.
- `/exec security=full` ist eine sitzungsweite Komfortfunktion für autorisierte Operatoren und überspringt Genehmigungen bewusst.
  Um Host-Exec hart zu blockieren, setzen Sie die Genehmigungssicherheit auf `deny` oder verweigern Sie das `exec`-Tool über die Tool-Richtlinie.

Verwandt:

- [Exec-Tool](/tools/exec)
- [Elevated-Modus](/tools/elevated)
- [Skills](/tools/skills)
