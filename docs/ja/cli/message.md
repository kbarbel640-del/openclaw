---
summary: "`openclaw message`（送信 + チャンネル操作）の CLI リファレンス"
read_when:
  - メッセージの CLI アクションを追加または変更するとき
  - 送信先チャンネルの挙動を変更するとき
title: "message"
x-i18n:
  source_path: cli/message.md
  source_hash: 35159baf1ef71362
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:01:07Z
---

# `openclaw message`

メッセージ送信およびチャンネル操作のための、単一の送信コマンドです
（Discord/Google Chat/Slack/Mattermost（プラグイン）/Telegram/WhatsApp/Signal/iMessage/MS Teams）。

## 使用方法

```
openclaw message <subcommand> [flags]
```

チャンネル選択:

- 複数のチャンネルが設定されている場合は、`--channel` が必須です。
- ちょうど 1 つのチャンネルが設定されている場合は、それがデフォルトになります。
- 値: `whatsapp|telegram|discord|googlechat|slack|mattermost|signal|imessage|msteams`（Mattermost はプラグインが必要です）

ターゲット形式（`--target`）:

- WhatsApp: E.164 またはグループ JID
- Telegram: chat id または `@username`
- Discord: `channel:<id>` または `user:<id>`（または `<@id>` メンション。生の数値 id はチャンネルとして扱われます）
- Google Chat: `spaces/<spaceId>` または `users/<userId>`
- Slack: `channel:<id>` または `user:<id>`（生のチャンネル id を受け付けます）
- Mattermost（プラグイン）: `channel:<id>`、`user:<id>`、または `@username`（裸の id はチャンネルとして扱われます）
- Signal: `+E.164`、`group:<id>`、`signal:+E.164`、`signal:group:<id>`、または `username:<name>`/`u:<name>`
- iMessage: handle、`chat_id:<id>`、`chat_guid:<guid>`、または `chat_identifier:<id>`
- MS Teams: conversation id（`19:...@thread.tacv2`）または `conversation:<id>` または `user:<aad-object-id>`

名前のルックアップ:

- サポートされているプロバイダー（Discord/Slack など）では、`Help` や `#help` のようなチャンネル名は、ディレクトリキャッシュ経由で解決されます。
- キャッシュミス時は、プロバイダーがサポートしている場合に OpenClaw がライブのディレクトリルックアップを試行します。

## 共通フラグ

- `--channel <name>`
- `--account <id>`
- `--target <dest>`（send/poll/read などの対象チャンネルまたはユーザー）
- `--targets <name>`（繰り返し。ブロードキャストのみ）
- `--json`
- `--dry-run`
- `--verbose`

## アクション

### コア

- `send`
  - チャンネル: WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost（プラグイン）/Signal/iMessage/MS Teams
  - 必須: `--target`、および `--message` または `--media`
  - 任意: `--media`、`--reply-to`、`--thread-id`、`--gif-playback`
  - Telegram のみ: `--buttons`（許可するには `channels.telegram.capabilities.inlineButtons` が必要です）
  - Telegram のみ: `--thread-id`（フォーラムトピック id）
  - Slack のみ: `--thread-id`（スレッド timestamp。`--reply-to` も同じフィールドを使用します）
  - WhatsApp のみ: `--gif-playback`

- `poll`
  - チャンネル: WhatsApp/Discord/MS Teams
  - 必須: `--target`、`--poll-question`、`--poll-option`（繰り返し）
  - 任意: `--poll-multi`
  - Discord のみ: `--poll-duration-hours`、`--message`

- `react`
  - チャンネル: Discord/Google Chat/Slack/Telegram/WhatsApp/Signal
  - 必須: `--message-id`、`--target`
  - 任意: `--emoji`、`--remove`、`--participant`、`--from-me`、`--target-author`、`--target-author-uuid`
  - 注: `--remove` には `--emoji` が必要です（`--emoji` を省略すると、対応している場合に自分のリアクションをクリアします。/tools/reactions を参照してください）
  - WhatsApp のみ: `--participant`、`--from-me`
  - Signal グループのリアクション: `--target-author` または `--target-author-uuid` が必須です

- `reactions`
  - チャンネル: Discord/Google Chat/Slack
  - 必須: `--message-id`、`--target`
  - 任意: `--limit`

- `read`
  - チャンネル: Discord/Slack
  - 必須: `--target`
  - 任意: `--limit`、`--before`、`--after`
  - Discord のみ: `--around`

- `edit`
  - チャンネル: Discord/Slack
  - 必須: `--message-id`、`--message`、`--target`

- `delete`
  - チャンネル: Discord/Slack/Telegram
  - 必須: `--message-id`、`--target`

- `pin` / `unpin`
  - チャンネル: Discord/Slack
  - 必須: `--message-id`、`--target`

- `pins`（list）
  - チャンネル: Discord/Slack
  - 必須: `--target`

- `permissions`
  - チャンネル: Discord
  - 必須: `--target`

- `search`
  - チャンネル: Discord
  - 必須: `--guild-id`、`--query`
  - 任意: `--channel-id`、`--channel-ids`（繰り返し）、`--author-id`、`--author-ids`（繰り返し）、`--limit`

### スレッド

- `thread create`
  - チャンネル: Discord
  - 必須: `--thread-name`、`--target`（チャンネル id）
  - 任意: `--message-id`、`--auto-archive-min`

- `thread list`
  - チャンネル: Discord
  - 必須: `--guild-id`
  - 任意: `--channel-id`、`--include-archived`、`--before`、`--limit`

- `thread reply`
  - チャンネル: Discord
  - 必須: `--target`（スレッド id）、`--message`
  - 任意: `--media`、`--reply-to`

### 絵文字

- `emoji list`
  - Discord: `--guild-id`
  - Slack: 追加フラグはありません

- `emoji upload`
  - チャンネル: Discord
  - 必須: `--guild-id`、`--emoji-name`、`--media`
  - 任意: `--role-ids`（繰り返し）

### ステッカー

- `sticker send`
  - チャンネル: Discord
  - 必須: `--target`、`--sticker-id`（繰り返し）
  - 任意: `--message`

- `sticker upload`
  - チャンネル: Discord
  - 必須: `--guild-id`、`--sticker-name`、`--sticker-desc`、`--sticker-tags`、`--media`

### ロール / チャンネル / メンバー / ボイス

- `role info`（Discord）: `--guild-id`
- `role add` / `role remove`（Discord）: `--guild-id`、`--user-id`、`--role-id`
- `channel info`（Discord）: `--target`
- `channel list`（Discord）: `--guild-id`
- `member info`（Discord/Slack）: `--user-id`（+ Discord の場合は `--guild-id`）
- `voice status`（Discord）: `--guild-id`、`--user-id`

### イベント

- `event list`（Discord）: `--guild-id`
- `event create`（Discord）: `--guild-id`、`--event-name`、`--start-time`
  - 任意: `--end-time`、`--desc`、`--channel-id`、`--location`、`--event-type`

### モデレーション（Discord）

- `timeout`: `--guild-id`、`--user-id`（任意で `--duration-min` または `--until`。どちらも省略するとタイムアウトをクリアします）
- `kick`: `--guild-id`、`--user-id`（+ `--reason`）
- `ban`: `--guild-id`、`--user-id`（+ `--delete-days`、`--reason`）
  - `timeout` は `--reason` もサポートします

### ブロードキャスト

- `broadcast`
  - チャンネル: 設定済みの任意のチャンネル。すべてのプロバイダーを対象にするには `--channel all` を使用します
  - 必須: `--targets`（繰り返し）
  - 任意: `--message`、`--media`、`--dry-run`

## 例

Discord の返信を送信:

```
openclaw message send --channel discord \
  --target channel:123 --message "hi" --reply-to 456
```

Discord の投票を作成:

```
openclaw message poll --channel discord \
  --target channel:123 \
  --poll-question "Snack?" \
  --poll-option Pizza --poll-option Sushi \
  --poll-multi --poll-duration-hours 48
```

Teams のプロアクティブメッセージを送信:

```
openclaw message send --channel msteams \
  --target conversation:19:abc@thread.tacv2 --message "hi"
```

Teams の投票を作成:

```
openclaw message poll --channel msteams \
  --target conversation:19:abc@thread.tacv2 \
  --poll-question "Lunch?" \
  --poll-option Pizza --poll-option Sushi
```

Slack でリアクション:

```
openclaw message react --channel slack \
  --target C123 --message-id 456 --emoji "✅"
```

Signal グループでリアクション:

```
openclaw message react --channel signal \
  --target signal:group:abc123 --message-id 1737630212345 \
  --emoji "✅" --target-author-uuid 123e4567-e89b-12d3-a456-426614174000
```

Telegram のインラインボタンを送信:

```
openclaw message send --channel telegram --target @mychat --message "Choose:" \
  --buttons '[ [{"text":"Yes","callback_data":"cmd:yes"}], [{"text":"No","callback_data":"cmd:no"}] ]'
```
