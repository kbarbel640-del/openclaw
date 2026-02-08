---
title: CLI de Sandbox
summary: "Gerencie containers de sandbox e inspecione a politica efetiva de sandbox"
read_when: "Voce esta gerenciando containers de sandbox ou depurando o comportamento de sandbox/politica de ferramentas."
status: active
x-i18n:
  source_path: cli/sandbox.md
  source_hash: 6e1186f26c77e188
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:43Z
---

# CLI de Sandbox

Gerencie containers de sandbox baseados em Docker para execucao isolada de agentes.

## Visao geral

O OpenClaw pode executar agentes em containers Docker isolados para seguranca. Os comandos `sandbox` ajudam voce a gerenciar esses containers, especialmente apos atualizacoes ou mudancas de configuracao.

## Comandos

### `openclaw sandbox explain`

Inspecione o modo/escopo/acesso ao workspace **efetivos** do sandbox, a politica de ferramentas do sandbox e os gates elevados (com caminhos de chaves de configuracao para correcoes).

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

### `openclaw sandbox list`

Liste todos os containers de sandbox com seu status e configuracao.

```bash
openclaw sandbox list
openclaw sandbox list --browser  # List only browser containers
openclaw sandbox list --json     # JSON output
```

**A saida inclui:**

- Nome do container e status (em execucao/parado)
- Imagem Docker e se corresponde a configuracao
- Idade (tempo desde a criacao)
- Tempo ocioso (tempo desde o ultimo uso)
- Sessao/agente associado

### `openclaw sandbox recreate`

Remova containers de sandbox para forcar a recriacao com imagens/configuracoes atualizadas.

```bash
openclaw sandbox recreate --all                # Recreate all containers
openclaw sandbox recreate --session main       # Specific session
openclaw sandbox recreate --agent mybot        # Specific agent
openclaw sandbox recreate --browser            # Only browser containers
openclaw sandbox recreate --all --force        # Skip confirmation
```

**Opcoes:**

- `--all`: Recriar todos os containers de sandbox
- `--session <key>`: Recriar container para uma sessao especifica
- `--agent <id>`: Recriar containers para um agente especifico
- `--browser`: Recriar apenas containers de navegador
- `--force`: Pular confirmacao

**Importante:** Os containers sao recriados automaticamente quando o agente for usado novamente.

## Casos de uso

### Apos atualizar imagens Docker

```bash
# Pull new image
docker pull openclaw-sandbox:latest
docker tag openclaw-sandbox:latest openclaw-sandbox:bookworm-slim

# Update config to use new image
# Edit config: agents.defaults.sandbox.docker.image (or agents.list[].sandbox.docker.image)

# Recreate containers
openclaw sandbox recreate --all
```

### Apos alterar a configuracao de sandbox

```bash
# Edit config: agents.defaults.sandbox.* (or agents.list[].sandbox.*)

# Recreate to apply new config
openclaw sandbox recreate --all
```

### Apos alterar o setupCommand

```bash
openclaw sandbox recreate --all
# or just one agent:
openclaw sandbox recreate --agent family
```

### Para apenas um agente especifico

```bash
# Update only one agent's containers
openclaw sandbox recreate --agent alfred
```

## Por que isso e necessario?

**Problema:** Quando voce atualiza imagens Docker de sandbox ou a configuracao:

- Containers existentes continuam em execucao com configuracoes antigas
- Containers so sao removidos apos 24h de inatividade
- Agentes usados regularmente mantem containers antigos em execucao indefinidamente

**Solucao:** Use `openclaw sandbox recreate` para forcar a remocao de containers antigos. Eles serao recriados automaticamente com as configuracoes atuais quando forem necessarios novamente.

Dica: prefira `openclaw sandbox recreate` em vez de `docker rm` manual. Ele usa a nomeacao de containers do Gateway e evita inconsistencias quando chaves de escopo/sessao mudam.

## Configuracao

As configuracoes de sandbox ficam em `~/.openclaw/openclaw.json` sob `agents.defaults.sandbox` (substituicoes por agente ficam em `agents.list[].sandbox`):

```jsonc
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all", // off, non-main, all
        "scope": "agent", // session, agent, shared
        "docker": {
          "image": "openclaw-sandbox:bookworm-slim",
          "containerPrefix": "openclaw-sbx-",
          // ... more Docker options
        },
        "prune": {
          "idleHours": 24, // Auto-prune after 24h idle
          "maxAgeDays": 7, // Auto-prune after 7 days
        },
      },
    },
  },
}
```

## Veja tambem

- [Documentacao de Sandbox](/gateway/sandboxing)
- [Configuracao de Agente](/concepts/agent-workspace)
- [Comando Doctor](/gateway/doctor) - Verifique a configuracao de sandbox
