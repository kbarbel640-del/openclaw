---
summary: "Uebersicht der Modellanbieter mit Beispielkonfigurationen und CLI-Abläufen"
read_when:
  - Sie benoetigen eine anbieterweise Referenz zur Modelleinstellung
  - Sie moechten Beispielkonfigurationen oder CLI-Onboarding-Befehle fuer Modellanbieter
title: "Modellanbieter"
x-i18n:
  source_path: concepts/model-providers.md
  source_hash: 003efe22aaa37e8e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:06Z
---

# Modellanbieter

Diese Seite behandelt **LLM-/Modellanbieter** (nicht Chat-Kanaele wie WhatsApp/Telegram).
Fuer Regeln zur Modellauswahl siehe [/concepts/models](/concepts/models).

## Schnelle Regeln

- Modellreferenzen verwenden `provider/model` (Beispiel: `opencode/claude-opus-4-6`).
- Wenn Sie `agents.defaults.models` setzen, wird diese zur Allowlist.
- CLI-Helfer: `openclaw onboard`, `openclaw models list`, `openclaw models set <provider/model>`.

## Integrierte Anbieter (pi-ai-Katalog)

OpenClaw wird mit dem pi‑ai-Katalog ausgeliefert. Diese Anbieter benoetigen **keine**
`models.providers`-Konfiguration; setzen Sie einfach die Authentifizierung und waehlen Sie ein Modell.

### OpenAI

- Anbieter: `openai`
- Auth: `OPENAI_API_KEY`
- Beispielmodell: `openai/gpt-5.1-codex`
- CLI: `openclaw onboard --auth-choice openai-api-key`

```json5
{
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

### Anthropic

- Anbieter: `anthropic`
- Auth: `ANTHROPIC_API_KEY` oder `claude setup-token`
- Beispielmodell: `anthropic/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice token` (Setup-Token einfuegen) oder `openclaw models auth paste-token --provider anthropic`

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

### OpenAI Code (Codex)

- Anbieter: `openai-codex`
- Auth: OAuth (ChatGPT)
- Beispielmodell: `openai-codex/gpt-5.3-codex`
- CLI: `openclaw onboard --auth-choice openai-codex` oder `openclaw models auth login --provider openai-codex`

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

### OpenCode Zen

- Anbieter: `opencode`
- Auth: `OPENCODE_API_KEY` (oder `OPENCODE_ZEN_API_KEY`)
- Beispielmodell: `opencode/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice opencode-zen`

```json5
{
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

### Google Gemini (API-Schluessel)

- Anbieter: `google`
- Auth: `GEMINI_API_KEY`
- Beispielmodell: `google/gemini-3-pro-preview`
- CLI: `openclaw onboard --auth-choice gemini-api-key`

### Google Vertex, Antigravity und Gemini CLI

- Anbieter: `google-vertex`, `google-antigravity`, `google-gemini-cli`
- Auth: Vertex verwendet gcloud ADC; Antigravity/Gemini CLI verwenden ihre jeweiligen Auth-Flows
- Antigravity OAuth wird als gebuendeltes Plugin ausgeliefert (`google-antigravity-auth`, standardmaessig deaktiviert).
  - Aktivieren: `openclaw plugins enable google-antigravity-auth`
  - Login: `openclaw models auth login --provider google-antigravity --set-default`
- Gemini CLI OAuth wird als gebuendeltes Plugin ausgeliefert (`google-gemini-cli-auth`, standardmaessig deaktiviert).
  - Aktivieren: `openclaw plugins enable google-gemini-cli-auth`
  - Login: `openclaw models auth login --provider google-gemini-cli --set-default`
  - Hinweis: Sie fuegen **keine** Client-ID oder kein Secret in `openclaw.json` ein. Der CLI-Login-Flow speichert
    Tokens in Auth-Profilen auf dem Gateway-Host.

### Z.AI (GLM)

- Anbieter: `zai`
- Auth: `ZAI_API_KEY`
- Beispielmodell: `zai/glm-4.7`
- CLI: `openclaw onboard --auth-choice zai-api-key`
  - Aliase: `z.ai/*` und `z-ai/*` werden zu `zai/*` normalisiert

### Vercel AI Gateway

- Anbieter: `vercel-ai-gateway`
- Auth: `AI_GATEWAY_API_KEY`
- Beispielmodell: `vercel-ai-gateway/anthropic/claude-opus-4.6`
- CLI: `openclaw onboard --auth-choice ai-gateway-api-key`

### Weitere integrierte Anbieter

- OpenRouter: `openrouter` (`OPENROUTER_API_KEY`)
- Beispielmodell: `openrouter/anthropic/claude-sonnet-4-5`
- xAI: `xai` (`XAI_API_KEY`)
- Groq: `groq` (`GROQ_API_KEY`)
- Cerebras: `cerebras` (`CEREBRAS_API_KEY`)
  - GLM-Modelle auf Cerebras verwenden die IDs `zai-glm-4.7` und `zai-glm-4.6`.
  - OpenAI-kompatible Basis-URL: `https://api.cerebras.ai/v1`.
- Mistral: `mistral` (`MISTRAL_API_KEY`)
- GitHub Copilot: `github-copilot` (`COPILOT_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN`)

## Anbieter ueber `models.providers` (benutzerdefinierte/Basis-URL)

Verwenden Sie `models.providers` (oder `models.json`), um **benutzerdefinierte** Anbieter oder
OpenAI-/Anthropic-kompatible Proxys hinzuzufuegen.

### Moonshot AI (Kimi)

Moonshot verwendet OpenAI-kompatible Endpunkte und wird daher als benutzerdefinierter Anbieter konfiguriert:

- Anbieter: `moonshot`
- Auth: `MOONSHOT_API_KEY`
- Beispielmodell: `moonshot/kimi-k2.5`

Kimi K2 Modell-IDs:

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

Kimi Coding verwendet den Anthropic-kompatiblen Endpunkt von Moonshot AI:

- Anbieter: `kimi-coding`
- Auth: `KIMI_API_KEY`
- Beispielmodell: `kimi-coding/k2p5`

```json5
{
  env: { KIMI_API_KEY: "sk-..." },
  agents: {
    defaults: { model: { primary: "kimi-coding/k2p5" } },
  },
}
```

### Qwen OAuth (kostenlose Stufe)

Qwen bietet OAuth-Zugriff auf Qwen Coder + Vision ueber einen Device-Code-Flow.
Aktivieren Sie das gebuendelte Plugin und melden Sie sich dann an:

```bash
openclaw plugins enable qwen-portal-auth
openclaw models auth login --provider qwen-portal --set-default
```

Modellreferenzen:

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

Siehe [/providers/qwen](/providers/qwen) fuer Einrichtungsdetails und Hinweise.

### Synthetic

Synthetic stellt Anthropic-kompatible Modelle hinter dem Anbieter `synthetic` bereit:

- Anbieter: `synthetic`
- Auth: `SYNTHETIC_API_KEY`
- Beispielmodell: `synthetic/hf:MiniMaxAI/MiniMax-M2.1`
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

MiniMax wird ueber `models.providers` konfiguriert, da es benutzerdefinierte Endpunkte verwendet:

- MiniMax (Anthropic-kompatibel): `--auth-choice minimax-api`
- Auth: `MINIMAX_API_KEY`

Siehe [/providers/minimax](/providers/minimax) fuer Einrichtungsdetails, Modelloptionen und Konfigurationsbeispiele.

### Ollama

Ollama ist eine lokale LLM-Laufzeitumgebung mit einer OpenAI-kompatiblen API:

- Anbieter: `ollama`
- Auth: Keine erforderlich (lokaler Server)
- Beispielmodell: `ollama/llama3.3`
- Installation: https://ollama.ai

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

Ollama wird automatisch erkannt, wenn es lokal unter `http://127.0.0.1:11434/v1` laeuft. Siehe [/providers/ollama](/providers/ollama) fuer Modellempfehlungen und benutzerdefinierte Konfiguration.

### Lokale Proxys (LM Studio, vLLM, LiteLLM usw.)

Beispiel (OpenAI-kompatibel):

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

Hinweise:

- Fuer benutzerdefinierte Anbieter sind `reasoning`, `input`, `cost`, `contextWindow` und `maxTokens` optional.
  Wenn sie weggelassen werden, verwendet OpenClaw standardmaessig:
  - `reasoning: false`
  - `input: ["text"]`
  - `cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }`
  - `contextWindow: 200000`
  - `maxTokens: 8192`
- Empfehlung: Setzen Sie explizite Werte, die zu den Limits Ihres Proxys/Modells passen.

## CLI-Beispiele

```bash
openclaw onboard --auth-choice opencode-zen
openclaw models set opencode/claude-opus-4-6
openclaw models list
```

Siehe auch: [/gateway/configuration](/gateway/configuration) fuer alle Details und vollstaendige Konfigurationsbeispiele.
