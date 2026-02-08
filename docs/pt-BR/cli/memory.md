---
summary: "Referencia da CLI para `openclaw memory` (status/index/search)"
read_when:
  - Voce quer indexar ou pesquisar memoria semantica
  - Voce esta depurando a disponibilidade de memoria ou a indexacao
title: "memoria"
x-i18n:
  source_path: cli/memory.md
  source_hash: 95a9e94306f95be2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:40Z
---

# `openclaw memory`

Gerencie a indexacao e a pesquisa de memoria semantica.
Fornecido pelo plugin de memoria ativo (padrao: `memory-core`; defina `plugins.slots.memory = "none"` para desativar).

Relacionados:

- Conceito de memoria: [Memory](/concepts/memory)
- Plugins: [Plugins](/plugins)

## Exemplos

```bash
openclaw memory status
openclaw memory status --deep
openclaw memory status --deep --index
openclaw memory status --deep --index --verbose
openclaw memory index
openclaw memory index --verbose
openclaw memory search "release checklist"
openclaw memory status --agent main
openclaw memory index --agent main --verbose
```

## Opcoes

Comuns:

- `--agent <id>`: limita o escopo a um unico agente (padrao: todos os agentes configurados).
- `--verbose`: emite logs detalhados durante as verificacoes e a indexacao.

Notas:

- `memory status --deep` verifica a disponibilidade de vetores e embeddings.
- `memory status --deep --index` executa uma reindexacao se o armazenamento estiver sujo.
- `memory index --verbose` imprime detalhes por fase (provedor, modelo, fontes, atividade de lote).
- `memory status` inclui quaisquer caminhos extras configurados via `memorySearch.extraPaths`.
