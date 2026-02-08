---
summary: "Bonjour/mDNS による検出 + デバッグ（Gateway（ゲートウェイ）ビーコン、クライアント、および一般的な障害モード）"
read_when:
  - macOS/iOS で Bonjour 検出の問題をデバッグするとき
  - mDNS サービスタイプ、TXT レコード、または検出 UX を変更するとき
title: "Bonjour 検出"
x-i18n:
  source_path: gateway/bonjour.md
  source_hash: 47569da55f0c0523
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:21:56Z
---

# Bonjour / mDNS 検出

OpenClaw は、アクティブな Gateway（ゲートウェイ）（WebSocket エンドポイント）を検出するための **LAN のみの利便性** として Bonjour（mDNS / DNS‑SD）を使用します。これはベストエフォートであり、SSH や Tailnet ベースの接続性を置き換えるものでは **ありません**。

## Tailscale 上のワイドエリア Bonjour（ユニキャスト DNS‑SD）

ノードとゲートウェイが異なるネットワーク上にある場合、マルチキャスト mDNS は境界を越えません。Tailscale 上で **ユニキャスト DNS‑SD**（「Wide‑Area Bonjour」）に切り替えることで、同じ検出 UX を維持できます。

大まかな手順:

1. ゲートウェイホスト上で DNS サーバーを実行します（Tailnet 経由で到達可能であること）。
2. 専用ゾーン（例: `openclaw.internal.`）配下に、`_openclaw-gw._tcp` の DNS‑SD レコードを公開します。
3. 選択したドメインが、その DNS サーバーでクライアント（iOS を含む）向けに解決されるよう、Tailscale の **split DNS** を設定します。

OpenClaw は任意の検出ドメインをサポートします。`openclaw.internal.` は単なる例です。iOS/Android ノードは `local.` と、設定したワイドエリアドメインの両方をブラウズします。

### Gateway（ゲートウェイ）設定（推奨）

```json5
{
  gateway: { bind: "tailnet" }, // tailnet-only (recommended)
  discovery: { wideArea: { enabled: true } }, // enables wide-area DNS-SD publishing
}
```

### 1 回限りの DNS サーバー設定（ゲートウェイホスト）

```bash
openclaw dns setup --apply
```

これにより CoreDNS がインストールされ、次のように設定されます:

- ゲートウェイの Tailscale インターフェース上のみにて、ポート 53 でリッスンする
- `~/.openclaw/dns/<domain>.db` から、選択したドメイン（例: `openclaw.internal.`）を提供する

tailnet 接続されたマシンから検証します:

```bash
dns-sd -B _openclaw-gw._tcp openclaw.internal.
dig @<TAILNET_IPV4> -p 53 _openclaw-gw._tcp.openclaw.internal PTR +short
```

### Tailscale DNS 設定

Tailscale 管理コンソールで:

- ゲートウェイの tailnet IP（UDP/TCP 53）を指すネームサーバーを追加します。
- 検出ドメインがそのネームサーバーを使用するように split DNS を追加します。

クライアントが tailnet DNS を受け入れると、iOS ノードはマルチキャストなしで、検出ドメイン内の `_openclaw-gw._tcp` をブラウズできます。

### Gateway（ゲートウェイ）リスナーのセキュリティ（推奨）

Gateway（ゲートウェイ）の WS ポート（デフォルト `18789`）は、既定で loopback にバインドされます。LAN/tailnet アクセスのためには、明示的にバインドし、認証を有効のままにしてください。

tailnet 専用のセットアップの場合:

- `~/.openclaw/openclaw.json` で `gateway.bind: "tailnet"` を設定します。
- Gateway（ゲートウェイ）を再起動します（または macOS メニューバーアプリを再起動します）。

## 広告されるもの

`_openclaw-gw._tcp` を広告するのは Gateway（ゲートウェイ）のみです。

## サービスタイプ

- `_openclaw-gw._tcp` — ゲートウェイトランスポートビーコン（macOS/iOS/Android ノードが使用）。

## TXT キー（非秘密のヒント）

Gateway（ゲートウェイ）は、UI フローを便利にするために小さな非秘密のヒントを広告します:

- `role=gateway`
- `displayName=<friendly name>`
- `lanHost=<hostname>.local`
- `gatewayPort=<port>`（Gateway（ゲートウェイ）WS + HTTP）
- `gatewayTls=1`（TLS が有効な場合のみ）
- `gatewayTlsSha256=<sha256>`（TLS が有効で、フィンガープリントが利用可能な場合のみ）
- `canvasPort=<port>`（canvas host が有効な場合のみ。デフォルト `18793`）
- `sshPort=<port>`（上書きされない場合はデフォルトで 22）
- `transport=gateway`
- `cliPath=<path>`（任意。実行可能な `openclaw` エントリーポイントへの絶対パス）
- `tailnetDns=<magicdns>`（Tailnet が利用可能な場合の任意のヒント）

## macOS でのデバッグ

便利な組み込みツール:

- インスタンスをブラウズ:
  ```bash
  dns-sd -B _openclaw-gw._tcp local.
  ```
- 1 つのインスタンスを解決（`<instance>` を置換）:
  ```bash
  dns-sd -L "<instance>" _openclaw-gw._tcp local.
  ```

ブラウズは動作するが解決が失敗する場合、通常は LAN ポリシーまたは mDNS リゾルバーの問題に当たっています。

## Gateway（ゲートウェイ）ログでのデバッグ

Gateway（ゲートウェイ）はローテーションするログファイルを出力します（起動時に `gateway log file: ...` として表示されます）。`bonjour:` 行、とくに次を探してください:

- `bonjour: advertise failed ...`
- `bonjour: ... name conflict resolved` / `hostname conflict resolved`
- `bonjour: watchdog detected non-announced service ...`

## iOS ノードでのデバッグ

iOS ノードは `NWBrowser` を使用して `_openclaw-gw._tcp` を検出します。

ログを取得するには:

- 設定 → Gateway（ゲートウェイ） → 詳細 → **検出デバッグログ**
- 設定 → Gateway（ゲートウェイ） → 詳細 → **検出ログ** → 再現 → **コピー**

ログには、ブラウザーの状態遷移と結果セットの変化が含まれます。

## 一般的な障害モード

- **Bonjour はネットワークをまたげません**: Tailnet または SSH を使用してください。
- **マルチキャストがブロックされる**: 一部の Wi‑Fi ネットワークは mDNS を無効化しています。
- **スリープ / インターフェースの変動**: macOS は一時的に mDNS の結果を落とすことがあります。再試行してください。
- **ブラウズは動作するが解決が失敗する**: マシン名はシンプルに保ってください（絵文字や句読点を避ける）。その後 Gateway（ゲートウェイ）を再起動します。サービスインスタンス名はホスト名から派生するため、複雑すぎる名前は一部のリゾルバーを混乱させる可能性があります。

## エスケープされたインスタンス名（`\032`）

Bonjour/DNS‑SD は、サービスインスタンス名内のバイトを 10 進の `\DDD` シーケンスとしてエスケープすることがよくあります（例: スペースは `\032` になります）。

- これはプロトコルレベルでは正常です。
- UI は表示用にデコードすべきです（iOS は `BonjourEscapes.decode` を使用します）。

## 無効化 / 設定

- `OPENCLAW_DISABLE_BONJOUR=1` は広告を無効化します（レガシー: `OPENCLAW_DISABLE_BONJOUR`）。
- `~/.openclaw/openclaw.json` の `gateway.bind` は Gateway（ゲートウェイ）のバインドモードを制御します。
- `OPENCLAW_SSH_PORT` は TXT で広告される SSH ポートを上書きします（レガシー: `OPENCLAW_SSH_PORT`）。
- `OPENCLAW_TAILNET_DNS` は TXT に MagicDNS ヒントを公開します（レガシー: `OPENCLAW_TAILNET_DNS`）。
- `OPENCLAW_CLI_PATH` は広告される CLI パスを上書きします（レガシー: `OPENCLAW_CLI_PATH`）。

## 関連ドキュメント

- 検出ポリシーとトランスポート選択: [Discovery](/gateway/discovery)
- ノードのペアリング + 承認: [Gateway pairing](/gateway/pairing)
