---
summary: "Heartbeat ポーリングメッセージと通知ルール"
read_when:
  - ハートビートの間隔またはメッセージングを調整する場合
  - スケジュールされたタスクに heartbeat と cron のどちらを使うか決める場合
title: "Heartbeat"
x-i18n:
  source_path: gateway/heartbeat.md
  source_hash: 27db9803263a5f2d
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:24:31Z
---

# Heartbeat（Gateway（ゲートウェイ））

> **Heartbeat と Cron のどちらですか？** それぞれをいつ使うべきかの指針は、[Cron vs Heartbeat](/automation/cron-vs-heartbeat) を参照してください。

Heartbeat はメインセッションで **定期的なエージェントターン** を実行し、モデルがあなたにスパムを送ることなく注意が必要な事項を提示できるようにします。

## クイックスタート（初心者）

1. heartbeat を有効のままにします（デフォルトは `30m`、Anthropic OAuth/setup-token の場合は `1h`）。または独自の間隔を設定します。
2. エージェントワークスペースに小さな `HEARTBEAT.md` チェックリストを作成します（任意ですが推奨）。
3. heartbeat メッセージの送信先を決めます（デフォルトは `target: "last"`）。
4. 任意: 透明性のために heartbeat の推論配信を有効にします。
5. 任意: heartbeat をアクティブ時間（ローカル時刻）に制限します。

設定例:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        // activeHours: { start: "08:00", end: "24:00" },
        // includeReasoning: true, // optional: send separate `Reasoning:` message too
      },
    },
  },
}
```

## デフォルト

- 間隔: `30m`（Anthropic OAuth/setup-token が検出された認証モードの場合は `1h`）。`agents.defaults.heartbeat.every` またはエージェント単位の `agents.list[].heartbeat.every` を設定してください。無効化するには `0m` を使用します。
- プロンプト本文（`agents.defaults.heartbeat.prompt` で設定可能）:
  `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
- heartbeat プロンプトは、ユーザーメッセージとして **そのまま** 送信されます。システムプロンプトには「Heartbeat」セクションが含まれ、実行は内部的にフラグ付けされます。
- アクティブ時間（`heartbeat.activeHours`）は設定されたタイムゾーンで判定されます。ウィンドウ外では、次にウィンドウ内のティックが来るまで heartbeat はスキップされます。

## heartbeat プロンプトの用途

デフォルトのプロンプトは意図的に広めです。

- **バックグラウンドタスク**: 「未完了タスクを検討する」は、エージェントにフォローアップ（受信箱、カレンダー、リマインダー、キューされた作業）を見直させ、緊急事項があれば提示するよう促します。
- **人間へのチェックイン**: 「日中にあなたの人間を時々チェックする」は、軽量な「何か必要ですか？」メッセージを時折促しますが、設定したローカルタイムゾーンを使うことで夜間のスパムを避けます（[/concepts/timezone](/concepts/timezone) を参照）。

heartbeat に非常に特定のこと（例: 「Gmail PubSub の統計を確認する」や「ゲートウェイの健全性を検証する」）をさせたい場合は、`agents.defaults.heartbeat.prompt`（または `agents.list[].heartbeat.prompt`）をカスタム本文（そのまま送信）に設定してください。

## レスポンス規約

- 注意が必要なものがない場合は、**`HEARTBEAT_OK`** と返信してください。
- heartbeat 実行中、OpenClaw は `HEARTBEAT_OK` が返信の **先頭または末尾** に現れた場合に ack として扱います。トークンは取り除かれ、残りの内容が **≤ `ackMaxChars`**（デフォルト: 300）であれば返信は破棄されます。
- `HEARTBEAT_OK` が返信の **途中** に現れた場合は、特別扱いされません。
- アラートの場合、`HEARTBEAT_OK` を含め **ない** でください。アラート本文のみを返します。

heartbeat 以外では、メッセージ先頭/末尾の紛れ込んだ `HEARTBEAT_OK` は取り除かれてログに記録されます。`HEARTBEAT_OK` のみのメッセージは破棄されます。

## 設定

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m", // default: 30m (0m disables)
        model: "anthropic/claude-opus-4-6",
        includeReasoning: false, // default: false (deliver separate Reasoning: message when available)
        target: "last", // last | none | <channel id> (core or plugin, e.g. "bluebubbles")
        to: "+15551234567", // optional channel-specific override
        accountId: "ops-bot", // optional multi-account channel id
        prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        ackMaxChars: 300, // max chars allowed after HEARTBEAT_OK
      },
    },
  },
}
```

### スコープと優先順位

- `agents.defaults.heartbeat` はグローバルの heartbeat 挙動を設定します。
- `agents.list[].heartbeat` は上書きマージされます。いずれかのエージェントが `heartbeat` ブロックを持つ場合、**それらのエージェントのみ** が heartbeat を実行します。
- `channels.defaults.heartbeat` は全チャンネルの可視性デフォルトを設定します。
- `channels.<channel>.heartbeat` はチャンネルデフォルトを上書きします。
- `channels.<channel>.accounts.<id>.heartbeat`（マルチアカウントチャンネル）はチャンネル単位の設定を上書きします。

### エージェント単位の heartbeat

いずれかの `agents.list[]` エントリが `heartbeat` ブロックを含む場合、**それらのエージェントのみ** が heartbeat を実行します。エージェント単位ブロックは `agents.defaults.heartbeat` の上にマージされます（共有デフォルトを一度設定し、エージェントごとに上書きできます）。

例: 2 つのエージェントのうち、2 番目のエージェントだけが heartbeat を実行します。

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
      },
    },
    list: [
      { id: "main", default: true },
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "whatsapp",
          to: "+15551234567",
          prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        },
      },
    ],
  },
}
```

### アクティブ時間の例

特定のタイムゾーンで営業時間内に heartbeat を制限します。

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        activeHours: {
          start: "09:00",
          end: "22:00",
          timezone: "America/New_York", // optional; uses your userTimezone if set, otherwise host tz
        },
      },
    },
  },
}
```

このウィンドウ外（Eastern で午前 9 時前または午後 10 時後）では、heartbeat はスキップされます。次にウィンドウ内で予定されたティックが通常どおり実行されます。

### マルチアカウントの例

Telegram のようなマルチアカウントチャンネルで特定のアカウントを対象にするには、`accountId` を使用します。

```json5
{
  agents: {
    list: [
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "telegram",
          to: "12345678",
          accountId: "ops-bot",
        },
      },
    ],
  },
  channels: {
    telegram: {
      accounts: {
        "ops-bot": { botToken: "YOUR_TELEGRAM_BOT_TOKEN" },
      },
    },
  },
}
```

### フィールド注記

- `every`: heartbeat 間隔（duration 文字列。デフォルト単位 = 分）。
- `model`: heartbeat 実行時の任意のモデル上書き（`provider/model`）。
- `includeReasoning`: 有効にすると、利用可能時に別の `Reasoning:` メッセージも配信します（`/reasoning on` と同じ形）。
- `session`: heartbeat 実行用の任意のセッションキー。
  - `main`（デフォルト）: エージェントのメインセッション。
  - 明示的なセッションキー（`openclaw sessions --json` または [sessions CLI](/cli/sessions) からコピー）。
  - セッションキー形式: [Sessions](/concepts/session) と [Groups](/concepts/groups) を参照してください。
- `target`:
  - `last`（デフォルト）: 最後に使用された外部チャンネルへ配信します。
  - 明示的なチャンネル: `whatsapp` / `telegram` / `discord` / `googlechat` / `slack` / `msteams` / `signal` / `imessage`。
  - `none`: heartbeat は実行しますが、外部には **配信しません**。
- `to`: 任意の受信者上書き（チャンネル固有の id。例: WhatsApp の E.164 や Telegram の chat id）。
- `accountId`: マルチアカウントチャンネル用の任意のアカウント id。`target: "last"` の場合、アカウント id は、アカウントをサポートする場合に解決された最後のチャンネルへ適用され、そうでなければ無視されます。アカウント id が解決されたチャンネルの設定済みアカウントと一致しない場合、配信はスキップされます。
- `prompt`: デフォルトのプロンプト本文を上書きします（マージしません）。
- `ackMaxChars`: 配信前に `HEARTBEAT_OK` の後に許可される最大文字数。
- `activeHours`: heartbeat 実行を時間ウィンドウに制限します。`start`（HH:MM、含む）、`end`（HH:MM、除外。終了時刻として `24:00` 可）、任意の `timezone` を持つオブジェクトです。
  - 省略または `"user"`: `agents.defaults.userTimezone` が設定されていればそれを使用し、そうでなければホストシステムのタイムゾーンにフォールバックします。
  - `"local"`: 常にホストシステムのタイムゾーンを使用します。
  - 任意の IANA 識別子（例: `America/New_York`）: 直接使用します。無効な場合は上記の `"user"` 挙動にフォールバックします。
  - アクティブウィンドウ外では、次にウィンドウ内のティックが来るまで heartbeat はスキップされます。

## 配信の挙動

- heartbeat はデフォルトでエージェントのメインセッション（`agent:<id>:<mainKey>`）で実行されます。`session.scope = "global"` の場合は `global` です。Discord/WhatsApp などの特定チャンネルセッションへ上書きするには `session` を設定します。
- `session` は実行コンテキストにのみ影響し、配信は `target` と `to` により制御されます。
- 特定のチャンネル/受信者へ配信するには、`target` + `to` を設定します。`target: "last"` の場合、配信はそのセッションの最後の外部チャンネルを使用します。
- メインキューがビジーの場合、heartbeat はスキップされ、後でリトライされます。
- `target` が外部宛先なしに解決された場合でも、実行は行われますが、外向きメッセージは送信されません。
- heartbeat のみの返信はセッションを生かし **ません**。最後の `updatedAt` が復元されるため、アイドル期限切れは通常どおりに動作します。

## 可視性コントロール

デフォルトでは、`HEARTBEAT_OK` の確認応答は抑制され、アラート内容は配信されます。チャンネル単位またはアカウント単位で調整できます。

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false # Hide HEARTBEAT_OK (default)
      showAlerts: true # Show alert messages (default)
      useIndicator: true # Emit indicator events (default)
  telegram:
    heartbeat:
      showOk: true # Show OK acknowledgments on Telegram
  whatsapp:
    accounts:
      work:
        heartbeat:
          showAlerts: false # Suppress alert delivery for this account
```

優先順位: アカウント単位 → チャンネル単位 → チャンネルデフォルト → 組み込みデフォルト。

### 各フラグの動作

- `showOk`: モデルが OK のみの返信を返したときに、`HEARTBEAT_OK` の確認応答を送信します。
- `showAlerts`: モデルが非 OK の返信を返したときに、アラート内容を送信します。
- `useIndicator`: UI のステータス表示用のインジケーターイベントを発行します。

**3 つすべて** が false の場合、OpenClaw は heartbeat 実行自体を完全にスキップします（モデル呼び出しなし）。

### チャンネル単位 vs アカウント単位の例

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false
      showAlerts: true
      useIndicator: true
  slack:
    heartbeat:
      showOk: true # all Slack accounts
    accounts:
      ops:
        heartbeat:
          showAlerts: false # suppress alerts for the ops account only
  telegram:
    heartbeat:
      showOk: true
```

### よくあるパターン

| 目標                                             | 設定                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| デフォルト動作（OK は無音、アラートはオン）      | _(設定不要)_                                                                             |
| 完全に無音（メッセージなし、インジケーターなし） | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: false }` |
| インジケーターのみ（メッセージなし）             | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: true }`  |
| 1 つのチャンネルでのみ OK を出す                 | `channels.telegram.heartbeat: { showOk: true }`                                          |

## HEARTBEAT.md（任意）

ワークスペースに `HEARTBEAT.md` ファイルが存在する場合、デフォルトのプロンプトはエージェントにそれを読むよう指示します。これは「heartbeat チェックリスト」と考えてください。小さく、安定しており、30 分ごとに含めても安全です。

`HEARTBEAT.md` が存在しても実質的に空（空行と、`# Heading` のような Markdown 見出しのみ）である場合、OpenClaw は API コールを節約するため heartbeat 実行をスキップします。ファイルがない場合でも heartbeat は実行され、何をするかはモデルが判断します。

プロンプトの肥大化を避けるため、（短いチェックリストやリマインダーとして）小さく保ってください。

`HEARTBEAT.md` の例:

```md
# Heartbeat checklist

- Quick scan: anything urgent in inboxes?
- If it’s daytime, do a lightweight check-in if nothing else is pending.
- If a task is blocked, write down _what is missing_ and ask Peter next time.
```

### エージェントは HEARTBEAT.md を更新できますか？

はい。あなたがそう依頼すれば可能です。

`HEARTBEAT.md` はエージェントワークスペース内の通常のファイルなので、（通常のチャットで）次のように指示できます。

- 「`HEARTBEAT.md` を更新して、毎日のカレンダーチェックを追加してください。」
- 「`HEARTBEAT.md` を書き直して、短くして受信箱のフォローアップに集中させてください。」

これをプロアクティブに行いたい場合は、heartbeat プロンプトに次のような明示行を含めることもできます: 「チェックリストが古くなったら、より良いものにして HEARTBEAT.md を更新してください。」

安全上の注意: 秘密情報（API キー、電話番号、プライベートトークン）を `HEARTBEAT.md` に入れないでください。プロンプトコンテキストの一部になります。

## 手動ウェイク（オンデマンド）

次の方法でシステムイベントをキューに入れ、即時の heartbeat をトリガーできます。

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
```

複数のエージェントで `heartbeat` が設定されている場合、手動ウェイクはそれら各エージェントの heartbeat を直ちに実行します。

次の予定ティックを待つには `--mode next-heartbeat` を使用します。

## 推論配信（任意）

デフォルトでは、heartbeat は最終的な「回答」ペイロードのみを配信します。

透明性が必要な場合は、次を有効にしてください。

- `agents.defaults.heartbeat.includeReasoning: true`

有効にすると、heartbeat は接頭辞 `Reasoning:` の別メッセージも配信します（`/reasoning on` と同じ形）。これは、エージェントが複数のセッション/codex を管理していて、なぜあなたに ping する判断をしたのかを確認したい場合に有用です。ただし、望まない内部詳細がより多く漏れる可能性もあります。グループチャットではオフのままにすることを推奨します。

## コストへの配慮

heartbeat は完全なエージェントターンを実行します。間隔を短くするとより多くのトークンを消費します。`HEARTBEAT.md` を小さく保ち、内部状態の更新だけが目的であれば、より安価な `model` または `target: "none"` を検討してください。
