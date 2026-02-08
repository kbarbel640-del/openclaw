---
summary: "CLI de modelos: listar, definir, aliases, fallbacks, varredura, status"
read_when:
  - Adicionando ou modificando a CLI de modelos (models list/set/scan/aliases/fallbacks)
  - Alterando o comportamento de fallback de modelos ou a UX de seleção
  - Atualizando sondas de varredura de modelos (ferramentas/imagens)
title: "CLI de Modelos"
x-i18n:
  source_path: concepts/models.md
  source_hash: c4eeb0236c645b55
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:04Z
---

# CLI de Modelos

Veja [/concepts/model-failover](/concepts/model-failover) para rotação de perfis de auth,
cooldowns e como isso interage com fallbacks.
Visão geral rápida de provedores + exemplos: [/concepts/model-providers](/concepts/model-providers).

## Como funciona a seleção de modelos

O OpenClaw seleciona modelos nesta ordem:

1. **Primário** (`agents.defaults.model.primary` ou `agents.defaults.model`).
2. **Fallbacks** em `agents.defaults.model.fallbacks` (em ordem).
3. **Failover de auth do provedor** acontece dentro de um provedor antes de passar
   para o próximo modelo.

Relacionado:

- `agents.defaults.models` é a allowlist/catálogo de modelos que o OpenClaw pode usar (além de aliases).
- `agents.defaults.imageModel` é usado **somente quando** o modelo primário não aceita imagens.
- Padrões por agente podem sobrescrever `agents.defaults.model` via `agents.list[].model` mais bindings (veja [/concepts/multi-agent](/concepts/multi-agent)).

## Escolhas rápidas de modelos (anedótico)

- **GLM**: um pouco melhor para programação/chamada de ferramentas.
- **MiniMax**: melhor para escrita e vibes.

## Assistente de configuracao (recomendado)

Se voce não quiser editar a configuracao manualmente, execute o assistente de integracao inicial:

```bash
openclaw onboard
```

Ele pode configurar modelo + auth para provedores comuns, incluindo **OpenAI Code (Codex)
subscription** (OAuth) e **Anthropic** (API key recomendada; `claude
setup-token` também é suportado).

## Chaves de configuracao (visão geral)

- `agents.defaults.model.primary` e `agents.defaults.model.fallbacks`
- `agents.defaults.imageModel.primary` e `agents.defaults.imageModel.fallbacks`
- `agents.defaults.models` (allowlist + aliases + parametros de provedor)
- `models.providers` (provedores customizados escritos em `models.json`)

Referências de modelos são normalizadas para minúsculas. Aliases de provedor como `z.ai/*` são normalizados
para `zai/*`.

Exemplos de configuracao de provedores (incluindo OpenCode Zen) ficam em
[/gateway/configuration](/gateway/configuration#opencode-zen-multi-model-proxy).

## “Model is not allowed” (e por que as respostas param)

Se `agents.defaults.models` estiver definido, ele se torna a **allowlist** para `/model` e para
sobrescritas de sessao. Quando um usuario seleciona um modelo que não está nessa allowlist,
o OpenClaw retorna:

```
Model "provider/model" is not allowed. Use /model to list available models.
```

Isso acontece **antes** de uma resposta normal ser gerada, então a mensagem pode parecer
que “não respondeu”. A correção é:

- Adicionar o modelo a `agents.defaults.models`, ou
- Limpar a allowlist (remover `agents.defaults.models`), ou
- Escolher um modelo de `/model list`.

Exemplo de configuracao de allowlist:

```json5
{
  agent: {
    model: { primary: "anthropic/claude-sonnet-4-5" },
    models: {
      "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
      "anthropic/claude-opus-4-6": { alias: "Opus" },
    },
  },
}
```

## Alternando modelos no chat (`/model`)

Voce pode alternar modelos para a sessao atual sem reiniciar:

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model status
```

Notas:

- `/model` (e `/model list`) é um seletor compacto e numerado (familia do modelo + provedores disponíveis).
- `/model <#>` seleciona a partir desse seletor.
- `/model status` é a visualização detalhada (candidatos de auth e, quando configurado, endpoint do provedor `baseUrl` + modo `api`).
- Referências de modelos são analisadas dividindo no **primeiro** `/`. Use `provider/model` ao digitar `/model <ref>`.
- Se o ID do modelo em si contiver `/` (estilo OpenRouter), voce deve incluir o prefixo do provedor (exemplo: `/model openrouter/moonshotai/kimi-k2`).
- Se voce omitir o provedor, o OpenClaw trata a entrada como um alias ou um modelo para o **provedor padrão** (funciona apenas quando não há `/` no ID do modelo).

Comportamento/configuracao completa do comando: [Slash commands](/tools/slash-commands).

## Comandos da CLI

```bash
openclaw models list
openclaw models status
openclaw models set <provider/model>
openclaw models set-image <provider/model>

openclaw models aliases list
openclaw models aliases add <alias> <provider/model>
openclaw models aliases remove <alias>

openclaw models fallbacks list
openclaw models fallbacks add <provider/model>
openclaw models fallbacks remove <provider/model>
openclaw models fallbacks clear

openclaw models image-fallbacks list
openclaw models image-fallbacks add <provider/model>
openclaw models image-fallbacks remove <provider/model>
openclaw models image-fallbacks clear
```

`openclaw models` (sem subcomando) é um atalho para `models status`.

### `models list`

Mostra os modelos configurados por padrão. Flags úteis:

- `--all`: catálogo completo
- `--local`: apenas provedores locais
- `--provider <name>`: filtrar por provedor
- `--plain`: um modelo por linha
- `--json`: saída legível por máquina

### `models status`

Mostra o modelo primário resolvido, fallbacks, modelo de imagem e uma visão geral de auth
dos provedores configurados. Também expõe o status de expiração OAuth para perfis encontrados
no auth store (avisa dentro de 24h por padrão). `--plain` imprime apenas o
modelo primário resolvido.
O status OAuth é sempre mostrado (e incluído na saída de `--json`). Se um provedor configurado
não tiver credenciais, `models status` imprime uma seção **Missing auth**.
JSON inclui `auth.oauth` (janela de aviso + perfis) e `auth.providers`
(auth efetivo por provedor).
Use `--check` para automacao (exit `1` quando ausente/expirado, `2` quando expirando).

Auth Anthropic preferida é o setup-token da Claude Code CLI (execute em qualquer lugar; cole no host do gateway se necessário):

```bash
claude setup-token
openclaw models status
```

## Varredura (modelos gratuitos do OpenRouter)

`openclaw models scan` inspeciona o **catálogo de modelos gratuitos** do OpenRouter e pode
opcionalmente sondar modelos para suporte a ferramentas e imagens.

Principais flags:

- `--no-probe`: pular sondas ao vivo (apenas metadados)
- `--min-params <b>`: tamanho mínimo de parametros (bilhões)
- `--max-age-days <days>`: pular modelos mais antigos
- `--provider <name>`: filtro de prefixo de provedor
- `--max-candidates <n>`: tamanho da lista de fallbacks
- `--set-default`: definir `agents.defaults.model.primary` para a primeira seleção
- `--set-image`: definir `agents.defaults.imageModel.primary` para a primeira seleção de imagem

A sondagem requer uma API key do OpenRouter (dos perfis de auth ou
`OPENROUTER_API_KEY`). Sem uma key, use `--no-probe` para listar apenas candidatos.

Os resultados da varredura são ranqueados por:

1. Suporte a imagens
2. Latência de ferramentas
3. Tamanho de contexto
4. Contagem de parametros

Entrada

- Lista `/models` do OpenRouter (filtro `:free`)
- Requer API key do OpenRouter dos perfis de auth ou `OPENROUTER_API_KEY` (veja [/environment](/environment))
- Filtros opcionais: `--max-age-days`, `--min-params`, `--provider`, `--max-candidates`
- Controles de sonda: `--timeout`, `--concurrency`

Quando executado em um TTY, voce pode selecionar fallbacks interativamente. Em modo não interativo,
passe `--yes` para aceitar os padrões.

## Registro de modelos (`models.json`)

Provedores customizados em `models.providers` são escritos em `models.json` sob o
diretorio do agente (padrão `~/.openclaw/agents/<agentId>/models.json`). Este arquivo
é mesclado por padrão, a menos que `models.mode` esteja definido como `replace`.
