---
summary: "Status de suporte, capacidades e configuracao do Tlon/Urbit"
read_when:
  - Trabalhando em recursos do canal Tlon/Urbit
title: "Tlon"
x-i18n:
  source_path: channels/tlon.md
  source_hash: 19d7ffe23e82239f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:22Z
---

# Tlon (plugin)

Tlon e um mensageiro descentralizado construido sobre o Urbit. O OpenClaw se conecta a sua nave Urbit e pode
responder a Mensagens diretas e mensagens de chat em grupo. As respostas em grupo exigem uma mencao com @ por padrao e podem
ser ainda mais restritas por meio de allowlists.

Status: suportado via plugin. Mensagens diretas, mencoes em grupo, respostas em threads e fallback de midia somente em texto
(URL anexada a legenda). Reacoes, enquetes e uploads de midia nativos nao sao suportados.

## Plugin necessario

O Tlon e distribuido como um plugin e nao vem junto com a instalacao principal.

Instale via CLI (registro npm):

```bash
openclaw plugins install @openclaw/tlon
```

Checkout local (ao executar a partir de um repo git):

```bash
openclaw plugins install ./extensions/tlon
```

Detalhes: [Plugins](/plugin)

## Configuracao

1. Instale o plugin Tlon.
2. Reuna a URL da sua nave e o codigo de login.
3. Configure `channels.tlon`.
4. Reinicie o Gateway.
5. Envie uma Mensagem direta para o bot ou mencione-o em um canal de grupo.

Configuracao minima (conta unica):

```json5
{
  channels: {
    tlon: {
      enabled: true,
      ship: "~sampel-palnet",
      url: "https://your-ship-host",
      code: "lidlut-tabwed-pillex-ridrup",
    },
  },
}
```

## Canais de grupo

A descoberta automatica vem habilitada por padrao. Voce tambem pode fixar canais manualmente:

```json5
{
  channels: {
    tlon: {
      groupChannels: ["chat/~host-ship/general", "chat/~host-ship/support"],
    },
  },
}
```

Desabilitar descoberta automatica:

```json5
{
  channels: {
    tlon: {
      autoDiscoverChannels: false,
    },
  },
}
```

## Controle de acesso

Allowlist de Mensagens diretas (vazia = permitir todos):

```json5
{
  channels: {
    tlon: {
      dmAllowlist: ["~zod", "~nec"],
    },
  },
}
```

Autorizacao de grupo (restrita por padrao):

```json5
{
  channels: {
    tlon: {
      defaultAuthorizedShips: ["~zod"],
      authorization: {
        channelRules: {
          "chat/~host-ship/general": {
            mode: "restricted",
            allowedShips: ["~zod", "~nec"],
          },
          "chat/~host-ship/announcements": {
            mode: "open",
          },
        },
      },
    },
  },
}
```

## Destinos de entrega (CLI/cron)

Use estes com `openclaw message send` ou entrega via cron:

- Mensagem direta: `~sampel-palnet` ou `dm/~sampel-palnet`
- Grupo: `chat/~host-ship/channel` ou `group:~host-ship/channel`

## Observacoes

- Respostas em grupo exigem uma mencao (por exemplo, `~your-bot-ship`) para responder.
- Respostas em threads: se a mensagem de entrada estiver em uma thread, o OpenClaw responde na propria thread.
- Midia: `sendMedia` faz fallback para texto + URL (sem upload nativo).
