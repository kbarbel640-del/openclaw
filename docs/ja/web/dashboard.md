---
summary: "Gateway（ゲートウェイ）ダッシュボード（Control UI）へのアクセスと認証"
read_when:
  - ダッシュボードの認証または公開モードを変更する場合
title: "ダッシュボード"
x-i18n:
  source_path: web/dashboard.md
  source_hash: 852e359885574fa3
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:50Z
---

# ダッシュボード（Control UI）

Gateway（ゲートウェイ）ダッシュボードは、既定ではブラウザ向けの Control UI が `/` で提供されます
（`gateway.controlUi.basePath` で上書きします）。

クイックオープン（ローカルの Gateway（ゲートウェイ））:

- http://127.0.0.1:18789/（または http://localhost:18789/）

主要な参照先:

- 使い方と UI の機能については [Control UI](/web/control-ui) を参照してください。
- Serve/Funnel の自動化については [Tailscale](/gateway/tailscale) を参照してください。
- バインドモードとセキュリティ注意事項については [Web surfaces](/web) を参照してください。

認証は WebSocket のハンドシェイク時に `connect.params.auth`（トークンまたはパスワード）により強制されます。[Gateway（ゲートウェイ）設定](/gateway/configuration) の `gateway.auth` を参照してください。

セキュリティ注意: Control UI は **管理者向けサーフェス**（チャット、設定、exec 承認）です。
公開インターネットには公開しないでください。UI は初回ロード後にトークンを `localStorage` に保存します。
localhost、Tailscale Serve、または SSH トンネルを推奨します。

## 高速パス（推奨）

- オンボーディング後、CLI がダッシュボードを自動で開き、クリーンな（トークンなし）リンクを出力します。
- いつでも再オープンできます: `openclaw dashboard`（リンクをコピーし、可能ならブラウザを開き、ヘッドレスの場合は SSH のヒントを表示します）。
- UI が認証を求める場合は、`gateway.auth.token`（または `OPENCLAW_GATEWAY_TOKEN`）のトークンを Control UI 設定に貼り付けてください。

## トークンの基本（ローカル vs リモート）

- **Localhost**: `http://127.0.0.1:18789/` を開きます。
- **トークンの取得元**: `gateway.auth.token`（または `OPENCLAW_GATEWAY_TOKEN`）。接続後、UI は localStorage にコピーを保存します。
- **localhost ではない場合**: Tailscale Serve（`gateway.auth.allowTailscale: true` の場合はトークン不要）、トークン付きの tailnet バインド、または SSH トンネルを使用してください。[Web surfaces](/web) を参照してください。

## 「unauthorized」/ 1008 が表示される場合

- Gateway（ゲートウェイ）に到達できることを確認してください（ローカル: `openclaw status`、リモート: SSH トンネル `ssh -N -L 18789:127.0.0.1:18789 user@host` の後に `http://127.0.0.1:18789/` を開きます）。
- Gateway（ゲートウェイ）ホストからトークンを取得します: `openclaw config get gateway.auth.token`（または生成します: `openclaw doctor --generate-gateway-token`）。
- ダッシュボード設定で、認証フィールドにトークンを貼り付けてから接続します。
