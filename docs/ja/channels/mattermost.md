---
summary: "Mattermost ボットのセットアップと OpenClaw 設定"
read_when:
  - Mattermost のセットアップ
  - Mattermost ルーティングのデバッグ
title: "Mattermost"
x-i18n:
  source_path: channels/mattermost.md
  source_hash: 57fabe5eb0efbcb8
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:46:18Z
---

# Mattermost（プラグイン）

ステータス: プラグイン経由でサポートされています（ボットトークン + WebSocket イベント）。チャンネル、グループ、ダイレクトメッセージがサポートされています。
Mattermost はセルフホスト可能なチームメッセージングプラットフォームです。製品の詳細とダウンロードについては、公式サイト
[mattermost.com](https://mattermost.com) を参照してください。

## プラグインが必要です

Mattermost はプラグインとして提供され、コアインストールには同梱されていません。

CLI 経由でインストールします（npm レジストリ）:

```bash
openclaw plugins install @openclaw/mattermost
```

ローカルチェックアウト（git リポジトリから実行している場合）:

```bash
openclaw plugins install ./extensions/mattermost
```

設定/オンボーディング中に Mattermost を選択し、かつ git チェックアウトが検出された場合、
OpenClaw はローカルインストールパスを自動的に提示します。

詳細: [Plugins](/plugin)

## クイックセットアップ

1. Mattermost プラグインをインストールします。
2. Mattermost のボットアカウントを作成し、**ボットトークン**をコピーします。
3. Mattermost の**ベース URL**をコピーします（例: `https://chat.example.com`）。
4. OpenClaw を設定して Gateway（ゲートウェイ）を起動します。

最小構成:

```json5
{
  channels: {
    mattermost: {
      enabled: true,
      botToken: "mm-token",
      baseUrl: "https://chat.example.com",
      dmPolicy: "pairing",
    },
  },
}
```

## 環境変数（デフォルトアカウント）

環境変数を使用したい場合は、Gateway（ゲートウェイ）ホストで以下を設定してください:

- `MATTERMOST_BOT_TOKEN=...`
- `MATTERMOST_URL=https://chat.example.com`

環境変数は **default** アカウント（`default`）にのみ適用されます。その他のアカウントは設定値を使用する必要があります。

## チャットモード

Mattermost はダイレクトメッセージに自動的に応答します。チャンネルの挙動は `chatmode` で制御されます:

- `oncall`（デフォルト）: チャンネルでは @メンションされた場合にのみ応答します。
- `onmessage`: すべてのチャンネルメッセージに応答します。
- `onchar`: メッセージがトリガープレフィックスで始まる場合に応答します。

設定例:

```json5
{
  channels: {
    mattermost: {
      chatmode: "onchar",
      oncharPrefixes: [">", "!"],
    },
  },
}
```

注記:

- `onchar` は明示的な @メンションには引き続き応答します。
- `channels.mattermost.requireMention` はレガシー設定では考慮されますが、`chatmode` を推奨します。

## アクセス制御（ダイレクトメッセージ）

- デフォルト: `channels.mattermost.dmPolicy = "pairing"`（不明な送信者にはペアリングコードが付与されます）。
- 承認方法:
  - `openclaw pairing list mattermost`
  - `openclaw pairing approve mattermost <CODE>`
- 公開ダイレクトメッセージ: `channels.mattermost.dmPolicy="open"` に加えて `channels.mattermost.allowFrom=["*"]`。

## チャンネル（グループ）

- デフォルト: `channels.mattermost.groupPolicy = "allowlist"`（メンション必須）。
- `channels.mattermost.groupAllowFrom`（ユーザー ID または `@username`）で送信者を許可リスト化します。
- オープンチャンネル: `channels.mattermost.groupPolicy="open"`（メンション必須）。

## アウトバウンド配信の宛先

`openclaw message send` または cron/webhooks では、以下の宛先フォーマットを使用します:

- チャンネルには `channel:<id>`
- ダイレクトメッセージには `user:<id>`
- ダイレクトメッセージには `@username`（Mattermost API 経由で解決）

素の ID はチャンネルとして扱われます。

## マルチアカウント

Mattermost は `channels.mattermost.accounts` 配下で複数アカウントをサポートします:

```json5
{
  channels: {
    mattermost: {
      accounts: {
        default: { name: "Primary", botToken: "mm-token", baseUrl: "https://chat.example.com" },
        alerts: { name: "Alerts", botToken: "mm-token-2", baseUrl: "https://alerts.example.com" },
      },
    },
  },
}
```

## トラブルシューティング

- チャンネルで返信がない: ボットがチャンネルに参加していることを確認し、メンション（oncall）する、トリガープレフィックス（onchar）を使用する、または `chatmode: "onmessage"` を設定してください。
- 認証エラー: ボットトークン、ベース URL、アカウントが有効かどうかを確認してください。
- マルチアカウントの問題: 環境変数は `default` アカウントにのみ適用されます。
