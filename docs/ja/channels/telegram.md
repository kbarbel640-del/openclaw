---
summary: "Telegram ボットのサポート状況、機能、設定"
read_when:
  - Telegram 機能または webhook に取り組んでいるとき
title: "Telegram"
x-i18n:
  source_path: channels/telegram.md
  source_hash: 5f75bd20da52c8f0
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:51:57Z
---

# Telegram（Bot API）

ステータス: grammY 経由のボット ダイレクトメッセージ + グループ向けに本番運用可能です。デフォルトはロングポーリングで、webhook は任意です。

## クイックセットアップ（初心者）

1. **@BotFather**（[直リンク](https://t.me/BotFather)）でボットを作成します。ハンドルが正確に `@BotFather` であることを確認してから、トークンをコピーします。
2. トークンを設定します:
   - Env: `TELEGRAM_BOT_TOKEN=...`
   - または config: `channels.telegram.botToken: "..."`。
   - 両方が設定されている場合、config が優先されます（env のフォールバックはデフォルトアカウントのみ）。
3. ゲートウェイを起動します。
4. ダイレクトメッセージのアクセスはデフォルトでペアリングです。初回の接触時にペアリングコードを承認します。

最小構成:

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
    },
  },
}
```

## これは何ですか

- Gateway（ゲートウェイ）が所有する Telegram Bot API チャンネルです。
- 決定論的ルーティング: 返信は Telegram に戻り、モデルがチャンネルを選ぶことはありません。
- ダイレクトメッセージはエージェントのメイン セッションを共有し、グループは分離されたままです（`agent:<agentId>:telegram:group:<chatId>`）。

## セットアップ（最短ルート）

### 1) ボットトークンを作成する（BotFather）

1. Telegram を開き、**@BotFather**（[直リンク](https://t.me/BotFather)）とチャットします。ハンドルが正確に `@BotFather` であることを確認します。
2. `/newbot` を実行し、プロンプトに従います（名前 + `bot` で終わるユーザー名）。
3. トークンをコピーし、安全に保管します。

任意の BotFather 設定:

- `/setjoingroups` — ボットをグループに追加できる/できないを許可/拒否します。
- `/setprivacy` — ボットがグループメッセージをすべて見られるかどうかを制御します。

### 2) トークンを設定する（env または config）

例:

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
      groups: { "*": { requireMention: true } },
    },
  },
}
```

Env オプション: `TELEGRAM_BOT_TOKEN=...`（デフォルトアカウントで動作します）。
env と config の両方が設定されている場合、config が優先されます。

マルチアカウント対応: アカウントごとのトークンと任意の `name` を指定して `channels.telegram.accounts` を使用します。共有パターンは [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) を参照してください。

3. ゲートウェイを起動します。トークンが解決されると Telegram が起動します（まず config、次に env をフォールバック）。
4. ダイレクトメッセージのアクセスはデフォルトでペアリングです。ボットに初めて連絡したときにコードを承認します。
5. グループの場合: ボットを追加し、プライバシー/管理者の動作を決め（下記）、その後 `channels.telegram.groups` を設定してメンションのゲーティング + 許可リストを制御します。

## トークン + プライバシー + 権限（Telegram 側）

### トークン作成（BotFather）

- `/newbot` はボットを作成し、トークンを返します（秘密にしてください）。
- トークンが漏えいした場合は、@BotFather で無効化/再生成して、設定を更新してください。

### グループメッセージの可視性（プライバシーモード）

Telegram ボットはデフォルトで **プライバシーモード**になっており、受信できるグループメッセージが制限されます。
ボットがグループ内の _すべて_ のメッセージを閲覧する必要がある場合、選択肢は 2 つあります:

- `/setprivacy` でプライバシーモードを無効化する **または**
- ボットをグループの **管理者**として追加する（管理者ボットはすべてのメッセージを受信します）。

**注:** プライバシーモードを切り替えた場合、変更を有効にするには Telegram 側で
各グループからボットを削除して再追加する必要があります。

### グループ権限（管理者権限）

管理者ステータスはグループ内（Telegram UI）で設定します。管理者ボットは常にすべての
グループメッセージを受信するため、完全な可視性が必要な場合は管理者を使用してください。

## 仕組み（動作）

- 受信メッセージは、返信コンテキストとメディアのプレースホルダー付きで共有チャンネルエンベロープに正規化されます。
- グループ返信はデフォルトでメンションが必要です（ネイティブの @mention または `agents.list[].groupChat.mentionPatterns` / `messages.groupChat.mentionPatterns`）。
- マルチエージェントの上書き: `agents.list[].groupChat.mentionPatterns` でエージェントごとのパターンを設定します。
- 返信は常に同じ Telegram チャットへルーティングされます。
- ロングポーリングは grammY runner を使用し、チャットごとに順序付けされます。全体の並列度は `agents.defaults.maxConcurrent` により上限が設定されます。
- Telegram Bot API は既読通知をサポートしていないため、`sendReadReceipts` オプションはありません。

## 下書きストリーミング

OpenClaw は `sendMessageDraft` を使用して Telegram ダイレクトメッセージで部分返信をストリーミングできます。

要件:

- @BotFather でボットの Threaded Mode を有効化（フォーラムトピックモード）。
- プライベートチャットのスレッドのみ（Telegram は受信メッセージに `message_thread_id` を含めます）。
- `channels.telegram.streamMode` が `"off"` に設定されていないこと（デフォルト: `"partial"`、`"block"` でチャンク化された下書き更新が有効になります）。

下書きストリーミングはダイレクトメッセージ専用であり、Telegram はグループやチャンネルではサポートしていません。

## フォーマット（Telegram HTML）

- Telegram への送信テキストは `parse_mode: "HTML"`（Telegram がサポートするタグのサブセット）を使用します。
- Markdown 風の入力は **Telegram 安全な HTML**（太字/斜体/取り消し/コード/リンク）にレンダリングされます。ブロック要素は改行/箇条書きを含むテキストにフラット化されます。
- Telegram のパースエラーを避けるため、モデルからの生 HTML はエスケープされます。
- Telegram が HTML ペイロードを拒否した場合、OpenClaw は同じメッセージをプレーンテキストとして再試行します。

## コマンド（ネイティブ + カスタム）

OpenClaw は起動時に、`/status`、`/reset`、`/model` のようなネイティブコマンドを Telegram のボットメニューに登録します。
設定によりメニューへカスタムコマンドを追加できます:

```json5
{
  channels: {
    telegram: {
      customCommands: [
        { command: "backup", description: "Git backup" },
        { command: "generate", description: "Create an image" },
      ],
    },
  },
}
```

## トラブルシューティング

- ログの `setMyCommands failed` は通常、`api.telegram.org` への送信 HTTPS/DNS がブロックされていることを意味します。
- `sendMessage` または `sendChatAction` の失敗が表示される場合は、IPv6 ルーティングと DNS を確認してください。

追加のヘルプ: [Channel troubleshooting](/channels/troubleshooting)。

注記:

- カスタムコマンドは **メニューエントリのみ**です。別途処理しない限り OpenClaw は実装しません。
- コマンド名は正規化され（先頭の `/` を除去し、小文字化）、`a-z`、`0-9`、`_`（1〜32 文字）に一致する必要があります。
- カスタムコマンドは **ネイティブコマンドを上書きできません**。競合は無視され、ログに記録されます。
- `commands.native` が無効の場合、カスタムコマンドのみが登録されます（なければクリアされます）。

## 制限

- 送信テキストは `channels.telegram.textChunkLimit` にチャンク分割されます（デフォルト 4000）。
- 任意の改行チャンク分割: `channels.telegram.chunkMode="newline"` を設定すると、長さによるチャンク分割の前に空行（段落境界）で分割します。
- メディアのダウンロード/アップロードは `channels.telegram.mediaMaxMb` で上限が設定されます（デフォルト 5）。
- Telegram Bot API リクエストは `channels.telegram.timeoutSeconds` 後にタイムアウトします（grammY 経由のデフォルト 500）。長時間のハングを避けるには低く設定してください。
- グループの履歴コンテキストは `channels.telegram.historyLimit`（または `channels.telegram.accounts.*.historyLimit`）を使用し、`messages.groupChat.historyLimit` にフォールバックします。無効化するには `0` を設定します（デフォルト 50）。
- ダイレクトメッセージの履歴は `channels.telegram.dmHistoryLimit`（ユーザーのターン数）で制限できます。ユーザー別の上書き: `channels.telegram.dms["<user_id>"].historyLimit`。

## グループ有効化モード

デフォルトでは、ボットはグループ内でメンションにのみ応答します（`@botname` または `agents.list[].groupChat.mentionPatterns` のパターン）。この動作を変更するには:

### config 経由（推奨）

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": { requireMention: false }, // always respond in this group
      },
    },
  },
}
```

**重要:** `channels.telegram.groups` を設定すると **許可リスト**が作成され、リストされたグループ（または `"*"`）のみが受け付けられます。
フォーラムトピックは、`channels.telegram.groups.<groupId>.topics.<topicId>` の下にトピック別の上書きを追加しない限り、親グループの設定（allowFrom、requireMention、skills、prompts）を継承します。

常に応答で全グループを許可するには:

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: false }, // all groups, always respond
      },
    },
  },
}
```

全グループでメンションのみを維持するには（デフォルト動作）:

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: true }, // or omit groups entirely
      },
    },
  },
}
```

### コマンド経由（セッションレベル）

グループ内で送信します:

- `/activation always` - すべてのメッセージに応答
- `/activation mention` - メンション必須（デフォルト）

**注:** コマンドはセッション状態のみを更新します。再起動をまたいで永続化するには config を使用してください。

### グループチャット ID の取得

グループの任意のメッセージを Telegram 上で `@userinfobot` または `@getidsbot` に転送すると、チャット ID（`-1001234567890` のような負の数値）を確認できます。

**ヒント:** 自分のユーザー ID は、ボットにダイレクトメッセージすると（ペアリングメッセージとして）返信されるか、コマンドが有効になった後に `/whoami` を使用してください。

**プライバシー注記:** `@userinfobot` はサードパーティのボットです。望む場合は、ボットをグループに追加してメッセージを送信し、`openclaw logs --follow` を使って `chat.id` を読み取るか、Bot API の `getUpdates` を使用してください。

## 設定の書き込み

デフォルトでは、Telegram はチャンネルイベントまたは `/config set|unset` によりトリガーされる設定更新を書き込むことが許可されています。

これは次の場合に発生します:

- グループがスーパーグループにアップグレードされ、Telegram が `migrate_to_chat_id` を発行する場合（チャット ID が変わります）。OpenClaw は `channels.telegram.groups` を自動的に移行できます。
- Telegram チャットで `/config set` または `/config unset` を実行した場合（`commands.config: true` が必要）。

無効化するには:

```json5
{
  channels: { telegram: { configWrites: false } },
}
```

## トピック（フォーラム スーパーグループ）

Telegram のフォーラムトピックには、メッセージごとに `message_thread_id` が含まれます。OpenClaw は次を行います:

- Telegram グループのセッションキーに `:topic:<threadId>` を付加し、トピックごとに分離します。
- レスポンスがトピック内に留まるよう、typing インジケーターと返信を `message_thread_id` 付きで送信します。
- 一般トピック（スレッド ID が `1`）は特別扱いです: メッセージ送信では `message_thread_id` を省略します（Telegram が拒否します）が、typing インジケーターには引き続き含めます。
- ルーティング/テンプレート用にテンプレートコンテキストへ `MessageThreadId` + `IsForum` を公開します。
- トピック固有の設定は `channels.telegram.groups.<chatId>.topics.<threadId>`（Skills、許可リスト、自動返信、システムプロンプト、無効化）の下で利用できます。
- トピック設定は、トピックごとに上書きしない限り、グループ設定（requireMention、許可リスト、Skills、プロンプト、有効化）を継承します。

プライベートチャットでは、いくつかのエッジケースで `message_thread_id` が含まれることがあります。OpenClaw はダイレクトメッセージのセッションキーを変更しませんが、存在する場合は返信/下書きストリーミングのために thread id を引き続き使用します。

## インラインボタン

Telegram はコールバックボタン付きのインラインキーボードをサポートしています。

```json5
{
  channels: {
    telegram: {
      capabilities: {
        inlineButtons: "allowlist",
      },
    },
  },
}
```

アカウント別の設定:

```json5
{
  channels: {
    telegram: {
      accounts: {
        main: {
          capabilities: {
            inlineButtons: "allowlist",
          },
        },
      },
    },
  },
}
```

スコープ:

- `off` — インラインボタン無効
- `dm` — ダイレクトメッセージのみ（グループ宛てはブロック）
- `group` — グループのみ（ダイレクトメッセージ宛てはブロック）
- `all` — ダイレクトメッセージ + グループ
- `allowlist` — ダイレクトメッセージ + グループ。ただし `allowFrom`/`groupAllowFrom` で許可された送信者のみ（制御コマンドと同じルール）

デフォルト: `allowlist`。
レガシー: `capabilities: ["inlineButtons"]` = `inlineButtons: "all"`。

### ボタンの送信

メッセージツールで `buttons` パラメータを使用します:

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  message: "Choose an option:",
  buttons: [
    [
      { text: "Yes", callback_data: "yes" },
      { text: "No", callback_data: "no" },
    ],
    [{ text: "Cancel", callback_data: "cancel" }],
  ],
}
```

ユーザーがボタンをクリックすると、コールバックデータは次の形式のメッセージとしてエージェントへ送られます:
`callback_data: value`

### 設定オプション

Telegram の機能は 2 つのレベルで設定できます（上記はオブジェクト形式を示します。レガシーの文字列配列も引き続きサポートされます）:

- `channels.telegram.capabilities`: 上書きされない限り、すべての Telegram アカウントに適用されるグローバル既定の機能設定。
- `channels.telegram.accounts.<account>.capabilities`: 特定アカウントに対してグローバル既定を上書きする、アカウント別の機能設定。

すべての Telegram ボット/アカウントが同じように動作すべき場合はグローバル設定を使用します。ボットごとに異なる振る舞いが必要な場合（例: あるアカウントはダイレクトメッセージのみを処理し、別のアカウントはグループで許可される）はアカウント別設定を使用します。

## アクセス制御（ダイレクトメッセージ + グループ）

### ダイレクトメッセージのアクセス

- デフォルト: `channels.telegram.dmPolicy = "pairing"`。不明な送信者にはペアリングコードが送られ、承認されるまでメッセージは無視されます（コードは 1 時間で失効）。
- 承認方法:
  - `openclaw pairing list telegram`
  - `openclaw pairing approve telegram <CODE>`
- ペアリングは Telegram ダイレクトメッセージで使用されるデフォルトのトークン交換です。詳細: [Pairing](/start/pairing)
- `channels.telegram.allowFrom` は数値のユーザー ID（推奨）または `@username` エントリを受け付けます。これはボットのユーザー名ではありません。人間の送信者の ID を使用してください。ウィザードは `@username` を受け付け、可能な場合は数値 ID に解決します。

#### Telegram のユーザー ID の見つけ方

より安全（サードパーティ ボットなし）:

1. ゲートウェイを起動して、ボットへダイレクトメッセージします。
2. `openclaw logs --follow` を実行し、`from.id` を探します。

代替（公式 Bot API）:

1. ボットへダイレクトメッセージします。
2. ボットトークンで updates を取得し、`message.from.id` を読み取ります:
   ```bash
   curl "https://api.telegram.org/bot<bot_token>/getUpdates"
   ```

サードパーティ（プライバシーは低め）:

- `@userinfobot` または `@getidsbot` にダイレクトメッセージし、返された user id を使用します。

### グループアクセス

独立した 2 つの制御があります:

**1. どのグループを許可するか**（`channels.telegram.groups` によるグループ許可リスト）:

- `groups` 設定なし = 全グループ許可
- `groups` 設定あり = リストされたグループまたは `"*"` のみ許可
- 例: `"groups": { "-1001234567890": {}, "*": {} }` は全グループを許可

**2. どの送信者を許可するか**（`channels.telegram.groupPolicy` による送信者フィルタリング）:

- `"open"` = 許可されたグループ内の全送信者がメッセージ可能
- `"allowlist"` = `channels.telegram.groupAllowFrom` の送信者のみメッセージ可能
- `"disabled"` = グループメッセージを一切受け付けない
  デフォルトは `groupPolicy: "allowlist"`（`groupAllowFrom` を追加するまでブロック）。

多くのユーザーが望むのは: `groupPolicy: "allowlist"` + `groupAllowFrom` + `channels.telegram.groups` に特定グループを列挙

特定グループで **任意のグループメンバー** が会話できるようにしつつ（制御コマンドは認可済み送信者に限定したままにする）ためには、グループ別の上書きを設定します:

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": {
          groupPolicy: "open",
          requireMention: false,
        },
      },
    },
  },
}
```

## ロングポーリング vs webhook

- デフォルト: ロングポーリング（公開 URL 不要）。
- webhook モード: `channels.telegram.webhookUrl` と `channels.telegram.webhookSecret`（任意で `channels.telegram.webhookPath`）を設定します。
  - ローカルリスナーは `0.0.0.0:8787` にバインドし、デフォルトで `POST /telegram-webhook` を提供します。
  - 公開 URL が異なる場合は、リバースプロキシを使用し、`channels.telegram.webhookUrl` を公開エンドポイントへ向けてください。

## 返信スレッディング

Telegram はタグによる任意のスレッド返信をサポートしています:

- `[[reply_to_current]]` -- トリガーとなったメッセージへ返信します。
- `[[reply_to:<id>]]` -- 特定の message id へ返信します。

`channels.telegram.replyToMode` により制御されます:

- `first`（デフォルト）、`all`、`off`。

## 音声メッセージ（ボイス vs ファイル）

Telegram は **ボイスノート**（丸い吹き出し）と **音声ファイル**（メタデータカード）を区別します。
OpenClaw は後方互換性のため、デフォルトでは音声ファイルを使用します。

エージェントの返信でボイスノート吹き出しを強制するには、返信の任意の場所にこのタグを含めます:

- `[[audio_as_voice]]` — 音声をファイルではなくボイスノートとして送信します。

このタグは配信テキストから取り除かれます。他のチャンネルはこのタグを無視します。

メッセージツールで送信する場合は、音声互換の `media` URL を指定して `asVoice: true` を設定します
（メディアが存在する場合、`message` は任意）:

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  media: "https://example.com/voice.ogg",
  asVoice: true,
}
```

## ステッカー

OpenClaw は Telegram ステッカーの受信と送信を、インテリジェントなキャッシュ付きでサポートします。

### ステッカーの受信

ユーザーがステッカーを送信した場合、OpenClaw はステッカー種別に応じて処理します:

- **静的ステッカー（WEBP）:** ダウンロードしてビジョン処理します。ステッカーはメッセージ本文中に `<media:sticker>` プレースホルダーとして表示されます。
- **アニメーション ステッカー（TGS）:** スキップします（Lottie 形式は処理の対象外）。
- **動画ステッカー（WEBM）:** スキップします（動画形式は処理の対象外）。

ステッカー受信時に利用可能なテンプレートコンテキストフィールド:

- `Sticker` — 次を含むオブジェクト:
  - `emoji` — ステッカーに関連付けられた絵文字
  - `setName` — ステッカーセット名
  - `fileId` — Telegram file ID（同じステッカーを送り返せます）
  - `fileUniqueId` — キャッシュ検索用の安定 ID
  - `cachedDescription` — 利用可能な場合の、キャッシュされたビジョン説明

### ステッカーキャッシュ

ステッカーは AI のビジョン機能で処理され、説明文が生成されます。同じステッカーが繰り返し送信されることが多いため、OpenClaw は冗長な API 呼び出しを避けるためにこれらの説明をキャッシュします。

**仕組み:**

1. **初回:** ステッカー画像が AI に送られてビジョン解析されます。AI が説明（例: 「元気よく手を振るアニメ風の猫」）を生成します。
2. **キャッシュ保存:** 説明はステッカーの file ID、絵文字、セット名とともに保存されます。
3. **以降:** 同じステッカーが再度表示されると、キャッシュされた説明が直接使用されます。画像は AI に送られません。

**キャッシュ場所:** `~/.openclaw/telegram/sticker-cache.json`

**キャッシュエントリ形式:**

```json
{
  "fileId": "CAACAgIAAxkBAAI...",
  "fileUniqueId": "AgADBAADb6cxG2Y",
  "emoji": "👋",
  "setName": "CoolCats",
  "description": "A cartoon cat waving enthusiastically",
  "cachedAt": "2026-01-15T10:30:00.000Z"
}
```

**利点:**

- 同じステッカーに対するビジョン呼び出しの繰り返しを避け、API コストを削減します
- キャッシュ済みステッカーの応答が高速になります（ビジョン処理の遅延なし）
- キャッシュされた説明に基づくステッカー検索機能を有効にします

キャッシュはステッカー受信時に自動的に作成されます。手動のキャッシュ管理は不要です。

### ステッカーの送信

エージェントは `sticker` と `sticker-search` アクションを使ってステッカーの送信と検索ができます。これらはデフォルトで無効であり、config で有効化する必要があります:

```json5
{
  channels: {
    telegram: {
      actions: {
        sticker: true,
      },
    },
  },
}
```

**ステッカーを送信する:**

```json5
{
  action: "sticker",
  channel: "telegram",
  to: "123456789",
  fileId: "CAACAgIAAxkBAAI...",
}
```

パラメータ:

- `fileId`（必須）— ステッカーの Telegram file ID。ステッカー受信時の `Sticker.fileId`、または `sticker-search` の結果から取得します。
- `replyTo`（任意）— 返信先の message ID。
- `threadId`（任意）— フォーラムトピック用の message thread ID。

**ステッカーを検索する:**

エージェントは、説明、絵文字、またはセット名でキャッシュされたステッカーを検索できます:

```json5
{
  action: "sticker-search",
  channel: "telegram",
  query: "cat waving",
  limit: 5,
}
```

キャッシュから一致するステッカーを返します:

```json5
{
  ok: true,
  count: 2,
  stickers: [
    {
      fileId: "CAACAgIAAxkBAAI...",
      emoji: "👋",
      description: "A cartoon cat waving enthusiastically",
      setName: "CoolCats",
    },
  ],
}
```

検索は、説明テキスト、絵文字文字、セット名に対してファジーマッチングを使用します。

**スレッディング付きの例:**

```json5
{
  action: "sticker",
  channel: "telegram",
  to: "-1001234567890",
  fileId: "CAACAgIAAxkBAAI...",
  replyTo: 42,
  threadId: 123,
}
```

## ストリーミング（下書き）

Telegram は、エージェントが応答を生成している間に **下書き吹き出し** をストリーミングできます。
OpenClaw は Bot API の `sendMessageDraft`（実メッセージではありません）を使用し、その後
最終返信を通常メッセージとして送信します。

要件（Telegram Bot API 9.3+）:

- **トピックが有効なプライベートチャット**（ボットのフォーラムトピックモード）。
- 受信メッセージに `message_thread_id`（プライベートトピック スレッド）が含まれる必要があります。
- グループ/スーパーグループ/チャンネルではストリーミングは無視されます。

Config:

- `channels.telegram.streamMode: "off" | "partial" | "block"`（デフォルト: `partial`）
  - `partial`: 最新のストリーミングテキストで下書き吹き出しを更新します。
  - `block`: より大きいブロック（チャンク化）で下書き吹き出しを更新します。
  - `off`: 下書きストリーミングを無効化します。
- 任意（`streamMode: "block"` のみ）:
  - `channels.telegram.draftChunk: { minChars?, maxChars?, breakPreference? }`
    - デフォルト: `minChars: 200`、`maxChars: 800`、`breakPreference: "paragraph"`（`channels.telegram.textChunkLimit` にクランプ）。

注: 下書きストリーミングは **ブロックストリーミング**（チャンネルメッセージ）とは別です。
ブロックストリーミングはデフォルトでオフであり、下書き更新ではなく早期の Telegram メッセージが必要な場合は `channels.telegram.blockStreaming: true`
が必要です。

推論ストリーム（Telegram のみ）:

- `/reasoning stream` は、返信生成中に推論を下書き吹き出しへストリーミングし、
  その後、推論なしで最終回答を送信します。
- `channels.telegram.streamMode` が `off` の場合、推論ストリームは無効です。
  追加の文脈: [Streaming + chunking](/concepts/streaming)。

## リトライポリシー

送信 Telegram API 呼び出しは、一時的なネットワーク/429 エラーで指数バックオフとジッター付きでリトライします。`channels.telegram.retry` で設定します。[Retry policy](/concepts/retry) を参照してください。

## エージェントツール（メッセージ + リアクション）

- ツール: `telegram` の `sendMessage` アクション（`to`、`content`、任意で `mediaUrl`、`replyToMessageId`、`messageThreadId`）。
- ツール: `telegram` の `react` アクション（`chatId`、`messageId`、`emoji`）。
- ツール: `telegram` の `deleteMessage` アクション（`chatId`、`messageId`）。
- リアクション削除のセマンティクス: [/tools/reactions](/tools/reactions) を参照してください。
- ツールのゲーティング: `channels.telegram.actions.reactions`、`channels.telegram.actions.sendMessage`、`channels.telegram.actions.deleteMessage`（デフォルト: 有効）、および `channels.telegram.actions.sticker`（デフォルト: 無効）。

## リアクション通知

**リアクションの仕組み:**
Telegram のリアクションは、メッセージペイロードのプロパティではなく、**別個の `message_reaction` イベント**として届きます。ユーザーがリアクションを追加すると、OpenClaw は次を行います:

1. Telegram API から `message_reaction` 更新を受信します
2. それを形式 `"Telegram reaction added: {emoji} by {user} on msg {id}"` の **システムイベント**に変換します
3. 通常メッセージと同じ **セッションキー**でシステムイベントをキューイングします
4. 次のメッセージがその会話に届いたとき、システムイベントがドレインされ、エージェントのコンテキストの先頭に追加されます

エージェントは、リアクションをメッセージメタデータとしてではなく、会話履歴内の **システム通知**として認識します。

**設定:**

- `channels.telegram.reactionNotifications`: 通知をトリガーするリアクションを制御します
  - `"off"` — すべてのリアクションを無視します
  - `"own"` — ユーザーがボットメッセージにリアクションしたときに通知します（ベストエフォート、インメモリ）（デフォルト）
  - `"all"` — すべてのリアクションで通知します

- `channels.telegram.reactionLevel`: エージェントのリアクション機能を制御します
  - `"off"` — エージェントはメッセージにリアクションできません
  - `"ack"` — ボットが確認のリアクションを送ります（処理中は 👀）（デフォルト）
  - `"minimal"` — エージェントは控えめにリアクションできます（ガイドライン: 5〜10 往復に 1 回）
  - `"extensive"` — 適切な場合にエージェントが積極的にリアクションできます

**フォーラムグループ:** フォーラムグループのリアクションには `message_thread_id` が含まれ、`agent:main:telegram:group:{chatId}:topic:{threadId}` のようなセッションキーが使用されます。これにより、同一トピック内のリアクションとメッセージが同一のまとまりとして保持されます。

**設定例:**

```json5
{
  channels: {
    telegram: {
      reactionNotifications: "all", // See all reactions
      reactionLevel: "minimal", // Agent can react sparingly
    },
  },
}
```

**要件:**

- Telegram ボットは `allowed_updates` で明示的に `message_reaction` を要求する必要があります（OpenClaw が自動的に設定します）
- webhook モードでは、リアクションは webhook `allowed_updates` に含まれます
- ポーリングモードでは、リアクションは `getUpdates` `allowed_updates` に含まれます

## 配信ターゲット（CLI/cron）

- ターゲットとして chat id（`123456789`）またはユーザー名（`@name`）を使用します。
- 例: `openclaw message send --channel telegram --target 123456789 --message "hi"`。

## トラブルシューティング

**グループでメンションなしメッセージにボットが応答しない:**

- `channels.telegram.groups.*.requireMention=false` を設定している場合、Telegram の Bot API **プライバシーモード**を無効化する必要があります。
  - BotFather: `/setprivacy` → **Disable**（その後、グループからボットを削除して再追加）
- `openclaw channels status` は、config がメンションなしのグループメッセージを想定している場合に警告を表示します。
- `openclaw channels status --probe` は、明示的な数値グループ ID について追加でメンバーシップを確認できます（ワイルドカードの `"*"` ルールは監査できません）。
- クイックテスト: `/activation always`（セッションのみ。永続化には config を使用）

**ボットがグループメッセージをまったく見ていない:**

- `channels.telegram.groups` が設定されている場合、グループはリストに含まれるか `"*"` を使用する必要があります
- @BotFather の Privacy Settings を確認してください → 「Group Privacy」は **OFF** である必要があります
- ボットが実際にメンバーであることを確認してください（読み取りアクセスのない管理者であるだけではないこと）
- ゲートウェイログを確認してください: `openclaw logs --follow`（「skipping group message」を探します）

**ボットはメンションには応答するが `/activation always` には応答しない:**

- `/activation` コマンドはセッション状態を更新しますが、config には永続化しません
- 永続化するには、`requireMention: false` を付けてグループを `channels.telegram.groups` に追加してください

**`/status` のようなコマンドが動かない:**

- Telegram のユーザー ID が（ペアリングまたは `channels.telegram.allowFrom` により）認可されていることを確認してください
- `groupPolicy: "open"` のグループであってもコマンドには認可が必要です

**Node 22+ でロングポーリングが即座に中断される（プロキシ/カスタム fetch でよく発生）:**

- Node 22+ は `AbortSignal` インスタンスに対してより厳格で、外部のシグナルにより `fetch` 呼び出しが直ちに中断されることがあります。
- abort signal を正規化する OpenClaw ビルドへアップグレードするか、アップグレードできるまで Node 20 でゲートウェイを実行してください。

**ボットが起動した後、黙って応答しなくなる（または `HttpError: Network request ... failed` をログに出す）:**

- 一部のホストは `api.telegram.org` を最初に IPv6 に解決します。サーバーに IPv6 の送信経路がない場合、grammY が IPv6 のみのリクエストで詰まることがあります。
- IPv6 の送信経路を有効化する **または** `api.telegram.org` の IPv4 解決を強制します（例: IPv4 A レコードを使用して `/etc/hosts` エントリを追加する、または OS の DNS スタックで IPv4 を優先する）うえで、ゲートウェイを再起動してください。
- クイックチェック: `dig +short api.telegram.org A` と `dig +short api.telegram.org AAAA` で DNS が何を返すか確認します。

## 設定リファレンス（Telegram）

完全な設定: [Configuration](/gateway/configuration)

プロバイダー オプション:

- `channels.telegram.enabled`: チャンネル起動の有効/無効。
- `channels.telegram.botToken`: ボットトークン（BotFather）。
- `channels.telegram.tokenFile`: ファイルパスからトークンを読み取ります。
- `channels.telegram.dmPolicy`: `pairing | allowlist | open | disabled`（デフォルト: ペアリング）。
- `channels.telegram.allowFrom`: ダイレクトメッセージ許可リスト（id/username）。`open` は `"*"` が必要です。
- `channels.telegram.groupPolicy`: `open | allowlist | disabled`（デフォルト: 許可リスト）。
- `channels.telegram.groupAllowFrom`: グループ送信者許可リスト（id/username）。
- `channels.telegram.groups`: グループ別のデフォルト + 許可リスト（グローバル既定は `"*"` を使用）。
  - `channels.telegram.groups.<id>.groupPolicy`: groupPolicy（`open | allowlist | disabled`）のグループ別上書き。
  - `channels.telegram.groups.<id>.requireMention`: メンションゲーティングの既定。
  - `channels.telegram.groups.<id>.skills`: Skill フィルター（省略 = 全 Skills、空 = なし）。
  - `channels.telegram.groups.<id>.allowFrom`: グループ送信者許可リストの上書き。
  - `channels.telegram.groups.<id>.systemPrompt`: グループ用の追加システムプロンプト。
  - `channels.telegram.groups.<id>.enabled`: `false` のときグループを無効化。
  - `channels.telegram.groups.<id>.topics.<threadId>.*`: トピック別の上書き（グループと同じフィールド）。
  - `channels.telegram.groups.<id>.topics.<threadId>.groupPolicy`: groupPolicy（`open | allowlist | disabled`）のトピック別上書き。
  - `channels.telegram.groups.<id>.topics.<threadId>.requireMention`: メンションゲーティングのトピック別上書き。
- `channels.telegram.capabilities.inlineButtons`: `off | dm | group | all | allowlist`（デフォルト: 許可リスト）。
- `channels.telegram.accounts.<account>.capabilities.inlineButtons`: アカウント別の上書き。
- `channels.telegram.replyToMode`: `off | first | all`（デフォルト: `first`）。
- `channels.telegram.textChunkLimit`: 送信チャンクサイズ（文字数）。
- `channels.telegram.chunkMode`: `length`（デフォルト）または `newline` を指定し、長さによるチャンク分割の前に空行（段落境界）で分割します。
- `channels.telegram.linkPreview`: 送信メッセージのリンクプレビューを切り替えます（デフォルト: true）。
- `channels.telegram.streamMode`: `off | partial | block`（下書きストリーミング）。
- `channels.telegram.mediaMaxMb`: 受信/送信メディア上限（MB）。
- `channels.telegram.retry`: 送信 Telegram API 呼び出しのリトライポリシー（attempts、minDelayMs、maxDelayMs、jitter）。
- `channels.telegram.network.autoSelectFamily`: Node の autoSelectFamily を上書きします（true=有効、false=無効）。Happy Eyeballs のタイムアウトを避けるため、Node 22 ではデフォルトで無効です。
- `channels.telegram.proxy`: Bot API 呼び出しのプロキシ URL（SOCKS/HTTP）。
- `channels.telegram.webhookUrl`: webhook モードを有効化します（`channels.telegram.webhookSecret` が必要）。
- `channels.telegram.webhookSecret`: webhook シークレット（webhookUrl が設定されている場合は必須）。
- `channels.telegram.webhookPath`: ローカル webhook パス（デフォルト `/telegram-webhook`）。
- `channels.telegram.actions.reactions`: Telegram ツールのリアクションをゲートします。
- `channels.telegram.actions.sendMessage`: Telegram ツールのメッセージ送信をゲートします。
- `channels.telegram.actions.deleteMessage`: Telegram ツールのメッセージ削除をゲートします。
- `channels.telegram.actions.sticker`: Telegram ステッカー アクション（送信と検索）をゲートします（デフォルト: false）。
- `channels.telegram.reactionNotifications`: `off | own | all` — システムイベントをトリガーするリアクションを制御します（未設定時のデフォルト: `own`）。
- `channels.telegram.reactionLevel`: `off | ack | minimal | extensive` — エージェントのリアクション機能を制御します（未設定時のデフォルト: `minimal`）。

関連するグローバル オプション:

- `agents.list[].groupChat.mentionPatterns`（メンションゲーティングのパターン）。
- `messages.groupChat.mentionPatterns`（グローバル フォールバック）。
- `commands.native`（デフォルトは `"auto"` → Telegram/Discord ではオン、Slack ではオフ）、`commands.text`、`commands.useAccessGroups`（コマンドの挙動）。`channels.telegram.commands.native` で上書きします。
- `messages.responsePrefix`、`messages.ackReaction`、`messages.ackReactionScope`、`messages.removeAckAfterReply`。
