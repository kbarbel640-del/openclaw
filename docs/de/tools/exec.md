---
summary: "Verwendung des Exec-Tools, stdin-Modi und TTY-Unterstützung"
read_when:
  - Verwendung oder Änderung des Exec-Tools
  - Fehlerbehebung bei stdin- oder TTY-Verhalten
title: "Exec-Tool"
x-i18n:
  source_path: tools/exec.md
  source_hash: 3b32238dd8dce93d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:57Z
---

# Exec-Tool

Führen Sie Shell-Befehle im Workspace aus. Unterstützt Vordergrund- und Hintergrundausführung über `process`.
Wenn `process` nicht zulässig ist, wird `exec` synchron ausgeführt und ignoriert `yieldMs`/`background`.
Hintergrundsitzungen sind pro Agent begrenzt; `process` sieht nur Sitzungen desselben Agents.

## Parameter

- `command` (erforderlich)
- `workdir` (Standard: cwd)
- `env` (Key/Value-Überschreibungen)
- `yieldMs` (Standard 10000): automatischer Wechsel in den Hintergrund nach Verzögerung
- `background` (bool): sofort im Hintergrund ausführen
- `timeout` (Sekunden, Standard 1800): Beenden bei Ablauf
- `pty` (bool): in einem Pseudo-Terminal ausführen, wenn verfügbar (nur-TTY-CLIs, Coding-Agents, Terminal-UIs)
- `host` (`sandbox | gateway | node`): Ausführungsort
- `security` (`deny | allowlist | full`): Durchsetzungsmodus für `gateway`/`node`
- `ask` (`off | on-miss | always`): Genehmigungsabfragen für `gateway`/`node`
- `node` (string): Knoten-ID/-Name für `host=node`
- `elevated` (bool): erhöhten Modus anfordern (Gateway-Host); `security=full` wird nur erzwungen, wenn „elevated“ zu `full` auflöst

Hinweise:

- `host` ist standardmäßig `sandbox`.
- `elevated` wird ignoriert, wenn Sandboxing deaktiviert ist (exec läuft bereits auf dem Host).
- Genehmigungen für `gateway`/`node` werden über `~/.openclaw/exec-approvals.json` gesteuert.
- `node` erfordert einen gekoppelten Knoten (Begleit-App oder Headless-Node-Host).
- Wenn mehrere Knoten verfügbar sind, setzen Sie `exec.node` oder `tools.exec.node`, um einen auszuwählen.
- Auf Nicht-Windows-Hosts verwendet exec `SHELL`, wenn gesetzt; ist `SHELL` `fish`, wird `bash` (oder `sh`)
  aus `PATH` bevorzugt, um fish-inkompatible Skripte zu vermeiden; andernfalls erfolgt ein Fallback auf `SHELL`, falls keines existiert.
- Host-Ausführung (`gateway`/`node`) lehnt `env.PATH` und Loader-Überschreibungen (`LD_*`/`DYLD_*`) ab, um
  Binary-Hijacking oder injizierten Code zu verhindern.
- Wichtig: Sandboxing ist **standardmäßig deaktiviert**. Wenn Sandboxing deaktiviert ist, wird `host=sandbox` direkt auf
  dem Gateway-Host ausgeführt (kein Container) und **erfordert keine Genehmigungen**. Um Genehmigungen zu erzwingen, führen Sie mit
  `host=gateway` aus und konfigurieren Sie Exec-Genehmigungen (oder aktivieren Sie Sandboxing).

## Konfiguration

- `tools.exec.notifyOnExit` (Standard: true): Wenn true, stellen im Hintergrund ausgeführte Exec-Sitzungen ein Systemereignis in die Warteschlange und fordern beim Beenden einen Heartbeat an.
- `tools.exec.approvalRunningNoticeMs` (Standard: 10000): Gibt eine einzelne „running“-Meldung aus, wenn eine genehmigungspflichtige Exec-Ausführung länger als dieser Wert dauert (0 deaktiviert).
- `tools.exec.host` (Standard: `sandbox`)
- `tools.exec.security` (Standard: `deny` für Sandbox, `allowlist` für Gateway + Knoten, wenn nicht gesetzt)
- `tools.exec.ask` (Standard: `on-miss`)
- `tools.exec.node` (Standard: nicht gesetzt)
- `tools.exec.pathPrepend`: Liste von Verzeichnissen, die für Exec-Läufe vor `PATH` vorangestellt werden.
- `tools.exec.safeBins`: stdin-only sichere Binaries, die ohne explizite Allowlist-Einträge ausgeführt werden können.

Beispiel:

```json5
{
  tools: {
    exec: {
      pathPrepend: ["~/bin", "/opt/oss/bin"],
    },
  },
}
```

### PATH-Verarbeitung

- `host=gateway`: Führt Ihr Login-Shell-`PATH` in die Exec-Umgebung zusammen. `env.PATH`-Überschreibungen werden
  für Host-Ausführung abgelehnt. Der Daemon selbst läuft weiterhin mit einem minimalen `PATH`:
  - macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
  - Linux: `/usr/local/bin`, `/usr/bin`, `/bin`
- `host=sandbox`: Führt `sh -lc` (Login-Shell) innerhalb des Containers aus, sodass `/etc/profile` `PATH` zurücksetzen kann.
  OpenClaw stellt `env.PATH` nach dem Sourcen der Profile über eine interne Umgebungsvariable voran (keine Shell-Interpolation);
  `tools.exec.pathPrepend` gilt hier ebenfalls.
- `host=node`: Es werden nur nicht blockierte von Ihnen übergebene Env-Überschreibungen an den Knoten gesendet. `env.PATH`-Überschreibungen werden
  für Host-Ausführung abgelehnt. Headless-Node-Hosts akzeptieren `PATH` nur, wenn es dem Node-Host-PATH vorangestellt wird
  (kein Ersetzen). macOS-Knoten verwerfen `PATH`-Überschreibungen vollständig.

Knotenbindung pro Agent (verwenden Sie den Agent-Listenindex in der Konfiguration):

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

Control UI: Der Tab „Nodes“ enthält ein kleines Panel „Exec node binding“ für dieselben Einstellungen.

## Sitzungsüberschreibungen (`/exec`)

Verwenden Sie `/exec`, um **pro Sitzung** Standardwerte für `host`, `security`, `ask` und `node` festzulegen.
Senden Sie `/exec` ohne Argumente, um die aktuellen Werte anzuzeigen.

Beispiel:

```
/exec host=gateway security=allowlist ask=on-miss node=mac-1
```

## Autorisierungsmodell

`/exec` wird nur für **autorisierte Absender** berücksichtigt (Kanal-Allowlists/Kopplung plus `commands.useAccessGroups`).
Es aktualisiert **nur den Sitzungsstatus** und schreibt keine Konfiguration. Um Exec hart zu deaktivieren, verweigern Sie es über die Tool-
Richtlinie (`tools.deny: ["exec"]` oder pro Agent). Host-Genehmigungen gelten weiterhin, sofern Sie nicht explizit
`security=full` und `ask=off` setzen.

## Exec-Genehmigungen (Begleit-App / Node-Host)

Sandboxed Agents können eine Genehmigung pro Anfrage verlangen, bevor `exec` auf dem Gateway- oder Node-Host ausgeführt wird.
Siehe [Exec approvals](/tools/exec-approvals) für Richtlinie, Allowlist und UI-Ablauf.

Wenn Genehmigungen erforderlich sind, gibt das Exec-Tool sofort mit
`status: "approval-pending"` und einer Genehmigungs-ID zurück. Nach Genehmigung (oder Ablehnung / Zeitüberschreitung)
sendet das Gateway Systemereignisse (`Exec finished` / `Exec denied`). Läuft der Befehl nach
`tools.exec.approvalRunningNoticeMs` weiterhin, wird eine einzelne `Exec running`-Meldung ausgegeben.

## Allowlist + sichere Binaries

Die Allowlist-Durchsetzung gleicht **nur aufgelöste Binärpfade** ab (keine Basename-Treffer). Wenn
`security=allowlist`, werden Shell-Befehle nur dann automatisch zugelassen, wenn jedes Pipeline-Segment
allowlistiert oder ein sicheres Binary ist. Verkettungen (`;`, `&&`, `||`) und Umleitungen werden im
Allowlist-Modus abgelehnt.

## Beispiele

Vordergrund:

```json
{ "tool": "exec", "command": "ls -la" }
```

Hintergrund + Abfragen:

```json
{"tool":"exec","command":"npm run build","yieldMs":1000}
{"tool":"process","action":"poll","sessionId":"<id>"}
```

Tasten senden (tmux-Stil):

```json
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Enter"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["C-c"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Up","Up","Enter"]}
```

Absenden (nur CR senden):

```json
{ "tool": "process", "action": "submit", "sessionId": "<id>" }
```

Einfügen (standardmäßig geklammert):

```json
{ "tool": "process", "action": "paste", "sessionId": "<id>", "text": "line1\nline2\n" }
```

## apply_patch (experimentell)

`apply_patch` ist ein Subtool von `exec` für strukturierte Multi-Datei-Änderungen.
Aktivieren Sie es explizit:

```json5
{
  tools: {
    exec: {
      applyPatch: { enabled: true, allowModels: ["gpt-5.2"] },
    },
  },
}
```

Hinweise:

- Nur für OpenAI/OpenAI Codex-Modelle verfügbar.
- Tool-Richtlinien gelten weiterhin; `allow: ["exec"]` erlaubt implizit `apply_patch`.
- Die Konfiguration befindet sich unter `tools.exec.applyPatch`.
