---
summary: „Multi-Agent-Routing: isolierte Agenten, Kanal-Accounts und Bindungen“
title: Multi-Agent-Routing
read_when: „Sie moechten mehrere isolierte Agenten (Workspaces + Auth) in einem Gateway-Prozess.“
status: active
x-i18n:
  source_path: concepts/multi-agent.md
  source_hash: 49b3ba55d8a7f0b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:13Z
---

# Multi-Agent-Routing

Ziel: mehrere _isolierte_ Agenten (separater Workspace + `agentDir` + Sitzungen) sowie mehrere Kanal-Accounts (z. B. zwei WhatsApps) in einem laufenden Gateway. Eingehende Nachrichten werden ueber Bindungen einem Agenten zugeordnet.

## Was ist „ein Agent“?

Ein **Agent** ist ein vollstaendig abgegrenztes Gehirn mit eigenem:

- **Workspace** (Dateien, AGENTS.md/SOUL.md/USER.md, lokale Notizen, Persona-Regeln).
- **State-Verzeichnis** (`agentDir`) fuer Auth-Profile, Modell-Registry und agentenspezifische Konfiguration.
- **Sitzungsspeicher** (Chatverlauf + Routing-Zustand) unter `~/.openclaw/agents/<agentId>/sessions`.

Auth-Profile sind **pro Agent**. Jeder Agent liest aus seinem eigenen:

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

Zugangsdaten des Hauptagenten werden **nicht** automatisch geteilt. Verwenden Sie `agentDir`
niemals agentenuebergreifend (das verursacht Auth-/Sitzungskollisionen). Wenn Sie Zugangsdaten teilen moechten,
kopieren Sie `auth-profiles.json` in das `agentDir` des anderen Agenten.

Skills sind pro Agent ueber den `skills/`-Ordner jedes Workspaces definiert, wobei geteilte Skills
aus `~/.openclaw/skills` verfuegbar sind. Siehe [Skills: pro Agent vs. geteilt](/tools/skills#per-agent-vs-shared-skills).

Das Gateway kann **einen Agenten** (Standard) oder **viele Agenten** parallel hosten.

**Workspace-Hinweis:** Der Workspace jedes Agenten ist das **Standard-cwd**, keine harte
Sandbox. Relative Pfade werden innerhalb des Workspaces aufgeloest, absolute Pfade koennen
jedoch andere Host-Speicherorte erreichen, sofern Sandboxing nicht aktiviert ist. Siehe
[Sandboxing](/gateway/sandboxing).

## Pfade (Kurzübersicht)

- Konfiguration: `~/.openclaw/openclaw.json` (oder `OPENCLAW_CONFIG_PATH`)
- State-Verzeichnis: `~/.openclaw` (oder `OPENCLAW_STATE_DIR`)
- Workspace: `~/.openclaw/workspace` (oder `~/.openclaw/workspace-<agentId>`)
- Agent-Verzeichnis: `~/.openclaw/agents/<agentId>/agent` (oder `agents.list[].agentDir`)
- Sitzungen: `~/.openclaw/agents/<agentId>/sessions`

### Einzelagentenmodus (Standard)

Wenn Sie nichts unternehmen, laeuft OpenClaw mit einem einzelnen Agenten:

- `agentId` ist standardmaessig **`main`**.
- Sitzungen sind als `agent:main:<mainKey>` geschluesselt.
- Der Workspace ist standardmaessig `~/.openclaw/workspace` (oder `~/.openclaw/workspace-<profile>`, wenn `OPENCLAW_PROFILE` gesetzt ist).
- Der State ist standardmaessig `~/.openclaw/agents/main/agent`.

## Agent-Helfer

Verwenden Sie den Agent-Assistenten, um einen neuen isolierten Agenten hinzuzufuegen:

```bash
openclaw agents add work
```

Fuegen Sie dann `bindings` hinzu (oder lassen Sie dies vom Assistenten erledigen), um eingehende Nachrichten zu routen.

Ueberpruefen Sie dies mit:

```bash
openclaw agents list --bindings
```

## Mehrere Agenten = mehrere Personen, mehrere Persoenlichkeiten

Mit **mehreren Agenten** wird jedes `agentId` zu einer **vollstaendig isolierten Persona**:

- **Unterschiedliche Telefonnummern/Accounts** (pro Kanal-`accountId`).
- **Unterschiedliche Persoenlichkeiten** (agentenspezifische Workspace-Dateien wie `AGENTS.md` und `SOUL.md`).
- **Getrennte Authentifizierung + Sitzungen** (keine Ueberschneidungen, sofern nicht explizit aktiviert).

So koennen **mehrere Personen** einen Gateway-Server gemeinsam nutzen, waehrend ihre KI-„Gehirne“ und Daten isoliert bleiben.

## Eine WhatsApp-Nummer, mehrere Personen (DM-Aufteilung)

Sie koennen **unterschiedliche WhatsApp-Direktnachrichten** verschiedenen Agenten zuordnen und dabei **ein einziges WhatsApp-Konto** verwenden. Der Abgleich erfolgt ueber die Absender-E.164 (wie `+15551234567`) mit `peer.kind: "dm"`. Antworten kommen weiterhin von derselben WhatsApp-Nummer (keine agentenspezifische Absenderidentitaet).

Wichtiges Detail: Direktchats fallen auf den **Haupt-Sitzungsschluessel** des Agenten zurueck, daher erfordert echte Isolation **einen Agenten pro Person**.

Beispiel:

```json5
{
  agents: {
    list: [
      { id: "alex", workspace: "~/.openclaw/workspace-alex" },
      { id: "mia", workspace: "~/.openclaw/workspace-mia" },
    ],
  },
  bindings: [
    { agentId: "alex", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230001" } } },
    { agentId: "mia", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230002" } } },
  ],
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551230001", "+15551230002"],
    },
  },
}
```

Hinweise:

- DM-Zugriffskontrolle ist **global pro WhatsApp-Konto** (Kopplung/Allowlist), nicht pro Agent.
- Fuer geteilte Gruppen binden Sie die Gruppe an einen Agenten oder verwenden Sie [Broadcast-Gruppen](/broadcast-groups).

## Routing-Regeln (wie Nachrichten einen Agenten waehlen)

Bindungen sind **deterministisch** und **die spezifischste Regel gewinnt**:

1. `peer`-Abgleich (exakte DM-/Gruppen-/Kanal-ID)
2. `guildId` (Discord)
3. `teamId` (Slack)
4. `accountId`-Abgleich fuer einen Kanal
5. Kanalebenen-Abgleich (`accountId: "*"`)
6. Rueckfall auf den Standardagenten (`agents.list[].default`, andernfalls erster Listeneintrag, Standard: `main`)

## Mehrere Accounts / Telefonnummern

Kanaele, die **mehrere Accounts** unterstuetzen (z. B. WhatsApp), verwenden `accountId` zur Identifikation
jedes Logins. Jede `accountId` kann einem anderen Agenten zugeordnet werden, sodass ein Server
mehrere Telefonnummern hosten kann, ohne Sitzungen zu vermischen.

## Konzepte

- `agentId`: ein „Gehirn“ (Workspace, agentenspezifische Auth, agentenspezifischer Sitzungsspeicher).
- `accountId`: eine Kanal-Account-Instanz (z. B. WhatsApp-Konto `"personal"` vs. `"biz"`).
- `binding`: leitet eingehende Nachrichten zu einem `agentId` weiter, basierend auf `(channel, accountId, peer)` und optional Guild-/Team-IDs.
- Direktchats fallen auf `agent:<agentId>:<mainKey>` (agentenspezifisches „Main“; `session.mainKey`).

## Beispiel: zwei WhatsApps → zwei Agenten

`~/.openclaw/openclaw.json` (JSON5):

```js
{
  agents: {
    list: [
      {
        id: "home",
        default: true,
        name: "Home",
        workspace: "~/.openclaw/workspace-home",
        agentDir: "~/.openclaw/agents/home/agent",
      },
      {
        id: "work",
        name: "Work",
        workspace: "~/.openclaw/workspace-work",
        agentDir: "~/.openclaw/agents/work/agent",
      },
    ],
  },

  // Deterministic routing: first match wins (most-specific first).
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } },

    // Optional per-peer override (example: send a specific group to work agent).
    {
      agentId: "work",
      match: {
        channel: "whatsapp",
        accountId: "personal",
        peer: { kind: "group", id: "1203630...@g.us" },
      },
    },
  ],

  // Off by default: agent-to-agent messaging must be explicitly enabled + allowlisted.
  tools: {
    agentToAgent: {
      enabled: false,
      allow: ["home", "work"],
    },
  },

  channels: {
    whatsapp: {
      accounts: {
        personal: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/personal
          // authDir: "~/.openclaw/credentials/whatsapp/personal",
        },
        biz: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/biz
          // authDir: "~/.openclaw/credentials/whatsapp/biz",
        },
      },
    },
  },
}
```

## Beispiel: WhatsApp Alltagschat + Telegram Tiefenarbeit

Aufteilung nach Kanal: Routen Sie WhatsApp zu einem schnellen Alltagsagenten und Telegram zu einem Opus-Agenten.

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },
    { agentId: "opus", match: { channel: "telegram" } },
  ],
}
```

Hinweise:

- Wenn Sie mehrere Accounts fuer einen Kanal haben, fuegen Sie `accountId` zur Bindung hinzu (z. B. `{ channel: "whatsapp", accountId: "personal" }`).
- Um eine einzelne DM/Gruppe zu Opus zu routen, waehrend der Rest auf Chat bleibt, fuegen Sie eine `match.peer`-Bindung fuer diesen Peer hinzu; Peer-Abgleiche gewinnen immer gegen kanalweite Regeln.

## Beispiel: gleicher Kanal, ein Peer zu Opus

Behalten Sie WhatsApp auf dem schnellen Agenten, leiten Sie aber eine DM zu Opus:

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "opus", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551234567" } } },
    { agentId: "chat", match: { channel: "whatsapp" } },
  ],
}
```

Peer-Bindungen gewinnen immer, platzieren Sie sie daher ueber der kanalweiten Regel.

## Familienagent an eine WhatsApp-Gruppe gebunden

Binden Sie einen dedizierten Familienagenten an eine einzelne WhatsApp-Gruppe, mit Mention-Gating
und einer strengeren Werkzeugrichtlinie:

```json5
{
  agents: {
    list: [
      {
        id: "family",
        name: "Family",
        workspace: "~/.openclaw/workspace-family",
        identity: { name: "Family Bot" },
        groupChat: {
          mentionPatterns: ["@family", "@familybot", "@Family Bot"],
        },
        sandbox: {
          mode: "all",
          scope: "agent",
        },
        tools: {
          allow: [
            "exec",
            "read",
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "session_status",
          ],
          deny: ["write", "edit", "apply_patch", "browser", "canvas", "nodes", "cron"],
        },
      },
    ],
  },
  bindings: [
    {
      agentId: "family",
      match: {
        channel: "whatsapp",
        peer: { kind: "group", id: "120363999999999999@g.us" },
      },
    },
  ],
}
```

Hinweise:

- Tool-Allow-/Deny-Listen betreffen **Werkzeuge**, nicht Skills. Wenn ein Skill
  ein Binary ausfuehren muss, stellen Sie sicher, dass `exec` erlaubt ist und das Binary in der Sandbox vorhanden ist.
- Fuer strengere Steuerung setzen Sie `agents.list[].groupChat.mentionPatterns` und lassen Sie
  Gruppen-Allowlists fuer den Kanal aktiviert.

## Agentenspezifische Sandbox- und Werkzeugkonfiguration

Ab Version v2026.1.6 kann jeder Agent seine eigene Sandbox und Werkzeugbeschraenkungen haben:

```js
{
  agents: {
    list: [
      {
        id: "personal",
        workspace: "~/.openclaw/workspace-personal",
        sandbox: {
          mode: "off",  // No sandbox for personal agent
        },
        // No tool restrictions - all tools available
      },
      {
        id: "family",
        workspace: "~/.openclaw/workspace-family",
        sandbox: {
          mode: "all",     // Always sandboxed
          scope: "agent",  // One container per agent
          docker: {
            // Optional one-time setup after container creation
            setupCommand: "apt-get update && apt-get install -y git curl",
          },
        },
        tools: {
          allow: ["read"],                    // Only read tool
          deny: ["exec", "write", "edit", "apply_patch"],    // Deny others
        },
      },
    ],
  },
}
```

Hinweis: `setupCommand` befindet sich unter `sandbox.docker` und wird einmal bei der Container-Erstellung ausgefuehrt.
Agentenspezifische `sandbox.docker.*`-Ueberschreibungen werden ignoriert, wenn der aufgeloeste Geltungsbereich `"shared"` ist.

**Vorteile:**

- **Sicherheitsisolation**: Beschraenkung von Werkzeugen fuer nicht vertrauenswuerdige Agenten
- **Ressourcenkontrolle**: Bestimmte Agenten sandboxen, waehrend andere auf dem Host bleiben
- **Flexible Richtlinien**: Unterschiedliche Berechtigungen pro Agent

Hinweis: `tools.elevated` ist **global** und absenderbasiert; es ist nicht pro Agent konfigurierbar.
Wenn Sie agentenspezifische Grenzen benoetigen, verwenden Sie `agents.list[].tools`, um `exec` zu verweigern.
Fuer Gruppen-Targeting verwenden Sie `agents.list[].groupChat.mentionPatterns`, damit @Erwaehnungen eindeutig dem vorgesehenen Agenten zugeordnet werden.

Siehe [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) fuer detaillierte Beispiele.
