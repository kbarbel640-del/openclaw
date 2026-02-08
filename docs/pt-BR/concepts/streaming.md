---
summary: "Comportamento de streaming + chunking (respostas em blocos, streaming de rascunho, limites)"
read_when:
  - Explicar como o streaming ou o chunking funcionam nos canais
  - Alterar o streaming de blocos ou o comportamento de chunking por canal
  - Depurar respostas em bloco duplicadas/antecipadas ou streaming de rascunho
title: "Streaming e Chunking"
x-i18n:
  source_path: concepts/streaming.md
  source_hash: f014eb1898c4351b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:09Z
---

# Streaming + chunking

O OpenClaw tem duas camadas separadas de “streaming”:

- **Streaming de blocos (canais):** emite **blocos** concluídos à medida que o assistente escreve. Essas são mensagens normais do canal (não deltas de tokens).
- **Streaming tipo token (apenas Telegram):** atualiza um **balão de rascunho** com texto parcial enquanto gera; a mensagem final é enviada no final.

Atualmente **não há streaming real de tokens** para mensagens de canais externos. O streaming de rascunho do Telegram é a única superfície de streaming parcial.

## Streaming de blocos (mensagens do canal)

O streaming de blocos envia a saída do assistente em chunks grossos à medida que ficam disponíveis.

```
Model output
  └─ text_delta/events
       ├─ (blockStreamingBreak=text_end)
       │    └─ chunker emits blocks as buffer grows
       └─ (blockStreamingBreak=message_end)
            └─ chunker flushes at message_end
                   └─ channel send (block replies)
```

Legenda:

- `text_delta/events`: eventos de stream do modelo (podem ser esparsos para modelos sem streaming).
- `chunker`: `EmbeddedBlockChunker` aplicando limites mínimo/máximo + preferência de quebra.
- `channel send`: mensagens de saída reais (respostas em bloco).

**Controles:**

- `agents.defaults.blockStreamingDefault`: `"on"`/`"off"` (padrão desligado).
- Substituições por canal: `*.blockStreaming` (e variantes por conta) para forçar `"on"`/`"off"` por canal.
- `agents.defaults.blockStreamingBreak`: `"text_end"` ou `"message_end"`.
- `agents.defaults.blockStreamingChunk`: `{ minChars, maxChars, breakPreference? }`.
- `agents.defaults.blockStreamingCoalesce`: `{ minChars?, maxChars?, idleMs? }` (mesclar blocos em streaming antes de enviar).
- Limite rígido do canal: `*.textChunkLimit` (ex.: `channels.whatsapp.textChunkLimit`).
- Modo de chunking do canal: `*.chunkMode` (`length` padrão, `newline` divide em linhas em branco (limites de parágrafo) antes do chunking por comprimento).
- Limite flexível do Discord: `channels.discord.maxLinesPerMessage` (padrão 17) divide respostas altas para evitar recorte na UI.

**Semântica de limites:**

- `text_end`: transmitir blocos assim que o chunker emitir; descarregar a cada `text_end`.
- `message_end`: esperar até a mensagem do assistente terminar e então descarregar a saída em buffer.

`message_end` ainda usa o chunker se o texto em buffer exceder `maxChars`, então pode emitir múltiplos chunks no final.

## Algoritmo de chunking (limites baixo/alto)

O chunking de blocos é implementado por `EmbeddedBlockChunker`:

- **Limite baixo:** não emitir até o buffer >= `minChars` (a menos que forçado).
- **Limite alto:** preferir divisões antes de `maxChars`; se forçado, dividir em `maxChars`.
- **Preferência de quebra:** `paragraph` → `newline` → `sentence` → `whitespace` → quebra rígida.
- **Cercas de código:** nunca dividir dentro das cercas; quando forçado em `maxChars`, fechar + reabrir a cerca para manter o Markdown válido.

`maxChars` é limitado ao `textChunkLimit` do canal, então você não pode exceder os limites por canal.

## Coalescência (mesclar blocos em streaming)

Quando o streaming de blocos está habilitado, o OpenClaw pode **mesclar chunks de blocos consecutivos**
antes de enviá-los. Isso reduz “spam de linha única” enquanto ainda fornece
saída progressiva.

- A coalescência espera por **intervalos de ociosidade** (`idleMs`) antes de descarregar.
- Os buffers são limitados por `maxChars` e serão descarregados se excederem esse valor.
- `minChars` evita o envio de fragmentos minúsculos até que texto suficiente se acumule
  (a descarga final sempre envia o texto restante).
- O conector é derivado de `blockStreamingChunk.breakPreference`
  (`paragraph` → `\n\n`, `newline` → `\n`, `sentence` → espaço).
- Substituições por canal estão disponíveis via `*.blockStreamingCoalesce` (incluindo configs por conta).
- O `minChars` padrão de coalescência é aumentado para 1500 para Signal/Slack/Discord, salvo substituição.

## Ritmo semelhante ao humano entre blocos

Quando o streaming de blocos está habilitado, você pode adicionar uma **pausa aleatória**
entre respostas em bloco (após o primeiro bloco). Isso faz com que respostas com múltiplos balões pareçam
mais naturais.

- Configuração: `agents.defaults.humanDelay` (substituir por agente via `agents.list[].humanDelay`).
- Modos: `off` (padrão), `natural` (800–2500ms), `custom` (`minMs`/`maxMs`).
- Aplica-se apenas a **respostas em bloco**, não a respostas finais ou resumos de ferramentas.

## “Transmitir chunks ou tudo”

Isso mapeia para:

- **Transmitir chunks:** `blockStreamingDefault: "on"` + `blockStreamingBreak: "text_end"` (emitir conforme avança). Canais não Telegram também precisam de `*.blockStreaming: true`.
- **Transmitir tudo no final:** `blockStreamingBreak: "message_end"` (descarregar uma vez, possivelmente em múltiplos chunks se for muito longo).
- **Sem streaming de blocos:** `blockStreamingDefault: "off"` (apenas resposta final).

**Nota do canal:** Para canais não Telegram, o streaming de blocos fica **desligado a menos que**
`*.blockStreaming` seja explicitamente definido como `true`. O Telegram pode transmitir rascunhos
(`channels.telegram.streamMode`) sem respostas em bloco.

Lembrete de localização de configuração: os padrões de `blockStreaming*` ficam em
`agents.defaults`, não na configuração raiz.

## Streaming de rascunho do Telegram (tipo token)

O Telegram é o único canal com streaming de rascunho:

- Usa a Bot API `sendMessageDraft` em **chats privados com tópicos**.
- `channels.telegram.streamMode: "partial" | "block" | "off"`.
  - `partial`: atualizações de rascunho com o texto de stream mais recente.
  - `block`: atualizações de rascunho em blocos com chunking (mesmas regras do chunker).
  - `off`: sem streaming de rascunho.
- Configuração de chunk do rascunho (apenas para `streamMode: "block"`): `channels.telegram.draftChunk` (padrões: `minChars: 200`, `maxChars: 800`).
- O streaming de rascunho é separado do streaming de blocos; respostas em bloco ficam desligadas por padrão e só são habilitadas por `*.blockStreaming: true` em canais não Telegram.
- A resposta final ainda é uma mensagem normal.
- `/reasoning stream` escreve o raciocínio no balão de rascunho (apenas Telegram).

Quando o streaming de rascunho está ativo, o OpenClaw desativa o streaming de blocos para essa resposta para evitar streaming duplo.

```
Telegram (private + topics)
  └─ sendMessageDraft (draft bubble)
       ├─ streamMode=partial → update latest text
       └─ streamMode=block   → chunker updates draft
  └─ final reply → normal message
```

Legenda:

- `sendMessageDraft`: balão de rascunho do Telegram (não é uma mensagem real).
- `final reply`: envio de mensagem normal do Telegram.
