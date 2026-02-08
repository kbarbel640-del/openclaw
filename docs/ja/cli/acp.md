---
summary: "IDE 統合のために ACP ブリッジを実行します"
read_when:
  - ACP ベースの IDE 統合をセットアップしているとき
  - Gateway（ゲートウェイ）への ACP セッションルーティングをデバッグしているとき
title: "acp"
x-i18n:
  source_path: cli/acp.md
  source_hash: 0c09844297da250b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:51:23Z
---

# acp

OpenClaw Gateway（ゲートウェイ）と通信する ACP（Agent Client Protocol）ブリッジを実行します。

このコマンドは IDE 向けに stdio 経由で ACP を話し、プロンプトを WebSocket 経由で Gateway（ゲートウェイ）に転送します。ACP セッションを Gateway（ゲートウェイ）のセッションキーにマッピングしたまま維持します。

## Usage

```bash
openclaw acp

# Remote Gateway
openclaw acp --url wss://gateway-host:18789 --token <token>

# Attach to an existing session key
openclaw acp --session agent:main:main

# Attach by label (must already exist)
openclaw acp --session-label "support inbox"

# Reset the session key before the first prompt
openclaw acp --session agent:main:main --reset-session
```

## ACP client（デバッグ）

組み込みの ACP クライアントを使用して、IDE なしでブリッジの健全性を確認します。
ACP ブリッジを起動し、プロンプトを対話的に入力できます。

```bash
openclaw acp client

# Point the spawned bridge at a remote Gateway
openclaw acp client --server-args --url wss://gateway-host:18789 --token <token>

# Override the server command (default: openclaw)
openclaw acp client --server "node" --server-args openclaw.mjs acp --url ws://127.0.0.1:19001
```

## 使い方

IDE（または他のクライアント）が Agent Client Protocol を話し、それで OpenClaw Gateway（ゲートウェイ）セッションを操作したい場合に ACP を使用します。

1. Gateway（ゲートウェイ）が稼働していることを確認します（ローカルまたはリモート）。
2. Gateway（ゲートウェイ）のターゲットを設定します（設定またはフラグ）。
3. stdio 経由で `openclaw acp` を実行するよう IDE を設定します。

設定例（永続化）:

```bash
openclaw config set gateway.remote.url wss://gateway-host:18789
openclaw config set gateway.remote.token <token>
```

直接実行の例（設定の書き込みなし）:

```bash
openclaw acp --url wss://gateway-host:18789 --token <token>
```

## エージェントの選択

ACP はエージェントを直接選択しません。Gateway（ゲートウェイ）のセッションキーでルーティングします。

特定のエージェントをターゲットにするには、エージェントスコープのセッションキーを使用します:

```bash
openclaw acp --session agent:main:main
openclaw acp --session agent:design:main
openclaw acp --session agent:qa:bug-123
```

各 ACP セッションは単一の Gateway（ゲートウェイ）セッションキーにマッピングされます。1 つのエージェントは多数のセッションを持てます。キーまたはラベルを上書きしない限り、ACP は分離された `acp:<uuid>` セッションをデフォルトにします。

## Zed エディターのセットアップ

`~/.config/zed/settings.json` にカスタム ACP エージェントを追加します（または Zed の Settings UI を使用します）:

```json
{
  "agent_servers": {
    "OpenClaw ACP": {
      "type": "custom",
      "command": "openclaw",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

特定の Gateway（ゲートウェイ）またはエージェントをターゲットにするには:

```json
{
  "agent_servers": {
    "OpenClaw ACP": {
      "type": "custom",
      "command": "openclaw",
      "args": [
        "acp",
        "--url",
        "wss://gateway-host:18789",
        "--token",
        "<token>",
        "--session",
        "agent:design:main"
      ],
      "env": {}
    }
  }
}
```

Zed で Agent パネルを開き、「OpenClaw ACP」を選択してスレッドを開始します。

## セッションのマッピング

デフォルトでは、ACP セッションは `acp:` プレフィックス付きの分離された Gateway（ゲートウェイ）セッションキーを取得します。
既知のセッションを再利用するには、セッションキーまたはラベルを渡します:

- `--session <key>`: 特定の Gateway（ゲートウェイ）セッションキーを使用します。
- `--session-label <label>`: ラベルで既存のセッションを解決します。
- `--reset-session`: そのキーのために新しいセッション ID を発行します（同じキー、新しいトランスクリプト）。

ACP クライアントがメタデータをサポートしている場合、セッションごとに上書きできます:

```json
{
  "_meta": {
    "sessionKey": "agent:main:main",
    "sessionLabel": "support inbox",
    "resetSession": true
  }
}
```

セッションキーの詳細は [/concepts/session](/concepts/session) を参照してください。

## Options

- `--url <url>`: Gateway（ゲートウェイ）の WebSocket URL（設定されている場合、デフォルトは gateway.remote.url）。
- `--token <token>`: Gateway（ゲートウェイ）認証トークン。
- `--password <password>`: Gateway（ゲートウェイ）認証パスワード。
- `--session <key>`: デフォルトのセッションキー。
- `--session-label <label>`: 解決するデフォルトのセッションラベル。
- `--require-existing`: セッションキー/ラベルが存在しない場合に失敗します。
- `--reset-session`: 初回使用前にセッションキーをリセットします。
- `--no-prefix-cwd`: 作業ディレクトリでプロンプトをプレフィックスしません。
- `--verbose, -v`: stderr への詳細ログ。

### `acp client` options

- `--cwd <dir>`: ACP セッションの作業ディレクトリ。
- `--server <command>`: ACP サーバーコマンド（デフォルト: `openclaw`）。
- `--server-args <args...>`: ACP サーバーに渡す追加引数。
- `--server-verbose`: ACP サーバーで詳細ログを有効化します。
- `--verbose, -v`: 詳細なクライアントログ。
