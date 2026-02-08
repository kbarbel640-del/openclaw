---
summary: "Orientacoes para escolher entre heartbeat e cron jobs para automacao"
read_when:
  - Decidindo como agendar tarefas recorrentes
  - Configurando monitoramento em segundo plano ou notificacoes
  - Otimizando o uso de tokens para verificacoes periodicas
title: "Cron vs Heartbeat"
x-i18n:
  source_path: automation/cron-vs-heartbeat.md
  source_hash: fca1006df9d2e842
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:21Z
---

# Cron vs Heartbeat: Quando usar cada um

Tanto heartbeats quanto cron jobs permitem executar tarefas em um agendamento. Este guia ajuda voce a escolher o mecanismo certo para o seu caso de uso.

## Guia rapido de decisao

| Caso de uso                                      | Recomendado         | Por que                                              |
| ------------------------------------------------ | ------------------- | ---------------------------------------------------- |
| Verificar inbox a cada 30 min                    | Heartbeat           | Agrupa com outras verificacoes, sensivel ao contexto |
| Enviar relatorio diario as 9h em ponto           | Cron (isolado)      | Temporizacao exata necessaria                        |
| Monitorar calendario para eventos futuros        | Heartbeat           | Ajuste natural para consciencia periodica            |
| Executar analise profunda semanal                | Cron (isolado)      | Tarefa independente, pode usar modelo diferente      |
| Lembre-me em 20 minutos                          | Cron (main, `--at`) | Execucao unica com temporizacao precisa              |
| Verificacao de saude do projeto em segundo plano | Heartbeat           | Aproveita o ciclo existente                          |

## Heartbeat: Consciencia periodica

Heartbeats executam na **sessao principal** em um intervalo regular (padrao: 30 min). Eles foram projetados para que o agente verifique as coisas e traga a tona qualquer coisa importante.

### Quando usar heartbeat

- **Multiplas verificacoes periodicas**: Em vez de 5 cron jobs separados verificando inbox, calendario, clima, notificacoes e status do projeto, um unico heartbeat pode agrupar tudo isso.
- **Decisoes sensiveis ao contexto**: O agente tem contexto completo da sessao principal, entao pode tomar decisoes inteligentes sobre o que e urgente vs. o que pode esperar.
- **Continuidade conversacional**: Execucoes de heartbeat compartilham a mesma sessao, entao o agente se lembra de conversas recentes e pode acompanhar naturalmente.
- **Monitoramento de baixo overhead**: Um heartbeat substitui muitas pequenas tarefas de polling.

### Vantagens do heartbeat

- **Agrupa multiplas verificacoes**: Um turno do agente pode revisar inbox, calendario e notificacoes juntos.
- **Reduz chamadas de API**: Um unico heartbeat e mais barato do que 5 cron jobs isolados.
- **Sensivel ao contexto**: O agente sabe no que voce tem trabalhado e pode priorizar adequadamente.
- **Supressao inteligente**: Se nada precisar de atencao, o agente responde `HEARTBEAT_OK` e nenhuma mensagem e entregue.
- **Temporizacao natural**: Deriva levemente com base na carga da fila, o que e aceitavel para a maioria dos monitoramentos.

### Exemplo de heartbeat: checklist HEARTBEAT.md

```md
# Heartbeat checklist

- Check email for urgent messages
- Review calendar for events in next 2 hours
- If a background task finished, summarize results
- If idle for 8+ hours, send a brief check-in
```

O agente le isso em cada heartbeat e trata todos os itens em um unico turno.

### Configurando heartbeat

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m", // interval
        target: "last", // where to deliver alerts
        activeHours: { start: "08:00", end: "22:00" }, // optional
      },
    },
  },
}
```

Veja [Heartbeat](/gateway/heartbeat) para mais detalhes de configuracao.

## Cron: Agendamento preciso

Cron jobs executam em **horarios exatos** e podem rodar em sessoes isoladas sem afetar o contexto principal.

### Quando usar cron

- **Temporizacao exata necessaria**: "Envie isso as 9:00 da manha toda segunda-feira" (nao "em algum momento por volta das 9").
- **Tarefas independentes**: Tarefas que nao precisam de contexto conversacional.
- **Modelo/pensamento diferente**: Analises pesadas que justificam um modelo mais poderoso.
- **Lembretes de execucao unica**: "Lembre-me em 20 minutos" com `--at`.
- **Tarefas ruidosas/frequentes**: Tarefas que baguncariam o historico da sessao principal.
- **Gatilhos externos**: Tarefas que devem rodar independentemente de o agente estar ativo de outra forma.

### Vantagens do cron

- **Temporizacao exata**: Expressoes cron de 5 campos com suporte a fuso horario.
- **Isolamento de sessao**: Executa em `cron:<jobId>` sem poluir o historico principal.
- **Substituicao de modelo**: Use um modelo mais barato ou mais poderoso por job.
- **Controle de entrega**: Jobs isolados usam `announce` (resumo) por padrao; escolha `none` conforme necessario.
- **Entrega imediata**: O modo announce publica diretamente sem esperar pelo heartbeat.
- **Nenhum contexto do agente necessario**: Executa mesmo se a sessao principal estiver ociosa ou compactada.
- **Suporte a execucao unica**: `--at` para timestamps futuros precisos.

### Exemplo de cron: briefing matinal diario

```bash
openclaw cron add \
  --name "Morning briefing" \
  --cron "0 7 * * *" \
  --tz "America/New_York" \
  --session isolated \
  --message "Generate today's briefing: weather, calendar, top emails, news summary." \
  --model opus \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

Isso executa exatamente as 7:00 da manha no horario de Nova York, usa Opus para qualidade e anuncia um resumo diretamente no WhatsApp.

### Exemplo de cron: lembrete de execucao unica

```bash
openclaw cron add \
  --name "Meeting reminder" \
  --at "20m" \
  --session main \
  --system-event "Reminder: standup meeting starts in 10 minutes." \
  --wake now \
  --delete-after-run
```

Veja [Cron jobs](/automation/cron-jobs) para referencia completa de CLI.

## Fluxograma de decisao

```
Does the task need to run at an EXACT time?
  YES -> Use cron
  NO  -> Continue...

Does the task need isolation from main session?
  YES -> Use cron (isolated)
  NO  -> Continue...

Can this task be batched with other periodic checks?
  YES -> Use heartbeat (add to HEARTBEAT.md)
  NO  -> Use cron

Is this a one-shot reminder?
  YES -> Use cron with --at
  NO  -> Continue...

Does it need a different model or thinking level?
  YES -> Use cron (isolated) with --model/--thinking
  NO  -> Use heartbeat
```

## Combinando ambos

A configuracao mais eficiente usa **ambos**:

1. **Heartbeat** cuida do monitoramento rotineiro (inbox, calendario, notificacoes) em um unico turno agrupado a cada 30 minutos.
2. **Cron** cuida de agendamentos precisos (relatorios diarios, revisoes semanais) e lembretes de execucao unica.

### Exemplo: configuracao de automacao eficiente

**HEARTBEAT.md** (verificado a cada 30 min):

```md
# Heartbeat checklist

- Scan inbox for urgent emails
- Check calendar for events in next 2h
- Review any pending tasks
- Light check-in if quiet for 8+ hours
```

**Cron jobs** (temporizacao precisa):

```bash
# Daily morning briefing at 7am
openclaw cron add --name "Morning brief" --cron "0 7 * * *" --session isolated --message "..." --announce

# Weekly project review on Mondays at 9am
openclaw cron add --name "Weekly review" --cron "0 9 * * 1" --session isolated --message "..." --model opus

# One-shot reminder
openclaw cron add --name "Call back" --at "2h" --session main --system-event "Call back the client" --wake now
```

## Lobster: Workflows deterministicas com aprovacoes

Lobster e o runtime de workflow para **pipelines de ferramentas em varias etapas** que precisam de execucao deterministica e aprovacoes explicitas.
Use quando a tarefa e mais do que um unico turno do agente, e voce quer um workflow retomavel com checkpoints humanos.

### Quando Lobster se encaixa

- **Automacao em varias etapas**: Voce precisa de um pipeline fixo de chamadas de ferramentas, nao de um prompt pontual.
- **Portas de aprovacao**: Efeitos colaterais devem pausar ate voce aprovar, e depois retomar.
- **Execucoes retomaveis**: Continue um workflow pausado sem reexecutar etapas anteriores.

### Como ele se combina com heartbeat e cron

- **Heartbeat/cron** decidem _quando_ uma execucao acontece.
- **Lobster** define _quais etapas_ acontecem quando a execucao comeca.

Para workflows agendados, use cron ou heartbeat para acionar um turno do agente que chama o Lobster.
Para workflows ad-hoc, chame o Lobster diretamente.

### Notas operacionais (do codigo)

- O Lobster roda como um **subprocesso local** (`lobster` CLI) em modo de ferramenta e retorna um **envelope JSON**.
- Se a ferramenta retornar `needs_approval`, voce retoma com um `resumeToken` e a flag `approve`.
- A ferramenta e um **plugin opcional**; habilite de forma aditiva via `tools.alsoAllow: ["lobster"]` (recomendado).
- Se voce passar `lobsterPath`, ele deve ser um **caminho absoluto**.

Veja [Lobster](/tools/lobster) para uso completo e exemplos.

## Sessao Principal vs Sessao Isolada

Tanto heartbeat quanto cron podem interagir com a sessao principal, mas de formas diferentes:

|           | Heartbeat                      | Cron (main)                       | Cron (isolado)           |
| --------- | ------------------------------ | --------------------------------- | ------------------------ |
| Sessao    | Principal                      | Principal (via evento do sistema) | `cron:<jobId>`           |
| Historico | Compartilhado                  | Compartilhado                     | Novo a cada execucao     |
| Contexto  | Completo                       | Completo                          | Nenhum (comeca limpo)    |
| Modelo    | Modelo da sessao principal     | Modelo da sessao principal        | Pode substituir          |
| Saida     | Entregue se nao `HEARTBEAT_OK` | Prompt de heartbeat + evento      | Anunciar resumo (padrao) |

### Quando usar cron na sessao principal

Use `--session main` com `--system-event` quando voce quiser:

- Que o lembrete/evento apareca no contexto da sessao principal
- Que o agente lide com isso durante o proximo heartbeat com contexto completo
- Nenhuma execucao isolada separada

```bash
openclaw cron add \
  --name "Check project" \
  --every "4h" \
  --session main \
  --system-event "Time for a project health check" \
  --wake now
```

### Quando usar cron isolado

Use `--session isolated` quando voce quiser:

- Um estado limpo sem contexto previo
- Modelo ou configuracoes de pensamento diferentes
- Anunciar resumos diretamente em um canal
- Historico que nao bagunce a sessao principal

```bash
openclaw cron add \
  --name "Deep analysis" \
  --cron "0 6 * * 0" \
  --session isolated \
  --message "Weekly codebase analysis..." \
  --model opus \
  --thinking high \
  --announce
```

## Consideracoes de custo

| Mecanismo      | Perfil de custo                                                 |
| -------------- | --------------------------------------------------------------- |
| Heartbeat      | Um turno a cada N minutos; escala com o tamanho do HEARTBEAT.md |
| Cron (main)    | Adiciona evento ao proximo heartbeat (sem turno isolado)        |
| Cron (isolado) | Turno completo do agente por job; pode usar modelo mais barato  |

**Dicas**:

- Mantenha `HEARTBEAT.md` pequeno para minimizar overhead de tokens.
- Agrupe verificacoes semelhantes no heartbeat em vez de varios cron jobs.
- Use `target: "none"` no heartbeat se voce quiser apenas processamento interno.
- Use cron isolado com um modelo mais barato para tarefas rotineiras.

## Relacionado

- [Heartbeat](/gateway/heartbeat) - configuracao completa de heartbeat
- [Cron jobs](/automation/cron-jobs) - referencia completa de CLI e API de cron
- [System](/cli/system) - eventos do sistema + controles de heartbeat
