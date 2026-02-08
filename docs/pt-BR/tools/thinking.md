---
summary: "Sintaxe de diretivas para /think + /verbose e como elas afetam o raciocínio do modelo"
read_when:
  - Ajustar a analise de diretivas de thinking ou verbose ou os padroes
title: "Niveis de Thinking"
x-i18n:
  source_path: tools/thinking.md
  source_hash: 0ae614147675be32
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:47Z
---

# Niveis de Thinking (/think directives)

## O que faz

- Diretiva inline em qualquer corpo de entrada: `/t <level>`, `/think:<level>` ou `/thinking <level>`.
- Niveis (apelidos): `off | minimal | low | medium | high | xhigh` (apenas modelos GPT-5.2 + Codex)
  - minimal → “think”
  - low → “think hard”
  - medium → “think harder”
  - high → “ultrathink” (orcamento maximo)
  - xhigh → “ultrathink+” (apenas modelos GPT-5.2 + Codex)
  - `x-high`, `x_high`, `extra-high`, `extra high` e `extra_high` mapeiam para `xhigh`.
  - `highest`, `max` mapeiam para `high`.
- Observacoes do provedor:
  - Z.AI (`zai/*`) suporta apenas thinking binario (`on`/`off`). Qualquer nivel nao `off` e tratado como `on` (mapeado para `low`).

## Ordem de resolucao

1. Diretiva inline na mensagem (aplica-se apenas a essa mensagem).
2. Override de sessao (definido ao enviar uma mensagem somente com diretiva).
3. Padrao global (`agents.defaults.thinkingDefault` na configuracao).
4. Fallback: low para modelos com capacidade de raciocinio; off caso contrario.

## Definindo um padrao de sessao

- Envie uma mensagem que seja **apenas** a diretiva (espacos em branco permitidos), por exemplo, `/think:medium` ou `/t high`.
- Isso permanece para a sessao atual (por remetente, por padrao); e limpo por `/think:off` ou por reset de inatividade da sessao.
- Uma resposta de confirmacao e enviada (`Thinking level set to high.` / `Thinking disabled.`). Se o nivel for invalido (por exemplo, `/thinking big`), o comando e rejeitado com uma dica e o estado da sessao permanece inalterado.
- Envie `/think` (ou `/think:`) sem argumento para ver o nivel de thinking atual.

## Aplicacao por agente

- **Pi incorporado**: o nivel resolvido e passado para o runtime do agente Pi em processo.

## Diretivas verbose (/verbose ou /v)

- Niveis: `on` (minimal) | `full` | `off` (padrao).
- Mensagem somente com diretiva alterna o verbose da sessao e responde `Verbose logging enabled.` / `Verbose logging disabled.`; niveis invalidos retornam uma dica sem alterar o estado.
- `/verbose off` armazena um override explicito de sessao; limpe-o pela UI de Sessoes escolhendo `inherit`.
- Diretiva inline afeta apenas aquela mensagem; padroes de sessao/globais se aplicam caso contrario.
- Envie `/verbose` (ou `/verbose:`) sem argumento para ver o nivel verbose atual.
- Quando verbose esta ligado, agentes que emitem resultados de ferramentas estruturados (Pi, outros agentes JSON) enviam cada chamada de ferramenta de volta como sua propria mensagem apenas de metadados, prefixada com `<emoji> <tool-name>: <arg>` quando disponivel (caminho/comando). Esses resumos de ferramentas sao enviados assim que cada ferramenta inicia (bolhas separadas), nao como deltas de streaming.
- Quando verbose esta em `full`, as saidas das ferramentas tambem sao encaminhadas apos a conclusao (bolha separada, truncada para um comprimento seguro). Se voce alternar `/verbose on|full|off` enquanto uma execucao esta em andamento, as bolhas de ferramentas subsequentes respeitam a nova configuracao.

## Visibilidade de raciocinio (/reasoning)

- Niveis: `on|off|stream`.
- Mensagem somente com diretiva alterna se os blocos de thinking sao mostrados nas respostas.
- Quando habilitado, o raciocinio e enviado como uma **mensagem separada** prefixada com `Reasoning:`.
- `stream` (apenas Telegram): transmite o raciocinio para o rascunho do Telegram enquanto a resposta esta sendo gerada e, em seguida, envia a resposta final sem raciocinio.
- Apelido: `/reason`.
- Envie `/reasoning` (ou `/reasoning:`) sem argumento para ver o nivel de raciocinio atual.

## Relacionado

- A documentacao do modo Elevated fica em [Elevated mode](/tools/elevated).

## Heartbeats

- O corpo da sonda de heartbeat e o prompt de heartbeat configurado (padrao: `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`). Diretivas inline em uma mensagem de heartbeat se aplicam normalmente (mas evite alterar padroes de sessao a partir de heartbeats).
- A entrega de heartbeat padrao envia apenas o payload final. Para tambem enviar a mensagem separada `Reasoning:` (quando disponivel), defina `agents.defaults.heartbeat.includeReasoning: true` ou por agente `agents.list[].heartbeat.includeReasoning: true`.

## UI de chat web

- O seletor de thinking do chat web espelha o nivel armazenado da sessao a partir do store/config de sessao de entrada quando a pagina carrega.
- Escolher outro nivel aplica-se apenas a proxima mensagem (`thinkingOnce`); apos enviar, o seletor retorna ao nivel de sessao armazenado.
- Para alterar o padrao da sessao, envie uma diretiva `/think:<level>` (como antes); o seletor refletira isso apos o proximo recarregamento.
