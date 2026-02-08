---
summary: "WebSocket ゲートウェイのアーキテクチャ、コンポーネント、クライアントフロー"
read_when:
  - Gateway（ゲートウェイ）プロトコル、クライアント、またはトランスポートに取り組んでいるとき
title: "Gateway（ゲートウェイ）アーキテクチャ"
x-i18n:
  source_path: concepts/architecture.md
  source_hash: c636d5d8a5e62806
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:01:55Z
---

# Gateway（ゲートウェイ）アーキテクチャ

最終更新日: 2026-01-22

## 概要

- 単一の長寿命 **Gateway（ゲートウェイ）** が、すべてのメッセージングサーフェス（Baileys 経由の WhatsApp、grammY 経由の Telegram、Slack、Discord、Signal、iMessage、WebChat）を所有します。
- コントロールプレーンのクライアント（macOS アプリ、CLI、Web UI、自動化）は、設定されたバインドホスト（デフォルト `127.0.0.1:18789`）上の **WebSocket** 経由で Gateway（ゲートウェイ）に接続します。
- **Nodes**（macOS/iOS/Android/headless）も **WebSocket** 経由で接続しますが、明示的な caps/commands とともに `role: node` を宣言します。
- ホストあたり 1 つの Gateway（ゲートウェイ）。WhatsApp セッションを開くのはここだけです。
- **キャンバスホスト**（デフォルト `18793`）は、エージェントが編集可能な HTML と A2UI を提供します。

## コンポーネントとフロー

### Gateway（ゲートウェイ）(デーモン)

- プロバイダー接続を維持します。
- 型付きの WS API（リクエスト、レスポンス、サーバープッシュイベント）を公開します。
- 受信フレームを JSON Schema に対して検証します。
- `agent`、`chat`、`presence`、`health`、`heartbeat`、`cron` のようなイベントを発行します。

### クライアント（mac アプリ / CLI / Web 管理）

- クライアントあたり 1 つの WS 接続。
- リクエスト（`health`、`status`、`send`、`agent`、`system-presence`）を送信します。
- イベント（`tick`、`agent`、`presence`、`shutdown`）を購読します。

### Nodes（macOS / iOS / Android / headless）

- `role: node` を付けて **同じ WS サーバー** に接続します。
- `connect` でデバイスアイデンティティを提供します。ペアリングは **デバイスベース**（ロール `node`）で、承認はデバイスのペアリングストアに保存されます。
- `canvas.*`、`camera.*`、`screen.record`、`location.get` のようなコマンドを公開します。

プロトコルの詳細:

- [Gateway protocol](/gateway/protocol)

### WebChat

- Gateway（ゲートウェイ）の WS API を使用してチャット履歴と送信を行う静的 UI です。
- リモート構成では、他のクライアントと同じ SSH/Tailscale トンネル経由で接続します。

## 接続ライフサイクル（単一クライアント）

```
Client                    Gateway
  |                          |
  |---- req:connect -------->|
  |<------ res (ok) ---------|   (or res error + close)
  |   (payload=hello-ok carries snapshot: presence + health)
  |                          |
  |<------ event:presence ---|
  |<------ event:tick -------|
  |                          |
  |------- req:agent ------->|
  |<------ res:agent --------|   (ack: {runId,status:"accepted"})
  |<------ event:agent ------|   (streaming)
  |<------ res:agent --------|   (final: {runId,status,summary})
  |                          |
```

## ワイヤプロトコル（概要）

- トランスポート: WebSocket、JSON ペイロードを持つテキストフレーム。
- 最初のフレームは必ず `connect` でなければなりません。
- ハンドシェイク後:
  - リクエスト: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - イベント: `{type:"event", event, payload, seq?, stateVersion?}`
- `OPENCLAW_GATEWAY_TOKEN`（または `--token`）が設定されている場合、`connect.params.auth.token` が一致しないとソケットはクローズされます。
- 冪等性キーは、副作用を伴うメソッド（`send`、`agent`）で安全に再試行するために必須です。サーバーは短命の重複排除キャッシュを保持します。
- Nodes は `role: "node"` に加えて、`connect` に caps/commands/permissions を含める必要があります。

## ペアリング + ローカルトラスト

- すべての WS クライアント（オペレーター + nodes）は、`connect` で **デバイスアイデンティティ** を含めます。
- 新しいデバイス ID にはペアリング承認が必要です。Gateway（ゲートウェイ）は、その後の接続のために **デバイストークン** を発行します。
- **ローカル** 接続（loopback または Gateway（ゲートウェイ）ホスト自身の tailnet アドレス）は、同一ホストの UX を滑らかに保つために自動承認できます。
- **非ローカル** 接続は `connect.challenge` nonce に署名する必要があり、明示的な承認が必要です。
- Gateway（ゲートウェイ）認証（`gateway.auth.*`）は、ローカル・リモートを問わず **すべて** の接続に適用されます。

詳細: [Gateway protocol](/gateway/protocol), [Pairing](/start/pairing),
[Security](/gateway/security).

## プロトコルの型付けとコード生成

- TypeBox スキーマがプロトコルを定義します。
- JSON Schema はそれらのスキーマから生成されます。
- Swift モデルは JSON Schema から生成されます。

## リモートアクセス

- 推奨: Tailscale または VPN。
- 代替: SSH トンネル
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- トンネル越しでも、同じハンドシェイク + 認証トークンが適用されます。
- リモート構成では、WS の TLS + 任意のピンニングを有効化できます。

## 運用スナップショット

- 起動: `openclaw gateway`（フォアグラウンド、stdout にログ）。
- ヘルス: WS 経由の `health`（`hello-ok` にも含まれます）。
- 監督: 自動再起動のための launchd/systemd。

## 不変条件

- ホストあたり、ちょうど 1 つの Gateway（ゲートウェイ）が単一の Baileys セッションを制御します。
- ハンドシェイクは必須です。非 JSON、または connect 以外の先頭フレームは強制クローズになります。
- イベントはリプレイされません。クライアントは欠落があった場合に更新する必要があります。
