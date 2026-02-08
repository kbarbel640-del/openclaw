---
summary: "Referencia de CLI para `openclaw nodes` (listar/status/aprovar/invocar, camera/canvas/tela)"
read_when:
  - Você está gerenciando nós pareados (câmeras, tela, canvas)
  - Você precisa aprovar solicitações ou invocar comandos de nós
title: "nodes"
x-i18n:
  source_path: cli/nodes.md
  source_hash: 23da6efdd659a82d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:40Z
---

# `openclaw nodes`

Gerencie nós pareados (dispositivos) e invoque capacidades dos nós.

Relacionados:

- Visão geral de nós: [Nodes](/nodes)
- Câmera: [Camera nodes](/nodes/camera)
- Imagens: [Image nodes](/nodes/images)

Opções comuns:

- `--url`, `--token`, `--timeout`, `--json`

## Comandos comuns

```bash
openclaw nodes list
openclaw nodes list --connected
openclaw nodes list --last-connected 24h
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes status
openclaw nodes status --connected
openclaw nodes status --last-connected 24h
```

`nodes list` imprime tabelas de pendentes/pareados. As linhas pareadas incluem a idade da conexão mais recente (Last Connect).
Use `--connected` para mostrar apenas nós atualmente conectados. Use `--last-connected <duration>` para
filtrar para nós que se conectaram dentro de uma duração (por exemplo, `24h`, `7d`).

## Invocar / executar

```bash
openclaw nodes invoke --node <id|name|ip> --command <command> --params <json>
openclaw nodes run --node <id|name|ip> <command...>
openclaw nodes run --raw "git status"
openclaw nodes run --agent main --node <id|name|ip> --raw "git status"
```

Flags de invocação:

- `--params <json>`: string de objeto JSON (padrão `{}`).
- `--invoke-timeout <ms>`: timeout de invocação do nó (padrão `15000`).
- `--idempotency-key <key>`: chave de idempotência opcional.

### Padrões no estilo exec

`nodes run` espelha o comportamento exec do modelo (padrões + aprovações):

- Lê `tools.exec.*` (mais substituições de `agents.list[].tools.exec.*`).
- Usa aprovações de exec (`exec.approval.request`) antes de invocar `system.run`.
- `--node` pode ser omitido quando `tools.exec.node` está definido.
- Requer um nó que anuncie `system.run` (aplicativo complementar no macOS ou host de nó headless).

Flags:

- `--cwd <path>`: diretório de trabalho.
- `--env <key=val>`: substituição de env (repetível).
- `--command-timeout <ms>`: timeout do comando.
- `--invoke-timeout <ms>`: timeout de invocação do nó (padrão `30000`).
- `--needs-screen-recording`: exigir permissão de gravação de tela.
- `--raw <command>`: executar uma string de shell (`/bin/sh -lc` ou `cmd.exe /c`).
- `--agent <id>`: aprovações/listas de permissão com escopo de agente (padrão para o agente configurado).
- `--ask <off|on-miss|always>`, `--security <deny|allowlist|full>`: substituições.
