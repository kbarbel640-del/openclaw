---
summary: "Feishu ボットの概要、機能、設定"
read_when:
  - Feishu/Lark ボットを接続したい場合
  - Feishu チャンネルを設定している場合
title: Feishu
x-i18n:
  source_path: channels/feishu.md
  source_hash: fd2c93ebb6dbeabf
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:43:23Z
---

# Feishu ボット

Feishu（Lark）は、企業がメッセージングやコラボレーションに利用するチームチャットプラットフォームです。このプラグインは、プラットフォームの WebSocket イベントサブスクリプションを使用して OpenClaw を Feishu/Lark ボットに接続するため、公開 webhook URL を公開することなくメッセージを受信できます。

---

## 必要なプラグイン

Feishu プラグインをインストールします。

```bash
openclaw plugins install @openclaw/feishu
```

ローカルチェックアウト（git リポジトリから実行する場合）:

```bash
openclaw plugins install ./extensions/feishu
```

---

## クイックスタート

Feishu チャンネルを追加する方法は 2 つあります。

### 方法 1: オンボーディングウィザード（推奨）

OpenClaw をインストールしたばかりの場合は、ウィザードを実行します。

```bash
openclaw onboard
```

ウィザードでは、次の内容を案内します。

1. Feishu アプリを作成し、認証情報を収集する
2. OpenClaw でアプリ認証情報を設定する
3. ゲートウェイを起動する

✅ **設定後**、Gateway（ゲートウェイ）のステータスを確認します。

- `openclaw gateway status`
- `openclaw logs --follow`

### 方法 2: CLI セットアップ

初期インストールをすでに完了している場合は、CLI でチャンネルを追加します。

```bash
openclaw channels add
```

**Feishu** を選択し、App ID と App Secret を入力します。

✅ **設定後**、Gateway（ゲートウェイ）を管理します。

- `openclaw gateway status`
- `openclaw gateway restart`
- `openclaw logs --follow`

---

## ステップ 1: Feishu アプリを作成する

### 1. Feishu Open Platform を開く

[Feishu Open Platform](https://open.feishu.cn/app) にアクセスしてサインインします。

Lark（グローバル）テナントは https://open.larksuite.com/app を使用し、Feishu 設定で `domain: "lark"` を設定してください。

### 2. アプリを作成する

1. **Create enterprise app** をクリックします。
2. アプリ名 + 説明を入力します。
3. アプリアイコンを選択します。

![Create enterprise app](../images/feishu-step2-create-app.png)

### 3. 認証情報をコピーする

**Credentials & Basic Info** から、次をコピーします。

- **App ID**（形式: `cli_xxx`）
- **App Secret**

❗ **重要:** App Secret は非公開にしてください。

![Get credentials](../images/feishu-step3-credentials.png)

### 4. 権限を設定する

**Permissions** で **Batch import** をクリックし、次を貼り付けます。

```json
{
  "scopes": {
    "tenant": [
      "aily:file:read",
      "aily:file:write",
      "application:application.app_message_stats.overview:readonly",
      "application:application:self_manage",
      "application:bot.menu:write",
      "contact:user.employee_id:readonly",
      "corehr:file:download",
      "event:ip_list",
      "im:chat.access_event.bot_p2p_chat:read",
      "im:chat.members:bot_access",
      "im:message",
      "im:message.group_at_msg:readonly",
      "im:message.p2p_msg:readonly",
      "im:message:readonly",
      "im:message:send_as_bot",
      "im:resource"
    ],
    "user": ["aily:file:read", "aily:file:write", "im:chat.access_event.bot_p2p_chat:read"]
  }
}
```

![Configure permissions](../images/feishu-step4-permissions.png)

### 5. ボット機能を有効化する

**App Capability** > **Bot** で以下を行います。

1. ボット機能を有効化します。
2. ボット名を設定します。

![Enable bot capability](../images/feishu-step5-bot-capability.png)

### 6. イベントサブスクリプションを設定する

⚠️ **重要:** イベントサブスクリプションを設定する前に、次を確認してください。

1. Feishu 向けにすでに `openclaw channels add` を実行している
2. Gateway（ゲートウェイ）が実行中である（`openclaw gateway status`）

**Event Subscription** で以下を行います。

1. **Use long connection to receive events**（WebSocket）を選択します。
2. 次のイベントを追加します: `im.message.receive_v1`

⚠️ Gateway（ゲートウェイ）が稼働していない場合、ロングコネクションのセットアップが保存に失敗する可能性があります。

![Configure event subscription](../images/feishu-step6-event-subscription.png)

### 7. アプリを公開する

1. **Version Management & Release** でバージョンを作成します。
2. 審査に提出して公開します。
3. 管理者承認を待ちます（企業アプリは通常自動承認されます）。

---

## ステップ 2: OpenClaw を設定する

### ウィザードで設定する（推奨）

```bash
openclaw channels add
```

**Feishu** を選択し、App ID + App Secret を貼り付けます。

### 設定ファイルで設定する

`~/.openclaw/openclaw.json` を編集します。

```json5
{
  channels: {
    feishu: {
      enabled: true,
      dmPolicy: "pairing",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          botName: "My AI assistant",
        },
      },
    },
  },
}
```

### 環境変数で設定する

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
```

### Lark（グローバル）ドメイン

テナントが Lark（国際版）の場合、ドメインを `lark`（または完全なドメイン文字列）に設定します。`channels.feishu.domain` で設定するか、アカウントごと（`channels.feishu.accounts.<id>.domain`）に設定できます。

```json5
{
  channels: {
    feishu: {
      domain: "lark",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
        },
      },
    },
  },
}
```

---

## ステップ 3: 起動 + テスト

### 1. Gateway（ゲートウェイ）を起動する

```bash
openclaw gateway
```

### 2. テストメッセージを送信する

Feishu でボットを見つけてメッセージを送信します。

### 3. ペアリングを承認する

デフォルトでは、ボットはペアリングコードで返信します。承認してください。

```bash
openclaw pairing approve feishu <CODE>
```

承認後は、通常どおりチャットできます。

---

## 概要

- **Feishu ボットチャンネル**: Gateway（ゲートウェイ）で管理される Feishu ボット
- **決定論的ルーティング**: 返信は常に Feishu に戻ります
- **セッション分離**: ダイレクトメッセージはメインセッションを共有し、グループは分離されます
- **WebSocket 接続**: Feishu SDK 経由のロングコネクションで、公開 URL は不要です

---

## アクセス制御

### ダイレクトメッセージ

- **デフォルト**: `dmPolicy: "pairing"`（不明なユーザーはペアリングコードを受け取ります）
- **ペアリングを承認**:
  ```bash
  openclaw pairing list feishu
  openclaw pairing approve feishu <CODE>
  ```
- **許可リストモード**: 許可する Open ID を `channels.feishu.allowFrom` に設定します

### グループチャット

**1. グループポリシー**（`channels.feishu.groupPolicy`）:

- `"open"` = グループ内の全員を許可（デフォルト）
- `"allowlist"` = `groupAllowFrom` のみ許可
- `"disabled"` = グループメッセージを無効化

**2. メンション必須**（`channels.feishu.groups.<chat_id>.requireMention`）:

- `true` = @mention を必須（デフォルト）
- `false` = メンションなしで応答

---

## グループ設定例

### すべてのグループを許可し、@mention を必須（デフォルト）

```json5
{
  channels: {
    feishu: {
      groupPolicy: "open",
      // Default requireMention: true
    },
  },
}
```

### すべてのグループを許可し、@mention を不要

```json5
{
  channels: {
    feishu: {
      groups: {
        oc_xxx: { requireMention: false },
      },
    },
  },
}
```

### グループ内では特定ユーザーのみ許可

```json5
{
  channels: {
    feishu: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["ou_xxx", "ou_yyy"],
    },
  },
}
```

---

## グループ / ユーザー ID を取得する

### グループ ID（chat_id）

グループ ID は `oc_xxx` のようになります。

**方法 1（推奨）**

1. Gateway（ゲートウェイ）を起動し、グループでボットを @mention します
2. `openclaw logs --follow` を実行し、`chat_id` を探します

**方法 2**

Feishu API デバッガーを使用してグループチャットを一覧表示します。

### ユーザー ID（open_id）

ユーザー ID は `ou_xxx` のようになります。

**方法 1（推奨）**

1. Gateway（ゲートウェイ）を起動し、ボットにダイレクトメッセージを送ります
2. `openclaw logs --follow` を実行し、`open_id` を探します

**方法 2**

ユーザー Open ID のペアリングリクエストを確認します。

```bash
openclaw pairing list feishu
```

---

## よく使うコマンド

| Command   | Description             |
| --------- | ----------------------- |
| `/status` | ボットステータスを表示  |
| `/reset`  | セッションをリセット    |
| `/model`  | モデルを表示 / 切り替え |

> 注: Feishu はネイティブのコマンドメニューにまだ対応していないため、コマンドはテキストとして送信する必要があります。

## Gateway（ゲートウェイ）管理コマンド

| Command                    | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `openclaw gateway status`  | Gateway（ゲートウェイ）ステータスを表示              |
| `openclaw gateway install` | Gateway（ゲートウェイ）サービスをインストール / 起動 |
| `openclaw gateway stop`    | Gateway（ゲートウェイ）サービスを停止                |
| `openclaw gateway restart` | Gateway（ゲートウェイ）サービスを再起動              |
| `openclaw logs --follow`   | Gateway（ゲートウェイ）ログを tail する              |

---

## トラブルシューティング

### グループチャットでボットが応答しない

1. ボットがグループに追加されていることを確認します
2. ボットを @mention していることを確認します（デフォルト動作）
3. `groupPolicy` が `"disabled"` に設定されていないことを確認します
4. ログを確認します: `openclaw logs --follow`

### ボットがメッセージを受信しない

1. アプリが公開され、承認されていることを確認します
2. イベントサブスクリプションに `im.message.receive_v1` が含まれていることを確認します
3. **ロングコネクション**が有効であることを確認します
4. アプリ権限が完全であることを確認します
5. Gateway（ゲートウェイ）が実行中であることを確認します: `openclaw gateway status`
6. ログを確認します: `openclaw logs --follow`

### App Secret の漏えい

1. Feishu Open Platform で App Secret をリセットします
2. 設定内の App Secret を更新します
3. Gateway（ゲートウェイ）を再起動します

### メッセージ送信の失敗

1. アプリに `im:message:send_as_bot` 権限があることを確認します
2. アプリが公開されていることを確認します
3. ログで詳細エラーを確認します

---

## 高度な設定

### 複数アカウント

```json5
{
  channels: {
    feishu: {
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          botName: "Primary bot",
        },
        backup: {
          appId: "cli_yyy",
          appSecret: "yyy",
          botName: "Backup bot",
          enabled: false,
        },
      },
    },
  },
}
```

### メッセージ制限

- `textChunkLimit`: 送信テキストのチャンクサイズ（デフォルト: 2000 文字）
- `mediaMaxMb`: メディアのアップロード / ダウンロード上限（デフォルト: 30 MB）

### ストリーミング

Feishu はインタラクティブカードによるストリーミング返信に対応しています。有効化すると、ボットはテキスト生成に合わせてカードを更新します。

```json5
{
  channels: {
    feishu: {
      streaming: true, // enable streaming card output (default true)
      blockStreaming: true, // enable block-level streaming (default true)
    },
  },
}
```

送信前に完全な返信を待つには、`streaming: false` を設定します。

### マルチエージェントルーティング

`bindings` を使用して、Feishu のダイレクトメッセージまたはグループを異なるエージェントにルーティングします。

```json5
{
  agents: {
    list: [
      { id: "main" },
      {
        id: "clawd-fan",
        workspace: "/home/user/clawd-fan",
        agentDir: "/home/user/.openclaw/agents/clawd-fan/agent",
      },
      {
        id: "clawd-xi",
        workspace: "/home/user/clawd-xi",
        agentDir: "/home/user/.openclaw/agents/clawd-xi/agent",
      },
    ],
  },
  bindings: [
    {
      agentId: "main",
      match: {
        channel: "feishu",
        peer: { kind: "dm", id: "ou_xxx" },
      },
    },
    {
      agentId: "clawd-fan",
      match: {
        channel: "feishu",
        peer: { kind: "dm", id: "ou_yyy" },
      },
    },
    {
      agentId: "clawd-xi",
      match: {
        channel: "feishu",
        peer: { kind: "group", id: "oc_zzz" },
      },
    },
  ],
}
```

ルーティングフィールド:

- `match.channel`: `"feishu"`
- `match.peer.kind`: `"dm"` または `"group"`
- `match.peer.id`: ユーザー Open ID（`ou_xxx`）またはグループ ID（`oc_xxx`）

検索のヒントは、[Get group/user IDs](#get-groupuser-ids) を参照してください。

---

## 設定リファレンス

完全な設定: [Gateway configuration](/gateway/configuration)

主要オプション:

| Setting                                           | Description                                      | Default   |
| ------------------------------------------------- | ------------------------------------------------ | --------- |
| `channels.feishu.enabled`                         | チャンネルの有効化 / 無効化                      | `true`    |
| `channels.feishu.domain`                          | API ドメイン（`feishu` または `lark`）           | `feishu`  |
| `channels.feishu.accounts.<id>.appId`             | App ID                                           | -         |
| `channels.feishu.accounts.<id>.appSecret`         | App Secret                                       | -         |
| `channels.feishu.accounts.<id>.domain`            | アカウントごとの API ドメイン上書き              | `feishu`  |
| `channels.feishu.dmPolicy`                        | ダイレクトメッセージポリシー                     | `pairing` |
| `channels.feishu.allowFrom`                       | ダイレクトメッセージ許可リスト（open_id リスト） | -         |
| `channels.feishu.groupPolicy`                     | グループポリシー                                 | `open`    |
| `channels.feishu.groupAllowFrom`                  | グループ許可リスト                               | -         |
| `channels.feishu.groups.<chat_id>.requireMention` | @mention を必須                                  | `true`    |
| `channels.feishu.groups.<chat_id>.enabled`        | グループを有効化                                 | `true`    |
| `channels.feishu.textChunkLimit`                  | メッセージチャンクサイズ                         | `2000`    |
| `channels.feishu.mediaMaxMb`                      | メディアサイズ上限                               | `30`      |
| `channels.feishu.streaming`                       | ストリーミングカード出力を有効化                 | `true`    |
| `channels.feishu.blockStreaming`                  | ブロックストリーミングを有効化                   | `true`    |

---

## dmPolicy リファレンス

| Value         | Behavior                                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `"pairing"`   | **デフォルト。** 不明なユーザーはペアリングコードを受け取り、承認が必要です |
| `"allowlist"` | `allowFrom` 内のユーザーのみチャット可能                                    |
| `"open"`      | 全ユーザーを許可（allowFrom で `"*"` が必要）                               |
| `"disabled"`  | ダイレクトメッセージを無効化                                                |

---

## 対応メッセージ種別

### 受信

- ✅ テキスト
- ✅ リッチテキスト（post）
- ✅ 画像
- ✅ ファイル
- ✅ 音声
- ✅ 動画
- ✅ スタンプ

### 送信

- ✅ テキスト
- ✅ 画像
- ✅ ファイル
- ✅ 音声
- ⚠️ リッチテキスト（部分対応）
