---
summary: "macOS 上での Gateway ランタイム（外部 launchd サービス）"
read_when:
  - OpenClaw.app のパッケージング
  - macOS の Gateway launchd サービスのデバッグ
  - macOS 向け Gateway CLI のインストール
title: "macOS 上の Gateway"
x-i18n:
  source_path: platforms/mac/bundled-gateway.md
  source_hash: 4a3e963d13060b12
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:17Z
---

# macOS 上の Gateway（外部 launchd）

OpenClaw.app には、Node/Bun や Gateway ランタイムはもはや同梱されていません。macOS アプリは **外部** の `openclaw` CLI インストールを前提としており、Gateway を子プロセスとして起動しません。また、Gateway を稼働させ続けるためにユーザーごとの launchd サービスを管理します（すでにローカルで Gateway が実行中の場合は、それに接続します）。

## CLI のインストール（ローカルモードでは必須）

Mac に Node 22+ が必要です。その後、`openclaw` をグローバルにインストールします。

```bash
npm install -g openclaw@<version>
```

macOS アプリの **Install CLI** ボタンは、npm/pnpm 経由で同じフローを実行します（Gateway ランタイムには bun は推奨されません）。

## Launchd（LaunchAgent としての Gateway）

ラベル：

- `bot.molt.gateway`（または `bot.molt.<profile>`。従来の `com.openclaw.*` が残っている場合があります）

Plist の場所（ユーザーごと）：

- `~/Library/LaunchAgents/bot.molt.gateway.plist`
  （または `~/Library/LaunchAgents/bot.molt.<profile>.plist`）

管理：

- ローカルモードでは、macOS アプリが LaunchAgent のインストール／更新を管理します。
- CLI からもインストールできます：`openclaw gateway install`。

挙動：

- 「OpenClaw Active」は LaunchAgent の有効／無効を切り替えます。
- アプリを終了しても Gateway は停止しません（launchd により稼働が維持されます）。
- 設定されたポートで Gateway がすでに実行中の場合、アプリは新規に起動せず、それに接続します。

ログ：

- launchd の stdout/err：`/tmp/openclaw/openclaw-gateway.log`

## バージョン互換性

macOS アプリは、Gateway のバージョンを自身のバージョンと照合します。互換性がない場合は、アプリのバージョンに合わせてグローバル CLI を更新してください。

## スモークチェック

```bash
openclaw --version

OPENCLAW_SKIP_CHANNELS=1 \
OPENCLAW_SKIP_CANVAS_HOST=1 \
openclaw gateway --port 18999 --bind loopback
```

次に：

```bash
openclaw gateway call health --url ws://127.0.0.1:18999 --timeout 3000
```
