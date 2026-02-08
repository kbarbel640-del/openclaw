---
summary: "Gateway（ゲートウェイ）スケジューラー向けの Cron ジョブ + ウェイクアップ"
read_when:
  - バックグラウンドジョブまたはウェイクアップをスケジューリングする場合
  - ハートビートと一緒に、またはハートビートに沿って実行すべき自動化を配線する場合
  - スケジュールされたタスクでハートビートと Cron のどちらにするかを決める場合
title: "Cron ジョブ"
x-i18n:
  source_path: automation/cron-jobs.md
  source_hash: 523721a7da2c4e27
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:42:35Z
---

# Cron ジョブ（Gateway（ゲートウェイ）スケジューラー）

> **Cron と Heartbeat のどちらですか？** 使い分けの指針は、[Cron vs Heartbeat](/automation/cron-vs-heartbeat) を参照してください。

Cron は Gateway（ゲートウェイ）組み込みのスケジューラーです。ジョブを永続化し、適切なタイミングでエージェントを起こし、必要に応じて出力をチャットへ返すこともできます。

「毎朝これを実行する」や「20 分後にエージェントを突く」といった用途では、cron がその仕組みです。

## TL;DR

- Cron は **Gateway（ゲートウェイ）内**（モデル内ではありません）で動作します。
- ジョブは `~/.openclaw/cron/` 配下に永続化されるため、再起動してもスケジュールが失われません。
- 実行スタイルは 2 種類です:
  - **メインセッション**: システムイベントをキューに投入し、その後の次のハートビートで実行します。
  - **分離**: `cron:<jobId>` で専用のエージェントターンを実行し、配信（既定では announce、または none）します。
- ウェイクアップは第一級です: ジョブは「今すぐ起こす」か「次のハートビート」を要求できます。

## クイックスタート（実行可能）

ワンショットのリマインダーを作成し、存在を確認して、即時実行します:

```bash
openclaw cron add \
  --name "Reminder" \
  --at "2026-02-01T16:00:00Z" \
  --session main \
  --system-event "Reminder: check the cron docs draft" \
  --wake now \
  --delete-after-run

openclaw cron list
openclaw cron run <job-id> --force
openclaw cron runs --id <job-id>
```

配信付きの繰り返し分離ジョブをスケジュールします:

```bash
openclaw cron add \
  --name "Morning brief" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize overnight updates." \
  --announce \
  --channel slack \
  --to "channel:C1234567890"
```

## ツール呼び出しの等価（Gateway（ゲートウェイ）の cron ツール）

正規の JSON 形状と例については、[ツール呼び出しの JSON スキーマ](/automation/cron-jobs#json-schema-for-tool-calls) を参照してください。

## cron ジョブの保存先

cron ジョブは、既定では Gateway（ゲートウェイ）ホスト上の `~/.openclaw/cron/jobs.json` に永続化されます。
Gateway（ゲートウェイ）はファイルをメモリに読み込み、変更時に書き戻すため、手動編集が安全なのは Gateway（ゲートウェイ）が停止しているときのみです。変更には `openclaw cron add/edit` または cron ツール呼び出し API を推奨します。

## 初心者向けの概要

cron ジョブは、**いつ** 実行するか + **何** を行うか、と考えてください。

1. **スケジュールを選ぶ**
   - ワンショットのリマインダー → `schedule.kind = "at"`（CLI: `--at`）
   - 繰り返しジョブ → `schedule.kind = "every"` または `schedule.kind = "cron"`
   - ISO タイムスタンプがタイムゾーンを省略している場合、**UTC** として扱われます。

2. **どこで実行するかを選ぶ**
   - `sessionTarget: "main"` → メインコンテキストで次のハートビート中に実行します。
   - `sessionTarget: "isolated"` → `cron:<jobId>` で専用のエージェントターンを実行します。

3. **ペイロードを選ぶ**
   - メインセッション → `payload.kind = "systemEvent"`
   - 分離セッション → `payload.kind = "agentTurn"`

任意: ワンショットジョブ（`schedule.kind = "at"`）は、既定では成功後に削除されます。保持するには `deleteAfterRun: false` を設定してください（成功後に無効化されます）。

## 概念

### ジョブ

cron ジョブは次を持つ保存レコードです:

- **スケジュール**（いつ実行すべきか）
- **ペイロード**（何をすべきか）
- 任意の **配信モード**（announce または none）
- 任意の **エージェントバインディング**（`agentId`）: 特定のエージェントの下でジョブを実行します。未指定または不明な場合、ゲートウェイは既定のエージェントにフォールバックします。

ジョブは安定した `jobId`（CLI/Gateway（ゲートウェイ）API で使用）で識別されます。
エージェントのツール呼び出しでは `jobId` が正規であり、互換性のためにレガシーの `id` も受け付けます。
ワンショットジョブは既定で成功後に自動削除されます。保持するには `deleteAfterRun: false` を設定してください。

### スケジュール

cron は 3 種類のスケジュールをサポートします:

- `at`: `schedule.at`（ISO 8601）によるワンショットのタイムスタンプ
- `every`: 固定間隔（ms）
- `cron`: IANA タイムゾーン（任意）付きの 5 フィールド cron 式

cron 式は `croner` を使用します。タイムゾーンが省略された場合は、Gateway（ゲートウェイ）ホストのローカルタイムゾーンが使用されます。

### メイン実行と分離実行

#### メインセッションジョブ（システムイベント）

メインジョブはシステムイベントをキューに投入し、必要に応じてハートビートランナーを起こします。
`payload.kind = "systemEvent"` を使用する必要があります。

- `wakeMode: "next-heartbeat"`（既定）: イベントは次のスケジュールされたハートビートを待ちます。
- `wakeMode: "now"`: イベントは即時のハートビート実行をトリガーします。

通常のハートビートプロンプト + メインセッションコンテキストが欲しい場合に最適です。
[Heartbeat](/gateway/heartbeat) も参照してください。

#### 分離ジョブ（専用の cron セッション）

分離ジョブは、セッション `cron:<jobId>` で専用のエージェントターンを実行します。

主な挙動:

- 追跡可能性のため、プロンプトの先頭に `[cron:<jobId> <job name>]` が付与されます。
- 各実行は **新しいセッション id**（過去の会話の持ち越しなし）で開始します。
- 既定の挙動: `delivery` が省略されると、分離ジョブは要約を announce します（`delivery.mode = "announce"`）。
- `delivery.mode`（分離専用）が挙動を選択します:
  - `announce`: 対象チャンネルへ要約を配信し、メインセッションにも短い要約を投稿します。
  - `none`: 内部のみ（配信なし、メインセッション要約なし）。
- `wakeMode` は、メインセッション要約が投稿されるタイミングを制御します:
  - `now`: 即時のハートビート。
  - `next-heartbeat`: 次のスケジュールされたハートビートを待ちます。

メインのチャット履歴をスパムしたくない、ノイジーで頻繁な処理や「バックグラウンドの雑務」には分離ジョブを使用してください。

### ペイロード形状（実行されるもの）

サポートされるペイロードは 2 種類です:

- `systemEvent`: メインセッション専用で、ハートビートプロンプト経由でルーティングされます。
- `agentTurn`: 分離セッション専用で、専用のエージェントターンを実行します。

共通の `agentTurn` フィールド:

- `message`: 必須のテキストプロンプト
- `model` / `thinking`: 任意の上書き（下記参照）
- `timeoutSeconds`: 任意のタイムアウト上書き

配信設定（分離ジョブのみ）:

- `delivery.mode`: `none` | `announce`。
- `delivery.channel`: `last` または特定のチャンネル。
- `delivery.to`: チャンネル固有の対象（phone/chat/channel id）。
- `delivery.bestEffort`: announce 配信が失敗してもジョブを失敗扱いにしない。

announce 配信は、その実行でのメッセージングツール送信を抑止します。代わりに `delivery.channel`/`delivery.to` を使用してチャットをターゲットにしてください。`delivery.mode = "none"` の場合、メインセッションへ要約は投稿されません。

分離ジョブで `delivery` が省略された場合、OpenClaw は既定で `announce` を使用します。

#### announce 配信フロー

`delivery.mode = "announce"` の場合、cron はアウトバウンドのチャンネルアダプター経由で直接配信します。
メインエージェントは、メッセージの作成や転送のために起動されません。

挙動の詳細:

- コンテンツ: 配信は、分離実行のアウトバウンドペイロード（テキスト/メディア）を、通常のチャンク分割とチャンネル整形で使用します。
- ハートビートのみの応答（実質的なコンテンツがない `HEARTBEAT_OK`）は配信されません。
- 分離実行がメッセージツール経由で同じターゲットに既に送信している場合、重複を避けるため配信はスキップされます。
- 配信ターゲットの欠落または不正は、`delivery.bestEffort = true` でない限りジョブを失敗させます。
- メインセッションへの短い要約は、`delivery.mode = "announce"` の場合にのみ投稿されます。
- メインセッション要約は `wakeMode` を尊重します: `now` は即時のハートビートをトリガーし、`next-heartbeat` は次のスケジュールされたハートビートを待ちます。

### モデルおよび thinking の上書き

分離ジョブ（`agentTurn`）では、モデルと thinking レベルを上書きできます:

- `model`: プロバイダー/モデル文字列（例: `anthropic/claude-sonnet-4-20250514`）またはエイリアス（例: `opus`）
- `thinking`: Thinking レベル（`off`、`minimal`、`low`、`medium`、`high`、`xhigh`; GPT-5.2 + Codex モデルのみ）

注: メインセッションジョブでも `model` を設定できますが、共有のメインセッションモデルが変更されます。予期しないコンテキストの変化を避けるため、モデル上書きは分離ジョブにのみ使用することを推奨します。

解決の優先順位:

1. ジョブペイロード上書き（最優先）
2. フック固有の既定（例: `hooks.gmail.model`）
3. エージェント設定の既定

### 配信（チャンネル + ターゲット）

分離ジョブは、トップレベルの `delivery` 設定により、チャンネルへ出力を配信できます:

- `delivery.mode`: `announce`（要約を配信）または `none`。
- `delivery.channel`: `whatsapp` / `telegram` / `discord` / `slack` / `mattermost`（plugin） / `signal` / `imessage` / `last`。
- `delivery.to`: チャンネル固有の受信者ターゲット。

配信設定は分離ジョブ（`sessionTarget: "isolated"`）でのみ有効です。

`delivery.channel` または `delivery.to` が省略された場合、cron はメインセッションの「last route」（エージェントが最後に返信した場所）へフォールバックできます。

ターゲット形式の注意:

- Slack/Discord/Mattermost（plugin）のターゲットは、曖昧さを避けるため明示的な接頭辞（例: `channel:<id>`、`user:<id>`）を使用してください。
- Telegram のトピックは `:topic:` 形式を使用してください（下記参照）。

#### Telegram の配信ターゲット（トピック / フォーラムスレッド）

Telegram は `message_thread_id` によりフォーラムトピックをサポートします。cron 配信では、トピック/スレッドを `to` フィールドにエンコードできます:

- `-1001234567890`（chat id のみ）
- `-1001234567890:topic:123`（推奨: 明示的なトピックマーカー）
- `-1001234567890:123`（省略形: 数値サフィックス）

`telegram:...` / `telegram:group:...` のような接頭辞付きターゲットも受け付けます:

- `telegram:group:-1001234567890:topic:123`

## ツール呼び出しの JSON スキーマ

Gateway（ゲートウェイ）の `cron.*` ツールを直接呼び出す場合（エージェントのツール呼び出しまたは RPC）は、これらの形状を使用してください。
CLI フラグは `20m` のような人間向けの duration を受け付けますが、ツール呼び出しでは `schedule.at` には ISO 8601 文字列を、`schedule.everyMs` にはミリ秒を使用してください。

### cron.add params

ワンショットのメインセッションジョブ（システムイベント）:

```json
{
  "name": "Reminder",
  "schedule": { "kind": "at", "at": "2026-02-01T16:00:00Z" },
  "sessionTarget": "main",
  "wakeMode": "now",
  "payload": { "kind": "systemEvent", "text": "Reminder text" },
  "deleteAfterRun": true
}
```

配信付きの繰り返し分離ジョブ:

```json
{
  "name": "Morning brief",
  "schedule": { "kind": "cron", "expr": "0 7 * * *", "tz": "America/Los_Angeles" },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Summarize overnight updates."
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "channel:C1234567890",
    "bestEffort": true
  }
}
```

注記:

- `schedule.kind`: `at`（`at`）、`every`（`everyMs`）、または `cron`（`expr`、任意の `tz`）。
- `schedule.at` は ISO 8601 を受け付けます（タイムゾーンは任意。省略時は UTC として扱われます）。
- `everyMs` はミリ秒です。
- `sessionTarget` は `"main"` または `"isolated"` でなければならず、`payload.kind` と一致する必要があります。
- 任意フィールド: `agentId`、`description`、`enabled`、`deleteAfterRun`（`at` では既定で true）、
  `delivery`。
- `wakeMode` は省略時に `"next-heartbeat"` が既定になります。

### cron.update params

```json
{
  "jobId": "job-123",
  "patch": {
    "enabled": false,
    "schedule": { "kind": "every", "everyMs": 3600000 }
  }
}
```

注記:

- `jobId` が正規であり、互換性のために `id` も受け付けます。
- エージェントバインディングをクリアするには、パッチ内で `agentId: null` を使用してください。

### cron.run と cron.remove params

```json
{ "jobId": "job-123", "mode": "force" }
```

```json
{ "jobId": "job-123" }
```

## ストレージ & 履歴

- ジョブストア: `~/.openclaw/cron/jobs.json`（Gateway（ゲートウェイ）管理の JSON）。
- 実行履歴: `~/.openclaw/cron/runs/<jobId>.jsonl`（JSONL、自動で間引き）。
- ストアパスの上書き: 設定内の `cron.store`。

## 設定

```json5
{
  cron: {
    enabled: true, // default true
    store: "~/.openclaw/cron/jobs.json",
    maxConcurrentRuns: 1, // default 1
  },
}
```

cron を完全に無効化します:

- `cron.enabled: false`（config）
- `OPENCLAW_SKIP_CRON=1`（env）

## CLI クイックスタート

ワンショットのリマインダー（UTC ISO、成功後に自動削除）:

```bash
openclaw cron add \
  --name "Send reminder" \
  --at "2026-01-12T18:00:00Z" \
  --session main \
  --system-event "Reminder: submit expense report." \
  --wake now \
  --delete-after-run
```

ワンショットのリマインダー（メインセッション、即時に起床）:

```bash
openclaw cron add \
  --name "Calendar check" \
  --at "20m" \
  --session main \
  --system-event "Next heartbeat: check calendar." \
  --wake now
```

繰り返し分離ジョブ（WhatsApp へ announce）:

```bash
openclaw cron add \
  --name "Morning status" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize inbox + calendar for today." \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

繰り返し分離ジョブ（Telegram のトピックへ配信）:

```bash
openclaw cron add \
  --name "Nightly summary (topic)" \
  --cron "0 22 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize today; send to the nightly topic." \
  --announce \
  --channel telegram \
  --to "-1001234567890:topic:123"
```

モデルと thinking の上書き付き分離ジョブ:

```bash
openclaw cron add \
  --name "Deep analysis" \
  --cron "0 6 * * 1" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Weekly deep analysis of project progress." \
  --model "opus" \
  --thinking high \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

エージェント選択（マルチエージェント構成）:

```bash
# Pin a job to agent "ops" (falls back to default if that agent is missing)
openclaw cron add --name "Ops sweep" --cron "0 6 * * *" --session isolated --message "Check ops queue" --agent ops

# Switch or clear the agent on an existing job
openclaw cron edit <jobId> --agent ops
openclaw cron edit <jobId> --clear-agent
```

手動実行（デバッグ）:

```bash
openclaw cron run <jobId> --force
```

既存ジョブの編集（フィールドをパッチ）:

```bash
openclaw cron edit <jobId> \
  --message "Updated prompt" \
  --model "opus" \
  --thinking low
```

実行履歴:

```bash
openclaw cron runs --id <jobId> --limit 50
```

ジョブを作成せずに即時システムイベント:

```bash
openclaw system event --mode now --text "Next heartbeat: check battery."
```

## Gateway（ゲートウェイ）API サーフェス

- `cron.list`、`cron.status`、`cron.add`、`cron.update`、`cron.remove`
- `cron.run`（force または due）、`cron.runs`
  ジョブなしの即時システムイベントについては、[`openclaw system event`](/cli/system) を使用してください。

## トラブルシューティング

### 「何も実行されない」

- cron が有効になっていることを確認してください: `cron.enabled` と `OPENCLAW_SKIP_CRON`。
- Gateway（ゲートウェイ）が継続的に稼働していることを確認してください（cron は Gateway（ゲートウェイ）プロセス内で動作します）。
- `cron` スケジュールの場合: タイムゾーン（`--tz`）とホストのタイムゾーンの差を確認してください。

### Telegram が誤った場所に配信される

- フォーラムトピックでは、明示的かつ曖昧さのない `-100…:topic:<id>` を使用してください。
- ログや保存された「last route」ターゲットで `telegram:...` の接頭辞が見える場合でも、それは正常です。cron 配信はそれらを受け付け、トピック ID も正しく解析します。
