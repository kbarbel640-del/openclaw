---
summary: "Referencia de CLI para `openclaw system` (eventos do sistema, heartbeat, presenca)"
read_when:
  - Voce quer enfileirar um evento de sistema sem criar um job cron
  - Voce precisa habilitar ou desabilitar heartbeats
  - Voce quer inspecionar entradas de presenca do sistema
title: "system"
x-i18n:
  source_path: cli/system.md
  source_hash: 36ae5dbdec327f5a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:44Z
---

# `openclaw system`

Auxiliares em nivel de sistema para o Gateway: enfileirar eventos do sistema, controlar heartbeats
e visualizar presenca.

## Comandos comuns

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
openclaw system heartbeat enable
openclaw system heartbeat last
openclaw system presence
```

## `system event`

Enfileira um evento de sistema na sessao **main**. O proximo heartbeat ira injeta-lo
como uma linha `System:` no prompt. Use `--mode now` para acionar o heartbeat
imediatamente; `next-heartbeat` aguarda o proximo tick agendado.

Flags:

- `--text <text>`: texto obrigatorio do evento de sistema.
- `--mode <mode>`: `now` ou `next-heartbeat` (padrao).
- `--json`: saida legivel por maquina.

## `system heartbeat last|enable|disable`

Controles de heartbeat:

- `last`: mostra o ultimo evento de heartbeat.
- `enable`: liga os heartbeats novamente (use isto se eles foram desabilitados).
- `disable`: pausa os heartbeats.

Flags:

- `--json`: saida legivel por maquina.

## `system presence`

Lista as entradas atuais de presenca do sistema que o Gateway conhece (nos,
instancias e linhas de status semelhantes).

Flags:

- `--json`: saida legivel por maquina.

## Notas

- Requer um Gateway em execucao acessivel pela sua configuracao atual (local ou remota).
- Eventos de sistema sao efemeros e nao sao persistidos entre reinicializacoes.
