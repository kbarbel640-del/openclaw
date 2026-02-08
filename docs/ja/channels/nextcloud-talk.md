---
summary: "Nextcloud Talk のサポート状況、機能、設定"
read_when:
  - Nextcloud Talk チャンネル機能に取り組んでいる場合
title: "Nextcloud Talk"
x-i18n:
  source_path: channels/nextcloud-talk.md
  source_hash: 4062946ebf333903
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:46:43Z
---

# Nextcloud Talk（プラグイン）

ステータス: プラグイン（webhook ボット）経由でサポートされています。ダイレクトメッセージ、ルーム、リアクション、Markdown メッセージがサポートされています。

## プラグインが必要です

Nextcloud Talk はプラグインとして提供されており、コアインストールには同梱されていません。

CLI（npm レジストリ）でインストールします:

```bash
openclaw plugins install @openclaw/nextcloud-talk
```

ローカルチェックアウト（git リポジトリから実行する場合）:

```bash
openclaw plugins install ./extensions/nextcloud-talk
```

設定/オンボーディング中に Nextcloud Talk を選択し、git チェックアウトが検出されると、
OpenClaw はローカルインストールパスを自動的に提示します。

詳細: [Plugins](/plugin)

## クイックセットアップ（初心者）

1. Nextcloud Talk プラグインをインストールします。
2. Nextcloud サーバーでボットを作成します:
   ```bash
   ./occ talk:bot:install "OpenClaw" "<shared-secret>" "<webhook-url>" --feature reaction
   ```
3. 対象ルームの設定でボットを有効化します。
4. OpenClaw を設定します:
   - Config: `channels.nextcloud-talk.baseUrl` + `channels.nextcloud-talk.botSecret`
   - または env: `NEXTCLOUD_TALK_BOT_SECRET`（デフォルトアカウントのみ）
5. Gateway（ゲートウェイ）を再起動します（またはオンボーディングを完了します）。

最小構成:

```json5
{
  channels: {
    "nextcloud-talk": {
      enabled: true,
      baseUrl: "https://cloud.example.com",
      botSecret: "shared-secret",
      dmPolicy: "pairing",
    },
  },
}
```

## 注意事項

- ボットはダイレクトメッセージを開始できません。ユーザーが先にボットへメッセージを送る必要があります。
- webhook URL は Gateway（ゲートウェイ）から到達可能である必要があります。プロキシ配下の場合は `webhookPublicUrl` を設定してください。
- メディアアップロードはボット API でサポートされていません。メディアは URL として送信されます。
- webhook ペイロードはダイレクトメッセージとルームを区別しません。ルーム種別のルックアップを有効化するには `apiUser` + `apiPassword` を設定してください（そうしない場合、ダイレクトメッセージはルームとして扱われます）。

## アクセス制御（ダイレクトメッセージ）

- デフォルト: `channels.nextcloud-talk.dmPolicy = "pairing"`。未知の送信者にはペアリングコードが付与されます。
- 承認方法:
  - `openclaw pairing list nextcloud-talk`
  - `openclaw pairing approve nextcloud-talk <CODE>`
- 公開ダイレクトメッセージ: `channels.nextcloud-talk.dmPolicy="open"` に加えて `channels.nextcloud-talk.allowFrom=["*"]`。
- `allowFrom` は Nextcloud のユーザー ID のみに一致します。表示名は無視されます。

## ルーム（グループ）

- デフォルト: `channels.nextcloud-talk.groupPolicy = "allowlist"`（メンションでゲート）。
- `channels.nextcloud-talk.rooms` でルームを許可リストに登録します:

```json5
{
  channels: {
    "nextcloud-talk": {
      rooms: {
        "room-token": { requireMention: true },
      },
    },
  },
}
```

- どのルームも許可しない場合、許可リストを空のままにするか、`channels.nextcloud-talk.groupPolicy="disabled"` を設定してください。

## 機能

| 機能                 | ステータス |
| -------------------- | ---------- |
| ダイレクトメッセージ | サポート   |
| ルーム               | サポート   |
| スレッド             | 非サポート |
| メディア             | URL のみ   |
| リアクション         | サポート   |
| ネイティブコマンド   | 非サポート |

## 設定リファレンス（Nextcloud Talk）

完全な設定: [Configuration](/gateway/configuration)

プロバイダーオプション:

- `channels.nextcloud-talk.enabled`: チャンネル起動の有効/無効。
- `channels.nextcloud-talk.baseUrl`: Nextcloud インスタンス URL。
- `channels.nextcloud-talk.botSecret`: ボット共有シークレット。
- `channels.nextcloud-talk.botSecretFile`: シークレットファイルパス。
- `channels.nextcloud-talk.apiUser`: ルームルックアップ用 API ユーザー（ダイレクトメッセージ検出）。
- `channels.nextcloud-talk.apiPassword`: ルームルックアップ用 API/アプリパスワード。
- `channels.nextcloud-talk.apiPasswordFile`: API パスワードファイルパス。
- `channels.nextcloud-talk.webhookPort`: webhook リスナーポート（デフォルト: 8788）。
- `channels.nextcloud-talk.webhookHost`: webhook ホスト（デフォルト: 0.0.0.0）。
- `channels.nextcloud-talk.webhookPath`: webhook パス（デフォルト: /nextcloud-talk-webhook）。
- `channels.nextcloud-talk.webhookPublicUrl`: 外部から到達可能な webhook URL。
- `channels.nextcloud-talk.dmPolicy`: `pairing | allowlist | open | disabled`。
- `channels.nextcloud-talk.allowFrom`: ダイレクトメッセージ許可リスト（ユーザー ID）。`open` には `"*"` が必要です。
- `channels.nextcloud-talk.groupPolicy`: `allowlist | open | disabled`。
- `channels.nextcloud-talk.groupAllowFrom`: グループ許可リスト（ユーザー ID）。
- `channels.nextcloud-talk.rooms`: ルームごとの設定と許可リスト。
- `channels.nextcloud-talk.historyLimit`: グループ履歴上限（0 で無効）。
- `channels.nextcloud-talk.dmHistoryLimit`: ダイレクトメッセージ履歴上限（0 で無効）。
- `channels.nextcloud-talk.dms`: ダイレクトメッセージごとの上書き（historyLimit）。
- `channels.nextcloud-talk.textChunkLimit`: 送信テキストのチャンクサイズ（文字数）。
- `channels.nextcloud-talk.chunkMode`: 長さでのチャンク分割の前に、空行（段落境界）で分割するために `length`（デフォルト）または `newline`。
- `channels.nextcloud-talk.blockStreaming`: このチャンネルのブロックストリーミングを無効化します。
- `channels.nextcloud-talk.blockStreamingCoalesce`: ブロックストリーミングのコアレス調整。
- `channels.nextcloud-talk.mediaMaxMb`: 受信メディア上限（MB）。
