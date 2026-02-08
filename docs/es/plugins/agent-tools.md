---
summary: "Escriba herramientas de agente en un plugin (esquemas, herramientas opcionales, allowlists)"
read_when:
  - Quiere agregar una nueva herramienta de agente en un plugin
  - Necesita hacer que una herramienta sea de inclusion voluntaria mediante allowlists
title: "Herramientas de agente del plugin"
x-i18n:
  source_path: plugins/agent-tools.md
  source_hash: 4479462e9d8b17b6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:34Z
---

# Herramientas de agente del plugin

Los plugins de OpenClaw pueden registrar **herramientas de agente** (funciones con esquema JSON) que se exponen
al LLM durante las ejecuciones del agente. Las herramientas pueden ser **requeridas** (siempre disponibles) u
**opcionales** (de inclusion voluntaria).

Las herramientas de agente se configuran en `tools` en la configuracion principal, o por agente en
`agents.list[].tools`. La politica de allowlist/denylist controla que herramientas puede
invocar el agente.

## Herramienta basica

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

## Herramienta opcional (inclusion voluntaria)

Las herramientas opcionales **nunca** se habilitan automaticamente. Los usuarios deben agregarlas a una allowlist
del agente.

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

Habilite las herramientas opcionales en `agents.list[].tools.allow` (o globalmente en `tools.allow`):

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

Otros controles de configuracion que afectan la disponibilidad de herramientas:

- Las allowlists que solo nombran herramientas de plugins se tratan como inclusiones voluntarias de plugins; las herramientas centrales permanecen
  habilitadas a menos que tambien incluya herramientas centrales o grupos en la allowlist.
- `tools.profile` / `agents.list[].tools.profile` (allowlist base)
- `tools.byProvider` / `agents.list[].tools.byProvider` (permitir/denegar especifico del proveedor)
- `tools.sandbox.tools.*` (politica de herramientas de sandbox cuando esta en sandbox)

## Reglas y consejos

- Los nombres de las herramientas **no** deben entrar en conflicto con los nombres de herramientas centrales; las herramientas en conflicto se omiten.
- Los ids de plugins usados en allowlists no deben entrar en conflicto con los nombres de herramientas centrales.
- Prefiera `optional: true` para herramientas que provocan efectos secundarios o requieren
  binarios/credenciales adicionales.
