---
summary: "Fluxo de mensagens, sessoes, enfileiramento e visibilidade do raciocinio"
read_when:
  - Explicar como mensagens de entrada se tornam respostas
  - Esclarecer sessoes, modos de enfileiramento ou comportamento de streaming
  - Documentar visibilidade do raciocinio e implicacoes de uso
title: "Mensagens"
x-i18n:
  source_path: concepts/messages.md
  source_hash: 32a1b0c50616c550
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:01Z
---

# Mensagens

Esta pagina conecta como o OpenClaw lida com mensagens de entrada, sessoes, enfileiramento,
streaming e visibilidade do raciocinio.

## Fluxo de mensagens (alto nivel)

```
Inbound message
  -> routing/bindings -> session key
  -> queue (if a run is active)
  -> agent run (streaming + tools)
  -> outbound replies (channel limits + chunking)
```

Os principais ajustes ficam na configuracao:

- `messages.*` para prefixos, enfileiramento e comportamento em grupos.
- `agents.defaults.*` para streaming por blocos e padroes de chunking.
- Substituicoes por canal (`channels.whatsapp.*`, `channels.telegram.*`, etc.) para limites e alternancias de streaming.

Veja [Configuracao](/gateway/configuration) para o esquema completo.

## Deduplicacao de entrada

Canais podem reenviar a mesma mensagem apos reconexoes. O OpenClaw mantem um cache de curta duracao
chaveado por canal/conta/par/sessao/id da mensagem para que entregas duplicadas
nao disparem outra execucao do agente.

## Debouncing de entrada

Mensagens consecutivas rapidas do **mesmo remetente** podem ser agrupadas em um unico
turno do agente via `messages.inbound`. O debouncing e delimitado por canal + conversa
e usa a mensagem mais recente para encadeamento/IDs de resposta.

Configuracao (padrao global + substituicoes por canal):

```json5
{
  messages: {
    inbound: {
      debounceMs: 2000,
      byChannel: {
        whatsapp: 5000,
        slack: 1500,
        discord: 1500,
      },
    },
  },
}
```

Observacoes:

- O debounce se aplica a mensagens **apenas de texto**; midia/anexos liberam imediatamente.
- Comandos de controle ignoram o debouncing para permanecerem independentes.

## Sessoes e dispositivos

As sessoes pertencem ao gateway, nao aos clientes.

- Conversas diretas colapsam na chave principal de sessao do agente.
- Grupos/canais recebem suas proprias chaves de sessao.
- O armazenamento de sessoes e os transcripts vivem no host do gateway.

Multiplos dispositivos/canais podem mapear para a mesma sessao, mas o historico nao e
totalmente sincronizado de volta para todos os clientes. Recomendacao: use um dispositivo
principal para conversas longas para evitar contexto divergente. A UI de Controle e a TUI
sempre exibem o transcript da sessao mantida pelo gateway, portanto sao a fonte da verdade.

Detalhes: [Gerenciamento de sessao](/concepts/session).

## Corpos de entrada e contexto de historico

O OpenClaw separa o **corpo do prompt** do **corpo do comando**:

- `Body`: texto do prompt enviado ao agente. Pode incluir envelopes do canal e
  wrappers de historico opcionais.
- `CommandBody`: texto bruto do usuario para analise de diretivas/comandos.
- `RawBody`: alias legado para `CommandBody` (mantido por compatibilidade).

Quando um canal fornece historico, ele usa um wrapper compartilhado:

- `[Chat messages since your last reply - for context]`
- `[Current message - respond to this]`

Para **conversas nao diretas** (grupos/canais/salas), o **corpo da mensagem atual** recebe um prefixo com o
rotulo do remetente (mesmo estilo usado para entradas de historico). Isso mantem mensagens
em tempo real e mensagens enfileiradas/de historico consistentes no prompt do agente.

Os buffers de historico sao **apenas pendentes**: incluem mensagens de grupo que **nao**
dispararam uma execucao (por exemplo, mensagens com gate por mencao) e **excluem** mensagens
ja presentes no transcript da sessao.

A remocao de diretivas se aplica apenas a secao da **mensagem atual**, para que o historico
permaneça intacto. Canais que encapsulam historico devem definir `CommandBody` (ou
`RawBody`) com o texto original da mensagem e manter `Body` como o prompt combinado.
Buffers de historico sao configuraveis via `messages.groupChat.historyLimit` (padrao
global) e substituicoes por canal como `channels.slack.historyLimit` ou
`channels.telegram.accounts.<id>.historyLimit` (defina `0` para desativar).

## Enfileiramento e followups

Se uma execucao ja estiver ativa, mensagens de entrada podem ser enfileiradas, direcionadas
para a execucao atual ou coletadas para um turno de followup.

- Configure via `messages.queue` (e `messages.queue.byChannel`).
- Modos: `interrupt`, `steer`, `followup`, `collect`, alem de variantes de backlog.

Detalhes: [Enfileiramento](/concepts/queue).

## Streaming, chunking e batching

O streaming por blocos envia respostas parciais conforme o modelo produz blocos de texto.
O chunking respeita limites de texto do canal e evita dividir codigo cercado.

Configuracoes principais:

- `agents.defaults.blockStreamingDefault` (`on|off`, padrao desligado)
- `agents.defaults.blockStreamingBreak` (`text_end|message_end`)
- `agents.defaults.blockStreamingChunk` (`minChars|maxChars|breakPreference`)
- `agents.defaults.blockStreamingCoalesce` (batching baseado em ociosidade)
- `agents.defaults.humanDelay` (pausa com aspecto humano entre respostas por bloco)
- Substituicoes por canal: `*.blockStreaming` e `*.blockStreamingCoalesce` (canais nao Telegram exigem `*.blockStreaming: true` explicito)

Detalhes: [Streaming + chunking](/concepts/streaming).

## Visibilidade do raciocinio e tokens

O OpenClaw pode expor ou ocultar o raciocinio do modelo:

- `/reasoning on|off|stream` controla a visibilidade.
- Conteudo de raciocinio ainda conta para o uso de tokens quando produzido pelo modelo.
- O Telegram suporta streaming de raciocinio no balao de rascunho.

Detalhes: [Diretivas de pensamento + raciocinio](/tools/thinking) e [Uso de tokens](/token-use).

## Prefixos, encadeamento e respostas

A formatacao de mensagens de saida e centralizada em `messages`:

- `messages.responsePrefix`, `channels.<channel>.responsePrefix` e `channels.<channel>.accounts.<id>.responsePrefix` (cascata de prefixos de saida), alem de `channels.whatsapp.messagePrefix` (prefixo de entrada do WhatsApp)
- Encadeamento de respostas via `replyToMode` e padroes por canal

Detalhes: [Configuracao](/gateway/configuration#messages) e documentacao dos canais.
