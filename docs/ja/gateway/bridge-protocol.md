---
summary: "ブリッジプロトコル（レガシーノード）：TCP JSONL、ペアリング、スコープ付き RPC"
read_when:
  - iOS/Android/macOS のノードモード向けノードクライアントを構築またはデバッグする場合
  - ペアリングまたはブリッジ認証の失敗を調査する場合
  - Gateway（ゲートウェイ）によって公開されるノードのサーフェスを監査する場合
title: "ブリッジプロトコル"
x-i18n:
  source_path: gateway/bridge-protocol.md
  source_hash: 789bcf3cbc6841fc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:21:36Z
---

# ブリッジプロトコル（レガシーノードトランスポート）

ブリッジプロトコルは **レガシー** のノードトランスポート（TCP JSONL）です。新しいノードクライアントは、代わりに統合された Gateway（ゲートウェイ） WebSocket プロトコルを使用してください。

オペレーターまたはノードクライアントを構築している場合は、
[Gateway プロトコル](/gateway/protocol) を使用してください。

**注:** 現行の OpenClaw ビルドには TCP ブリッジリスナーは同梱されなくなりました。本ドキュメントは履歴参照のために保持されています。
レガシーの `bridge.*` 設定キーは、もはや設定スキーマの一部ではありません。

## 両方が存在する理由

- **セキュリティ境界**: ブリッジは、Gateway（ゲートウェイ） API の全サーフェスではなく、小さな許可リストを公開します。
- **ペアリング + ノード ID**: ノードの受け入れは Gateway（ゲートウェイ）が管理し、ノードごとのトークンに結び付けられます。
- **デバイス検出 UX**: ノードは LAN 上で Bonjour により Gateway（ゲートウェイ）を検出でき、または tailnet 経由で直接接続できます。
- **Loopback WS**: SSH でトンネルされない限り、WS の完全なコントロールプレーンはローカルに留まります。

## トランスポート

- TCP、1 行につき 1 つの JSON オブジェクト（JSONL）。
- 任意で TLS（`bridge.tls.enabled` が true の場合）。
- レガシーのデフォルトのリスナーポートは `18790` でした（現行ビルドは TCP ブリッジを開始しません）。

TLS が有効な場合、デバイス検出 TXT レコードには `bridgeTls=1` に加えて
`bridgeTlsSha256` が含まれ、ノードが証明書をピン留めできるようになります。

## ハンドシェイク + ペアリング

1. クライアントが、ノードのメタデータ + トークン（すでにペアリング済みの場合）を含む `hello` を送信します。
2. 未ペアリングの場合、Gateway（ゲートウェイ）は `error`（`NOT_PAIRED`/`UNAUTHORIZED`）を返信します。
3. クライアントが `pair-request` を送信します。
4. Gateway（ゲートウェイ）は承認を待機し、その後 `pair-ok` と `hello-ok` を送信します。

`hello-ok` は `serverName` を返し、`canvasHostUrl` を含む場合があります。

## フレーム

クライアント → Gateway（ゲートウェイ）:

- `req` / `res`: スコープ付きの Gateway（ゲートウェイ） RPC（chat、sessions、config、health、voicewake、skills.bins）
- `event`: ノードシグナル（音声トランスクリプト、エージェント要求、チャット購読、exec ライフサイクル）

Gateway（ゲートウェイ） → クライアント:

- `invoke` / `invoke-res`: ノードコマンド（`canvas.*`、`camera.*`、`screen.record`、
  `location.get`、`sms.send`）
- `event`: 購読されたセッションに対するチャット更新
- `ping` / `pong`: keepalive

レガシーの許可リスト強制は `src/gateway/server-bridge.ts` にありました（削除済み）。

## Exec ライフサイクルイベント

ノードは `exec.finished` または `exec.denied` イベントを送出して、system.run のアクティビティを表出できます。
これらは Gateway（ゲートウェイ）内の system イベントにマッピングされます。（レガシーノードは引き続き `exec.started` を送出する場合があります。）

ペイロードフィールド（注記がない限りすべて任意）:

- `sessionKey`（必須）: system イベントを受信するエージェントセッション。
- `runId`: グルーピング用の一意な exec id。
- `command`: 生の、または整形済みのコマンド文字列。
- `exitCode`、`timedOut`、`success`、`output`: 完了の詳細（finished のみ）。
- `reason`: 拒否理由（denied のみ）。

## Tailnet の使用

- ブリッジを tailnet IP にバインドします: `~/.openclaw/openclaw.json` 内の `bridge.bind: "tailnet"`。
- クライアントは MagicDNS 名または tailnet IP 経由で接続します。
- Bonjour はネットワークを **跨ぎません**。必要に応じて手動のホスト/ポート、または広域 DNS‑SD を使用してください。

## バージョニング

ブリッジは現在 **暗黙の v1**（min/max のネゴシエーションなし）です。後方互換は期待されます。破壊的変更の前には、ブリッジプロトコルのバージョンフィールドを追加してください。
