---
title: Lobster
summary: "再開可能な承認ゲートを備えた OpenClaw 向けの型付きワークフローランタイム。"
description: OpenClaw 向けの型付きワークフローランタイム — 承認ゲートを備えた合成可能なパイプライン。
read_when:
  - 明示的な承認を伴う決定論的なマルチステップワークフローが必要です
  - 以前のステップを再実行せずにワークフローを再開する必要があります
x-i18n:
  source_path: tools/lobster.md
  source_hash: ff84e65f4be162ad
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:24Z
---

# Lobster

Lobster は、OpenClaw がマルチステップのツールシーケンスを、明示的な承認チェックポイントを備えた単一の決定論的な操作として実行できるようにするワークフローシェルです。

## Hook

あなたのアシスタントは、自分自身を管理するツールを構築できます。ワークフローを依頼すれば、30 分後には 1 回の呼び出しで動く CLI とパイプラインが手に入ります。Lobster は欠けていたピースです。決定論的なパイプライン、明示的な承認、そして再開可能な状態を提供します。

## Why

現在、複雑なワークフローには多数の行ったり来たりするツール呼び出しが必要です。各呼び出しはトークンを消費し、LLM はあらゆるステップをオーケストレーションしなければなりません。Lobster は、そのオーケストレーションを型付きランタイムへ移します。

- **多数の呼び出しではなく 1 回の呼び出し**: OpenClaw は Lobster ツール呼び出しを 1 回実行し、構造化された結果を得ます。
- **承認が組み込み**: 副作用（メール送信、コメント投稿）は、明示的に承認されるまでワークフローを停止します。
- **再開可能**: 停止したワークフローはトークンを返します。承認して、すべてを再実行せずに再開できます。

## なぜ普通のプログラムではなく DSL なのですか？

Lobster は意図的に小さく作られています。目的は「新しい言語」ではなく、第一級の承認と再開トークンを備えた、予測可能で AI フレンドリーなパイプライン仕様です。

- **承認/再開が組み込み**: 通常のプログラムでも人間にプロンプトできますが、耐久性のあるトークンで _停止と再開_ を行うには、そのランタイムを自分で発明する必要があります。
- **決定論 + 監査性**: パイプラインはデータなので、ログ化、差分、リプレイ、レビューが容易です。
- **AI 向けに制約されたサーフェス**: 小さな文法 + JSON パイピングにより「創造的」なコードパスが減り、検証が現実的になります。
- **安全ポリシーの組み込み**: タイムアウト、出力上限、サンドボックスチェック、許可リストは、各スクリプトではなくランタイムによって強制されます。
- **それでもプログラマブル**: 各ステップは任意の CLI やスクリプトを呼び出せます。JS/TS が欲しい場合は、コードから `.lobster` ファイルを生成してください。

## 仕組み

OpenClaw はローカルの `lobster` CLI を **ツールモード** で起動し、stdout から JSON エンベロープを解析します。  
パイプラインが承認のために一時停止した場合、ツールは `resumeToken` を返すため、後で続行できます。

## パターン: 小さな CLI + JSON パイプ + 承認

JSON を話す小さなコマンドを作り、それらを単一の Lobster 呼び出しへ連結します。（以下はコマンド名の例です。自分のものに置き換えてください。）

```bash
inbox list --json
inbox categorize --json
inbox apply --json
```

```json
{
  "action": "run",
  "pipeline": "exec --json --shell 'inbox list --json' | exec --stdin json --shell 'inbox categorize --json' | exec --stdin json --shell 'inbox apply --json' | approve --preview-from-stdin --limit 5 --prompt 'Apply changes?'",
  "timeoutMs": 30000
}
```

パイプラインが承認を要求した場合は、トークンで再開します。

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

AI がワークフローをトリガーし、Lobster がステップを実行します。承認ゲートにより、副作用が明示的かつ監査可能になります。

例: 入力アイテムをツール呼び出しへマップする:

```bash
gog.gmail.search --query 'newer_than:1d' \
  | openclaw.invoke --tool message --action send --each --item-key message --args-json '{"provider":"telegram","to":"..."}'
```

## JSON のみの LLM ステップ（llm-task）

**構造化された LLM ステップ** が必要なワークフローでは、オプションの `llm-task` プラグインツールを有効化し、Lobster から呼び出します。これにより、モデルで分類/要約/下書きを行いながらも、ワークフローを決定論的に保てます。

ツールを有効化します。

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

パイプラインで使用します。

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": { "subject": "Hello", "body": "Can you help?" },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

詳細と設定オプションについては、[LLM Task](/tools/llm-task) を参照してください。

## ワークフローファイル（.lobster）

Lobster は、`name`、`args`、`steps`、`env`、`condition`、および `approval` フィールドを持つ YAML/JSON ワークフローファイルを実行できます。OpenClaw のツール呼び出しでは、`pipeline` にファイルパスを設定してください。

```yaml
name: inbox-triage
args:
  tag:
    default: "family"
steps:
  - id: collect
    command: inbox list --json
  - id: categorize
    command: inbox categorize --json
    stdin: $collect.stdout
  - id: approve
    command: inbox apply --approve
    stdin: $categorize.stdout
    approval: required
  - id: execute
    command: inbox apply --execute
    stdin: $categorize.stdout
    condition: $approve.approved
```

注:

- `stdin: $step.stdout` と `stdin: $step.json` は、前のステップの出力を渡します。
- `condition`（または `when`）は、`$step.approved` に基づいてステップをゲートできます。

## Lobster のインストール

OpenClaw Gateway（ゲートウェイ）を実行する **同一ホスト** に Lobster CLI をインストールし（[Lobster repo](https://github.com/openclaw/lobster) を参照）、`lobster` が `PATH` 上にあることを確認してください。  
カスタムのバイナリ配置場所を使いたい場合は、ツール呼び出しで **絶対** `lobsterPath` を渡してください。

## ツールを有効化する

Lobster は **オプション** のプラグインツール（デフォルトでは有効化されていません）です。

推奨（追加的で安全）:

```json
{
  "tools": {
    "alsoAllow": ["lobster"]
  }
}
```

またはエージェントごとに:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "alsoAllow": ["lobster"]
        }
      }
    ]
  }
}
```

制限的な許可リストモードで実行する意図がない限り、`tools.allow: ["lobster"]` の使用は避けてください。

注: 許可リストはオプションプラグインではオプトインです。許可リストが（`lobster` のような）プラグインツールだけを指定している場合、OpenClaw はコアツールを有効なままにします。コアツールを制限するには、許可リストにコアツールまたは含めたいグループも指定してください。

## 例: メールのトリアージ

Lobster なし:

```
User: "Check my email and draft replies"
→ openclaw calls gmail.list
→ LLM summarizes
→ User: "draft replies to #2 and #5"
→ LLM drafts
→ User: "send #2"
→ openclaw calls gmail.send
(repeat daily, no memory of what was triaged)
```

Lobster あり:

```json
{
  "action": "run",
  "pipeline": "email.triage --limit 20",
  "timeoutMs": 30000
}
```

JSON エンベロープ（抜粋）を返します。

```json
{
  "ok": true,
  "status": "needs_approval",
  "output": [{ "summary": "5 need replies, 2 need action" }],
  "requiresApproval": {
    "type": "approval_request",
    "prompt": "Send 2 draft replies?",
    "items": [],
    "resumeToken": "..."
  }
}
```

ユーザーが承認 → 再開:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

1 つのワークフロー。決定論的。安全。

## ツールパラメータ

### `run`

ツールモードでパイプラインを実行します。

```json
{
  "action": "run",
  "pipeline": "gog.gmail.search --query 'newer_than:1d' | email.triage",
  "cwd": "/path/to/workspace",
  "timeoutMs": 30000,
  "maxStdoutBytes": 512000
}
```

引数付きでワークフローファイルを実行します。

```json
{
  "action": "run",
  "pipeline": "/path/to/inbox-triage.lobster",
  "argsJson": "{\"tag\":\"family\"}"
}
```

### `resume`

承認後に停止したワークフローを続行します。

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

### オプション入力

- `lobsterPath`: Lobster バイナリへの絶対パス（省略すると `PATH` を使用します）。
- `cwd`: パイプラインの作業ディレクトリ（デフォルトは現在のプロセスの作業ディレクトリ）。
- `timeoutMs`: この期間を超えた場合にサブプロセスを kill します（デフォルト: 20000）。
- `maxStdoutBytes`: stdout がこのサイズを超えた場合にサブプロセスを kill します（デフォルト: 512000）。
- `argsJson`: `lobster run --args-json` に渡される JSON 文字列（ワークフローファイルのみ）。

## 出力エンベロープ

Lobster は 3 つのいずれかのステータスを持つ JSON エンベロープを返します。

- `ok` → 正常に完了
- `needs_approval` → 一時停止。再開には `requiresApproval.resumeToken` が必要
- `cancelled` → 明示的に拒否、またはキャンセル

ツールは、`content`（整形済み JSON）と `details`（生オブジェクト）の両方でエンベロープを提示します。

## 承認

`requiresApproval` が存在する場合は、プロンプトを確認して決定します。

- `approve: true` → 再開し、副作用を続行
- `approve: false` → キャンセルし、ワークフローを確定

`approve --preview-from-stdin --limit N` を使うと、カスタムの jq/heredoc 接着剤なしで、承認リクエストに JSON プレビューを添付できます。再開トークンは今やコンパクトです。Lobster はワークフロー再開状態を自身の状態ディレクトリ配下に保存し、小さなトークンキーを返します。

## OpenProse

OpenProse は Lobster と相性が良いです。`/prose` を使ってマルチエージェントの準備をオーケストレーションし、その後に Lobster パイプラインを実行して決定論的な承認を行います。Prose プログラムが Lobster を必要とする場合は、`tools.subagents.tools` を介してサブエージェントに `lobster` ツールを許可してください。[OpenProse](/prose) を参照してください。

## 安全性

- **ローカルサブプロセスのみ** — プラグイン自体からはネットワーク呼び出しを行いません。
- **シークレットなし** — Lobster は OAuth を管理しません。代わりに、それを行う OpenClaw ツールを呼び出します。
- **サンドボックス対応** — ツールコンテキストがサンドボックス化されている場合は無効化されます。
- **堅牢化** — 指定されている場合、`lobsterPath` は絶対パスでなければなりません。タイムアウトと出力上限が強制されます。

## トラブルシューティング

- **`lobster subprocess timed out`** → `timeoutMs` を増やすか、長いパイプラインを分割してください。
- **`lobster output exceeded maxStdoutBytes`** → `maxStdoutBytes` を増やすか、出力サイズを減らしてください。
- **`lobster returned invalid JSON`** → パイプラインがツールモードで実行され、JSON のみを出力していることを確認してください。
- **`lobster failed (code …)`** → 同じパイプラインをターミナルで実行し、stderr を確認してください。

## さらに学ぶ

- [Plugins](/plugin)
- [Plugin tool authoring](/plugins/agent-tools)

## ケーススタディ: コミュニティワークフロー

公開されている例の 1 つは、「セカンドブレイン」CLI + Lobster パイプラインで、3 つの Markdown ボールト（個人、パートナー、共有）を管理するものです。CLI は統計、受信箱一覧、陳腐化スキャンのために JSON を出力します。Lobster はそれらのコマンドを、`weekly-review`、`inbox-triage`、`memory-consolidation`、および `shared-task-sync` のようなワークフローへ連結し、それぞれに承認ゲートを備えます。AI は利用可能な場合は判断（分類）を担当し、利用できない場合は決定論的なルールへフォールバックします。

- Thread: https://x.com/plattenschieber/status/2014508656335770033
- Repo: https://github.com/bloomedai/brain-cli
