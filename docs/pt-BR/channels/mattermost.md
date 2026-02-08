---
summary: "Configuracao do bot do Mattermost e configuracao do OpenClaw"
read_when:
  - Configurando o Mattermost
  - Depurando o roteamento do Mattermost
title: "Mattermost"
x-i18n:
  source_path: channels/mattermost.md
  source_hash: 57fabe5eb0efbcb8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:21Z
---

# Mattermost (plugin)

Status: suportado via plugin (token de bot + eventos WebSocket). Canais, grupos e Mensagens diretas são suportados.
Mattermost é uma plataforma de mensagens de equipe auto-hospedável; veja o site oficial em
[mattermost.com](https://mattermost.com) para detalhes do produto e downloads.

## Plugin necessario

O Mattermost é entregue como um plugin e não vem incluído na instalação principal.

Instale via CLI (registro npm):

```bash
openclaw plugins install @openclaw/mattermost
```

Checkout local (ao executar a partir de um repositório git):

```bash
openclaw plugins install ./extensions/mattermost
```

Se voce escolher Mattermost durante a configuracao/integracao inicial e um checkout git for detectado,
o OpenClaw oferecerá automaticamente o caminho de instalação local.

Detalhes: [Plugins](/plugin)

## Inicio rapido

1. Instale o plugin do Mattermost.
2. Crie uma conta de bot no Mattermost e copie o **token do bot**.
3. Copie a **URL base** do Mattermost (por exemplo, `https://chat.example.com`).
4. Configure o OpenClaw e inicie o Gateway.

Configuracao mínima:

```json5
{
  channels: {
    mattermost: {
      enabled: true,
      botToken: "mm-token",
      baseUrl: "https://chat.example.com",
      dmPolicy: "pairing",
    },
  },
}
```

## Variaveis de ambiente (conta padrão)

Defina estas no host do Gateway se voce preferir variaveis de ambiente:

- `MATTERMOST_BOT_TOKEN=...`
- `MATTERMOST_URL=https://chat.example.com`

As variaveis de ambiente se aplicam apenas à conta **padrão** (`default`). Outras contas devem usar valores de configuracao.

## Modos de chat

O Mattermost responde automaticamente a Mensagens diretas. O comportamento em canais é controlado por `chatmode`:

- `oncall` (padrão): responde apenas quando @mencionado nos canais.
- `onmessage`: responde a todas as mensagens do canal.
- `onchar`: responde quando uma mensagem começa com um prefixo de gatilho.

Exemplo de configuracao:

```json5
{
  channels: {
    mattermost: {
      chatmode: "onchar",
      oncharPrefixes: [">", "!"],
    },
  },
}
```

Observações:

- `onchar` ainda responde a @menções explícitas.
- `channels.mattermost.requireMention` é respeitado para configuracoes legadas, mas `chatmode` é preferido.

## Controle de acesso (Mensagens diretas)

- Padrão: `channels.mattermost.dmPolicy = "pairing"` (remetentes desconhecidos recebem um código de pareamento).
- Aprovar via:
  - `openclaw pairing list mattermost`
  - `openclaw pairing approve mattermost <CODE>`
- Mensagens diretas públicas: `channels.mattermost.dmPolicy="open"` mais `channels.mattermost.allowFrom=["*"]`.

## Canais (grupos)

- Padrão: `channels.mattermost.groupPolicy = "allowlist"` (controlado por menção).
- Permitir remetentes via allowlist com `channels.mattermost.groupAllowFrom` (IDs de usuário ou `@username`).
- Canais abertos: `channels.mattermost.groupPolicy="open"` (controlado por menção).

## Alvos para entrega de saída

Use estes formatos de alvo com `openclaw message send` ou cron/webhooks:

- `channel:<id>` para um canal
- `user:<id>` para uma Mensagem direta
- `@username` para uma Mensagem direta (resolvida via API do Mattermost)

IDs simples são tratados como canais.

## Multiplas contas

O Mattermost suporta múltiplas contas em `channels.mattermost.accounts`:

```json5
{
  channels: {
    mattermost: {
      accounts: {
        default: { name: "Primary", botToken: "mm-token", baseUrl: "https://chat.example.com" },
        alerts: { name: "Alerts", botToken: "mm-token-2", baseUrl: "https://alerts.example.com" },
      },
    },
  },
}
```

## Solucao de problemas

- Sem respostas em canais: garanta que o bot esteja no canal e mencione-o (oncall), use um prefixo de gatilho (onchar) ou defina `chatmode: "onmessage"`.
- Erros de autenticação: verifique o token do bot, a URL base e se a conta está habilitada.
- Problemas com múltiplas contas: variaveis de ambiente se aplicam apenas à conta `default`.
