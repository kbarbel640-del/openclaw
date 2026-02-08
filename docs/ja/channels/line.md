---
summary: "LINE Messaging API プラグインのセットアップ、設定、使用方法"
read_when:
  - OpenClaw を LINE に接続したい場合
  - LINE の webhook と認証情報のセットアップが必要な場合
  - LINE 固有のメッセージオプションを使用したい場合
title: LINE
x-i18n:
  source_path: channels/line.md
  source_hash: 8fbac126786f95b9
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:45:11Z
---

# LINE（プラグイン）

LINE は、LINE Messaging API を介して OpenClaw に接続します。このプラグインは Gateway（ゲートウェイ）上で webhook 受信者として動作し、認証にはチャネルアクセストークンとチャネルシークレットを使用します。

ステータス: プラグイン経由でサポートされています。ダイレクトメッセージ、グループチャット、メディア、位置情報、Flex メッセージ、テンプレートメッセージ、クイックリプライがサポートされています。リアクションとスレッドはサポートされていません。

## プラグインが必要です

LINE プラグインをインストールします:

```bash
openclaw plugins install @openclaw/line
```

ローカルチェックアウト（git リポジトリから実行する場合）:

```bash
openclaw plugins install ./extensions/line
```

## セットアップ

1. LINE Developers アカウントを作成し、Console を開きます:
   https://developers.line.biz/console/
2. プロバイダーを作成（または選択）し、**Messaging API** チャネルを追加します。
3. チャネル設定から **Channel access token** と **Channel secret** をコピーします。
4. Messaging API 設定で **Use webhook** を有効にします。
5. webhook URL を Gateway（ゲートウェイ）のエンドポイントに設定します（HTTPS 必須）:

```
https://gateway-host/line/webhook
```

Gateway（ゲートウェイ）は LINE の webhook 検証（GET）と受信イベント（POST）に応答します。カスタムパスが必要な場合は、`channels.line.webhookPath` または
`channels.line.accounts.<id>.webhookPath` を設定し、URL もそれに合わせて更新してください。

## 設定

最小設定:

```json5
{
  channels: {
    line: {
      enabled: true,
      channelAccessToken: "LINE_CHANNEL_ACCESS_TOKEN",
      channelSecret: "LINE_CHANNEL_SECRET",
      dmPolicy: "pairing",
    },
  },
}
```

環境変数（デフォルトアカウントのみ）:

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

トークン/シークレットファイル:

```json5
{
  channels: {
    line: {
      tokenFile: "/path/to/line-token.txt",
      secretFile: "/path/to/line-secret.txt",
    },
  },
}
```

複数アカウント:

```json5
{
  channels: {
    line: {
      accounts: {
        marketing: {
          channelAccessToken: "...",
          channelSecret: "...",
          webhookPath: "/line/marketing",
        },
      },
    },
  },
}
```

## アクセス制御

ダイレクトメッセージはデフォルトでペアリングになります。未知の送信者にはペアリングコードが送られ、承認されるまでそのメッセージは無視されます。

```bash
openclaw pairing list line
openclaw pairing approve line <CODE>
```

許可リストとポリシー:

- `channels.line.dmPolicy`: `pairing | allowlist | open | disabled`
- `channels.line.allowFrom`: ダイレクトメッセージ用に許可リスト登録された LINE ユーザー ID
- `channels.line.groupPolicy`: `allowlist | open | disabled`
- `channels.line.groupAllowFrom`: グループ用に許可リスト登録された LINE ユーザー ID
- グループごとの上書き: `channels.line.groups.<groupId>.allowFrom`

LINE ID は大文字・小文字を区別します。有効な ID は次のような形式です:

- ユーザー: `U` + 32 個の 16 進文字
- グループ: `C` + 32 個の 16 進文字
- ルーム: `R` + 32 個の 16 進文字

## メッセージの挙動

- テキストは 5000 文字で分割されます。
- Markdown 書式は除去されます。可能な場合、コードブロックとテーブルは Flex カードに変換されます。
- ストリーミング応答はバッファリングされます。エージェントが処理している間、LINE はローディングアニメーション付きで完全なチャンクを受け取ります。
- メディアのダウンロードは `channels.line.mediaMaxMb`（デフォルト 10）で上限が設定されます。

## チャンネルデータ（リッチメッセージ）

クイックリプライ、位置情報、Flex カード、またはテンプレートメッセージを送信するには `channelData.line` を使用します。

```json5
{
  text: "Here you go",
  channelData: {
    line: {
      quickReplies: ["Status", "Help"],
      location: {
        title: "Office",
        address: "123 Main St",
        latitude: 35.681236,
        longitude: 139.767125,
      },
      flexMessage: {
        altText: "Status card",
        contents: {
          /* Flex payload */
        },
      },
      templateMessage: {
        type: "confirm",
        text: "Proceed?",
        confirmLabel: "Yes",
        confirmData: "yes",
        cancelLabel: "No",
        cancelData: "no",
      },
    },
  },
}
```

LINE プラグインには、Flex メッセージのプリセット用の `/card` コマンドも同梱されています:

```
/card info "Welcome" "Thanks for joining!"
```

## トラブルシューティング

- **Webhook 検証に失敗する:** webhook URL が HTTPS であること、ならびに `channelSecret` が LINE コンソールと一致することを確認してください。
- **受信イベントがない:** webhook パスが `channels.line.webhookPath` と一致していること、そして Gateway（ゲートウェイ）が LINE から到達可能であることを確認してください。
- **メディアのダウンロードエラー:** メディアがデフォルトの上限を超える場合は `channels.line.mediaMaxMb` を増やしてください。
