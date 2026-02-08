---
summary: "Quando o OpenClaw mostra indicadores de digitacao e como ajusta-los"
read_when:
  - Alterar o comportamento ou os padroes do indicador de digitacao
title: "Indicadores de digitacao"
x-i18n:
  source_path: concepts/typing-indicators.md
  source_hash: 8ee82d02829c4ff5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:04Z
---

# Indicadores de digitacao

Indicadores de digitacao sao enviados ao canal de chat enquanto uma execucao esta ativa. Use
`agents.defaults.typingMode` para controlar **quando** a digitacao comeca e `typingIntervalSeconds`
para controlar **com que frequencia** ela e atualizada.

## Padroes

Quando `agents.defaults.typingMode` esta **nao definido**, o OpenClaw mantem o comportamento legado:

- **Conversas diretas**: a digitacao comeca imediatamente assim que o loop do modelo se inicia.
- **Conversas em grupo com mencao**: a digitacao comeca imediatamente.
- **Conversas em grupo sem mencao**: a digitacao comeca apenas quando o texto da mensagem comeca a ser transmitido.
- **Execucoes de heartbeat**: a digitacao e desativada.

## Modos

Defina `agents.defaults.typingMode` como um de:

- `never` — nenhum indicador de digitacao, nunca.
- `instant` — comeca a digitar **assim que o loop do modelo se inicia**, mesmo que a execucao
  depois retorne apenas o token de resposta silenciosa.
- `thinking` — comeca a digitar no **primeiro delta de raciocinio** (requer
  `reasoningLevel: "stream"` para a execucao).
- `message` — comeca a digitar no **primeiro delta de texto nao silencioso** (ignora
  o token silencioso `NO_REPLY`).

Ordem de “o quao cedo dispara”:
`never` → `message` → `thinking` → `instant`

## Configuracao

```json5
{
  agent: {
    typingMode: "thinking",
    typingIntervalSeconds: 6,
  },
}
```

Voce pode sobrescrever o modo ou a cadencia por sessao:

```json5
{
  session: {
    typingMode: "message",
    typingIntervalSeconds: 4,
  },
}
```

## Notas

- O modo `message` nao mostrara digitacao para respostas somente silenciosas (por exemplo, o token `NO_REPLY`
  usado para suprimir a saida).
- `thinking` so dispara se a execucao transmitir raciocinio (`reasoningLevel: "stream"`).
  Se o modelo nao emitir deltas de raciocinio, a digitacao nao comeca.
- Heartbeats nunca mostram digitacao, independentemente do modo.
- `typingIntervalSeconds` controla a **cadencia de atualizacao**, nao o momento de inicio.
  O padrao e 6 segundos.
