---
summary: "Gateway ダッシュボード向けに統合された Tailscale Serve / Funnel"
read_when:
  - localhost の外部に Gateway Control UI を公開する場合
  - tailnet または公開ダッシュボードへのアクセスを自動化する場合
title: "Tailscale"
x-i18n:
  source_path: gateway/tailscale.md
  source_hash: c900c70a9301f290
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:08Z
---

# Tailscale（Gateway ダッシュボード）

OpenClaw は、Gateway ダッシュボードおよび WebSocket ポート向けに、Tailscale の **Serve**（tailnet）または **Funnel**（公開）を自動設定できます。これにより、Gateway は loopback にバインドされたまま、Tailscale が HTTPS、ルーティング、（Serve の場合）アイデンティティヘッダーを提供します。

## モード

- `serve`: `tailscale serve` による tailnet 専用 Serve。Gateway は `127.0.0.1` に留まります。
- `funnel`: `tailscale funnel` による公開 HTTPS。OpenClaw には共有パスワードが必要です。
- `off`: デフォルト（Tailscale の自動化なし）。

## 認証

ハンドシェイクを制御するために `gateway.auth.mode` を設定します。

- `token`（`OPENCLAW_GATEWAY_TOKEN` が設定されている場合のデフォルト）
- `password`（`OPENCLAW_GATEWAY_PASSWORD` または設定による共有シークレット）

`tailscale.mode = "serve"` が有効で、かつ `gateway.auth.allowTailscale` が `true` の場合、有効な Serve プロキシリクエストは、トークン／パスワードを提示せずに Tailscale のアイデンティティヘッダー（`tailscale-user-login`）で認証できます。OpenClaw は、ローカルの Tailscale デーモン（`tailscale whois`）を介して `x-forwarded-for` アドレスを解決し、ヘッダーと照合することでアイデンティティを検証してから受け入れます。OpenClaw は、loopback から到着し、かつ Tailscale の `x-forwarded-for`、`x-forwarded-proto`、`x-forwarded-host` ヘッダーを備える場合にのみ、リクエストを Serve として扱います。明示的な資格情報を必須にするには、`gateway.auth.allowTailscale: false` を設定するか、`gateway.auth.mode: "password"` を強制してください。

## 設定例

### Tailnet 専用（Serve）

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

開く: `https://<magicdns>/`（または設定済みの `gateway.controlUi.basePath`）

### Tailnet 専用（Tailnet IP にバインド）

Gateway を Tailnet IP に直接リッスンさせたい場合（Serve／Funnel なし）に使用します。

```json5
{
  gateway: {
    bind: "tailnet",
    auth: { mode: "token", token: "your-token" },
  },
}
```

別の Tailnet デバイスから接続します。

- Control UI: `http://<tailscale-ip>:18789/`
- WebSocket: `ws://<tailscale-ip>:18789`

注意: このモードでは loopback（`http://127.0.0.1:18789`）は **使用できません**。

### 公開インターネット（Funnel + 共有パスワード）

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password", password: "replace-me" },
  },
}
```

パスワードをディスクにコミットするよりも、`OPENCLAW_GATEWAY_PASSWORD` を推奨します。

## CLI 例

```bash
openclaw gateway --tailscale serve
openclaw gateway --tailscale funnel --auth password
```

## 注記

- Tailscale Serve／Funnel には、`tailscale` CLI がインストールされ、ログイン済みである必要があります。
- 公開露出を避けるため、認証モードが `password` でない限り、`tailscale.mode: "funnel"` は起動を拒否します。
- シャットダウン時に OpenClaw が `tailscale serve` または `tailscale funnel` の設定を元に戻す場合は、`gateway.tailscale.resetOnExit` を設定してください。
- `gateway.bind: "tailnet"` は Tailnet への直接バインドです（HTTPS なし、Serve／Funnel なし）。
- `gateway.bind: "auto"` は loopback を優先します。Tailnet 専用にしたい場合は `tailnet` を使用してください。
- Serve／Funnel が公開するのは **Gateway Control UI + WS** のみです。ノードは同一の Gateway WS エンドポイント経由で接続するため、Serve はノードアクセスにも利用できます。

## ブラウザー操作（リモート Gateway + ローカルブラウザー）

Gateway をあるマシンで実行し、別のマシンのブラウザーを操作したい場合は、ブラウザー側のマシンで **node host** を実行し、両者を同じ tailnet に接続してください。Gateway はノードへブラウザー操作をプロキシします。別個の制御サーバーや Serve URL は不要です。

ブラウザー操作には Funnel を避け、ノードのペアリングはオペレーターアクセスとして扱ってください。

## Tailscale の前提条件 + 制限

- Serve には tailnet で HTTPS が有効化されている必要があります。未設定の場合、CLI が案内します。
- Serve は Tailscale のアイデンティティヘッダーを注入しますが、Funnel は注入しません。
- Funnel には Tailscale v1.38.3 以降、MagicDNS、HTTPS の有効化、および funnel ノード属性が必要です。
- Funnel は TLS 上で `443`、`8443`、`10000` の各ポートのみをサポートします。
- macOS での Funnel には、オープンソース版の Tailscale アプリが必要です。

## 詳細はこちら

- Tailscale Serve 概要: https://tailscale.com/kb/1312/serve
- `tailscale serve` コマンド: https://tailscale.com/kb/1242/tailscale-serve
- Tailscale Funnel 概要: https://tailscale.com/kb/1223/tailscale-funnel
- `tailscale funnel` コマンド: https://tailscale.com/kb/1311/tailscale-funnel
