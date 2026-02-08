---
summary: "Tong quan nha cung cap mo hinh kem cau hinh mau + luong CLI"
read_when:
  - Ban can tai lieu tham chieu thiet lap mo hinh theo tung nha cung cap
  - Ban muon cau hinh mau hoac lenh CLI huong dan ban dau cho cac nha cung cap mo hinh
title: "Nha cung cap mo hinh"
x-i18n:
  source_path: concepts/model-providers.md
  source_hash: 003efe22aaa37e8e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:56Z
---

# Nha cung cap mo hinh

Trang nay bao gom **cac nha cung cap LLM/mo hinh** (khong phai cac kenh chat nhu WhatsApp/Telegram).
De biet quy tac chon mo hinh, xem [/concepts/models](/concepts/models).

## Quy tac nhanh

- Tham chieu mo hinh su dung `provider/model` (vi du: `opencode/claude-opus-4-6`).
- Neu ban dat `agents.defaults.models`, no se tro thanh danh sach cho phep.
- Tro giup CLI: `openclaw onboard`, `openclaw models list`, `openclaw models set <provider/model>`.

## Nha cung cap tich hop san (pi-ai catalog)

OpenClaw di kem pi‑ai catalog. Cac nha cung cap nay **khong**
yeu cau cau hinh `models.providers`; chi can thiet lap xac thuc + chon mo hinh.

### OpenAI

- Nha cung cap: `openai`
- Xac thuc: `OPENAI_API_KEY`
- Mo hinh vi du: `openai/gpt-5.1-codex`
- CLI: `openclaw onboard --auth-choice openai-api-key`

```json5
{
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

### Anthropic

- Nha cung cap: `anthropic`
- Xac thuc: `ANTHROPIC_API_KEY` hoac `claude setup-token`
- Mo hinh vi du: `anthropic/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice token` (dan setup-token) hoac `openclaw models auth paste-token --provider anthropic`

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

### OpenAI Code (Codex)

- Nha cung cap: `openai-codex`
- Xac thuc: OAuth (ChatGPT)
- Mo hinh vi du: `openai-codex/gpt-5.3-codex`
- CLI: `openclaw onboard --auth-choice openai-codex` hoac `openclaw models auth login --provider openai-codex`

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

### OpenCode Zen

- Nha cung cap: `opencode`
- Xac thuc: `OPENCODE_API_KEY` (hoac `OPENCODE_ZEN_API_KEY`)
- Mo hinh vi du: `opencode/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice opencode-zen`

```json5
{
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

### Google Gemini (API key)

- Nha cung cap: `google`
- Xac thuc: `GEMINI_API_KEY`
- Mo hinh vi du: `google/gemini-3-pro-preview`
- CLI: `openclaw onboard --auth-choice gemini-api-key`

### Google Vertex, Antigravity, va Gemini CLI

- Nha cung cap: `google-vertex`, `google-antigravity`, `google-gemini-cli`
- Xac thuc: Vertex su dung gcloud ADC; Antigravity/Gemini CLI su dung cac luong xac thuc rieng
- OAuth Antigravity duoc phat hanh duoi dang plugin dong goi (`google-antigravity-auth`, mac dinh tat).
  - Bat: `openclaw plugins enable google-antigravity-auth`
  - Dang nhap: `openclaw models auth login --provider google-antigravity --set-default`
- OAuth Gemini CLI duoc phat hanh duoi dang plugin dong goi (`google-gemini-cli-auth`, mac dinh tat).
  - Bat: `openclaw plugins enable google-gemini-cli-auth`
  - Dang nhap: `openclaw models auth login --provider google-gemini-cli --set-default`
  - Luu y: ban **khong** dan client id hoac secret vao `openclaw.json`. Luong dang nhap CLI
    luu token trong cac ho so xac thuc tren may chu Gateway.

### Z.AI (GLM)

- Nha cung cap: `zai`
- Xac thuc: `ZAI_API_KEY`
- Mo hinh vi du: `zai/glm-4.7`
- CLI: `openclaw onboard --auth-choice zai-api-key`
  - Ten goi khac: `z.ai/*` va `z-ai/*` se chuan hoa thanh `zai/*`

### Vercel AI Gateway

- Nha cung cap: `vercel-ai-gateway`
- Xac thuc: `AI_GATEWAY_API_KEY`
- Mo hinh vi du: `vercel-ai-gateway/anthropic/claude-opus-4.6`
- CLI: `openclaw onboard --auth-choice ai-gateway-api-key`

### Cac nha cung cap tich hop san khac

- OpenRouter: `openrouter` (`OPENROUTER_API_KEY`)
- Mo hinh vi du: `openrouter/anthropic/claude-sonnet-4-5`
- xAI: `xai` (`XAI_API_KEY`)
- Groq: `groq` (`GROQ_API_KEY`)
- Cerebras: `cerebras` (`CEREBRAS_API_KEY`)
  - Cac mo hinh GLM tren Cerebras su dung id `zai-glm-4.7` va `zai-glm-4.6`.
  - Base URL tuong thich OpenAI: `https://api.cerebras.ai/v1`.
- Mistral: `mistral` (`MISTRAL_API_KEY`)
- GitHub Copilot: `github-copilot` (`COPILOT_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN`)

## Nha cung cap qua `models.providers` (URL tuy chinh/base)

Su dung `models.providers` (hoac `models.json`) de them cac nha cung cap **tuy chinh** hoac
proxy tuong thich OpenAI/Anthropic.

### Moonshot AI (Kimi)

Moonshot su dung endpoint tuong thich OpenAI, vi vay cau hinh no nhu mot nha cung cap tuy chinh:

- Nha cung cap: `moonshot`
- Xac thuc: `MOONSHOT_API_KEY`
- Mo hinh vi du: `moonshot/kimi-k2.5`

Cac id mo hinh Kimi K2:

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

Kimi Coding su dung endpoint tuong thich Anthropic cua Moonshot AI:

- Nha cung cap: `kimi-coding`
- Xac thuc: `KIMI_API_KEY`
- Mo hinh vi du: `kimi-coding/k2p5`

```json5
{
  env: { KIMI_API_KEY: "sk-..." },
  agents: {
    defaults: { model: { primary: "kimi-coding/k2p5" } },
  },
}
```

### Qwen OAuth (mien phi)

Qwen cung cap truy cap OAuth toi Qwen Coder + Vision thong qua luong device-code.
Bat plugin dong goi, sau do dang nhap:

```bash
openclaw plugins enable qwen-portal-auth
openclaw models auth login --provider qwen-portal --set-default
```

Tham chieu mo hinh:

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

Xem [/providers/qwen](/providers/qwen) de biet chi tiet thiet lap va luu y.

### Synthetic

Synthetic cung cap cac mo hinh tuong thich Anthropic phia sau nha cung cap `synthetic`:

- Nha cung cap: `synthetic`
- Xac thuc: `SYNTHETIC_API_KEY`
- Mo hinh vi du: `synthetic/hf:MiniMaxAI/MiniMax-M2.1`
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

MiniMax duoc cau hinh qua `models.providers` vi no su dung endpoint tuy chinh:

- MiniMax (tuong thich Anthropic): `--auth-choice minimax-api`
- Xac thuc: `MINIMAX_API_KEY`

Xem [/providers/minimax](/providers/minimax) de biet chi tiet thiet lap, tuy chon mo hinh, va cac doan cau hinh mau.

### Ollama

Ollama la mot runtime LLM cuc bo cung cap API tuong thich OpenAI:

- Nha cung cap: `ollama`
- Xac thuc: Khong can (may chu cuc bo)
- Mo hinh vi du: `ollama/llama3.3`
- Cai dat: https://ollama.ai

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

Ollama duoc tu dong phat hien khi chay cuc bo tai `http://127.0.0.1:11434/v1`. Xem [/providers/ollama](/providers/ollama) de biet khuyen nghi mo hinh va cau hinh tuy chinh.

### Proxy cuc bo (LM Studio, vLLM, LiteLLM, v.v.)

Vi du (tuong thich OpenAI):

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

Luu y:

- Doi voi nha cung cap tuy chinh, `reasoning`, `input`, `cost`, `contextWindow`, va `maxTokens` la tuy chon.
  Khi bo qua, OpenClaw mac dinh:
  - `reasoning: false`
  - `input: ["text"]`
  - `cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }`
  - `contextWindow: 200000`
  - `maxTokens: 8192`
- Khuyen nghi: dat gia tri cu the phu hop voi gioi han proxy/mo hinh cua ban.

## Vi du CLI

```bash
openclaw onboard --auth-choice opencode-zen
openclaw models set opencode/claude-opus-4-6
openclaw models list
```

Xem them: [/gateway/configuration](/gateway/configuration) de biet cac vi du cau hinh day du.
