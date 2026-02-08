---
summary: "signal-cli（JSON-RPC + SSE）経由の Signal サポート、セットアップ、および番号モデル"
read_when:
  - Signal サポートのセットアップ
  - Signal の送受信のデバッグ
title: "Signal"
x-i18n:
  source_path: channels/signal.md
  source_hash: ca4de8b3685017f5
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:48:30Z
---

# Signal（signal-cli）

ステータス: 外部 CLI 統合です。Gateway（ゲートウェイ）は HTTP の JSON-RPC + SSE 経由で `signal-cli` と通信します。

## クイックセットアップ（初心者）

1. ボットには **別の Signal 番号** を使用します（推奨）。
2. `signal-cli` をインストールします（Java が必要です）。
3. ボット端末をリンクし、デーモンを起動します:
   - `signal-cli link -n "OpenClaw"`
4. OpenClaw を設定し、ゲートウェイを起動します。

最小構成:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

## これは何ですか

- `signal-cli` 経由の Signal チャンネルです（libsignal の埋め込みではありません）。
- 決定的ルーティング: 返信は常に Signal に戻ります。
- ダイレクトメッセージはエージェントのメインセッションを共有し、グループは分離されます（`agent:<agentId>:signal:group:<groupId>`）。

## 設定の書き込み

デフォルトでは、Signal は `/config set|unset` によってトリガーされる設定更新の書き込みが許可されています（`commands.config: true` が必要です）。

無効化するには:

```json5
{
  channels: { signal: { configWrites: false } },
}
```

## 番号モデル（重要）

- ゲートウェイは **Signal デバイス**（`signal-cli` アカウント）に接続します。
- ボットを **個人の Signal アカウント** で実行すると、自分自身のメッセージは無視されます（ループ保護）。
- 「自分がボットに送信すると返信が返ってくる」を実現するには、**別のボット番号** を使用します。

## セットアップ（最短手順）

1. `signal-cli` をインストールします（Java が必要です）。
2. ボットアカウントをリンクします:
   - `signal-cli link -n "OpenClaw"` を実行し、Signal で QR をスキャンします。
3. Signal を設定し、ゲートウェイを起動します。

例:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

マルチアカウント対応: アカウントごとの設定と任意の `name` で `channels.signal.accounts` を使用します。共有パターンについては、[`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) を参照してください。

## 外部デーモンモード（httpUrl）

`signal-cli` を自分で管理したい場合（JVM のコールドスタートが遅い、コンテナ初期化、または CPU 共有など）は、デーモンを別プロセスで実行し、OpenClaw からそれを参照するようにします:

```json5
{
  channels: {
    signal: {
      httpUrl: "http://127.0.0.1:8080",
      autoStart: false,
    },
  },
}
```

これにより、OpenClaw 内での自動起動と起動待機がスキップされます。自動起動時の起動が遅い場合は、`channels.signal.startupTimeoutMs` を設定します。

## アクセス制御（ダイレクトメッセージ + グループ）

ダイレクトメッセージ:

- デフォルト: `channels.signal.dmPolicy = "pairing"`。
- 不明な送信者にはペアリングコードが返され、承認されるまでメッセージは無視されます（コードは 1 時間後に失効します）。
- 承認方法:
  - `openclaw pairing list signal`
  - `openclaw pairing approve signal <CODE>`
- ペアリングは Signal のダイレクトメッセージ向けのデフォルトのトークン交換です。詳細: [Pairing](/start/pairing)
- UUID のみの送信者（`sourceUuid` 由来）は、`channels.signal.allowFrom` 内で `uuid:<id>` として保存されます。

グループ:

- `channels.signal.groupPolicy = open | allowlist | disabled`。
- `allowlist` が設定されている場合、`channels.signal.groupAllowFrom` がグループでトリガーできる人を制御します。

## 仕組み（挙動）

- `signal-cli` はデーモンとして動作し、ゲートウェイは SSE 経由でイベントを読み取ります。
- 受信メッセージは共有チャンネルエンベロープに正規化されます。
- 返信は常に同じ番号またはグループへルーティングされます。

## メディア + 制限

- 送信テキストは `channels.signal.textChunkLimit` までチャンク化されます（デフォルト 4000）。
- 任意の改行チャンク化: `channels.signal.chunkMode="newline"` を設定すると、長さによるチャンク化の前に空行（段落境界）で分割します。
- 添付ファイルに対応しています（`signal-cli` から取得した base64）。
- デフォルトのメディア上限: `channels.signal.mediaMaxMb`（デフォルト 8）。
- `channels.signal.ignoreAttachments` を使用してメディアのダウンロードをスキップします。
- グループ履歴コンテキストは `channels.signal.historyLimit`（または `channels.signal.accounts.*.historyLimit`）を使用し、失敗時は `messages.groupChat.historyLimit` にフォールバックします。無効化するには `0` を設定します（デフォルト 50）。

## 入力中 + 既読通知

- **入力中インジケーター**: OpenClaw は `signal-cli sendTyping` 経由で入力中シグナルを送信し、返信処理中はそれを更新します。
- **既読通知**: `channels.signal.sendReadReceipts` が true の場合、OpenClaw は許可されたダイレクトメッセージの既読通知を転送します。
- signal-cli はグループの既読通知を公開していません。

## リアクション（メッセージツール）

- `channel=signal` とともに `message action=react` を使用します。
- 対象: 送信者の E.164 または UUID（ペアリング出力の `uuid:<id>` を使用します。裸の UUID でも動作します）。
- `messageId` は、リアクション対象メッセージの Signal タイムスタンプです。
- グループのリアクションには `targetAuthor` または `targetAuthorUuid` が必要です。

例:

```
message action=react channel=signal target=uuid:123e4567-e89b-12d3-a456-426614174000 messageId=1737630212345 emoji=🔥
message action=react channel=signal target=+15551234567 messageId=1737630212345 emoji=🔥 remove=true
message action=react channel=signal target=signal:group:<groupId> targetAuthor=uuid:<sender-uuid> messageId=1737630212345 emoji=✅
```

設定:

- `channels.signal.actions.reactions`: リアクションアクションの有効/無効（デフォルト true）。
- `channels.signal.reactionLevel`: `off | ack | minimal | extensive`。
  - `off`/`ack` はエージェントのリアクションを無効化します（メッセージツール `react` はエラーになります）。
  - `minimal`/`extensive` はエージェントのリアクションを有効化し、ガイダンスレベルを設定します。
- アカウントごとの上書き: `channels.signal.accounts.<id>.actions.reactions`、`channels.signal.accounts.<id>.reactionLevel`。

## 配信先（CLI/cron）

- ダイレクトメッセージ: `signal:+15551234567`（またはプレーンな E.164）。
- UUID のダイレクトメッセージ: `uuid:<id>`（または裸の UUID）。
- グループ: `signal:group:<groupId>`。
- ユーザー名: `username:<name>`（使用中の Signal アカウントが対応している場合）。

## 設定リファレンス（Signal）

完全な設定: [Configuration](/gateway/configuration)

プロバイダーオプション:

- `channels.signal.enabled`: チャンネル起動の有効/無効。
- `channels.signal.account`: ボットアカウントの E.164。
- `channels.signal.cliPath`: `signal-cli` へのパス。
- `channels.signal.httpUrl`: デーモンの完全な URL（host/port を上書きします）。
- `channels.signal.httpHost`、`channels.signal.httpPort`: デーモンのバインド（デフォルト 127.0.0.1:8080）。
- `channels.signal.autoStart`: デーモンの自動起動（`httpUrl` が未設定の場合はデフォルト true）。
- `channels.signal.startupTimeoutMs`: 起動待機タイムアウト（ms、上限 120000）。
- `channels.signal.receiveMode`: `on-start | manual`。
- `channels.signal.ignoreAttachments`: 添付ファイルのダウンロードをスキップします。
- `channels.signal.ignoreStories`: デーモンからのストーリーズを無視します。
- `channels.signal.sendReadReceipts`: 既読通知を転送します。
- `channels.signal.dmPolicy`: `pairing | allowlist | open | disabled`（デフォルト: ペアリング）。
- `channels.signal.allowFrom`: ダイレクトメッセージ許可リスト（E.164 または `uuid:<id>`）。`open` には `"*"` が必要です。Signal にはユーザー名がないため、電話番号/UUID の ID を使用します。
- `channels.signal.groupPolicy`: `open | allowlist | disabled`（デフォルト: allowlist）。
- `channels.signal.groupAllowFrom`: グループ送信者許可リスト。
- `channels.signal.historyLimit`: コンテキストに含めるグループメッセージの最大数（0 で無効）。
- `channels.signal.dmHistoryLimit`: ユーザーターンにおけるダイレクトメッセージ履歴の上限。ユーザーごとの上書き: `channels.signal.dms["<phone_or_uuid>"].historyLimit`。
- `channels.signal.textChunkLimit`: 送信チャンクサイズ（文字数）。
- `channels.signal.chunkMode`: 長さによるチャンク化の前に空行（段落境界）で分割する場合は、`length`（デフォルト）または `newline`。
- `channels.signal.mediaMaxMb`: 受信/送信メディア上限（MB）。

関連するグローバルオプション:

- `agents.list[].groupChat.mentionPatterns`（Signal はネイティブのメンションに対応していません）。
- `messages.groupChat.mentionPatterns`（グローバルフォールバック）。
- `messages.responsePrefix`。
