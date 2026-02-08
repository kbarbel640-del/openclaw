---
summary: "mac アプリが Gateway WebChat をどのように埋め込み、どのようにデバッグするか"
read_when:
  - mac WebChat ビューまたは loopback ポートのデバッグ時
title: "WebChat"
x-i18n:
  source_path: platforms/mac/webchat.md
  source_hash: 04ff448758e53009
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:27Z
---

# WebChat（macOS アプリ）

macOS のメニューバーアプリは、WebChat UI をネイティブな SwiftUI ビューとして埋め込みます。Gateway に接続し、選択されたエージェントの **メインセッション** をデフォルトで使用します（他のセッションに切り替えるためのセッションスイッチャーを備えています）。

- **ローカルモード**：ローカルの Gateway WebSocket に直接接続します。
- **リモートモード**：Gateway のコントロールポートを SSH 経由でフォワードし、そのトンネルをデータプレーンとして使用します。

## 起動とデバッグ

- 手動：Lobster メニュー → 「Open Chat」。
- テスト用の自動オープン：
  ```bash
  dist/OpenClaw.app/Contents/MacOS/OpenClaw --webchat
  ```
- ログ：`./scripts/clawlog.sh`（サブシステム `bot.molt`、カテゴリ `WebChatSwiftUI`）。

## 配線の仕組み

- データプレーン：Gateway WS メソッド `chat.history`、`chat.send`、`chat.abort`、
  `chat.inject` と、イベント `chat`、`agent`、`presence`、`tick`、`health`。
- セッション：デフォルトはプライマリセッション（`main`、スコープがグローバルの場合は `global`）です。UI からセッションを切り替えられます。
- オンボーディングでは、初回実行時のセットアップを分離するために専用のセッションを使用します。

## セキュリティ表面

- リモートモードでは、Gateway WebSocket のコントロールポートのみを SSH 経由でフォワードします。

## 既知の制限事項

- UI はチャットセッション向けに最適化されています（完全なブラウザのサンドボックスではありません）。
