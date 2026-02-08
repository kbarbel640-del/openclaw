---
summary: "Matrix サポートのステータス、機能、設定"
read_when:
  - Matrix チャンネル機能に取り組んでいるとき
title: "Matrix"
x-i18n:
  source_path: channels/matrix.md
  source_hash: 923ff717cf14d01c
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:47:13Z
---

# Matrix（プラグイン）

Matrix は、オープンで分散型のメッセージングプロトコルです。OpenClaw は任意のホームサーバー上で Matrix の **ユーザー** として接続するため、ボット用の Matrix アカウントが必要です。ログイン後は、ボットに直接ダイレクトメッセージを送るか、ルーム（Matrix の「グループ」）に招待できます。Beeper も有効なクライアント選択肢ですが、E2EE を有効にする必要があります。

ステータス: プラグイン（@vector-im/matrix-bot-sdk）経由でサポートされています。ダイレクトメッセージ、ルーム、スレッド、メディア、リアクション、投票（送信 + poll-start をテキストとして）、位置情報、E2EE（暗号サポートあり）。

## プラグインが必要

Matrix はプラグインとして提供されており、コアのインストールには同梱されていません。

CLI 経由でインストール（npm レジストリ）:

```bash
openclaw plugins install @openclaw/matrix
```

ローカルチェックアウト（git リポジトリから実行している場合）:

```bash
openclaw plugins install ./extensions/matrix
```

configure/onboarding 中に Matrix を選択し、git のチェックアウトが検出されると、OpenClaw はローカルのインストールパスを自動的に提示します。

詳細: [Plugins](/plugin)

## セットアップ

1. Matrix プラグインをインストールします:
   - npm から: `openclaw plugins install @openclaw/matrix`
   - ローカルチェックアウトから: `openclaw plugins install ./extensions/matrix`
2. ホームサーバー上に Matrix アカウントを作成します:
   - ホスティングの選択肢は [https://matrix.org/ecosystem/hosting/](https://matrix.org/ecosystem/hosting/) を参照してください
   - または自分でホストします。
3. ボットアカウントのアクセストークンを取得します:
   - 自分のホームサーバーで `curl` を使って Matrix ログイン API を使用します:

   ```bash
   curl --request POST \
     --url https://matrix.example.org/_matrix/client/v3/login \
     --header 'Content-Type: application/json' \
     --data '{
     "type": "m.login.password",
     "identifier": {
       "type": "m.id.user",
       "user": "your-user-name"
     },
     "password": "your-password"
   }'
   ```

   - `matrix.example.org` を自分のホームサーバー URL に置き換えます。
   - または `channels.matrix.userId` + `channels.matrix.password` を設定します。OpenClaw は同じログインエンドポイントを呼び出し、アクセストークンを `~/.openclaw/credentials/matrix/credentials.json` に保存し、次回起動時に再利用します。

4. 認証情報を設定します:
   - 環境変数: `MATRIX_HOMESERVER`、`MATRIX_ACCESS_TOKEN`（または `MATRIX_USER_ID` + `MATRIX_PASSWORD`）
   - または設定: `channels.matrix.*`
   - 両方が設定されている場合、設定が優先されます。
   - アクセストークン使用時は、ユーザー ID は `/whoami` を介して自動的に取得されます。
   - 設定する場合、`channels.matrix.userId` は完全な Matrix ID（例: `@bot:example.org`）である必要があります。
5. Gateway（ゲートウェイ）を再起動します（またはオンボーディングを完了します）。
6. どの Matrix クライアントからでも（Element、Beeper など。https://matrix.org/ecosystem/clients/ を参照）、ボットとのダイレクトメッセージを開始するか、ルームに招待します。Beeper は E2EE を要求するため、`channels.matrix.encryption: true` を設定し、デバイスを検証してください。

最小構成（アクセストークン、ユーザー ID は自動取得）:

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      dm: { policy: "pairing" },
    },
  },
}
```

E2EE 構成（エンドツーエンド暗号化を有効化）:

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      encryption: true,
      dm: { policy: "pairing" },
    },
  },
}
```

## 暗号化（E2EE）

エンドツーエンド暗号化は、Rust crypto SDK 経由で **サポート** されています。

`channels.matrix.encryption: true` で有効化します:

- crypto モジュールがロードされる場合、暗号化されたルームは自動的に復号されます。
- 暗号化されたルームへ送信する際、送信メディアは暗号化されます。
- 初回接続時、OpenClaw は他のセッションにデバイス検証をリクエストします。
- 別の Matrix クライアント（Element など）でデバイスを検証し、キー共有を有効にします。
- crypto モジュールをロードできない場合、E2EE は無効化され、暗号化されたルームは復号されません。OpenClaw は警告をログに出力します。
- crypto モジュールの欠落エラー（例: `@matrix-org/matrix-sdk-crypto-nodejs-*`）が表示される場合は、`@matrix-org/matrix-sdk-crypto-nodejs` のビルドスクリプトを許可し、`pnpm rebuild @matrix-org/matrix-sdk-crypto-nodejs` を実行するか、`node node_modules/@matrix-org/matrix-sdk-crypto-nodejs/download-lib.js` でバイナリを取得してください。

暗号状態は、アカウント + アクセストークンごとに
`~/.openclaw/matrix/accounts/<account>/<homeserver>__<user>/<token-hash>/crypto/`
（SQLite データベース）へ保存されます。同期状態は、その隣の `bot-storage.json` に保存されます。
アクセストークン（デバイス）が変わると新しいストアが作成され、暗号化されたルームに対してボットを再検証する必要があります。

**デバイス検証:**
E2EE が有効な場合、ボットは起動時に他のセッションへ検証をリクエストします。
Element（または別のクライアント）を開き、検証リクエストを承認して信頼を確立してください。
検証が完了すると、ボットは暗号化されたルーム内のメッセージを復号できます。

## ルーティングモデル

- 返信は常に Matrix に戻ります。
- ダイレクトメッセージはエージェントのメインセッションを共有し、ルームはグループセッションにマップされます。

## アクセス制御（ダイレクトメッセージ）

- デフォルト: `channels.matrix.dm.policy = "pairing"`。未知の送信者にはペアリングコードが付与されます。
- 次で承認します:
  - `openclaw pairing list matrix`
  - `openclaw pairing approve matrix <CODE>`
- 公開ダイレクトメッセージ: `channels.matrix.dm.policy="open"` に加えて `channels.matrix.dm.allowFrom=["*"]`。
- `channels.matrix.dm.allowFrom` は完全な Matrix ユーザー ID（例: `@user:server`）を受け付けます。ウィザードは、ディレクトリ検索で単一の完全一致が見つかった場合に表示名をユーザー ID に解決します。

## ルーム（グループ）

- デフォルト: `channels.matrix.groupPolicy = "allowlist"`（メンションによるゲート）。未設定時のデフォルトを上書きするには `channels.defaults.groupPolicy` を使用します。
- `channels.matrix.groups`（ルーム ID またはエイリアス。ディレクトリ検索で単一の完全一致が見つかった場合、名前は ID に解決されます）でルームを許可リスト化します:

```json5
{
  channels: {
    matrix: {
      groupPolicy: "allowlist",
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
      groupAllowFrom: ["@owner:example.org"],
    },
  },
}
```

- `requireMention: false` は、そのルームで自動返信を有効にします。
- `groups."*"` は、ルーム全体にわたるメンションゲートの既定値を設定できます。
- `groupAllowFrom` は、ルーム内でボットをトリガーできる送信者（完全な Matrix ユーザー ID）を制限します。
- ルームごとの `users` 許可リストにより、特定のルーム内の送信者をさらに制限できます（完全な Matrix ユーザー ID を使用）。
- configure ウィザードはルーム許可リスト（ルーム ID、エイリアス、または名前）を促し、完全一致かつ一意に一致する場合にのみ名前を解決します。
- 起動時に OpenClaw は許可リスト内のルーム/ユーザー名を ID に解決し、その対応関係をログに記録します。解決できないエントリは許可リスト照合で無視されます。
- 招待はデフォルトで自動参加します。`channels.matrix.autoJoin` と `channels.matrix.autoJoinAllowlist` で制御します。
- **ルームを一切許可しない** 場合は、`channels.matrix.groupPolicy: "disabled"` を設定します（または空の許可リストを維持します）。
- レガシーキー: `channels.matrix.rooms`（`groups` と同じ形）。

## スレッド

- 返信スレッド化がサポートされています。
- `channels.matrix.threadReplies` は、返信をスレッド内に留めるかどうかを制御します:
  - `off`、`inbound`（デフォルト）、`always`
- `channels.matrix.replyToMode` は、スレッドで返信しない場合の reply-to メタデータを制御します:
  - `off`（デフォルト）、`first`、`all`

## 機能

| 機能                 | ステータス                                                                             |
| -------------------- | -------------------------------------------------------------------------------------- |
| ダイレクトメッセージ | ✅ サポート済み                                                                        |
| ルーム               | ✅ サポート済み                                                                        |
| スレッド             | ✅ サポート済み                                                                        |
| メディア             | ✅ サポート済み                                                                        |
| E2EE                 | ✅ サポート済み（crypto モジュールが必要）                                             |
| リアクション         | ✅ サポート済み（ツール経由で送信/読み取り）                                           |
| 投票                 | ✅ 送信はサポート。受信した投票開始はテキストに変換されます（回答/終了は無視されます） |
| 位置情報             | ✅ サポート済み（geo URI。高度は無視されます）                                         |
| ネイティブコマンド   | ✅ サポート済み                                                                        |

## 設定リファレンス（Matrix）

全設定: [Configuration](/gateway/configuration)

プロバイダーオプション:

- `channels.matrix.enabled`: チャンネル起動の有効化/無効化。
- `channels.matrix.homeserver`: ホームサーバー URL。
- `channels.matrix.userId`: Matrix ユーザー ID（アクセストークンがある場合は任意）。
- `channels.matrix.accessToken`: アクセストークン。
- `channels.matrix.password`: ログイン用パスワード（トークンを保存）。
- `channels.matrix.deviceName`: デバイス表示名。
- `channels.matrix.encryption`: E2EE を有効化（デフォルト: false）。
- `channels.matrix.initialSyncLimit`: 初回同期の上限。
- `channels.matrix.threadReplies`: `off | inbound | always`（デフォルト: inbound）。
- `channels.matrix.textChunkLimit`: 送信テキストのチャンクサイズ（文字数）。
- `channels.matrix.chunkMode`: `length`（デフォルト）または `newline` により、長さでのチャンク化の前に空行（段落境界）で分割します。
- `channels.matrix.dm.policy`: `pairing | allowlist | open | disabled`（デフォルト: pairing）。
- `channels.matrix.dm.allowFrom`: ダイレクトメッセージ許可リスト（完全な Matrix ユーザー ID）。`open` は `"*"` を必要とします。ウィザードは可能な場合に名前を ID へ解決します。
- `channels.matrix.groupPolicy`: `allowlist | open | disabled`（デフォルト: allowlist）。
- `channels.matrix.groupAllowFrom`: グループメッセージ用の許可リスト送信者（完全な Matrix ユーザー ID）。
- `channels.matrix.allowlistOnly`: ダイレクトメッセージ + ルームに対して許可リストルールを強制します。
- `channels.matrix.groups`: グループ許可リスト + ルームごとの設定マップ。
- `channels.matrix.rooms`: レガシーのグループ許可リスト/設定。
- `channels.matrix.replyToMode`: スレッド/タグの reply-to モード。
- `channels.matrix.mediaMaxMb`: 受信/送信メディア上限（MB）。
- `channels.matrix.autoJoin`: 招待の取り扱い（`always | allowlist | off`、デフォルト: always）。
- `channels.matrix.autoJoinAllowlist`: 自動参加が許可されたルーム ID/エイリアス。
- `channels.matrix.actions`: アクションごとのツールゲート（reactions/messages/pins/memberInfo/channelInfo）。
