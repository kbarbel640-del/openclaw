---
summary: "Configuracao, configuracao e uso do plugin da LINE Messaging API"
read_when:
  - Voce quer conectar o OpenClaw ao LINE
  - Voce precisa configurar webhook e credenciais do LINE
  - Voce quer opcoes de mensagens especificas do LINE
title: LINE
x-i18n:
  source_path: channels/line.md
  source_hash: 8fbac126786f95b9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:17Z
---

# LINE (plugin)

O LINE se conecta ao OpenClaw por meio da LINE Messaging API. O plugin roda como um
receptor de webhook no gateway e usa seu token de acesso do canal + segredo do canal
para autenticacao.

Status: suportado via plugin. Mensagens diretas, chats em grupo, midia, locais,
mensagens Flex, mensagens de template e respostas rapidas sao suportadas. Reacoes e
threads nao sao suportadas.

## Plugin necessario

Instale o plugin do LINE:

```bash
openclaw plugins install @openclaw/line
```

Checkout local (ao executar a partir de um repo git):

```bash
openclaw plugins install ./extensions/line
```

## Configuracao inicial

1. Crie uma conta no LINE Developers e abra o Console:
   https://developers.line.biz/console/
2. Crie (ou selecione) um Provider e adicione um canal de **Messaging API**.
3. Copie o **Channel access token** e o **Channel secret** nas configuracoes do canal.
4. Ative **Use webhook** nas configuracoes da Messaging API.
5. Defina a URL do webhook para o endpoint do seu gateway (HTTPS obrigatorio):

```
https://gateway-host/line/webhook
```

O gateway responde a verificacao de webhook do LINE (GET) e a eventos de entrada (POST).
Se voce precisar de um caminho personalizado, defina `channels.line.webhookPath` ou
`channels.line.accounts.<id>.webhookPath` e atualize a URL de acordo.

## Configurar

Configuracao minima:

```json5
{
  channels: {
    line: {
      enabled: true,
      channelAccessToken: "LINE_CHANNEL_ACCESS_TOKEN",
      channelSecret: "LINE_CHANNEL_SECRET",
      dmPolicy: "pairing",
    },
  },
}
```

Variaveis de ambiente (apenas conta padrao):

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

Arquivos de token/segredo:

```json5
{
  channels: {
    line: {
      tokenFile: "/path/to/line-token.txt",
      secretFile: "/path/to/line-secret.txt",
    },
  },
}
```

Multiplas contas:

```json5
{
  channels: {
    line: {
      accounts: {
        marketing: {
          channelAccessToken: "...",
          channelSecret: "...",
          webhookPath: "/line/marketing",
        },
      },
    },
  },
}
```

## Controle de acesso

Mensagens diretas usam emparelhamento por padrao. Remetentes desconhecidos recebem um
codigo de emparelhamento e suas mensagens sao ignoradas ate serem aprovadas.

```bash
openclaw pairing list line
openclaw pairing approve line <CODE>
```

Listas de permissao e politicas:

- `channels.line.dmPolicy`: `pairing | allowlist | open | disabled`
- `channels.line.allowFrom`: IDs de usuario do LINE permitidos para DMs
- `channels.line.groupPolicy`: `allowlist | open | disabled`
- `channels.line.groupAllowFrom`: IDs de usuario do LINE permitidos para grupos
- Substituicoes por grupo: `channels.line.groups.<groupId>.allowFrom`

IDs do LINE diferenciam maiusculas e minusculas. IDs validos tem o formato:

- Usuario: `U` + 32 caracteres hex
- Grupo: `C` + 32 caracteres hex
- Sala: `R` + 32 caracteres hex

## Comportamento de mensagens

- Texto e dividido em partes a cada 5000 caracteres.
- A formatacao Markdown e removida; blocos de codigo e tabelas sao convertidos em
  cards Flex quando possivel.
- Respostas em streaming sao armazenadas em buffer; o LINE recebe partes completas
  com uma animacao de carregamento enquanto o agente trabalha.
- Downloads de midia sao limitados por `channels.line.mediaMaxMb` (padrao 10).

## Dados do canal (mensagens ricas)

Use `channelData.line` para enviar respostas rapidas, locais, cards Flex ou mensagens de
template.

```json5
{
  text: "Here you go",
  channelData: {
    line: {
      quickReplies: ["Status", "Help"],
      location: {
        title: "Office",
        address: "123 Main St",
        latitude: 35.681236,
        longitude: 139.767125,
      },
      flexMessage: {
        altText: "Status card",
        contents: {
          /* Flex payload */
        },
      },
      templateMessage: {
        type: "confirm",
        text: "Proceed?",
        confirmLabel: "Yes",
        confirmData: "yes",
        cancelLabel: "No",
        cancelData: "no",
      },
    },
  },
}
```

O plugin do LINE tambem inclui um comando `/card` para presets de mensagens
Flex:

```
/card info "Welcome" "Thanks for joining!"
```

## Solucao de problemas

- **Falha na verificacao do webhook:** garanta que a URL do webhook seja HTTPS e que
  `channelSecret` corresponda ao console do LINE.
- **Sem eventos de entrada:** confirme que o caminho do webhook corresponde a
  `channels.line.webhookPath` e que o gateway esteja acessivel a partir do LINE.
- **Erros no download de midia:** aumente `channels.line.mediaMaxMb` se a midia exceder o
  limite padrao.
