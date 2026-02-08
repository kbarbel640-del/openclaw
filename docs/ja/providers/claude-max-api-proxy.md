---
summary: "Claude Max/Pro のサブスクリプションを OpenAI 互換 API エンドポイントとして使用します"
read_when:
  - OpenAI 互換ツールで Claude Max のサブスクリプションを使用したい場合
  - Claude Code CLI をラップするローカル API サーバーが必要な場合
  - API キーではなくサブスクリプションを使ってコストを節約したい場合
title: "Claude Max API プロキシ"
x-i18n:
  source_path: providers/claude-max-api-proxy.md
  source_hash: 63b61096b96b720c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:33Z
---

# Claude Max API プロキシ

**claude-max-api-proxy** は、Claude Max/Pro のサブスクリプションを OpenAI 互換の API エンドポイントとして公開するコミュニティツールです。これにより、OpenAI API 形式をサポートする任意のツールでサブスクリプションを利用できます。

## なぜ使用するのか

| アプローチ                    | コスト                                          | 最適な用途                   |
| ----------------------------- | ----------------------------------------------- | ---------------------------- |
| Anthropic API                 | トークン課金（Opus で入力 ~$15/M、出力 ~$75/M） | 本番アプリ、高ボリューム     |
| Claude Max サブスクリプション | 月額 $200 の定額                                | 個人利用、開発、無制限の使用 |

Claude Max のサブスクリプションをお持ちで、OpenAI 互換ツールで利用したい場合、このプロキシによって大幅なコスト削減が可能です。

## 仕組み

```
Your App → claude-max-api-proxy → Claude Code CLI → Anthropic (via subscription)
     (OpenAI format)              (converts format)      (uses your login)
```

このプロキシは次のことを行います。

1. `http://localhost:3456/v1/chat/completions` で OpenAI 形式のリクエストを受け付けます
2. それらを Claude Code CLI コマンドに変換します
3. OpenAI 形式でレスポンスを返します（ストリーミング対応）

## インストール

```bash
# Requires Node.js 20+ and Claude Code CLI
npm install -g claude-max-api-proxy

# Verify Claude CLI is authenticated
claude --version
```

## 使い方

### サーバーを起動する

```bash
claude-max-api
# Server runs at http://localhost:3456
```

### テストする

```bash
# Health check
curl http://localhost:3456/health

# List models
curl http://localhost:3456/v1/models

# Chat completion
curl http://localhost:3456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### OpenClaw と併用する場合

カスタムの OpenAI 互換エンドポイントとして、OpenClaw をこのプロキシに向けることができます。

```json5
{
  env: {
    OPENAI_API_KEY: "not-needed",
    OPENAI_BASE_URL: "http://localhost:3456/v1",
  },
  agents: {
    defaults: {
      model: { primary: "openai/claude-opus-4" },
    },
  },
}
```

## 利用可能なモデル

| モデル ID         | 対応先          |
| ----------------- | --------------- |
| `claude-opus-4`   | Claude Opus 4   |
| `claude-sonnet-4` | Claude Sonnet 4 |
| `claude-haiku-4`  | Claude Haiku 4  |

## macOS での自動起動

プロキシを自動的に実行するための LaunchAgent を作成します。

```bash
cat > ~/Library/LaunchAgents/com.claude-max-api.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.claude-max-api</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/usr/local/lib/node_modules/claude-max-api-proxy/dist/server/standalone.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:~/.local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude-max-api.plist
```

## リンク

- **npm:** https://www.npmjs.com/package/claude-max-api-proxy
- **GitHub:** https://github.com/atalovesyou/claude-max-api-proxy
- **Issues:** https://github.com/atalovesyou/claude-max-api-proxy/issues

## 注記

- これは **コミュニティツール** であり、Anthropic や OpenClaw による公式サポートはありません
- Claude Code CLI が認証された有効な Claude Max/Pro サブスクリプションが必要です
- プロキシはローカルで実行され、データを第三者のサーバーに送信しません
- ストリーミングレスポンスは完全にサポートされています

## 関連項目

- [Anthropic プロバイダー](/providers/anthropic) - setup-token または API キーを使用した Claude のネイティブな OpenClaw 連携
- [OpenAI プロバイダー](/providers/openai) - OpenAI/Codex のサブスクリプション向け
