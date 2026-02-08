---
summary: "コンテキスト: モデルが見るもの、それがどのように構築されるか、そしてそれをどのように調べるか"
read_when:
  - OpenClaw における「コンテキスト」が何を意味するのかを理解したい場合
  - モデルがなぜ何かを「知っている」のか（または忘れたのか）をデバッグしている場合
  - コンテキストのオーバーヘッドを減らしたい場合（/context、/status、/compact）
title: "コンテキスト"
x-i18n:
  source_path: concepts/context.md
  source_hash: b32867b9b93254fd
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:03:30Z
---

# コンテキスト

「コンテキスト」とは、**1 回の実行のために OpenClaw がモデルへ送信するすべて**です。これはモデルの **コンテキストウィンドウ**（トークン上限）によって制限されます。

初心者向けのメンタルモデル:

- **システムプロンプト**（OpenClaw が構築）: ルール、ツール、Skills リスト、時刻/ランタイム、そして注入されたワークスペースファイル。
- **会話履歴**: このセッションにおけるあなたのメッセージ + アシスタントのメッセージ。
- **ツール呼び出し/結果 + 添付**: コマンド出力、ファイル読み取り、画像/音声など。

コンテキストは「メモリ」とは _同じものではありません_。メモリはディスクに保存して後で再読み込みできますが、コンテキストはモデルの現在のウィンドウ内にあるものです。

## クイックスタート（コンテキストを確認する）

- `/status` → 「ウィンドウがどれくらい埋まっているか？」のクイック表示 + セッション設定。
- `/context list` → 注入されているもの + おおまかなサイズ（ファイル別 + 合計）。
- `/context detail` → より詳細な内訳: ファイル別、ツールスキーマサイズ別、Skills エントリーサイズ別、システムプロンプトサイズ。
- `/usage tokens` → 通常の返信に、返信ごとの使用量フッターを付ける。
- `/compact` → 古い履歴をコンパクトなエントリーに要約して、ウィンドウの空きを作る。

あわせて参照: [スラッシュコマンド](/tools/slash-commands)、[トークン使用量とコスト](/token-use)、[コンパクション](/concepts/compaction)。

## 出力例

値は、モデル、プロバイダー、ツールポリシー、そしてワークスペース内の内容によって変わります。

### `/context list`

```
🧠 Context breakdown
Workspace: <workspaceDir>
Bootstrap max/file: 20,000 chars
Sandbox: mode=non-main sandboxed=false
System prompt (run): 38,412 chars (~9,603 tok) (Project Context 23,901 chars (~5,976 tok))

Injected workspace files:
- AGENTS.md: OK | raw 1,742 chars (~436 tok) | injected 1,742 chars (~436 tok)
- SOUL.md: OK | raw 912 chars (~228 tok) | injected 912 chars (~228 tok)
- TOOLS.md: TRUNCATED | raw 54,210 chars (~13,553 tok) | injected 20,962 chars (~5,241 tok)
- IDENTITY.md: OK | raw 211 chars (~53 tok) | injected 211 chars (~53 tok)
- USER.md: OK | raw 388 chars (~97 tok) | injected 388 chars (~97 tok)
- HEARTBEAT.md: MISSING | raw 0 | injected 0
- BOOTSTRAP.md: OK | raw 0 chars (~0 tok) | injected 0 chars (~0 tok)

Skills list (system prompt text): 2,184 chars (~546 tok) (12 skills)
Tools: read, edit, write, exec, process, browser, message, sessions_send, …
Tool list (system prompt text): 1,032 chars (~258 tok)
Tool schemas (JSON): 31,988 chars (~7,997 tok) (counts toward context; not shown as text)
Tools: (same as above)

Session tokens (cached): 14,250 total / ctx=32,000
```

### `/context detail`

```
🧠 Context breakdown (detailed)
…
Top skills (prompt entry size):
- frontend-design: 412 chars (~103 tok)
- oracle: 401 chars (~101 tok)
… (+10 more skills)

Top tools (schema size):
- browser: 9,812 chars (~2,453 tok)
- exec: 6,240 chars (~1,560 tok)
… (+N more tools)
```

## コンテキストウィンドウにカウントされるもの

モデルが受け取るものはすべてカウントされます。これには以下が含まれます:

- システムプロンプト（すべてのセクション）。
- 会話履歴。
- ツール呼び出し + ツール結果。
- 添付/トランスクリプト（画像/音声/ファイル）。
- コンパクション要約とプルーニングの成果物。
- プロバイダーの「ラッパー」や隠しヘッダー（見えませんが、カウントされます）。

## OpenClaw がシステムプロンプトを構築する方法

システムプロンプトは **OpenClaw が所有**しており、実行のたびに再構築されます。これには以下が含まれます:

- ツール一覧 + 簡単な説明。
- Skills リスト（メタデータのみ。下記参照）。
- ワークスペースの場所。
- 時刻（UTC + 設定されている場合は変換されたユーザー時刻）。
- ランタイムメタデータ（ホスト/OS/モデル/thinking）。
- **Project Context** 配下の注入されたワークスペースブートストラップファイル。

完全な内訳: [System Prompt](/concepts/system-prompt)。

## 注入されるワークスペースファイル（Project Context）

デフォルトでは、OpenClaw は（存在する場合）ワークスペースファイルの固定セットを注入します:

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`（初回実行のみ）

大きいファイルは、ファイルごとに `agents.defaults.bootstrapMaxChars`（デフォルトは `20000` 文字）を使って切り詰められます。`/context` では、**生（raw）と注入後（injected）**のサイズ、および切り詰めが発生したかどうかが表示されます。

## Skills: 注入されるもの vs オンデマンドで読み込まれるもの

システムプロンプトには、コンパクトな **skills list**（名前 + 説明 + 場所）が含まれます。このリストには実際のオーバーヘッドがあります。

スキルの指示は、デフォルトでは含まれません。モデルは、必要なときにのみスキルの `SKILL.md` を `read` することが期待されます。

## ツール: コストは 2 種類あります

ツールは、2 つの形でコンテキストに影響します:

1. システムプロンプト内の **ツール一覧テキスト**（「Tooling」として見えるもの）。
2. **ツールスキーマ**（JSON）。モデルがツールを呼び出せるように送られます。プレーンテキストとしては見えませんが、コンテキストにカウントされます。

`/context detail` は、最も大きいツールスキーマを内訳表示し、何が支配的かを確認できるようにします。

## コマンド、ディレクティブ、「インラインショートカット」

スラッシュコマンドは Gateway（ゲートウェイ）によって処理されます。いくつか異なる挙動があります:

- **単独コマンド**: `/...` だけのメッセージはコマンドとして実行されます。
- **ディレクティブ**: `/think`、`/verbose`、`/reasoning`、`/elevated`、`/model`、`/queue` は、モデルがメッセージを見る前に取り除かれます。
  - ディレクティブのみのメッセージはセッション設定を永続化します。
  - 通常メッセージ内のインラインディレクティブは、メッセージごとのヒントとして機能します。
- **インラインショートカット**（許可リストにある送信者のみ）: 通常メッセージ内の特定の `/...` トークンは即時に実行でき（例: 「hey /status」）、残りのテキストをモデルが見る前に取り除かれます。

詳細: [スラッシュコマンド](/tools/slash-commands)。

## セッション、コンパクション、プルーニング（永続化されるもの）

メッセージ間で何が永続化されるかは、仕組みによって異なります:

- **通常の履歴**は、ポリシーによりコンパクト化/プルーニングされるまで、セッションのトランスクリプトに残ります。
- **コンパクション**は、要約をトランスクリプトへ永続化し、直近のメッセージはそのまま保持します。
- **プルーニング**は、実行時の _メモリ内_ プロンプトから古いツール結果を削除しますが、トランスクリプトを書き換えません。

ドキュメント: [Session](/concepts/session)、[コンパクション](/concepts/compaction)、[セッションのプルーニング](/concepts/session-pruning)。

## `/context` が実際に報告する内容

`/context` は、利用可能な場合、最新の **実行で構築された**システムプロンプトレポートを優先します:

- `System prompt (run)` = 最後の埋め込み（ツール対応）実行から取得され、セッションストアに永続化されたものです。
- `System prompt (estimate)` = 実行レポートが存在しない場合（またはレポートを生成しない CLI バックエンド経由で実行している場合）にオンザフライで計算されるものです。

いずれの場合も、サイズと主要な寄与要因を報告しますが、システムプロンプトやツールスキーマ全体をダンプすることは **ありません**。
