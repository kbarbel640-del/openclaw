---
summary: "スラッシュコマンド: テキスト vs ネイティブ、設定、対応コマンド"
read_when:
  - チャットコマンドを使用または設定するとき
  - コマンドのルーティングや権限をデバッグするとき
title: "スラッシュコマンド"
x-i18n:
  source_path: tools/slash-commands.md
  source_hash: ca0deebf89518e8c
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:25Z
---

# スラッシュコマンド

コマンドは Gateway（ゲートウェイ）によって処理されます。ほとんどのコマンドは、`/` で始まる **単独** のメッセージとして送信する必要があります。  
ホスト専用の bash チャットコマンドは `! <cmd>` を使用します（`/bash <cmd>` をエイリアスとして使用できます）。

関連する 2 つのシステムがあります。

- **コマンド**: 単独の `/...` メッセージです。
- **ディレクティブ**: `/think`、`/verbose`、`/reasoning`、`/elevated`、`/exec`、`/model`、`/queue` です。
  - ディレクティブは、モデルがメッセージを見る前にメッセージから取り除かれます。
  - 通常のチャットメッセージ（ディレクティブのみではない）では、「インラインヒント」として扱われ、セッション設定を永続化し**ません**。
  - ディレクティブのみのメッセージ（メッセージがディレクティブだけを含む）では、セッションに永続化され、確認応答を返します。
  - ディレクティブは **許可された送信者** に対してのみ適用されます（チャンネルの許可リスト/ペアリングに加えて `commands.useAccessGroups`）。
    許可されていない送信者では、ディレクティブはプレーンテキストとして扱われます。

また、いくつかの **インラインショートカット** もあります（許可リスト登録/認可済み送信者のみ）: `/help`、`/commands`、`/status`、`/whoami`（`/id`）。  
これらは即時に実行され、モデルがメッセージを見る前に取り除かれ、残りのテキストは通常のフローで処理されます。

## 設定

```json5
{
  commands: {
    native: "auto",
    nativeSkills: "auto",
    text: true,
    bash: false,
    bashForegroundMs: 2000,
    config: false,
    debug: false,
    restart: false,
    useAccessGroups: true,
  },
}
```

- `commands.text`（デフォルト `true`）は、チャットメッセージ内の `/...` の解析を有効化します。
  - ネイティブコマンドがないサーフェス（WhatsApp/WebChat/Signal/iMessage/Google Chat/MS Teams）では、これを `false` に設定してもテキストコマンドは動作します。
- `commands.native`（デフォルト `"auto"`）は、ネイティブコマンドを登録します。
  - Auto: Discord/Telegram ではオン、Slack ではオフ（スラッシュコマンドを追加するまで）、ネイティブ非対応のプロバイダーでは無視されます。
  - `channels.discord.commands.native`、`channels.telegram.commands.native`、または `channels.slack.commands.native` を設定して、プロバイダーごとに上書きできます（bool または `"auto"`）。
  - `false` は起動時に、Discord/Telegram で以前に登録したコマンドをクリアします。Slack のコマンドは Slack アプリ側で管理され、自動では削除されません。
- `commands.nativeSkills`（デフォルト `"auto"`）は、対応時に **スキル** コマンドをネイティブで登録します。
  - Auto: Discord/Telegram ではオン、Slack ではオフ（Slack はスキルごとにスラッシュコマンドを作成する必要があります）。
  - `channels.discord.commands.nativeSkills`、`channels.telegram.commands.nativeSkills`、または `channels.slack.commands.nativeSkills` を設定して、プロバイダーごとに上書きできます（bool または `"auto"`）。
- `commands.bash`（デフォルト `false`）は、`! <cmd>` がホストのシェルコマンドを実行することを有効化します（`/bash <cmd>` はエイリアスです。`tools.elevated` の許可リストが必要です）。
- `commands.bashForegroundMs`（デフォルト `2000`）は、bash がバックグラウンドモードへ切り替える前に待機する時間を制御します（`0` は即時にバックグラウンド化します）。
- `commands.config`（デフォルト `false`）は、`/config` を有効化します（`openclaw.json` を読み書きします）。
- `commands.debug`（デフォルト `false`）は、`/debug` を有効化します（実行時のみの上書き）。
- `commands.useAccessGroups`（デフォルト `true`）は、コマンドに対して許可リスト/ポリシーを強制します。

## コマンド一覧

テキスト + ネイティブ（有効時）:

- `/help`
- `/commands`
- `/skill <name> [input]`（名前でスキルを実行）
- `/status`（現在のステータスを表示。利用可能な場合、現在のモデルプロバイダーに対するプロバイダーの使用量/クォータを含む）
- `/allowlist`（許可リストのエントリーを一覧/追加/削除）
- `/approve <id> allow-once|allow-always|deny`（exec 承認プロンプトを解決）
- `/context [list|detail|json]`（「コンテキスト」を説明。`detail` はファイルごと + ツールごと + スキルごと + システムプロンプトのサイズを表示）
- `/whoami`（送信者 ID を表示。エイリアス: `/id`）
- `/subagents list|stop|log|info|send`（現在のセッションに対するサブエージェント実行の調査、停止、ログ、またはメッセージ送信）
- `/config show|get|set|unset`（ディスクへ設定を永続化。オーナー専用。`commands.config: true` が必要）
- `/debug show|set|unset|reset`（実行時上書き。オーナー専用。`commands.debug: true` が必要）
- `/usage off|tokens|full|cost`（レスポンスごとの使用量フッター、またはローカルコストのサマリー）
- `/tts off|always|inbound|tagged|status|provider|limit|summary|audio`（TTS を制御。[/tts](/tts) を参照）
  - Discord: ネイティブコマンドは `/voice` です（Discord は `/tts` を予約しています）。テキストの `/tts` は引き続き動作します。
- `/stop`
- `/restart`
- `/dock-telegram`（エイリアス: `/dock_telegram`）（返信先を Telegram に切り替え）
- `/dock-discord`（エイリアス: `/dock_discord`）（返信先を Discord に切り替え）
- `/dock-slack`（エイリアス: `/dock_slack`）（返信先を Slack に切り替え）
- `/activation mention|always`（グループのみ）
- `/send on|off|inherit`（オーナー専用）
- `/reset` または `/new [model]`（任意のモデルヒント。残りはそのまま渡されます）
- `/think <off|minimal|low|medium|high|xhigh>`（モデル/プロバイダーによる動的選択。エイリアス: `/thinking`、`/t`）
- `/verbose on|full|off`（エイリアス: `/v`）
- `/reasoning on|off|stream`（エイリアス: `/reason`。オンのとき、`Reasoning:` を付けた別メッセージを送信。`stream` = Telegram の下書きのみ）
- `/elevated on|off|ask|full`（エイリアス: `/elev`。`full` は exec 承認をスキップ）
- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>`（現在の内容を表示するには `/exec` を送信）
- `/model <name>`（エイリアス: `/models`。または `agents.defaults.models.*.alias` からの `/<alias>`）
- `/queue <mode>`（`debounce:2s cap:25 drop:summarize` のようなオプション付き。現在の設定を表示するには `/queue` を送信）
- `/bash <command>`（ホスト専用。`! <command>` のエイリアス。`commands.bash: true` + `tools.elevated` の許可リストが必要）

テキストのみ:

- `/compact [instructions]`（[/concepts/compaction](/concepts/compaction) を参照）
- `! <command>`（ホスト専用。一度に 1 つ。長時間ジョブには `!poll` + `!stop` を使用）
- `!poll`（出力/ステータスを確認。任意の `sessionId` を受け付けます。`/bash poll` も動作します）
- `!stop`（実行中の bash ジョブを停止。任意の `sessionId` を受け付けます。`/bash stop` も動作します）

注記:

- コマンドは、コマンドと引数の間に任意の `:` を受け付けます（例: `/think: high`、`/send: on`、`/help:`）。
- `/new <model>` はモデルエイリアス、`provider/model`、またはプロバイダー名（あいまい一致）を受け付けます。一致しない場合、テキストはメッセージ本文として扱われます。
- プロバイダー使用量の完全な内訳については、`openclaw status --usage` を使用します。
- `/allowlist add|remove` には `commands.config=true` が必要で、チャンネルの `configWrites` を尊重します。
- `/usage` はレスポンスごとの使用量フッターを制御します。`/usage cost` は OpenClaw セッションログからローカルコストのサマリーを出力します。
- `/restart` はデフォルトで無効です。有効化するには `commands.restart: true` を設定してください。
- `/verbose` はデバッグと可視性向上のためのものです。通常利用では **オフ** のままにしてください。
- `/reasoning`（および `/verbose`）はグループ環境では危険です。意図せず内部推論やツール出力を公開してしまう可能性があります。特にグループチャットでは、オフのままにすることを推奨します。
- **ファストパス:** 許可リスト登録済み送信者からのコマンドのみメッセージは即時に処理されます（キュー + モデルをバイパス）。
- **グループメンションのゲーティング:** 許可リスト登録済み送信者からのコマンドのみメッセージは、メンション要件をバイパスします。
- **インラインショートカット（許可リスト登録済み送信者のみ）:** 一部のコマンドは通常メッセージに埋め込んでも動作し、モデルが残りのテキストを見る前に取り除かれます。
  - 例: `hey /status` はステータス返信をトリガーし、残りのテキストは通常のフローで処理されます。
- 現在: `/help`、`/commands`、`/status`、`/whoami`（`/id`）。
- 許可されていないコマンドのみメッセージは黙って無視され、インラインの `/...` トークンはプレーンテキストとして扱われます。
- **スキルコマンド:** `user-invocable` のスキルはスラッシュコマンドとして公開されます。名前は `a-z0-9_` にサニタイズされます（最大 32 文字）。衝突した場合は数値サフィックスが付きます（例: `_2`）。
  - `/skill <name> [input]` は名前でスキルを実行します（ネイティブコマンドの制限によりスキルごとのコマンドを作成できない場合に有用です）。
  - デフォルトでは、スキルコマンドは通常リクエストとしてモデルへ転送されます。
  - Skills は、コマンドをツールへ直接ルーティングするために任意で `command-dispatch: tool` を宣言できます（決定的、モデルなし）。
  - 例: `/prose`（OpenProse プラグイン）— [OpenProse](/prose) を参照。
- **ネイティブコマンドの引数:** Discord は動的オプションにオートコンプリートを使用します（必須引数を省略した場合はボタンメニューも使用します）。Telegram と Slack は、コマンドが選択肢をサポートしていて引数を省略した場合にボタンメニューを表示します。

## 利用サーフェス（どこに何が表示されるか）

- **プロバイダー使用量/クォータ**（例: 「Claude 80% left」）は、使用量トラッキングが有効な場合、現在のモデルプロバイダーに対して `/status` に表示されます。
- **レスポンスごとのトークン/コスト** は `/usage off|tokens|full` によって制御されます（通常返信の末尾に追加）。
- `/model status` は使用量ではなく、**モデル/認証/エンドポイント** に関するものです。

## モデル選択（`/model`）

`/model` はディレクティブとして実装されています。

例:

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model opus@anthropic:default
/model status
```

注記:

- `/model` と `/model list` は、コンパクトな番号付きピッカー（モデルファミリー + 利用可能なプロバイダー）を表示します。
- `/model <#>` はそのピッカーから選択します（可能な場合は現在のプロバイダーを優先します）。
- `/model status` は詳細ビューを表示します。利用可能な場合、設定済みプロバイダーエンドポイント（`baseUrl`）と API モード（`api`）を含みます。

## デバッグ用上書き

`/debug` により、**実行時のみ** の設定上書き（メモリのみ、ディスクには書かない）を設定できます。オーナー専用。デフォルトで無効です。`commands.debug: true` で有効化してください。

例:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug set channels.whatsapp.allowFrom=["+1555","+4477"]
/debug unset messages.responsePrefix
/debug reset
```

注記:

- 上書きは新しい設定読み取りに即時適用されますが、`openclaw.json` へ書き込みは**しません**。
- すべての上書きをクリアしてディスク上の設定に戻すには、`/debug reset` を使用します。

## 設定更新

`/config` はディスク上の設定（`openclaw.json`）に書き込みます。オーナー専用。デフォルトで無効です。`commands.config: true` で有効化してください。

例:

```
/config show
/config show messages.responsePrefix
/config get messages.responsePrefix
/config set messages.responsePrefix="[openclaw]"
/config unset messages.responsePrefix
```

注記:

- 書き込み前に設定が検証されます。不正な変更は拒否されます。
- `/config` の更新は再起動後も保持されます。

## サーフェスの注記

- **テキストコマンド** は通常のチャットセッションで実行されます（ダイレクトメッセージは `main` を共有し、グループは独自のセッションを持ちます）。
- **ネイティブコマンド** は分離されたセッションを使用します。
  - Discord: `agent:<agentId>:discord:slash:<userId>`
  - Slack: `agent:<agentId>:slack:slash:<userId>`（プレフィックスは `channels.slack.slashCommand.sessionPrefix` で設定可能）
  - Telegram: `telegram:slash:<userId>`（`CommandTargetSessionKey` によりチャットセッションをターゲット）
- **`/stop`** はアクティブなチャットセッションをターゲットにするため、現在の実行を中断できます。
- **Slack:** `channels.slack.slashCommand` は、単一の `/openclaw` スタイルのコマンドとして引き続きサポートされます。`commands.native` を有効化する場合、組み込みコマンドごとに Slack のスラッシュコマンドを 1 つ作成する必要があります（名前は `/help` と同一）。Slack 向けのコマンド引数メニューは、エフェメラルな Block Kit ボタンとして配信されます。
