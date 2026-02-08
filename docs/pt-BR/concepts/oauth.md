---
summary: "OAuth no OpenClaw: troca de tokens, armazenamento e padrões de múltiplas contas"
read_when:
  - Voce quer entender o OAuth do OpenClaw de ponta a ponta
  - Voce encontrou problemas de invalidação de token / logout
  - Voce quer fluxos setup-token ou de autenticação OAuth
  - Voce quer múltiplas contas ou roteamento por perfil
title: "OAuth"
x-i18n:
  source_path: concepts/oauth.md
  source_hash: af714bdadc4a8929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:57Z
---

# OAuth

O OpenClaw oferece suporte a “autenticação por assinatura” via OAuth para provedores que a disponibilizam (notavelmente **OpenAI Codex (ChatGPT OAuth)**). Para assinaturas da Anthropic, use o fluxo **setup-token**. Esta página explica:

- como funciona a **troca de tokens** OAuth (PKCE)
- onde os tokens são **armazenados** (e por quê)
- como lidar com **múltiplas contas** (perfis + substituições por sessão)

O OpenClaw também oferece suporte a **plugins de provedores** que incluem seus próprios fluxos de OAuth ou de chave de API. Execute-os via:

```bash
openclaw models auth login --provider <id>
```

## O token sink (por que ele existe)

Provedores OAuth geralmente geram um **novo refresh token** durante fluxos de login/atualização. Alguns provedores (ou clientes OAuth) podem invalidar refresh tokens mais antigos quando um novo é emitido para o mesmo usuário/app.

Sintoma prático:

- voce faz login via OpenClaw _e_ via Claude Code / Codex CLI → um deles acaba sendo “deslogado” aleatoriamente depois

Para reduzir isso, o OpenClaw trata `auth-profiles.json` como um **token sink**:

- o runtime lê credenciais de **um único lugar**
- podemos manter múltiplos perfis e roteá-los de forma determinística

## Armazenamento (onde os tokens ficam)

Segredos são armazenados **por agente**:

- Perfis de autenticação (OAuth + chaves de API): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- Cache de runtime (gerenciado automaticamente; não edite): `~/.openclaw/agents/<agentId>/agent/auth.json`

Arquivo legado apenas para importação (ainda suportado, mas não é o armazenamento principal):

- `~/.openclaw/credentials/oauth.json` (importado para `auth-profiles.json` no primeiro uso)

Todos os itens acima também respeitam `$OPENCLAW_STATE_DIR` (override do diretório de estado). Referência completa: [/gateway/configuration](/gateway/configuration#auth-storage-oauth--api-keys)

## Anthropic setup-token (autenticação por assinatura)

Execute `claude setup-token` em qualquer máquina e depois cole no OpenClaw:

```bash
openclaw models auth setup-token --provider anthropic
```

Se voce gerou o token em outro lugar, cole manualmente:

```bash
openclaw models auth paste-token --provider anthropic
```

Verifique:

```bash
openclaw models status
```

## Troca OAuth (como o login funciona)

Os fluxos interativos de login do OpenClaw são implementados em `@mariozechner/pi-ai` e conectados aos assistentes/comandos.

### Anthropic (Claude Pro/Max) setup-token

Formato do fluxo:

1. execute `claude setup-token`
2. cole o token no OpenClaw
3. armazene como um perfil de autenticação por token (sem refresh)

O caminho no assistente é `openclaw onboard` → escolha de autenticação `setup-token` (Anthropic).

### OpenAI Codex (ChatGPT OAuth)

Formato do fluxo (PKCE):

1. gere verificador/desafio PKCE + `state` aleatório
2. abra `https://auth.openai.com/oauth/authorize?...`
3. tente capturar o callback em `http://127.0.0.1:1455/auth/callback`
4. se o callback não conseguir se vincular (ou voce estiver remoto/headless), cole a URL/código de redirecionamento
5. troque em `https://auth.openai.com/oauth/token`
6. extraia `accountId` do access token e armazene `{ access, refresh, expires, accountId }`

O caminho no assistente é `openclaw onboard` → escolha de autenticação `openai-codex`.

## Refresh + expiração

Os perfis armazenam um timestamp `expires`.

Em runtime:

- se `expires` estiver no futuro → use o access token armazenado
- se estiver expirado → faça refresh (sob um lock de arquivo) e sobrescreva as credenciais armazenadas

O fluxo de refresh é automático; em geral voce não precisa gerenciar tokens manualmente.

## Múltiplas contas (perfis) + roteamento

Dois padrões:

### 1) Preferido: agentes separados

Se voce quer que “pessoal” e “trabalho” nunca interajam, use agentes isolados (sessões + credenciais + workspace separados):

```bash
openclaw agents add work
openclaw agents add personal
```

Em seguida, configure a autenticação por agente (assistente) e direcione os chats para o agente correto.

### 2) Avançado: múltiplos perfis em um agente

`auth-profiles.json` oferece suporte a múltiplos IDs de perfil para o mesmo provedor.

Escolha qual perfil é usado:

- globalmente via ordenação de configuração (`auth.order`)
- por sessão via `/model ...@<profileId>`

Exemplo (substituição por sessão):

- `/model Opus@anthropic:work`

Como ver quais IDs de perfil existem:

- `openclaw channels list --json` (mostra `auth[]`)

Docs relacionados:

- [/concepts/model-failover](/concepts/model-failover) (regras de rotação + cooldown)
- [/tools/slash-commands](/tools/slash-commands) (superfície de comandos)
