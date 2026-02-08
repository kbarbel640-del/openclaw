---
summary: "Configurar Moonshot K2 vs Kimi Coding (provedores + chaves separadas)"
read_when:
  - Voce quer configurar Moonshot K2 (Moonshot Open Platform) vs Kimi Coding
  - Voce precisa entender endpoints, chaves e referencias de modelo separados
  - Voce quer configuracao de copiar/colar para qualquer provedor
title: "Moonshot AI"
x-i18n:
  source_path: providers/moonshot.md
  source_hash: 73b8b691b923ce3d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:05Z
---

# Moonshot AI (Kimi)

Moonshot fornece a API Kimi com endpoints compatíveis com OpenAI. Configure o
provedor e defina o modelo padrao como `moonshot/kimi-k2.5`, ou use
Kimi Coding com `kimi-coding/k2p5`.

IDs atuais dos modelos Kimi K2:

{/_ moonshot-kimi-k2-ids:start _/ && null}

- `kimi-k2.5`
- `kimi-k2-0905-preview`
- `kimi-k2-turbo-preview`
- `kimi-k2-thinking`
- `kimi-k2-thinking-turbo`
  {/_ moonshot-kimi-k2-ids:end _/ && null}

```bash
openclaw onboard --auth-choice moonshot-api-key
```

Kimi Coding:

```bash
openclaw onboard --auth-choice kimi-code-api-key
```

Nota: Moonshot e Kimi Coding sao provedores separados. As chaves nao sao intercambiaveis, os endpoints diferem e as referencias de modelo diferem (Moonshot usa `moonshot/...`, Kimi Coding usa `kimi-coding/...`).

## Trecho de configuracao (API Moonshot)

```json5
{
  env: { MOONSHOT_API_KEY: "sk-..." },
  agents: {
    defaults: {
      model: { primary: "moonshot/kimi-k2.5" },
      models: {
        // moonshot-kimi-k2-aliases:start
        "moonshot/kimi-k2.5": { alias: "Kimi K2.5" },
        "moonshot/kimi-k2-0905-preview": { alias: "Kimi K2" },
        "moonshot/kimi-k2-turbo-preview": { alias: "Kimi K2 Turbo" },
        "moonshot/kimi-k2-thinking": { alias: "Kimi K2 Thinking" },
        "moonshot/kimi-k2-thinking-turbo": { alias: "Kimi K2 Thinking Turbo" },
        // moonshot-kimi-k2-aliases:end
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      moonshot: {
        baseUrl: "https://api.moonshot.ai/v1",
        apiKey: "${MOONSHOT_API_KEY}",
        api: "openai-completions",
        models: [
          // moonshot-kimi-k2-models:start
          {
            id: "kimi-k2.5",
            name: "Kimi K2.5",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          {
            id: "kimi-k2-0905-preview",
            name: "Kimi K2 0905 Preview",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          {
            id: "kimi-k2-turbo-preview",
            name: "Kimi K2 Turbo",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          {
            id: "kimi-k2-thinking",
            name: "Kimi K2 Thinking",
            reasoning: true,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          {
            id: "kimi-k2-thinking-turbo",
            name: "Kimi K2 Thinking Turbo",
            reasoning: true,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 256000,
            maxTokens: 8192,
          },
          // moonshot-kimi-k2-models:end
        ],
      },
    },
  },
}
```

## Kimi Coding

```json5
{
  env: { KIMI_API_KEY: "sk-..." },
  agents: {
    defaults: {
      model: { primary: "kimi-coding/k2p5" },
      models: {
        "kimi-coding/k2p5": { alias: "Kimi K2.5" },
      },
    },
  },
}
```

## Notas

- As referencias de modelo do Moonshot usam `moonshot/<modelId>`. As referencias de modelo do Kimi Coding usam `kimi-coding/<modelId>`.
- Substitua os metadados de precos e contexto em `models.providers` se necessario.
- Se o Moonshot publicar limites de contexto diferentes para um modelo, ajuste
  `contextWindow` conforme necessario.
- Use `https://api.moonshot.ai/v1` para o endpoint internacional e `https://api.moonshot.cn/v1` para o endpoint da China.
