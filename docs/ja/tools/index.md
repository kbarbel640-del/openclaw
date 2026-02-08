---
summary: "レガシーの `openclaw-*` skills を置き換える OpenClaw 向けエージェントツールのサーフェス（ブラウザー、キャンバス、ノード、メッセージ、cron）"
read_when:
  - エージェントツールを追加または変更する場合
  - `openclaw-*` skills を廃止または変更する場合
title: "ツール"
x-i18n:
  source_path: tools/index.md
  source_hash: 332c319afb6e65ad
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:14:17Z
---

# ツール（OpenClaw）

OpenClaw は、ブラウザー、キャンバス、ノード、cron 向けの **ファーストクラスのエージェントツール** を公開します。
これらは古い `openclaw-*` skills を置き換えます。ツールは型付けされており、シェル実行はなく、
エージェントはそれらを直接利用するべきです。

## ツールの無効化

`openclaw.json` の `tools.allow` / `tools.deny` により、ツールをグローバルに許可／拒否できます
（拒否が優先されます）。これにより、許可されていないツールがモデルプロバイダーへ送信されるのを防ぎます。

```json5
{
  tools: { deny: ["browser"] },
}
```

注記:

- マッチングは大文字・小文字を区別しません。
- `*` のワイルドカードがサポートされています（`"*"` は全ツールを意味します）。
- `tools.allow` が未知または未ロードのプラグインツール名のみを参照している場合、OpenClaw は警告をログに出し、許可リストを無視してコアツールが利用可能なままになるようにします。

## ツールプロファイル（ベース許可リスト）

`tools.profile` は、`tools.allow`/`tools.deny` の前に **ベースのツール許可リスト** を設定します。
エージェントごとの上書き: `agents.list[].tools.profile`。

プロファイル:

- `minimal`: `session_status` のみ
- `coding`: `group:fs`、`group:runtime`、`group:sessions`、`group:memory`、`image`
- `messaging`: `group:messaging`、`sessions_list`、`sessions_history`、`sessions_send`、`session_status`
- `full`: 制限なし（未設定と同じ）

例（デフォルトはメッセージングのみ、さらに Slack + Discord ツールも許可）:

```json5
{
  tools: {
    profile: "messaging",
    allow: ["slack", "discord"],
  },
}
```

例（coding プロファイルだが、どこでも exec/process を拒否）:

```json5
{
  tools: {
    profile: "coding",
    deny: ["group:runtime"],
  },
}
```

例（グローバルは coding プロファイル、サポートエージェントはメッセージングのみ）:

```json5
{
  tools: { profile: "coding" },
  agents: {
    list: [
      {
        id: "support",
        tools: { profile: "messaging", allow: ["slack"] },
      },
    ],
  },
}
```

## プロバイダー別ツールポリシー

`tools.byProvider` を使用して、グローバルのデフォルトを変更せずに、特定のプロバイダー
（または単一の `provider/model`）向けにツールを **さらに制限** できます。
エージェントごとの上書き: `agents.list[].tools.byProvider`。

これは、ベースツールプロファイルの **後**、許可／拒否リストの **前** に適用されるため、
ツールセットを狭めることしかできません。
プロバイダーキーは、`provider`（例: `google-antigravity`）または
`provider/model`（例: `openai/gpt-5.2`）のいずれかを受け付けます。

例（グローバルの coding プロファイルは維持しつつ、Google Antigravity には最小ツールのみ）:

```json5
{
  tools: {
    profile: "coding",
    byProvider: {
      "google-antigravity": { profile: "minimal" },
    },
  },
}
```

例（不安定なエンドポイント向けのプロバイダー／モデル別許可リスト）:

```json5
{
  tools: {
    allow: ["group:fs", "group:runtime", "sessions_list"],
    byProvider: {
      "openai/gpt-5.2": { allow: ["group:fs", "sessions_list"] },
    },
  },
}
```

例（単一プロバイダー向けのエージェント別上書き）:

```json5
{
  agents: {
    list: [
      {
        id: "support",
        tools: {
          byProvider: {
            "google-antigravity": { allow: ["message", "sessions_list"] },
          },
        },
      },
    ],
  },
}
```

## ツールグループ（ショートハンド）

ツールポリシー（グローバル、エージェント、サンドボックス）は、複数ツールへ展開される `group:*` エントリをサポートします。
これらを `tools.allow` / `tools.deny` で使用してください。

利用可能なグループ:

- `group:runtime`: `exec`、`bash`、`process`
- `group:fs`: `read`、`write`、`edit`、`apply_patch`
- `group:sessions`: `sessions_list`、`sessions_history`、`sessions_send`、`sessions_spawn`、`session_status`
- `group:memory`: `memory_search`、`memory_get`
- `group:web`: `web_search`、`web_fetch`
- `group:ui`: `browser`、`canvas`
- `group:automation`: `cron`、`gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: すべての組み込み OpenClaw ツール（プロバイダーのプラグインを除外）

例（ファイルツール + ブラウザーのみ許可）:

```json5
{
  tools: {
    allow: ["group:fs", "browser"],
  },
}
```

## プラグイン + ツール

プラグインは、コアセットを超えて **追加のツール**（および CLI コマンド）を登録できます。
インストール + 設定は [Plugins](/plugin) を参照し、ツール使用ガイダンスがどのようにプロンプトへ注入されるかは
[Skills](/tools/skills) を参照してください。一部のプラグインは、ツールに加えて独自の skills も同梱します
（例: 音声通話プラグイン）。

任意のプラグインツール:

- [Lobster](/tools/lobster): 再開可能な承認を備えた型付きワークフローランタイム（ゲートウェイホスト上に Lobster CLI が必要です）。
- [LLM Task](/tools/llm-task): 構造化されたワークフロー出力向けの JSON のみの LLM ステップ（任意でスキーマ検証）。

## ツール一覧

### `apply_patch`

1 つ以上のファイルに対して構造化パッチを適用します。複数ハンクの編集に使用します。
実験的: `tools.exec.applyPatch.enabled` で有効化してください（OpenAI モデルのみ）。

### `exec`

ワークスペースでシェルコマンドを実行します。

コアパラメーター:

- `command`（必須）
- `yieldMs`（タイムアウト後に自動でバックグラウンド化、デフォルト 10000）
- `background`（即時バックグラウンド化）
- `timeout`（秒。超過するとプロセスを kill、デフォルト 1800）
- `elevated`（bool。昇格モードが有効／許可されている場合にホスト上で実行。エージェントがサンドボックス化されている場合にのみ挙動が変わります）
- `host`（`sandbox | gateway | node`）
- `security`（`deny | allowlist | full`）
- `ask`（`off | on-miss | always`）
- `node`（`host=node` 用のノード id/name）
- 実 TTY が必要ですか？ `pty: true` を設定してください。

注記:

- バックグラウンド化されると、`sessionId` を含む `status: "running"` を返します。
- `process` を使用して、バックグラウンドセッションのポーリング／ログ／書き込み／kill／クリアを行います。
- `process` が拒否されている場合、`exec` は同期実行され、`yieldMs`/`background` を無視します。
- `elevated` は、`tools.elevated` と任意の `agents.list[].tools.elevated` 上書き（両方が許可する必要があります）によりゲートされ、`host=gateway` + `security=full` の別名です。
- `elevated` は、エージェントがサンドボックス化されている場合にのみ挙動が変わります（それ以外は no-op です）。
- `host=node` は macOS コンパニオンアプリまたはヘッドレスのノードホスト（`openclaw node run`）をターゲットにできます。
- ゲートウェイ／ノードの承認と許可リスト: [Exec approvals](/tools/exec-approvals)。

### `process`

バックグラウンド exec セッションを管理します。

コアアクション:

- `list`、`poll`、`log`、`write`、`kill`、`clear`、`remove`

注記:

- `poll` は、新しい出力と、完了時の終了ステータスを返します。
- `log` は行ベースの `offset`/`limit` をサポートします（最後の N 行を取得するには `offset` を省略します）。
- `process` はエージェントごとのスコープです。他のエージェントのセッションは表示されません。

### `web_search`

Brave Search API を使用して Web を検索します。

コアパラメーター:

- `query`（必須）
- `count`（1–10。デフォルトは `tools.web.search.maxResults` から取得）

注記:

- Brave API キーが必要です（推奨: `openclaw configure --section web`、または `BRAVE_API_KEY` を設定）。
- `tools.web.search.enabled` で有効化します。
- 応答はキャッシュされます（デフォルト 15 分）。
- セットアップは [Web tools](/tools/web) を参照してください。

### `web_fetch`

URL から読みやすいコンテンツを取得して抽出します（HTML → markdown/text）。

コアパラメーター:

- `url`（必須）
- `extractMode`（`markdown` | `text`）
- `maxChars`（長いページを切り詰め）

注記:

- `tools.web.fetch.enabled` で有効化します。
- `maxChars` は `tools.web.fetch.maxCharsCap`（デフォルト 50000）でクランプされます。
- 応答はキャッシュされます（デフォルト 15 分）。
- JS が多いサイトでは、ブラウザーツールを優先してください。
- セットアップは [Web tools](/tools/web) を参照してください。
- 任意のアンチボット・フォールバックは [Firecrawl](/tools/firecrawl) を参照してください。

### `browser`

専用の OpenClaw 管理ブラウザーを制御します。

コアアクション:

- `status`、`start`、`stop`、`tabs`、`open`、`focus`、`close`
- `snapshot`（aria/ai）
- `screenshot`（画像ブロック + `MEDIA:<path>` を返します）
- `act`（UI アクション: click/type/press/hover/drag/select/fill/resize/wait/evaluate）
- `navigate`、`console`、`pdf`、`upload`、`dialog`

プロファイル管理:

- `profiles` — ステータス付きで全ブラウザープロファイルを一覧表示
- `create-profile` — 自動割り当てポートで新規プロファイルを作成（または `cdpUrl`）
- `delete-profile` — ブラウザー停止、ユーザーデータ削除、設定から削除（ローカルのみ）
- `reset-profile` — プロファイルのポート上にある孤立プロセスを kill（ローカルのみ）

共通パラメーター:

- `profile`（任意。デフォルトは `browser.defaultProfile`）
- `target`（`sandbox` | `host` | `node`）
- `node`（任意。特定のノード id/name を選択）
  注記:
- `browser.enabled=true` が必要です（デフォルトは `true`。無効化するには `false` を設定）。
- 全アクションは、マルチインスタンス対応のため任意の `profile` パラメーターを受け付けます。
- `profile` を省略した場合、`browser.defaultProfile` を使用します（デフォルトは "chrome"）。
- プロファイル名: 小文字の英数字 + ハイフンのみ（最大 64 文字）。
- ポート範囲: 18800-18899（最大 ~100 プロファイル）。
- リモートプロファイルは attach のみです（start/stop/reset なし）。
- ブラウザー対応ノードが接続されている場合、ツールは自動的にそこへルーティングする場合があります（`target` を固定しない限り）。
- `snapshot` は Playwright がインストールされている場合に `ai` がデフォルトになります。アクセシビリティツリーには `aria` を使用してください。
- `snapshot` は、role-snapshot オプション（`interactive`、`compact`、`depth`、`selector`）もサポートし、`e12` のような ref を返します。
- `act` には、`snapshot` 由来の `ref` が必要です（AI スナップショット由来の数値 `12`、または role スナップショット由来の `e12`）。まれに CSS セレクターが必要な場合は `evaluate` を使用してください。
- デフォルトでは `act` → `wait` を避けてください。例外的な場合にのみ使用してください（待機できる信頼できる UI 状態がない場合）。
- `upload` は、武装後に自動クリックするために任意で `ref` を渡せます。
- `upload` は、`<input type="file">` を直接設定するために `inputRef`（aria ref）または `element`（CSS セレクター）もサポートします。

### `canvas`

ノード Canvas を操作します（present、eval、snapshot、A2UI）。

コアアクション:

- `present`、`hide`、`navigate`、`eval`
- `snapshot`（画像ブロック + `MEDIA:<path>` を返します）
- `a2ui_push`、`a2ui_reset`

注記:

- 内部的に gateway `node.invoke` を使用します。
- `node` が提供されない場合、ツールはデフォルトを選択します（単一の接続ノード、またはローカルの mac ノード）。
- A2UI は v0.8 のみです（`createSurface` なし）。CLI は v0.9 の JSONL を行エラーとして拒否します。
- クイックスモーク: `openclaw nodes canvas a2ui push --node <id> --text "Hello from A2UI"`。

### `nodes`

ペアリングされたノードを検出してターゲット指定し、通知を送信し、カメラ／画面をキャプチャします。

コアアクション:

- `status`、`describe`
- `pending`、`approve`、`reject`（ペアリング）
- `notify`（macOS `system.notify`）
- `run`（macOS `system.run`）
- `camera_snap`、`camera_clip`、`screen_record`
- `location_get`

注記:

- カメラ／画面コマンドには、ノードアプリがフォアグラウンドであることが必要です。
- 画像は画像ブロック + `MEDIA:<path>` を返します。
- 動画は `FILE:<path>`（mp4）を返します。
- 位置情報は JSON ペイロード（lat/lon/accuracy/timestamp）を返します。
- `run` のパラメーター: `command` argv 配列。任意の `cwd`、`env`（`KEY=VAL`）、`commandTimeoutMs`、`invokeTimeoutMs`、`needsScreenRecording`。

例（`run`）:

```json
{
  "action": "run",
  "node": "office-mac",
  "command": ["echo", "Hello"],
  "env": ["FOO=bar"],
  "commandTimeoutMs": 12000,
  "invokeTimeoutMs": 45000,
  "needsScreenRecording": false
}
```

### `image`

設定された画像モデルで画像を分析します。

コアパラメーター:

- `image`（必須。パスまたは URL）
- `prompt`（任意。デフォルトは "Describe the image."）
- `model`（任意の上書き）
- `maxBytesMb`（任意のサイズ上限）

注記:

- `agents.defaults.imageModel` が設定されている場合（primary または fallbacks）、またはデフォルトモデル + 設定された認証情報から暗黙の画像モデルを推定できる場合にのみ利用できます（ベストエフォートのペアリング）。
- 画像モデルを直接使用します（メインのチャットモデルとは独立）。

### `message`

Discord/Google Chat/Slack/Telegram/WhatsApp/Signal/iMessage/MS Teams を横断してメッセージとチャンネルアクションを送信します。

コアアクション:

- `send`（テキスト + 任意のメディア。MS Teams は Adaptive Cards 用に `card` もサポートします）
- `poll`（WhatsApp/Discord/MS Teams の投票）
- `react` / `reactions` / `read` / `edit` / `delete`
- `pin` / `unpin` / `list-pins`
- `permissions`
- `thread-create` / `thread-list` / `thread-reply`
- `search`
- `sticker`
- `member-info` / `role-info`
- `emoji-list` / `emoji-upload` / `sticker-upload`
- `role-add` / `role-remove`
- `channel-info` / `channel-list`
- `voice-status`
- `event-list` / `event-create`
- `timeout` / `kick` / `ban`

注記:

- `send` は WhatsApp を Gateway（ゲートウェイ）経由でルーティングし、他のチャンネルは直接送信します。
- `poll` は WhatsApp と MS Teams に Gateway（ゲートウェイ）を使用します。Discord の投票は直接送信します。
- メッセージツール呼び出しがアクティブなチャットセッションにバインドされている場合、送信はコンテキスト間リークを避けるために、そのセッションのターゲットに制約されます。

### `cron`

Gateway（ゲートウェイ）の cron ジョブと wakeup を管理します。

コアアクション:

- `status`、`list`
- `add`、`update`、`remove`、`run`、`runs`
- `wake`（システムイベントをキュー投入 + 任意の即時ハートビート）

注記:

- `add` は完全な cron ジョブオブジェクトを期待します（`cron.add` RPC と同一スキーマ）。
- `update` は `{ id, patch }` を使用します。

### `gateway`

実行中の Gateway（ゲートウェイ）プロセスを再起動、または更新を適用します（インプレース）。

コアアクション:

- `restart`（認可 + `SIGUSR1` を送信してプロセス内再起動。`openclaw gateway` はインプレース再起動）
- `config.get` / `config.schema`
- `config.apply`（検証 + 設定の書き込み + 再起動 + wake）
- `config.patch`（部分更新のマージ + 再起動 + wake）
- `update.run`（更新の実行 + 再起動 + wake）

注記:

- インフライトの返信を中断しないように、`delayMs`（デフォルト 2000）を使用してください。
- `restart` はデフォルトで無効です。`commands.restart: true` で有効化してください。

### `sessions_list` / `sessions_history` / `sessions_send` / `sessions_spawn` / `session_status`

セッション一覧、トランスクリプト履歴の検査、または別セッションへの送信を行います。

コアパラメーター:

- `sessions_list`: `kinds?`、`limit?`、`activeMinutes?`、`messageLimit?`（0 = なし）
- `sessions_history`: `sessionKey`（または `sessionId`）、`limit?`、`includeTools?`
- `sessions_send`: `sessionKey`（または `sessionId`）、`message`、`timeoutSeconds?`（0 = fire-and-forget）
- `sessions_spawn`: `task`、`label?`、`agentId?`、`model?`、`runTimeoutSeconds?`、`cleanup?`
- `session_status`: `sessionKey?`（デフォルトは current。`sessionId` を受け付けます）、`model?`（`default` が上書きをクリアします）

注記:

- `main` は正規のダイレクトチャットキーです。global/unknown は非表示になります。
- `messageLimit > 0` はセッションごとに最後の N 件のメッセージを取得します（ツールメッセージはフィルタリング）。
- `sessions_send` は `timeoutSeconds > 0` の場合に最終完了まで待機します。
- 配信／アナウンスは完了後に行われ、ベストエフォートです。`status: "ok"` はアナウンスが配信されたことではなく、エージェント実行が完了したことを確認します。
- `sessions_spawn` はサブエージェント実行を開始し、リクエスターのチャットへアナウンス返信を投稿します。
- `sessions_spawn` はノンブロッキングで、`status: "accepted"` を即時返します。
- `sessions_send` は reply‑back の ping‑pong を実行します（停止するには `REPLY_SKIP` に返信。最大ターン数は `session.agentToAgent.maxPingPongTurns` で、0–5）。
- ping‑pong の後、ターゲットエージェントは **アナウンスステップ** を実行します。アナウンスを抑止するには `ANNOUNCE_SKIP` に返信してください。

### `agents_list`

現在のセッションが `sessions_spawn` でターゲットにできるエージェント id を一覧表示します。

注記:

- 結果はエージェントごとの許可リスト（`agents.list[].subagents.allowAgents`）により制限されます。
- `["*"]` が設定されている場合、このツールは設定済みのすべてのエージェントを含め、`allowAny: true` をマークします。

## パラメーター（共通）

Gateway（ゲートウェイ）バックのツール（`canvas`、`nodes`、`cron`）:

- `gatewayUrl`（デフォルト `ws://127.0.0.1:18789`）
- `gatewayToken`（認証が有効な場合）
- `timeoutMs`

注記: `gatewayUrl` が設定されている場合、`gatewayToken` を明示的に含めてください。ツールは上書きに対して設定
または環境変数の認証情報を継承しません。明示的な認証情報が欠けていることはエラーです。

ブラウザーツール:

- `profile`（任意。デフォルトは `browser.defaultProfile`）
- `target`（`sandbox` | `host` | `node`）
- `node`（任意。特定のノード id/name を固定）

## 推奨されるエージェントフロー

ブラウザー自動化:

1. `browser` → `status` / `start`
2. `snapshot`（ai または aria）
3. `act`（click/type/press）
4. 視覚的な確認が必要であれば `screenshot`

Canvas レンダー:

1. `canvas` → `present`
2. `a2ui_push`（任意）
3. `snapshot`

ノードターゲティング:

1. `nodes` → `status`
2. 選択したノード上で `describe`
3. `notify` / `run` / `camera_snap` / `screen_record`

## 安全性

- 直接の `system.run` は避け、明示的なユーザー同意がある場合にのみ `nodes` → `run` を使用してください。
- カメラ／画面キャプチャに関するユーザー同意を尊重してください。
- メディアコマンドを呼び出す前に、`status/describe` を使用して権限を確保してください。

## ツールがエージェントに提示される方法

ツールは、2 つの並列チャネルで公開されます:

1. **システムプロンプトのテキスト**: 人間が読める一覧 + ガイダンス。
2. **ツールスキーマ**: モデル API に送信される構造化された関数定義。

つまり、エージェントは「存在するツール」と「呼び出し方」の両方を見ます。ツールが
システムプロンプトにもスキーマにも現れない場合、モデルはそれを呼び出せません。
