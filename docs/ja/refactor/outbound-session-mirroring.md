---
title: アウトバウンド セッション ミラーリングのリファクタリング（Issue #1520）
description: Track outbound session mirroring refactor notes, decisions, tests, and open items.
x-i18n:
  source_path: refactor/outbound-session-mirroring.md
  source_hash: b88a72f36f7b6d8a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:50Z
---

# アウトバウンド セッション ミラーリングのリファクタリング（Issue #1520）

## ステータス

- 進行中です。
- アウトバウンド ミラーリング向けに、コアおよびプラグインのチャンネル ルーティングを更新しました。
- Gateway（ゲートウェイ）の send は、sessionKey が省略された場合にターゲット セッションを導出するようになりました。

## コンテキスト

アウトバウンド送信は、ターゲット チャンネル セッションではなく「現在」のエージェント セッション（ツールのセッション キー）にミラーリングされていました。インバウンド ルーティングはチャンネル／ピアのセッション キーを使用するため、アウトバウンド応答が誤ったセッションに着地し、初回接触のターゲットではセッション エントリーが存在しないことが多くありました。

## 目標

- アウトバウンド メッセージをターゲット チャンネルのセッション キーにミラーリングする。
- 不足している場合は、アウトバウンド時にセッション エントリーを作成する。
- スレッド／トピックのスコープをインバウンド セッション キーと整合させる。
- コア チャンネルおよび同梱拡張を網羅する。

## 実装概要

- 新しいアウトバウンド セッション ルーティング ヘルパー:
  - `src/infra/outbound/outbound-session.ts`
  - `resolveOutboundSessionRoute` は、`buildAgentSessionKey`（dmScope + identityLinks）を用いてターゲット sessionKey を構築します。
  - `ensureOutboundSessionEntry` は、`recordSessionMetaFromInbound` を介して最小限の `MsgContext` を書き込みます。
- `runMessageAction`（send）はターゲット sessionKey を導出し、ミラーリングのために `executeSendAction` に渡します。
- `message-tool` は直接ミラーリングを行わなくなり、現在のセッション キーから agentId を解決するのみになります。
- プラグインの send パスは、導出された sessionKey を用いて `appendAssistantMessageToSessionTranscript` 経由でミラーリングします。
- Gateway（ゲートウェイ）の send は、提供されていない場合にターゲット セッション キー（デフォルト エージェント）を導出し、セッション エントリーを確実に作成します。

## スレッド／トピックの扱い

- Slack: replyTo / threadId → `resolveThreadSessionKeys`（サフィックス）。
- Discord: threadId / replyTo → `resolveThreadSessionKeys`（インバウンドに合わせるため `useSuffix=false` を使用。スレッド チャンネル ID がすでにセッションをスコープしています）。
- Telegram: トピック ID は `buildTelegramGroupPeerId` を介して `chatId:topic:<id>` にマップされます。

## 対応した拡張

- Matrix、MS Teams、Mattermost、BlueBubbles、Nextcloud Talk、Zalo、Zalo Personal、Nostr、Tlon。
- 注記:
  - Mattermost のターゲットは、DM セッション キー ルーティングのために `@` を削除するようになりました。
  - Zalo Personal は、1:1 ターゲットに DM ピア種別を使用します（`group:` が存在する場合のみグループ）。
  - BlueBubbles のグループ ターゲットは、インバウンド セッション キーに合わせるために `chat_*` プレフィックスを削除します。
  - Slack の自動スレッド ミラーリングは、チャンネル ID を大文字小文字を区別せずに一致させます。
  - Gateway（ゲートウェイ）の send は、提供されたセッション キーをミラーリング前に小文字化します。

## 決定事項

- **Gateway（ゲートウェイ）の send におけるセッション導出**: `sessionKey` が提供されている場合はそれを使用します。省略された場合は、ターゲット + デフォルト エージェントから sessionKey を導出し、そこにミラーリングします。
- **セッション エントリーの作成**: 常に `recordSessionMetaFromInbound` を使用し、`Provider/From/To/ChatType/AccountId/Originating*` はインバウンド形式に整合させます。
- **ターゲット正規化**: アウトバウンド ルーティングでは、利用可能な場合は（`resolveChannelTarget` 後の）解決済みターゲットを使用します。
- **セッション キーの大文字小文字**: 書き込み時およびマイグレーション中に、セッション キーを小文字に正規化します。

## 追加／更新されたテスト

- `src/infra/outbound/outbound-session.test.ts`
  - Slack のスレッド セッション キー。
  - Telegram のトピック セッション キー。
  - Discord における dmScope identityLinks。
- `src/agents/tools/message-tool.test.ts`
  - セッション キーから agentId を導出（sessionKey をパススルーしない）。
- `src/gateway/server-methods/send.test.ts`
  - 省略時にセッション キーを導出し、セッション エントリーを作成。

## 未対応項目／フォローアップ

- 音声通話プラグインはカスタムの `voice:<phone>` セッション キーを使用します。ここでのアウトバウンド マッピングは標準化されていません。メッセージ ツールが音声通話送信をサポートする必要がある場合は、明示的なマッピングを追加してください。
- 同梱セット以外で、非標準の `From/To` 形式を使用している外部プラグインが存在しないか確認してください。

## 変更されたファイル

- `src/infra/outbound/outbound-session.ts`
- `src/infra/outbound/outbound-send-service.ts`
- `src/infra/outbound/message-action-runner.ts`
- `src/agents/tools/message-tool.ts`
- `src/gateway/server-methods/send.ts`
- テスト:
  - `src/infra/outbound/outbound-session.test.ts`
  - `src/agents/tools/message-tool.test.ts`
  - `src/gateway/server-methods/send.test.ts`
