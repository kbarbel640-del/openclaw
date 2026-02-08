---
summary: "grammY による Telegram Bot API 統合とセットアップノート"
read_when:
  - Telegram または grammY の経路に取り組んでいるとき
title: grammY
x-i18n:
  source_path: channels/grammy.md
  source_hash: ea7ef23e6d77801f
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:43:23Z
---

# grammY 統合（Telegram Bot API）

# grammY を選ぶ理由

- TS ファーストの Bot API クライアントで、組み込みの long-poll + webhook ヘルパー、ミドルウェア、エラーハンドリング、レートリミッターを備えています。
- fetch + FormData の手作業実装よりもメディア用ヘルパーが整っており、すべての Bot API メソッドをサポートします。
- 拡張可能です。カスタム fetch によるプロキシ対応、セッションミドルウェア（任意）、型安全なコンテキストを提供します。

# 出荷した内容

- **単一のクライアント経路:** fetch ベースの実装を削除し、grammY を Telegram クライアント（送信 + ゲートウェイ）として唯一のものにしました。grammY のスロットラーはデフォルトで有効です。
- **Gateway（ゲートウェイ）:** `monitorTelegramProvider` は grammY の `Bot` を構築し、メンション/許可リストのゲーティングを配線し、`getFile`/`download` によるメディアダウンロードを行い、`sendMessage/sendPhoto/sendVideo/sendAudio/sendDocument` で返信を配信します。`webhookCallback` により long-poll または webhook をサポートします。
- **プロキシ:** 任意の `channels.telegram.proxy` は、grammY の `client.baseFetch` を通じて `undici.ProxyAgent` を使用します。
- **Webhook サポート:** `webhook-set.ts` は `setWebhook/deleteWebhook` をラップします。`webhook.ts` はヘルスチェック + グレースフルシャットダウン付きでコールバックをホストします。Gateway（ゲートウェイ）は `channels.telegram.webhookUrl` + `channels.telegram.webhookSecret` が設定されている場合に webhook モードを有効にします（そうでなければ long-poll します）。
- **セッション:** ダイレクトチャットはエージェントのメインセッション（`agent:<agentId>:<mainKey>`）に集約されます。グループは `agent:<agentId>:telegram:group:<chatId>` を使用します。返信は同じチャンネルへルーティングされます。
- **設定ノブ:** `channels.telegram.botToken`、`channels.telegram.dmPolicy`、`channels.telegram.groups`（許可リスト + メンションのデフォルト）、`channels.telegram.allowFrom`、`channels.telegram.groupAllowFrom`、`channels.telegram.groupPolicy`、`channels.telegram.mediaMaxMb`、`channels.telegram.linkPreview`、`channels.telegram.proxy`、`channels.telegram.webhookSecret`、`channels.telegram.webhookUrl`。
- **ドラフトストリーミング:** 任意の `channels.telegram.streamMode` は、プライベートのトピックチャットで `sendMessageDraft`（Bot API 9.3+）を使用します。これはチャンネルのブロックストリーミングとは別です。
- **テスト:** grammY のモックはダイレクトメッセージ + グループのメンションゲーティングと送信（アウトバウンド）をカバーします。より多くのメディア/webhook フィクスチャは引き続き歓迎します。

未解決の質問

- Bot API 429 に遭遇した場合、任意の grammY プラグイン（スロットラー）が必要か。
- より構造化されたメディアテスト（ステッカー、ボイスノート）を追加する。
- webhook のリッスンポートを設定可能にする（現在は Gateway（ゲートウェイ）経由で配線しない限り 8787 固定）。
