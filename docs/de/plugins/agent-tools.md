---
summary: "Agentenwerkzeuge in einem Plugin schreiben (Schemata, optionale Werkzeuge, Allowlists)"
read_when:
  - Sie möchten ein neues Agentenwerkzeug in einem Plugin hinzufügen
  - Sie müssen ein Werkzeug per Allowlist optional aktivierbar machen
title: "Plugin-Agentenwerkzeuge"
x-i18n:
  source_path: plugins/agent-tools.md
  source_hash: 4479462e9d8b17b6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:07Z
---

# Plugin-Agentenwerkzeuge

OpenClaw-Plugins können **Agentenwerkzeuge** (JSON-Schema-Funktionen) registrieren, die
dem LLM während Agentenläufen zur Verfügung stehen. Werkzeuge können **erforderlich**
(immer verfügbar) oder **optional** (Opt-in) sein.

Agentenwerkzeuge werden in der Hauptkonfiguration unter `tools` oder pro Agent
unter `agents.list[].tools` konfiguriert. Die Allowlist-/Denylist-Richtlinie steuert, welche
Werkzeuge der Agent aufrufen kann.

## Grundlegendes Werkzeug

```ts
import { Type } from "@sinclair/typebox";

export default function (api) {
  api.registerTool({
    name: "my_tool",
    description: "Do a thing",
    parameters: Type.Object({
      input: Type.String(),
    }),
    async execute(_id, params) {
      return { content: [{ type: "text", text: params.input }] };
    },
  });
}
```

## Optionales Werkzeug (Opt-in)

Optionale Werkzeuge werden **niemals** automatisch aktiviert. Benutzer müssen sie zu
einer Agenten-Allowlist hinzufügen.

```ts
export default function (api) {
  api.registerTool(
    {
      name: "workflow_tool",
      description: "Run a local workflow",
      parameters: {
        type: "object",
        properties: {
          pipeline: { type: "string" },
        },
        required: ["pipeline"],
      },
      async execute(_id, params) {
        return { content: [{ type: "text", text: params.pipeline }] };
      },
    },
    { optional: true },
  );
}
```

Aktivieren Sie optionale Werkzeuge in `agents.list[].tools.allow` (oder global in `tools.allow`):

```json5
{
  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: [
            "workflow_tool", // specific tool name
            "workflow", // plugin id (enables all tools from that plugin)
            "group:plugins", // all plugin tools
          ],
        },
      },
    ],
  },
}
```

Weitere Konfigurationsparameter, die die Verfügbarkeit von Werkzeugen beeinflussen:

- Allowlists, die nur Plugin-Werkzeuge benennen, werden als Plugin-Opt-ins behandelt;
  Kernwerkzeuge bleiben aktiviert, es sei denn, Sie nehmen Kernwerkzeuge oder -gruppen
  ebenfalls in die Allowlist auf.
- `tools.profile` / `agents.list[].tools.profile` (Basis-Allowlist)
- `tools.byProvider` / `agents.list[].tools.byProvider` (anbieter­spezifisches Allow/Deny)
- `tools.sandbox.tools.*` (Sandbox-Werkzeugrichtlinie bei Sandboxing)

## Regeln + Tipps

- Werkzeugnamen dürfen **nicht** mit Namen von Kernwerkzeugen kollidieren; kollidierende
  Werkzeuge werden übersprungen.
- In Allowlists verwendete Plugin-IDs dürfen nicht mit Namen von Kernwerkzeugen kollidieren.
- Bevorzugen Sie `optional: true` für Werkzeuge, die Nebenwirkungen auslösen oder
  zusätzliche Binärdateien/Anmeldeinformationen erfordern.
