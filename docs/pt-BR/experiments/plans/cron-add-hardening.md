---
summary: "Endurecer o tratamento de entrada de cron.add, alinhar esquemas e melhorar as ferramentas de UI/agente de cron"
owner: "openclaw"
status: "complete"
last_updated: "2026-01-05"
title: "Endurecimento do Cron Add"
x-i18n:
  source_path: experiments/plans/cron-add-hardening.md
  source_hash: d7e469674bd9435b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:10Z
---

# Endurecimento do Cron Add e Alinhamento de Esquemas

## Contexto

Logs recentes do Gateway mostram falhas repetidas de `cron.add` com parâmetros inválidos (ausência de `sessionTarget`, `wakeMode`, `payload` e `schedule` malformado). Isso indica que pelo menos um cliente (provavelmente o caminho de chamada da ferramenta do agente) está enviando payloads de job encapsulados ou parcialmente especificados. Separadamente, há divergência entre enums de provedores de cron no TypeScript, no esquema do Gateway, nas flags da CLI e nos tipos de formulário da UI, além de uma incompatibilidade na UI para `cron.status` (espera `jobCount` enquanto o Gateway retorna `jobs`).

## Objetivos

- Parar o spam de `cron.add` INVALID_REQUEST normalizando payloads encapsulados comuns e inferindo campos `kind` ausentes.
- Alinhar listas de provedores de cron entre o esquema do Gateway, tipos de cron, documentação da CLI e formulários da UI.
- Tornar explícito o esquema da ferramenta de cron do agente para que o LLM produza payloads de job corretos.
- Corrigir a exibição da contagem de jobs de status de cron na Control UI.
- Adicionar testes para cobrir a normalização e o comportamento da ferramenta.

## Não objetivos

- Alterar a semântica de agendamento de cron ou o comportamento de execução de jobs.
- Adicionar novos tipos de agendamento ou parsing de expressões cron.
- Reformular a UI/UX de cron além das correções de campos necessárias.

## Descobertas (lacunas atuais)

- `CronPayloadSchema` no Gateway exclui `signal` + `imessage`, enquanto os tipos TS os incluem.
- O CronStatus da Control UI espera `jobCount`, mas o Gateway retorna `jobs`.
- O esquema da ferramenta de cron do agente permite objetos `job` arbitrários, possibilitando entradas malformadas.
- O Gateway valida estritamente `cron.add` sem normalização, portanto payloads encapsulados falham.

## O que mudou

- `cron.add` e `cron.update` agora normalizam formatos de encapsulamento comuns e inferem campos `kind` ausentes.
- O esquema da ferramenta de cron do agente corresponde ao esquema do Gateway, o que reduz payloads inválidos.
- Enums de provedores foram alinhados entre Gateway, CLI, UI e seletor do macOS.
- A Control UI usa o campo de contagem `jobs` do Gateway para status.

## Comportamento atual

- **Normalização:** payloads encapsulados de `data`/`job` são desembrulhados; `schedule.kind` e `payload.kind` são inferidos quando seguro.
- **Padrões:** padrões seguros são aplicados para `wakeMode` e `sessionTarget` quando ausentes.
- **Provedores:** Discord/Slack/Signal/iMessage agora são apresentados de forma consistente na CLI/UI.

Veja [Cron jobs](/automation/cron-jobs) para o formato normalizado e exemplos.

## Verificação

- Observe os logs do Gateway para redução de erros `cron.add` INVALID_REQUEST.
- Confirme que o status de cron da Control UI mostra a contagem de jobs após atualizar.

## Acompanhamentos opcionais

- Smoke manual da Control UI: adicionar um job de cron por provedor + verificar a contagem de jobs de status.

## Perguntas em aberto

- `cron.add` deve aceitar `state` explícito dos clientes (atualmente não permitido pelo esquema)?
- Devemos permitir `webchat` como um provedor de entrega explícito (atualmente filtrado na resolução de entrega)?
