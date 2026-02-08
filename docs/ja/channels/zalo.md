---
summary: "Zalo ボットサポート状況、機能、および設定"
read_when:
  - Zalo 機能または Webhook に取り組んでいる場合
title: "Zalo"
x-i18n:
  source_path: channels/zalo.md
  source_hash: 0311d932349f9641
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:50:29Z
---

# Zalo（Bot API）

ステータス: 実験的です。ダイレクトメッセージのみ対応しており、Zalo のドキュメントによればグループは近日対応予定です。

## プラグインが必要です

Zalo はプラグインとして提供され、コアのインストールには同梱されていません。

- CLI 経由でインストール: `openclaw plugins install @openclaw/zalo`
- またはオンボーディング中に **Zalo** を選択し、インストールプロンプトを確認します
- 詳細: [Plugins](/plugin)

## クイックセットアップ（初心者）

1. Zalo プラグインをインストールします:
   - ソースのチェックアウトから: `openclaw plugins install ./extensions/zalo`
   - npm から（公開されている場合）: `openclaw plugins install @openclaw/zalo`
   - またはオンボーディングで **Zalo** を選択し、インストールプロンプトを確認します
2. トークンを設定します:
   - 環境変数: `ZALO_BOT_TOKEN=...`
   - または設定: `channels.zalo.botToken: "..."`。
3. Gateway（ゲートウェイ）を再起動します（またはオンボーディングを完了します）。
4. ダイレクトメッセージのアクセスはデフォルトでペアリングです。初回連絡時にペアリングコードを承認してください。

最小構成:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

## 概要

Zalo はベトナム向けのメッセージングアプリです。その Bot API により、Gateway（ゲートウェイ）は 1:1 会話向けのボットを実行できます。
Zalo へ確実にルーティングを戻したいサポートや通知用途に適しています。

- Gateway（ゲートウェイ）が所有する Zalo Bot API チャンネルです。
- 決定的なルーティング: 返信は Zalo に戻り、モデルがチャンネルを選ぶことはありません。
- ダイレクトメッセージはエージェントのメインセッションを共有します。
- グループはまだサポートされていません（Zalo のドキュメントでは「近日対応」と記載されています）。

## セットアップ（最短手順）

### 1) ボットトークンを作成する（Zalo Bot Platform）

1. **https://bot.zaloplatforms.com** にアクセスしてサインインします。
2. 新しいボットを作成し、設定を構成します。
3. ボットトークンをコピーします（形式: `12345689:abc-xyz`）。

### 2) トークンを設定する（環境変数または設定）

例:

```json5
{
  channels: {
    zalo: {
      enabled: true,
      botToken: "12345689:abc-xyz",
      dmPolicy: "pairing",
    },
  },
}
```

環境変数オプション: `ZALO_BOT_TOKEN=...`（デフォルトアカウントにのみ有効です）。

複数アカウント対応: アカウントごとのトークンと、任意の `name` を指定して `channels.zalo.accounts` を使用します。

3. Gateway（ゲートウェイ）を再起動します。トークン（環境変数または設定）が解決されると Zalo が起動します。
4. ダイレクトメッセージのアクセスはデフォルトでペアリングです。ボットに最初に連絡した際にコードを承認してください。

## 仕組み（挙動）

- 受信メッセージは、メディアのプレースホルダー付きで共有チャンネルエンベロープに正規化されます。
- 返信は常に同じ Zalo チャットにルーティングされます。
- デフォルトはロングポーリングです。Webhook モードは `channels.zalo.webhookUrl` で利用できます。

## 制限

- 送信テキストは 2000 文字に分割されます（Zalo API の制限）。
- メディアのダウンロード/アップロードは `channels.zalo.mediaMaxMb`（デフォルト 5）で上限が設定されます。
- 2000 文字制限によりストリーミングの有用性が低いため、ストリーミングはデフォルトでブロックされます。

## アクセス制御（ダイレクトメッセージ）

### ダイレクトメッセージのアクセス

- デフォルト: `channels.zalo.dmPolicy = "pairing"`。不明な送信者にはペアリングコードが送られ、承認されるまでメッセージは無視されます（コードは 1 時間で期限切れになります）。
- 承認方法:
  - `openclaw pairing list zalo`
  - `openclaw pairing approve zalo <CODE>`
- ペアリングはデフォルトのトークン交換方式です。詳細: [Pairing](/start/pairing)
- `channels.zalo.allowFrom` は数値のユーザー ID を受け付けます（ユーザー名のルックアップは利用できません）。

## ロングポーリング vs Webhook

- デフォルト: ロングポーリング（公開 URL は不要です）。
- Webhook モード: `channels.zalo.webhookUrl` と `channels.zalo.webhookSecret` を設定します。
  - Webhook シークレットは 8〜256 文字である必要があります。
  - Webhook URL は HTTPS を使用する必要があります。
  - Zalo は検証のために `X-Bot-Api-Secret-Token` ヘッダー付きでイベントを送信します。
  - Gateway（ゲートウェイ）の HTTP は `channels.zalo.webhookPath` で Webhook リクエストを処理します（デフォルトは Webhook URL のパスです）。

**注:** Zalo API ドキュメントによれば、getUpdates（ポーリング）と Webhook は相互排他的です。

## サポートされるメッセージ種別

- **テキストメッセージ**: 2000 文字分割付きで完全対応です。
- **画像メッセージ**: 受信画像をダウンロードして処理し、`sendPhoto` で画像を送信します。
- **スタンプ**: ログには記録されますが、完全には処理されません（エージェント応答なし）。
- **未対応の種別**: ログに記録されます（例: 保護されたユーザーからのメッセージ）。

## 機能

| 機能                 | ステータス                                   |
| -------------------- | -------------------------------------------- |
| ダイレクトメッセージ | ✅ サポートされています                      |
| グループ             | ❌ 近日対応予定（Zalo のドキュメントによる） |
| メディア（画像）     | ✅ サポートされています                      |
| リアクション         | ❌ サポートされていません                    |
| スレッド             | ❌ サポートされていません                    |
| 投票                 | ❌ サポートされていません                    |
| ネイティブコマンド   | ❌ サポートされていません                    |
| ストリーミング       | ⚠️ ブロック（2000 文字制限）                 |

## 配信ターゲット（CLI/cron）

- ターゲットとしてチャット ID を使用します。
- 例: `openclaw message send --channel zalo --target 123456789 --message "hi"`。

## トラブルシューティング

**ボットが応答しない場合:**

- トークンが有効であることを確認します: `openclaw channels status --probe`
- 送信者が承認済みであることを確認します（ペアリングまたは allowFrom）
- Gateway（ゲートウェイ）のログを確認します: `openclaw logs --follow`

**Webhook がイベントを受信しない場合:**

- Webhook URL が HTTPS を使用していることを確認します
- シークレットトークンが 8〜256 文字であることを確認します
- 設定したパスで Gateway（ゲートウェイ）の HTTP エンドポイントに到達できることを確認します
- getUpdates のポーリングが動作していないことを確認します（相互排他的です）

## 設定リファレンス（Zalo）

完全な設定: [Configuration](/gateway/configuration)

プロバイダーオプション:

- `channels.zalo.enabled`: チャンネル起動を有効/無効にします。
- `channels.zalo.botToken`: Zalo Bot Platform のボットトークンです。
- `channels.zalo.tokenFile`: ファイルパスからトークンを読み取ります。
- `channels.zalo.dmPolicy`: `pairing | allowlist | open | disabled`（デフォルト: ペアリング）。
- `channels.zalo.allowFrom`: ダイレクトメッセージの許可リスト（ユーザー ID）。`open` には `"*"` が必要です。ウィザードは数値 ID を尋ねます。
- `channels.zalo.mediaMaxMb`: 受信/送信メディア上限（MB、デフォルト 5）。
- `channels.zalo.webhookUrl`: Webhook モードを有効化します（HTTPS 必須）。
- `channels.zalo.webhookSecret`: Webhook シークレット（8〜256 文字）。
- `channels.zalo.webhookPath`: Gateway（ゲートウェイ）の HTTP サーバー上の Webhook パスです。
- `channels.zalo.proxy`: API リクエストのプロキシ URL です。

複数アカウントオプション:

- `channels.zalo.accounts.<id>.botToken`: アカウントごとのトークンです。
- `channels.zalo.accounts.<id>.tokenFile`: アカウントごとのトークンファイルです。
- `channels.zalo.accounts.<id>.name`: 表示名です。
- `channels.zalo.accounts.<id>.enabled`: アカウントを有効/無効にします。
- `channels.zalo.accounts.<id>.dmPolicy`: アカウントごとのダイレクトメッセージポリシーです。
- `channels.zalo.accounts.<id>.allowFrom`: アカウントごとの許可リストです。
- `channels.zalo.accounts.<id>.webhookUrl`: アカウントごとの Webhook URL です。
- `channels.zalo.accounts.<id>.webhookSecret`: アカウントごとの Webhook シークレットです。
- `channels.zalo.accounts.<id>.webhookPath`: アカウントごとの Webhook パスです。
- `channels.zalo.accounts.<id>.proxy`: アカウントごとのプロキシ URL です。
