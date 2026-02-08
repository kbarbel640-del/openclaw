---
summary: "exe.dev（VM + HTTPS プロキシ）で OpenClaw Gateway（ゲートウェイ）を実行し、リモートアクセスする"
read_when:
  - Gateway（ゲートウェイ）用に安価で常時稼働の Linux ホストが必要な場合
  - 自分で VPS を運用せずにリモートの Control UI へアクセスしたい場合
title: "exe.dev"
x-i18n:
  source_path: install/exe-dev.md
  source_hash: 72ab798afd058a76
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:02Z
---

# exe.dev

目的: exe.dev の VM 上で OpenClaw Gateway（ゲートウェイ）を実行し、ノート PC から次の経路で到達可能にする: `https://<vm-name>.exe.xyz`

このページは、exe.dev の既定の **exeuntu** イメージを前提としています。別のディストリビューションを選択した場合は、パッケージを適宜読み替えてください。

## 初心者向けクイックパス

1. [https://exe.new/openclaw](https://exe.new/openclaw)
2. 必要に応じて認証キー／トークンを入力
3. VM の横にある「Agent」をクリックし、待機
4. ???
5. 利益

## 必要なもの

- exe.dev アカウント
- [exe.dev](https://exe.dev) の仮想マシンへの `ssh exe.dev` アクセス（任意）

## Shelley による自動インストール

exe.dev のエージェントである Shelley は、当社の
プロンプトを使って OpenClaw を即座にインストールできます。使用するプロンプトは次のとおりです。

```
Set up OpenClaw (https://docs.openclaw.ai/install) on this VM. Use the non-interactive and accept-risk flags for openclaw onboarding. Add the supplied auth or token as needed. Configure nginx to forward from the default port 18789 to the root location on the default enabled site config, making sure to enable Websocket support. Pairing is done by "openclaw devices list" and "openclaw device approve <request id>". Make sure the dashboard shows that OpenClaw's health is OK. exe.dev handles forwarding from port 8000 to port 80/443 and HTTPS for us, so the final "reachable" should be <vm-name>.exe.xyz, without port specification.
```

## 手動インストール

## 1) VM を作成

ご自身のデバイスから:

```bash
ssh exe.dev new
```

その後、接続します:

```bash
ssh <vm-name>.exe.xyz
```

ヒント: この VM は **stateful** のままにしてください。OpenClaw は状態を `~/.openclaw/` および `~/.openclaw/workspace/` 配下に保存します。

## 2) 事前要件のインストール（VM 上）

```bash
sudo apt-get update
sudo apt-get install -y git curl jq ca-certificates openssl
```

## 3) OpenClaw のインストール

OpenClaw のインストールスクリプトを実行します。

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

## 4) nginx を設定して OpenClaw をポート 8000 にプロキシ

`/etc/nginx/sites-enabled/default` を次の内容で編集します。

```
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 8000;
    listen [::]:8000;

    server_name _;

    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout settings for long-lived connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

## 5) OpenClaw へアクセスして権限を付与

`https://<vm-name>.exe.xyz/` にアクセスします（オンボーディング時の Control UI 出力を参照）。認証を求められた場合は、VM 上の `gateway.auth.token` からトークンを貼り付けてください（`openclaw config get gateway.auth.token` で取得、または `openclaw doctor --generate-gateway-token` で生成できます）。`openclaw devices list` と
`openclaw devices approve <requestId>` でデバイスを承認します。迷った場合は、ブラウザから Shelley を使用してください。

## リモートアクセス

リモートアクセスは、[exe.dev](https://exe.dev) の認証によって処理されます。既定では、ポート 8000 からの HTTP トラフィックは、メール認証付きで `https://<vm-name>.exe.xyz` に転送されます。

## 更新

```bash
npm i -g openclaw@latest
openclaw doctor
openclaw gateway restart
openclaw health
```

ガイド: [Updating](/install/updating)
