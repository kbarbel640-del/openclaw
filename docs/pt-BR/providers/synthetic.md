---
summary: "Use a API compatível com Anthropic da Synthetic no OpenClaw"
read_when:
  - Voce quer usar a Synthetic como um provedor de modelo
  - Voce precisa configurar uma chave de API da Synthetic ou URL base
title: "Synthetic"
x-i18n:
  source_path: providers/synthetic.md
  source_hash: f3f6e3eb86466175
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:10Z
---

# Synthetic

A Synthetic expõe endpoints compatíveis com Anthropic. O OpenClaw a registra como o
provedor `synthetic` e usa a API Anthropic Messages.

## Inicio rapido

1. Defina `SYNTHETIC_API_KEY` (ou execute o assistente abaixo).
2. Execute a integracao inicial:

```bash
openclaw onboard --auth-choice synthetic-api-key
```

O modelo padrao e definido como:

```
synthetic/hf:MiniMaxAI/MiniMax-M2.1
```

## Exemplo de configuracao

```json5
{
  env: { SYNTHETIC_API_KEY: "sk-..." },
  agents: {
    defaults: {
      model: { primary: "synthetic/hf:MiniMaxAI/MiniMax-M2.1" },
      models: { "synthetic/hf:MiniMaxAI/MiniMax-M2.1": { alias: "MiniMax M2.1" } },
    },
  },
  models: {
    mode: "merge",
    providers: {
      synthetic: {
        baseUrl: "https://api.synthetic.new/anthropic",
        apiKey: "${SYNTHETIC_API_KEY}",
        api: "anthropic-messages",
        models: [
          {
            id: "hf:MiniMaxAI/MiniMax-M2.1",
            name: "MiniMax M2.1",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 192000,
            maxTokens: 65536,
          },
        ],
      },
    },
  },
}
```

Observacao: o cliente Anthropic do OpenClaw adiciona `/v1` ao URL base, portanto use
`https://api.synthetic.new/anthropic` (nao `/anthropic/v1`). Se a Synthetic mudar
seu URL base, sobrescreva `models.providers.synthetic.baseUrl`.

## Catalogo de modelos

Todos os modelos abaixo usam custo `0` (entrada/saida/cache).

| ID do modelo                                           | Janela de contexto | Max tokens | Raciocinio | Entrada      |
| ------------------------------------------------------ | ------------------ | ---------- | ---------- | ------------ |
| `hf:MiniMaxAI/MiniMax-M2.1`                            | 192000             | 65536      | false      | text         |
| `hf:moonshotai/Kimi-K2-Thinking`                       | 256000             | 8192       | true       | text         |
| `hf:zai-org/GLM-4.7`                                   | 198000             | 128000     | false      | text         |
| `hf:deepseek-ai/DeepSeek-R1-0528`                      | 128000             | 8192       | false      | text         |
| `hf:deepseek-ai/DeepSeek-V3-0324`                      | 128000             | 8192       | false      | text         |
| `hf:deepseek-ai/DeepSeek-V3.1`                         | 128000             | 8192       | false      | text         |
| `hf:deepseek-ai/DeepSeek-V3.1-Terminus`                | 128000             | 8192       | false      | text         |
| `hf:deepseek-ai/DeepSeek-V3.2`                         | 159000             | 8192       | false      | text         |
| `hf:meta-llama/Llama-3.3-70B-Instruct`                 | 128000             | 8192       | false      | text         |
| `hf:meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` | 524000             | 8192       | false      | text         |
| `hf:moonshotai/Kimi-K2-Instruct-0905`                  | 256000             | 8192       | false      | text         |
| `hf:openai/gpt-oss-120b`                               | 128000             | 8192       | false      | text         |
| `hf:Qwen/Qwen3-235B-A22B-Instruct-2507`                | 256000             | 8192       | false      | text         |
| `hf:Qwen/Qwen3-Coder-480B-A35B-Instruct`               | 256000             | 8192       | false      | text         |
| `hf:Qwen/Qwen3-VL-235B-A22B-Instruct`                  | 250000             | 8192       | false      | text + image |
| `hf:zai-org/GLM-4.5`                                   | 128000             | 128000     | false      | text         |
| `hf:zai-org/GLM-4.6`                                   | 198000             | 128000     | false      | text         |
| `hf:deepseek-ai/DeepSeek-V3`                           | 128000             | 8192       | false      | text         |
| `hf:Qwen/Qwen3-235B-A22B-Thinking-2507`                | 256000             | 8192       | true       | text         |

## Observacoes

- As referencias de modelo usam `synthetic/<modelId>`.
- Se voce habilitar uma allowlist de modelos (`agents.defaults.models`), adicione todos os modelos que
  planeja usar.
- Veja [Provedores de modelo](/concepts/model-providers) para as regras do provedor.
