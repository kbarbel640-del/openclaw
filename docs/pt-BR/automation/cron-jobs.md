---
summary: "Cron jobs + wakeups para o agendador do Gateway"
read_when:
  - Agendar jobs em segundo plano ou wakeups
  - Conectar automacoes que devem rodar com ou junto aos heartbeats
  - Decidir entre heartbeat e cron para tarefas agendadas
title: "Cron Jobs"
x-i18n:
  source_path: automation/cron-jobs.md
  source_hash: 523721a7da2c4e27
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:30Z
---

# Cron jobs (agendador do Gateway)

> **Cron vs Heartbeat?** Veja [Cron vs Heartbeat](/automation/cron-vs-heartbeat) para orientacao sobre quando usar cada um.

Cron e o agendador integrado do Gateway. Ele persiste jobs, acorda o agente
no momento certo e pode, opcionalmente, entregar a saida de volta para um chat.

Se voce quer _“rodar isso toda manha”_ ou _“cutucar o agente em 20 minutos”_,
cron e o mecanismo.

## TL;DR

- Cron roda **dentro do Gateway** (nao dentro do modelo).
- Jobs persistem em `~/.openclaw/cron/` para que reinicios nao percam agendas.
- Dois estilos de execucao:
  - **Sessao principal**: enfileira um evento de sistema e entao roda no proximo heartbeat.
  - **Isolado**: roda um turno dedicado do agente em `cron:<jobId>`, com entrega (anuncio por padrao ou nenhuma).
- Wakeups sao de primeira classe: um job pode solicitar “acordar agora” vs “proximo heartbeat”.

## Inicio rapido (acionavel)

Crie um lembrete de uma unica execucao, verifique que ele existe e execute-o imediatamente:

```bash
openclaw cron add \
  --name "Reminder" \
  --at "2026-02-01T16:00:00Z" \
  --session main \
  --system-event "Reminder: check the cron docs draft" \
  --wake now \
  --delete-after-run

openclaw cron list
openclaw cron run <job-id> --force
openclaw cron runs --id <job-id>
```

Agende um job isolado recorrente com entrega:

```bash
openclaw cron add \
  --name "Morning brief" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize overnight updates." \
  --announce \
  --channel slack \
  --to "channel:C1234567890"
```

## Equivalentes de tool-call (ferramenta cron do Gateway)

Para os formatos JSON canonicos e exemplos, veja [Esquema JSON para tool calls](/automation/cron-jobs#json-schema-for-tool-calls).

## Onde os cron jobs sao armazenados

Os cron jobs sao persistidos no host do Gateway em `~/.openclaw/cron/jobs.json` por padrao.
O Gateway carrega o arquivo na memoria e grava de volta quando ha mudancas, entao edicoes manuais
so sao seguras quando o Gateway esta parado. Prefira `openclaw cron add/edit` ou a API de tool call
do cron para mudancas.

## Visao geral amigavel para iniciantes

Pense em um cron job como: **quando** rodar + **o que** fazer.

1. **Escolha um agendamento**
   - Lembrete de uma unica execucao → `schedule.kind = "at"` (CLI: `--at`)
   - Job recorrente → `schedule.kind = "every"` ou `schedule.kind = "cron"`
   - Se o timestamp ISO omitir um fuso horario, ele e tratado como **UTC**.

2. **Escolha onde ele roda**
   - `sessionTarget: "main"` → roda durante o proximo heartbeat com o contexto principal.
   - `sessionTarget: "isolated"` → roda um turno dedicado do agente em `cron:<jobId>`.

3. **Escolha o payload**
   - Sessao principal → `payload.kind = "systemEvent"`
   - Sessao isolada → `payload.kind = "agentTurn"`

Opcional: jobs de uma unica execucao (`schedule.kind = "at"`) sao excluidos apos sucesso por padrao. Defina
`deleteAfterRun: false` para mante-los (eles serao desativados apos sucesso).

## Conceitos

### Jobs

Um cron job e um registro armazenado com:

- um **agendamento** (quando deve rodar),
- um **payload** (o que deve fazer),
- **modo de entrega** opcional (anuncio ou nenhum).
- **vinculacao de agente** opcional (`agentId`): roda o job sob um agente especifico; se
  ausente ou desconhecido, o gateway recorre ao agente padrao.

Jobs sao identificados por um `jobId` estavel (usado por CLI/APIs do Gateway).
Em tool calls do agente, `jobId` e canonico; o legado `id` e aceito por compatibilidade.
Jobs de uma unica execucao sao excluidos automaticamente apos sucesso por padrao; defina `deleteAfterRun: false` para mante-los.

### Agendamentos

Cron suporta tres tipos de agendamento:

- `at`: timestamp de uma unica execucao via `schedule.at` (ISO 8601).
- `every`: intervalo fixo (ms).
- `cron`: expressao cron de 5 campos com fuso horario IANA opcional.

Expressoes cron usam `croner`. Se um fuso horario for omitido, o fuso horario local
do host do Gateway e usado.

### Execucao principal vs isolada

#### Jobs da sessao principal (eventos de sistema)

Jobs principais enfileiram um evento de sistema e opcionalmente acordam o executor de heartbeat.
Eles devem usar `payload.kind = "systemEvent"`.

- `wakeMode: "next-heartbeat"` (padrao): o evento espera pelo proximo heartbeat agendado.
- `wakeMode: "now"`: o evento dispara uma execucao imediata do heartbeat.

Este e o melhor ajuste quando voce quer o prompt normal do heartbeat + contexto da sessao principal.
Veja [Heartbeat](/gateway/heartbeat).

#### Jobs isolados (sessoes cron dedicadas)

Jobs isolados rodam um turno dedicado do agente na sessao `cron:<jobId>`.

Comportamentos chave:

- O prompt e prefixado com `[cron:<jobId> <job name>]` para rastreabilidade.
- Cada execucao inicia um **id de sessao novo** (sem reaproveitar conversa anterior).
- Comportamento padrao: se `delivery` for omitido, jobs isolados anunciam um resumo (`delivery.mode = "announce"`).
- `delivery.mode` (apenas isolado) escolhe o que acontece:
  - `announce`: entrega um resumo ao canal de destino e posta um breve resumo na sessao principal.
  - `none`: apenas interno (sem entrega, sem resumo na sessao principal).
- `wakeMode` controla quando o resumo da sessao principal e postado:
  - `now`: heartbeat imediato.
  - `next-heartbeat`: aguarda o proximo heartbeat agendado.

Use jobs isolados para tarefas ruidosas, frequentes ou “afazeres de segundo plano” que nao devem
poluir o historico do chat principal.

### Formatos de payload (o que roda)

Dois tipos de payload sao suportados:

- `systemEvent`: apenas sessao principal, roteado pelo prompt de heartbeat.
- `agentTurn`: apenas sessao isolada, roda um turno dedicado do agente.

Campos comuns de `agentTurn`:

- `message`: texto do prompt (obrigatorio).
- `model` / `thinking`: sobrescritas opcionais (veja abaixo).
- `timeoutSeconds`: sobrescrita opcional de timeout.

Configuracao de entrega (apenas jobs isolados):

- `delivery.mode`: `none` | `announce`.
- `delivery.channel`: `last` ou um canal especifico.
- `delivery.to`: alvo especifico do canal (telefone/chat/id do canal).
- `delivery.bestEffort`: evitar falhar o job se a entrega por anuncio falhar.

A entrega por anuncio suprime envios via ferramentas de mensagens durante a execucao; use `delivery.channel`/`delivery.to`
para direcionar ao chat em vez disso. Quando `delivery.mode = "none"`, nenhum resumo e postado na sessao principal.

Se `delivery` for omitido para jobs isolados, o OpenClaw usa `announce` por padrao.

#### Fluxo de entrega por anuncio

Quando `delivery.mode = "announce"`, o cron entrega diretamente via adaptadores de canal de saida.
O agente principal nao e iniciado para criar ou encaminhar a mensagem.

Detalhes de comportamento:

- Conteudo: a entrega usa os payloads de saida da execucao isolada (texto/midia) com
  fragmentacao normal e formatacao do canal.
- Respostas apenas de heartbeat (`HEARTBEAT_OK` sem conteudo real) nao sao entregues.
- Se a execucao isolada ja enviou uma mensagem ao mesmo alvo via ferramenta de mensagem, a entrega e
  ignorada para evitar duplicatas.
- Alvos de entrega ausentes ou invalidos falham o job, a menos que `delivery.bestEffort = true`.
- Um breve resumo e postado na sessao principal apenas quando `delivery.mode = "announce"`.
- O resumo da sessao principal respeita `wakeMode`: `now` dispara um heartbeat imediato e
  `next-heartbeat` aguarda o proximo heartbeat agendado.

### Sobrescritas de modelo e pensamento

Jobs isolados (`agentTurn`) podem sobrescrever o modelo e o nivel de pensamento:

- `model`: string provedor/modelo (por exemplo, `anthropic/claude-sonnet-4-20250514`) ou alias (por exemplo, `opus`)
- `thinking`: nivel de pensamento (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`; apenas modelos GPT-5.2 + Codex)

Nota: Voce pode definir `model` em jobs da sessao principal tambem, mas isso muda o modelo
compartilhado da sessao principal. Recomendamos sobrescritas de modelo apenas para jobs isolados
para evitar mudancas inesperadas de contexto.

Prioridade de resolucao:

1. Sobrescrita no payload do job (mais alta)
2. Padroes especificos do hook (por exemplo, `hooks.gmail.model`)
3. Padrao da configuracao do agente

### Entrega (canal + alvo)

Jobs isolados podem entregar saida a um canal via a configuracao de nivel superior `delivery`:

- `delivery.mode`: `announce` (entregar um resumo) ou `none`.
- `delivery.channel`: `whatsapp` / `telegram` / `discord` / `slack` / `mattermost` (plugin) / `signal` / `imessage` / `last`.
- `delivery.to`: alvo do destinatario especifico do canal.

A configuracao de entrega e valida apenas para jobs isolados (`sessionTarget: "isolated"`).

Se `delivery.channel` ou `delivery.to` for omitido, o cron pode recorrer a “ultima rota”
da sessao principal (o ultimo lugar onde o agente respondeu).

Lembretes de formato de alvo:

- Alvos Slack/Discord/Mattermost (plugin) devem usar prefixos explicitos (por exemplo, `channel:<id>`, `user:<id>`) para evitar ambiguidade.
- Topicos do Telegram devem usar o formato `:topic:` (veja abaixo).

#### Alvos de entrega do Telegram (topicos / threads de forum)

O Telegram suporta topicos de forum via `message_thread_id`. Para entrega por cron, voce pode codificar
o topico/thread no campo `to`:

- `-1001234567890` (apenas id do chat)
- `-1001234567890:topic:123` (preferido: marcador explicito de topico)
- `-1001234567890:123` (atalho: sufixo numerico)

Alvos com prefixo como `telegram:...` / `telegram:group:...` tambem sao aceitos:

- `telegram:group:-1001234567890:topic:123`

## Esquema JSON para tool calls

Use estes formatos ao chamar diretamente as ferramentas `cron.*` do Gateway (tool calls do agente ou RPC).
Flags de CLI aceitam duracoes humanas como `20m`, mas tool calls devem usar uma string ISO 8601
para `schedule.at` e milissegundos para `schedule.everyMs`.

### Parametros de cron.add

Job de uma unica execucao, sessao principal (evento de sistema):

```json
{
  "name": "Reminder",
  "schedule": { "kind": "at", "at": "2026-02-01T16:00:00Z" },
  "sessionTarget": "main",
  "wakeMode": "now",
  "payload": { "kind": "systemEvent", "text": "Reminder text" },
  "deleteAfterRun": true
}
```

Job recorrente, isolado com entrega:

```json
{
  "name": "Morning brief",
  "schedule": { "kind": "cron", "expr": "0 7 * * *", "tz": "America/Los_Angeles" },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Summarize overnight updates."
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "channel:C1234567890",
    "bestEffort": true
  }
}
```

Notas:

- `schedule.kind`: `at` (`at`), `every` (`everyMs`), ou `cron` (`expr`, `tz` opcional).
- `schedule.at` aceita ISO 8601 (fuso horario opcional; tratado como UTC quando omitido).
- `everyMs` e em milissegundos.
- `sessionTarget` deve ser `"main"` ou `"isolated"` e deve corresponder a `payload.kind`.
- Campos opcionais: `agentId`, `description`, `enabled`, `deleteAfterRun` (padrao true para `at`),
  `delivery`.
- `wakeMode` usa `"next-heartbeat"` por padrao quando omitido.

### Parametros de cron.update

```json
{
  "jobId": "job-123",
  "patch": {
    "enabled": false,
    "schedule": { "kind": "every", "everyMs": 3600000 }
  }
}
```

Notas:

- `jobId` e canonico; `id` e aceito por compatibilidade.
- Use `agentId: null` no patch para limpar uma vinculacao de agente.

### Parametros de cron.run e cron.remove

```json
{ "jobId": "job-123", "mode": "force" }
```

```json
{ "jobId": "job-123" }
```

## Armazenamento e historico

- Armazenamento de jobs: `~/.openclaw/cron/jobs.json` (JSON gerenciado pelo Gateway).
- Historico de execucoes: `~/.openclaw/cron/runs/<jobId>.jsonl` (JSONL, com limpeza automatica).
- Sobrescrever caminho de armazenamento: `cron.store` na configuracao.

## Configuracao

```json5
{
  cron: {
    enabled: true, // default true
    store: "~/.openclaw/cron/jobs.json",
    maxConcurrentRuns: 1, // default 1
  },
}
```

Desativar o cron completamente:

- `cron.enabled: false` (config)
- `OPENCLAW_SKIP_CRON=1` (env)

## Inicio rapido de CLI

Lembrete de uma unica execucao (ISO UTC, auto-exclui apos sucesso):

```bash
openclaw cron add \
  --name "Send reminder" \
  --at "2026-01-12T18:00:00Z" \
  --session main \
  --system-event "Reminder: submit expense report." \
  --wake now \
  --delete-after-run
```

Lembrete de uma unica execucao (sessao principal, acordar imediatamente):

```bash
openclaw cron add \
  --name "Calendar check" \
  --at "20m" \
  --session main \
  --system-event "Next heartbeat: check calendar." \
  --wake now
```

Job isolado recorrente (anunciar no WhatsApp):

```bash
openclaw cron add \
  --name "Morning status" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize inbox + calendar for today." \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

Job isolado recorrente (entregar a um topico do Telegram):

```bash
openclaw cron add \
  --name "Nightly summary (topic)" \
  --cron "0 22 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize today; send to the nightly topic." \
  --announce \
  --channel telegram \
  --to "-1001234567890:topic:123"
```

Job isolado com sobrescrita de modelo e pensamento:

```bash
openclaw cron add \
  --name "Deep analysis" \
  --cron "0 6 * * 1" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Weekly deep analysis of project progress." \
  --model "opus" \
  --thinking high \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

Selecao de agente (ambientes com multiplos agentes):

```bash
# Pin a job to agent "ops" (falls back to default if that agent is missing)
openclaw cron add --name "Ops sweep" --cron "0 6 * * *" --session isolated --message "Check ops queue" --agent ops

# Switch or clear the agent on an existing job
openclaw cron edit <jobId> --agent ops
openclaw cron edit <jobId> --clear-agent
```

Execucao manual (debug):

```bash
openclaw cron run <jobId> --force
```

Editar um job existente (campos de patch):

```bash
openclaw cron edit <jobId> \
  --message "Updated prompt" \
  --model "opus" \
  --thinking low
```

Historico de execucoes:

```bash
openclaw cron runs --id <jobId> --limit 50
```

Evento de sistema imediato sem criar um job:

```bash
openclaw system event --mode now --text "Next heartbeat: check battery."
```

## Superficie de API do Gateway

- `cron.list`, `cron.status`, `cron.add`, `cron.update`, `cron.remove`
- `cron.run` (force ou due), `cron.runs`
  Para eventos de sistema imediatos sem um job, use [`openclaw system event`](/cli/system).

## Solucao de problemas

### “Nada roda”

- Verifique se o cron esta habilitado: `cron.enabled` e `OPENCLAW_SKIP_CRON`.
- Verifique se o Gateway esta rodando continuamente (cron roda dentro do processo do Gateway).
- Para agendamentos `cron`: confirme o fuso horario (`--tz`) vs o fuso horario do host.

### Telegram entrega no lugar errado

- Para topicos de forum, use `-100…:topic:<id>` para que seja explicito e inequivoco.
- Se voce vir prefixos `telegram:...` em logs ou em alvos de “ultima rota” armazenados, isso e normal;
  a entrega por cron os aceita e ainda analisa corretamente os IDs de topico.
