---
summary: "OpenClaw で API キーまたは Codex サブスクリプションを使用して OpenAI を利用します"
read_when:
  - OpenClaw で OpenAI モデルを使用したい場合
  - API キーではなく Codex サブスクリプション認証を使用したい場合
title: "OpenAI"
x-i18n:
  source_path: providers/openai.md
  source_hash: 13d8fd7f1f935b0a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:36Z
---

# OpenAI

OpenAI は GPT モデル向けの開発者 API を提供しています。Codex は、サブスクリプションアクセス向けの **ChatGPT サインイン**、または従量課金アクセス向けの **API キー** サインインをサポートします。Codex cloud では ChatGPT サインインが必要です。

## オプション A: OpenAI API キー（OpenAI Platform）

**最適な用途:** 直接の API アクセスと従量課金。
OpenAI ダッシュボードから API キーを取得してください。

### CLI セットアップ

```bash
openclaw onboard --auth-choice openai-api-key
# or non-interactive
openclaw onboard --openai-api-key "$OPENAI_API_KEY"
```

### 設定スニペット

```json5
{
  env: { OPENAI_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "openai/gpt-5.1-codex" } } },
}
```

## オプション B: OpenAI Code（Codex）サブスクリプション

**最適な用途:** API キーの代わりに ChatGPT/Codex サブスクリプションアクセスを使用する場合。
Codex cloud では ChatGPT サインインが必要ですが、Codex CLI は ChatGPT または API キーのサインインをサポートします。

### CLI セットアップ

```bash
# Run Codex OAuth in the wizard
openclaw onboard --auth-choice openai-codex

# Or run OAuth directly
openclaw models auth login --provider openai-codex
```

### 設定スニペット

```json5
{
  agents: { defaults: { model: { primary: "openai-codex/gpt-5.3-codex" } } },
}
```

## 注意事項

- モデル参照は常に `provider/model` を使用します（[/concepts/models](/concepts/models) を参照）。
- 認証の詳細と再利用ルールは [/concepts/oauth](/concepts/oauth) に記載されています。
