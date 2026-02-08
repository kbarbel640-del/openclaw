---
summary: "Execute a ponte ACP para integrações com IDE"
read_when:
  - Configurando integrações de IDE baseadas em ACP
  - Depurando o roteamento de sessoes ACP para o Gateway
title: "acp"
x-i18n:
  source_path: cli/acp.md
  source_hash: 0c09844297da250b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:29Z
---

# acp

Execute a ponte ACP (Agent Client Protocol) que se comunica com um OpenClaw Gateway.

Este comando fala ACP via stdio para IDEs e encaminha prompts para o Gateway
via WebSocket. Ele mantém as sessoes ACP mapeadas para chaves de sessao do Gateway.

## Usage

```bash
openclaw acp

# Remote Gateway
openclaw acp --url wss://gateway-host:18789 --token <token>

# Attach to an existing session key
openclaw acp --session agent:main:main

# Attach by label (must already exist)
openclaw acp --session-label "support inbox"

# Reset the session key before the first prompt
openclaw acp --session agent:main:main --reset-session
```

## ACP client (debug)

Use o cliente ACP integrado para validar rapidamente a ponte sem um IDE.
Ele inicia a ponte ACP e permite que voce digite prompts de forma interativa.

```bash
openclaw acp client

# Point the spawned bridge at a remote Gateway
openclaw acp client --server-args --url wss://gateway-host:18789 --token <token>

# Override the server command (default: openclaw)
openclaw acp client --server "node" --server-args openclaw.mjs acp --url ws://127.0.0.1:19001
```

## How to use this

Use ACP quando um IDE (ou outro cliente) fala Agent Client Protocol e voce quer
que ele conduza uma sessao do OpenClaw Gateway.

1. Garanta que o Gateway esteja em execucao (local ou remoto).
2. Configure o destino do Gateway (configuracao ou flags).
3. Aponte seu IDE para executar `openclaw acp` via stdio.

Exemplo de configuracao (persistida):

```bash
openclaw config set gateway.remote.url wss://gateway-host:18789
openclaw config set gateway.remote.token <token>
```

Exemplo de execucao direta (sem gravar configuracao):

```bash
openclaw acp --url wss://gateway-host:18789 --token <token>
```

## Selecting agents

O ACP nao seleciona agentes diretamente. Ele roteia pela chave de sessao do Gateway.

Use chaves de sessao com escopo de agente para direcionar a um agente especifico:

```bash
openclaw acp --session agent:main:main
openclaw acp --session agent:design:main
openclaw acp --session agent:qa:bug-123
```

Cada sessao ACP mapeia para uma unica chave de sessao do Gateway. Um agente pode ter muitas
sessoes; o ACP padrao cria uma sessao `acp:<uuid>` isolada, a menos que voce sobrescreva
a chave ou o rótulo.

## Zed editor setup

Adicione um agente ACP personalizado em `~/.config/zed/settings.json` (ou use a interface de Configuracoes do Zed):

```json
{
  "agent_servers": {
    "OpenClaw ACP": {
      "type": "custom",
      "command": "openclaw",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

Para direcionar a um Gateway ou agente especifico:

```json
{
  "agent_servers": {
    "OpenClaw ACP": {
      "type": "custom",
      "command": "openclaw",
      "args": [
        "acp",
        "--url",
        "wss://gateway-host:18789",
        "--token",
        "<token>",
        "--session",
        "agent:design:main"
      ],
      "env": {}
    }
  }
}
```

No Zed, abra o painel Agent e selecione “OpenClaw ACP” para iniciar uma conversa.

## Session mapping

Por padrao, as sessoes ACP recebem uma chave de sessao do Gateway isolada com o prefixo `acp:`.
Para reutilizar uma sessao conhecida, passe uma chave de sessao ou um rótulo:

- `--session <key>`: use uma chave de sessao do Gateway especifica.
- `--session-label <label>`: resolva uma sessao existente por rótulo.
- `--reset-session`: gere um novo id de sessao para essa chave (mesma chave, novo historico).

Se o seu cliente ACP suportar metadados, voce pode sobrescrever por sessao:

```json
{
  "_meta": {
    "sessionKey": "agent:main:main",
    "sessionLabel": "support inbox",
    "resetSession": true
  }
}
```

Saiba mais sobre chaves de sessao em [/concepts/session](/concepts/session).

## Options

- `--url <url>`: URL do WebSocket do Gateway (padrao: gateway.remote.url quando configurado).
- `--token <token>`: token de autenticacao do Gateway.
- `--password <password>`: senha de autenticacao do Gateway.
- `--session <key>`: chave de sessao padrao.
- `--session-label <label>`: rótulo de sessao padrao para resolver.
- `--require-existing`: falhar se a chave/rótulo de sessao nao existir.
- `--reset-session`: redefinir a chave de sessao antes do primeiro uso.
- `--no-prefix-cwd`: nao prefixar prompts com o diretorio de trabalho.
- `--verbose, -v`: logging detalhado para stderr.

### `acp client` options

- `--cwd <dir>`: diretorio de trabalho para a sessao ACP.
- `--server <command>`: comando do servidor ACP (padrao: `openclaw`).
- `--server-args <args...>`: argumentos extras passados ao servidor ACP.
- `--server-verbose`: habilitar logging detalhado no servidor ACP.
- `--verbose, -v`: logging detalhado do cliente.
