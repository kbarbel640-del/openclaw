---
summary: "Solucione problemas de agendamento e entrega de cron e heartbeat"
read_when:
  - O cron não executou
  - O cron executou, mas nenhuma mensagem foi entregue
  - O heartbeat parece silencioso ou ignorado
title: "Solucao de problemas de automacao"
x-i18n:
  source_path: automation/troubleshooting.md
  source_hash: 10eca4a59119910f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:11Z
---

# Solucao de problemas de automacao

Use esta pagina para problemas de agendamento e entrega (`cron` + `heartbeat`).

## Escada de comandos

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Em seguida, execute as verificacoes de automacao:

```bash
openclaw cron status
openclaw cron list
openclaw system heartbeat last
```

## Cron nao dispara

```bash
openclaw cron status
openclaw cron list
openclaw cron runs --id <jobId> --limit 20
openclaw logs --follow
```

Uma boa saida se parece com:

- `cron status` indica ativado e um `nextWakeAtMs` futuro.
- O job esta ativado e possui um agendamento/fuso horario valido.
- `cron runs` mostra `ok` ou um motivo explicito de ignorar.

Assinaturas comuns:

- `cron: scheduler disabled; jobs will not run automatically` → cron desativado na configuracao/variaveis de ambiente.
- `cron: timer tick failed` → o tick do agendador falhou; inspecione o contexto de pilha/log ao redor.
- `reason: not-due` na saida de execucao → execucao manual chamada sem `--force` e o job ainda nao estava devido.

## Cron disparou, mas nao houve entrega

```bash
openclaw cron runs --id <jobId> --limit 20
openclaw cron list
openclaw channels status --probe
openclaw logs --follow
```

Uma boa saida se parece com:

- O status da execucao e `ok`.
- O modo/target de entrega estao definidos para jobs isolados.
- A sondagem do canal informa que o canal de destino esta conectado.

Assinaturas comuns:

- A execucao foi bem-sucedida, mas o modo de entrega e `none` → nenhuma mensagem externa e esperada.
- Destino de entrega ausente/invalido (`channel`/`to`) → a execucao pode ter sucesso internamente, mas ignorar a saida externa.
- Erros de autenticacao do canal (`unauthorized`, `missing_scope`, `Forbidden`) → entrega bloqueada por credenciais/permissoes do canal.

## Heartbeat suprimido ou ignorado

```bash
openclaw system heartbeat last
openclaw logs --follow
openclaw config get agents.defaults.heartbeat
openclaw channels status --probe
```

Uma boa saida se parece com:

- Heartbeat ativado com intervalo diferente de zero.
- O ultimo resultado de heartbeat e `ran` (ou o motivo de ignorar e compreendido).

Assinaturas comuns:

- `heartbeat skipped` com `reason=quiet-hours` → fora de `activeHours`.
- `requests-in-flight` → a via principal esta ocupada; heartbeat adiado.
- `empty-heartbeat-file` → `HEARTBEAT.md` existe, mas nao tem conteudo acionavel.
- `alerts-disabled` → configuracoes de visibilidade suprimem mensagens de heartbeat de saida.

## Armadilhas de fuso horario e activeHours

```bash
openclaw config get agents.defaults.heartbeat.activeHours
openclaw config get agents.defaults.heartbeat.activeHours.timezone
openclaw config get agents.defaults.userTimezone || echo "agents.defaults.userTimezone not set"
openclaw cron list
openclaw logs --follow
```

Regras rapidas:

- `Config path not found: agents.defaults.userTimezone` significa que a chave nao esta definida; o heartbeat recorre ao fuso horario do host (ou `activeHours.timezone` se definido).
- Cron sem `--tz` usa o fuso horario do host do gateway.
- Heartbeat `activeHours` usa a resolucao de fuso horario configurada (`user`, `local` ou IANA tz explicito).
- Timestamps ISO sem fuso horario sao tratados como UTC para agendamentos de cron `at`.

Assinaturas comuns:

- Jobs executam no horario de relogio errado apos mudancas no fuso horario do host.
- Heartbeat sempre ignorado durante o seu horario diurno porque `activeHours.timezone` esta errado.

Relacionado:

- [/automation/cron-jobs](/automation/cron-jobs)
- [/gateway/heartbeat](/gateway/heartbeat)
- [/automation/cron-vs-heartbeat](/automation/cron-vs-heartbeat)
- [/concepts/timezone](/concepts/timezone)
