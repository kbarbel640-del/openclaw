---
summary: "Referencia da CLI para `openclaw agents` (listar/adicionar/excluir/definir identidade)"
read_when:
  - Voce quer varios agentes isolados (workspaces + roteamento + autenticacao)
title: "agentes"
x-i18n:
  source_path: cli/agents.md
  source_hash: 30556d81636a9ad8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:28Z
---

# `openclaw agents`

Gerencie agentes isolados (workspaces + autenticacao + roteamento).

Relacionado:

- Roteamento multiagente: [Multi-Agent Routing](/concepts/multi-agent)
- Workspace do agente: [Agent workspace](/concepts/agent-workspace)

## Exemplos

```bash
openclaw agents list
openclaw agents add work --workspace ~/.openclaw/workspace-work
openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity
openclaw agents set-identity --agent main --avatar avatars/openclaw.png
openclaw agents delete work
```

## Arquivos de identidade

Cada workspace de agente pode incluir um `IDENTITY.md` na raiz do workspace:

- Caminho de exemplo: `~/.openclaw/workspace/IDENTITY.md`
- `set-identity --from-identity` lê a partir da raiz do workspace (ou de um `--identity-file` explícito)

Os caminhos de avatar são resolvidos de forma relativa à raiz do workspace.

## Definir identidade

`set-identity` grava campos em `agents.list[].identity`:

- `name`
- `theme`
- `emoji`
- `avatar` (caminho relativo ao workspace, URL http(s) ou URI de dados)

Carregar de `IDENTITY.md`:

```bash
openclaw agents set-identity --workspace ~/.openclaw/workspace --from-identity
```

Substituir campos explicitamente:

```bash
openclaw agents set-identity --agent main --name "OpenClaw" --emoji "🦞" --avatar avatars/openclaw.png
```

Exemplo de configuracao:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "OpenClaw",
          theme: "space lobster",
          emoji: "🦞",
          avatar: "avatars/openclaw.png",
        },
      },
    ],
  },
}
```
