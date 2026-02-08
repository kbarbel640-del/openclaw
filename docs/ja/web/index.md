---
summary: "Gateway（ゲートウェイ）の Web サーフェス: コントロール UI、バインドモード、セキュリティ"
read_when:
  - Tailscale 経由で Gateway（ゲートウェイ）にアクセスしたいとき
  - ブラウザーのコントロール UI と設定編集を使いたいとき
title: "Web"
x-i18n:
  source_path: web/index.md
  source_hash: 1315450b71a799c8
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:03Z
---

# Web（Gateway（ゲートウェイ））

Gateway（ゲートウェイ）は、Gateway（ゲートウェイ）の WebSocket と同じポートから、小さな **ブラウザー用コントロール UI**（Vite + Lit）を提供します。

- デフォルト: `http://<host>:18789/`
- オプションのプレフィックス: `gateway.controlUi.basePath` を設定します（例: `/openclaw`）

機能は [コントロール UI](/web/control-ui) にあります。
このページでは、バインドモード、セキュリティ、および Web 側のサーフェスに焦点を当てます。

## Webhooks

`hooks.enabled=true` の場合、Gateway（ゲートウェイ）は同じ HTTP サーバー上で小さな webhook エンドポイントも公開します。
認証 + ペイロードについては、[Gateway（ゲートウェイ）設定](/gateway/configuration) → `hooks` を参照してください。

## Config（デフォルトで有効）

アセットが存在する場合（`dist/control-ui`）、コントロール UI は **デフォルトで有効** です。
設定で制御できます。

```json5
{
  gateway: {
    controlUi: { enabled: true, basePath: "/openclaw" }, // basePath optional
  },
}
```

## Tailscale アクセス

### Integrated Serve（推奨）

Gateway（ゲートウェイ）を loopback に維持し、Tailscale Serve にプロキシさせます。

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

その後、gateway を起動します。

```bash
openclaw gateway
```

開く:

- `https://<magicdns>/`（または設定した `gateway.controlUi.basePath`）

### Tailnet bind + token

```json5
{
  gateway: {
    bind: "tailnet",
    controlUi: { enabled: true },
    auth: { mode: "token", token: "your-token" },
  },
}
```

その後、gateway を起動します（loopback 以外へのバインドにはトークンが必要です）。

```bash
openclaw gateway
```

開く:

- `http://<tailscale-ip>:18789/`（または設定した `gateway.controlUi.basePath`）

### 公開インターネット（Funnel）

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password" }, // or OPENCLAW_GATEWAY_PASSWORD
  },
}
```

## セキュリティに関する注意

- Gateway（ゲートウェイ）認証はデフォルトで必須です（トークン/パスワード、または Tailscale の ID ヘッダー）。
- loopback 以外へのバインドでも、共有トークン/パスワードが **必須** です（`gateway.auth` または env）。
- ウィザードはデフォルトで gateway トークンを生成します（loopback の場合でも）。
- UI は `connect.params.auth.token` または `connect.params.auth.password` を送信します。
- コントロール UI はアンチクリックジャッキングのヘッダーを送信し、`gateway.controlUi.allowedOrigins` が設定されていない限り、同一オリジンのブラウザー websocket 接続のみを受け付けます。
- Serve を使用すると、`gateway.auth.allowTailscale` が `true` の場合、Tailscale の ID ヘッダーで認証を満たせます（トークン/パスワードは不要）。明示的な資格情報を要求するには `gateway.auth.allowTailscale: false` を設定します。[Tailscale](/gateway/tailscale) と [Security](/gateway/security) を参照してください。
- `gateway.tailscale.mode: "funnel"` には `gateway.auth.mode: "password"`（共有パスワード）が必要です。

## UI のビルド

Gateway（ゲートウェイ）は `dist/control-ui` から静的ファイルを提供します。以下でビルドします。

```bash
pnpm ui:build # auto-installs UI deps on first run
```
