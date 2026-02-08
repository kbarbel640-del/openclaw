---
summary: "CLI リファレンス：`openclaw directory`（self、peers、groups）"
read_when:
  - チャンネル用に連絡先/グループ/自分の id を調べたい場合
  - チャンネルディレクトリアダプターを開発している場合
title: "directory"
x-i18n:
  source_path: cli/directory.md
  source_hash: 7c878d9013aeaa22
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:28Z
---

# `openclaw directory`

対応しているチャンネル向けのディレクトリ検索（連絡先/ピア、グループ、および「自分」）。

## 共通フラグ

- `--channel <name>`: チャンネル id/エイリアス（複数のチャンネルが設定されている場合は必須。1 つだけ設定されている場合は自動）
- `--account <id>`: アカウント id（デフォルト：チャンネルのデフォルト）
- `--json`: JSON を出力

## 注意事項

- `directory` は、他のコマンドに貼り付けられる ID を見つけるのに役立つことを意図しています（特に `openclaw message send --target ...`）。
- 多くのチャンネルでは、結果はライブのプロバイダーディレクトリではなく、設定（許可リスト/設定済みグループ）に基づいています。
- デフォルトの出力は、タブで区切られた `id`（場合によっては `name` も）です。スクリプト用途では `--json` を使用してください。

## `message send` で結果を使用する

```bash
openclaw directory peers list --channel slack --query "U0"
openclaw message send --channel slack --target user:U012ABCDEF --message "hello"
```

## ID 形式（チャンネル別）

- WhatsApp: `+15551234567`（ダイレクトメッセージ）、`1234567890-1234567890@g.us`（グループ）
- Telegram: `@username` または数値のチャット id。グループは数値 id
- Slack: `user:U…` と `channel:C…`
- Discord: `user:<id>` と `channel:<id>`
- Matrix（プラグイン）: `user:@user:server`、`room:!roomId:server`、または `#alias:server`
- Microsoft Teams（プラグイン）: `user:<id>` と `conversation:<id>`
- Zalo（プラグイン）: user id（Bot API）
- Zalo Personal / `zalouser`（プラグイン）: `zca` の thread id（ダイレクトメッセージ/グループ）（`me`、`friend list`、`group list`）

## Self（「自分」）

```bash
openclaw directory self --channel zalouser
```

## Peers（連絡先/ユーザー）

```bash
openclaw directory peers list --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory peers list --channel zalouser --limit 50
```

## Groups

```bash
openclaw directory groups list --channel zalouser
openclaw directory groups list --channel zalouser --query "work"
openclaw directory groups members --channel zalouser --group-id <id>
```
