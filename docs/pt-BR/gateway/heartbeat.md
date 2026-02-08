---
summary: "Mensagens de polling de heartbeat e regras de notificacao"
read_when:
  - Ajustar a cadencia ou as mensagens do heartbeat
  - Decidir entre heartbeat e cron para tarefas agendadas
title: "Heartbeat"
x-i18n:
  source_path: gateway/heartbeat.md
  source_hash: 27db9803263a5f2d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:32Z
---

# Heartbeat (Gateway)

> **Heartbeat vs Cron?** Veja [Cron vs Heartbeat](/automation/cron-vs-heartbeat) para orientacoes sobre quando usar cada um.

O Heartbeat executa **turnos periodicos do agente** na sessao principal para que o modelo possa
destacar qualquer coisa que precise de atencao sem te bombardear com mensagens.

## Inicio rapido (iniciante)

1. Deixe os heartbeats habilitados (o padrao e `30m`, ou `1h` para Anthropic OAuth/setup-token) ou defina sua propria cadencia.
2. Crie um pequeno checklist `HEARTBEAT.md` no workspace do agente (opcional, mas recomendado).
3. Decida para onde as mensagens de heartbeat devem ir (`target: "last"` e o padrao).
4. Opcional: habilite a entrega de raciocinio do heartbeat para transparencia.
5. Opcional: restrinja os heartbeats a horarios ativos (hora local).

Exemplo de configuracao:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        // activeHours: { start: "08:00", end: "24:00" },
        // includeReasoning: true, // optional: send separate `Reasoning:` message too
      },
    },
  },
}
```

## Padroes

- Intervalo: `30m` (ou `1h` quando Anthropic OAuth/setup-token e o modo de autenticacao detectado). Defina `agents.defaults.heartbeat.every` ou por agente `agents.list[].heartbeat.every`; use `0m` para desativar.
- Corpo do prompt (configuravel via `agents.defaults.heartbeat.prompt`):
  `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
- O prompt de heartbeat e enviado **verbatim** como a mensagem do usuario. O prompt
  de sistema inclui uma secao “Heartbeat” e a execucao e sinalizada internamente.
- Horarios ativos (`heartbeat.activeHours`) sao verificados no fuso horario configurado.
  Fora da janela, os heartbeats sao ignorados ate o proximo tick dentro da janela.

## Para que serve o prompt de heartbeat

O prompt padrao e intencionalmente amplo:

- **Tarefas em segundo plano**: “Consider outstanding tasks” incentiva o agente a revisar
  acompanhamentos (caixa de entrada, calendario, lembretes, trabalho em fila) e destacar qualquer coisa urgente.
- **Check-in humano**: “Checkup sometimes on your human during day time” incentiva um
  ocasional “precisa de algo?”, mas evita spam noturno usando seu fuso horario local configurado
  (veja [/concepts/timezone](/concepts/timezone)).

Se voce quiser que um heartbeat faca algo muito especifico (por exemplo, “verificar
estatisticas do Gmail PubSub” ou “verificar a saude do gateway”), defina `agents.defaults.heartbeat.prompt` (ou
`agents.list[].heartbeat.prompt`) para um corpo personalizado (enviado verbatim).

## Contrato de resposta

- Se nada precisar de atencao, responda com **`HEARTBEAT_OK`**.
- Durante execucoes de heartbeat, o OpenClaw trata `HEARTBEAT_OK` como um ack quando aparece
  no **inicio ou fim** da resposta. O token e removido e a resposta e descartada se o conteudo
  restante for **≤ `ackMaxChars`** (padrao: 300).
- Se `HEARTBEAT_OK` aparecer no **meio** de uma resposta, ele nao e tratado de forma especial.
- Para alertas, **nao** inclua `HEARTBEAT_OK`; retorne apenas o texto do alerta.

Fora dos heartbeats, `HEARTBEAT_OK` isolado no inicio/fim de uma mensagem e removido
e registrado; uma mensagem que seja apenas `HEARTBEAT_OK` e descartada.

## Configuracao

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m", // default: 30m (0m disables)
        model: "anthropic/claude-opus-4-6",
        includeReasoning: false, // default: false (deliver separate Reasoning: message when available)
        target: "last", // last | none | <channel id> (core or plugin, e.g. "bluebubbles")
        to: "+15551234567", // optional channel-specific override
        accountId: "ops-bot", // optional multi-account channel id
        prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        ackMaxChars: 300, // max chars allowed after HEARTBEAT_OK
      },
    },
  },
}
```

### Escopo e precedencia

- `agents.defaults.heartbeat` define o comportamento global de heartbeat.
- `agents.list[].heartbeat` faz merge por cima; se qualquer agente tiver um bloco `heartbeat`, **apenas esses agentes** executam heartbeats.
- `channels.defaults.heartbeat` define padroes de visibilidade para todos os canais.
- `channels.<channel>.heartbeat` substitui os padroes do canal.
- `channels.<channel>.accounts.<id>.heartbeat` (canais multi-conta) substitui as configuracoes por canal.

### Heartbeats por agente

Se qualquer entrada `agents.list[]` incluir um bloco `heartbeat`, **apenas esses agentes**
executam heartbeats. O bloco por agente faz merge por cima de `agents.defaults.heartbeat`
(assim voce pode definir padroes compartilhados uma vez e substituir por agente).

Exemplo: dois agentes, apenas o segundo agente executa heartbeats.

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
      },
    },
    list: [
      { id: "main", default: true },
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "whatsapp",
          to: "+15551234567",
          prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        },
      },
    ],
  },
}
```

### Exemplo de horarios ativos

Restrinja os heartbeats ao horario comercial em um fuso horario especifico:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        activeHours: {
          start: "09:00",
          end: "22:00",
          timezone: "America/New_York", // optional; uses your userTimezone if set, otherwise host tz
        },
      },
    },
  },
}
```

Fora dessa janela (antes das 9h ou depois das 22h Eastern), os heartbeats sao ignorados. O proximo tick agendado dentro da janela executara normalmente.

### Exemplo multi-conta

Use `accountId` para direcionar uma conta especifica em canais multi-conta como o Telegram:

```json5
{
  agents: {
    list: [
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "telegram",
          to: "12345678",
          accountId: "ops-bot",
        },
      },
    ],
  },
  channels: {
    telegram: {
      accounts: {
        "ops-bot": { botToken: "YOUR_TELEGRAM_BOT_TOKEN" },
      },
    },
  },
}
```

### Notas de campos

- `every`: intervalo do heartbeat (string de duracao; unidade padrao = minutos).
- `model`: substituicao opcional de modelo para execucoes de heartbeat (`provider/model`).
- `includeReasoning`: quando habilitado, tambem entrega a mensagem separada `Reasoning:` quando disponivel (mesmo formato que `/reasoning on`).
- `session`: chave de sessao opcional para execucoes de heartbeat.
  - `main` (padrao): sessao principal do agente.
  - Chave de sessao explicita (copie de `openclaw sessions --json` ou do [sessions CLI](/cli/sessions)).
  - Formatos de chave de sessao: veja [Sessions](/concepts/session) e [Groups](/concepts/groups).
- `target`:
  - `last` (padrao): entregar ao ultimo canal externo utilizado.
  - canal explicito: `whatsapp` / `telegram` / `discord` / `googlechat` / `slack` / `msteams` / `signal` / `imessage`.
  - `none`: executa o heartbeat, mas **nao entrega** externamente.
- `to`: substituicao opcional de destinatario (id especifico do canal, por exemplo E.164 para WhatsApp ou um chat id do Telegram).
- `accountId`: id de conta opcional para canais multi-conta. Quando `target: "last"`, o id da conta se aplica ao ultimo canal resolvido se ele suportar contas; caso contrario, e ignorado. Se o id da conta nao corresponder a uma conta configurada para o canal resolvido, a entrega e ignorada.
- `prompt`: substitui o corpo do prompt padrao (nao faz merge).
- `ackMaxChars`: maximo de caracteres permitidos apos `HEARTBEAT_OK` antes da entrega.
- `activeHours`: restringe execucoes de heartbeat a uma janela de tempo. Objeto com `start` (HH:MM, inclusivo), `end` (HH:MM exclusivo; `24:00` permitido para fim de dia), e `timezone` opcional.
  - Omitido ou `"user"`: usa seu `agents.defaults.userTimezone` se definido; caso contrario, recorre ao fuso horario do sistema host.
  - `"local"`: sempre usa o fuso horario do sistema host.
  - Qualquer identificador IANA (por exemplo, `America/New_York`): usado diretamente; se invalido, recorre ao comportamento `"user"` acima.
  - Fora da janela ativa, os heartbeats sao ignorados ate o proximo tick dentro da janela.

## Comportamento de entrega

- Os heartbeats executam na sessao principal do agente por padrao (`agent:<id>:<mainKey>`),
  ou `global` quando `session.scope = "global"`. Defina `session` para substituir por uma
  sessao de canal especifica (Discord/WhatsApp/etc.).
- `session` afeta apenas o contexto de execucao; a entrega e controlada por `target` e `to`.
- Para entregar a um canal/destinatario especifico, defina `target` + `to`. Com
  `target: "last"`, a entrega usa o ultimo canal externo para essa sessao.
- Se a fila principal estiver ocupada, o heartbeat e ignorado e tentado novamente mais tarde.
- Se `target` resultar em nenhum destino externo, a execucao ainda acontece, mas nenhuma
  mensagem de saida e enviada.
- Respostas apenas de heartbeat **nao** mantem a sessao ativa; o ultimo `updatedAt`
  e restaurado para que a expiracao por inatividade se comporte normalmente.

## Controles de visibilidade

Por padrao, reconhecimentos `HEARTBEAT_OK` sao suprimidos enquanto o conteudo de alerta e
entregue. Voce pode ajustar isso por canal ou por conta:

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false # Hide HEARTBEAT_OK (default)
      showAlerts: true # Show alert messages (default)
      useIndicator: true # Emit indicator events (default)
  telegram:
    heartbeat:
      showOk: true # Show OK acknowledgments on Telegram
  whatsapp:
    accounts:
      work:
        heartbeat:
          showAlerts: false # Suppress alert delivery for this account
```

Precedencia: por conta → por canal → padroes do canal → padroes embutidos.

### O que cada flag faz

- `showOk`: envia um reconhecimento `HEARTBEAT_OK` quando o modelo retorna uma resposta apenas OK.
- `showAlerts`: envia o conteudo do alerta quando o modelo retorna uma resposta nao-OK.
- `useIndicator`: emite eventos de indicador para superficies de status da UI.

Se **todos os tres** forem false, o OpenClaw ignora a execucao do heartbeat completamente (nenhuma chamada ao modelo).

### Exemplos por canal vs por conta

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false
      showAlerts: true
      useIndicator: true
  slack:
    heartbeat:
      showOk: true # all Slack accounts
    accounts:
      ops:
        heartbeat:
          showAlerts: false # suppress alerts for the ops account only
  telegram:
    heartbeat:
      showOk: true
```

### Padroes comuns

| Objetivo                                                | Configuracao                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Comportamento padrao (OKs silenciosos, alertas ligados) | _(nenhuma configuracao necessaria)_                                                      |
| Totalmente silencioso (sem mensagens, sem indicador)    | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: false }` |
| Apenas indicador (sem mensagens)                        | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: true }`  |
| OKs em apenas um canal                                  | `channels.telegram.heartbeat: { showOk: true }`                                          |

## HEARTBEAT.md (opcional)

Se um arquivo `HEARTBEAT.md` existir no workspace, o prompt padrao diz ao
agente para le-lo. Pense nisso como seu “checklist de heartbeat”: pequeno, estavel e
seguro para incluir a cada 30 minutos.

Se `HEARTBEAT.md` existir, mas estiver efetivamente vazio (apenas linhas em branco e cabecalhos
markdown como `# Heading`), o OpenClaw ignora a execucao do heartbeat para economizar chamadas de API.
Se o arquivo estiver ausente, o heartbeat ainda executa e o modelo decide o que fazer.

Mantenha-o pequeno (checklist curto ou lembretes) para evitar inflar o prompt.

Exemplo de `HEARTBEAT.md`:

```md
# Heartbeat checklist

- Quick scan: anything urgent in inboxes?
- If it’s daytime, do a lightweight check-in if nothing else is pending.
- If a task is blocked, write down _what is missing_ and ask Peter next time.
```

### O agente pode atualizar o HEARTBEAT.md?

Sim — se voce pedir.

`HEARTBEAT.md` e apenas um arquivo normal no workspace do agente, entao voce pode dizer ao
agente (em um chat normal) algo como:

- “Atualize `HEARTBEAT.md` para adicionar uma verificacao diaria de calendario.”
- “Reescreva `HEARTBEAT.md` para que fique mais curto e focado em acompanhamentos da caixa de entrada.”

Se voce quiser que isso aconteca proativamente, tambem pode incluir uma linha explicita no
prompt de heartbeat como: “Se o checklist ficar desatualizado, atualize HEARTBEAT.md
com um melhor.”

Nota de seguranca: nao coloque segredos (chaves de API, numeros de telefone, tokens privados) em
`HEARTBEAT.md` — ele passa a fazer parte do contexto do prompt.

## Despertar manual (sob demanda)

Voce pode enfileirar um evento de sistema e disparar um heartbeat imediato com:

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
```

Se varios agentes tiverem `heartbeat` configurado, um despertar manual executa imediatamente
os heartbeats de cada um desses agentes.

Use `--mode next-heartbeat` para aguardar o proximo tick agendado.

## Entrega de raciocinio (opcional)

Por padrao, os heartbeats entregam apenas o payload final de “resposta”.

Se voce quiser transparencia, habilite:

- `agents.defaults.heartbeat.includeReasoning: true`

Quando habilitado, os heartbeats tambem entregarao uma mensagem separada prefixada com
`Reasoning:` (mesmo formato que `/reasoning on`). Isso pode ser util quando o agente
esta gerenciando varias sessoes/codexes e voce quer ver por que ele decidiu te notificar —
mas tambem pode vazar mais detalhes internos do que voce deseja. Prefira manter desligado
em chats de grupo.

## Consciencia de custos

Os heartbeats executam turnos completos do agente. Intervalos mais curtos consomem mais tokens.
Mantenha `HEARTBEAT.md` pequeno e considere um `model` ou `target: "none"` mais barato se
voce quiser apenas atualizacoes de estado interno.
