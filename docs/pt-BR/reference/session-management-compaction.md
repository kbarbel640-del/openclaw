---
summary: "Mergulho profundo: armazenamento de sessão + transcritos, ciclo de vida e internos de (auto)compactação"
read_when:
  - Voce precisa depurar IDs de sessão, JSONL de transcritos ou campos de sessions.json
  - Voce esta alterando o comportamento de auto-compactação ou adicionando rotinas de organização “pré-compactação”
  - Voce quer implementar descarregamentos de memória ou turnos silenciosos do sistema
title: "Mergulho Profundo em Gerenciamento de Sessões"
x-i18n:
  source_path: reference/session-management-compaction.md
  source_hash: bf3715770ba63436
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:35Z
---

# Gerenciamento de Sessões & Compactação (Mergulho Profundo)

Este documento explica como o OpenClaw gerencia sessões de ponta a ponta:

- **Roteamento de sessão** (como mensagens de entrada mapeiam para um `sessionKey`)
- **Armazenamento de sessão** (`sessions.json`) e o que ele acompanha
- **Persistência de transcritos** (`*.jsonl`) e sua estrutura
- **Higiene de transcritos** (ajustes específicos do provedor antes das execuções)
- **Limites de contexto** (janela de contexto vs tokens acompanhados)
- **Compactação** (compactação manual + automática) e onde conectar trabalho pré-compactação
- **Organização silenciosa** (ex.: gravações de memória que não devem produzir saída visível ao usuário)

Se voce quiser primeiro uma visão de nível mais alto, comece por:

- [/concepts/session](/concepts/session)
- [/concepts/compaction](/concepts/compaction)
- [/concepts/session-pruning](/concepts/session-pruning)
- [/reference/transcript-hygiene](/reference/transcript-hygiene)

---

## Fonte da verdade: o Gateway

O OpenClaw é projetado em torno de um único **processo Gateway** que detém o estado das sessões.

- UIs (app macOS, Control UI web, TUI) devem consultar o Gateway para listas de sessões e contagens de tokens.
- No modo remoto, os arquivos de sessão estão no host remoto; “verificar seus arquivos locais no Mac” não refletirá o que o Gateway esta usando.

---

## Duas camadas de persistência

O OpenClaw persiste sessões em duas camadas:

1. **Armazenamento de sessão (`sessions.json`)**
   - Mapa chave/valor: `sessionKey -> SessionEntry`
   - Pequeno, mutável, seguro para editar (ou excluir entradas)
   - Acompanha metadados da sessão (id da sessão atual, última atividade, alternâncias, contadores de tokens, etc.)

2. **Transcrito (`<sessionId>.jsonl`)**
   - Transcrito somente de acréscimo com estrutura em árvore (entradas têm `id` + `parentId`)
   - Armazena a conversa real + chamadas de ferramentas + resumos de compactação
   - Usado para reconstruir o contexto do modelo para turnos futuros

---

## Localizações em disco

Por agente, no host do Gateway:

- Armazenamento: `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- Transcritos: `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`
  - Sessões de tópicos do Telegram: `.../<sessionId>-topic-<threadId>.jsonl`

O OpenClaw resolve isso via `src/config/sessions.ts`.

---

## Chaves de sessão (`sessionKey`)

Uma `sessionKey` identifica _em qual bucket de conversa_ voce esta (roteamento + isolamento).

Padrões comuns:

- Chat principal/direto (por agente): `agent:<agentId>:<mainKey>` (padrão `main`)
- Grupo: `agent:<agentId>:<channel>:group:<id>`
- Sala/canal (Discord/Slack): `agent:<agentId>:<channel>:channel:<id>` ou `...:room:<id>`
- Cron: `cron:<job.id>`
- Webhook: `hook:<uuid>` (a menos que seja sobrescrito)

As regras canônicas estão documentadas em [/concepts/session](/concepts/session).

---

## IDs de sessão (`sessionId`)

Cada `sessionKey` aponta para um `sessionId` atual (o arquivo de transcrito que continua a conversa).

Regras práticas:

- **Reset** (`/new`, `/reset`) cria um novo `sessionId` para aquela `sessionKey`.
- **Reset diário** (padrão 4:00 AM horário local no host do gateway) cria um novo `sessionId` na próxima mensagem após o limite de reset.
- **Expiração por inatividade** (`session.reset.idleMinutes` ou legado `session.idleMinutes`) cria um novo `sessionId` quando uma mensagem chega após a janela de inatividade. Quando diário + inatividade estão ambos configurados, o que expirar primeiro vence.

Detalhe de implementação: a decisão acontece em `initSessionState()` em `src/auto-reply/reply/session.ts`.

---

## Esquema do armazenamento de sessão (`sessions.json`)

O tipo de valor do armazenamento é `SessionEntry` em `src/config/sessions.ts`.

Campos-chave (não exaustivo):

- `sessionId`: id do transcrito atual (o nome do arquivo é derivado disso a menos que `sessionFile` esteja definido)
- `updatedAt`: timestamp da última atividade
- `sessionFile`: sobrescrita opcional explícita do caminho do transcrito
- `chatType`: `direct | group | room` (ajuda UIs e política de envio)
- `provider`, `subject`, `room`, `space`, `displayName`: metadados para rotulagem de grupo/canal
- Alternâncias:
  - `thinkingLevel`, `verboseLevel`, `reasoningLevel`, `elevatedLevel`
  - `sendPolicy` (sobrescrita por sessão)
- Seleção de modelo:
  - `providerOverride`, `modelOverride`, `authProfileOverride`
- Contadores de tokens (melhor esforço / dependente do provedor):
  - `inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`
- `compactionCount`: com que frequência a auto-compactação foi concluída para esta chave de sessão
- `memoryFlushAt`: timestamp do último descarregamento de memória pré-compactação
- `memoryFlushCompactionCount`: contagem de compactação quando o último descarregamento foi executado

O armazenamento é seguro para editar, mas o Gateway é a autoridade: ele pode reescrever ou reidratar entradas conforme as sessões são executadas.

---

## Estrutura do transcrito (`*.jsonl`)

Os transcritos são gerenciados pelo `@mariozechner/pi-coding-agent` do `SessionManager`.

O arquivo é JSONL:

- Primeira linha: cabeçalho da sessão (`type: "session"`, inclui `id`, `cwd`, `timestamp`, opcional `parentSession`)
- Depois: entradas de sessão com `id` + `parentId` (árvore)

Tipos de entrada notáveis:

- `message`: mensagens de usuário/assistente/toolResult
- `custom_message`: mensagens injetadas por extensões que _entram_ no contexto do modelo (podem ser ocultas da UI)
- `custom`: estado de extensão que _não_ entra no contexto do modelo
- `compaction`: resumo de compactação persistido com `firstKeptEntryId` e `tokensBefore`
- `branch_summary`: resumo persistido ao navegar por um ramo da árvore

O OpenClaw intencionalmente **não** “corrige” transcritos; o Gateway usa `SessionManager` para lê-los/escrevê-los.

---

## Janelas de contexto vs tokens acompanhados

Dois conceitos diferentes importam:

1. **Janela de contexto do modelo**: limite rígido por modelo (tokens visíveis ao modelo)
2. **Contadores do armazenamento de sessão**: estatísticas contínuas gravadas em `sessions.json` (usadas para /status e painéis)

Se voce estiver ajustando limites:

- A janela de contexto vem do catálogo de modelos (e pode ser sobrescrita via configuração).
- `contextTokens` no armazenamento é um valor de estimativa/relato em tempo de execução; não o trate como uma garantia estrita.

Para mais, veja [/token-use](/token-use).

---

## Compactação: o que é

A compactação resume conversas mais antigas em uma entrada `compaction` persistida no transcrito e mantém mensagens recentes intactas.

Após a compactação, turnos futuros veem:

- O resumo de compactação
- Mensagens após `firstKeptEntryId`

A compactação é **persistente** (diferente da poda de sessão). Veja [/concepts/session-pruning](/concepts/session-pruning).

---

## Quando a auto-compactação acontece (runtime do Pi)

No agente Pi embutido, a auto-compactação dispara em dois casos:

1. **Recuperação de overflow**: o modelo retorna um erro de overflow de contexto → compacta → tenta novamente.
2. **Manutenção por limiar**: após um turno bem-sucedido, quando:

`contextTokens > contextWindow - reserveTokens`

Onde:

- `contextWindow` é a janela de contexto do modelo
- `reserveTokens` é a folga reservada para prompts + a próxima saída do modelo

Essas são semânticas do runtime do Pi (o OpenClaw consome os eventos, mas o Pi decide quando compactar).

---

## Configurações de compactação (`reserveTokens`, `keepRecentTokens`)

As configurações de compactação do Pi vivem nas configurações do Pi:

```json5
{
  compaction: {
    enabled: true,
    reserveTokens: 16384,
    keepRecentTokens: 20000,
  },
}
```

O OpenClaw também impõe um piso de segurança para execuções embutidas:

- Se `compaction.reserveTokens < reserveTokensFloor`, o OpenClaw o eleva.
- O piso padrão é `20000` tokens.
- Defina `agents.defaults.compaction.reserveTokensFloor: 0` para desativar o piso.
- Se já estiver mais alto, o OpenClaw o deixa como esta.

Por quê: deixar folga suficiente para “organização” multi-turno (como gravações de memória) antes que a compactação se torne inevitável.

Implementação: `ensurePiCompactionReserveTokens()` em `src/agents/pi-settings.ts`
(chamado de `src/agents/pi-embedded-runner.ts`).

---

## Superfícies visíveis ao usuário

Voce pode observar a compactação e o estado da sessão via:

- `/status` (em qualquer sessão de chat)
- `openclaw status` (CLI)
- `openclaw sessions` / `sessions --json`
- Modo verboso: `🧹 Auto-compaction complete` + contagem de compactação

---

## Organização silenciosa (`NO_REPLY`)

O OpenClaw suporta turnos “silenciosos” para tarefas em segundo plano onde o usuário não deve ver saídas intermediárias.

Convenção:

- O assistente inicia sua saída com `NO_REPLY` para indicar “não entregar uma resposta ao usuário”.
- O OpenClaw remove/suprime isso na camada de entrega.

A partir de `2026.1.10`, o OpenClaw também suprime **streaming de rascunho/digitação** quando um trecho parcial começa com `NO_REPLY`, para que operações silenciosas não vazem saída parcial no meio do turno.

---

## “Descarregamento de memória” pré-compactação (implementado)

Objetivo: antes que a auto-compactação aconteça, executar um turno agente silencioso que grave
estado durável em disco (ex.: `memory/YYYY-MM-DD.md` no workspace do agente) para que a compactação não
apague contexto crítico.

O OpenClaw usa a abordagem de **descarregamento pré-limiar**:

1. Monitorar o uso de contexto da sessão.
2. Quando cruzar um “limiar suave” (abaixo do limiar de compactação do Pi), executar uma diretiva silenciosa
   “gravar memória agora” para o agente.
3. Usar `NO_REPLY` para que o usuário não veja nada.

Configuração (`agents.defaults.compaction.memoryFlush`):

- `enabled` (padrão: `true`)
- `softThresholdTokens` (padrão: `4000`)
- `prompt` (mensagem do usuário para o turno de descarregamento)
- `systemPrompt` (prompt de sistema extra anexado para o turno de descarregamento)

Notas:

- O prompt padrão/prompt de sistema incluem uma dica `NO_REPLY` para suprimir a entrega.
- O descarregamento roda uma vez por ciclo de compactação (acompanhado em `sessions.json`).
- O descarregamento roda apenas para sessões Pi embutidas (backends CLI o pulam).
- O descarregamento é pulado quando o workspace da sessão é somente leitura (`workspaceAccess: "ro"` ou `"none"`).
- Veja [Memory](/concepts/memory) para o layout de arquivos do workspace e padrões de gravação.

O Pi também expõe um gancho `session_before_compact` na API de extensões, mas a lógica de
descarregamento do OpenClaw vive hoje no lado do Gateway.

---

## Checklist de solucao de problemas

- Chave de sessão errada? Comece com [/concepts/session](/concepts/session) e confirme o `sessionKey` em `/status`.
- Divergência entre armazenamento e transcrito? Confirme o host do Gateway e o caminho do armazenamento a partir de `openclaw status`.
- Spam de compactação? Verifique:
  - janela de contexto do modelo (pequena demais)
  - configurações de compactação (`reserveTokens` alto demais para a janela do modelo pode causar compactação antecipada)
  - inchaço de resultados de ferramentas: ative/ajuste a poda de sessão
- Turnos silenciosos vazando? Confirme que a resposta começa com `NO_REPLY` (token exato) e que voce esta em uma build que inclui a correção de supressão de streaming.
