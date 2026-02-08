---
summary: "Suporte ao Signal via signal-cli (JSON-RPC + SSE), configuracao e modelo de numero"
read_when:
  - Configurando o suporte ao Signal
  - Depurando envio/recebimento no Signal
title: "Signal"
x-i18n:
  source_path: channels/signal.md
  source_hash: ca4de8b3685017f5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:34Z
---

# Signal (signal-cli)

Status: integracao externa via CLI. O Gateway conversa com `signal-cli` por HTTP JSON-RPC + SSE.

## Inicio rapido (iniciante)

1. Use um **numero Signal separado** para o bot (recomendado).
2. Instale `signal-cli` (Java necessario).
3. Vincule o dispositivo do bot e inicie o daemon:
   - `signal-cli link -n "OpenClaw"`
4. Configure o OpenClaw e inicie o gateway.

Configuracao minima:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

## O que e

- Canal Signal via `signal-cli` (nao e libsignal embutido).
- Roteamento deterministico: as respostas sempre voltam para o Signal.
- Mensagens diretas compartilham a sessao principal do agente; grupos sao isolados (`agent:<agentId>:signal:group:<groupId>`).

## Escritas de configuracao

Por padrao, o Signal pode escrever atualizacoes de configuracao acionadas por `/config set|unset` (requer `commands.config: true`).

Desative com:

```json5
{
  channels: { signal: { configWrites: false } },
}
```

## O modelo de numero (importante)

- O gateway conecta a um **dispositivo Signal** (a conta `signal-cli`).
- Se voce executar o bot na **sua conta pessoal do Signal**, ele vai ignorar suas proprias mensagens (protecao contra loop).
- Para o caso “eu envio mensagem para o bot e ele responde”, use um **numero de bot separado**.

## Configuracao (caminho rapido)

1. Instale `signal-cli` (Java necessario).
2. Vincule uma conta de bot:
   - `signal-cli link -n "OpenClaw"` e entao escaneie o QR no Signal.
3. Configure o Signal e inicie o gateway.

Exemplo:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

Suporte a varias contas: use `channels.signal.accounts` com configuracao por conta e `name` opcional. Veja [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) para o padrao compartilhado.

## Modo de daemon externo (httpUrl)

Se voce quiser gerenciar `signal-cli` por conta propria (inicializacoes frias lentas da JVM, init de container ou CPUs compartilhadas), execute o daemon separadamente e aponte o OpenClaw para ele:

```json5
{
  channels: {
    signal: {
      httpUrl: "http://127.0.0.1:8080",
      autoStart: false,
    },
  },
}
```

Isso ignora a auto-inicializacao e a espera de startup dentro do OpenClaw. Para inicios lentos ao auto-inicializar, defina `channels.signal.startupTimeoutMs`.

## Controle de acesso (Mensagens diretas + grupos)

Mensagens diretas:

- Padrao: `channels.signal.dmPolicy = "pairing"`.
- Remetentes desconhecidos recebem um codigo de pareamento; as mensagens sao ignoradas ate aprovacao (codigos expiram apos 1 hora).
- Aprovar via:
  - `openclaw pairing list signal`
  - `openclaw pairing approve signal <CODE>`
- O pareamento e a troca de token padrao para mensagens diretas no Signal. Detalhes: [Pareamento](/start/pairing)
- Remetentes somente por UUID (de `sourceUuid`) sao armazenados como `uuid:<id>` em `channels.signal.allowFrom`.

Grupos:

- `channels.signal.groupPolicy = open | allowlist | disabled`.
- `channels.signal.groupAllowFrom` controla quem pode acionar em grupos quando `allowlist` esta definido.

## Como funciona (comportamento)

- `signal-cli` roda como um daemon; o gateway le eventos via SSE.
- Mensagens de entrada sao normalizadas no envelope de canal compartilhado.
- As respostas sempre sao roteadas de volta para o mesmo numero ou grupo.

## Midia + limites

- Texto de saida e fragmentado em `channels.signal.textChunkLimit` (padrao 4000).
- Fragmentacao opcional por nova linha: defina `channels.signal.chunkMode="newline"` para dividir em linhas em branco (limites de paragrafo) antes da fragmentacao por comprimento.
- Anexos suportados (base64 buscado de `signal-cli`).
- Limite padrao de midia: `channels.signal.mediaMaxMb` (padrao 8).
- Use `channels.signal.ignoreAttachments` para pular o download de midia.
- O contexto de historico de grupos usa `channels.signal.historyLimit` (ou `channels.signal.accounts.*.historyLimit`), com fallback para `messages.groupChat.historyLimit`. Defina `0` para desativar (padrao 50).

## Digitando + recibos de leitura

- **Indicadores de digitacao**: o OpenClaw envia sinais de digitacao via `signal-cli sendTyping` e os renova enquanto uma resposta esta em execucao.
- **Recibos de leitura**: quando `channels.signal.sendReadReceipts` e true, o OpenClaw encaminha recibos de leitura para mensagens diretas permitidas.
- O signal-cli nao expõe recibos de leitura para grupos.

## Reacoes (ferramenta de mensagem)

- Use `message action=react` com `channel=signal`.
- Alvos: E.164 do remetente ou UUID (use `uuid:<id>` da saida de pareamento; UUID simples tambem funciona).
- `messageId` e o timestamp do Signal da mensagem a que voce esta reagindo.
- Reacoes em grupos exigem `targetAuthor` ou `targetAuthorUuid`.

Exemplos:

```
message action=react channel=signal target=uuid:123e4567-e89b-12d3-a456-426614174000 messageId=1737630212345 emoji=🔥
message action=react channel=signal target=+15551234567 messageId=1737630212345 emoji=🔥 remove=true
message action=react channel=signal target=signal:group:<groupId> targetAuthor=uuid:<sender-uuid> messageId=1737630212345 emoji=✅
```

Configuracao:

- `channels.signal.actions.reactions`: ativar/desativar acoes de reacao (padrao true).
- `channels.signal.reactionLevel`: `off | ack | minimal | extensive`.
  - `off`/`ack` desativa reacoes do agente (a ferramenta de mensagem `react` vai gerar erro).
  - `minimal`/`extensive` ativa reacoes do agente e define o nivel de orientacao.
- Substituicoes por conta: `channels.signal.accounts.<id>.actions.reactions`, `channels.signal.accounts.<id>.reactionLevel`.

## Destinos de entrega (CLI/cron)

- Mensagens diretas: `signal:+15551234567` (ou E.164 simples).
- Mensagens diretas por UUID: `uuid:<id>` (ou UUID simples).
- Grupos: `signal:group:<groupId>`.
- Nomes de usuario: `username:<name>` (se suportado pela sua conta Signal).

## Referencia de configuracao (Signal)

Configuracao completa: [Configuracao](/gateway/configuration)

Opcoes do provedor:

- `channels.signal.enabled`: ativar/desativar inicializacao do canal.
- `channels.signal.account`: E.164 da conta do bot.
- `channels.signal.cliPath`: caminho para `signal-cli`.
- `channels.signal.httpUrl`: URL completa do daemon (substitui host/porta).
- `channels.signal.httpHost`, `channels.signal.httpPort`: bind do daemon (padrao 127.0.0.1:8080).
- `channels.signal.autoStart`: auto-inicializar daemon (padrao true se `httpUrl` nao estiver definido).
- `channels.signal.startupTimeoutMs`: tempo de espera de inicializacao em ms (limite 120000).
- `channels.signal.receiveMode`: `on-start | manual`.
- `channels.signal.ignoreAttachments`: pular downloads de anexos.
- `channels.signal.ignoreStories`: ignorar stories do daemon.
- `channels.signal.sendReadReceipts`: encaminhar recibos de leitura.
- `channels.signal.dmPolicy`: `pairing | allowlist | open | disabled` (padrao: pareamento).
- `channels.signal.allowFrom`: allowlist de mensagens diretas (E.164 ou `uuid:<id>`). `open` requer `"*"`. O Signal nao tem nomes de usuario; use ids de telefone/UUID.
- `channels.signal.groupPolicy`: `open | allowlist | disabled` (padrao: allowlist).
- `channels.signal.groupAllowFrom`: allowlist de remetentes de grupo.
- `channels.signal.historyLimit`: maximo de mensagens de grupo para incluir como contexto (0 desativa).
- `channels.signal.dmHistoryLimit`: limite de historico de mensagens diretas em turnos do usuario. Substituicoes por usuario: `channels.signal.dms["<phone_or_uuid>"].historyLimit`.
- `channels.signal.textChunkLimit`: tamanho do fragmento de saida (caracteres).
- `channels.signal.chunkMode`: `length` (padrao) ou `newline` para dividir em linhas em branco (limites de paragrafo) antes da fragmentacao por comprimento.
- `channels.signal.mediaMaxMb`: limite de midia de entrada/saida (MB).

Opcoes globais relacionadas:

- `agents.list[].groupChat.mentionPatterns` (o Signal nao suporta mencoes nativas).
- `messages.groupChat.mentionPatterns` (fallback global).
- `messages.responsePrefix`.
