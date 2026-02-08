---
summary: "Discord ボットのサポート状況、機能、設定"
read_when:
  - Discord チャンネル機能に取り組んでいるとき
title: "Discord"
x-i18n:
  source_path: channels/discord.md
  source_hash: 9bebfe8027ff1972
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:45:09Z
---

# Discord（Bot API）

ステータス: 公式 Discord ボット Gateway（ゲートウェイ）経由で、ダイレクトメッセージおよびギルドのテキストチャンネルに対応済みです。

## クイックセットアップ（初心者）

1. Discord ボットを作成し、ボットトークンをコピーします。
2. Discord アプリ設定で **Message Content Intent**（および、許可リストや名前検索を使う予定がある場合は **Server Members Intent**）を有効化します。
3. OpenClaw 用にトークンを設定します:
   - 環境変数: `DISCORD_BOT_TOKEN=...`
   - または設定: `channels.discord.token: "..."`。
   - 両方が設定されている場合、設定が優先されます（環境変数のフォールバックはデフォルトアカウントのみです）。
4. メッセージ権限付きでボットをサーバーに招待します（ダイレクトメッセージだけが必要ならプライベートサーバーを作成します）。
5. Gateway（ゲートウェイ）を起動します。
6. ダイレクトメッセージのアクセスはデフォルトでペアリングです。初回コンタクト時にペアリングコードを承認します。

最小設定:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

## 目標

- Discord のダイレクトメッセージまたはギルドチャンネルで OpenClaw と会話します。
- ダイレクトチャットはエージェントのメインセッション（デフォルト `agent:main:main`）に統合されます。ギルドチャンネルは `agent:<agentId>:discord:channel:<channelId>` として分離されたままです（表示名は `discord:<guildSlug>#<channelSlug>` を使用します）。
- グループ DM はデフォルトで無視されます。`channels.discord.dm.groupEnabled` で有効化し、必要に応じて `channels.discord.dm.groupChannels` で制限します。
- ルーティングは決定論的に保ちます。返信は常に到着元のチャンネルへ戻ります。

## 仕組み

1. Discord アプリケーション → Bot を作成し、必要なインテント（DM + ギルドメッセージ + メッセージ内容）を有効化して、ボットトークンを取得します。
2. 使用したい場所でメッセージを読み取り/送信するために必要な権限を付与して、ボットをサーバーに招待します。
3. `channels.discord.token`（またはフォールバックとして `DISCORD_BOT_TOKEN`）で OpenClaw を設定します。
4. Gateway（ゲートウェイ）を実行します。トークンが利用可能で（設定を優先、環境変数はフォールバック）、かつ `channels.discord.enabled` が `false` でない場合、Discord チャンネルを自動起動します。
   - 環境変数を使いたい場合は `DISCORD_BOT_TOKEN` を設定します（設定ブロックは任意です）。
5. ダイレクトチャット: 配信時に `user:<id>`（または `<@id>` メンション）を使用します。すべてのターンは共有された `main` セッションに入ります。数値 ID だけだと曖昧なため拒否されます。
6. ギルドチャンネル: 配信には `channel:<channelId>` を使用します。メンションはデフォルトで必須で、ギルドごと/チャンネルごとに設定できます。
7. ダイレクトチャット: `channels.discord.dm.policy` によりデフォルトで安全です（デフォルト: `"pairing"`）。不明な送信者にはペアリングコード（1 時間で失効）が提示され、`openclaw pairing approve discord <code>` で承認します。
   - 旧来の「誰にでも開放」動作に戻す: `channels.discord.dm.policy="open"` と `channels.discord.dm.allowFrom=["*"]` を設定します。
   - ハード許可リスト化: `channels.discord.dm.policy="allowlist"` を設定し、`channels.discord.dm.allowFrom` に送信者を列挙します。
   - すべてのダイレクトメッセージを無視: `channels.discord.dm.enabled=false` または `channels.discord.dm.policy="disabled"` を設定します。
8. グループ DM はデフォルトで無視されます。`channels.discord.dm.groupEnabled` で有効化し、必要に応じて `channels.discord.dm.groupChannels` で制限します。
9. 任意のギルドルール: ギルド ID（推奨）またはスラッグでキー付けした `channels.discord.guilds` を設定し、チャンネルごとのルールを指定します。
10. 任意のネイティブコマンド: `commands.native` はデフォルトで `"auto"`（Discord/Telegram はオン、Slack はオフ）です。`channels.discord.commands.native: true|false|"auto"` で上書きできます。`false` は以前に登録したコマンドをクリアします。テキストコマンドは `commands.text` で制御され、単独の `/...` メッセージとして送る必要があります。コマンドのアクセスグループチェックをバイパスするには `commands.useAccessGroups: false` を使用します。
    - コマンド一覧 + 設定の詳細: [Slash commands](/tools/slash-commands)
11. 任意のギルド文脈履歴: メンションに返信する際に直近 N 件のギルドメッセージを文脈として含めるには `channels.discord.historyLimit`（デフォルト 20、`messages.groupChat.historyLimit` にフォールバック）を設定します。無効化するには `0` を設定します。
12. リアクション: エージェントは `discord` ツールでリアクションを実行できます（`channels.discord.actions.*` によりゲートされます）。
    - リアクション削除のセマンティクス: [/tools/reactions](/tools/reactions) を参照してください。
    - `discord` ツールは、現在のチャンネルが Discord の場合にのみ公開されます。
13. ネイティブコマンドは、共有の `main` セッションではなく、分離されたセッションキー（`agent:<agentId>:discord:slash:<userId>`）を使用します。

注: 名前 → ID の解決はギルドメンバー検索を使用し、Server Members Intent が必要です。ボットがメンバー検索できない場合は、ID または `<@id>` メンションを使用してください。  
注: スラッグは小文字で、スペースは `-` に置換されます。チャンネル名は先頭の `#` を除いた形でスラッグ化されます。  
注: ギルド文脈の `[from:]` 行には、Ping しやすい返信を容易にするために `author.tag` + `id` が含まれます。

## 設定書き込み

デフォルトでは、Discord は `/config set|unset` によってトリガーされる設定更新の書き込みを許可されています（`commands.config: true` が必要です）。

無効化するには:

```json5
{
  channels: { discord: { configWrites: false } },
}
```

## 独自のボットを作成する方法

これは、`#help` のようなサーバー（ギルド）チャンネルで OpenClaw を実行するための「Discord Developer Portal」設定です。

### 1) Discord アプリ + ボットユーザーを作成する

1. Discord Developer Portal → **Applications** → **New Application**
2. アプリ内で:
   - **Bot** → **Add Bot**
   - **Bot Token** をコピーします（これが `DISCORD_BOT_TOKEN` に入れるものです）

### 2) OpenClaw に必要な Gateway（ゲートウェイ）インテントを有効化する

Discord は「特権インテント」を明示的に有効化しない限りブロックします。

**Bot** → **Privileged Gateway Intents** で、以下を有効化します:

- **Message Content Intent**（ほとんどのギルドでメッセージ本文を読むために必須。無効だと「Used disallowed intents」が表示されるか、ボットは接続するがメッセージに反応しません）
- **Server Members Intent**（推奨。ギルド内の一部のメンバー/ユーザー検索および許可リスト照合に必須です）

通常 **Presence Intent** は不要です。ボット自身のプレゼンス設定（`setPresence` アクション）は Gateway（ゲートウェイ）OP3 を使用し、このインテントは不要です。このインテントが必要なのは、他のギルドメンバーのプレゼンス更新を受信したい場合のみです。

### 3) 招待 URL を生成する（OAuth2 URL Generator）

アプリ内: **OAuth2** → **URL Generator**

**Scopes**

- ✅ `bot`
- ✅ `applications.commands`（ネイティブコマンドに必須）

**Bot Permissions**（最小ベースライン）

- ✅ View Channels
- ✅ Send Messages
- ✅ Read Message History
- ✅ Embed Links
- ✅ Attach Files
- ✅ Add Reactions（任意ですが推奨）
- ✅ Use External Emojis / Stickers（任意。必要な場合のみ）

デバッグ中で完全にボットを信頼している場合を除き、**Administrator** は避けてください。

生成された URL をコピーして開き、サーバーを選択してボットをインストールします。

### 4) ID を取得する（ギルド/ユーザー/チャンネル）

Discord はあらゆる場所で数値 ID を使用します。OpenClaw 設定では ID が推奨です。

1. Discord（デスクトップ/ウェブ）→ **User Settings** → **Advanced** → **Developer Mode** を有効化します
2. 右クリック:
   - サーバー名 → **Copy Server ID**（ギルド ID）
   - チャンネル（例: `#help`）→ **Copy Channel ID**
   - 自分のユーザー → **Copy User ID**

### 5) OpenClaw を設定する

#### トークン

環境変数でボットトークンを設定します（サーバーでは推奨）:

- `DISCORD_BOT_TOKEN=...`

または設定で:

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "YOUR_BOT_TOKEN",
    },
  },
}
```

マルチアカウント対応: アカウントごとのトークンと任意の `name` に `channels.discord.accounts` を使用します。共有パターンは [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) を参照してください。

#### 許可リスト + チャンネルルーティング

例: 「単一サーバー、自分だけ許可、#help だけ許可」:

```json5
{
  channels: {
    discord: {
      enabled: true,
      dm: { enabled: false },
      guilds: {
        YOUR_GUILD_ID: {
          users: ["YOUR_USER_ID"],
          requireMention: true,
          channels: {
            help: { allow: true, requireMention: true },
          },
        },
      },
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

注:

- `requireMention: true` は、メンションされた場合にのみボットが返信することを意味します（共有チャンネルでは推奨）。
- `agents.list[].groupChat.mentionPatterns`（または `messages.groupChat.mentionPatterns`）も、ギルドメッセージにおけるメンションとして扱われます。
- マルチエージェントの上書き: `agents.list[].groupChat.mentionPatterns` にエージェントごとのパターンを設定します。
- `channels` が存在する場合、未掲載のチャンネルはデフォルトで拒否されます。
- すべてのチャンネルにデフォルトを適用するには `"*"` のチャンネルエントリを使用します。明示的なチャンネルエントリがワイルドカードを上書きします。
- スレッドは、スレッドのチャンネル ID を明示的に追加しない限り、親チャンネル設定（許可リスト、`requireMention`、Skills、プロンプトなど）を継承します。
- オーナーヒント: ギルドごと/チャンネルごとの `users` 許可リストが送信者にマッチすると、OpenClaw はその送信者をシステムプロンプト内でオーナーとして扱います。チャンネル横断でのグローバルオーナーは `commands.ownerAllowFrom` を設定します。
- ボットが作成したメッセージはデフォルトで無視されます。許可するには `channels.discord.allowBots=true` を設定します（自身のメッセージは引き続きフィルタされます）。
- 警告: 他ボットへの返信を許可する（`channels.discord.allowBots=true`）場合は、`requireMention`、`channels.discord.guilds.*.channels.<id>.users` の許可リスト、および/または `AGENTS.md` と `SOUL.md` のガードレールをクリアして、ボット同士の返信ループを防いでください。

### 6) 動作確認

1. Gateway（ゲートウェイ）を起動します。
2. サーバーチャンネルで、`@Krill hello`（またはボット名に応じて）を送信します。
3. 反応がない場合: 下の **トラブルシューティング** を確認してください。

### トラブルシューティング

- 最初に: `openclaw doctor` と `openclaw channels status --probe` を実行します（実行可能な警告 + クイック監査）。
- **「Used disallowed intents」**: Developer Portal で **Message Content Intent**（おそらく **Server Members Intent** も）を有効化し、Gateway（ゲートウェイ）を再起動します。
- **ボットは接続するが、ギルドチャンネルで一切返信しない**:
  - **Message Content Intent** が不足している、または
  - ボットにチャンネル権限（View/Send/Read History）がない、または
  - 設定でメンション必須になっていてメンションしていない、または
  - ギルド/チャンネルの許可リストがチャンネル/ユーザーを拒否している。
- **`requireMention: false` だが返信がない**:
- `channels.discord.groupPolicy` のデフォルトは **allowlist** です。`"open"` に設定するか、`channels.discord.guilds` 配下にギルドエントリを追加してください（必要に応じて `channels.discord.guilds.<id>.channels` 配下にチャンネルを列挙して制限します）。
  - `DISCORD_BOT_TOKEN` だけを設定し、`channels.discord` セクションを一度も作成しない場合、ランタイムは
    デフォルトで `groupPolicy` を `open` にします。`channels.discord.groupPolicy`、
    `channels.defaults.groupPolicy`、またはギルド/チャンネル許可リストを追加してロックダウンしてください。
- `requireMention` は `channels.discord.guilds` 配下（または特定チャンネル配下）に置く必要があります。トップレベルの `channels.discord.requireMention` は無視されます。
- **権限監査**（`channels status --probe`）は数値のチャンネル ID のみをチェックします。スラッグ/名前を `channels.discord.guilds.*.channels` キーとして使用している場合、監査は権限を検証できません。
- **ダイレクトメッセージが動かない**: `channels.discord.dm.enabled=false`、`channels.discord.dm.policy="disabled"`、または未承認（`channels.discord.dm.policy="pairing"`）です。
- **Discord での Exec 承認**: Discord はダイレクトメッセージ内の Exec 承認に **ボタン UI**（Allow once / Always allow / Deny）をサポートします。`/approve <id> ...` は転送された承認専用であり、Discord のボタンプロンプトは解決しません。`❌ Failed to submit approval: Error: unknown approval id` が表示される、または UI が表示されない場合は、以下を確認してください:
  - 設定内の `channels.discord.execApprovals.enabled: true`。
  - Discord ユーザー ID が `channels.discord.execApprovals.approvers` に含まれていること（UI は承認者にのみ送信されます）。
  - ダイレクトメッセージのプロンプトでボタン（**Allow once**、**Always allow**、**Deny**）を使用します。
  - 承認とコマンドフロー全体については、[Exec approvals](/tools/exec-approvals) と [Slash commands](/tools/slash-commands) を参照してください。

## 機能と制限

- ダイレクトメッセージとギルドのテキストチャンネル（スレッドは別チャンネルとして扱われます。音声は未対応）。
- タイピングインジケーターはベストエフォートで送信されます。メッセージの分割は `channels.discord.textChunkLimit`（デフォルト 2000）を使用し、行数（`channels.discord.maxLinesPerMessage`、デフォルト 17）で長文返信を分割します。
- 任意の改行分割: `channels.discord.chunkMode="newline"` を設定すると、長さ分割の前に空行（段落境界）で分割します。
- ファイルアップロードは、設定された `channels.discord.mediaMaxMb`（デフォルト 8 MB）まで対応します。
- ノイズの多いボットを避けるため、ギルド返信はデフォルトでメンションゲートです。
- メッセージが別のメッセージを参照している場合、返信コンテキストが注入されます（引用内容 + ID）。
- ネイティブの返信スレッドはデフォルトで **オフ** です。`channels.discord.replyToMode` と reply tag で有効化します。

## リトライポリシー

外向きの Discord API 呼び出しは、レート制限（429）時に Discord の `retry_after` が利用可能であればそれを使用し、指数バックオフ + ジッターでリトライします。`channels.discord.retry` で設定します。[Retry policy](/concepts/retry) を参照してください。

## 設定

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "abc.123",
      groupPolicy: "allowlist",
      guilds: {
        "*": {
          channels: {
            general: { allow: true },
          },
        },
      },
      mediaMaxMb: 8,
      actions: {
        reactions: true,
        stickers: true,
        emojiUploads: true,
        stickerUploads: true,
        polls: true,
        permissions: true,
        messages: true,
        threads: true,
        pins: true,
        search: true,
        memberInfo: true,
        roleInfo: true,
        roles: false,
        channelInfo: true,
        channels: true,
        voiceStatus: true,
        events: true,
        moderation: false,
        presence: false,
      },
      replyToMode: "off",
      dm: {
        enabled: true,
        policy: "pairing", // pairing | allowlist | open | disabled
        allowFrom: ["123456789012345678", "steipete"],
        groupEnabled: false,
        groupChannels: ["openclaw-dm"],
      },
      guilds: {
        "*": { requireMention: true },
        "123456789012345678": {
          slug: "friends-of-openclaw",
          requireMention: false,
          reactionNotifications: "own",
          users: ["987654321098765432", "steipete"],
          channels: {
            general: { allow: true },
            help: {
              allow: true,
              requireMention: true,
              users: ["987654321098765432"],
              skills: ["search", "docs"],
              systemPrompt: "Keep answers short.",
            },
          },
        },
      },
    },
  },
}
```

Ack リアクションは、`messages.ackReaction` +
`messages.ackReactionScope` によりグローバルに制御されます。ボットが返信した後に ack リアクションをクリアするには `messages.removeAckAfterReply` を使用します。

- `dm.enabled`: `false` を設定すると、すべてのダイレクトメッセージを無視します（デフォルト `true`）。
- `dm.policy`: ダイレクトメッセージのアクセス制御（`pairing` 推奨）。`"open"` には `dm.allowFrom=["*"]` が必要です。
- `dm.allowFrom`: ダイレクトメッセージ許可リスト（ユーザー ID または名前）。`dm.policy="allowlist"` によって使用され、`dm.policy="open"` の検証にも使用されます。ウィザードはユーザー名を受け付け、ボットがメンバー検索できる場合は ID に解決します。
- `dm.groupEnabled`: グループ DM を有効化します（デフォルト `false`）。
- `dm.groupChannels`: グループ DM のチャンネル ID またはスラッグに対する任意の許可リスト。
- `groupPolicy`: ギルドチャンネルの扱いを制御します（`open|disabled|allowlist`）。`allowlist` にはチャンネル許可リストが必要です。
- `guilds`: ギルド ID（推奨）またはスラッグでキー付けされた、ギルドごとのルール。
- `guilds."*"`: 明示的なエントリがない場合に適用される、ギルドごとのデフォルト設定。
- `guilds.<id>.slug`: 表示名に使用される任意のフレンドリーなスラッグ。
- `guilds.<id>.users`: 任意のギルドごとのユーザー許可リスト（ID または名前）。
- `guilds.<id>.tools`: チャンネル上書きがない場合に使用される、ギルドごとの任意のツールポリシー上書き（`allow`/`deny`/`alsoAllow`）。
- `guilds.<id>.toolsBySender`: ギルドレベルでの送信者ごとの任意のツールポリシー上書き（チャンネル上書きがない場合に適用。`"*"` ワイルドカード対応）。
- `guilds.<id>.channels.<channel>.allow`: `groupPolicy="allowlist"` のときにチャンネルを許可/拒否します。
- `guilds.<id>.channels.<channel>.requireMention`: チャンネルのメンションゲート。
- `guilds.<id>.channels.<channel>.tools`: チャンネルごとの任意のツールポリシー上書き（`allow`/`deny`/`alsoAllow`）。
- `guilds.<id>.channels.<channel>.toolsBySender`: チャンネル内での送信者ごとの任意のツールポリシー上書き（`"*"` ワイルドカード対応）。
- `guilds.<id>.channels.<channel>.users`: 任意のチャンネルごとのユーザー許可リスト。
- `guilds.<id>.channels.<channel>.skills`: Skills フィルター（省略 = すべての Skills、空 = なし）。
- `guilds.<id>.channels.<channel>.systemPrompt`: チャンネル用の追加システムプロンプト。Discord チャンネルトピックは **信頼できない** 文脈として注入されます（システムプロンプトではありません）。
- `guilds.<id>.channels.<channel>.enabled`: `false` を設定するとチャンネルを無効化します。
- `guilds.<id>.channels`: チャンネルルール（キーはチャンネルスラッグまたは ID）。
- `guilds.<id>.requireMention`: ギルドごとのメンション要件（チャンネルごとに上書き可能）。
- `guilds.<id>.reactionNotifications`: リアクションのシステムイベントモード（`off`、`own`、`all`、`allowlist`）。
- `textChunkLimit`: 外向きテキストのチャンクサイズ（文字数）。デフォルト: 2000。
- `chunkMode`: `length`（デフォルト）は `textChunkLimit` 超過時のみ分割します。`newline` は長さ分割の前に空行（段落境界）で分割します。
- `maxLinesPerMessage`: メッセージあたりのソフト最大行数。デフォルト: 17。
- `mediaMaxMb`: ディスクに保存する受信メディアのクランプ。
- `historyLimit`: メンションに返信する際に文脈として含める最近のギルドメッセージ数（デフォルト 20。`messages.groupChat.historyLimit` にフォールバック。`0` で無効化）。
- `dmHistoryLimit`: ユーザーターンにおけるダイレクトメッセージ履歴の上限。ユーザーごとの上書き: `dms["<user_id>"].historyLimit`。
- `retry`: 外向き Discord API 呼び出しのリトライポリシー（回数、minDelayMs、maxDelayMs、jitter）。
- `pluralkit`: PluralKit によるプロキシメッセージを解決し、システムメンバーが別個の送信者として見えるようにします。
- `actions`: アクションごとのツールゲート。省略するとすべて許可します（無効化するには `false` を設定します）。
  - `reactions`（react + read reactions をカバー）
  - `stickers`, `emojiUploads`, `stickerUploads`, `polls`, `permissions`, `messages`, `threads`, `pins`, `search`
  - `memberInfo`, `roleInfo`, `channelInfo`, `voiceStatus`, `events`
  - `channels`（チャンネル + カテゴリ + 権限の作成/編集/削除）
  - `roles`（ロール追加/削除、デフォルト `false`）
  - `moderation`（タイムアウト/キック/バン、デフォルト `false`）
  - `presence`（ボットのステータス/アクティビティ、デフォルト `false`）
- `execApprovals`: Discord 専用の exec 承認ダイレクトメッセージ（ボタン UI）。`enabled`、`approvers`、`agentFilter`、`sessionFilter` をサポートします。

リアクション通知は `guilds.<id>.reactionNotifications` を使用します:

- `off`: リアクションイベントなし。
- `own`: ボット自身のメッセージへのリアクション（デフォルト）。
- `all`: すべてのメッセージへのすべてのリアクション。
- `allowlist`: すべてのメッセージに対する `guilds.<id>.users` からのリアクション（空リストで無効化）。

### PluralKit（PK）サポート

PK ルックアップを有効化して、プロキシメッセージが基となるシステム + メンバーに解決されるようにします。  
有効化すると、OpenClaw は許可リストにメンバー ID を使用し、偶発的な Discord ping を避けるために送信者を `Member (PK:System)` としてラベル付けします。

```json5
{
  channels: {
    discord: {
      pluralkit: {
        enabled: true,
        token: "pk_live_...", // optional; required for private systems
      },
    },
  },
}
```

許可リストの注（PK 有効時）:

- `dm.allowFrom`、`guilds.<id>.users`、またはチャンネルごとの `users` で `pk:<memberId>` を使用します。
- メンバー表示名も名前/スラッグで照合されます。
- ルックアップは **元の** Discord メッセージ ID（プロキシ前メッセージ）を使用するため、PK API は 30 分のウィンドウ内でのみ解決します。
- PK ルックアップが失敗した場合（例: トークンなしの非公開システム）、プロキシメッセージはボットメッセージとして扱われ、`channels.discord.allowBots=true` でない限り破棄されます。

### ツールアクションのデフォルト

| アクショングループ | デフォルト | 注記                                             |
| ------------------ | ---------- | ------------------------------------------------ |
| reactions          | enabled    | React + list reactions + emojiList               |
| stickers           | enabled    | ステッカー送信                                   |
| emojiUploads       | enabled    | 絵文字アップロード                               |
| stickerUploads     | enabled    | ステッカーアップロード                           |
| polls              | enabled    | 投票作成                                         |
| permissions        | enabled    | チャンネル権限スナップショット                   |
| messages           | enabled    | 読み取り/送信/編集/削除                          |
| threads            | enabled    | 作成/一覧/返信                                   |
| pins               | enabled    | ピン留め/解除/一覧                               |
| search             | enabled    | メッセージ検索（プレビュー機能）                 |
| memberInfo         | enabled    | メンバー情報                                     |
| roleInfo           | enabled    | ロール一覧                                       |
| channelInfo        | enabled    | チャンネル情報 + 一覧                            |
| channels           | enabled    | チャンネル/カテゴリ管理                          |
| voiceStatus        | enabled    | ボイス状態の参照                                 |
| events             | enabled    | 予定イベントの一覧/作成                          |
| roles              | disabled   | ロール追加/削除                                  |
| moderation         | disabled   | タイムアウト/キック/バン                         |
| presence           | disabled   | ボットのステータス/アクティビティ（setPresence） |

- `replyToMode`: `off`（デフォルト）、`first`、または `all`。モデル出力に reply tag が含まれる場合にのみ適用されます。

## Reply tags

スレッド返信を要求するために、モデルは出力に 1 つのタグを含められます:

- `[[reply_to_current]]` — トリガーとなった Discord メッセージに返信します。
- `[[reply_to:<id>]]` — 文脈/履歴から特定のメッセージ ID に返信します。
  現在のメッセージ ID はプロンプトに `[message_id: …]` として付与されます。履歴エントリには既に ID が含まれています。

動作は `channels.discord.replyToMode` により制御されます:

- `off`: タグを無視します。
- `first`: 最初の外向きチャンク/添付のみが返信になります。
- `all`: すべての外向きチャンク/添付が返信になります。

許可リスト照合の注:

- `allowFrom`/`users`/`groupChannels` は、ID、名前、タグ、または `<@id>` のようなメンションを受け付けます。
- `discord:`/`user:`（ユーザー）や `channel:`（グループ DM）といったプレフィックスに対応しています。
- 送信者/チャンネルを無条件に許可するには `*` を使用します。
- `guilds.<id>.channels` が存在する場合、未掲載のチャンネルはデフォルトで拒否されます。
- `guilds.<id>.channels` が省略されている場合、許可リスト化されたギルド内のすべてのチャンネルが許可されます。
- **チャンネルを一切許可しない** 場合は `channels.discord.groupPolicy: "disabled"` を設定します（または空の許可リストのままにします）。
- 設定ウィザードは `Guild/Channel` 名（公開 + 非公開）を受け付け、可能であれば ID に解決します。
- 起動時に OpenClaw は許可リスト内のチャンネル/ユーザー名を ID に解決し（ボットがメンバー検索できる場合）、マッピングをログ出力します。解決できないエントリは入力どおり保持されます。

ネイティブコマンドの注:

- 登録されるコマンドは OpenClaw のチャットコマンドを反映します。
- ネイティブコマンドは、ダイレクトメッセージ/ギルドメッセージと同じ許可リスト（`channels.discord.dm.allowFrom`、`channels.discord.guilds`、チャンネルごとのルール）に従います。
- スラッシュコマンドは、許可リストに含まれないユーザーにも Discord UI 上で表示される場合があります。OpenClaw は実行時に許可リストを強制し、「not authorized」と返信します。

## ツールアクション

エージェントは、次のようなアクションで `discord` を呼び出せます:

- `react` / `reactions`（リアクションの追加または一覧）
- `sticker`, `poll`, `permissions`
- `readMessages`, `sendMessage`, `editMessage`, `deleteMessage`
- 読み取り/検索/ピンのツールペイロードには、正規化された `timestampMs`（UTC epoch ms）および `timestampUtc` が、生の Discord `timestamp` と併せて含まれます。
- `threadCreate`, `threadList`, `threadReply`
- `pinMessage`, `unpinMessage`, `listPins`
- `searchMessages`, `memberInfo`, `roleInfo`, `roleAdd`, `roleRemove`, `emojiList`
- `channelInfo`, `channelList`, `voiceStatus`, `eventList`, `eventCreate`
- `timeout`, `kick`, `ban`
- `setPresence`（ボットのアクティビティとオンラインステータス）

Discord メッセージ ID は注入される文脈（`[discord message id: …]` および履歴行）で提示され、エージェントがターゲット指定できるようになっています。  
絵文字は Unicode（例: `✅`）または `<:party_blob:1234567890>` のようなカスタム絵文字構文を使用できます。

## 安全性と運用

- ボットトークンはパスワードとして扱ってください。監督下のホストでは `DISCORD_BOT_TOKEN` 環境変数を優先するか、設定ファイルの権限をロックダウンしてください。
- ボットには必要な権限のみを付与してください（通常は Read/Send Messages）。
- ボットがスタックしている、またはレート制限されている場合は、他のプロセスが Discord セッションを所有していないことを確認した上で、Gateway（ゲートウェイ）（`openclaw gateway --force`）を再起動してください。
