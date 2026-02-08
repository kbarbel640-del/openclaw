---
summary: "imsg（stdio 上の JSON-RPC）によるレガシーな iMessage サポートです。新規セットアップでは BlueBubbles を使用してください。"
read_when:
  - iMessage サポートをセットアップする場合
  - iMessage の送受信をデバッグする場合
title: iMessage
x-i18n:
  source_path: channels/imessage.md
  source_hash: 7c8c276701528b8d
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:46:42Z
---

# iMessage（レガシー: imsg）

> **推奨:** 新規の iMessage セットアップには [BlueBubbles](/channels/bluebubbles) を使用してください。
>
> `imsg` チャンネルはレガシーな外部 CLI 統合であり、将来のリリースで削除される可能性があります。

ステータス: レガシーな外部 CLI 統合です。Gateway（ゲートウェイ）は `imsg rpc`（stdio 上の JSON-RPC）を起動します。

## クイックセットアップ（初心者向け）

1. この Mac で Messages にサインインしていることを確認します。
2. `imsg` をインストールします:
   - `brew install steipete/tap/imsg`
3. `channels.imessage.cliPath` と `channels.imessage.dbPath` で OpenClaw を設定します。
4. Gateway（ゲートウェイ）を起動し、macOS のプロンプト（オートメーション + フルディスクアクセス）を承認します。

最小構成:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "/usr/local/bin/imsg",
      dbPath: "/Users/<you>/Library/Messages/chat.db",
    },
  },
}
```

## これは何ですか

- macOS 上の `imsg` によって実装される iMessage チャンネルです。
- 決定的なルーティング: 返信は常に iMessage に戻ります。
- ダイレクトメッセージはエージェントのメイン セッションを共有し、グループは分離されます（`agent:<agentId>:imessage:group:<chat_id>`）。
- 複数参加者のスレッドが `is_group=false` で到着する場合でも、`channels.imessage.groups` を使用して `chat_id` することで分離できます（下記「Group-ish threads」を参照）。

## 設定の書き込み

デフォルトでは、iMessage は `/config set|unset` によってトリガーされる設定更新を書き込むことが許可されています（`commands.config: true` が必要です）。

無効化するには次を使用します:

```json5
{
  channels: { imessage: { configWrites: false } },
}
```

## 要件

- Messages にサインイン済みの macOS。
- OpenClaw + `imsg` に対するフルディスクアクセス（Messages DB へのアクセス）。
- 送信時のオートメーション権限。
- `channels.imessage.cliPath` は、stdin/stdout をプロキシする任意のコマンドを指定できます（例: 別の Mac に SSH して `imsg rpc` を実行するラッパースクリプト）。

## セットアップ（最短経路）

1. この Mac で Messages にサインインしていることを確認します。
2. iMessage を設定して Gateway（ゲートウェイ）を起動します。

### 専用の bot 用 macOS ユーザー（ID を分離する場合）

ボットを **別の iMessage ID** から送信させ（個人の Messages をきれいに保ちたい場合）、専用の Apple ID + 専用の macOS ユーザーを使用してください。

1. 専用の Apple ID を作成します（例: `my-cool-bot@icloud.com`）。
   - Apple は検証 / 2FA のために電話番号を要求する場合があります。
2. macOS ユーザーを作成し（例: `openclawhome`）、そのユーザーにサインインします。
3. その macOS ユーザーで Messages を開き、ボット用 Apple ID で iMessage にサインインします。
4. リモートログインを有効化します（システム設定 → 一般 → 共有 → リモートログイン）。
5. `imsg` をインストールします:
   - `brew install steipete/tap/imsg`
6. `ssh <bot-macos-user>@localhost true` がパスワードなしで動作するように SSH をセットアップします。
7. `channels.imessage.accounts.bot.cliPath` を、ボットユーザーとして `imsg` を実行する SSH ラッパーに向けます。

初回実行時の注意: 送受信には、_bot 用 macOS ユーザー_ での GUI による承認（オートメーション + フルディスクアクセス）が必要になる場合があります。`imsg rpc` が止まっているように見える、または終了する場合は、そのユーザーにログインし（画面共有が便利です）、一度だけ `imsg chats --limit 1` / `imsg send ...` を実行してプロンプトを承認してから、再試行してください。

ラッパー例（`chmod +x`）。`<bot-macos-user>` は実際の macOS ユーザー名に置き換えてください:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run an interactive SSH once first to accept host keys:
#   ssh <bot-macos-user>@localhost true
exec /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=5 -T <bot-macos-user>@localhost \
  "/usr/local/bin/imsg" "$@"
```

設定例:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      accounts: {
        bot: {
          name: "Bot",
          enabled: true,
          cliPath: "/path/to/imsg-bot",
          dbPath: "/Users/<bot-macos-user>/Library/Messages/chat.db",
        },
      },
    },
  },
}
```

単一アカウント構成では、`accounts` マップの代わりにフラットなオプション（`channels.imessage.cliPath`、`channels.imessage.dbPath`）を使用してください。

### リモート / SSH バリアント（任意）

別の Mac で iMessage を動かしたい場合は、`channels.imessage.cliPath` を、リモートの macOS ホスト上で SSH 経由で `imsg` を実行するラッパーに設定します。OpenClaw は stdio のみを必要とします。

ラッパー例:

```bash
#!/usr/bin/env bash
exec ssh -T gateway-host imsg "$@"
```

**リモート添付ファイル:** `cliPath` が SSH 経由でリモートホストを指す場合、Messages データベース内の添付ファイルのパスはリモートマシン上のファイルを参照します。OpenClaw は、`channels.imessage.remoteHost` を設定することで、SCP 経由でこれらを自動取得できます:

```json5
{
  channels: {
    imessage: {
      cliPath: "~/imsg-ssh", // SSH wrapper to remote Mac
      remoteHost: "user@gateway-host", // for SCP file transfer
      includeAttachments: true,
    },
  },
}
```

`remoteHost` が設定されていない場合、OpenClaw はラッパースクリプト内の SSH コマンドを解析して自動検出を試みます。信頼性のため、明示的な設定を推奨します。

#### Tailscale 経由のリモート Mac（例）

Gateway（ゲートウェイ）が Linux ホスト / VM 上で動作しているが、iMessage は Mac 上で動かす必要がある場合、Tailscale が最も簡単なブリッジです。Gateway（ゲートウェイ）は tailnet 経由で Mac と通信し、SSH 経由で `imsg` を実行し、添付ファイルを SCP で戻します。

アーキテクチャ:

```
┌──────────────────────────────┐          SSH (imsg rpc)          ┌──────────────────────────┐
│ Gateway host (Linux/VM)      │──────────────────────────────────▶│ Mac with Messages + imsg │
│ - openclaw gateway           │          SCP (attachments)        │ - Messages signed in     │
│ - channels.imessage.cliPath  │◀──────────────────────────────────│ - Remote Login enabled   │
└──────────────────────────────┘                                   └──────────────────────────┘
              ▲
              │ Tailscale tailnet (hostname or 100.x.y.z)
              ▼
        user@gateway-host
```

具体的な設定例（Tailscale ホスト名）:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "~/.openclaw/scripts/imsg-ssh",
      remoteHost: "bot@mac-mini.tailnet-1234.ts.net",
      includeAttachments: true,
      dbPath: "/Users/bot/Library/Messages/chat.db",
    },
  },
}
```

ラッパー例（`~/.openclaw/scripts/imsg-ssh`）:

```bash
#!/usr/bin/env bash
exec ssh -T bot@mac-mini.tailnet-1234.ts.net imsg "$@"
```

注意:

- Mac が Messages にサインインしており、リモートログインが有効になっていることを確認してください。
- `ssh bot@mac-mini.tailnet-1234.ts.net` がプロンプトなしで動作するように SSH 鍵を使用してください。
- `remoteHost` は SSH のターゲットと一致させ、SCP が添付ファイルを取得できるようにしてください。

複数アカウント対応: `channels.imessage.accounts` をアカウントごとの設定と任意の `name` とともに使用します。共通パターンについては [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) を参照してください。`~/.openclaw/openclaw.json` は（トークンを含むことが多いため）コミットしないでください。

## アクセス制御（ダイレクトメッセージ + グループ）

ダイレクトメッセージ:

- デフォルト: `channels.imessage.dmPolicy = "pairing"`。
- 未知の送信者にはペアリングコードが送信され、承認されるまでメッセージは無視されます（コードは 1 時間で失効します）。
- 承認方法:
  - `openclaw pairing list imessage`
  - `openclaw pairing approve imessage <CODE>`
- ペアリングは iMessage のダイレクトメッセージにおけるデフォルトのトークン交換です。詳細: [Pairing](/start/pairing)

グループ:

- `channels.imessage.groupPolicy = open | allowlist | disabled`。
- `channels.imessage.groupAllowFrom` は、`allowlist` が設定されている場合に、グループ内で誰がトリガーできるかを制御します。
- メンションのゲーティングは、iMessage にネイティブのメンションメタデータがないため、`agents.list[].groupChat.mentionPatterns`（または `messages.groupChat.mentionPatterns`）を使用します。
- マルチエージェントのオーバーライド: エージェントごとのパターンを `agents.list[].groupChat.mentionPatterns` に設定します。

## 仕組み（挙動）

- `imsg` がメッセージイベントをストリームし、Gateway（ゲートウェイ）がそれらを共通のチャンネルエンベロープに正規化します。
- 返信は常に同じ chat id または handle にルーティングされます。

## Group-ish threads（`is_group=false`）

一部の iMessage スレッドは複数参加者を持つことができますが、Messages がチャット識別子を保存する方法によっては、それでも `is_group=false` で到着する場合があります。

`channels.imessage.groups` 配下に `chat_id` を明示的に設定すると、OpenClaw はそのスレッドを以下の目的で「グループ」として扱います:

- セッション分離（別の `agent:<agentId>:imessage:group:<chat_id>` セッションキー）
- グループの許可リスト / メンションゲーティングの挙動

例:

```json5
{
  channels: {
    imessage: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "42": { requireMention: false },
      },
    },
  },
}
```

これは、特定のスレッドに対して分離された人格 / モデルを使いたい場合に有用です（[Multi-agent routing](/concepts/multi-agent) を参照）。ファイルシステムの分離については [Sandboxing](/gateway/sandboxing) を参照してください。

## メディア + 制限

- `channels.imessage.includeAttachments` による任意の添付ファイル取り込み。
- `channels.imessage.mediaMaxMb` によるメディア上限。

## 制限

- 送信テキストは `channels.imessage.textChunkLimit`（デフォルト 4000）に分割されます。
- 任意の改行分割: `channels.imessage.chunkMode="newline"` を設定すると、長さによる分割の前に空行（段落境界）で分割します。
- メディアアップロードは `channels.imessage.mediaMaxMb`（デフォルト 16）で上限が設定されます。

## アドレッシング / 配信ターゲット

安定したルーティングのため、`chat_id` を優先してください:

- `chat_id:123`（推奨）
- `chat_guid:...`
- `chat_identifier:...`
- 直接 handle: `imessage:+1555` / `sms:+1555` / `user@example.com`

チャット一覧:

```
imsg chats --limit 20
```

## 設定リファレンス（iMessage）

全設定: [Configuration](/gateway/configuration)

プロバイダーオプション:

- `channels.imessage.enabled`: チャンネル起動の有効化 / 無効化。
- `channels.imessage.cliPath`: `imsg` へのパス。
- `channels.imessage.dbPath`: Messages DB パス。
- `channels.imessage.remoteHost`: `cliPath` がリモート Mac を指す場合の、SCP 添付ファイル転送用 SSH ホスト（例: `user@gateway-host`）。未設定の場合は SSH ラッパーから自動検出されます。
- `channels.imessage.service`: `imessage | sms | auto`。
- `channels.imessage.region`: SMS リージョン。
- `channels.imessage.dmPolicy`: `pairing | allowlist | open | disabled`（デフォルト: ペアリング）。
- `channels.imessage.allowFrom`: ダイレクトメッセージ許可リスト（handle、メール、E.164 番号、または `chat_id:*`）。`open` には `"*"` が必要です。iMessage にはユーザー名がないため、handle またはチャットターゲットを使用してください。
- `channels.imessage.groupPolicy`: `open | allowlist | disabled`（デフォルト: 許可リスト）。
- `channels.imessage.groupAllowFrom`: グループ送信者許可リスト。
- `channels.imessage.historyLimit` / `channels.imessage.accounts.*.historyLimit`: コンテキストとして含める最大グループメッセージ数（0 で無効）。
- `channels.imessage.dmHistoryLimit`: ユーザーターン数によるダイレクトメッセージ履歴上限。ユーザーごとの上書き: `channels.imessage.dms["<handle>"].historyLimit`。
- `channels.imessage.groups`: グループごとのデフォルト + 許可リスト（グローバル既定値には `"*"` を使用してください）。
- `channels.imessage.includeAttachments`: 添付ファイルをコンテキストに取り込みます。
- `channels.imessage.mediaMaxMb`: 受信 / 送信メディア上限（MB）。
- `channels.imessage.textChunkLimit`: 送信分割サイズ（文字数）。
- `channels.imessage.chunkMode`: `length`（デフォルト）または `newline` を使用して、長さによる分割の前に空行（段落境界）で分割します。

関連するグローバルオプション:

- `agents.list[].groupChat.mentionPatterns`（または `messages.groupChat.mentionPatterns`）。
- `messages.responsePrefix`。
