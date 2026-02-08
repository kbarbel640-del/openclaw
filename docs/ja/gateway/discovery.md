---
summary: "Gateway を見つけるためのノード検出とトランスポート（Bonjour、Tailscale、SSH）"
read_when:
  - Bonjour 検出／アドバタイズの実装または変更を行うとき
  - リモート接続モード（direct と SSH）の調整を行うとき
  - リモートノード向けのノード検出 + ペアリングを設計するとき
title: "検出とトランスポート"
x-i18n:
  source_path: gateway/discovery.md
  source_hash: e12172c181515bfa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:51Z
---

# 検出 & トランスポート

OpenClaw には、一見似ている 2 つの異なる課題があります。

1. **オペレーターのリモート操作**: 別の場所で稼働している Gateway（ゲートウェイ）を制御する macOS メニューバーアプリ。
2. **ノードのペアリング**: iOS／Android（および将来のノード）が Gateway（ゲートウェイ）を見つけ、安全にペアリングすること。

設計目標は、すべてのネットワーク検出／アドバタイズを **Node Gateway**（`openclaw gateway`）に集約し、クライアント（mac アプリ、iOS）はコンシューマーとして扱うことです。

## 用語

- **Gateway**: 状態（セッション、ペアリング、ノードレジストリ）を所有し、チャンネルを実行する単一の長時間稼働する Gateway プロセス。多くの構成ではホストごとに 1 つを使用しますが、分離されたマルチ Gateway 構成も可能です。
- **Gateway WS（コントロールプレーン）**: 既定では `127.0.0.1:18789` 上の WebSocket エンドポイント。`gateway.bind` により LAN／tailnet にバインドできます。
- **Direct WS トランスポート**: LAN／tailnet 向けの Gateway WS エンドポイント（SSH なし）。
- **SSH トランスポート（フォールバック）**: SSH 経由で `127.0.0.1:18789` をフォワードして行うリモート操作。
- **レガシー TCP ブリッジ（非推奨／削除済み）**: 旧来のノードトランスポート（[Bridge protocol](/gateway/bridge-protocol) を参照）。現在は検出対象としてアドバタイズされません。

プロトコルの詳細:

- [Gateway protocol](/gateway/protocol)
- [Bridge protocol（レガシー）](/gateway/bridge-protocol)

## 「direct」と SSH の両方を維持する理由

- **Direct WS** は、同一ネットワークおよび tailnet 内で最良の UX を提供します。
  - Bonjour による LAN 自動検出
  - Gateway が所有するペアリングトークン + ACL
  - シェルアクセス不要。プロトコルの攻撃面を最小限かつ監査可能に保てます。
- **SSH** は汎用的なフォールバックとして残します。
  - SSH アクセスがあればどこでも動作（無関係なネットワーク間でも可）
  - マルチキャスト／mDNS の問題に左右されません
  - SSH 以外の新しい受信ポートを必要としません

## 検出入力（クライアントが Gateway の場所を知る方法）

### 1) Bonjour／mDNS（LAN のみ）

Bonjour はベストエフォートであり、ネットワークを越えません。「同一 LAN」の利便性のためにのみ使用されます。

想定される方向性:

- **Gateway** が Bonjour 経由で WS エンドポイントをアドバタイズします。
- クライアントは一覧をブラウズして「Gateway を選択」し、選択したエンドポイントを保存します。

トラブルシューティングおよびビーコンの詳細: [Bonjour](/gateway/bonjour)。

#### サービスビーコンの詳細

- サービス種別:
  - `_openclaw-gw._tcp`（Gateway トランスポートビーコン）
- TXT キー（非シークレット）:
  - `role=gateway`
  - `lanHost=<hostname>.local`
  - `sshPort=22`（またはアドバタイズされている値）
  - `gatewayPort=18789`（Gateway WS + HTTP）
  - `gatewayTls=1`（TLS 有効時のみ）
  - `gatewayTlsSha256=<sha256>`（TLS 有効かつフィンガープリントが利用可能な場合のみ）
  - `canvasPort=18793`（既定のキャンバスホストポート。`/__openclaw__/canvas/` を提供）
  - `cliPath=<path>`（任意。実行可能な `openclaw` のエントリーポイントまたはバイナリへの絶対パス）
  - `tailnetDns=<magicdns>`（任意のヒント。Tailscale が利用可能な場合に自動検出）

無効化／上書き:

- `OPENCLAW_DISABLE_BONJOUR=1` はアドバタイズを無効化します。
- `gateway.bind`（`~/.openclaw/openclaw.json` 内）が Gateway のバインドモードを制御します。
- `OPENCLAW_SSH_PORT` は TXT でアドバタイズされる SSH ポートを上書きします（既定は 22）。
- `OPENCLAW_TAILNET_DNS` は `tailnetDns` のヒント（MagicDNS）を公開します。
- `OPENCLAW_CLI_PATH` はアドバタイズされる CLI パスを上書きします。

### 2) Tailnet（ネットワーク横断）

ロンドン／ウィーンのような構成では、Bonjour は役に立ちません。推奨される「direct」のターゲットは次のとおりです。

- Tailscale MagicDNS 名（推奨）または安定した tailnet IP。

Gateway が Tailscale 配下で動作していることを検出できる場合、クライアント向け（広域ビーコンを含む）の任意のヒントとして `tailnetDns` を公開します。

### 3) 手動／SSH ターゲット

direct の経路がない（または direct が無効）場合でも、クライアントは loopback の Gateway ポートをフォワードすることで、常に SSH 経由で接続できます。

[Remote access](/gateway/remote) を参照してください。

## トランスポート選択（クライアントポリシー）

推奨されるクライアントの挙動:

1. ペアリング済みの direct エンドポイントが設定され、到達可能であればそれを使用します。
2. それ以外の場合、Bonjour により LAN 上で Gateway が見つかれば、「この Gateway を使用」のワンタップ選択を提示し、direct エンドポイントとして保存します。
3. それ以外の場合、tailnet の DNS／IP が設定されていれば direct を試行します。
4. それ以外の場合、SSH にフォールバックします。

## ペアリング + 認証（direct トランスポート）

Gateway は、ノード／クライアントの受け入れに関する信頼の基点です。

- ペアリング要求は Gateway 内で作成／承認／拒否されます（[Gateway pairing](/gateway/pairing) を参照）。
- Gateway は次を強制します。
  - 認証（トークン／キーペア）
  - スコープ／ACL（Gateway はすべてのメソッドへの生のプロキシではありません）
  - レート制限

## コンポーネント別の責務

- **Gateway**: 検出ビーコンをアドバタイズし、ペアリングの判断を行い、WS エンドポイントをホストします。
- **macOS アプリ**: Gateway の選択を支援し、ペアリングのプロンプトを表示し、フォールバックとしてのみ SSH を使用します。
- **iOS／Android ノード**: 便宜的に Bonjour をブラウズし、ペアリング済みの Gateway WS に接続します。
