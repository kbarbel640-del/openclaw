---
summary: "「/think」+「/verbose」向けのディレクティブ構文と、それらがモデルの推論に与える影響"
read_when:
  - 思考または verbose ディレクティブの解析やデフォルトを調整するとき
title: "思考レベル"
x-i18n:
  source_path: tools/thinking.md
  source_hash: 0ae614147675be32
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:53Z
---

# 思考レベル（/think ディレクティブ）

## 機能

- 任意の受信本文内にあるインラインディレクティブ: `/t <level>`、`/think:<level>`、または `/thinking <level>`。
- レベル（エイリアス）: `off | minimal | low | medium | high | xhigh`（GPT-5.2 + Codex モデルのみ）
  - minimal → 「think」
  - low → 「think hard」
  - medium → 「think harder」
  - high → 「ultrathink」（最大バジェット）
  - xhigh → 「ultrathink+」（GPT-5.2 + Codex モデルのみ）
  - `x-high`、`x_high`、`extra-high`、`extra high`、および `extra_high` は `xhigh` にマップされます。
  - `highest`、`max` は `high` にマップされます。
- プロバイダーノート:
  - Z.AI（`zai/*`）は二値の思考（`on`/`off`）のみサポートします。`off` 以外のレベルはすべて `on` として扱われます（`low` にマップ）。

## 解決順序

1. メッセージ上のインラインディレクティブ（そのメッセージのみに適用）。
2. セッション上書き（ディレクティブのみのメッセージ送信で設定）。
3. グローバルデフォルト（設定内の `agents.defaults.thinkingDefault`）。
4. フォールバック: 推論可能なモデルは low、それ以外は off。

## セッションのデフォルトを設定する

- ディレクティブ **のみ** のメッセージ（空白は可）を送信します。例: `/think:medium` または `/t high`。
- これは現在のセッション（デフォルトでは送信者ごと）に固定され、`/think:off` またはセッションのアイドルリセットでクリアされます。
- 確認返信が送信されます（`Thinking level set to high.` / `Thinking disabled.`）。レベルが無効な場合（例: `/thinking big`）、コマンドはヒント付きで拒否され、セッション状態は変更されません。
- 引数なしで `/think`（または `/think:`）を送信すると、現在の思考レベルを確認できます。

## エージェント別の適用

- **Embedded Pi**: 解決されたレベルは、プロセス内の Pi エージェントランタイムに渡されます。

## Verbose ディレクティブ（/verbose または /v）

- レベル: `on`（minimal）| `full` | `off`（デフォルト）。
- ディレクティブのみのメッセージはセッションの verbose を切り替え、`Verbose logging enabled.` / `Verbose logging disabled.` と返信します。無効なレベルは、状態を変更せずにヒントを返します。
- `/verbose off` は明示的なセッション上書きを保存します。Sessions UI で `inherit` を選択してクリアしてください。
- インラインディレクティブはそのメッセージのみに影響します。それ以外はセッション/グローバルのデフォルトが適用されます。
- 引数なしで `/verbose`（または `/verbose:`）を送信すると、現在の verbose レベルを確認できます。
- verbose が on の場合、構造化されたツール結果（Pi、その他の JSON エージェント）を出力するエージェントは、各ツール呼び出しを個別のメタデータのみのメッセージとして返し、可能な場合は `<emoji> <tool-name>: <arg>`（パス/コマンド）を先頭に付けます。これらのツール要約は、各ツールの開始時点で（別バブルとして）送信され、ストリーミングの差分ではありません。
- verbose が `full` の場合、ツール出力も完了後に転送されます（別バブル、安全な長さに切り詰め）。実行中に `/verbose on|full|off` を切り替えた場合、以降のツールバブルは新しい設定に従います。

## 推論の可視性（/reasoning）

- レベル: `on|off|stream`。
- ディレクティブのみのメッセージは、返信内で思考ブロックを表示するかどうかを切り替えます。
- 有効時、推論は `Reasoning:` を先頭に付けた **別メッセージ** として送信されます。
- `stream`（Telegram のみ）: 返信生成中に推論を Telegram の下書きバブルへストリーミングし、その後、推論なしで最終回答を送信します。
- エイリアス: `/reason`。
- 引数なしで `/reasoning`（または `/reasoning:`）を送信すると、現在の推論レベルを確認できます。

## 関連

- Elevated mode のドキュメントは [Elevated mode](/tools/elevated) にあります。

## ハートビート

- ハートビートのプローブ本文は、設定されたハートビートプロンプトです（デフォルト: `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`）。ハートビートメッセージ内のインラインディレクティブは通常どおり適用されます（ただし、ハートビートからセッションデフォルトを変更することは避けてください）。
- ハートビートの配信は、デフォルトでは最終ペイロードのみです。別の `Reasoning:` メッセージ（利用可能な場合）も送信するには、`agents.defaults.heartbeat.includeReasoning: true` またはエージェントごとの `agents.list[].heartbeat.includeReasoning: true` を設定してください。

## Web チャット UI

- Web チャットの思考セレクターは、ページ読み込み時に、受信セッションストア/設定から保存済みのセッションレベルを反映します。
- 別のレベルを選ぶと、次のメッセージ（`thinkingOnce`）にのみ適用されます。送信後、セレクターは保存済みのセッションレベルに戻ります。
- セッションデフォルトを変更するには、（従来どおり）`/think:<level>` ディレクティブを送信します。セレクターは次回の再読み込み後にそれを反映します。
