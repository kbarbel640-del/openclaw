---
summary: "Sub-agentes: criando execucoes de agentes isoladas que anunciam resultados de volta ao chat solicitante"
read_when:
  - Voce quer trabalho em segundo plano/paralelo via o agente
  - Voce esta alterando sessions_spawn ou a politica de ferramentas de sub-agente
title: "Sub-Agentes"
x-i18n:
  source_path: tools/subagents.md
  source_hash: 3c83eeed69a65dbb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:50Z
---

# Sub-agentes

Sub-agentes sao execucoes de agentes em segundo plano criadas a partir de uma execucao de agente existente. Eles rodam em sua propria sessao (`agent:<agentId>:subagent:<uuid>`) e, quando finalizados, **anunciam** seu resultado de volta ao canal de chat solicitante.

## Comando de barra

Use `/subagents` para inspecionar ou controlar execucoes de sub-agentes para a **sessao atual**:

- `/subagents list`
- `/subagents stop <id|#|all>`
- `/subagents log <id|#> [limit] [tools]`
- `/subagents info <id|#>`
- `/subagents send <id|#> <message>`

`/subagents info` mostra metadados da execucao (status, timestamps, id da sessao, caminho do transcript, limpeza).

Objetivos principais:

- Paralelizar trabalho de “pesquisa / tarefa longa / ferramenta lenta” sem bloquear a execucao principal.
- Manter sub-agentes isolados por padrao (separacao de sessao + sandboxing opcional).
- Manter a superficie de ferramentas dificil de usar incorretamente: sub-agentes **nao** recebem ferramentas de sessao por padrao.
- Evitar fan-out aninhado: sub-agentes nao podem criar sub-agentes.

Nota de custo: cada sub-agente tem seu **proprio** contexto e uso de tokens. Para tarefas pesadas ou repetitivas,
defina um modelo mais barato para sub-agentes e mantenha seu agente principal em um modelo de maior qualidade.
Voce pode configurar isso via `agents.defaults.subagents.model` ou sobrescritas por agente.

## Ferramenta

Use `sessions_spawn`:

- Inicia uma execucao de sub-agente (`deliver: false`, lane global: `subagent`)
- Em seguida executa uma etapa de anuncio e publica a resposta de anuncio no canal de chat solicitante
- Modelo padrao: herda do chamador, a menos que voce defina `agents.defaults.subagents.model` (ou por agente `agents.list[].subagents.model`); um `sessions_spawn.model` explicito ainda prevalece.
- Pensamento padrao: herda do chamador, a menos que voce defina `agents.defaults.subagents.thinking` (ou por agente `agents.list[].subagents.thinking`); um `sessions_spawn.thinking` explicito ainda prevalece.

Parametros da ferramenta:

- `task` (obrigatorio)
- `label?` (opcional)
- `agentId?` (opcional; criar sob outro id de agente se permitido)
- `model?` (opcional; sobrescreve o modelo do sub-agente; valores invalidos sao ignorados e o sub-agente roda no modelo padrao com um aviso no resultado da ferramenta)
- `thinking?` (opcional; sobrescreve o nivel de pensamento para a execucao do sub-agente)
- `runTimeoutSeconds?` (padrao `0`; quando definido, a execucao do sub-agente e abortada apos N segundos)
- `cleanup?` (`delete|keep`, padrao `keep`)

Lista de permissao:

- `agents.list[].subagents.allowAgents`: lista de ids de agentes que podem ser direcionados via `agentId` (`["*"]` para permitir qualquer). Padrao: apenas o agente solicitante.

Descoberta:

- Use `agents_list` para ver quais ids de agentes estao atualmente permitidos para `sessions_spawn`.

Auto-arquivamento:

- Sessoes de sub-agentes sao arquivadas automaticamente apos `agents.defaults.subagents.archiveAfterMinutes` (padrao: 60).
- O arquivamento usa `sessions.delete` e renomeia o transcript para `*.deleted.<timestamp>` (mesma pasta).
- `cleanup: "delete"` arquiva imediatamente apos o anuncio (ainda mantem o transcript via renomeacao).
- O auto-arquivamento e de melhor esforco; timers pendentes sao perdidos se o gateway reiniciar.
- `runTimeoutSeconds` **nao** faz auto-arquivamento; ele apenas para a execucao. A sessao permanece ate o auto-arquivamento.

## Autenticacao

A autenticacao de sub-agente e resolvida por **id de agente**, nao por tipo de sessao:

- A chave de sessao do sub-agente e `agent:<agentId>:subagent:<uuid>`.
- O armazenamento de auth e carregado do `agentDir` desse agente.
- Os perfis de auth do agente principal sao mesclados como **fallback**; perfis do agente substituem os perfis principais em caso de conflito.

Nota: a mesclagem e aditiva, entao perfis principais estao sempre disponiveis como fallback. Autenticacao totalmente isolada por agente ainda nao e suportada.

## Anuncio

Sub-agentes reportam de volta por meio de uma etapa de anuncio:

- A etapa de anuncio roda dentro da sessao do sub-agente (nao da sessao solicitante).
- Se o sub-agente responder exatamente `ANNOUNCE_SKIP`, nada e publicado.
- Caso contrario, a resposta de anuncio e publicada no canal de chat solicitante por meio de uma chamada de acompanhamento `agent` (`deliver=true`).
- Respostas de anuncio preservam o roteamento de thread/topico quando disponivel (threads do Slack, topicos do Telegram, threads do Matrix).
- Mensagens de anuncio sao normalizadas para um template estavel:
  - `Status:` derivado do resultado da execucao (`success`, `error`, `timeout` ou `unknown`).
  - `Result:` o conteudo de resumo da etapa de anuncio (ou `(not available)` se ausente).
  - `Notes:` detalhes de erro e outros contextos uteis.
- `Status` nao e inferido da saida do modelo; vem de sinais de resultado em tempo de execucao.

Payloads de anuncio incluem uma linha de estatisticas ao final (mesmo quando encapsulados):

- Tempo de execucao (por exemplo, `runtime 5m12s`)
- Uso de tokens (entrada/saida/total)
- Custo estimado quando a precificacao do modelo esta configurada (`models.providers.*.models[].cost`)
- `sessionKey`, `sessionId` e caminho do transcript (para que o agente principal possa buscar o historico via `sessions_history` ou inspecionar o arquivo em disco)

## Politica de Ferramentas (ferramentas de sub-agente)

Por padrao, sub-agentes recebem **todas as ferramentas exceto ferramentas de sessao**:

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

Sobrescreva via configuracao:

```json5
{
  agents: {
    defaults: {
      subagents: {
        maxConcurrent: 1,
      },
    },
  },
  tools: {
    subagents: {
      tools: {
        // deny wins
        deny: ["gateway", "cron"],
        // if allow is set, it becomes allow-only (deny still wins)
        // allow: ["read", "exec", "process"]
      },
    },
  },
}
```

## Concorrencia

Sub-agentes usam uma lane dedicada de fila em processo:

- Nome da lane: `subagent`
- Concorrencia: `agents.defaults.subagents.maxConcurrent` (padrao `8`)

## Parar

- Enviar `/stop` no chat solicitante aborta a sessao solicitante e para quaisquer execucoes ativas de sub-agentes criadas a partir dela.

## Limitacoes

- O anuncio de sub-agente e de **melhor esforco**. Se o gateway reiniciar, trabalho pendente de “anunciar de volta” e perdido.
- Sub-agentes ainda compartilham os mesmos recursos de processo do gateway; trate `maxConcurrent` como uma valvula de seguranca.
- `sessions_spawn` e sempre nao bloqueante: ele retorna `{ status: "accepted", runId, childSessionKey }` imediatamente.
- O contexto do sub-agente injeta apenas `AGENTS.md` + `TOOLS.md` (sem `SOUL.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md` ou `BOOTSTRAP.md`).
