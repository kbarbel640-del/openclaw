---
summary: "Gateway WebSocket プロトコル：ハンドシェイク、フレーム、バージョニング"
read_when:
  - Gateway WS クライアントの実装または更新時
  - プロトコル不一致や接続失敗のデバッグ時
  - プロトコルのスキーマ／モデルの再生成時
title: "Gateway プロトコル"
x-i18n:
  source_path: gateway/protocol.md
  source_hash: bdafac40d5356590
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:47Z
---

# Gateway プロトコル（WebSocket）

Gateway WS プロトコルは、OpenClaw の **単一のコントロールプレーン + ノードトランスポート** です。すべてのクライアント（CLI、Web UI、macOS アプリ、iOS/Android ノード、ヘッドレスノード）は WebSocket 経由で接続し、ハンドシェイク時に **ロール** + **スコープ** を宣言します。

## トランスポート

- WebSocket、JSON ペイロードを含むテキストフレーム。
- 最初のフレームは **必ず** `connect` リクエストでなければなりません。

## ハンドシェイク（接続）

Gateway → Client（事前接続チャレンジ）：

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": { "nonce": "…", "ts": 1737264000000 }
}
```

Client → Gateway：

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "cli",
      "version": "1.2.3",
      "platform": "macos",
      "mode": "operator"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "caps": [],
    "commands": [],
    "permissions": {},
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-cli/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

Gateway → Client：

```json
{
  "type": "res",
  "id": "…",
  "ok": true,
  "payload": { "type": "hello-ok", "protocol": 3, "policy": { "tickIntervalMs": 15000 } }
}
```

デバイストークンが発行される場合、`hello-ok` には次も含まれます：

```json
{
  "auth": {
    "deviceToken": "…",
    "role": "operator",
    "scopes": ["operator.read", "operator.write"]
  }
}
```

### ノードの例

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "ios-node",
      "version": "1.2.3",
      "platform": "ios",
      "mode": "node"
    },
    "role": "node",
    "scopes": [],
    "caps": ["camera", "canvas", "screen", "location", "voice"],
    "commands": ["camera.snap", "canvas.navigate", "screen.record", "location.get"],
    "permissions": { "camera.capture": true, "screen.record": false },
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-ios/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

## フレーミング

- **Request**：`{type:"req", id, method, params}`
- **Response**：`{type:"res", id, ok, payload|error}`
- **Event**：`{type:"event", event, payload, seq?, stateVersion?}`

副作用のあるメソッドには **冪等性キー** が必要です（スキーマを参照）。

## ロール + スコープ

### ロール

- `operator` = コントロールプレーンクライアント（CLI／UI／自動化）。
- `node` = 機能ホスト（camera／screen／canvas／system.run）。

### スコープ（オペレーター）

一般的なスコープ：

- `operator.read`
- `operator.write`
- `operator.admin`
- `operator.approvals`
- `operator.pairing`

### Caps／コマンド／権限（ノード）

ノードは接続時に機能クレームを宣言します：

- `caps`：高レベルの機能カテゴリ。
- `commands`：呼び出し用のコマンド許可リスト。
- `permissions`：粒度の細かいトグル（例：`screen.record`、`camera.capture`）。

Gateway はこれらを **クレーム** として扱い、サーバー側の許可リストを強制します。

## プレゼンス

- `system-presence` は、デバイス ID をキーにしたエントリを返します。
- プレゼンスエントリには `deviceId`、`roles`、および `scopes` が含まれ、**オペレーター** と **ノード** の両方として接続している場合でも、UI でデバイスごとに 1 行を表示できます。

### ノード向けヘルパーメソッド

- ノードは `skills.bins` を呼び出して、オートアロー判定のための現在の skill 実行ファイル一覧を取得できます。

## Exec 承認

- exec リクエストに承認が必要な場合、Gateway は `exec.approval.requested` をブロードキャストします。
- オペレータークライアントは `exec.approval.resolve` を呼び出して解決します（`operator.approvals` スコープが必要）。

## バージョニング

- `PROTOCOL_VERSION` は `src/gateway/protocol/schema.ts` に存在します。
- クライアントは `minProtocol` + `maxProtocol` を送信し、サーバーは不一致を拒否します。
- スキーマ + モデルは TypeBox 定義から生成されます：
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`
  - `pnpm protocol:check`

## 認証

- `OPENCLAW_GATEWAY_TOKEN`（または `--token`）が設定されている場合、`connect.params.auth.token` が一致しなければソケットはクローズされます。
- ペアリング後、Gateway は接続ロール + スコープにスコープされた **デバイストークン** を発行します。これは `hello-ok.auth.deviceToken` で返され、将来の接続のためにクライアントが永続化する必要があります。
- デバイストークンは `device.token.rotate` および `device.token.revoke` によりローテーション／失効できます（`operator.pairing` スコープが必要）。

## デバイス ID + ペアリング

- ノードは、鍵ペアのフィンガープリントから派生した安定したデバイス ID（`device.id`）を含める必要があります。
- Gateway はデバイス + ロールごとにトークンを発行します。
- 新しいデバイス ID には、ローカルの自動承認が有効でない限り、ペアリング承認が必要です。
- **ローカル** 接続には loopback と Gateway ホスト自身の tailnet アドレスが含まれます（同一ホストの tailnet バインドでも自動承認できるようにするため）。
- すべての WS クライアントは、`connect`（オペレーター + ノード）中に `device` の ID を含める必要があります。
  コントロール UI は、`gateway.controlUi.allowInsecureAuth` が有効な場合 **のみ** 省略できます（またはブレークグラス用途では `gateway.controlUi.dangerouslyDisableDeviceAuth`）。
- 非ローカル接続は、サーバー提供の `connect.challenge` ノンスに署名する必要があります。

## TLS + ピンニング

- WS 接続で TLS がサポートされます。
- クライアントは、Gateway 証明書のフィンガープリントを任意でピン留めできます（`gateway.tls` 設定、ならびに `gateway.remote.tlsFingerprint` または CLI の `--tls-fingerprint` を参照）。

## スコープ

このプロトコルは **Gateway API の全体**（ステータス、チャンネル、モデル、チャット、エージェント、セッション、ノード、承認など）を公開します。正確な API サーフェスは、`src/gateway/protocol/schema.ts` の TypeBox スキーマで定義されています。
