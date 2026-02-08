---
summary: "Suporte legado ao iMessage via imsg (JSON-RPC sobre stdio). Novas configuracoes devem usar BlueBubbles."
read_when:
  - Configurando suporte ao iMessage
  - Depurando envio/recebimento do iMessage
title: iMessage
x-i18n:
  source_path: channels/imessage.md
  source_hash: 7c8c276701528b8d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:31Z
---

# iMessage (legado: imsg)

> **Recomendado:** Use [BlueBubbles](/channels/bluebubbles) para novas configuracoes de iMessage.
>
> O canal `imsg` e uma integracao legado de CLI externa e pode ser removido em uma versao futura.

Status: integracao legado de CLI externa. O Gateway inicia `imsg rpc` (JSON-RPC sobre stdio).

## Inicio rapido (iniciante)

1. Garanta que o Messages esteja conectado nesta Mac.
2. Instale `imsg`:
   - `brew install steipete/tap/imsg`
3. Configure o OpenClaw com `channels.imessage.cliPath` e `channels.imessage.dbPath`.
4. Inicie o Gateway e aprove quaisquer avisos do macOS (Automacao + Acesso Total ao Disco).

Configuracao minima:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "/usr/local/bin/imsg",
      dbPath: "/Users/<you>/Library/Messages/chat.db",
    },
  },
}
```

## O que e

- Canal do iMessage suportado por `imsg` no macOS.
- Roteamento deterministico: as respostas sempre voltam para o iMessage.
- Mensagens diretas compartilham a sessao principal do agente; grupos sao isolados (`agent:<agentId>:imessage:group:<chat_id>`).
- Se um topico com varios participantes chegar com `is_group=false`, voce ainda pode isola-lo `chat_id` usando `channels.imessage.groups` (veja “Topicos tipo grupo” abaixo).

## Escritas de configuracao

Por padrao, o iMessage tem permissao para gravar atualizacoes de configuracao acionadas por `/config set|unset` (requer `commands.config: true`).

Desative com:

```json5
{
  channels: { imessage: { configWrites: false } },
}
```

## Requisitos

- macOS com o Messages conectado.
- Acesso Total ao Disco para o OpenClaw + `imsg` (acesso ao banco de dados do Messages).
- Permissao de Automacao ao enviar.
- `channels.imessage.cliPath` pode apontar para qualquer comando que faça proxy de stdin/stdout (por exemplo, um script wrapper que use SSH para outra Mac e execute `imsg rpc`).

## Configuracao (caminho rapido)

1. Garanta que o Messages esteja conectado nesta Mac.
2. Configure o iMessage e inicie o Gateway.

### Usuario macOS dedicado para bot (para identidade isolada)

Se voce quiser que o bot envie a partir de uma **identidade de iMessage separada** (e manter seus Messages pessoais limpos), use um Apple ID dedicado + um usuario macOS dedicado.

1. Crie um Apple ID dedicado (exemplo: `my-cool-bot@icloud.com`).
   - A Apple pode exigir um numero de telefone para verificacao / 2FA.
2. Crie um usuario macOS (exemplo: `openclawhome`) e faca login nele.
3. Abra o Messages nesse usuario macOS e conecte-se ao iMessage usando o Apple ID do bot.
4. Ative o Login Remoto (Ajustes do Sistema → Geral → Compartilhamento → Login Remoto).
5. Instale `imsg`:
   - `brew install steipete/tap/imsg`
6. Configure o SSH para que `ssh <bot-macos-user>@localhost true` funcione sem senha.
7. Aponte `channels.imessage.accounts.bot.cliPath` para um wrapper SSH que execute `imsg` como o usuario do bot.

Observacao da primeira execucao: enviar/receber pode exigir aprovacoes de GUI (Automacao + Acesso Total ao Disco) no _usuario macOS do bot_. Se `imsg rpc` parecer travado ou encerrar, faca login nesse usuario (Compartilhamento de Tela ajuda), execute uma vez `imsg chats --limit 1` / `imsg send ...`, aprove os avisos e tente novamente.

Exemplo de wrapper (`chmod +x`). Substitua `<bot-macos-user>` pelo seu nome de usuario macOS real:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run an interactive SSH once first to accept host keys:
#   ssh <bot-macos-user>@localhost true
exec /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=5 -T <bot-macos-user>@localhost \
  "/usr/local/bin/imsg" "$@"
```

Exemplo de configuracao:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      accounts: {
        bot: {
          name: "Bot",
          enabled: true,
          cliPath: "/path/to/imsg-bot",
          dbPath: "/Users/<bot-macos-user>/Library/Messages/chat.db",
        },
      },
    },
  },
}
```

Para configuracoes de conta unica, use opcoes planas (`channels.imessage.cliPath`, `channels.imessage.dbPath`) em vez do mapa `accounts`.

### Variante remota/SSH (opcional)

Se voce quiser o iMessage em outra Mac, defina `channels.imessage.cliPath` para um wrapper que execute `imsg` no host macOS remoto via SSH. O OpenClaw precisa apenas de stdio.

Exemplo de wrapper:

```bash
#!/usr/bin/env bash
exec ssh -T gateway-host imsg "$@"
```

**Anexos remotos:** Quando `cliPath` aponta para um host remoto via SSH, os caminhos de anexos no banco de dados do Messages referenciam arquivos na maquina remota. O OpenClaw pode buscar automaticamente esses arquivos via SCP definindo `channels.imessage.remoteHost`:

```json5
{
  channels: {
    imessage: {
      cliPath: "~/imsg-ssh", // SSH wrapper to remote Mac
      remoteHost: "user@gateway-host", // for SCP file transfer
      includeAttachments: true,
    },
  },
}
```

Se `remoteHost` nao estiver definido, o OpenClaw tenta detecta-lo automaticamente analisando o comando SSH no seu script wrapper. A configuracao explicita e recomendada para maior confiabilidade.

#### Mac remoto via Tailscale (exemplo)

Se o Gateway roda em um host/VM Linux, mas o iMessage precisa rodar em uma Mac, o Tailscale e a ponte mais simples: o Gateway conversa com a Mac pela tailnet, executa `imsg` via SSH e usa SCP para trazer os anexos de volta.

Arquitetura:

```
┌──────────────────────────────┐          SSH (imsg rpc)          ┌──────────────────────────┐
│ Gateway host (Linux/VM)      │──────────────────────────────────▶│ Mac with Messages + imsg │
│ - openclaw gateway           │          SCP (attachments)        │ - Messages signed in     │
│ - channels.imessage.cliPath  │◀──────────────────────────────────│ - Remote Login enabled   │
└──────────────────────────────┘                                   └──────────────────────────┘
              ▲
              │ Tailscale tailnet (hostname or 100.x.y.z)
              ▼
        user@gateway-host
```

Exemplo concreto de configuracao (hostname do Tailscale):

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "~/.openclaw/scripts/imsg-ssh",
      remoteHost: "bot@mac-mini.tailnet-1234.ts.net",
      includeAttachments: true,
      dbPath: "/Users/bot/Library/Messages/chat.db",
    },
  },
}
```

Exemplo de wrapper (`~/.openclaw/scripts/imsg-ssh`):

```bash
#!/usr/bin/env bash
exec ssh -T bot@mac-mini.tailnet-1234.ts.net imsg "$@"
```

Notas:

- Garanta que a Mac esteja conectada ao Messages e que o Login Remoto esteja ativado.
- Use chaves SSH para que `ssh bot@mac-mini.tailnet-1234.ts.net` funcione sem prompts.
- `remoteHost` deve corresponder ao destino SSH para que o SCP possa buscar anexos.

Suporte a varias contas: use `channels.imessage.accounts` com configuracao por conta e `name` opcional. Veja [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) para o padrao compartilhado. Nao versionar `~/.openclaw/openclaw.json` (ele frequentemente contem tokens).

## Controle de acesso (mensagens diretas + grupos)

Mensagens diretas:

- Padrao: `channels.imessage.dmPolicy = "pairing"`.
- Remetentes desconhecidos recebem um codigo de pareamento; as mensagens sao ignoradas ate aprovacao (codigos expiram apos 1 hora).
- Aprove via:
  - `openclaw pairing list imessage`
  - `openclaw pairing approve imessage <CODE>`
- O pareamento e a troca de token padrao para mensagens diretas do iMessage. Detalhes: [Pareamento](/start/pairing)

Grupos:

- `channels.imessage.groupPolicy = open | allowlist | disabled`.
- `channels.imessage.groupAllowFrom` controla quem pode acionar em grupos quando `allowlist` esta definido.
- O controle por mencao usa `agents.list[].groupChat.mentionPatterns` (ou `messages.groupChat.mentionPatterns`) porque o iMessage nao tem metadados nativos de mencao.
- Substituicao multiagente: defina padroes por agente em `agents.list[].groupChat.mentionPatterns`.

## Como funciona (comportamento)

- `imsg` transmite eventos de mensagem; o Gateway os normaliza no envelope de canal compartilhado.
- As respostas sempre sao roteadas de volta para o mesmo id de chat ou handle.

## Topicos tipo grupo (`is_group=false`)

Alguns topicos do iMessage podem ter varios participantes, mas ainda assim chegar com `is_group=false`, dependendo de como o Messages armazena o identificador do chat.

Se voce configurar explicitamente um `chat_id` em `channels.imessage.groups`, o OpenClaw trata esse topico como um “grupo” para:

- isolamento de sessao (chave de sessao `agent:<agentId>:imessage:group:<chat_id>` separada)
- comportamento de allowlist de grupo / controle por mencao

Exemplo:

```json5
{
  channels: {
    imessage: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "42": { requireMention: false },
      },
    },
  },
}
```

Isso e util quando voce quer uma personalidade/modelo isolado para um topico especifico (veja [Roteamento multiagente](/concepts/multi-agent)). Para isolamento de sistema de arquivos, veja [Sandboxing](/gateway/sandboxing).

## Midia + limites

- Ingestao opcional de anexos via `channels.imessage.includeAttachments`.
- Limite de midia via `channels.imessage.mediaMaxMb`.

## Limites

- O texto de saida e dividido em partes de `channels.imessage.textChunkLimit` (padrao 4000).
- Divisao opcional por nova linha: defina `channels.imessage.chunkMode="newline"` para dividir em linhas em branco (limites de paragrafo) antes da divisao por comprimento.
- Uploads de midia sao limitados por `channels.imessage.mediaMaxMb` (padrao 16).

## Enderecamento / destinos de entrega

Prefira `chat_id` para roteamento estavel:

- `chat_id:123` (preferido)
- `chat_guid:...`
- `chat_identifier:...`
- handles diretos: `imessage:+1555` / `sms:+1555` / `user@example.com`

Listar chats:

```
imsg chats --limit 20
```

## Referencia de configuracao (iMessage)

Configuracao completa: [Configuracao](/gateway/configuration)

Opcoes do provedor:

- `channels.imessage.enabled`: ativar/desativar inicializacao do canal.
- `channels.imessage.cliPath`: caminho para `imsg`.
- `channels.imessage.dbPath`: caminho do banco de dados do Messages.
- `channels.imessage.remoteHost`: host SSH para transferencia de anexos via SCP quando `cliPath` aponta para uma Mac remota (por exemplo, `user@gateway-host`). Detectado automaticamente a partir do wrapper SSH se nao estiver definido.
- `channels.imessage.service`: `imessage | sms | auto`.
- `channels.imessage.region`: regiao de SMS.
- `channels.imessage.dmPolicy`: `pairing | allowlist | open | disabled` (padrao: pareamento).
- `channels.imessage.allowFrom`: allowlist de mensagens diretas (handles, emails, numeros E.164 ou `chat_id:*`). `open` requer `"*"`. O iMessage nao tem nomes de usuario; use handles ou destinos de chat.
- `channels.imessage.groupPolicy`: `open | allowlist | disabled` (padrao: allowlist).
- `channels.imessage.groupAllowFrom`: allowlist de remetentes de grupo.
- `channels.imessage.historyLimit` / `channels.imessage.accounts.*.historyLimit`: maximo de mensagens de grupo a incluir como contexto (0 desativa).
- `channels.imessage.dmHistoryLimit`: limite de historico de mensagens diretas em turnos de usuario. Substituicoes por usuario: `channels.imessage.dms["<handle>"].historyLimit`.
- `channels.imessage.groups`: padroes por grupo + allowlist (use `"*"` para padroes globais).
- `channels.imessage.includeAttachments`: ingerir anexos no contexto.
- `channels.imessage.mediaMaxMb`: limite de midia de entrada/saida (MB).
- `channels.imessage.textChunkLimit`: tamanho de divisao de saida (caracteres).
- `channels.imessage.chunkMode`: `length` (padrao) ou `newline` para dividir em linhas em branco (limites de paragrafo) antes da divisao por comprimento.

Opcoes globais relacionadas:

- `agents.list[].groupChat.mentionPatterns` (ou `messages.groupChat.mentionPatterns`).
- `messages.responsePrefix`.
