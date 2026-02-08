---
summary: "Ciclo de vida do loop do agente, streams e semântica de espera"
read_when:
  - Voce precisa de um passo a passo exato do loop do agente ou dos eventos do ciclo de vida
title: "Loop do Agente"
x-i18n:
  source_path: concepts/agent-loop.md
  source_hash: 0775b96eb3451e13
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:00Z
---

# Loop do Agente (OpenClaw)

Um loop agentico é a execucao completa “real” de um agente: entrada → montagem de contexto → inferencia do modelo →
execucao de ferramentas → respostas em streaming → persistencia. Ele é o caminho autoritativo que transforma uma mensagem
em acoes e uma resposta final, mantendo o estado da sessao consistente.

No OpenClaw, um loop é uma unica execucao serializada por sessao que emite eventos de ciclo de vida e de stream
conforme o modelo pensa, chama ferramentas e transmite a saida. Este documento explica como esse loop autentico
é conectado de ponta a ponta.

## Pontos de entrada

- Gateway RPC: `agent` e `agent.wait`.
- CLI: comando `agent`.

## Como funciona (visao de alto nivel)

1. O RPC `agent` valida parametros, resolve a sessao (sessionKey/sessionId), persiste metadados da sessao e retorna `{ runId, acceptedAt }` imediatamente.
2. `agentCommand` executa o agente:
   - resolve o modelo + padroes de thinking/verbose
   - carrega o snapshot de Skills
   - chama `runEmbeddedPiAgent` (runtime pi-agent-core)
   - emite **fim/erro de ciclo de vida** se o loop incorporado nao emitir um
3. `runEmbeddedPiAgent`:
   - serializa execucoes via filas por sessao + filas globais
   - resolve o modelo + perfil de autenticacao e constroi a sessao do pi
   - assina eventos do pi e faz streaming de deltas do assistente/ferramenta
   - aplica timeout -> aborta a execucao se excedido
   - retorna payloads + metadados de uso
4. `subscribeEmbeddedPiSession` faz a ponte dos eventos do pi-agent-core para o stream `agent` do OpenClaw:
   - eventos de ferramenta => `stream: "tool"`
   - deltas do assistente => `stream: "assistant"`
   - eventos de ciclo de vida => `stream: "lifecycle"` (`phase: "start" | "end" | "error"`)
5. `agent.wait` usa `waitForAgentJob`:
   - espera por **fim/erro de ciclo de vida** para `runId`
   - retorna `{ status: ok|error|timeout, startedAt, endedAt, error? }`

## Enfileiramento + concorrencia

- As execucoes sao serializadas por chave de sessao (faixa da sessao) e opcionalmente por uma faixa global.
- Isso evita corridas de ferramentas/sessao e mantem o historico da sessao consistente.
- Canais de mensageria podem escolher modos de fila (collect/steer/followup) que alimentam esse sistema de faixas.
  Veja [Command Queue](/concepts/queue).

## Preparacao de sessao + workspace

- O workspace é resolvido e criado; execucoes em sandbox podem redirecionar para uma raiz de workspace em sandbox.
- Skills sao carregadas (ou reutilizadas de um snapshot) e injetadas no ambiente e no prompt.
- Arquivos de bootstrap/contexto sao resolvidos e injetados no relatorio do prompt do sistema.
- Um lock de escrita da sessao é adquirido; `SessionManager` é aberto e preparado antes do streaming.

## Montagem do prompt + prompt do sistema

- O prompt do sistema é construido a partir do prompt base do OpenClaw, prompt de Skills, contexto de bootstrap e sobrescritas por execucao.
- Limites especificos do modelo e tokens de reserva para compactacao sao aplicados.
- Veja [System prompt](/concepts/system-prompt) para o que o modelo ve.

## Pontos de hook (onde voce pode interceptar)

O OpenClaw possui dois sistemas de hooks:

- **Hooks internos** (hooks do Gateway): scripts orientados a eventos para comandos e eventos de ciclo de vida.
- **Hooks de plugin**: pontos de extensao dentro do ciclo de vida do agente/ferramenta e do pipeline do gateway.

### Hooks internos (hooks do Gateway)

- **`agent:bootstrap`**: executa durante a construcao dos arquivos de bootstrap antes que o prompt do sistema seja finalizado.
  Use isto para adicionar/remover arquivos de contexto de bootstrap.
- **Hooks de comando**: `/new`, `/reset`, `/stop` e outros eventos de comando (veja o doc de Hooks).

Veja [Hooks](/hooks) para configuracao e exemplos.

### Hooks de plugin (ciclo de vida do agente + gateway)

Eles executam dentro do loop do agente ou do pipeline do gateway:

- **`before_agent_start`**: injeta contexto ou sobrescreve o prompt do sistema antes do inicio da execucao.
- **`agent_end`**: inspeciona a lista final de mensagens e os metadados da execucao apos a conclusao.
- **`before_compaction` / `after_compaction`**: observa ou anota ciclos de compactacao.
- **`before_tool_call` / `after_tool_call`**: intercepta parametros/resultados de ferramentas.
- **`tool_result_persist`**: transforma sincronicamente resultados de ferramentas antes de serem gravados na transcricao da sessao.
- **`message_received` / `message_sending` / `message_sent`**: hooks de mensagens de entrada + saida.
- **`session_start` / `session_end`**: limites do ciclo de vida da sessao.
- **`gateway_start` / `gateway_stop`**: eventos do ciclo de vida do gateway.

Veja [Plugins](/plugin#plugin-hooks) para a API de hooks e detalhes de registro.

## Streaming + respostas parciais

- Deltas do assistente sao transmitidos do pi-agent-core e emitidos como eventos `assistant`.
- Streaming por blocos pode emitir respostas parciais em `text_end` ou `message_end`.
- Streaming de raciocinio pode ser emitido como um stream separado ou como respostas em bloco.
- Veja [Streaming](/concepts/streaming) para comportamento de fragmentacao e respostas em bloco.

## Execucao de ferramentas + ferramentas de mensageria

- Eventos de inicio/atualizacao/fim de ferramentas sao emitidos no stream `tool`.
- Resultados de ferramentas sao higienizados quanto a tamanho e payloads de imagem antes de registrar/emitir.
- Envios de ferramentas de mensageria sao rastreados para suprimir confirmacoes duplicadas do assistente.

## Modelagem de resposta + supressao

- Payloads finais sao montados a partir de:
  - texto do assistente (e raciocinio opcional)
  - resumos inline de ferramentas (quando verbose + permitido)
  - texto de erro do assistente quando o modelo falha
- `NO_REPLY` é tratado como um token silencioso e filtrado dos payloads de saida.
- Duplicatas de ferramentas de mensageria sao removidas da lista final de payloads.
- Se nenhum payload renderizavel permanecer e uma ferramenta falhar, uma resposta de erro de ferramenta fallback é emitida
  (a menos que uma ferramenta de mensageria ja tenha enviado uma resposta visivel ao usuario).

## Compactacao + tentativas

- Auto-compactacao emite eventos de stream `compaction` e pode disparar uma nova tentativa.
- Na nova tentativa, buffers em memoria e resumos de ferramentas sao redefinidos para evitar saida duplicada.
- Veja [Compaction](/concepts/compaction) para o pipeline de compactacao.

## Streams de eventos (hoje)

- `lifecycle`: emitido por `subscribeEmbeddedPiSession` (e como fallback por `agentCommand`)
- `assistant`: deltas em streaming do pi-agent-core
- `tool`: eventos de ferramentas em streaming do pi-agent-core

## Tratamento de canais de chat

- Deltas do assistente sao armazenados em mensagens de chat `delta`.
- Um chat `final` é emitido em **fim/erro de ciclo de vida**.

## Timeouts

- Padrao de `agent.wait`: 30s (apenas a espera). O parametro `timeoutMs` sobrescreve.
- Runtime do agente: padrao de `agents.defaults.timeoutSeconds` 600s; aplicado no timer de aborto `runEmbeddedPiAgent`.

## Onde as coisas podem terminar mais cedo

- Timeout do agente (aborto)
- AbortSignal (cancelamento)
- Desconexao do Gateway ou timeout de RPC
- Timeout de `agent.wait` (apenas espera, nao interrompe o agente)
