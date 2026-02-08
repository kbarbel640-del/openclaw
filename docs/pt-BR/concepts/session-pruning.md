---
summary: "Poda de sessao: corte de resultados de ferramentas para reduzir o inchaço de contexto"
read_when:
  - Voce quer reduzir o crescimento de contexto do LLM a partir de saidas de ferramentas
  - Voce esta ajustando agents.defaults.contextPruning
x-i18n:
  source_path: concepts/session-pruning.md
  source_hash: 9b0aa2d1abea7050
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:03Z
---

# Session Pruning

A poda de sessao corta **resultados antigos de ferramentas** do contexto em memoria imediatamente antes de cada chamada ao LLM. Ela **nao** reescreve o historico da sessao em disco (`*.jsonl`).

## Quando ela roda

- Quando `mode: "cache-ttl"` esta habilitado e a ultima chamada Anthropic da sessao e mais antiga que `ttl`.
- Afeta apenas as mensagens enviadas ao modelo para aquela solicitacao.
- Ativa apenas para chamadas da API Anthropic (e modelos Anthropic do OpenRouter).
- Para melhores resultados, combine `ttl` com o `cacheControlTtl` do seu modelo.
- Apos uma poda, a janela de TTL e redefinida, entao solicitacoes subsequentes mantem o cache ate que `ttl` expire novamente.

## Padroes inteligentes (Anthropic)

- Perfis **OAuth ou setup-token**: habilite a poda `cache-ttl` e defina o heartbeat para `1h`.
- Perfis **API key**: habilite a poda `cache-ttl`, defina o heartbeat para `30m` e padrao `cacheControlTtl` para `1h` em modelos Anthropic.
- Se voce definir explicitamente qualquer um desses valores, o OpenClaw **nao** os sobrescreve.

## O que isso melhora (custo + comportamento de cache)

- **Por que podar:** o cache de prompt da Anthropic so se aplica dentro do TTL. Se uma sessao fica ociosa alem do TTL, a proxima solicitacao re‑armazena em cache o prompt completo, a menos que voce o corte antes.
- **O que fica mais barato:** a poda reduz o tamanho de **cacheWrite** para essa primeira solicitacao apos o TTL expirar.
- **Por que a redefinicao do TTL importa:** uma vez que a poda roda, a janela de cache e redefinida, entao solicitacoes de acompanhamento podem reutilizar o prompt recem armazenado em cache em vez de re‑armazenar todo o historico novamente.
- **O que ela nao faz:** a poda nao adiciona tokens nem “duplica” custos; ela apenas muda o que e armazenado em cache nessa primeira solicitacao pos‑TTL.

## O que pode ser podado

- Apenas mensagens `toolResult`.
- Mensagens de usuario + assistente **nunca** sao modificadas.
- As ultimas `keepLastAssistants` mensagens do assistente sao protegidas; resultados de ferramentas apos esse ponto de corte nao sao podados.
- Se nao houver mensagens de assistente suficientes para estabelecer o ponto de corte, a poda e ignorada.
- Resultados de ferramentas contendo **blocos de imagem** sao ignorados (nunca cortados/limpos).

## Estimativa da janela de contexto

A poda usa uma janela de contexto estimada (caracteres ≈ tokens × 4). A janela base e resolvida nesta ordem:

1. Substituicao `models.providers.*.models[].contextWindow`.
2. Definicao do modelo `contextWindow` (do registro de modelos).
3. Padrao de `200000` tokens.

Se `agents.defaults.contextTokens` estiver definido, ele e tratado como um limite (min) da janela resolvida.

## Modo

### cache-ttl

- A poda so roda se a ultima chamada Anthropic for mais antiga que `ttl` (padrao `5m`).
- Quando roda: mesmo comportamento de corte suave + limpeza forte de antes.

## Poda suave vs poda forte

- **Corte suave**: apenas para resultados de ferramentas superdimensionados.
  - Mantem inicio + fim, insere `...` e acrescenta uma nota com o tamanho original.
  - Ignora resultados com blocos de imagem.
- **Limpeza forte**: substitui todo o resultado da ferramenta por `hardClear.placeholder`.

## Selecao de ferramentas

- `tools.allow` / `tools.deny` suportam curingas `*`.
- A negacao prevalece.
- A correspondencia nao diferencia maiusculas de minusculas.
- Lista de permissao vazia => todas as ferramentas permitidas.

## Interacao com outros limites

- Ferramentas integradas ja truncam a propria saida; a poda de sessao e uma camada extra que evita que chats de longa duracao acumulem saida excessiva de ferramentas no contexto do modelo.
- A compactacao e separada: a compactacao resume e persiste; a poda e transitoria por solicitacao. Veja [/concepts/compaction](/concepts/compaction).

## Padroes (quando habilitado)

- `ttl`: `"5m"`
- `keepLastAssistants`: `3`
- `softTrimRatio`: `0.3`
- `hardClearRatio`: `0.5`
- `minPrunableToolChars`: `50000`
- `softTrim`: `{ maxChars: 4000, headChars: 1500, tailChars: 1500 }`
- `hardClear`: `{ enabled: true, placeholder: "[Old tool result content cleared]" }`

## Exemplos

Padrao (desligado):

```json5
{
  agent: {
    contextPruning: { mode: "off" },
  },
}
```

Habilitar poda sensivel a TTL:

```json5
{
  agent: {
    contextPruning: { mode: "cache-ttl", ttl: "5m" },
  },
}
```

Restringir a poda a ferramentas especificas:

```json5
{
  agent: {
    contextPruning: {
      mode: "cache-ttl",
      tools: { allow: ["exec", "read"], deny: ["*image*"] },
    },
  },
}
```

Veja a referencia de configuracao: [Gateway Configuration](/gateway/configuration)
