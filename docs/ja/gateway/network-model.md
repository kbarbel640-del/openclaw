---
summary: "Gateway（ゲートウェイ）、ノード、および Canvas ホストがどのように接続されるかを説明します。"
read_when:
  - Gateway（ゲートウェイ）のネットワークモデルを簡潔に把握したい場合
title: "ネットワークモデル"
x-i18n:
  source_path: gateway/network-model.md
  source_hash: e3508b884757ef19
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:43Z
---

ほとんどの操作は Gateway（ゲートウェイ）（`openclaw gateway`）を経由します。これは、チャンネル接続と WebSocket のコントロールプレーンを所有する、単一の長時間稼働プロセスです。

## コアルール

- ホストあたり 1 つの Gateway（ゲートウェイ）を推奨します。WhatsApp Web セッションを所有できる唯一のプロセスです。レスキューボットや厳格な分離が必要な場合は、分離されたプロファイルとポートで複数のゲートウェイを実行してください。詳細は [Multiple gateways](/gateway/multiple-gateways) を参照してください。
- まず loopback：Gateway WS の既定値は `ws://127.0.0.1:18789` です。ウィザードは、loopback の場合でも既定でゲートウェイトークンを生成します。tailnet アクセスの場合、非 loopback バインドにはトークンが必要なため、`openclaw gateway --bind tailnet --token ...` を実行してください。
- ノードは、必要に応じて LAN、tailnet、または SSH 経由で Gateway WS に接続します。レガシー TCP ブリッジは非推奨です。
- Canvas ホストは、`canvasHost.port`（既定 `18793`）上の HTTP ファイルサーバーで、ノードの WebView 向けに `/__openclaw__/canvas/` を配信します。[Gateway configuration](/gateway/configuration)（`canvasHost`）を参照してください。
- リモート利用は、通常、SSH トンネルまたは tailnet VPN を使用します。[Remote access](/gateway/remote) および [Discovery](/gateway/discovery) を参照してください。
