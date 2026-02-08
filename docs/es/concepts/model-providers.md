---
summary: "Descripcion general de proveedores de modelos con configuraciones de ejemplo + flujos de CLI"
read_when:
  - Necesita una referencia de configuracion de modelos proveedor por proveedor
  - Quiere configuraciones de ejemplo o comandos de incorporacion por CLI para proveedores de modelos
title: "Proveedores de modelos"
x-i18n:
  source_path: concepts/model-providers.md
  source_hash: 003efe22aaa37e8e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:40Z
---

# Proveedores de modelos

Esta pagina cubre **proveedores de LLM/modelos** (no canales de chat como WhatsApp/Telegram).
Para las reglas de seleccion de modelos, vea [/concepts/models](/concepts/models).

## Reglas rapidas

- Las referencias de modelos usan `provider/model` (ejemplo: `opencode/claude-opus-4-6`).
- Si establece `agents.defaults.models`, se convierte en la lista permitida.
- Ayudantes de CLI: `openclaw onboard`, `openclaw models list`, `openclaw models set <provider/model>`.

## Proveedores integrados (catalogo pi-ai)

OpenClaw se entrega con el catalogo pi‑ai. Estos proveedores **no** requieren
configuracion `models.providers`; solo establezca la autenticacion y elija un modelo.

### OpenAI

- Proveedor: `openai`
- Autenticacion: `OPENAI_API_KEY`
- Modelo de ejemplo: `openai/gpt-5.1-codex`
- CLI: `openclaw onboard --auth-choice openai-api-key`

```json5
{
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

### Anthropic

- Proveedor: `anthropic`
- Autenticacion: `ANTHROPIC_API_KEY` o `claude setup-token`
- Modelo de ejemplo: `anthropic/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice token` (pegar setup-token) o `openclaw models auth paste-token --provider anthropic`

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

### OpenAI Code (Codex)

- Proveedor: `openai-codex`
- Autenticacion: OAuth (ChatGPT)
- Modelo de ejemplo: `openai-codex/gpt-5.3-codex`
- CLI: `openclaw onboard --auth-choice openai-codex` o `openclaw models auth login --provider openai-codex`

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

### OpenCode Zen

- Proveedor: `opencode`
- Autenticacion: `OPENCODE_API_KEY` (o `OPENCODE_ZEN_API_KEY`)
- Modelo de ejemplo: `opencode/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice opencode-zen`

```json5
{
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

### Google Gemini (clave de API)

- Proveedor: `google`
- Autenticacion: `GEMINI_API_KEY`
- Modelo de ejemplo: `google/gemini-3-pro-preview`
- CLI: `openclaw onboard --auth-choice gemini-api-key`

### Google Vertex, Antigravity y Gemini CLI

- Proveedores: `google-vertex`, `google-antigravity`, `google-gemini-cli`
- Autenticacion: Vertex usa gcloud ADC; Antigravity/Gemini CLI usan sus respectivos flujos de autenticacion
- OAuth de Antigravity se entrega como un plugin incluido (`google-antigravity-auth`, deshabilitado por defecto).
  - Habilitar: `openclaw plugins enable google-antigravity-auth`
  - Iniciar sesion: `openclaw models auth login --provider google-antigravity --set-default`
- OAuth de Gemini CLI se entrega como un plugin incluido (`google-gemini-cli-auth`, deshabilitado por defecto).
  - Habilitar: `openclaw plugins enable google-gemini-cli-auth`
  - Iniciar sesion: `openclaw models auth login --provider google-gemini-cli --set-default`
  - Nota: **no** pega un id de cliente ni un secreto en `openclaw.json`. El flujo de inicio de sesion de la CLI guarda
    tokens en perfiles de autenticacion en el host del Gateway.

### Z.AI (GLM)

- Proveedor: `zai`
- Autenticacion: `ZAI_API_KEY`
- Modelo de ejemplo: `zai/glm-4.7`
- CLI: `openclaw onboard --auth-choice zai-api-key`
  - Alias: `z.ai/*` y `z-ai/*` se normalizan a `zai/*`

### Vercel AI Gateway

- Proveedor: `vercel-ai-gateway`
- Autenticacion: `AI_GATEWAY_API_KEY`
- Modelo de ejemplo: `vercel-ai-gateway/anthropic/claude-opus-4.6`
- CLI: `openclaw onboard --auth-choice ai-gateway-api-key`

### Otros proveedores integrados

- OpenRouter: `openrouter` (`OPENROUTER_API_KEY`)
- Modelo de ejemplo: `openrouter/anthropic/claude-sonnet-4-5`
- xAI: `xai` (`XAI_API_KEY`)
- Groq: `groq` (`GROQ_API_KEY`)
- Cerebras: `cerebras` (`CEREBRAS_API_KEY`)
  - Los modelos GLM en Cerebras usan los ids `zai-glm-4.7` y `zai-glm-4.6`.
  - URL base compatible con OpenAI: `https://api.cerebras.ai/v1`.
- Mistral: `mistral` (`MISTRAL_API_KEY`)
- GitHub Copilot: `github-copilot` (`COPILOT_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN`)

## Proveedores via `models.providers` (URL personalizada/base)

Use `models.providers` (o `models.json`) para agregar proveedores **personalizados** o
proxies compatibles con OpenAI/Anthropic.

### Moonshot AI (Kimi)

Moonshot usa endpoints compatibles con OpenAI, asi que configurarlo como un proveedor personalizado:

- Proveedor: `moonshot`
- Autenticacion: `MOONSHOT_API_KEY`
- Modelo de ejemplo: `moonshot/kimi-k2.5`

IDs de modelos Kimi K2:

{/_ moonshot-kimi-k2-model-refs:start _/ && null}

- `moonshot/kimi-k2.5`
- `moonshot/kimi-k2-0905-preview`
- `moonshot/kimi-k2-turbo-preview`
- `moonshot/kimi-k2-thinking`
- `moonshot/kimi-k2-thinking-turbo`
  {/_ moonshot-kimi-k2-model-refs:end _/ && null}

```json5
{
  agents: {
    defaults: { model: { primary: "moonshot/kimi-k2.5" } },
  },
  models: {
    mode: "merge",
    providers: {
      moonshot: {
        baseUrl: "https://api.moonshot.ai/v1",
        apiKey: "${MOONSHOT_API_KEY}",
        api: "openai-completions",
        models: [{ id: "kimi-k2.5", name: "Kimi K2.5" }],
      },
    },
  },
}
```

### Kimi Coding

Kimi Coding usa el endpoint compatible con Anthropic de Moonshot AI:

- Proveedor: `kimi-coding`
- Autenticacion: `KIMI_API_KEY`
- Modelo de ejemplo: `kimi-coding/k2p5`

```json5
{
  env: { KIMI_API_KEY: "sk-..." },
  agents: {
    defaults: { model: { primary: "kimi-coding/k2p5" } },
  },
}
```

### Qwen OAuth (nivel gratuito)

Qwen proporciona acceso OAuth a Qwen Coder + Vision mediante un flujo de codigo de dispositivo.
Habilite el plugin incluido y luego inicie sesion:

```bash
openclaw plugins enable qwen-portal-auth
openclaw models auth login --provider qwen-portal --set-default
```

Referencias de modelos:

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

Vea [/providers/qwen](/providers/qwen) para detalles de configuracion y notas.

### Synthetic

Synthetic proporciona modelos compatibles con Anthropic detras del proveedor `synthetic`:

- Proveedor: `synthetic`
- Autenticacion: `SYNTHETIC_API_KEY`
- Modelo de ejemplo: `synthetic/hf:MiniMaxAI/MiniMax-M2.1`
- CLI: `openclaw onboard --auth-choice synthetic-api-key`

```json5
{
  agents: {
    defaults: { model: { primary: "synthetic/hf:MiniMaxAI/MiniMax-M2.1" } },
  },
  models: {
    mode: "merge",
    providers: {
      synthetic: {
        baseUrl: "https://api.synthetic.new/anthropic",
        apiKey: "${SYNTHETIC_API_KEY}",
        api: "anthropic-messages",
        models: [{ id: "hf:MiniMaxAI/MiniMax-M2.1", name: "MiniMax M2.1" }],
      },
    },
  },
}
```

### MiniMax

MiniMax se configura mediante `models.providers` porque usa endpoints personalizados:

- MiniMax (compatible con Anthropic): `--auth-choice minimax-api`
- Autenticacion: `MINIMAX_API_KEY`

Vea [/providers/minimax](/providers/minimax) para detalles de configuracion, opciones de modelos y fragmentos de configuracion.

### Ollama

Ollama es un runtime de LLM local que proporciona una API compatible con OpenAI:

- Proveedor: `ollama`
- Autenticacion: No requerida (servidor local)
- Modelo de ejemplo: `ollama/llama3.3`
- Instalacion: https://ollama.ai

```bash
# Install Ollama, then pull a model:
ollama pull llama3.3
```

```json5
{
  agents: {
    defaults: { model: { primary: "ollama/llama3.3" } },
  },
}
```

Ollama se detecta automaticamente cuando se ejecuta localmente en `http://127.0.0.1:11434/v1`. Vea [/providers/ollama](/providers/ollama) para recomendaciones de modelos y configuracion personalizada.

### Proxies locales (LM Studio, vLLM, LiteLLM, etc.)

Ejemplo (compatible con OpenAI):

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: { "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" } },
    },
  },
  models: {
    providers: {
      lmstudio: {
        baseUrl: "http://localhost:1234/v1",
        apiKey: "LMSTUDIO_KEY",
        api: "openai-completions",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

Notas:

- Para proveedores personalizados, `reasoning`, `input`, `cost`, `contextWindow` y `maxTokens` son opcionales.
  Cuando se omiten, OpenClaw usa los valores predeterminados:
  - `reasoning: false`
  - `input: ["text"]`
  - `cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }`
  - `contextWindow: 200000`
  - `maxTokens: 8192`
- Recomendado: establezca valores explicitos que coincidan con los limites de su proxy/modelo.

## Ejemplos de CLI

```bash
openclaw onboard --auth-choice opencode-zen
openclaw models set opencode/claude-opus-4-6
openclaw models list
```

Vea tambien: [/gateway/configuration](/gateway/configuration) para ejemplos completos de configuracion.
