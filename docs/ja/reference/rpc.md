---
summary: "外部 CLI（signal-cli、レガシー imsg）向けの RPC アダプターと Gateway（ゲートウェイ）パターン"
read_when:
  - 外部 CLI 連携を追加または変更する場合
  - RPC アダプター（signal-cli、imsg）をデバッグする場合
title: "RPC アダプター"
x-i18n:
  source_path: reference/rpc.md
  source_hash: 06dc6b97184cc704
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:45Z
---

# RPC アダプター

OpenClaw は JSON-RPC を介して外部 CLI を統合します。現在、2 つのパターンが使用されています。

## パターン A: HTTP デーモン（signal-cli）

- `signal-cli` は HTTP 上の JSON-RPC を提供するデーモンとして実行されます。
- イベントストリームは SSE（`/api/v1/events`）です。
- ヘルスプローブ: `/api/v1/check`。
- `channels.signal.autoStart=true` の場合、OpenClaw がライフサイクルを所有します。

セットアップとエンドポイントについては [Signal](/channels/signal) を参照してください。

## パターン B: stdio 子プロセス（レガシー: imsg）

> **注記:** 新しい iMessage セットアップには、代わりに [BlueBubbles](/channels/bluebubbles) を使用してください。

- OpenClaw は `imsg rpc` を子プロセスとして起動します（レガシー iMessage 連携）。
- JSON-RPC は stdin/stdout 上で行区切り（1 行につき 1 つの JSON オブジェクト）です。
- TCP ポートは不要で、デーモンも必要ありません。

使用されるコアメソッド:

- `watch.subscribe` → 通知（`method: "message"`）
- `watch.unsubscribe`
- `send`
- `chats.list`（プローブ/診断）

レガシーのセットアップとアドレッシングについては [iMessage](/channels/imessage) を参照してください（`chat_id` が推奨）。

## アダプターのガイドライン

- Gateway（ゲートウェイ）がプロセスを所有します（開始/停止はプロバイダーのライフサイクルに連動）。
- RPC クライアントは堅牢に保ちます。タイムアウトの設定や、終了時の再起動を行ってください。
- 表示文字列よりも安定した ID（例: `chat_id`）を優先してください。
