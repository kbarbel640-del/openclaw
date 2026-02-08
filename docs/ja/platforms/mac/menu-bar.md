---
summary: 「メニューバーのステータスロジックと、ユーザーに表示される内容」
read_when:
  - mac のメニュー UI またはステータスロジックを調整する場合
title: 「メニューバー」
x-i18n:
  source_path: platforms/mac/menu-bar.md
  source_hash: 8eb73c0e671a76aa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:27Z
---

# メニューバーのステータスロジック

## 表示される内容

- 現在のエージェントの作業状態は、メニューバーアイコンとメニュー内の最初のステータス行に表示されます。
- 作業がアクティブな間はヘルスステータスは非表示となり、すべてのセッションがアイドルになると再表示されます。
- メニュー内の「Nodes」ブロックには、クライアントやプレゼンスのエントリーではなく、**デバイス**（`node.list` によるペアリング済みノード）のみが一覧表示されます。
- プロバイダーの使用状況スナップショットが利用可能な場合、「Context」の下に「Usage」セクションが表示されます。

## 状態モデル

- セッション: イベントは `runId`（実行ごと）に加え、ペイロード内の `sessionKey` とともに到着します。「メイン」セッションはキー `main` です。これが存在しない場合、直近で更新されたセッションにフォールバックします。
- 優先順位: 常にメインが優先されます。メインがアクティブな場合、その状態が即座に表示されます。メインがアイドルの場合は、直近でアクティブだった非メインのセッションが表示されます。アクティビティの途中で状態が行き来することはなく、現在のセッションがアイドルになるか、メインがアクティブになったときのみ切り替わります。
- アクティビティ種別:
  - `job`: 高レベルのコマンド実行（`state: started|streaming|done|error`）。
  - `tool`: `phase: start|result`（`toolName` および `meta/args` を伴う）。

## IconState enum（Swift）

- `idle`
- `workingMain(ActivityKind)`
- `workingOther(ActivityKind)`
- `overridden(ActivityKind)`（デバッグ用オーバーライド）

### ActivityKind → グリフ

- `exec` → 💻
- `read` → 📄
- `write` → ✍️
- `edit` → 📝
- `attach` → 📎
- default → 🛠️

### ビジュアルマッピング

- `idle`: 通常のクリッター。
- `workingMain`: グリフ付きバッジ、フルの色調、「作業中」の脚アニメーション。
- `workingOther`: グリフ付きバッジ、控えめな色調、スカリーなし。
- `overridden`: アクティビティに関係なく、選択されたグリフと色調を使用します。

## ステータス行テキスト（メニュー）

- 作業がアクティブな間: `<Session role> · <activity label>`
  - 例: `Main · exec: pnpm test`、`Other · read: apps/macos/Sources/OpenClaw/AppState.swift`。
- アイドル時: ヘルスサマリーにフォールバックします。

## イベント取り込み

- ソース: コントロールチャンネルの `agent` イベント（`ControlChannel.handleAgentEvent`）。
- 解析されるフィールド:
  - 開始／停止を示す `data.state` を伴う `stream: "job"`。
  - `data.phase`、`name`、および任意の `meta`/`args` を伴う `stream: "tool"`。
- ラベル:
  - `exec`: `args.command` の先頭行。
  - `read`/`write`: 短縮されたパス。
  - `edit`: `meta`/差分数から推定された変更種別を含むパス。
  - フォールバック: ツール名。

## デバッグ用オーバーライド

- 設定 ▸ Debug ▸ 「Icon override」ピッカー:
  - `System (auto)`（デフォルト）
  - `Working: main`（ツール種別ごと）
  - `Working: other`（ツール種別ごと）
  - `Idle`
- `@AppStorage("iconOverride")` を介して保存され、`IconState.overridden` にマッピングされます。

## テストチェックリスト

- メインセッションのジョブをトリガー: アイコンが即座に切り替わり、ステータス行にメインのラベルが表示されることを確認します。
- メインがアイドルの状態で非メインセッションのジョブをトリガー: アイコン／ステータスに非メインが表示され、完了するまで安定していることを確認します。
- 他がアクティブな状態でメインを開始: アイコンが即座にメインに切り替わることを確認します。
- 急速なツールのバースト: バッジがちらつかないことを確認します（ツール結果に対する TTL の猶予）。
- すべてのセッションがアイドルになると、ヘルス行が再表示されることを確認します。
