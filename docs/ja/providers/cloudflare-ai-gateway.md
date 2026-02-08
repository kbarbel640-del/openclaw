---
title: "Cloudflare AI Gateway"
summary: "Cloudflare AI Gateway のセットアップ（認証 + モデル選択）"
read_when:
  - OpenClaw で Cloudflare AI Gateway を使用したい場合
  - アカウント ID、Gateway ID、または API キーの 環境変数 が必要な場合
x-i18n:
  source_path: providers/cloudflare-ai-gateway.md
  source_hash: db77652c37652ca2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:30Z
---

# Cloudflare AI Gateway

Cloudflare AI Gateway はプロバイダー API の前段に配置され、分析、キャッシュ、制御を追加できます。Anthropic の場合、OpenClaw は Gateway のエンドポイント経由で Anthropic Messages API を使用します。

- プロバイダー: `cloudflare-ai-gateway`
- ベース URL: `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/anthropic`
- デフォルトモデル: `cloudflare-ai-gateway/claude-sonnet-4-5`
- API キー: `CLOUDFLARE_AI_GATEWAY_API_KEY`（Gateway 経由のリクエストに使用するプロバイダー API キー）

Anthropic のモデルでは、Anthropic API キーを使用してください。

## クイックスタート

1. プロバイダー API キーと Gateway の詳細を設定します:

```bash
openclaw onboard --auth-choice cloudflare-ai-gateway-api-key
```

2. デフォルトモデルを設定します:

```json5
{
  agents: {
    defaults: {
      model: { primary: "cloudflare-ai-gateway/claude-sonnet-4-5" },
    },
  },
}
```

## 非対話型の例

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice cloudflare-ai-gateway-api-key \
  --cloudflare-ai-gateway-account-id "your-account-id" \
  --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
  --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY"
```

## 認証付き Gateway

Cloudflare で Gateway 認証を有効にしている場合は、`cf-aig-authorization` ヘッダーを追加してください（これはプロバイダー API キーに加えて必要です）。

```json5
{
  models: {
    providers: {
      "cloudflare-ai-gateway": {
        headers: {
          "cf-aig-authorization": "Bearer <cloudflare-ai-gateway-token>",
        },
      },
    },
  },
}
```

## 環境に関する注意

Gateway がデーモン（launchd/systemd）として実行されている場合は、`CLOUDFLARE_AI_GATEWAY_API_KEY` がそのプロセスから利用可能であることを確認してください（例: `~/.openclaw/.env` 内、または `env.shellEnv` 経由）。
