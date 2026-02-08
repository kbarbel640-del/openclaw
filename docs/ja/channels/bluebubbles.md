---
summary: "BlueBubbles macOS サーバー経由の iMessage（REST 送受信、入力中、リアクション、ペアリング、高度なアクション）。"
read_when:
  - BlueBubbles チャンネルのセットアップ
  - webhook ペアリングのトラブルシューティング
  - macOS で iMessage を設定する
title: "BlueBubbles"
x-i18n:
  source_path: channels/bluebubbles.md
  source_hash: 1414cf657d347ee7
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:43:46Z
---

# BlueBubbles（macOS REST）

ステータス: HTTP 経由で BlueBubbles macOS サーバーと通信する、同梱プラグインです。レガシーの imsg チャンネルと比べて API がより充実しておりセットアップも容易なため、**iMessage 連携に推奨**されます。

## 概要

- BlueBubbles ヘルパーアプリ（[bluebubbles.app](https://bluebubbles.app)）を介して macOS 上で動作します。
- 推奨/検証済み: macOS Sequoia（15）。macOS Tahoe（26）でも動作しますが、Tahoe では現在 edit が壊れており、グループアイコン更新は成功と表示されても同期されない場合があります。
- OpenClaw は REST API（`GET /api/v1/ping`、`POST /message/text`、`POST /chat/:id/*`）経由で通信します。
- 受信メッセージは webhook 経由で到着し、送信返信・入力中インジケーター・開封通知・Tapback は REST 呼び出しです。
- 添付ファイルとステッカーは受信メディアとして取り込まれます（可能な場合はエージェントにも提示されます）。
- ペアリング/許可リストは他のチャンネル（`/start/pairing` など）と同様に、`channels.bluebubbles.allowFrom` + ペアリングコードで動作します。
- リアクションは Slack/Telegram と同様にシステムイベントとして提示され、エージェントは返信前にそれらに「言及」できます。
- 高度な機能: edit、unsend、返信スレッド、メッセージエフェクト、グループ管理。

## クイックスタート

1. Mac に BlueBubbles サーバーをインストールします（[bluebubbles.app/install](https://bluebubbles.app/install) の手順に従ってください）。
2. BlueBubbles 設定で Web API を有効化し、パスワードを設定します。
3. `openclaw onboard` を実行して BlueBubbles を選択するか、手動で設定します:
   ```json5
   {
     channels: {
       bluebubbles: {
         enabled: true,
         serverUrl: "http://192.168.1.100:1234",
         password: "example-password",
         webhookPath: "/bluebubbles-webhook",
       },
     },
   }
   ```
4. BlueBubbles webhook をご自身の Gateway（ゲートウェイ）に向けます（例: `https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`）。
5. Gateway（ゲートウェイ）を起動します。webhook ハンドラーを登録し、ペアリングを開始します。

## Messages.app を生かし続ける（VM / ヘッドレス構成）

一部の macOS VM / 常時稼働構成では、Messages.app が「アイドル」状態になり（受信イベントが、アプリを開く/前面化するまで停止する）、問題が起きる場合があります。簡単な回避策として、AppleScript + LaunchAgent で **5 分ごとに Messages をつつく**方法があります。

### 1) AppleScript を保存する

以下として保存します:

- `~/Scripts/poke-messages.scpt`

スクリプト例（非対話型; フォーカスを奪いません）:

```applescript
try
  tell application "Messages"
    if not running then
      launch
    end if

    -- Touch the scripting interface to keep the process responsive.
    set _chatCount to (count of chats)
  end tell
on error
  -- Ignore transient failures (first-run prompts, locked session, etc).
end try
```

### 2) LaunchAgent をインストールする

以下として保存します:

- `~/Library/LaunchAgents/com.user.poke-messages.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.user.poke-messages</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>/usr/bin/osascript &quot;$HOME/Scripts/poke-messages.scpt&quot;</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>StandardOutPath</key>
    <string>/tmp/poke-messages.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/poke-messages.err</string>
  </dict>
</plist>
```

注意事項:

- これは **300 秒ごと**と**ログイン時**に実行されます。
- 初回実行で macOS の **オートメーション**プロンプト（`osascript` → Messages）が表示される場合があります。LaunchAgent を実行する同一ユーザーセッション内で承認してください。

読み込みます:

```bash
launchctl unload ~/Library/LaunchAgents/com.user.poke-messages.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.user.poke-messages.plist
```

## オンボーディング

BlueBubbles は対話式セットアップウィザードで利用できます:

```
openclaw onboard
```

ウィザードで入力を求められる内容:

- **Server URL**（必須）: BlueBubbles サーバーのアドレス（例: `http://192.168.1.100:1234`）
- **Password**（必須）: BlueBubbles Server 設定の API パスワード
- **Webhook path**（任意）: 既定は `/bluebubbles-webhook`
- **DM policy**: pairing、allowlist、open、disabled
- **Allow list**: 電話番号、メール、またはチャットターゲット

CLI から BlueBubbles を追加することもできます:

```
openclaw channels add bluebubbles --http-url http://192.168.1.100:1234 --password <password>
```

## アクセス制御（ダイレクトメッセージ + グループ）

ダイレクトメッセージ:

- 既定: `channels.bluebubbles.dmPolicy = "pairing"`。
- 不明な送信者にはペアリングコードが送られ、承認されるまでメッセージは無視されます（コードは 1 時間で期限切れです）。
- 承認方法:
  - `openclaw pairing list bluebubbles`
  - `openclaw pairing approve bluebubbles <CODE>`
- ペアリングは既定のトークン交換です。詳細: [Pairing](/start/pairing)

グループ:

- `channels.bluebubbles.groupPolicy = open | allowlist | disabled`（既定: `allowlist`）。
- `channels.bluebubbles.groupAllowFrom` は、`allowlist` が設定されているときに、グループ内で誰がトリガーできるかを制御します。

### メンション・ゲーティング（グループ）

BlueBubbles は、iMessage/WhatsApp の動作に合わせて、グループチャット向けのメンション・ゲーティングをサポートします:

- `agents.list[].groupChat.mentionPatterns`（または `messages.groupChat.mentionPatterns`）を使用してメンションを検出します。
- グループで `requireMention` が有効な場合、エージェントはメンションされたときのみ応答します。
- 認可された送信者からのコントロールコマンドはメンション・ゲーティングをバイパスします。

グループごとの設定:

```json5
{
  channels: {
    bluebubbles: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true }, // default for all groups
        "iMessage;-;chat123": { requireMention: false }, // override for specific group
      },
    },
  },
}
```

### コマンド・ゲーティング

- コントロールコマンド（例: `/config`、`/model`）には認可が必要です。
- `allowFrom` と `groupAllowFrom` を使用して、コマンドの認可を判定します。
- 認可された送信者は、グループ内でメンションがなくてもコントロールコマンドを実行できます。

## 入力中 + 開封通知

- **入力中インジケーター**: 応答生成の前および生成中に自動送信されます。
- **開封通知**: `channels.bluebubbles.sendReadReceipts`（既定: `true`）で制御されます。
- **入力中インジケーター**: OpenClaw は入力開始イベントを送信し、BlueBubbles は送信時またはタイムアウト時に入力中を自動的に解除します（DELETE による手動停止は信頼できません）。

```json5
{
  channels: {
    bluebubbles: {
      sendReadReceipts: false, // disable read receipts
    },
  },
}
```

## 高度なアクション

BlueBubbles は、設定で有効化されている場合に高度なメッセージアクションをサポートします:

```json5
{
  channels: {
    bluebubbles: {
      actions: {
        reactions: true, // tapbacks (default: true)
        edit: true, // edit sent messages (macOS 13+, broken on macOS 26 Tahoe)
        unsend: true, // unsend messages (macOS 13+)
        reply: true, // reply threading by message GUID
        sendWithEffect: true, // message effects (slam, loud, etc.)
        renameGroup: true, // rename group chats
        setGroupIcon: true, // set group chat icon/photo (flaky on macOS 26 Tahoe)
        addParticipant: true, // add participants to groups
        removeParticipant: true, // remove participants from groups
        leaveGroup: true, // leave group chats
        sendAttachment: true, // send attachments/media
      },
    },
  },
}
```

利用可能なアクション:

- **react**: Tapback リアクションの追加/削除（`messageId`、`emoji`、`remove`）
- **edit**: 送信済みメッセージの編集（`messageId`、`text`）
- **unsend**: メッセージの送信取り消し（`messageId`）
- **reply**: 特定メッセージへの返信（`messageId`、`text`、`to`）
- **sendWithEffect**: iMessage エフェクト付きで送信（`text`、`to`、`effectId`）
- **renameGroup**: グループチャット名を変更（`chatGuid`、`displayName`）
- **setGroupIcon**: グループチャットのアイコン/写真を設定（`chatGuid`、`media`）— macOS 26 Tahoe では不安定です（API は成功を返してもアイコンが同期されない場合があります）。
- **addParticipant**: グループに参加者を追加（`chatGuid`、`address`）
- **removeParticipant**: グループから参加者を削除（`chatGuid`、`address`）
- **leaveGroup**: グループチャットから退出（`chatGuid`）
- **sendAttachment**: メディア/ファイルを送信（`to`、`buffer`、`filename`、`asVoice`）
  - ボイスメモ: `asVoice: true` を **MP3** または **CAF** 音声で設定すると、iMessage のボイスメッセージとして送信します。BlueBubbles はボイスメモ送信時に MP3 → CAF へ変換します。

### メッセージ ID（短縮 vs フル）

OpenClaw はトークン節約のために、*短縮*メッセージ ID（例: `1`、`2`）を提示する場合があります。

- `MessageSid` / `ReplyToId` は短縮 ID の場合があります。
- `MessageSidFull` / `ReplyToIdFull` にはプロバイダーのフル ID が含まれます。
- 短縮 ID はメモリ内です。再起動やキャッシュの退避で失効することがあります。
- アクションは短縮またはフルの `messageId` を受け付けますが、短縮 ID が利用できなくなっている場合はエラーになります。

永続的な自動化や保存にはフル ID を使用してください:

- テンプレート: `{{MessageSidFull}}`、`{{ReplyToIdFull}}`
- コンテキスト: 受信ペイロード内の `MessageSidFull` / `ReplyToIdFull`

テンプレート変数については [Configuration](/gateway/configuration) を参照してください。

## ブロックストリーミング

応答を単一メッセージとして送るか、ブロックに分割してストリーミングするかを制御します:

```json5
{
  channels: {
    bluebubbles: {
      blockStreaming: true, // enable block streaming (off by default)
    },
  },
}
```

## メディア + 制限

- 受信添付ファイルはダウンロードされ、メディアキャッシュに保存されます。
- メディア上限は `channels.bluebubbles.mediaMaxMb` で設定します（既定: 8 MB）。
- 送信テキストは `channels.bluebubbles.textChunkLimit` に従って分割されます（既定: 4000 文字）。

## 設定リファレンス

完全な設定: [Configuration](/gateway/configuration)

プロバイダーオプション:

- `channels.bluebubbles.enabled`: チャンネルの有効/無効。
- `channels.bluebubbles.serverUrl`: BlueBubbles REST API のベース URL。
- `channels.bluebubbles.password`: API パスワード。
- `channels.bluebubbles.webhookPath`: webhook エンドポイントパス（既定: `/bluebubbles-webhook`）。
- `channels.bluebubbles.dmPolicy`: `pairing | allowlist | open | disabled`（既定: `pairing`）。
- `channels.bluebubbles.allowFrom`: ダイレクトメッセージ許可リスト（ハンドル、メール、E.164 番号、`chat_id:*`、`chat_guid:*`）。
- `channels.bluebubbles.groupPolicy`: `open | allowlist | disabled`（既定: `allowlist`）。
- `channels.bluebubbles.groupAllowFrom`: グループ送信者許可リスト。
- `channels.bluebubbles.groups`: グループごとの設定（`requireMention` など）。
- `channels.bluebubbles.sendReadReceipts`: 開封通知を送信（既定: `true`）。
- `channels.bluebubbles.blockStreaming`: ブロックストリーミングを有効化（既定: `false`; ストリーミング返信に必須）。
- `channels.bluebubbles.textChunkLimit`: 文字数での送信分割サイズ（既定: 4000）。
- `channels.bluebubbles.chunkMode`: `length`（既定）は `textChunkLimit` を超えた場合にのみ分割します。`newline` は長さによる分割の前に空行（段落境界）で分割します。
- `channels.bluebubbles.mediaMaxMb`: 受信メディア上限（MB）（既定: 8）。
- `channels.bluebubbles.historyLimit`: コンテキスト用のグループメッセージ最大数（0 で無効）。
- `channels.bluebubbles.dmHistoryLimit`: ダイレクトメッセージ履歴上限。
- `channels.bluebubbles.actions`: 特定アクションの有効/無効。
- `channels.bluebubbles.accounts`: マルチアカウント設定。

関連するグローバルオプション:

- `agents.list[].groupChat.mentionPatterns`（または `messages.groupChat.mentionPatterns`）。
- `messages.responsePrefix`。

## アドレス指定 / 配送ターゲット

安定したルーティングには `chat_guid` を優先してください:

- `chat_guid:iMessage;-;+15555550123`（グループに推奨）
- `chat_id:123`
- `chat_identifier:...`
- 直接ハンドル: `+15555550123`、`user@example.com`
  - 直接ハンドルに既存のダイレクトメッセージチャットがない場合、OpenClaw は `POST /api/v1/chat/new` を介して作成します。これには BlueBubbles Private API が有効である必要があります。

## セキュリティ

- webhook リクエストは、`guid`/`password` のクエリパラメータまたはヘッダーを `channels.bluebubbles.password` と比較して認証します。`localhost` からのリクエストも受け付けます。
- API パスワードと webhook エンドポイントは秘匿してください（資格情報として扱います）。
- localhost の信頼により、同一ホスト上のリバースプロキシが意図せずパスワードをバイパスする可能性があります。Gateway（ゲートウェイ）をプロキシする場合は、プロキシ側で認証を必須にし、`gateway.trustedProxies` を設定してください。[Gateway security](/gateway/security#reverse-proxy-configuration) を参照してください。
- LAN 外に公開する場合は、BlueBubbles サーバーで HTTPS + ファイアウォール規則を有効化してください。

## トラブルシューティング

- 入力中/既読イベントが動作しなくなった場合は、BlueBubbles webhook ログを確認し、Gateway（ゲートウェイ）のパスが `channels.bluebubbles.webhookPath` と一致していることを検証してください。
- ペアリングコードは 1 時間で期限切れです。`openclaw pairing list bluebubbles` と `openclaw pairing approve bluebubbles <code>` を使用してください。
- リアクションには BlueBubbles private API（`POST /api/v1/message/react`）が必要です。サーバーバージョンがそれを公開していることを確認してください。
- edit/unsend には macOS 13+ と互換性のある BlueBubbles サーバーバージョンが必要です。macOS 26（Tahoe）では、private API の変更により edit が現在壊れています。
- macOS 26（Tahoe）ではグループアイコン更新が不安定な場合があります。API は成功を返しても新しいアイコンが同期されないことがあります。
- OpenClaw は BlueBubbles サーバーの macOS バージョンに基づいて、既知の不具合があるアクションを自動的に非表示にします。macOS 26（Tahoe）で edit がまだ表示される場合は、`channels.bluebubbles.actions.edit=false` で手動で無効化してください。
- ステータス/ヘルス情報: `openclaw status --all` または `openclaw status --deep`。

一般的なチャンネルのワークフロー参照については、[Channels](/channels) および [Plugins](/plugins) ガイドを参照してください。
