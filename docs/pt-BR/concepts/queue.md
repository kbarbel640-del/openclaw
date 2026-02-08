---
summary: "Design da fila de comandos que serializa execucoes de auto-reply de entrada"
read_when:
  - Alterando a execucao ou concorrencia do auto-reply
title: "Fila de Comandos"
x-i18n:
  source_path: concepts/queue.md
  source_hash: 2104c24d200fb4f9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:01Z
---

# Fila de Comandos (2026-01-16)

Serializamos as execucoes de auto-reply de entrada (todos os canais) por meio de uma pequena fila em processo para evitar que multiplas execucoes de agentes colidam, ao mesmo tempo em que permitimos paralelismo seguro entre sessoes.

## Por que

- As execucoes de auto-reply podem ser caras (chamadas de LLM) e podem colidir quando varias mensagens de entrada chegam muito proximas no tempo.
- A serializacao evita competicao por recursos compartilhados (arquivos de sessao, logs, stdin da CLI) e reduz a chance de limites de taxa upstream.

## Como funciona

- Uma fila FIFO consciente de lanes drena cada lane com um limite de concorrencia configuravel (padrao 1 para lanes nao configuradas; main padrao 4, subagent 8).
- `runEmbeddedPiAgent` enfileira pela **chave de sessao** (lane `session:<key>`) para garantir apenas uma execucao ativa por sessao.
- Cada execucao de sessao e entao enfileirada em uma **lane global** (`main` por padrao) para que o paralelismo geral seja limitado por `agents.defaults.maxConcurrent`.
- Quando o log detalhado esta habilitado, execucoes enfileiradas emitem um aviso curto se aguardarem mais de ~2s antes de iniciar.
- Indicadores de digitacao ainda disparam imediatamente ao enfileirar (quando suportado pelo canal), entao a experiencia do usuario permanece inalterada enquanto aguardamos nossa vez.

## Modos de fila (por canal)

Mensagens de entrada podem direcionar a execucao atual, aguardar um turno de followup, ou fazer ambos:

- `steer`: injeta imediatamente na execucao atual (cancela chamadas de ferramenta pendentes apos o proximo limite de ferramenta). Se nao estiver em streaming, volta para followup.
- `followup`: enfileira para o proximo turno do agente apos o termino da execucao atual.
- `collect`: agrega todas as mensagens enfileiradas em **um unico** turno de followup (padrao). Se as mensagens tiverem como alvo canais/threads diferentes, elas drenam individualmente para preservar o roteamento.
- `steer-backlog` (tambem conhecido como `steer+backlog`): direciona agora **e** preserva a mensagem para um turno de followup.
- `interrupt` (legado): aborta a execucao ativa daquela sessao e, em seguida, executa a mensagem mais recente.
- `queue` (alias legado): igual a `steer`.

Steer-backlog significa que voce pode obter uma resposta de followup apos a execucao direcionada, portanto
superficies com streaming podem parecer duplicadas. Prefira `collect`/`steer` se voce quiser
uma resposta por mensagem de entrada.
Envie `/queue collect` como um comando independente (por sessao) ou defina `messages.queue.byChannel.discord: "collect"`.

Padroes (quando nao definidos na configuracao):

- Todas as superficies → `collect`

Configure globalmente ou por canal via `messages.queue`:

```json5
{
  messages: {
    queue: {
      mode: "collect",
      debounceMs: 1000,
      cap: 20,
      drop: "summarize",
      byChannel: { discord: "collect" },
    },
  },
}
```

## Opcoes de fila

As opcoes se aplicam a `followup`, `collect` e `steer-backlog` (e a `steer` quando ele volta para followup):

- `debounceMs`: aguarda silencio antes de iniciar um turno de followup (evita “continue, continue”).
- `cap`: maximo de mensagens enfileiradas por sessao.
- `drop`: politica de overflow (`old`, `new`, `summarize`).

Summarize mantem uma curta lista em topicos das mensagens descartadas e a injeta como um prompt sintetico de followup.
Padroes: `debounceMs: 1000`, `cap: 20`, `drop: summarize`.

## Substituicoes por sessao

- Envie `/queue <mode>` como um comando independente para armazenar o modo para a sessao atual.
- As opcoes podem ser combinadas: `/queue collect debounce:2s cap:25 drop:summarize`
- `/queue default` ou `/queue reset` limpa a substituicao da sessao.

## Escopo e garantias

- Aplica-se a execucoes de agentes de auto-reply em todos os canais de entrada que usam o pipeline de resposta do Gateway (WhatsApp web, Telegram, Slack, Discord, Signal, iMessage, webchat, etc.).
- A lane padrao (`main`) e em nivel de processo para entrada + heartbeats principais; defina `agents.defaults.maxConcurrent` para permitir varias sessoes em paralelo.
- Lanes adicionais podem existir (por exemplo, `cron`, `subagent`) para que jobs em background possam executar em paralelo sem bloquear respostas de entrada.
- Lanes por sessao garantem que apenas uma execucao de agente toque uma determinada sessao por vez.
- Sem dependencias externas ou threads de worker em background; TypeScript puro + promises.

## Solucao de problemas

- Se os comandos parecerem travados, habilite logs detalhados e procure por linhas “queued for …ms” para confirmar que a fila esta drenando.
- Se voce precisar da profundidade da fila, habilite logs detalhados e observe as linhas de temporizacao da fila.
