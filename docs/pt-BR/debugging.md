---
summary: "Ferramentas de depuracao: modo watch, streams brutos do modelo e rastreamento de vazamento de raciocinio"
read_when:
  - Voce precisa inspecionar a saida bruta do modelo para vazamento de raciocinio
  - Voce quer executar o Gateway em modo watch enquanto itera
  - Voce precisa de um fluxo de depuracao repetivel
title: "Depuracao"
x-i18n:
  source_path: debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:12Z
---

# Depuracao

Esta pagina cobre auxiliares de depuracao para saida em streaming, especialmente quando um
provedor mistura raciocinio no texto normal.

## Substituicoes de depuracao em tempo de execucao

Use `/debug` no chat para definir substituicoes de configuracao **apenas em tempo de execucao** (memoria, nao disco).
`/debug` vem desativado por padrao; ative com `commands.debug: true`.
Isso e util quando voce precisa alternar configuracoes obscuras sem editar `openclaw.json`.

Exemplos:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` limpa todas as substituicoes e retorna a configuracao em disco.

## Modo watch do Gateway

Para iteracao rapida, execute o gateway sob o observador de arquivos:

```bash
pnpm gateway:watch --force
```

Isso mapeia para:

```bash
tsx watch src/entry.ts gateway --force
```

Adicione quaisquer flags de CLI do gateway apos `gateway:watch` e elas serao repassadas
em cada reinicio.

## Perfil dev + gateway dev (--dev)

Use o perfil dev para isolar o estado e subir uma configuracao segura e descartavel para
depuracao. Existem **duas** flags `--dev`:

- **`--dev` global (perfil):** isola o estado em `~/.openclaw-dev` e
  define a porta do gateway como `19001` (portas derivadas mudam junto).
- **`gateway --dev`: informa ao Gateway para criar automaticamente uma configuracao padrao +
  workspace** quando ausente (e pular BOOTSTRAP.md).

Fluxo recomendado (perfil dev + bootstrap dev):

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

Se voce ainda nao tem uma instalacao global, execute a CLI via `pnpm openclaw ...`.

O que isso faz:

1. **Isolamento de perfil** (`--dev` global)
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001` (browser/canvas mudam de acordo)

2. **Bootstrap dev** (`gateway --dev`)
   - Grava uma configuracao minima se estiver ausente (`gateway.mode=local`, bind local loopback).
   - Define `agent.workspace` para o workspace dev.
   - Define `agent.skipBootstrap=true` (sem BOOTSTRAP.md).
   - Preenche os arquivos do workspace se estiverem ausentes:
     `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`.
   - Identidade padrao: **C3‑PO** (droide de protocolo).
   - Pula provedores de canal em modo dev (`OPENCLAW_SKIP_CHANNELS=1`).

Fluxo de reset (inicio limpo):

```bash
pnpm gateway:dev:reset
```

Observacao: `--dev` e uma flag de perfil **global** e e consumida por alguns runners.
Se voce precisar explicitar, use a forma de variavel de ambiente:

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` apaga configuracao, credenciais, sessoes e o workspace dev (usando
`trash`, nao `rm`), e entao recria a configuracao dev padrao.

Dica: se um gateway nao‑dev ja estiver em execucao (launchd/systemd), pare-o primeiro:

```bash
openclaw gateway stop
```

## Registro de stream bruto (OpenClaw)

O OpenClaw pode registrar o **stream bruto do assistente** antes de qualquer filtragem/formatacao.
Esta e a melhor forma de ver se o raciocinio esta chegando como deltas de texto simples
(ou como blocos de pensamento separados).

Ative via CLI:

```bash
pnpm gateway:watch --force --raw-stream
```

Substituicao opcional de caminho:

```bash
pnpm gateway:watch --force --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl
```

Variaveis de ambiente equivalentes:

```bash
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=~/.openclaw/logs/raw-stream.jsonl
```

Arquivo padrao:

`~/.openclaw/logs/raw-stream.jsonl`

## Registro de chunks brutos (pi-mono)

Para capturar **chunks brutos compatíveis com OpenAI** antes de serem analisados em blocos,
o pi-mono expõe um logger separado:

```bash
PI_RAW_STREAM=1
```

Caminho opcional:

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

Arquivo padrao:

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> Observacao: isso so e emitido por processos que usam o provedor
> `openai-completions` do pi-mono.

## Notas de seguranca

- Logs de stream bruto podem incluir prompts completos, saida de ferramentas e dados do usuario.
- Mantenha os logs locais e exclua-os apos a depuracao.
- Se voce compartilhar logs, remova segredos e PII antes.
