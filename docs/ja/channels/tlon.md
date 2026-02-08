---
summary: "Tlon/Urbit のサポート状況、機能、および設定"
read_when:
  - Tlon/Urbit チャンネル機能に取り組んでいるとき
title: "Tlon"
x-i18n:
  source_path: channels/tlon.md
  source_hash: 19d7ffe23e82239f
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:48:43Z
---

# Tlon（プラグイン）

Tlon は、Urbit 上に構築された分散型メッセンジャーです。OpenClaw はお使いの Urbit ship に接続し、ダイレクトメッセージおよびグループチャットメッセージに応答できます。グループへの返信はデフォルトで @ メンションが必要で、allowlist によりさらに制限できます。

ステータス: プラグイン経由でサポートされています。ダイレクトメッセージ、グループメンション、スレッド返信、およびテキストのみのメディアフォールバック（URL をキャプションに追記）に対応しています。リアクション、投票、およびネイティブのメディアアップロードはサポートされていません。

## プラグインが必要

Tlon はプラグインとして提供され、コアインストールには同梱されていません。

CLI 経由（npm レジストリ）でインストールします:

```bash
openclaw plugins install @openclaw/tlon
```

ローカルチェックアウト（git リポジトリから実行する場合）:

```bash
openclaw plugins install ./extensions/tlon
```

詳細: [Plugins](/plugin)

## セットアップ

1. Tlon プラグインをインストールします。
2. ship の URL とログインコードを収集します。
3. `channels.tlon` を設定します。
4. Gateway（ゲートウェイ）を再起動します。
5. ボットにダイレクトメッセージを送るか、グループチャンネルでメンションします。

最小構成（単一アカウント）:

```json5
{
  channels: {
    tlon: {
      enabled: true,
      ship: "~sampel-palnet",
      url: "https://your-ship-host",
      code: "lidlut-tabwed-pillex-ridrup",
    },
  },
}
```

## グループチャンネル

自動検出はデフォルトで有効です。チャンネルを手動でピン留めすることもできます:

```json5
{
  channels: {
    tlon: {
      groupChannels: ["chat/~host-ship/general", "chat/~host-ship/support"],
    },
  },
}
```

自動検出を無効化します:

```json5
{
  channels: {
    tlon: {
      autoDiscoverChannels: false,
    },
  },
}
```

## アクセス制御

ダイレクトメッセージ allowlist（空 = すべて許可）:

```json5
{
  channels: {
    tlon: {
      dmAllowlist: ["~zod", "~nec"],
    },
  },
}
```

グループ認可（デフォルトで制限）:

```json5
{
  channels: {
    tlon: {
      defaultAuthorizedShips: ["~zod"],
      authorization: {
        channelRules: {
          "chat/~host-ship/general": {
            mode: "restricted",
            allowedShips: ["~zod", "~nec"],
          },
          "chat/~host-ship/announcements": {
            mode: "open",
          },
        },
      },
    },
  },
}
```

## 配信先ターゲット（CLI/cron）

`openclaw message send` または cron 配信でこれらを使用します:

- ダイレクトメッセージ: `~sampel-palnet` または `dm/~sampel-palnet`
- グループ: `chat/~host-ship/channel` または `group:~host-ship/channel`

## 注記

- グループへの返信にはメンション（例: `~your-bot-ship`）が必要です。
- スレッド返信: 受信メッセージがスレッド内の場合、OpenClaw はスレッド内で返信します。
- メディア: `sendMedia` はテキスト + URL にフォールバックします（ネイティブアップロードなし）。
