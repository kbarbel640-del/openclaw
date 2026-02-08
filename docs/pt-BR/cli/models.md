---
summary: "Referencia da CLI para `openclaw models` (status/list/set/scan, aliases, fallbacks, auth)"
read_when:
  - Voce quer alterar modelos padrao ou ver o status de autenticacao do provedor
  - Voce quer escanear modelos/provedores disponiveis e depurar perfis de autenticacao
title: "models"
x-i18n:
  source_path: cli/models.md
  source_hash: 923b6ffc7de382ba
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:41Z
---

# `openclaw models`

Descoberta de modelos, varredura e configuracao (modelo padrao, fallbacks, perfis de autenticacao).

Relacionado:

- Provedores + modelos: [Models](/providers/models)
- Configuracao de autenticacao do provedor: [Primeiros Passos](/start/getting-started)

## Comandos comuns

```bash
openclaw models status
openclaw models list
openclaw models set <model-or-alias>
openclaw models scan
```

`openclaw models status` mostra o padrao/fallbacks resolvidos, alem de uma visao geral de autenticacao.
Quando instantaneos de uso do provedor estao disponiveis, a secao de status de OAuth/token inclui
cabecalhos de uso do provedor.
Adicione `--probe` para executar sondagens de autenticacao ao vivo contra cada perfil de provedor configurado.
As sondagens sao requisicoes reais (podem consumir tokens e acionar limites de taxa).
Use `--agent <id>` para inspecionar o estado de modelo/autenticacao de um agente configurado. Quando omitido,
o comando usa `OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR` se estiverem definidos; caso contrario, o
agente padrao configurado.

Notas:

- `models set <model-or-alias>` aceita `provider/model` ou um alias.
- Referencias de modelo sao analisadas dividindo pelo **primeiro** `/`. Se o ID do modelo incluir `/` (estilo OpenRouter), inclua o prefixo do provedor (exemplo: `openrouter/moonshotai/kimi-k2`).
- Se voce omitir o provedor, o OpenClaw trata a entrada como um alias ou um modelo para o **provedor padrao** (so funciona quando nao ha `/` no ID do modelo).

### `models status`

Opcoes:

- `--json`
- `--plain`
- `--check` (saida 1=expirado/ausente, 2=expirando)
- `--probe` (sondagem ao vivo dos perfis de autenticacao configurados)
- `--probe-provider <name>` (sondar um provedor)
- `--probe-profile <id>` (repetir ou IDs de perfil separados por virgula)
- `--probe-timeout <ms>`
- `--probe-concurrency <n>`
- `--probe-max-tokens <n>`
- `--agent <id>` (ID do agente configurado; substitui `OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR`)

## Aliases + fallbacks

```bash
openclaw models aliases list
openclaw models fallbacks list
```

## Perfis de autenticacao

```bash
openclaw models auth add
openclaw models auth login --provider <id>
openclaw models auth setup-token
openclaw models auth paste-token
```

`models auth login` executa o fluxo de autenticacao de um plugin de provedor (OAuth/chave de API). Use
`openclaw plugins list` para ver quais provedores estao instalados.

Notas:

- `setup-token` solicita um valor de token de configuracao (gere-o com `claude setup-token` em qualquer maquina).
- `paste-token` aceita uma string de token gerada em outro lugar ou a partir de automacao.
