---
summary: "Configuracao e configuracao do bot de chat do Twitch"
read_when:
  - Configurando a integracao de chat do Twitch para o OpenClaw
title: "Twitch"
x-i18n:
  source_path: channels/twitch.md
  source_hash: 0dd1c05bef570470
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:35Z
---

# Twitch (plugin)

Suporte a chat do Twitch via conexao IRC. O OpenClaw se conecta como um usuario do Twitch (conta de bot) para receber e enviar mensagens em canais.

## Plugin necessario

O Twitch e distribuido como um plugin e nao vem incluído na instalacao principal.

Instale via CLI (registro npm):

```bash
openclaw plugins install @openclaw/twitch
```

Checkout local (ao executar a partir de um repo git):

```bash
openclaw plugins install ./extensions/twitch
```

Detalhes: [Plugins](/plugin)

## Configuracao rapida (iniciante)

1. Crie uma conta dedicada do Twitch para o bot (ou use uma conta existente).
2. Gere credenciais: [Twitch Token Generator](https://twitchtokengenerator.com/)
   - Selecione **Bot Token**
   - Verifique se os escopos `chat:read` e `chat:write` estao selecionados
   - Copie o **Client ID** e o **Access Token**
3. Encontre seu ID de usuario do Twitch: https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
4. Configure o token:
   - Env: `OPENCLAW_TWITCH_ACCESS_TOKEN=...` (apenas conta padrao)
   - Ou config: `channels.twitch.accessToken`
   - Se ambos estiverem definidos, a config tem precedencia (o fallback por env e apenas para a conta padrao).
5. Inicie o Gateway.

**⚠️ Importante:** Adicione controle de acesso (`allowFrom` ou `allowedRoles`) para evitar que usuarios nao autorizados acionem o bot. `requireMention` padrao para `true`.

Config minima:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw", // Bot's Twitch account
      accessToken: "oauth:abc123...", // OAuth Access Token (or use OPENCLAW_TWITCH_ACCESS_TOKEN env var)
      clientId: "xyz789...", // Client ID from Token Generator
      channel: "vevisk", // Which Twitch channel's chat to join (required)
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only - get it from https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
    },
  },
}
```

## O que e

- Um canal do Twitch de propriedade do Gateway.
- Roteamento deterministico: as respostas sempre voltam para o Twitch.
- Cada conta mapeia para uma chave de sessao isolada `agent:<agentId>:twitch:<accountName>`.
- `username` e a conta do bot (que autentica), `channel` e qual sala de chat entrar.

## Configuracao (detalhada)

### Gerar credenciais

Use o [Twitch Token Generator](https://twitchtokengenerator.com/):

- Selecione **Bot Token**
- Verifique se os escopos `chat:read` e `chat:write` estao selecionados
- Copie o **Client ID** e o **Access Token**

Nao e necessario registrar um app manualmente. Os tokens expiram apos varias horas.

### Configurar o bot

**Variavel de ambiente (apenas conta padrao):**

```bash
OPENCLAW_TWITCH_ACCESS_TOKEN=oauth:abc123...
```

**Ou config:**

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
    },
  },
}
```

Se env e config estiverem definidos, a config tem precedencia.

### Controle de acesso (recomendado)

```json5
{
  channels: {
    twitch: {
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only
    },
  },
}
```

Prefira `allowFrom` para uma allowlist rigida. Use `allowedRoles` se voce quiser acesso baseado em papeis.

**Papeis disponiveis:** `"moderator"`, `"owner"`, `"vip"`, `"subscriber"`, `"all"`.

**Por que IDs de usuario?** Nomes de usuario podem mudar, permitindo impersonacao. IDs de usuario sao permanentes.

Encontre seu ID de usuario do Twitch: https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/ (Converta seu nome de usuario do Twitch em ID)

## Atualizacao de token (opcional)

Tokens do [Twitch Token Generator](https://twitchtokengenerator.com/) nao podem ser atualizados automaticamente — regenere quando expirarem.

Para atualizacao automatica de token, crie seu proprio aplicativo do Twitch no [Twitch Developer Console](https://dev.twitch.tv/console) e adicione a config:

```json5
{
  channels: {
    twitch: {
      clientSecret: "your_client_secret",
      refreshToken: "your_refresh_token",
    },
  },
}
```

O bot atualiza automaticamente os tokens antes da expiracao e registra eventos de atualizacao.

## Suporte a multiplas contas

Use `channels.twitch.accounts` com tokens por conta. Veja [`gateway/configuration`](/gateway/configuration) para o padrao compartilhado.

Exemplo (uma conta de bot em dois canais):

```json5
{
  channels: {
    twitch: {
      accounts: {
        channel1: {
          username: "openclaw",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk",
        },
        channel2: {
          username: "openclaw",
          accessToken: "oauth:def456...",
          clientId: "uvw012...",
          channel: "secondchannel",
        },
      },
    },
  },
}
```

**Observacao:** Cada conta precisa do seu proprio token (um token por canal).

## Controle de acesso

### Restricoes baseadas em papeis

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator", "vip"],
        },
      },
    },
  },
}
```

### Allowlist por ID de usuario (mais seguro)

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowFrom: ["123456789", "987654321"],
        },
      },
    },
  },
}
```

### Acesso baseado em papeis (alternativa)

`allowFrom` e uma allowlist rigida. Quando definida, apenas esses IDs de usuario sao permitidos.
Se voce quiser acesso baseado em papeis, deixe `allowFrom` nao definido e configure `allowedRoles` em vez disso:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

### Desativar requisito de @mention

Por padrao, `requireMention` e `true`. Para desativar e responder a todas as mensagens:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          requireMention: false,
        },
      },
    },
  },
}
```

## Solucao de problemas

Primeiro, execute comandos de diagnostico:

```bash
openclaw doctor
openclaw channels status --probe
```

### O bot nao responde as mensagens

**Verifique o controle de acesso:** Garanta que seu ID de usuario esteja em `allowFrom`, ou remova temporariamente
`allowFrom` e defina `allowedRoles: ["all"]` para testar.

**Verifique se o bot esta no canal:** O bot deve entrar no canal especificado em `channel`.

### Problemas de token

**"Falha ao conectar" ou erros de autenticacao:**

- Verifique se `accessToken` e o valor do token de acesso OAuth (normalmente comeca com o prefixo `oauth:`)
- Verifique se o token tem os escopos `chat:read` e `chat:write`
- Se estiver usando atualizacao de token, verifique se `clientSecret` e `refreshToken` estao definidos

### Atualizacao de token nao funciona

**Verifique os logs para eventos de atualizacao:**

```
Using env token source for mybot
Access token refreshed for user 123456 (expires in 14400s)
```

Se voce vir "token refresh disabled (no refresh token)":

- Garanta que `clientSecret` foi fornecido
- Garanta que `refreshToken` foi fornecido

## Config

**Config de conta:**

- `username` - Nome de usuario do bot
- `accessToken` - Token de acesso OAuth com `chat:read` e `chat:write`
- `clientId` - Client ID do Twitch (do Token Generator ou do seu app)
- `channel` - Canal para entrar (obrigatorio)
- `enabled` - Habilitar esta conta (padrao: `true`)
- `clientSecret` - Opcional: Para atualizacao automatica de token
- `refreshToken` - Opcional: Para atualizacao automatica de token
- `expiresIn` - Expiracao do token em segundos
- `obtainmentTimestamp` - Timestamp de obtencao do token
- `allowFrom` - Allowlist de IDs de usuario
- `allowedRoles` - Controle de acesso baseado em papeis (`"moderator" | "owner" | "vip" | "subscriber" | "all"`)
- `requireMention` - Exigir @mention (padrao: `true`)

**Opcoes do provedor:**

- `channels.twitch.enabled` - Habilitar/desabilitar inicializacao do canal
- `channels.twitch.username` - Nome de usuario do bot (config simplificada de conta unica)
- `channels.twitch.accessToken` - Token de acesso OAuth (config simplificada de conta unica)
- `channels.twitch.clientId` - Client ID do Twitch (config simplificada de conta unica)
- `channels.twitch.channel` - Canal para entrar (config simplificada de conta unica)
- `channels.twitch.accounts.<accountName>` - Config de multiplas contas (todos os campos de conta acima)

Exemplo completo:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
      clientSecret: "secret123...",
      refreshToken: "refresh456...",
      allowFrom: ["123456789"],
      allowedRoles: ["moderator", "vip"],
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          enabled: true,
          clientSecret: "secret123...",
          refreshToken: "refresh456...",
          expiresIn: 14400,
          obtainmentTimestamp: 1706092800000,
          allowFrom: ["123456789", "987654321"],
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

## Acoes de ferramenta

O agente pode chamar `twitch` com a acao:

- `send` - Enviar uma mensagem para um canal

Exemplo:

```json5
{
  action: "twitch",
  params: {
    message: "Hello Twitch!",
    to: "#mychannel",
  },
}
```

## Seguranca & operacoes

- **Trate tokens como senhas** - Nunca commit tokens no git
- **Use atualizacao automatica de token** para bots de longa duracao
- **Use allowlists de IDs de usuario** em vez de nomes de usuario para controle de acesso
- **Monitore logs** para eventos de atualizacao de token e status de conexao
- **Limite escopos de tokens** - Solicite apenas `chat:read` e `chat:write`
- **Se travar**: Reinicie o Gateway apos confirmar que nenhum outro processo possui a sessao

## Limites

- **500 caracteres** por mensagem (dividido automaticamente em limites de palavra)
- Markdown e removido antes da divisao
- Sem limitacao de taxa (usa os limites de taxa integrados do Twitch)
