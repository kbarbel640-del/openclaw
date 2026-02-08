---
summary: "SSH トンネル（Gateway WS）とテールネットを使用したリモートアクセス"
read_when:
  - リモート Gateway セットアップの実行またはトラブルシューティング時
title: "リモートアクセス"
x-i18n:
  source_path: gateway/remote.md
  source_hash: 449d406f88c53dcc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:50Z
---

# リモートアクセス（SSH、トンネル、テールネット）

このリポジトリは、専用ホスト（デスクトップ／サーバー）上で単一の Gateway（マスター）を稼働させ、クライアントをそこに接続することで、「SSH 経由のリモート」をサポートします。

- **オペレーター（あなた／macOS アプリ）向け**：SSH トンネリングが汎用的なフォールバックです。
- **ノード（iOS／Android および将来のデバイス）向け**：Gateway **WebSocket** に接続します（LAN／テールネット、または必要に応じて SSH トンネル）。

## コアとなる考え方

- Gateway WebSocket は、設定したポート（デフォルトは 18789）で **loopback** にバインドします。
- リモート利用では、その loopback ポートを SSH 経由でフォワードします（またはテールネット／VPN を使用してトンネルを減らします）。

## 一般的な VPN／テールネット構成（エージェントが存在する場所）

**Gateway ホスト** を「エージェントが存在する場所」と考えてください。セッション、認証プロファイル、チャンネル、状態を所有します。
あなたのノート PC／デスクトップ（およびノード）は、そのホストに接続します。

### 1) テールネット内で常時稼働の Gateway（VPS または自宅サーバー）

永続ホスト上で Gateway を実行し、**Tailscale** または SSH で到達します。

- **最良の UX**：`gateway.bind: "loopback"` を維持し、Control UI には **Tailscale Serve** を使用します。
- **フォールバック**：loopback + SSH トンネルを維持し、アクセスが必要な任意のマシンから接続します。
- **例**：[exe.dev](/install/exe-dev)（簡単な VM）や [Hetzner](/install/hetzner)（本番 VPS）。

ノート PC が頻繁にスリープする一方で、エージェントを常時稼働させたい場合に最適です。

### 2) 自宅デスクトップで Gateway を実行し、ノート PC からリモート操作

ノート PC ではエージェントを **実行しません**。リモートで接続します。

- macOS アプリの **Remote over SSH** モードを使用します（設定 → 一般 → 「OpenClaw runs」）。
- アプリがトンネルを開いて管理するため、WebChat + ヘルスチェックが「そのまま」動作します。

ランブック：[macOS リモートアクセス](/platforms/mac/remote)。

### 3) ノート PC で Gateway を実行し、他のマシンからリモートアクセス

Gateway をローカルに保ったまま、安全に公開します。

- 他のマシンからノート PC へ SSH トンネルを張る、または
- Tailscale Serve で Control UI を提供し、Gateway は loopback のみにします。

ガイド：[Tailscale](/gateway/tailscale) と [Web 概要](/web)。

## コマンドフロー（どこで何が動くか）

1 つの Gateway サービスが状態 + チャンネルを所有します。ノードは周辺機器です。

フロー例（Telegram → ノード）：

- Telegram メッセージが **Gateway** に到達します。
- Gateway が **エージェント** を実行し、ノードのツールを呼び出すか判断します。
- Gateway が Gateway WebSocket（`node.*` RPC）経由で **ノード** を呼び出します。
- ノードが結果を返し、Gateway が Telegram に返信します。

注記：

- **ノードは gateway サービスを実行しません。** 意図的に分離したプロファイルを実行しない限り、1 ホストにつき 1 つの Gateway のみを実行してください（[複数 Gateway](/gateway/multiple-gateways) を参照）。
- macOS アプリの「node モード」は、Gateway WebSocket 上の単なるノードクライアントです。

## SSH トンネル（CLI + ツール）

リモート Gateway WS へのローカルトンネルを作成します。

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

トンネルが有効な状態では：

- `openclaw health` と `openclaw status --deep` は、`ws://127.0.0.1:18789` 経由でリモート Gateway に到達します。
- 必要に応じて、`openclaw gateway {status,health,send,agent,call}` も `--url` を介してフォワードされた URL を対象にできます。

注：`18789` は、設定した `gateway.port`（または `--port`／`OPENCLAW_GATEWAY_PORT`）に置き換えてください。  
注：`--url` を渡すと、CLI は設定や環境変数の認証情報にフォールバックしません。  
`--token` または `--password` を明示的に含めてください。明示的な認証情報がない場合はエラーになります。

## CLI のリモート既定値

CLI コマンドが既定で使用するリモートターゲットを永続化できます。

```json5
{
  gateway: {
    mode: "remote",
    remote: {
      url: "ws://127.0.0.1:18789",
      token: "your-token",
    },
  },
}
```

Gateway が loopback のみの場合は、URL を `ws://127.0.0.1:18789` のままにし、先に SSH トンネルを開いてください。

## SSH 経由の Chat UI

WebChat は、もはや別の HTTP ポートを使用しません。SwiftUI のチャット UI は Gateway WebSocket に直接接続します。

- `18789` を SSH 経由でフォワードし（上記参照）、クライアントを `ws://127.0.0.1:18789` に接続します。
- macOS では、トンネルを自動管理するアプリの「Remote over SSH」モードを推奨します。

## macOS アプリの「Remote over SSH」

macOS のメニューバーアプリは、同一のセットアップをエンドツーエンドで実行できます（リモートの状態チェック、WebChat、Voice Wake フォワーディング）。

ランブック：[macOS リモートアクセス](/platforms/mac/remote)。

## セキュリティルール（リモート／VPN）

要点：**必要が確実でない限り、Gateway は loopback のみにしてください。**

- **Loopback + SSH／Tailscale Serve** が最も安全な既定値です（公開露出なし）。
- **非 loopback バインド**（`lan`／`tailnet`／`custom`、または loopback が利用できない場合の `auto`）では、認証トークン／パスワードが必須です。
- `gateway.remote.token` は、リモート CLI 呼び出し **専用** です。ローカル認証は有効化しません。
- `gateway.remote.tlsFingerprint` は、`wss://` 使用時にリモート TLS 証明書をピン留めします。
- **Tailscale Serve** は、`gateway.auth.allowTailscale: true` の場合に ID ヘッダーで認証できます。  
  トークン／パスワードを使用したい場合は、`false` に設定してください。
- ブラウザーによるコントロールはオペレーターアクセスとして扱ってください：テールネット限定 + 意図的なノードのペアリング。

詳細解説：[セキュリティ](/gateway/security)。
