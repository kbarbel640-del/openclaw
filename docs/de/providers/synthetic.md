---
summary: „Verwenden Sie die Anthropic-kompatible API von Synthetic in OpenClaw“
read_when:
  - Sie moechten Synthetic als Modellanbieter verwenden
  - Sie benoetigen einen Synthetic-API-Schluessel oder eine Base-URL-Konfiguration
title: „Synthetic“
x-i18n:
  source_path: providers/synthetic.md
  source_hash: f3f6e3eb86466175
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:17Z
---

# Synthetic

Synthetic stellt Anthropic-kompatible Endpunkte bereit. OpenClaw registriert es als den
`synthetic`-Anbieter und verwendet die Anthropic Messages API.

## Schnellstart

1. Setzen Sie `SYNTHETIC_API_KEY` (oder fuehren Sie den untenstehenden Assistenten aus).
2. Fuehren Sie die Einfuehrung aus:

```bash
openclaw onboard --auth-choice synthetic-api-key
```

Das Standardmodell ist gesetzt auf:

```
synthetic/hf:MiniMaxAI/MiniMax-M2.1
```

## Konfigurationsbeispiel

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

Hinweis: Der Anthropic-Client von OpenClaw haengt `/v1` an die Base-URL an; verwenden Sie daher
`https://api.synthetic.new/anthropic` (nicht `/anthropic/v1`). Falls Synthetic seine Base-URL aendert,
ueberschreiben Sie `models.providers.synthetic.baseUrl`.

## Modellkatalog

Alle unten aufgefuehrten Modelle verwenden die Kosten `0` (Eingabe/Ausgabe/Cache).

| Modell-ID                                              | Kontextfenster | Maximale Tokens | Schlussfolgern | Eingabe      |
| ------------------------------------------------------ | -------------- | --------------- | -------------- | ------------ |
| `hf:MiniMaxAI/MiniMax-M2.1`                            | 192000         | 65536           | false          | text         |
| `hf:moonshotai/Kimi-K2-Thinking`                       | 256000         | 8192            | true           | text         |
| `hf:zai-org/GLM-4.7`                                   | 198000         | 128000          | false          | text         |
| `hf:deepseek-ai/DeepSeek-R1-0528`                      | 128000         | 8192            | false          | text         |
| `hf:deepseek-ai/DeepSeek-V3-0324`                      | 128000         | 8192            | false          | text         |
| `hf:deepseek-ai/DeepSeek-V3.1`                         | 128000         | 8192            | false          | text         |
| `hf:deepseek-ai/DeepSeek-V3.1-Terminus`                | 128000         | 8192            | false          | text         |
| `hf:deepseek-ai/DeepSeek-V3.2`                         | 159000         | 8192            | false          | text         |
| `hf:meta-llama/Llama-3.3-70B-Instruct`                 | 128000         | 8192            | false          | text         |
| `hf:meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` | 524000         | 8192            | false          | text         |
| `hf:moonshotai/Kimi-K2-Instruct-0905`                  | 256000         | 8192            | false          | text         |
| `hf:openai/gpt-oss-120b`                               | 128000         | 8192            | false          | text         |
| `hf:Qwen/Qwen3-235B-A22B-Instruct-2507`                | 256000         | 8192            | false          | text         |
| `hf:Qwen/Qwen3-Coder-480B-A35B-Instruct`               | 256000         | 8192            | false          | text         |
| `hf:Qwen/Qwen3-VL-235B-A22B-Instruct`                  | 250000         | 8192            | false          | text + image |
| `hf:zai-org/GLM-4.5`                                   | 128000         | 128000          | false          | text         |
| `hf:zai-org/GLM-4.6`                                   | 198000         | 128000          | false          | text         |
| `hf:deepseek-ai/DeepSeek-V3`                           | 128000         | 8192            | false          | text         |
| `hf:Qwen/Qwen3-235B-A22B-Thinking-2507`                | 256000         | 8192            | true           | text         |

## Hinweise

- Modell-Referenzen verwenden `synthetic/<modelId>`.
- Wenn Sie eine Modell-Allowlist aktivieren (`agents.defaults.models`), fuegen Sie jedes Modell hinzu, das Sie
  verwenden moechten.
- Siehe [Model providers](/concepts/model-providers) fuer Anbieterregeln.
