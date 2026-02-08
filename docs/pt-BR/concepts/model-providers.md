---
summary: "Visão geral dos provedores de modelo com exemplos de configuração + fluxos de CLI"
read_when:
  - Você precisa de uma referência de configuração de modelos por provedor
  - Você quer exemplos de configurações ou comandos de onboarding via CLI para provedores de modelo
title: "Provedores de Modelo"
x-i18n:
  source_path: concepts/model-providers.md
  source_hash: 003efe22aaa37e8e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:59Z
---

# Provedores de modelo

Esta página cobre **provedores de LLM/modelos** (não canais de chat como WhatsApp/Telegram).
Para regras de seleção de modelos, veja [/concepts/models](/concepts/models).

## Regras rápidas

- Referências de modelo usam `provider/model` (exemplo: `opencode/claude-opus-4-6`).
- Se você definir `agents.defaults.models`, ele se torna a allowlist.
- Ajudantes de CLI: `openclaw onboard`, `openclaw models list`, `openclaw models set <provider/model>`.

## Provedores integrados (catálogo pi-ai)

O OpenClaw vem com o catálogo pi‑ai. Esses provedores **não**
exigem configuração de `models.providers`; basta definir a autenticação + escolher um modelo.

### OpenAI

- Provedor: `openai`
- Autenticação: `OPENAI_API_KEY`
- Modelo de exemplo: `openai/gpt-5.1-codex`
- CLI: `openclaw onboard --auth-choice openai-api-key`

```json5
{
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

### Anthropic

- Provedor: `anthropic`
- Autenticação: `ANTHROPIC_API_KEY` ou `claude setup-token`
- Modelo de exemplo: `anthropic/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice token` (colar setup-token) ou `openclaw models auth paste-token --provider anthropic`

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

### OpenAI Code (Codex)

- Provedor: `openai-codex`
- Autenticação: OAuth (ChatGPT)
- Modelo de exemplo: `openai-codex/gpt-5.3-codex`
- CLI: `openclaw onboard --auth-choice openai-codex` ou `openclaw models auth login --provider openai-codex`

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

### OpenCode Zen

- Provedor: `opencode`
- Autenticação: `OPENCODE_API_KEY` (ou `OPENCODE_ZEN_API_KEY`)
- Modelo de exemplo: `opencode/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice opencode-zen`

```json5
{
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

### Google Gemini (chave de API)

- Provedor: `google`
- Autenticação: `GEMINI_API_KEY`
- Modelo de exemplo: `google/gemini-3-pro-preview`
- CLI: `openclaw onboard --auth-choice gemini-api-key`

### Google Vertex, Antigravity e Gemini CLI

- Provedores: `google-vertex`, `google-antigravity`, `google-gemini-cli`
- Autenticação: Vertex usa gcloud ADC; Antigravity/Gemini CLI usam seus respectivos fluxos de autenticação
- O OAuth do Antigravity é distribuído como um plugin integrado (`google-antigravity-auth`, desativado por padrão).
  - Habilitar: `openclaw plugins enable google-antigravity-auth`
  - Login: `openclaw models auth login --provider google-antigravity --set-default`
- O OAuth do Gemini CLI é distribuído como um plugin integrado (`google-gemini-cli-auth`, desativado por padrão).
  - Habilitar: `openclaw plugins enable google-gemini-cli-auth`
  - Login: `openclaw models auth login --provider google-gemini-cli --set-default`
  - Observação: você **não** cola um client id ou secret em `openclaw.json`. O fluxo de login da CLI armazena
    tokens em perfis de autenticação no host do Gateway.

### Z.AI (GLM)

- Provedor: `zai`
- Autenticação: `ZAI_API_KEY`
- Modelo de exemplo: `zai/glm-4.7`
- CLI: `openclaw onboard --auth-choice zai-api-key`
  - Aliases: `z.ai/*` e `z-ai/*` normalizam para `zai/*`

### Vercel AI Gateway

- Provedor: `vercel-ai-gateway`
- Autenticação: `AI_GATEWAY_API_KEY`
- Modelo de exemplo: `vercel-ai-gateway/anthropic/claude-opus-4.6`
- CLI: `openclaw onboard --auth-choice ai-gateway-api-key`

### Outros provedores integrados

- OpenRouter: `openrouter` (`OPENROUTER_API_KEY`)
- Modelo de exemplo: `openrouter/anthropic/claude-sonnet-4-5`
- xAI: `xai` (`XAI_API_KEY`)
- Groq: `groq` (`GROQ_API_KEY`)
- Cerebras: `cerebras` (`CEREBRAS_API_KEY`)
  - Modelos GLM no Cerebras usam os ids `zai-glm-4.7` e `zai-glm-4.6`.
  - URL base compatível com OpenAI: `https://api.cerebras.ai/v1`.
- Mistral: `mistral` (`MISTRAL_API_KEY`)
- GitHub Copilot: `github-copilot` (`COPILOT_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN`)

## Provedores via `models.providers` (URL personalizada/base)

Use `models.providers` (ou `models.json`) para adicionar provedores **personalizados** ou
proxies compatíveis com OpenAI/Anthropic.

### Moonshot AI (Kimi)

Moonshot usa endpoints compatíveis com OpenAI, então configure-o como um provedor personalizado:

- Provedor: `moonshot`
- Autenticação: `MOONSHOT_API_KEY`
- Modelo de exemplo: `moonshot/kimi-k2.5`

IDs de modelo Kimi K2:

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

Kimi Coding usa o endpoint compatível com Anthropic da Moonshot AI:

- Provedor: `kimi-coding`
- Autenticação: `KIMI_API_KEY`
- Modelo de exemplo: `kimi-coding/k2p5`

```json5
{
  env: { KIMI_API_KEY: "sk-..." },
  agents: {
    defaults: { model: { primary: "kimi-coding/k2p5" } },
  },
}
```

### Qwen OAuth (nível gratuito)

O Qwen fornece acesso OAuth ao Qwen Coder + Vision via um fluxo de device-code.
Habilite o plugin integrado e depois faça login:

```bash
openclaw plugins enable qwen-portal-auth
openclaw models auth login --provider qwen-portal --set-default
```

Referências de modelo:

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

Veja [/providers/qwen](/providers/qwen) para detalhes de configuração e observações.

### Synthetic

O Synthetic fornece modelos compatíveis com Anthropic por trás do provedor `synthetic`:

- Provedor: `synthetic`
- Autenticação: `SYNTHETIC_API_KEY`
- Modelo de exemplo: `synthetic/hf:MiniMaxAI/MiniMax-M2.1`
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

O MiniMax é configurado via `models.providers` porque usa endpoints personalizados:

- MiniMax (compatível com Anthropic): `--auth-choice minimax-api`
- Autenticação: `MINIMAX_API_KEY`

Veja [/providers/minimax](/providers/minimax) para detalhes de configuração, opções de modelo e trechos de configuração.

### Ollama

O Ollama é um runtime de LLM local que fornece uma API compatível com OpenAI:

- Provedor: `ollama`
- Autenticação: Nenhuma necessária (servidor local)
- Modelo de exemplo: `ollama/llama3.3`
- Instalação: https://ollama.ai

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

O Ollama é detectado automaticamente ao rodar localmente em `http://127.0.0.1:11434/v1`. Veja [/providers/ollama](/providers/ollama) para recomendações de modelos e configuração personalizada.

### Proxies locais (LM Studio, vLLM, LiteLLM, etc.)

Exemplo (compatível com OpenAI):

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

Observações:

- Para provedores personalizados, `reasoning`, `input`, `cost`, `contextWindow` e `maxTokens` são opcionais.
  Quando omitidos, o OpenClaw assume como padrão:
  - `reasoning: false`
  - `input: ["text"]`
  - `cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }`
  - `contextWindow: 200000`
  - `maxTokens: 8192`
- Recomendado: definir valores explícitos que correspondam aos limites do seu proxy/modelo.

## Exemplos de CLI

```bash
openclaw onboard --auth-choice opencode-zen
openclaw models set opencode/claude-opus-4-6
openclaw models list
```

Veja também: [/gateway/configuration](/gateway/configuration) para exemplos completos de configuração.
