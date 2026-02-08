---
summary: "OpenClaw Gateway CLI（`openclaw gateway`）— ゲートウェイの実行、照会、検出"
read_when:
  - CLI から Gateway（ゲートウェイ）を実行する場合（開発またはサーバー）
  - Gateway（ゲートウェイ）の認証、バインドモード、接続性をデバッグする場合
  - Bonjour（LAN + tailnet）経由で Gateway（ゲートウェイ）を検出する場合
title: "gateway"
x-i18n:
  source_path: cli/gateway.md
  source_hash: cbc1690e6be84073
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:01:47Z
---

# Gateway CLI

Gateway（ゲートウェイ）は OpenClaw の WebSocket サーバー（チャンネル、ノード、セッション、フック）です。

このページのサブコマンドは `openclaw gateway …` 配下にあります。

関連ドキュメント:

- [/gateway/bonjour](/gateway/bonjour)
- [/gateway/discovery](/gateway/discovery)
- [/gateway/configuration](/gateway/configuration)

## Gateway（ゲートウェイ）を実行する

ローカルの Gateway（ゲートウェイ）プロセスを実行します:

```bash
openclaw gateway
```

フォアグラウンドの別名:

```bash
openclaw gateway run
```

注記:

- デフォルトでは、`gateway.mode=local` が `~/.openclaw/openclaw.json` に設定されていない限り、Gateway（ゲートウェイ）は起動を拒否します。アドホック/開発用途の実行には `--allow-unconfigured` を使用してください。
- 認証なしで loopback を超えてバインドすることは（安全のためのガードレールとして）ブロックされます。
- `SIGUSR1` は、認可されている場合にプロセス内再起動をトリガーします（`commands.restart` を有効化するか、gateway ツール/設定の apply/update を使用してください）。
- `SIGINT`/`SIGTERM` ハンドラーは gateway プロセスを停止しますが、カスタムのターミナル状態は復元しません。CLI を TUI や raw-mode 入力でラップしている場合は、終了前にターミナルを復元してください。

### オプション

- `--port <port>`: WebSocket ポート（デフォルトは config/env から取得され、通常は `18789` です）。
- `--bind <loopback|lan|tailnet|auto|custom>`: リスナーのバインドモード。
- `--auth <token|password>`: 認証モードのオーバーライド。
- `--token <token>`: トークンのオーバーライド（プロセスに対して `OPENCLAW_GATEWAY_TOKEN` も設定します）。
- `--password <password>`: パスワードのオーバーライド（プロセスに対して `OPENCLAW_GATEWAY_PASSWORD` も設定します）。
- `--tailscale <off|serve|funnel>`: Tailscale 経由で Gateway（ゲートウェイ）を公開します。
- `--tailscale-reset-on-exit`: シャットダウン時に Tailscale の serve/funnel 設定をリセットします。
- `--allow-unconfigured`: config に `gateway.mode=local` がなくても gateway の起動を許可します。
- `--dev`: 存在しない場合に開発用の config + workspace を作成します（BOOTSTRAP.md をスキップします）。
- `--reset`: 開発用の config + 認証情報 + セッション + workspace をリセットします（`--dev` が必要です）。
- `--force`: 起動前に、選択したポートで既存のリスナーがあれば終了させます。
- `--verbose`: 詳細ログ。
- `--claude-cli-logs`: コンソールには claude-cli のログのみを表示します（およびその stdout/stderr を有効化します）。
- `--ws-log <auto|full|compact>`: websocket のログスタイル（デフォルトは `auto`）。
- `--compact`: `--ws-log compact` の別名。
- `--raw-stream`: 生のモデルストリームイベントを jsonl にログします。
- `--raw-stream-path <path>`: 生ストリーム jsonl のパス。

## 実行中の Gateway（ゲートウェイ）を照会する

すべての照会コマンドは WebSocket RPC を使用します。

出力モード:

- デフォルト: 人間が読みやすい形式（TTY ではカラー表示）。
- `--json`: 機械可読な JSON（スタイリング/スピナーなし）。
- `--no-color`（または `NO_COLOR=1`）: 人間向けのレイアウトを維持したまま ANSI を無効化します。

共通オプション（サポートされる場合）:

- `--url <url>`: Gateway（ゲートウェイ）の WebSocket URL。
- `--token <token>`: Gateway（ゲートウェイ）トークン。
- `--password <password>`: Gateway（ゲートウェイ）パスワード。
- `--timeout <ms>`: タイムアウト/予算（コマンドごとに異なります）。
- `--expect-final`: 「final」レスポンスを待機します（エージェント呼び出し）。

注記: `--url` を設定した場合、CLI は config または環境の認証情報にフォールバックしません。
`--token` または `--password` を明示的に渡してください。明示的な認証情報が欠けている場合はエラーです。

### `gateway health`

```bash
openclaw gateway health --url ws://127.0.0.1:18789
```

### `gateway status`

`gateway status` は Gateway（ゲートウェイ）サービス（launchd/systemd/schtasks）と、任意の RPC プローブを表示します。

```bash
openclaw gateway status
openclaw gateway status --json
```

オプション:

- `--url <url>`: プローブ URL をオーバーライドします。
- `--token <token>`: プローブのトークン認証。
- `--password <password>`: プローブのパスワード認証。
- `--timeout <ms>`: プローブのタイムアウト（デフォルトは `10000`）。
- `--no-probe`: RPC プローブをスキップします（サービスのみの表示）。
- `--deep`: システムレベルのサービスもスキャンします。

### `gateway probe`

`gateway probe` は「すべてをデバッグ」するコマンドです。常に次をプローブします:

- 設定されたリモート gateway（設定されている場合）、および
- localhost（loopback）。**リモートが設定されていても**実行します。

複数の gateway に到達可能な場合は、すべてを表示します。分離されたプロファイル/ポート（例: レスキューボット）を使用する場合は複数 gateway をサポートしますが、多くのインストールでは依然として単一の gateway を実行します。

```bash
openclaw gateway probe
openclaw gateway probe --json
```

#### SSH 経由のリモート（Mac アプリ相当）

macOS アプリの「Remote over SSH」モードはローカルのポートフォワードを使用し、リモート gateway（loopback のみにバインドされている可能性があります）を `ws://127.0.0.1:<port>` で到達可能にします。

CLI の同等機能:

```bash
openclaw gateway probe --ssh user@gateway-host
```

オプション:

- `--ssh <target>`: `user@host` または `user@host:port`（ポートのデフォルトは `22`）。
- `--ssh-identity <path>`: identity ファイル。
- `--ssh-auto`: 検出された最初の gateway ホストを SSH ターゲットとして選択します（LAN/WAB のみ）。

設定（任意、デフォルトとして使用）:

- `gateway.remote.sshTarget`
- `gateway.remote.sshIdentity`

### `gateway call <method>`

低レベルの RPC ヘルパーです。

```bash
openclaw gateway call status
openclaw gateway call logs.tail --params '{"sinceMs": 60000}'
```

## Gateway（ゲートウェイ）サービスを管理する

```bash
openclaw gateway install
openclaw gateway start
openclaw gateway stop
openclaw gateway restart
openclaw gateway uninstall
```

注記:

- `gateway install` は `--port`、`--runtime`、`--token`、`--force`、`--json` をサポートします。
- ライフサイクルコマンドは、スクリプト向けに `--json` を受け付けます。

## Gateway（ゲートウェイ）を検出する（Bonjour）

`gateway discover` は Gateway（ゲートウェイ）のビーコン（`_openclaw-gw._tcp`）をスキャンします。

- マルチキャスト DNS-SD: `local.`
- ユニキャスト DNS-SD（Wide-Area Bonjour）: ドメイン（例: `openclaw.internal.`）を選択し、split DNS + DNS サーバーを設定します。[/gateway/bonjour](/gateway/bonjour) を参照してください

Bonjour のデバイス検出が有効（デフォルト）な gateway のみがビーコンを広告します。

Wide-Area の検出レコードには（TXT）次が含まれます:

- `role`（gateway の役割ヒント）
- `transport`（トランスポートのヒント。例: `gateway`）
- `gatewayPort`（WebSocket ポート。通常は `18789`）
- `sshPort`（SSH ポート。存在しない場合のデフォルトは `22`）
- `tailnetDns`（利用可能な場合の MagicDNS ホスト名）
- `gatewayTls` / `gatewayTlsSha256`（TLS 有効化 + 証明書フィンガープリント）
- `cliPath`（リモートインストール向けの任意のヒント）

### `gateway discover`

```bash
openclaw gateway discover
```

オプション:

- `--timeout <ms>`: コマンドごとのタイムアウト（browse/resolve）。デフォルトは `2000`。
- `--json`: 機械可読な出力（スタイリング/スピナーも無効化します）。

例:

```bash
openclaw gateway discover --timeout 4000
openclaw gateway discover --json | jq '.beacons[].wsUrl'
```
