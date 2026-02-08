---
summary: "`openclaw channels`（アカウント、ステータス、ログイン/ログアウト、ログ）の CLI リファレンス"
read_when:
  - WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost（プラグイン）/Signal/iMessage のチャンネルアカウントを追加/削除したい場合
  - チャンネルのステータスを確認したり、チャンネルログを tail したい場合
title: "channels"
x-i18n:
  source_path: cli/channels.md
  source_hash: 16ab1642f247bfa9
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:53:04Z
---

# `openclaw channels`

Gateway（ゲートウェイ）上で、チャットチャンネルのアカウントと実行時ステータスを管理します。

関連ドキュメント:

- チャンネルガイド: [Channels](/channels/index)
- Gateway（ゲートウェイ）設定: [Configuration](/gateway/configuration)

## 一般的なコマンド

```bash
openclaw channels list
openclaw channels status
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels logs --channel all
```

## アカウントの追加 / 削除

```bash
openclaw channels add --channel telegram --token <bot-token>
openclaw channels remove --channel telegram --delete
```

ヒント: `openclaw channels add --help` は、チャンネルごとのフラグ（トークン、アプリトークン、signal-cli のパスなど）を表示します。

## ログイン / ログアウト（対話式）

```bash
openclaw channels login --channel whatsapp
openclaw channels logout --channel whatsapp
```

## トラブルシューティング

- 広範なプローブを行うには `openclaw status --deep` を実行します。
- ガイド付きの修正には `openclaw doctor` を使用します。
- `openclaw channels list` は `Claude: HTTP 403 ... user:profile` を出力します → 利用状況スナップショットには `user:profile` スコープが必要です。`--no-usage` を使用するか、claude.ai のセッションキー（`CLAUDE_WEB_SESSION_KEY` / `CLAUDE_WEB_COOKIE`）を提供するか、または Claude Code CLI 経由で再認証してください。

## 機能プローブ

プロバイダーの機能ヒント（利用可能な場合は intents/scopes）と、静的な機能サポートを取得します:

```bash
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
```

注記:

- `--channel` は任意です。省略すると、すべてのチャンネル（拡張を含む）が一覧表示されます。
- `--target` は `channel:<id>` または生の数値チャンネル ID を受け取り、Discord にのみ適用されます。
- プローブはプロバイダー固有です: Discord intents + 任意のチャンネル権限、Slack bot + user スコープ、Telegram bot フラグ + webhook、Signal デーモンのバージョン、Microsoft Teams のアプリトークン + Graph のロール/スコープ（判明しているものは注釈付き）。プローブがないチャンネルは `Probe: unavailable` を報告します。

## 名前を ID に解決

プロバイダーのディレクトリを使用して、チャンネル/ユーザー名を ID に解決します:

```bash
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels resolve --channel discord "My Server/#support" "@someone"
openclaw channels resolve --channel matrix "Project Room"
```

注記:

- 対象の種類を強制するには `--kind user|group|auto` を使用します。
- 同じ名前を共有するエントリが複数ある場合、解決ではアクティブな一致が優先されます。
