---
summary: "エージェント実行時（埋め込み pi-mono）、ワークスペース契約、およびセッションのブートストラップ"
read_when:
  - エージェント実行時、ワークスペースのブートストラップ、またはセッションの挙動を変更する場合
title: "エージェント実行時"
x-i18n:
  source_path: concepts/agent.md
  source_hash: 04b4e0bc6345d2af
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:02:09Z
---

# エージェント実行時 🤖

OpenClaw は **pi-mono** 由来の、単一の埋め込みエージェント実行時を実行します。

## ワークスペース（必須）

OpenClaw は、エージェントのツールとコンテキストのための **唯一の** 作業ディレクトリとして、単一のエージェントワークスペースディレクトリ（`agents.defaults.workspace`）を使用します（`cwd`）。

推奨: `openclaw setup` を使用して、不足している場合は `~/.openclaw/openclaw.json` を作成し、ワークスペースファイルを初期化します。

ワークスペースの完全なレイアウト + バックアップガイド: [エージェントワークスペース](/concepts/agent-workspace)

`agents.defaults.sandbox` が有効な場合、非メインセッションは `agents.defaults.sandbox.workspaceRoot` 配下のセッションごとのワークスペースでこれを上書きできます（[Gateway 構成](/gateway/configuration) を参照）。

## ブートストラップファイル（注入）

`agents.defaults.workspace` 内で、OpenClaw は以下のユーザー編集可能なファイルを期待します。

- `AGENTS.md` — 運用指示 + 「記憶」
- `SOUL.md` — ペルソナ、境界、トーン
- `TOOLS.md` — ユーザーが管理するツールメモ（例: `imsg`、`sag`、規約）
- `BOOTSTRAP.md` — 初回実行のための一度きりの儀式（完了後に削除）
- `IDENTITY.md` — エージェント名/雰囲気/絵文字
- `USER.md` — ユーザープロフィール + 希望する呼称

新しいセッションの最初のターンで、OpenClaw はこれらのファイル内容をエージェントコンテキストに直接注入します。

空のファイルはスキップされます。大きなファイルはプロンプトを簡潔に保つため、マーカー付きでトリムおよび切り詰められます（全文はファイルを読んでください）。

ファイルが存在しない場合、OpenClaw は単一の「missing file」マーカー行を注入します（そして `openclaw setup` が安全なデフォルトテンプレートを作成します）。

`BOOTSTRAP.md` は **まったく新しいワークスペース**（他のブートストラップファイルが存在しない）場合にのみ作成されます。儀式の完了後に削除した場合、以後の再起動で再作成されるべきではありません。

ブートストラップファイルの作成を完全に無効化する（事前に種入れされたワークスペース向け）には、次を設定します。

```json5
{ agent: { skipBootstrap: true } }
```

## 組み込みツール

コアツール（read/exec/edit/write および関連するシステムツール）は、ツールポリシーの対象として常に利用可能です。`apply_patch` は任意であり、`tools.exec.applyPatch` によってゲートされます。`TOOLS.md` は、どのツールが存在するかを制御 **しません**。それは、あなたがツールをどのように使ってほしいかのガイダンスです。

## Skills

OpenClaw は 3 つの場所から Skills を読み込みます（名前衝突時はワークスペースが優先されます）。

- バンドル（インストールに同梱）
- 管理/ローカル: `~/.openclaw/skills`
- ワークスペース: `<workspace>/skills`

Skills は config/env によりゲートできます（[Gateway 構成](/gateway/configuration) の `skills` を参照）。

## pi-mono 統合

OpenClaw は pi-mono コードベース（モデル/ツール）の一部を再利用しますが、**セッション管理、デバイス検出、ツール配線は OpenClaw 所有**です。

- pi-coding エージェント実行時はありません。
- `~/.pi/agent` または `<workspace>/.pi` 設定は参照されません。

## セッション

セッションのトランスクリプトは、次の場所に JSONL として保存されます。

- `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

セッション ID は OpenClaw により選択され、安定しています。
レガシーの Pi/Tau セッションフォルダーは **読み込まれません**。

## ストリーミング中のステアリング

キューモードが `steer` の場合、受信メッセージは現在の実行に注入されます。
キューは **各ツール呼び出しの後** に確認されます。キューされたメッセージが存在する場合、現在のアシスタントメッセージからの残りのツール呼び出しはスキップされ（「Skipped due to queued user message.」というエラーツール結果になります）、その後、次のアシスタント応答の前にキューされたユーザーメッセージが注入されます。

キューモードが `followup` または `collect` の場合、受信メッセージは現在のターンが終了するまで保持され、その後キューされたペイロードで新しいエージェントターンが開始されます。モード + デバウンス/上限制御については [キュー](/concepts/queue) を参照してください。

ブロックストリーミングは、完了したアシスタントブロックを完了次第送信します。これは **デフォルトではオフ** です（`agents.defaults.blockStreamingDefault: "off"`）。
境界は `agents.defaults.blockStreamingBreak`（`text_end` vs `message_end`。デフォルトは text_end）で調整します。
ソフトブロックのチャンク化は `agents.defaults.blockStreamingChunk` で制御します（デフォルトは 800–1200 文字。段落区切りを優先し、次に改行、最後に文）。
ストリーミングされたチャンクは `agents.defaults.blockStreamingCoalesce` で結合し、単一行スパムを減らします（送信前のアイドルベース結合）。Telegram 以外のチャンネルでは、ブロック返信を有効にするために明示的な `*.blockStreaming: true` が必要です。
詳細なツール要約はツール開始時に出力されます（デバウンスなし）。Control UI は、利用可能な場合にエージェントイベント経由でツール出力をストリーミングします。
詳細: [ストリーミング + チャンク化](/concepts/streaming)。

## モデル参照

構成内のモデル参照（例: `agents.defaults.model` と `agents.defaults.models`）は、**最初の** `/` で分割して解析されます。

- モデルを構成する際は `provider/model` を使用してください。
- モデル ID 自体に `/`（OpenRouter 形式）が含まれる場合は、プロバイダープレフィックスを含めてください（例: `openrouter/moonshotai/kimi-k2`）。
- プロバイダーを省略した場合、OpenClaw は入力をエイリアス、または **デフォルトプロバイダー** のモデルとして扱います（モデル ID に `/` が含まれない場合にのみ機能します）。

## 構成（最小）

最低限、次を設定してください。

- `agents.defaults.workspace`
- `channels.whatsapp.allowFrom`（強く推奨）

---

_次へ: [グループチャット](/concepts/group-messages)_ 🦞
