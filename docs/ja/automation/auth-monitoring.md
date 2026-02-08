---
summary: "モデルプロバイダーの OAuth 有効期限を監視します"
read_when:
  - 認証有効期限監視またはアラートを設定する場合
  - Claude Code / Codex の OAuth リフレッシュチェックを自動化する場合
title: "認証監視"
x-i18n:
  source_path: automation/auth-monitoring.md
  source_hash: eef179af9545ed7a
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:41:31Z
---

# 認証監視

OpenClaw は `openclaw models status` を通じて OAuth 有効期限のヘルスを公開します。自動化とアラートにはこれを使用してください。スクリプトは電話ワークフロー向けの任意の追加要素です。

## 推奨: CLI チェック（ポータブル）

```bash
openclaw models status --check
```

終了コード:

- `0`: OK
- `1`: 期限切れ、または認証情報がありません
- `2`: まもなく期限切れ（24 時間以内）

これは cron/systemd で動作し、追加のスクリプトは不要です。

## 任意のスクリプト（運用 / 電話ワークフロー）

これらは `scripts/` 配下にあり、**任意**です。Gateway（ゲートウェイ）ホストへの SSH アクセスを前提としており、systemd + Termux 向けに調整されています。

- `scripts/claude-auth-status.sh` は現在、`openclaw models status --json` を信頼できる情報源として使用します（CLI が利用できない場合は、直接のファイル読み取りにフォールバックします）。そのため、タイマー用に `PATH` では `openclaw` を維持してください。
- `scripts/auth-monitor.sh`: cron/systemd タイマーのターゲット。アラート（ntfy または電話）を送信します。
- `scripts/systemd/openclaw-auth-monitor.{service,timer}`: systemd ユーザータイマー。
- `scripts/claude-auth-status.sh`: Claude Code + OpenClaw 認証チェッカー（full/json/simple）。
- `scripts/mobile-reauth.sh`: SSH 経由のガイド付き再認証フロー。
- `scripts/termux-quick-auth.sh`: ワンタップウィジェットのステータス + 認証 URL を開きます。
- `scripts/termux-auth-widget.sh`: 完全なガイド付きウィジェットフロー。
- `scripts/termux-sync-widget.sh`: Claude Code の認証情報 → OpenClaw へ同期します。

電話の自動化や systemd タイマーが不要であれば、これらのスクリプトはスキップしてください。
