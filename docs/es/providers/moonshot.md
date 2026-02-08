---
summary: "Configurar Moonshot K2 vs Kimi Coding (proveedores y claves separados)"
read_when:
  - Desea configurar Moonshot K2 (Moonshot Open Platform) vs Kimi Coding
  - Necesita comprender endpoints, claves y referencias de modelos separados
  - Quiere configuraciones para copiar y pegar para cualquiera de los proveedores
title: "Moonshot AI"
x-i18n:
  source_path: providers/moonshot.md
  source_hash: 73b8b691b923ce3d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:38Z
---

# Moonshot AI (Kimi)

Moonshot proporciona la API de Kimi con endpoints compatibles con OpenAI. Configure el
proveedor y establezca el modelo predeterminado en `moonshot/kimi-k2.5`, o use
Kimi Coding con `kimi-coding/k2p5`.

IDs actuales de modelos Kimi K2:

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

Nota: Moonshot y Kimi Coding son proveedores separados. Las claves no son intercambiables, los endpoints difieren y las referencias de modelos difieren (Moonshot usa `moonshot/...`, Kimi Coding usa `kimi-coding/...`).

## Fragmento de configuracion (API de Moonshot)

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

- Las referencias de modelos de Moonshot usan `moonshot/<modelId>`. Las referencias de modelos de Kimi Coding usan `kimi-coding/<modelId>`.
- Sobrescriba los metadatos de precios y contexto en `models.providers` si es necesario.
- Si Moonshot publica limites de contexto diferentes para un modelo, ajuste
  `contextWindow` en consecuencia.
- Use `https://api.moonshot.ai/v1` para el endpoint internacional y `https://api.moonshot.cn/v1` para el endpoint de China.
