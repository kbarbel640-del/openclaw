---
summary: "Fluxo de trabalho com Bun (experimental): instalacao e armadilhas vs pnpm"
read_when:
  - Voce quer o loop de desenvolvimento local mais rapido (bun + watch)
  - Voce encontrou problemas de instalacao/patch/scripts de ciclo de vida do Bun
title: "Bun (Experimental)"
x-i18n:
  source_path: install/bun.md
  source_hash: eb3f4c222b6bae49
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:31Z
---

# Bun (experimental)

Objetivo: executar este repositorio com **Bun** (opcional, nao recomendado para WhatsApp/Telegram)
sem divergir dos fluxos de trabalho do pnpm.

⚠️ **Nao recomendado para o runtime do Gateway** (bugs no WhatsApp/Telegram). Use Node em producao.

## Status

- Bun e um runtime local opcional para executar TypeScript diretamente (`bun run …`, `bun --watch …`).
- `pnpm` e o padrao para builds e permanece totalmente suportado (e usado por algumas ferramentas de documentacao).
- Bun nao pode usar `pnpm-lock.yaml` e ira ignora-lo.

## Instalacao

Padrao:

```sh
bun install
```

Observacao: `bun.lock`/`bun.lockb` estao no gitignore, entao nao ha alteracoes no repo de qualquer forma. Se voce quiser _nenhuma escrita de lockfile_:

```sh
bun install --no-save
```

## Build / Teste (Bun)

```sh
bun run build
bun run vitest run
```

## Scripts de ciclo de vida do Bun (bloqueados por padrao)

O Bun pode bloquear scripts de ciclo de vida de dependencias, a menos que sejam explicitamente confiaveis (`bun pm untrusted` / `bun pm trust`).
Para este repositorio, os scripts comumente bloqueados nao sao necessarios:

- `@whiskeysockets/baileys` `preinstall`: verifica Node major >= 20 (executamos Node 22+).
- `protobufjs` `postinstall`: emite avisos sobre esquemas de versao incompativeis (sem artefatos de build).

Se voce encontrar um problema real de runtime que exija esses scripts, confie neles explicitamente:

```sh
bun pm trust @whiskeysockets/baileys protobufjs
```

## Observacoes

- Alguns scripts ainda fixam pnpm (por exemplo, `docs:build`, `ui:*`, `protocol:check`). Execute esses via pnpm por enquanto.
