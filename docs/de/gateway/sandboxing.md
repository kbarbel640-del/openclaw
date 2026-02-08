---
summary: "Wie OpenClaw-Sandboxing funktioniert: Modi, Geltungsbereiche, Workspace-Zugriff und Images"
title: Sandboxing
read_when: "Sie moechten eine dedizierte Erklaerung zu Sandboxing oder muessen agents.defaults.sandbox feinjustieren."
status: active
x-i18n:
  source_path: gateway/sandboxing.md
  source_hash: 184fc53001fc6b28
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:40Z
---

# Sandboxing

OpenClaw kann **Werkzeuge in Docker-Containern ausfuehren**, um den Schadensradius zu reduzieren.
Dies ist **optional** und wird per Konfiguration gesteuert (`agents.defaults.sandbox` oder
`agents.list[].sandbox`). Ist Sandboxing deaktiviert, laufen Werkzeuge auf dem Host.
Der Gateway verbleibt auf dem Host; die Werkzeugausfuehrung laeuft in einer isolierten Sandbox,
wenn aktiviert.

Dies ist keine perfekte Sicherheitsgrenze, schraenkt aber den Zugriff auf Dateisystem
und Prozesse deutlich ein, wenn das Modell etwas Unkluges tut.

## Was wird sandboxed

- Werkzeugausfuehrung (`exec`, `read`, `write`, `edit`, `apply_patch`, `process` usw.).
- Optionaler sandboxed Browser (`agents.defaults.sandbox.browser`).
  - Standardmaessig startet der Sandbox-Browser automatisch (stellt sicher, dass CDP erreichbar ist), wenn das Browser-Werkzeug ihn benoetigt.
    Konfiguration ueber `agents.defaults.sandbox.browser.autoStart` und `agents.defaults.sandbox.browser.autoStartTimeoutMs`.
  - `agents.defaults.sandbox.browser.allowHostControl` ermoeglicht es sandboxed Sitzungen, den Host-Browser explizit anzusprechen.
  - Optionale Allowlists schalten `target: "custom"` frei: `allowedControlUrls`, `allowedControlHosts`, `allowedControlPorts`.

Nicht sandboxed:

- Der Gateway-Prozess selbst.
- Jedes Werkzeug, das explizit fuer die Ausfuehrung auf dem Host erlaubt ist (z. B. `tools.elevated`).
  - **Erhoehte Ausfuehrung laeuft auf dem Host und umgeht Sandboxing.**
  - Ist Sandboxing deaktiviert, aendert `tools.elevated` die Ausfuehrung nicht (bereits auf dem Host). Siehe [Elevated Mode](/tools/elevated).

## Modi

`agents.defaults.sandbox.mode` steuert, **wann** Sandboxing verwendet wird:

- `"off"`: kein Sandboxing.
- `"non-main"`: Sandbox nur fuer **Nicht-Haupt**-Sitzungen (Standard, wenn Sie normale Chats auf dem Host moechten).
- `"all"`: jede Sitzung laeuft in einer Sandbox.
  Hinweis: `"non-main"` basiert auf `session.mainKey` (Standard `"main"`), nicht auf der Agent-ID.
  Gruppen-/Kanal-Sitzungen verwenden eigene Schluessel, gelten daher als Nicht-Haupt und werden sandboxed.

## Geltungsbereich

`agents.defaults.sandbox.scope` steuert, **wie viele Container** erstellt werden:

- `"session"` (Standard): ein Container pro Sitzung.
- `"agent"`: ein Container pro Agent.
- `"shared"`: ein Container, der von allen sandboxed Sitzungen geteilt wird.

## Workspace-Zugriff

`agents.defaults.sandbox.workspaceAccess` steuert, **was die Sandbox sehen kann**:

- `"none"` (Standard): Werkzeuge sehen einen Sandbox-Workspace unter `~/.openclaw/sandboxes`.
- `"ro"`: bindet den Agent-Workspace schreibgeschuetzt unter `/agent` ein (deaktiviert `write`/`edit`/`apply_patch`).
- `"rw"`: bindet den Agent-Workspace mit Lese-/Schreibzugriff unter `/workspace` ein.

Eingehende Medien werden in den aktiven Sandbox-Workspace kopiert (`media/inbound/*`).
Skills-Hinweis: Das Werkzeug `read` ist an die Sandbox-Wurzel gebunden. Mit `workspaceAccess: "none"`
spiegelt OpenClaw geeignete Skills in den Sandbox-Workspace (`.../skills`), sodass
sie gelesen werden koennen. Mit `"rw"` sind Workspace-Skills lesbar unter
`/workspace/skills`.

## Benutzerdefinierte Bind-Mounts

`agents.defaults.sandbox.docker.binds` bindet zusaetzliche Host-Verzeichnisse in den Container ein.
Format: `host:container:mode` (z. B. `"/home/user/source:/source:rw"`).

Globale und agentenspezifische Binds werden **zusammengefuehrt** (nicht ersetzt). Unter `scope: "shared"` werden agentenspezifische Binds ignoriert.

Beispiel (schreibgeschuetzte Quelle + Docker-Socket):

```json5
{
  agents: {
    defaults: {
      sandbox: {
        docker: {
          binds: ["/home/user/source:/source:ro", "/var/run/docker.sock:/var/run/docker.sock"],
        },
      },
    },
    list: [
      {
        id: "build",
        sandbox: {
          docker: {
            binds: ["/mnt/cache:/cache:rw"],
          },
        },
      },
    ],
  },
}
```

Sicherheitshinweise:

- Binds umgehen das Sandbox-Dateisystem: Sie exponieren Host-Pfade mit dem von Ihnen gesetzten Modus (`:ro` oder `:rw`).
- Sensible Mounts (z. B. `docker.sock`, Secrets, SSH-Schluessel) sollten `:ro` sein, sofern nicht absolut erforderlich.
- Kombinieren Sie dies mit `workspaceAccess: "ro"`, wenn Sie nur Lesezugriff auf den Workspace benoetigen; Bind-Modi bleiben unabhaengig.
- Siehe [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) fuer das Zusammenspiel von Binds mit Tool-Policy und erhöhter Ausfuehrung.

## Images + Setup

Standard-Image: `openclaw-sandbox:bookworm-slim`

Einmal bauen:

```bash
scripts/sandbox-setup.sh
```

Hinweis: Das Standard-Image enthaelt **kein** Node. Wenn ein Skill Node (oder
andere Runtimes) benoetigt, backen Sie entweder ein benutzerdefiniertes Image
oder installieren es ueber `sandbox.docker.setupCommand` (erfordert Network-Egress + beschreibbares Root +
Root-Benutzer).

Sandboxed Browser-Image:

```bash
scripts/sandbox-browser-setup.sh
```

Standardmaessig laufen Sandbox-Container **ohne Netzwerk**.
Ueberschreiben Sie dies mit `agents.defaults.sandbox.docker.network`.

Docker-Installationen und der containerisierte Gateway befinden sich hier:
[Docker](/install/docker)

## setupCommand (einmaliges Container-Setup)

`setupCommand` wird **einmal** ausgefuehrt, nachdem der Sandbox-Container erstellt wurde (nicht bei jedem Lauf).
Die Ausfuehrung erfolgt im Container ueber `sh -lc`.

Pfade:

- Global: `agents.defaults.sandbox.docker.setupCommand`
- Pro Agent: `agents.list[].sandbox.docker.setupCommand`

Haeufige Fallstricke:

- Standard `docker.network` ist `"none"` (kein Egress), daher schlagen Paketinstallationen fehl.
- `readOnlyRoot: true` verhindert Schreibzugriffe; setzen Sie `readOnlyRoot: false` oder backen Sie ein benutzerdefiniertes Image.
- `user` muss Root sein fuer Paketinstallationen (lassen Sie `user` weg oder setzen Sie `user: "0:0"`).
- Sandbox-Exec erbt **keine** Host-`process.env`. Verwenden Sie
  `agents.defaults.sandbox.docker.env` (oder ein benutzerdefiniertes Image) fuer Skill-API-Schluessel.

## Tool-Policy + Escape-Hatches

Tool-Allow/Deny-Richtlinien gelten weiterhin vor den Sandbox-Regeln. Ist ein Werkzeug
global oder pro Agent verweigert, bringt Sandboxing es nicht zurueck.

`tools.elevated` ist eine explizite Escape-Hatch, die `exec` auf dem Host ausfuehrt.
`/exec`-Direktiven gelten nur fuer autorisierte Absender und bleiben pro Sitzung erhalten; um
`exec` hart zu deaktivieren, verwenden Sie Tool-Policy Deny (siehe [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)).

Debugging:

- Verwenden Sie `openclaw sandbox explain`, um den effektiven Sandbox-Modus, die Tool-Policy und Fix-it-Konfigurationsschluessel zu inspizieren.
- Siehe [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) fuer das mentale Modell „Warum ist das blockiert?“
  Halten Sie es strikt gesperrt.

## Multi-Agent-Ueberschreibungen

Jeder Agent kann Sandbox + Werkzeuge ueberschreiben:
`agents.list[].sandbox` und `agents.list[].tools` (zusaetzlich `agents.list[].tools.sandbox.tools` fuer Sandbox-Tool-Policy).
Siehe [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) zur Prioritaet.

## Minimales Aktivierungsbeispiel

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
      },
    },
  },
}
```

## Verwandte Dokumente

- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)
- [Security](/gateway/security)
