---
summary: "Referencia da CLI para `openclaw update` (atualizacao de codigo-fonte relativamente segura + reinicio automatico do Gateway)"
read_when:
  - Voce quer atualizar um checkout de codigo-fonte com seguranca
  - Voce precisa entender o comportamento do atalho `--update`
title: "update"
x-i18n:
  source_path: cli/update.md
  source_hash: 3a08e8ac797612c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:49Z
---

# `openclaw update`

Atualize o OpenClaw com seguranca e alterne entre os canais stable/beta/dev.

Se voce instalou via **npm/pnpm** (instalacao global, sem metadados git), as atualizacoes acontecem pelo fluxo do gerenciador de pacotes em [Updating](/install/updating).

## Usage

```bash
openclaw update
openclaw update status
openclaw update wizard
openclaw update --channel beta
openclaw update --channel dev
openclaw update --tag beta
openclaw update --no-restart
openclaw update --json
openclaw --update
```

## Options

- `--no-restart`: pular o reinicio do servico do Gateway apos uma atualizacao bem-sucedida.
- `--channel <stable|beta|dev>`: definir o canal de atualizacao (git + npm; persistido na configuracao).
- `--tag <dist-tag|version>`: sobrescrever o dist-tag ou a versao do npm apenas para esta atualizacao.
- `--json`: imprimir JSON `UpdateRunResult` legivel por maquina.
- `--timeout <seconds>`: timeout por etapa (o padrao e 1200s).

Nota: downgrades exigem confirmacao porque versoes mais antigas podem quebrar a configuracao.

## `update status`

Mostra o canal de atualizacao ativo + tag/branch/SHA do git (para checkouts de codigo-fonte), alem da disponibilidade de atualizacao.

```bash
openclaw update status
openclaw update status --json
openclaw update status --timeout 10
```

Options:

- `--json`: imprimir JSON de status legivel por maquina.
- `--timeout <seconds>`: timeout para verificacoes (o padrao e 3s).

## `update wizard`

Fluxo interativo para escolher um canal de atualizacao e confirmar se o Gateway deve ser reiniciado
apos a atualizacao (o padrao e reiniciar). Se voce selecionar `dev` sem um checkout git, ele
oferece criar um.

## What it does

Quando voce muda explicitamente de canal (`--channel ...`), o OpenClaw tambem mantem o
metodo de instalacao alinhado:

- `dev` → garante um checkout git (padrao: `~/openclaw`, sobrescreva com `OPENCLAW_GIT_DIR`),
  atualiza-o e instala a CLI global a partir desse checkout.
- `stable`/`beta` → instala a partir do npm usando o dist-tag correspondente.

## Git checkout flow

Canais:

- `stable`: faz checkout da tag mais recente nao-beta, depois build + doctor.
- `beta`: faz checkout da tag `-beta` mais recente, depois build + doctor.
- `dev`: faz checkout de `main`, depois fetch + rebase.

Em alto nivel:

1. Requer um worktree limpo (sem alteracoes nao commitadas).
2. Alterna para o canal selecionado (tag ou branch).
3. Busca o upstream (apenas dev).
4. Apenas dev: lint de preflight + build TypeScript em um worktree temporario; se o tip falhar, volta ate 10 commits para encontrar o build limpo mais recente.
5. Rebase no commit selecionado (apenas dev).
6. Instala dependencias (pnpm preferido; fallback para npm).
7. Compila + compila a Control UI.
8. Executa `openclaw doctor` como a verificacao final de “atualizacao segura”.
9. Sincroniza plugins com o canal ativo (dev usa extensoes empacotadas; stable/beta usa npm) e atualiza plugins instalados via npm.

## `--update` shorthand

`openclaw --update` reescreve para `openclaw update` (util para shells e scripts de inicializacao).

## See also

- `openclaw doctor` (oferece executar a atualizacao primeiro em checkouts git)
- [Development channels](/install/development-channels)
- [Updating](/install/updating)
- [CLI reference](/cli)
