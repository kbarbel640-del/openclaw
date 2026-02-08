---
summary: "ネットワークハブ：ゲートウェイのサーフェス、ペアリング、デバイス検出、セキュリティ"
read_when:
  - ネットワークアーキテクチャとセキュリティの概要が必要なとき
  - local と tailnet のアクセスやペアリングの違いをデバッグしているとき
  - ネットワーキング関連ドキュメントの正規一覧を確認したいとき
title: "ネットワーク"
x-i18n:
  source_path: network.md
  source_hash: 0fe4e7dbc8ddea31
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:33:58Z
---

# ネットワークハブ

このハブは、OpenClaw が localhost、LAN、tailnet 全体でデバイスを接続・ペアリング・保護する方法に関する中核ドキュメントをリンクします。

## コアモデル

- [Gateway アーキテクチャ](/concepts/architecture)
- [Gateway プロトコル](/gateway/protocol)
- [Gateway ランブック](/gateway)
- [Web サーフェス + バインドモード](/web)

## ペアリング + アイデンティティ

- [ペアリング概要（ダイレクトメッセージ + ノード）](/start/pairing)
- [Gateway 所有ノードのペアリング](/gateway/pairing)
- [デバイス CLI（ペアリング + トークンローテーション）](/cli/devices)
- [ペアリング CLI（ダイレクトメッセージ承認）](/cli/pairing)

ローカルトラスト：

- ローカル接続（loopback または Gateway（ゲートウェイ）ホスト自身の tailnet アドレス）は、同一ホストでの UX を円滑に保つため、ペアリングが自動承認される場合があります。
- 非ローカルの tailnet / LAN クライアントでは、引き続き明示的なペアリング承認が必要です。

## デバイス検出 + トランスポート

- [デバイス検出 & トランスポート](/gateway/discovery)
- [Bonjour / mDNS](/gateway/bonjour)
- [リモートアクセス（SSH）](/gateway/remote)
- [Tailscale](/gateway/tailscale)

## ノード + トランスポート

- [ノード概要](/nodes)
- [ブリッジプロトコル（レガシーノード）](/gateway/bridge-protocol)
- [ノードランブック：iOS](/platforms/ios)
- [ノードランブック：Android](/platforms/android)

## セキュリティ

- [セキュリティ概要](/gateway/security)
- [Gateway 設定リファレンス](/gateway/configuration)
- [トラブルシューティング](/gateway/troubleshooting)
- [Doctor](/gateway/doctor)
