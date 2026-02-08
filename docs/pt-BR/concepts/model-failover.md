---
summary: "Como o OpenClaw faz a rotacao de perfis de autenticacao e o fallback entre modelos"
read_when:
  - Diagnosticando rotacao de perfis de autenticacao, cooldowns ou comportamento de fallback de modelos
  - Atualizando regras de failover para perfis de autenticacao ou modelos
title: "Failover de modelo"
x-i18n:
  source_path: concepts/model-failover.md
  source_hash: eab7c0633824d941
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:58Z
---

# Failover de modelo

O OpenClaw lida com falhas em duas etapas:

1. **Rotacao de perfil de autenticacao** dentro do provedor atual.
2. **Fallback de modelo** para o proximo modelo em `agents.defaults.model.fallbacks`.

Este documento explica as regras de runtime e os dados que as sustentam.

## Armazenamento de autenticacao (chaves + OAuth)

O OpenClaw usa **perfis de autenticacao** tanto para chaves de API quanto para tokens OAuth.

- Segredos ficam em `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` (legado: `~/.openclaw/agent/auth-profiles.json`).
- Configuracoes `auth.profiles` / `auth.order` sao apenas **metadados + roteamento** (sem segredos).
- Arquivo OAuth legado apenas para importacao: `~/.openclaw/credentials/oauth.json` (importado para `auth-profiles.json` no primeiro uso).

Mais detalhes: [/concepts/oauth](/concepts/oauth)

Tipos de credenciais:

- `type: "api_key"` → `{ provider, key }`
- `type: "oauth"` → `{ provider, access, refresh, expires, email? }` (+ `projectId`/`enterpriseUrl` para alguns provedores)

## IDs de perfil

Logins OAuth criam perfis distintos para que varias contas possam coexistir.

- Padrao: `provider:default` quando nenhum email esta disponivel.
- OAuth com email: `provider:<email>` (por exemplo `google-antigravity:user@gmail.com`).

Os perfis ficam em `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` sob `profiles`.

## Ordem de rotacao

Quando um provedor tem varios perfis, o OpenClaw escolhe uma ordem assim:

1. **Configuracao explicita**: `auth.order[provider]` (se definida).
2. **Perfis configurados**: `auth.profiles` filtrados por provedor.
3. **Perfis armazenados**: entradas em `auth-profiles.json` para o provedor.

Se nenhuma ordem explicita for configurada, o OpenClaw usa uma ordem round‑robin:

- **Chave primaria:** tipo de perfil (**OAuth antes de chaves de API**).
- **Chave secundaria:** `usageStats.lastUsed` (mais antigo primeiro, dentro de cada tipo).
- **Perfis em cooldown/desativados** sao movidos para o final, ordenados pelo vencimento mais proximo.

### Afinidade de sessao (amigavel ao cache)

O OpenClaw **fixa o perfil de autenticacao escolhido por sessao** para manter os caches do provedor aquecidos.
Ele **nao** rotaciona a cada requisicao. O perfil fixado e reutilizado ate que:

- a sessao seja redefinida (`/new` / `/reset`)
- uma compactacao seja concluida (o contador de compactacao incrementa)
- o perfil entre em cooldown/seja desativado

A selecao manual via `/model …@<profileId>` define uma **substituicao do usuario** para aquela sessao
e nao e rotacionada automaticamente ate que uma nova sessao comece.

Perfis fixados automaticamente (selecionados pelo roteador de sessao) sao tratados como uma **preferencia**:
eles sao tentados primeiro, mas o OpenClaw pode rotacionar para outro perfil em limites de taxa/timeouts.
Perfis fixados pelo usuario permanecem travados nesse perfil; se ele falhar e houver fallbacks de modelo
configurados, o OpenClaw avanca para o proximo modelo em vez de trocar de perfil.

### Por que o OAuth pode “parecer perdido”

Se voce tiver tanto um perfil OAuth quanto um perfil de chave de API para o mesmo provedor, o round‑robin pode alternar entre eles entre mensagens, a menos que estejam fixados. Para forcar um unico perfil:

- Fixe com `auth.order[provider] = ["provider:profileId"]`, ou
- Use uma substituicao por sessao via `/model …` com uma substituicao de perfil (quando suportado pela sua UI/superficie de chat).

## Cooldowns

Quando um perfil falha por erros de autenticacao/limite de taxa (ou um timeout que pareca
limitacao de taxa), o OpenClaw o marca em cooldown e avanca para o proximo perfil.
Erros de formato/requisicao invalida (por exemplo falhas de validacao de ID de chamada de ferramenta
do Cloud Code Assist) sao tratados como dignos de failover e usam os mesmos cooldowns.

Os cooldowns usam backoff exponencial:

- 1 minuto
- 5 minutos
- 25 minutos
- 1 hora (limite)

O estado e armazenado em `auth-profiles.json` sob `usageStats`:

```json
{
  "usageStats": {
    "provider:profile": {
      "lastUsed": 1736160000000,
      "cooldownUntil": 1736160600000,
      "errorCount": 2
    }
  }
}
```

## Desativacoes por cobranca

Falhas de cobranca/credito (por exemplo “creditos insuficientes” / “saldo de credito muito baixo”) sao tratadas como dignas de failover, mas geralmente nao sao transitorias. Em vez de um cooldown curto, o OpenClaw marca o perfil como **desativado** (com um backoff mais longo) e rotaciona para o proximo perfil/provedor.

O estado e armazenado em `auth-profiles.json`:

```json
{
  "usageStats": {
    "provider:profile": {
      "disabledUntil": 1736178000000,
      "disabledReason": "billing"
    }
  }
}
```

Padroes:

- O backoff de cobranca comeca em **5 horas**, dobra a cada falha de cobranca e limita em **24 horas**.
- Contadores de backoff sao redefinidos se o perfil nao tiver falhado por **24 horas** (configuravel).

## Fallback de modelo

Se todos os perfis de um provedor falharem, o OpenClaw avanca para o proximo modelo em
`agents.defaults.model.fallbacks`. Isso se aplica a falhas de autenticacao, limites de taxa e
timeouts que esgotaram a rotacao de perfis (outros erros nao avancam o fallback).

Quando uma execucao comeca com uma substituicao de modelo (hooks ou CLI), os fallbacks ainda terminam em
`agents.defaults.model.primary` apos tentar quaisquer fallbacks configurados.

## Configuracao relacionada

Veja [Configuracao do Gateway](/gateway/configuration) para:

- `auth.profiles` / `auth.order`
- `auth.cooldowns.billingBackoffHours` / `auth.cooldowns.billingBackoffHoursByProvider`
- `auth.cooldowns.billingMaxHours` / `auth.cooldowns.failureWindowHours`
- `agents.defaults.model.primary` / `agents.defaults.model.fallbacks`
- roteamento `agents.defaults.imageModel`

Veja [Modelos](/concepts/models) para a visao geral mais ampla de selecao de modelos e fallback.
