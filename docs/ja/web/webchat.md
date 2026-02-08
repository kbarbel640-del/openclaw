---
summary: "local loopback WebChat の静的ホストと、チャット UI 向けの Gateway（ゲートウェイ）WS の使用方法"
read_when:
  - WebChat アクセスのデバッグまたは設定を行うとき
title: "WebChat"
x-i18n:
  source_path: web/webchat.md
  source_hash: b5ee2b462c8c979a
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:52Z
---

# WebChat（Gateway（ゲートウェイ）WebSocket UI）

ステータス: macOS/iOS の SwiftUI チャット UI は Gateway（ゲートウェイ）WebSocket と直接通信します。

## これは何ですか

- ゲートウェイ向けのネイティブなチャット UI（埋め込みブラウザなし、ローカル静的サーバーなし）です。
- 他のチャンネルと同じセッションおよびルーティングルールを使用します。
- 決定論的ルーティング: 返信は常に WebChat に戻ります。

## クイックスタート

1. ゲートウェイを起動します。
2. WebChat UI（macOS/iOS アプリ）または Control UI のチャットタブを開きます。
3. ゲートウェイ認証が設定されていることを確認します（local loopback 上でも、デフォルトでは必須です）。

## 仕組み（挙動）

- UI は Gateway（ゲートウェイ）WebSocket に接続し、`chat.history`、`chat.send`、および `chat.inject` を使用します。
- `chat.inject` は、アシスタントノートをトランスクリプトに直接追記して UI にブロードキャストします（エージェントの実行はありません）。
- 履歴は常にゲートウェイから取得されます（ローカルファイルの監視はありません）。
- ゲートウェイに到達できない場合、WebChat は読み取り専用になります。

## リモート利用

- リモートモードは、SSH/Tailscale を介してゲートウェイ WebSocket をトンネルします。
- 別の WebChat サーバーを実行する必要はありません。

## 設定リファレンス（WebChat）

完全な設定: [Configuration](/gateway/configuration)

チャンネルオプション:

- 専用の `webchat.*` ブロックはありません。WebChat は、以下のゲートウェイエンドポイント + 認証設定を使用します。

関連するグローバルオプション:

- `gateway.port`、`gateway.bind`: WebSocket のホスト/ポート。
- `gateway.auth.mode`、`gateway.auth.token`、`gateway.auth.password`: WebSocket 認証。
- `gateway.remote.url`、`gateway.remote.token`、`gateway.remote.password`: リモートゲートウェイターゲット。
- `session.*`: セッションストレージとメインキーのデフォルト。
