---
summary: "Execute o OpenClaw em LLMs locais (LM Studio, vLLM, LiteLLM, endpoints OpenAI personalizados)"
read_when:
  - Voce quer servir modelos a partir do seu proprio servidor com GPU
  - Voce esta conectando o LM Studio ou um proxy compativel com OpenAI
  - Voce precisa das orientacoes mais seguras para modelos locais
title: "Modelos Locais"
x-i18n:
  source_path: gateway/local-models.md
  source_hash: 63a7cc8b114355c6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:19Z
---

# Modelos locais

Local é viável, mas o OpenClaw espera **contexto grande + defesas fortes contra injeção de prompt**. Placas pequenas truncam o contexto e vazam segurança. Mire alto: **≥2 Mac Studios no máximo ou um rig de GPU equivalente (~US$30k+)**. Uma única GPU de **24 GB** funciona apenas para prompts mais leves, com maior latência. Use a **maior variante / tamanho completo de modelo que voce conseguir rodar**; checkpoints agressivamente quantizados ou “pequenos” aumentam o risco de injeção de prompt (veja [Segurança](/gateway/security)).

## Recomendado: LM Studio + MiniMax M2.1 (Responses API, tamanho completo)

Melhor stack local atual. Carregue o MiniMax M2.1 no LM Studio, ative o servidor local (padrão `http://127.0.0.1:1234`) e use a Responses API para manter o raciocínio separado do texto final.

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

**Checklist de configuracao**

- Instale o LM Studio: https://lmstudio.ai
- No LM Studio, baixe a **maior build disponível do MiniMax M2.1** (evite variantes “small”/fortemente quantizadas), inicie o servidor e confirme que `http://127.0.0.1:1234/v1/models` o lista.
- Mantenha o modelo carregado; o cold-load adiciona latência de inicialização.
- Ajuste `contextWindow`/`maxTokens` se a sua build do LM Studio diferir.
- Para WhatsApp, use a Responses API para que apenas o texto final seja enviado.

Mantenha modelos hospedados configurados mesmo ao rodar localmente; use `models.mode: "merge"` para que os fallbacks permaneçam disponíveis.

### Configuracao hibrida: hospedado como primario, local como fallback

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",
        fallbacks: ["lmstudio/minimax-m2.1-gs32", "anthropic/claude-opus-4-6"],
      },
      models: {
        "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
        "lmstudio/minimax-m2.1-gs32": { alias: "MiniMax Local" },
        "anthropic/claude-opus-4-6": { alias: "Opus" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### Local primeiro com rede de seguranca hospedada

Troque a ordem de primario e fallback; mantenha o mesmo bloco de provedores e `models.mode: "merge"` para poder voltar para Sonnet ou Opus quando a maquina local estiver fora do ar.

### Hospedagem regional / roteamento de dados

- Variantes hospedadas do MiniMax/Kimi/GLM também existem no OpenRouter com endpoints fixados por regiao (por exemplo, hospedados nos EUA). Escolha a variante regional ali para manter o tráfego na jurisdição escolhida enquanto ainda usa `models.mode: "merge"` como fallback para Anthropic/OpenAI.
- Apenas local continua sendo o caminho de maior privacidade; o roteamento regional hospedado é o meio-termo quando voce precisa de recursos do provedor, mas quer controle sobre o fluxo de dados.

## Outros proxies locais compativeis com OpenAI

vLLM, LiteLLM, OAI-proxy ou gateways personalizados funcionam se expuserem um endpoint `/v1` no estilo OpenAI. Substitua o bloco de provedor acima pelo seu endpoint e ID de modelo:

```json5
{
  models: {
    mode: "merge",
    providers: {
      local: {
        baseUrl: "http://127.0.0.1:8000/v1",
        apiKey: "sk-local",
        api: "openai-responses",
        models: [
          {
            id: "my-local-model",
            name: "Local Model",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 120000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

Mantenha `models.mode: "merge"` para que modelos hospedados permaneçam disponíveis como fallbacks.

## Solucao de problemas

- O Gateway consegue alcançar o proxy? `curl http://127.0.0.1:1234/v1/models`.
- Modelo do LM Studio descarregado? Recarregue; cold start é uma causa comum de “travamento”.
- Erros de contexto? Reduza `contextWindow` ou aumente o limite do seu servidor.
- Segurança: modelos locais pulam filtros do lado do provedor; mantenha agentes estreitos e a compactacao ativada para limitar o raio de explosao da injeção de prompt.
