---
summary: "OpenClaw 向け VPS ホスティングハブ（Oracle/Fly/Hetzner/GCP/exe.dev）"
read_when:
  - Gateway（ゲートウェイ）をクラウドで実行したい場合
  - VPS/ホスティングガイドの全体像をすばやく把握したい場合
title: "VPS ホスティング"
x-i18n:
  source_path: vps.md
  source_hash: 38e3e254853e5839
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:25Z
---

# VPS ホスティング

このハブでは、サポートされている VPS/ホスティングガイドへのリンクをまとめ、クラウド
デプロイが高レベルでどのように動作するかを説明します。

## プロバイダーを選ぶ

- **Railway**（ワンクリック + ブラウザーセットアップ）: [Railway](/install/railway)
- **Northflank**（ワンクリック + ブラウザーセットアップ）: [Northflank](/install/northflank)
- **Oracle Cloud（Always Free）**: [Oracle](/platforms/oracle) — $0/month（Always Free、ARM。容量/サインアップが不安定な場合があります）
- **Fly.io**: [Fly.io](/install/fly)
- **Hetzner（Docker）**: [Hetzner](/install/hetzner)
- **GCP（Compute Engine）**: [GCP](/install/gcp)
- **exe.dev**（VM + HTTPS プロキシ）: [exe.dev](/install/exe-dev)
- **AWS（EC2/Lightsail/free tier）**: こちらも問題なく動作します。動画ガイド:
  https://x.com/techfrenAJ/status/2014934471095812547

## クラウドセットアップの仕組み

- **Gateway（ゲートウェイ）は VPS 上で実行**され、状態 + ワークスペースを保持します。
- ノート PC/スマートフォンから **Control UI** または **Tailscale/SSH** 経由で接続します。
- VPS を信頼できる唯一の情報源として扱い、状態 + ワークスペースを **バックアップ** してください。
- 既定のセキュリティ: Gateway（ゲートウェイ）を loopback 上に置き、SSH トンネルまたは Tailscale Serve 経由でアクセスします。
  `lan`/`tailnet` にバインドする場合は、`gateway.auth.token` または `gateway.auth.password` を必須にしてください。

リモートアクセス: [Gateway remote](/gateway/remote)  
プラットフォームハブ: [Platforms](/platforms)

## VPS でノードを使う

Gateway（ゲートウェイ）をクラウドに置いたまま、ローカルデバイス
（Mac/iOS/Android/headless）上の **ノード** をペアリングできます。ノードは、Gateway（ゲートウェイ）がクラウドに留まる間に、ローカルの画面/カメラ/キャンバスと `system.run`
機能を提供します。

ドキュメント: [Nodes](/nodes), [Nodes CLI](/cli/nodes)
