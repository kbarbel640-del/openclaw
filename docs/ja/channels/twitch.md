---
summary: "Twitch チャットボットの設定とセットアップ"
read_when:
  - OpenClaw 向けに Twitch チャット統合を設定する場合
title: "Twitch"
x-i18n:
  source_path: channels/twitch.md
  source_hash: 0dd1c05bef570470
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:50:33Z
---

# Twitch（プラグイン）

IRC 接続を介した Twitch チャット対応です。OpenClaw は Twitch ユーザー（ボットアカウント）として接続し、チャンネル内のメッセージを受信および送信します。

## 必要なプラグイン

Twitch はプラグインとして提供され、コアのインストールには同梱されていません。

CLI（npm レジストリ）でインストールします。

```bash
openclaw plugins install @openclaw/twitch
```

ローカルチェックアウト（git リポジトリから実行している場合）:

```bash
openclaw plugins install ./extensions/twitch
```

詳細: [Plugins](/plugin)

## クイックセットアップ（初心者向け）

1. ボット用の専用 Twitch アカウントを作成します（または既存アカウントを使用します）。
2. 認証情報を生成します: [Twitch Token Generator](https://twitchtokengenerator.com/)
   - **Bot Token** を選択します
   - スコープとして `chat:read` と `chat:write` が選択されていることを確認します
   - **Client ID** と **Access Token** をコピーします
3. Twitch のユーザー ID を調べます: https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
4. トークンを設定します:
   - 環境変数: `OPENCLAW_TWITCH_ACCESS_TOKEN=...`（デフォルトアカウントのみ）
   - または設定: `channels.twitch.accessToken`
   - 両方が設定されている場合は、設定が優先されます（環境変数のフォールバックはデフォルトアカウントのみ）。
5. Gateway（ゲートウェイ）を起動します。

**⚠️ 重要:** 不正なユーザーがボットをトリガーできないように、アクセス制御（`allowFrom` または `allowedRoles`）を追加してください。`requireMention` はデフォルトで `true` です。

最小構成:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw", // Bot's Twitch account
      accessToken: "oauth:abc123...", // OAuth Access Token (or use OPENCLAW_TWITCH_ACCESS_TOKEN env var)
      clientId: "xyz789...", // Client ID from Token Generator
      channel: "vevisk", // Which Twitch channel's chat to join (required)
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only - get it from https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
    },
  },
}
```

## 概要

- Gateway（ゲートウェイ）が所有する Twitch チャンネルです。
- 決定的ルーティング: 返信は常に Twitch に戻ります。
- 各アカウントは分離されたセッションキー `agent:<agentId>:twitch:<accountName>` にマップされます。
- `username` はボットのアカウント（認証する側）で、`channel` は参加するチャットルームです。

## セットアップ（詳細）

### 認証情報を生成する

[Twitch Token Generator](https://twitchtokengenerator.com/) を使用します。

- **Bot Token** を選択します
- スコープとして `chat:read` と `chat:write` が選択されていることを確認します
- **Client ID** と **Access Token** をコピーします

手動のアプリ登録は不要です。トークンは数時間後に期限切れになります。

### ボットを設定する

**環境変数（デフォルトアカウントのみ）:**

```bash
OPENCLAW_TWITCH_ACCESS_TOKEN=oauth:abc123...
```

**または設定:**

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
    },
  },
}
```

環境変数と設定の両方が設定されている場合は、設定が優先されます。

### アクセス制御（推奨）

```json5
{
  channels: {
    twitch: {
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only
    },
  },
}
```

厳格な許可リストには `allowFrom` を推奨します。ロールベースのアクセスにしたい場合は、代わりに `allowedRoles` を使用します。

**利用可能なロール:** `"moderator"`、`"owner"`、`"vip"`、`"subscriber"`、`"all"`。

**なぜユーザー ID なのですか？** ユーザー名は変更できるため、なりすましが可能になります。ユーザー ID は恒久的です。

Twitch のユーザー ID を調べます: https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/（Twitch のユーザー名を ID に変換）

## トークン更新（任意）

[Twitch Token Generator](https://twitchtokengenerator.com/) のトークンは自動更新できません。期限切れになったら再生成してください。

トークンを自動更新するには、[Twitch Developer Console](https://dev.twitch.tv/console) で独自の Twitch アプリケーションを作成し、設定に追加します。

```json5
{
  channels: {
    twitch: {
      clientSecret: "your_client_secret",
      refreshToken: "your_refresh_token",
    },
  },
}
```

ボットは期限切れ前に自動的にトークンを更新し、更新イベントをログに記録します。

## マルチアカウント対応

アカウントごとのトークンとともに `channels.twitch.accounts` を使用します。共有パターンは [`gateway/configuration`](/gateway/configuration) を参照してください。

例（1 つのボットアカウントを 2 つのチャンネルで使用）:

```json5
{
  channels: {
    twitch: {
      accounts: {
        channel1: {
          username: "openclaw",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk",
        },
        channel2: {
          username: "openclaw",
          accessToken: "oauth:def456...",
          clientId: "uvw012...",
          channel: "secondchannel",
        },
      },
    },
  },
}
```

**注:** 各アカウントにはそれぞれ独自のトークンが必要です（チャンネルごとに 1 トークン）。

## アクセス制御

### ロールベースの制限

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator", "vip"],
        },
      },
    },
  },
}
```

### ユーザー ID による許可リスト（最も安全）

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowFrom: ["123456789", "987654321"],
        },
      },
    },
  },
}
```

### ロールベースのアクセス（代替）

`allowFrom` は厳格な許可リストです。設定すると、それらのユーザー ID のみが許可されます。
ロールベースのアクセスにしたい場合は `allowFrom` を未設定のままにして、代わりに `allowedRoles` を設定してください。

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

### @mention 要件を無効化する

デフォルトでは `requireMention` は `true` です。無効化してすべてのメッセージに応答するには、次のようにします。

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          requireMention: false,
        },
      },
    },
  },
}
```

## トラブルシューティング

まず、診断コマンドを実行します。

```bash
openclaw doctor
openclaw channels status --probe
```

### ボットがメッセージに応答しない

**アクセス制御を確認します:** あなたのユーザー ID が `allowFrom` に含まれていることを確認するか、テストのために一時的に
`allowFrom` を削除し、`allowedRoles: ["all"]` を設定してください。

**ボットがチャンネルに参加していることを確認します:** ボットは `channel` で指定されたチャンネルに参加している必要があります。

### トークンの問題

**「Failed to connect」または認証エラー:**

- `accessToken` が OAuth アクセストークンの値であることを確認します（通常は `oauth:` プレフィックスで始まります）
- トークンに `chat:read` と `chat:write` のスコープがあることを確認します
- トークン更新を使用している場合、`clientSecret` と `refreshToken` が設定されていることを確認します

### トークン更新が動作しない

**更新イベントのログを確認します:**

```
Using env token source for mybot
Access token refreshed for user 123456 (expires in 14400s)
```

「token refresh disabled (no refresh token)」が表示される場合:

- `clientSecret` が指定されていることを確認します
- `refreshToken` が指定されていることを確認します

## 設定

**アカウント設定:**

- `username` - ボットのユーザー名
- `accessToken` - `chat:read` と `chat:write` を含む OAuth アクセストークン
- `clientId` - Twitch の Client ID（Token Generator または自作アプリから）
- `channel` - 参加するチャンネル（必須）
- `enabled` - このアカウントを有効化（デフォルト: `true`）
- `clientSecret` - 任意: 自動トークン更新用
- `refreshToken` - 任意: 自動トークン更新用
- `expiresIn` - トークンの有効期限（秒）
- `obtainmentTimestamp` - トークン取得タイムスタンプ
- `allowFrom` - ユーザー ID 許可リスト
- `allowedRoles` - ロールベースのアクセス制御（`"moderator" | "owner" | "vip" | "subscriber" | "all"`）
- `requireMention` - @mention を必須にする（デフォルト: `true`）

**プロバイダーオプション:**

- `channels.twitch.enabled` - チャンネル起動の有効化/無効化
- `channels.twitch.username` - ボットのユーザー名（簡易な単一アカウント設定）
- `channels.twitch.accessToken` - OAuth アクセストークン（簡易な単一アカウント設定）
- `channels.twitch.clientId` - Twitch の Client ID（簡易な単一アカウント設定）
- `channels.twitch.channel` - 参加するチャンネル（簡易な単一アカウント設定）
- `channels.twitch.accounts.<accountName>` - マルチアカウント設定（上記のすべてのアカウントフィールド）

完全な例:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
      clientSecret: "secret123...",
      refreshToken: "refresh456...",
      allowFrom: ["123456789"],
      allowedRoles: ["moderator", "vip"],
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          enabled: true,
          clientSecret: "secret123...",
          refreshToken: "refresh456...",
          expiresIn: 14400,
          obtainmentTimestamp: 1706092800000,
          allowFrom: ["123456789", "987654321"],
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

## ツールアクション

エージェントは、アクション付きで `twitch` を呼び出せます。

- `send` - チャンネルにメッセージを送信します

例:

```json5
{
  action: "twitch",
  params: {
    message: "Hello Twitch!",
    to: "#mychannel",
  },
}
```

## 安全性と運用

- **トークンはパスワード同様に扱ってください** - トークンを git にコミットしないでください
- 長時間稼働するボットには **自動トークン更新** を使用してください
- アクセス制御には、ユーザー名ではなく **ユーザー ID の許可リスト** を使用してください
- トークン更新イベントおよび接続状態について **ログを監視** してください
- **スコープは最小限にしてください** - `chat:read` と `chat:write` のみを要求します
- **行き詰まった場合**: 他プロセスがセッションを所有していないことを確認したうえで、Gateway（ゲートウェイ）を再起動してください

## 制限

- メッセージあたり **500 文字**（単語境界で自動分割）
- 分割前に Markdown は削除されます
- レート制限なし（Twitch の組み込みレート制限を使用します）
