---
title: Sandbox vs. Tool-Richtlinie vs. Elevated
summary: "Warum ein Werkzeug blockiert ist: Sandbox-Laufzeit, Tool-Erlauben/Verweigern-Richtlinie und Elevated-Exec-Gates"
read_when: "Wenn Sie in der „Sandbox-Haft“ landen oder eine Tool-/Elevated-Verweigerung sehen und den exakten Konfigurationsschlüssel ändern möchten."
status: active
x-i18n:
  source_path: gateway/sandbox-vs-tool-policy-vs-elevated.md
  source_hash: 863ea5e6d137dfb6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:35Z
---

# Sandbox vs. Tool-Richtlinie vs. Elevated

OpenClaw hat drei verwandte (aber unterschiedliche) Kontrollen:

1. **Sandbox** (`agents.defaults.sandbox.*` / `agents.list[].sandbox.*`) entscheidet **wo Werkzeuge laufen** (Docker vs. Host).
2. **Tool-Richtlinie** (`tools.*`, `tools.sandbox.tools.*`, `agents.list[].tools.*`) entscheidet **welche Werkzeuge verfügbar/erlaubt sind**.
3. **Elevated** (`tools.elevated.*`, `agents.list[].tools.elevated.*`) ist ein **nur-Exec-Notausgang**, um auf dem Host zu laufen, wenn Sie sandboxed sind.

## Schnell-Debug

Verwenden Sie den Inspector, um zu sehen, was OpenClaw _tatsächlich_ tut:

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

Er gibt aus:

- effektiver Sandbox-Modus/-Scope/-Workspace-Zugriff
- ob die Sitzung aktuell sandboxed ist (Haupt- vs. Nicht-Hauptsitzung)
- effektives Sandbox-Tool-Erlauben/Verweigern (und ob es von Agent/Global/Standard stammt)
- Elevated-Gates und Fix-it-Schlüsselpfade

## Sandbox: wo Werkzeuge laufen

Sandboxing wird über `agents.defaults.sandbox.mode` gesteuert:

- `"off"`: alles läuft auf dem Host.
- `"non-main"`: nur Nicht-Hauptsitzungen sind sandboxed (häufige „Überraschung“ für Gruppen/Kanäle).
- `"all"`: alles ist sandboxed.

Siehe [Sandboxing](/gateway/sandboxing) fuer alle Details (Scope, Workspace-Mounts, Images).

### Bind-Mounts (Sicherheits-Schnellcheck)

- `docker.binds` _durchsticht_ das Sandbox-Dateisystem: Alles, was Sie mounten, ist im Container mit dem von Ihnen gesetzten Modus sichtbar (`:ro` oder `:rw`).
- Standard ist Lesen/Schreiben, wenn Sie den Modus weglassen; bevorzugen Sie `:ro` fuer Source/Secrets.
- `scope: "shared"` ignoriert agentenspezifische Binds (nur globale Binds gelten).
- Das Binden von `/var/run/docker.sock` übergibt der Sandbox effektiv die Host-Kontrolle; tun Sie dies nur bewusst.
- Workspace-Zugriff (`workspaceAccess: "ro"`/`"rw"`) ist unabhängig von Bind-Modi.

## Tool-Richtlinie: welche Werkzeuge existieren/aufrufbar sind

Zwei Ebenen sind relevant:

- **Tool-Profil**: `tools.profile` und `agents.list[].tools.profile` (Basis-Allowlist)
- **Anbieter-Tool-Profil**: `tools.byProvider[provider].profile` und `agents.list[].tools.byProvider[provider].profile`
- **Globale/pro-Agent-Tool-Richtlinie**: `tools.allow`/`tools.deny` und `agents.list[].tools.allow`/`agents.list[].tools.deny`
- **Anbieter-Tool-Richtlinie**: `tools.byProvider[provider].allow/deny` und `agents.list[].tools.byProvider[provider].allow/deny`
- **Sandbox-Tool-Richtlinie** (gilt nur, wenn sandboxed): `tools.sandbox.tools.allow`/`tools.sandbox.tools.deny` und `agents.list[].tools.sandbox.tools.*`

Faustregeln:

- `deny` gewinnt immer.
- Wenn `allow` nicht leer ist, wird alles andere als blockiert behandelt.
- Die Tool-Richtlinie ist der harte Stopp: `/exec` kann ein verweigertes `exec`-Werkzeug nicht überschreiben.
- `/exec` ändert nur Sitzungs-Defaults fuer autorisierte Absender; es gewährt keinen Tool-Zugriff.
  Anbieter-Tool-Schlüssel akzeptieren entweder `provider` (z. B. `google-antigravity`) oder `provider/model` (z. B. `openai/gpt-5.2`).

### Tool-Gruppen (Kurzschreibweisen)

Tool-Richtlinien (global, Agent, Sandbox) unterstützen `group:*`-Einträge, die zu mehreren Werkzeugen expandieren:

```json5
{
  tools: {
    sandbox: {
      tools: {
        allow: ["group:runtime", "group:fs", "group:sessions", "group:memory"],
      },
    },
  },
}
```

Verfügbare Gruppen:

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: alle integrierten OpenClaw-Werkzeuge (ohne Anbieter-Plugins)

## Elevated: nur-Exec „auf dem Host ausführen“

Elevated gewährt **keine** zusätzlichen Werkzeuge; es betrifft nur `exec`.

- Wenn Sie sandboxed sind, läuft `/elevated on` (oder `exec` mit `elevated: true`) auf dem Host (Freigaben können weiterhin erforderlich sein).
- Verwenden Sie `/elevated full`, um Exec-Freigaben fuer die Sitzung zu überspringen.
- Wenn Sie bereits direkt laufen, ist Elevated effektiv ein No-op (weiterhin gated).
- Elevated ist **nicht** Skill-spezifisch und überschreibt **nicht** Tool-Erlauben/Verweigern.
- `/exec` ist von Elevated getrennt. Es passt nur die Exec-Defaults pro Sitzung fuer autorisierte Absender an.

Gates:

- Aktivierung: `tools.elevated.enabled` (und optional `agents.list[].tools.elevated.enabled`)
- Absender-Allowlists: `tools.elevated.allowFrom.<provider>` (und optional `agents.list[].tools.elevated.allowFrom.<provider>`)

Siehe [Elevated Mode](/tools/elevated).

## Häufige „Sandbox-Haft“-Fixes

### „Tool X durch Sandbox-Tool-Richtlinie blockiert“

Fix-it-Schlüssel (einen auswählen):

- Sandbox deaktivieren: `agents.defaults.sandbox.mode=off` (oder pro Agent `agents.list[].sandbox.mode=off`)
- Das Werkzeug innerhalb der Sandbox erlauben:
  - aus `tools.sandbox.tools.deny` entfernen (oder pro Agent `agents.list[].tools.sandbox.tools.deny`)
  - oder zu `tools.sandbox.tools.allow` hinzufügen (oder pro Agent erlauben)

### „Ich dachte, das wäre die Hauptsitzung – warum ist sie sandboxed?“

Im Modus `"non-main"` sind Gruppen-/Kanal-Schlüssel _nicht_ die Hauptsitzung. Verwenden Sie den Hauptsitzungs-Schlüssel (angezeigt durch `sandbox explain`) oder wechseln Sie den Modus zu `"off"`.
