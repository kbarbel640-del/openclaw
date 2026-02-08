---
summary: "Use o Anthropic Claude por meio de chaves de API ou setup-token no OpenClaw"
read_when:
  - Voce quer usar modelos Anthropic no OpenClaw
  - Voce quer setup-token em vez de chaves de API
title: "Anthropic"
x-i18n:
  source_path: providers/anthropic.md
  source_hash: 5e50b3bca35be37e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:06Z
---

# Anthropic (Claude)

A Anthropic desenvolve a familia de modelos **Claude** e fornece acesso por meio de uma API.
No OpenClaw, voce pode se autenticar com uma chave de API ou um **setup-token**.

## Opcao A: Chave de API da Anthropic

**Melhor para:** acesso padrao a API e cobranca por uso.
Crie sua chave de API no Console da Anthropic.

### Configuracao via CLI

```bash
openclaw onboard
# choose: Anthropic API key

# or non-interactive
openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY"
```

### Trecho de configuracao

```json5
{
  env: { ANTHROPIC_API_KEY: "sk-ant-..." },
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Cache de prompt (API da Anthropic)

O OpenClaw oferece suporte ao recurso de cache de prompt da Anthropic. Isso e **somente para API**; a autenticacao por assinatura nao respeita as configuracoes de cache.

### Configuracao

Use o parametro `cacheRetention` na configuracao do seu modelo:

| Valor   | Duracao do cache | Descricao                                 |
| ------- | ---------------- | ----------------------------------------- |
| `none`  | Sem cache        | Desativar cache de prompt                 |
| `short` | 5 minutos        | Padrao para autenticacao por chave de API |
| `long`  | 1 hora           | Cache estendido (requer flag beta)        |

```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": {
          params: { cacheRetention: "long" },
        },
      },
    },
  },
}
```

### Padroes

Ao usar autenticacao por chave de API da Anthropic, o OpenClaw aplica automaticamente `cacheRetention: "short"` (cache de 5 minutos) para todos os modelos Anthropic. Voce pode sobrescrever isso definindo explicitamente `cacheRetention` na sua configuracao.

### Parametro legado

O parametro antigo `cacheControlTtl` ainda e suportado para compatibilidade retroativa:

- `"5m"` mapeia para `short`
- `"1h"` mapeia para `long`

Recomendamos migrar para o novo parametro `cacheRetention`.

O OpenClaw inclui a flag beta `extended-cache-ttl-2025-04-11` para requisicoes da API da Anthropic;
mantenha-a se voce sobrescrever os cabecalhos do provedor (veja [/gateway/configuration](/gateway/configuration)).

## Opcao B: Claude setup-token

**Melhor para:** usar sua assinatura do Claude.

### Onde obter um setup-token

Os setup-tokens sao criados pelo **Claude Code CLI**, nao pelo Console da Anthropic. Voce pode executa-lo em **qualquer maquina**:

```bash
claude setup-token
```

Cole o token no OpenClaw (assistente: **Anthropic token (cole o setup-token)**) ou execute no host do gateway:

```bash
openclaw models auth setup-token --provider anthropic
```

Se voce gerou o token em uma maquina diferente, cole-o:

```bash
openclaw models auth paste-token --provider anthropic
```

### Configuracao via CLI

```bash
# Paste a setup-token during onboarding
openclaw onboard --auth-choice setup-token
```

### Trecho de configuracao

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## Observacoes

- Gere o setup-token com `claude setup-token` e cole-o, ou execute `openclaw models auth setup-token` no host do gateway.
- Se voce vir “OAuth token refresh failed …” em uma assinatura do Claude, reautentique com um setup-token. Veja [/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription](/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription).
- Detalhes de autenticacao + regras de reutilizacao estao em [/concepts/oauth](/concepts/oauth).

## Solucao de problemas

**Erros 401 / token subitamente invalido**

- A autenticacao da assinatura do Claude pode expirar ou ser revogada. Execute novamente `claude setup-token`
  e cole-o no **host do gateway**.
- Se o login do Claude CLI estiver em uma maquina diferente, use
  `openclaw models auth paste-token --provider anthropic` no host do gateway.

**Nenhuma chave de API encontrada para o provedor "anthropic"**

- A autenticacao e **por agente**. Novos agentes nao herdam as chaves do agente principal.
- Execute novamente a integracao inicial para esse agente, ou cole um setup-token / chave de API no
  host do gateway e, em seguida, verifique com `openclaw models status`.

**Nenhuma credencial encontrada para o perfil `anthropic:default`**

- Execute `openclaw models status` para ver qual perfil de autenticacao esta ativo.
- Execute novamente a integracao inicial ou cole um setup-token / chave de API para esse perfil.

**Nenhum perfil de autenticacao disponivel (todos em cooldown/indisponiveis)**

- Verifique `openclaw models status --json` para `auth.unusableProfiles`.
- Adicione outro perfil Anthropic ou aguarde o cooldown.

Mais: [/gateway/troubleshooting](/gateway/troubleshooting) e [/help/faq](/help/faq).
