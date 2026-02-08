---
summary: "Agentenspezifische Sandbox- und Werkzeugbeschränkungen, Prioritäten und Beispiele"
title: Multi-Agent Sandbox & Tools
read_when: "Sie möchten agentenspezifisches Sandboxing oder agentenspezifische Allow/Deny-Richtlinien für Werkzeuge in einem Multi-Agent-Gateway."
status: active
x-i18n:
  source_path: multi-agent-sandbox-tools.md
  source_hash: f602cb6192b84b40
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:53Z
---

# Konfiguration für Multi-Agent Sandbox & Tools

## Überblick

Jeder Agent in einer Multi-Agent-Einrichtung kann nun seine eigene haben:

- **Sandbox-Konfiguration** (`agents.list[].sandbox` überschreibt `agents.defaults.sandbox`)
- **Werkzeugbeschränkungen** (`tools.allow` / `tools.deny`, plus `agents.list[].tools`)

Dies ermöglicht es Ihnen, mehrere Agenten mit unterschiedlichen Sicherheitsprofilen auszuführen:

- Persönlicher Assistent mit vollem Zugriff
- Familien-/Arbeitsagenten mit eingeschränkten Werkzeugen
- Öffentlich zugängliche Agenten in Sandboxes

`setupCommand` gehört unter `sandbox.docker` (global oder agentenspezifisch) und wird einmal ausgeführt,
wenn der Container erstellt wird.

Authentifizierung ist agentenspezifisch: Jeder Agent liest aus seinem eigenen `agentDir`-Auth-Speicher unter:

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

Anmeldedaten werden **nicht** zwischen Agenten geteilt. Verwenden Sie `agentDir` niemals über mehrere Agenten hinweg.
Wenn Sie Anmeldedaten teilen möchten, kopieren Sie `auth-profiles.json` in das `agentDir` des anderen Agenten.

Wie sich Sandboxing zur Laufzeit verhält, siehe [Sandboxing](/gateway/sandboxing).
Zum Debugging von „Warum ist das blockiert?“ siehe [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) und `openclaw sandbox explain`.

---

## Konfigurationsbeispiele

### Beispiel 1: Persönlicher + eingeschränkter Familienagent

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "name": "Personal Assistant",
        "workspace": "~/.openclaw/workspace",
        "sandbox": { "mode": "off" }
      },
      {
        "id": "family",
        "name": "Family Bot",
        "workspace": "~/.openclaw/workspace-family",
        "sandbox": {
          "mode": "all",
          "scope": "agent"
        },
        "tools": {
          "allow": ["read"],
          "deny": ["exec", "write", "edit", "apply_patch", "process", "browser"]
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "family",
      "match": {
        "provider": "whatsapp",
        "accountId": "*",
        "peer": {
          "kind": "group",
          "id": "120363424282127706@g.us"
        }
      }
    }
  ]
}
```

**Ergebnis:**

- `main`-Agent: Läuft auf dem Host, voller Werkzeugzugriff
- `family`-Agent: Läuft in Docker (ein Container pro Agent), nur das Werkzeug `read`

---

### Beispiel 2: Arbeitsagent mit geteilter Sandbox

```json
{
  "agents": {
    "list": [
      {
        "id": "personal",
        "workspace": "~/.openclaw/workspace-personal",
        "sandbox": { "mode": "off" }
      },
      {
        "id": "work",
        "workspace": "~/.openclaw/workspace-work",
        "sandbox": {
          "mode": "all",
          "scope": "shared",
          "workspaceRoot": "/tmp/work-sandboxes"
        },
        "tools": {
          "allow": ["read", "write", "apply_patch", "exec"],
          "deny": ["browser", "gateway", "discord"]
        }
      }
    ]
  }
}
```

---

### Beispiel 2b: Globales Coding-Profil + reiner Messaging-Agent

```json
{
  "tools": { "profile": "coding" },
  "agents": {
    "list": [
      {
        "id": "support",
        "tools": { "profile": "messaging", "allow": ["slack"] }
      }
    ]
  }
}
```

**Ergebnis:**

- Standardagenten erhalten Coding-Werkzeuge
- `support`-Agent ist nur für Messaging (+ Slack-Werkzeug)

---

### Beispiel 3: Unterschiedliche Sandbox-Modi pro Agent

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main", // Global default
        "scope": "session"
      }
    },
    "list": [
      {
        "id": "main",
        "workspace": "~/.openclaw/workspace",
        "sandbox": {
          "mode": "off" // Override: main never sandboxed
        }
      },
      {
        "id": "public",
        "workspace": "~/.openclaw/workspace-public",
        "sandbox": {
          "mode": "all", // Override: public always sandboxed
          "scope": "agent"
        },
        "tools": {
          "allow": ["read"],
          "deny": ["exec", "write", "edit", "apply_patch"]
        }
      }
    ]
  }
}
```

---

## Konfigurationspriorität

Wenn sowohl globale (`agents.defaults.*`) als auch agentenspezifische (`agents.list[].*`) Konfigurationen existieren:

### Sandbox-Konfiguration

Agentenspezifische Einstellungen überschreiben globale:

```
agents.list[].sandbox.mode > agents.defaults.sandbox.mode
agents.list[].sandbox.scope > agents.defaults.sandbox.scope
agents.list[].sandbox.workspaceRoot > agents.defaults.sandbox.workspaceRoot
agents.list[].sandbox.workspaceAccess > agents.defaults.sandbox.workspaceAccess
agents.list[].sandbox.docker.* > agents.defaults.sandbox.docker.*
agents.list[].sandbox.browser.* > agents.defaults.sandbox.browser.*
agents.list[].sandbox.prune.* > agents.defaults.sandbox.prune.*
```

**Hinweise:**

- `agents.list[].sandbox.{docker,browser,prune}.*` überschreibt `agents.defaults.sandbox.{docker,browser,prune}.*` für diesen Agenten (ignoriert, wenn der Sandbox-Bereich zu `"shared"` aufgelöst wird).

### Werkzeugbeschränkungen

Die Filterreihenfolge ist:

1. **Werkzeugprofil** (`tools.profile` oder `agents.list[].tools.profile`)
2. **Anbieter-Werkzeugprofil** (`tools.byProvider[provider].profile` oder `agents.list[].tools.byProvider[provider].profile`)
3. **Globale Werkzeugrichtlinie** (`tools.allow` / `tools.deny`)
4. **Anbieter-Werkzeugrichtlinie** (`tools.byProvider[provider].allow/deny`)
5. **Agentenspezifische Werkzeugrichtlinie** (`agents.list[].tools.allow/deny`)
6. **Agenten-Anbieter-Richtlinie** (`agents.list[].tools.byProvider[provider].allow/deny`)
7. **Sandbox-Werkzeugrichtlinie** (`tools.sandbox.tools` oder `agents.list[].tools.sandbox.tools`)
8. **Subagenten-Werkzeugrichtlinie** (`tools.subagents.tools`, falls zutreffend)

Jede Ebene kann Werkzeuge weiter einschränken, aber zuvor verweigerte Werkzeuge nicht wieder zulassen.
Wenn `agents.list[].tools.sandbox.tools` gesetzt ist, ersetzt es `tools.sandbox.tools` für diesen Agenten.
Wenn `agents.list[].tools.profile` gesetzt ist, überschreibt es `tools.profile` für diesen Agenten.
Anbieter-Werkzeugschlüssel akzeptieren entweder `provider` (z. B. `google-antigravity`) oder `provider/model` (z. B. `openai/gpt-5.2`).

### Werkzeuggruppen (Kurzformen)

Werkzeugrichtlinien (global, Agent, Sandbox) unterstützen `group:*`-Einträge, die zu mehreren konkreten Werkzeugen expandieren:

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: alle integrierten OpenClaw-Werkzeuge (ohne Anbieter-Plugins)

### Elevated Mode

`tools.elevated` ist die globale Basis (senderbasierte Allowlist). `agents.list[].tools.elevated` kann Elevated für bestimmte Agenten weiter einschränken (beide müssen erlauben).

Minderungsstrategien:

- `exec` für nicht vertrauenswürdige Agenten verweigern (`agents.list[].tools.deny: ["exec"]`)
- Vermeiden Sie das Allowlisting von Sendern, die zu eingeschränkten Agenten routen
- Elevated global deaktivieren (`tools.elevated.enabled: false`), wenn Sie nur sandboxierte Ausführung wünschen
- Elevated pro Agent deaktivieren (`agents.list[].tools.elevated.enabled: false`) für sensible Profile

---

## Migration von Einzelagent

**Vorher (Einzelagent):**

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "sandbox": {
        "mode": "non-main"
      }
    }
  },
  "tools": {
    "sandbox": {
      "tools": {
        "allow": ["read", "write", "apply_patch", "exec"],
        "deny": []
      }
    }
  }
}
```

**Nachher (Multi-Agent mit unterschiedlichen Profilen):**

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "workspace": "~/.openclaw/workspace",
        "sandbox": { "mode": "off" }
      }
    ]
  }
}
```

Legacy-`agent.*`-Konfigurationen werden von `openclaw doctor` migriert; bevorzugen Sie künftig `agents.defaults` + `agents.list`.

---

## Beispiele für Werkzeugbeschränkungen

### Nur-Lese-Agent

```json
{
  "tools": {
    "allow": ["read"],
    "deny": ["exec", "write", "edit", "apply_patch", "process"]
  }
}
```

### Agent für sichere Ausführung (keine Dateimodifikationen)

```json
{
  "tools": {
    "allow": ["read", "exec", "process"],
    "deny": ["write", "edit", "apply_patch", "browser", "gateway"]
  }
}
```

### Reiner Kommunikationsagent

```json
{
  "tools": {
    "allow": ["sessions_list", "sessions_send", "sessions_history", "session_status"],
    "deny": ["exec", "write", "edit", "apply_patch", "read", "browser"]
  }
}
```

---

## Häufige Stolperfalle: „non-main“

`agents.defaults.sandbox.mode: "non-main"` basiert auf `session.mainKey` (Standard `"main"`),
nicht auf der Agenten-ID. Gruppen-/Kanal-Sitzungen erhalten immer eigene Schlüssel,
daher werden sie als non-main behandelt und sandboxiert. Wenn ein Agent niemals
sandboxiert werden soll, setzen Sie `agents.list[].sandbox.mode: "off"`.

---

## Tests

Nach der Konfiguration von Multi-Agent-Sandbox und Werkzeugen:

1. **Agentenauflösung prüfen:**

   ```exec
   openclaw agents list --bindings
   ```

2. **Sandbox-Container verifizieren:**

   ```exec
   docker ps --filter "name=openclaw-sbx-"
   ```

3. **Werkzeugbeschränkungen testen:**
   - Senden Sie eine Nachricht, die eingeschränkte Werkzeuge erfordert
   - Verifizieren Sie, dass der Agent verweigerte Werkzeuge nicht nutzen kann

4. **Logs überwachen:**
   ```exec
   tail -f "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/logs/gateway.log" | grep -E "routing|sandbox|tools"
   ```

---

## Fehlerbehebung

### Agent nicht sandboxiert trotz `mode: "all"`

- Prüfen Sie, ob es eine globale `agents.defaults.sandbox.mode` gibt, die dies überschreibt
- Agentenspezifische Konfiguration hat Vorrang, setzen Sie daher `agents.list[].sandbox.mode: "all"`

### Werkzeuge trotz Deny-Liste weiterhin verfügbar

- Prüfen Sie die Werkzeug-Filterreihenfolge: global → Agent → Sandbox → Subagent
- Jede Ebene kann nur weiter einschränken, nicht wieder zulassen
- Verifizieren Sie mit Logs: `[tools] filtering tools for agent:${agentId}`

### Container nicht pro Agent isoliert

- Setzen Sie `scope: "agent"` in der agentenspezifischen Sandbox-Konfiguration
- Standard ist `"session"`, wodurch ein Container pro Sitzung erstellt wird

---

## Siehe auch

- [Multi-Agent Routing](/concepts/multi-agent)
- [Sandbox-Konfiguration](/gateway/configuration#agentsdefaults-sandbox)
- [Sitzungsverwaltung](/concepts/session)
