---
summary: "使用状況トラッキングの表示箇所と認証情報要件"
read_when:
  - プロバイダーの使用状況/クォータ表示を配線している場合
  - 使用状況トラッキングの挙動または認証要件を説明する必要がある場合
title: "使用状況トラッキング"
x-i18n:
  source_path: concepts/usage-tracking.md
  source_hash: 6f6ed2a70329b2a6
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:54Z
---

# 使用状況トラッキング

## これは何ですか

- プロバイダーの使用状況/クォータを、各プロバイダーの使用状況エンドポイントから直接取得します。
- 推定コストはありません。プロバイダーが報告したウィンドウのみです。

## 表示される場所

- チャット内の `/status`: セッションのトークン数 + 推定コスト（API キーのみ）を含む、絵文字が豊富なステータスカードです。プロバイダーの使用状況は、利用可能な場合に **現在のモデルプロバイダー** のものが表示されます。
- チャット内の `/usage off|tokens|full`: 応答ごとの使用状況フッター（OAuth はトークン数のみを表示します）。
- チャット内の `/usage cost`: OpenClaw セッションログから集計されたローカルのコストサマリーです。
- CLI: `openclaw status --usage` は、プロバイダーごとの完全な内訳を出力します。
- CLI: `openclaw channels list` は、プロバイダー設定と並べて同じ使用状況スナップショットを出力します（スキップするには `--no-usage` を使用します）。
- macOS メニューバー: Context 配下の「Usage」セクション（利用可能な場合のみ）。

## プロバイダー + 認証情報

- **Anthropic（Claude）**: auth プロファイル内の OAuth トークン。
- **GitHub Copilot**: auth プロファイル内の OAuth トークン。
- **Gemini CLI**: auth プロファイル内の OAuth トークン。
- **Antigravity**: auth プロファイル内の OAuth トークン。
- **OpenAI Codex**: auth プロファイル内の OAuth トークン（存在する場合は accountId を使用します）。
- **MiniMax**: API キー（コーディングプランキー。`MINIMAX_CODE_PLAN_KEY` または `MINIMAX_API_KEY`）。5 時間のコーディングプランウィンドウを使用します。
- **z.ai**: env/config/auth ストア経由の API キー。

一致する OAuth/API の認証情報が存在しない場合、使用状況は非表示になります。
