---
summary: "Visão geral de pareamento: aprove quem pode enviar Mensagens diretas + quais nós podem entrar"
read_when:
  - Configurando controle de acesso por Mensagens diretas
  - Pareando um novo nó iOS/Android
  - Revisando a postura de segurança do OpenClaw
title: "Pareamento"
x-i18n:
  source_path: start/pairing.md
  source_hash: 5a0539932f905536
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:26Z
---

# Pareamento

“Pareamento” é a etapa explícita de **aprovação do proprietário** do OpenClaw.
Ele é usado em dois lugares:

1. **Pareamento de Mensagens diretas** (quem pode falar com o bot)
2. **Pareamento de nós** (quais dispositivos/nós podem entrar na rede do Gateway)

Contexto de segurança: [Security](/gateway/security)

## 1) Pareamento de Mensagens diretas (acesso de chat de entrada)

Quando um canal é configurado com a política de Mensagens diretas `pairing`, remetentes desconhecidos recebem um código curto e sua mensagem **não é processada** até que você aprove.

As políticas padrão de Mensagens diretas estão documentadas em: [Security](/gateway/security)

Códigos de pareamento:

- 8 caracteres, maiúsculos, sem caracteres ambíguos (`0O1I`).
- **Expiram após 1 hora**. O bot só envia a mensagem de pareamento quando uma nova solicitação é criada (aproximadamente uma vez por hora por remetente).
- Solicitações pendentes de pareamento de Mensagens diretas são limitadas a **3 por canal** por padrão; solicitações adicionais são ignoradas até que uma expire ou seja aprovada.

### Aprovar um remetente

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

Canais compatíveis: `telegram`, `whatsapp`, `signal`, `imessage`, `discord`, `slack`.

### Onde o estado fica armazenado

Armazenado em `~/.openclaw/credentials/`:

- Solicitações pendentes: `<channel>-pairing.json`
- Armazenamento da allowlist aprovada: `<channel>-allowFrom.json`

Trate isso como sensível (eles controlam o acesso ao seu assistente).

## 2) Pareamento de dispositivos de nó (nós iOS/Android/macOS/headless)

Os nós se conectam ao Gateway como **dispositivos** com `role: node`. O Gateway
cria uma solicitação de pareamento de dispositivo que deve ser aprovada.

### Aprovar um dispositivo de nó

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

### Onde o estado fica armazenado

Armazenado em `~/.openclaw/devices/`:

- `pending.json` (vida curta; solicitações pendentes expiram)
- `paired.json` (dispositivos pareados + tokens)

### Notas

- A API legada `node.pair.*` (CLI: `openclaw nodes pending/approve`) é um
  armazenamento de pareamento separado, pertencente ao gateway. Nós WS ainda exigem pareamento de dispositivo.

## Documentos relacionados

- Modelo de segurança + prompt injection: [Security](/gateway/security)
- Atualizando com segurança (executar doctor): [Updating](/install/updating)
- Configurações de canal:
  - Telegram: [Telegram](/channels/telegram)
  - WhatsApp: [WhatsApp](/channels/whatsapp)
  - Signal: [Signal](/channels/signal)
  - BlueBubbles (iMessage): [BlueBubbles](/channels/bluebubbles)
  - iMessage (legado): [iMessage](/channels/imessage)
  - Discord: [Discord](/channels/discord)
  - Slack: [Slack](/channels/slack)
