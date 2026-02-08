---
summary: "iOS およびその他のリモートノード向けの Gateway 管理ノードペアリング（オプション B）"
read_when:
  - macOS UI なしでノードペアリング承認を実装する場合
  - リモートノードを承認する CLI フローを追加する場合
  - ノード管理を含む Gateway プロトコルを拡張する場合
title: "Gateway 管理のペアリング"
x-i18n:
  source_path: gateway/pairing.md
  source_hash: 1f5154292a75ea2c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:45Z
---

# Gateway 管理のペアリング（オプション B）

Gateway 管理のペアリングでは、**Gateway（ゲートウェイ）** が、参加を許可されるノードの信頼できる情報源です。UI（macOS アプリ、将来のクライアント）は、保留中のリクエストを承認または拒否するためのフロントエンドにすぎません。

**重要:** WS ノードは、`connect` の間に **device pairing**（ロール `node`）を使用します。`node.pair.*` は別個のペアリングストアであり、WS ハンドシェイクを **制御しません**。このフローを使用するのは、明示的に `node.pair.*` を呼び出すクライアントのみです。

## 概念

- **保留中のリクエスト**: 参加を要求したノード。承認が必要です。
- **ペアリング済みノード**: 承認され、認証トークンが発行されたノード。
- **トランスポート**: Gateway の WS エンドポイントはリクエストを転送しますが、メンバーシップは決定しません。（レガシーの TCP ブリッジ対応は非推奨／削除済みです。）

## ペアリングの仕組み

1. ノードが Gateway の WS に接続し、ペアリングを要求します。
2. Gateway は **保留中のリクエスト** を保存し、`node.pair.requested` を発行します。
3. リクエストを承認または拒否します（CLI または UI）。
4. 承認時、Gateway は **新しいトークン** を発行します（再ペアリング時にはトークンがローテーションされます）。
5. ノードはトークンを使用して再接続し、「ペアリング済み」になります。

保留中のリクエストは **5 分** 後に自動的に失効します。

## CLI ワークフロー（ヘッドレス向け）

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes reject <requestId>
openclaw nodes status
openclaw nodes rename --node <id|name|ip> --name "Living Room iPad"
```

`nodes status` は、ペアリング済み／接続中のノードとその機能を表示します。

## API サーフェス（Gateway プロトコル）

イベント:

- `node.pair.requested` — 新しい保留中のリクエストが作成されたときに発行されます。
- `node.pair.resolved` — リクエストが承認／拒否／失効したときに発行されます。

メソッド:

- `node.pair.request` — 保留中のリクエストを作成または再利用します。
- `node.pair.list` — 保留中 + ペアリング済みノードを一覧表示します。
- `node.pair.approve` — 保留中のリクエストを承認します（トークンを発行）。
- `node.pair.reject` — 保留中のリクエストを拒否します。
- `node.pair.verify` — `{ nodeId, token }` を検証します。

注意事項:

- `node.pair.request` はノードごとに冪等です。繰り返し呼び出しても同じ保留中のリクエストが返されます。
- 承認は **常に** 新しいトークンを生成します。`node.pair.request` からトークンが返されることはありません。
- リクエストには、自動承認フローのヒントとして `silent: true` を含めることができます。

## 自動承認（macOS アプリ）

macOS アプリは、次の場合に **サイレント承認** を任意で試行できます。

- リクエストが `silent` としてマークされており、
- 同じユーザーを使用して Gateway ホストへの SSH 接続を検証できる場合。

サイレント承認に失敗した場合は、通常の「承認／拒否」プロンプトにフォールバックします。

## ストレージ（ローカル、非公開）

ペアリング状態は Gateway の状態ディレクトリ（デフォルトは `~/.openclaw`）配下に保存されます。

- `~/.openclaw/nodes/paired.json`
- `~/.openclaw/nodes/pending.json`

`OPENCLAW_STATE_DIR` を上書きした場合、`nodes/` フォルダーもそれに伴って移動します。

セキュリティに関する注意:

- トークンは機密情報です。`paired.json` は機微情報として取り扱ってください。
- トークンのローテーションには再承認が必要です（またはノードエントリを削除します）。

## トランスポートの挙動

- トランスポートは **ステートレス** であり、メンバーシップを保存しません。
- Gateway がオフライン、またはペアリングが無効な場合、ノードはペアリングできません。
- Gateway がリモートモードの場合でも、ペアリングはリモート Gateway のストアに対して行われます。
