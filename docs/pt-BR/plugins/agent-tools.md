---
summary: "Escreva ferramentas de agente em um plugin (esquemas, ferramentas opcionais, allowlists)"
read_when:
  - Voce quer adicionar uma nova ferramenta de agente em um plugin
  - Voce precisa tornar uma ferramenta opt-in via allowlists
title: "Ferramentas de Agente do Plugin"
x-i18n:
  source_path: plugins/agent-tools.md
  source_hash: 4479462e9d8b17b6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:00Z
---

# Ferramentas de agente do plugin

Plugins do OpenClaw podem registrar **ferramentas de agente** (funcoes JSON‑schema) que sao expostas
ao LLM durante execucoes do agente. As ferramentas podem ser **obrigatorias** (sempre disponiveis) ou
**opcionais** (opt‑in).

As ferramentas de agente sao configuradas em `tools` na configuracao principal, ou por agente em
`agents.list[].tools`. A politica de allowlist/denylist controla quais ferramentas o agente
pode chamar.

## Ferramenta basica

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

## Ferramenta opcional (opt‑in)

Ferramentas opcionais **nunca** sao habilitadas automaticamente. Os usuarios devem adiciona-las a uma
allowlist do agente.

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

Habilite ferramentas opcionais em `agents.list[].tools.allow` (ou global `tools.allow`):

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

Outros ajustes de configuracao que afetam a disponibilidade de ferramentas:

- Allowlists que nomeiam apenas ferramentas de plugin sao tratadas como opt-ins de plugin; ferramentas core permanecem
  habilitadas, a menos que voce tambem inclua ferramentas core ou grupos na allowlist.
- `tools.profile` / `agents.list[].tools.profile` (allowlist base)
- `tools.byProvider` / `agents.list[].tools.byProvider` (permitir/negar especifico do provedor)
- `tools.sandbox.tools.*` (politica de ferramentas de sandbox quando em sandbox)

## Regras + dicas

- Os nomes das ferramentas **nao** devem conflitar com nomes de ferramentas core; ferramentas conflitantes sao ignoradas.
- IDs de plugin usados em allowlists nao devem conflitar com nomes de ferramentas core.
- Prefira `optional: true` para ferramentas que disparam efeitos colaterais ou exigem
  binarios/credenciais extras.
