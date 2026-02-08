---
summary: "OpenProse：OpenClaw における .prose ワークフロー、スラッシュコマンド、状態管理"
read_when:
  - ".prose ワークフローを実行または作成したい場合"
  - "OpenProse プラグインを有効化したい場合"
  - "状態ストレージを理解する必要がある場合"
title: "OpenProse"
x-i18n:
  source_path: prose.md
  source_hash: cf7301e927b9a463
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:34Z
---

# OpenProse

OpenProse は、AI セッションをオーケストレーションするための、ポータブルで Markdown ファーストなワークフローフォーマットです。OpenClaw では、OpenProse スキルパックと `/prose` スラッシュコマンドをインストールするプラグインとして提供されます。プログラムは `.prose` ファイルに保存され、明示的な制御フローにより複数のサブエージェントを生成できます。

公式サイト: https://www.prose.md

## できること

- 明示的な並列性を備えた、マルチエージェントによる調査と統合。
- 再現可能で承認セーフなワークフロー（コードレビュー、インシデントトリアージ、コンテンツパイプライン）。
- サポートされているエージェントランタイム間で実行できる、再利用可能な `.prose` プログラム。

## インストールと有効化

バンドルされたプラグインは、デフォルトでは無効です。OpenProse を有効化してください。

```bash
openclaw plugins enable open-prose
```

プラグインを有効化した後、Gateway（ゲートウェイ）を再起動してください。

Dev / ローカルチェックアウト: `openclaw plugins install ./extensions/open-prose`

関連ドキュメント: [Plugins](/plugin), [Plugin manifest](/plugins/manifest), [Skills](/tools/skills).

## スラッシュコマンド

OpenProse は、ユーザーが呼び出し可能なスキルコマンドとして `/prose` を登録します。これは OpenProse VM の命令にルーティングされ、内部的に OpenClaw のツールを使用します。

一般的なコマンド:

```
/prose help
/prose run <file.prose>
/prose run <handle/slug>
/prose run <https://example.com/file.prose>
/prose compile <file.prose>
/prose examples
/prose update
```

## 例: シンプルな `.prose` ファイル

```prose
# Research + synthesis with two agents running in parallel.

input topic: "What should we research?"

agent researcher:
  model: sonnet
  prompt: "You research thoroughly and cite sources."

agent writer:
  model: opus
  prompt: "You write a concise summary."

parallel:
  findings = session: researcher
    prompt: "Research {topic}."
  draft = session: writer
    prompt: "Summarize {topic}."

session "Merge the findings + draft into a final answer."
context: { findings, draft }
```

## ファイルの場所

OpenProse は、ワークスペース内の `.prose/` 配下に状態を保存します。

```
.prose/
├── .env
├── runs/
│   └── {YYYYMMDD}-{HHMMSS}-{random}/
│       ├── program.prose
│       ├── state.md
│       ├── bindings/
│       └── agents/
└── agents/
```

ユーザーレベルの永続エージェントは、次の場所に配置されます。

```
~/.prose/agents/
```

## 状態モード

OpenProse は、複数の状態バックエンドをサポートします。

- **filesystem**（デフォルト）: `.prose/runs/...`
- **in-context**: 小規模なプログラム向けの一時的な方式
- **sqlite**（実験的）: `sqlite3` バイナリが必要
- **postgres**（実験的）: `psql` と接続文字列が必要

注記:

- sqlite / postgres はオプトインであり、実験的機能です。
- postgres の認証情報はサブエージェントのログに流入します。専用で最小権限の DB を使用してください。

## リモートプログラム

`/prose run <handle/slug>` は `https://p.prose.md/<handle>/<slug>` に解決されます。  
直接 URL は、そのまま取得されます。これは `web_fetch` ツール（POST の場合は `exec`）を使用します。

## OpenClaw ランタイムの対応関係

OpenProse プログラムは、OpenClaw のプリミティブに対応付けられます。

| OpenProse の概念              | OpenClaw ツール  |
| ----------------------------- | ---------------- |
| セッション生成 / タスクツール | `sessions_spawn` |
| ファイル読み書き              | `read` / `write` |
| Web フェッチ                  | `web_fetch`      |

ツールの allowlist がこれらのツールをブロックしている場合、OpenProse プログラムは失敗します。[Skills 設定](/tools/skills-config) を参照してください。

## セキュリティと承認

`.prose` ファイルはコードとして扱ってください。実行前にレビューしてください。OpenClaw のツール allowlist と承認ゲートを使用して、副作用を制御します。

決定論的で承認ゲート付きのワークフローについては、[Lobster](/tools/lobster) と比較してください。
