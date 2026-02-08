---
summary: "計画: OpenResponses /v1/responses エンドポイントを追加し、チャット補完をクリーンに非推奨化します"
owner: "openclaw"
status: "draft"
last_updated: "2026-01-19"
title: "OpenResponses Gateway（ゲートウェイ）計画"
x-i18n:
  source_path: experiments/plans/openresponses-gateway.md
  source_hash: 71a22c48397507d1
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:20:46Z
---

# OpenResponses Gateway（ゲートウェイ）統合計画

## コンテキスト

OpenClaw Gateway（ゲートウェイ）は現在、OpenAI 互換の最小限の Chat Completions エンドポイントを
`/v1/chat/completions` で公開しています（[OpenAI Chat Completions](/gateway/openai-http-api) を参照）。

Open Responses は、OpenAI Responses API に基づくオープンな推論標準です。これはエージェント的なワークフロー向けに設計されており、アイテムベースの入力に加えてセマンティックなストリーミングイベントを使用します。OpenResponses の仕様は `/v1/responses` を定義しており、`/v1/chat/completions` ではありません。

## 目標

- OpenResponses のセマンティクスに準拠する `/v1/responses` エンドポイントを追加します。
- Chat Completions は互換レイヤーとして維持し、無効化しやすく、最終的には削除できるようにします。
- 分離された再利用可能なスキーマにより、バリデーションとパースを標準化します。

## 非目標

- 初回パスでの OpenResponses 完全な機能同等性（画像、ファイル、ホスト型ツール）。
- 内部のエージェント実行ロジックやツール・オーケストレーションの置き換え。
- 第 1 フェーズ中に既存の `/v1/chat/completions` の挙動を変更すること。

## 調査サマリー

情報源: OpenResponses OpenAPI、OpenResponses 仕様サイト、および Hugging Face のブログ投稿。

抽出した要点:

- `POST /v1/responses` は `CreateResponseBody` フィールド（例: `model`、`input`（文字列または
  `ItemParam[]`）、`instructions`、`tools`、`tool_choice`、`stream`、`max_output_tokens`、および
  `max_tool_calls`）を受け付けます。
- `ItemParam` は、次の判別可能なユニオンです:
  - ロール `system`、`developer`、`user`、`assistant` を持つ `message` アイテム
  - `function_call` と `function_call_output`
  - `reasoning`
  - `item_reference`
- 成功レスポンスは `object: "response"`、`status`、および
  `output` アイテムを含む `ResponseResource` を返します。
- ストリーミングは、次のようなセマンティックイベントを使用します:
  - `response.created`、`response.in_progress`、`response.completed`、`response.failed`
  - `response.output_item.added`、`response.output_item.done`
  - `response.content_part.added`、`response.content_part.done`
  - `response.output_text.delta`、`response.output_text.done`
- 仕様が要求する事項:
  - `Content-Type: text/event-stream`
  - `event:` は JSON の `type` フィールドと一致しなければなりません
  - 終端イベントはリテラルな `[DONE]` でなければなりません
- 推論アイテムは `content`、`encrypted_content`、および `summary` を公開する場合があります。
- HF の例では、リクエストに `OpenResponses-Version: latest`（任意ヘッダー）が含まれます。

## 提案アーキテクチャ

- Zod スキーマのみ（gateway の import なし）を含む `src/gateway/open-responses.schema.ts` を追加します。
- `/v1/responses` 用に `src/gateway/openresponses-http.ts`（または `open-responses-http.ts`）を追加します。
- レガシー互換アダプターとして `src/gateway/openai-http.ts` をそのまま維持します。
- 設定 `gateway.http.endpoints.responses.enabled`（デフォルト `false`）を追加します。
- `gateway.http.endpoints.chatCompletions.enabled` は独立のままにし、両方のエンドポイントを
  それぞれ別にトグルできるようにします。
- Chat Completions が有効な場合、レガシー状態を示すために起動時警告を出力します。

## Chat Completions の非推奨化パス

- 厳格なモジュール境界を維持します: responses と chat completions の間でスキーマ型を共有しません。
- Chat Completions を設定でオプトインにし、コード変更なしで無効化できるようにします。
- `/v1/responses` が安定したら、ドキュメントを更新して Chat Completions をレガシーとしてラベル付けします。
- 将来の任意ステップ: より簡単な削除パスのために、Chat Completions リクエストを Responses ハンドラーへマップします。

## フェーズ 1 のサポートサブセット

- `input` を文字列、またはメッセージロールと `function_call_output` を持つ `ItemParam[]` として受け付けます。
- system および developer メッセージを `extraSystemPrompt` に抽出します。
- エージェント実行の現在メッセージとして、最新の `user` または `function_call_output` を使用します。
- 未対応のコンテンツパート（画像/ファイル）は `invalid_request_error` で拒否します。
- `output_text` コンテンツを持つ単一の assistant メッセージを返します。
- トークン会計が接続されるまで、ゼロ化した値の `usage` を返します。

## バリデーション戦略（SDK なし）

- 次のサポートサブセットに対する Zod スキーマを実装します:
  - `CreateResponseBody`
  - `ItemParam` + メッセージコンテンツパートのユニオン
  - `ResponseResource`
  - Gateway（ゲートウェイ）で使用されるストリーミングイベント形状
- スキーマは単一の分離モジュールに保持し、ドリフトを回避し、将来のコード生成を可能にします。

## ストリーミング実装（フェーズ 1）

- `event:` と `data:` の両方を含む SSE 行。
- 必須シーケンス（最小実用）:
  - `response.created`
  - `response.output_item.added`
  - `response.content_part.added`
  - `response.output_text.delta`（必要に応じて繰り返し）
  - `response.output_text.done`
  - `response.content_part.done`
  - `response.completed`
  - `[DONE]`

## テストおよび検証計画

- `/v1/responses` に対する e2e カバレッジを追加します:
  - 認証必須
  - 非ストリームのレスポンス形状
  - ストリームイベントの順序と `[DONE]`
  - ヘッダーと `user` によるセッションルーティング
- `src/gateway/openai-http.e2e.test.ts` は変更しません。
- 手動: `stream: true` を付けて `/v1/responses` へ curl し、イベント順序と終端
  `[DONE]` を検証します。

## ドキュメント更新（フォローアップ）

- `/v1/responses` の使用方法と例のための新しい docs ページを追加します。
- `/gateway/openai-http-api` を更新し、レガシー注記と `/v1/responses` へのポインターを追加します。
