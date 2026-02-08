---
summary: "モデルプロバイダーの概要（設定例 + CLI フロー）"
read_when:
  - プロバイダーごとのモデル設定リファレンスが必要な場合
  - モデルプロバイダー向けの設定例や CLI オンボーディングコマンドが欲しい場合
title: "モデルプロバイダー"
x-i18n:
  source_path: concepts/model-providers.md
  source_hash: 003efe22aaa37e8e
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:05:57Z
---

# モデルプロバイダー

このページでは **LLM/モデルプロバイダー**（WhatsApp/Telegram のようなチャットチャンネルではありません）を扱います。
モデル選択ルールについては [/concepts/models](/concepts/models) を参照してください。

## クイックルール

- モデル参照は `provider/model` を使用します（例: `opencode/claude-opus-4-6`）。
- `agents.defaults.models` を設定すると、それが許可リストになります。
- CLI ヘルパー: `openclaw onboard`、`openclaw models list`、`openclaw models set <provider/model>`。

## 組み込みプロバイダー（pi-ai カタログ）

OpenClaw には pi‑ai カタログが同梱されています。これらのプロバイダーは **`models.providers` 設定が不要**です。認証を設定してモデルを選ぶだけです。

### OpenAI

- プロバイダー: `openai`
- 認証: `OPENAI_API_KEY`
- モデル例: `openai/gpt-5.1-codex`
- CLI: `openclaw onboard --auth-choice openai-api-key`

```json5
{
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

### Anthropic

- プロバイダー: `anthropic`
- 認証: `ANTHROPIC_API_KEY` または `claude setup-token`
- モデル例: `anthropic/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice token`（setup-token を貼り付け）または `openclaw models auth paste-token --provider anthropic`

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

### OpenAI Code（Codex）

- プロバイダー: `openai-codex`
- 認証: OAuth（ChatGPT）
- モデル例: `openai-codex/gpt-5.3-codex`
- CLI: `openclaw onboard --auth-choice openai-codex` または `openclaw models auth login --provider openai-codex`

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

### OpenCode Zen

- プロバイダー: `opencode`
- 認証: `OPENCODE_API_KEY`（または `OPENCODE_ZEN_API_KEY`）
- モデル例: `opencode/claude-opus-4-6`
- CLI: `openclaw onboard --auth-choice opencode-zen`

```json5
{
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

### Google Gemini（API キー）

- プロバイダー: `google`
- 認証: `GEMINI_API_KEY`
- モデル例: `google/gemini-3-pro-preview`
- CLI: `openclaw onboard --auth-choice gemini-api-key`

### Google Vertex、Antigravity、Gemini CLI

- プロバイダー: `google-vertex`、`google-antigravity`、`google-gemini-cli`
- 認証: Vertex は gcloud ADC を使用します。Antigravity/Gemini CLI はそれぞれの認証フローを使用します
- Antigravity OAuth はバンドルされたプラグインとして提供されています（`google-antigravity-auth`、デフォルトで無効）。
  - 有効化: `openclaw plugins enable google-antigravity-auth`
  - ログイン: `openclaw models auth login --provider google-antigravity --set-default`
- Gemini CLI OAuth はバンドルされたプラグインとして提供されています（`google-gemini-cli-auth`、デフォルトで無効）。
  - 有効化: `openclaw plugins enable google-gemini-cli-auth`
  - ログイン: `openclaw models auth login --provider google-gemini-cli --set-default`
  - 注: `openclaw.json` に client id や secret を貼り付ける必要は **ありません**。CLI のログインフローは、Gateway（ゲートウェイ）ホスト上の認証プロファイルにトークンを保存します。

### Z.AI（GLM）

- プロバイダー: `zai`
- 認証: `ZAI_API_KEY`
- モデル例: `zai/glm-4.7`
- CLI: `openclaw onboard --auth-choice zai-api-key`
  - エイリアス: `z.ai/*` と `z-ai/*` は `zai/*` に正規化されます

### Vercel AI Gateway

- プロバイダー: `vercel-ai-gateway`
- 認証: `AI_GATEWAY_API_KEY`
- モデル例: `vercel-ai-gateway/anthropic/claude-opus-4.6`
- CLI: `openclaw onboard --auth-choice ai-gateway-api-key`

### その他の組み込みプロバイダー

- OpenRouter: `openrouter`（`OPENROUTER_API_KEY`）
- モデル例: `openrouter/anthropic/claude-sonnet-4-5`
- xAI: `xai`（`XAI_API_KEY`）
- Groq: `groq`（`GROQ_API_KEY`）
- Cerebras: `cerebras`（`CEREBRAS_API_KEY`）
  - Cerebras 上の GLM モデルは id `zai-glm-4.7` と `zai-glm-4.6` を使用します。
  - OpenAI 互換 base URL: `https://api.cerebras.ai/v1`。
- Mistral: `mistral`（`MISTRAL_API_KEY`）
- GitHub Copilot: `github-copilot`（`COPILOT_GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_TOKEN`）

## `models.providers` 経由のプロバイダー（カスタム/base URL）

`models.providers`（または `models.json`）を使用して **カスタム**プロバイダーや OpenAI/Anthropic 互換プロキシを追加します。

### Moonshot AI（Kimi）

Moonshot は OpenAI 互換エンドポイントを使用するため、カスタムプロバイダーとして設定します。

- プロバイダー: `moonshot`
- 認証: `MOONSHOT_API_KEY`
- モデル例: `moonshot/kimi-k2.5`

Kimi K2 モデル id:

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

Kimi Coding は Moonshot AI の Anthropic 互換エンドポイントを使用します。

- プロバイダー: `kimi-coding`
- 認証: `KIMI_API_KEY`
- モデル例: `kimi-coding/k2p5`

```json5
{
  env: { KIMI_API_KEY: "sk-..." },
  agents: {
    defaults: { model: { primary: "kimi-coding/k2p5" } },
  },
}
```

### Qwen OAuth（無料枠）

Qwen は、デバイスコードフローを介して Qwen Coder + Vision への OAuth アクセスを提供します。
バンドルされたプラグインを有効化してからログインしてください。

```bash
openclaw plugins enable qwen-portal-auth
openclaw models auth login --provider qwen-portal --set-default
```

モデル参照:

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

セットアップ手順と注意事項の詳細は [/providers/qwen](/providers/qwen) を参照してください。

### Synthetic

Synthetic は `synthetic` プロバイダーの背後で Anthropic 互換モデルを提供します。

- プロバイダー: `synthetic`
- 認証: `SYNTHETIC_API_KEY`
- モデル例: `synthetic/hf:MiniMaxAI/MiniMax-M2.1`
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

MiniMax はカスタムエンドポイントを使用するため、`models.providers` 経由で設定します。

- MiniMax（Anthropic 互換）: `--auth-choice minimax-api`
- 認証: `MINIMAX_API_KEY`

セットアップ詳細、モデルオプション、設定スニペットについては [/providers/minimax](/providers/minimax) を参照してください。

### Ollama

Ollama は OpenAI 互換 API を提供するローカル LLM ランタイムです。

- プロバイダー: `ollama`
- 認証: 不要（ローカルサーバー）
- モデル例: `ollama/llama3.3`
- インストール: https://ollama.ai

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

Ollama は、ローカルで `http://127.0.0.1:11434/v1` で実行されている場合に自動検出されます。モデル推奨とカスタム設定については [/providers/ollama](/providers/ollama) を参照してください。

### ローカルプロキシ（LM Studio、vLLM、LiteLLM など）

例（OpenAI 互換）:

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

注意事項:

- カスタムプロバイダーでは、`reasoning`、`input`、`cost`、`contextWindow`、および `maxTokens` は任意です。
  省略した場合、OpenClaw はデフォルトで次を使用します:
  - `reasoning: false`
  - `input: ["text"]`
  - `cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }`
  - `contextWindow: 200000`
  - `maxTokens: 8192`
- 推奨: プロキシ/モデルの制限に一致する明示的な値を設定してください。

## CLI 例

```bash
openclaw onboard --auth-choice opencode-zen
openclaw models set opencode/claude-opus-4-6
openclaw models list
```

あわせて参照: 完全な設定例は [/gateway/configuration](/gateway/configuration) を参照してください。
