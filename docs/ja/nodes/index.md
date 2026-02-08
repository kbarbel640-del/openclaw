---
summary: "Nodes：キャンバス／カメラ／スクリーン／システム向けのペアリング、機能、権限、CLI ヘルパー"
read_when:
  - Gateway（ゲートウェイ）への iOS／Android ノードのペアリング
  - エージェントのコンテキストにノードのキャンバス／カメラを使用する場合
  - 新しいノードコマンドや CLI ヘルパーを追加する場合
title: "Nodes"
x-i18n:
  source_path: nodes/index.md
  source_hash: 74e9420f61c653e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:32Z
---

# Nodes

**node** とは、Gateway（ゲートウェイ）の **WebSocket**（オペレーターと同一ポート）に `role: "node"` で接続し、`node.invoke` を介してコマンドサーフェス（例：`canvas.*`、`camera.*`、`system.*`）を公開するコンパニオンデバイス（macOS／iOS／Android／ヘッドレス）です。プロトコルの詳細： [Gateway protocol](/gateway/protocol)。

レガシートランスポート： [Bridge protocol](/gateway/bridge-protocol)（TCP JSONL；非推奨／現行ノードでは削除）。

macOS は **node モード** でも実行できます。メニューバーアプリが Gateway（ゲートウェイ）の WS サーバーに接続し、ローカルのキャンバス／カメラコマンドをノードとして公開します（そのため、この Mac に対して `openclaw nodes …` が動作します）。

注記：

- ノードは **周辺機器** であり、ゲートウェイではありません。ゲートウェイサービスは実行しません。
- Telegram／WhatsApp などのメッセージはノードではなく **ゲートウェイ** に到達します。

## Pairing + status

**WS ノードはデバイスペアリングを使用します。** ノードは `connect` 中にデバイス ID を提示し、Gateway（ゲートウェイ）が `role: node` 向けのデバイスペアリング要求を作成します。デバイスの CLI（または UI）から承認してください。

クイック CLI：

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
```

注記：

- `nodes status` は、デバイスペアリングロールに `node` が含まれる場合にノードを **paired** としてマークします。
- `node.pair.*`（CLI：`openclaw nodes pending/approve/reject`）は、ゲートウェイ所有の別個のノードペアリングストアであり、WS の `connect` ハンドシェイクを **制御しません**。

## Remote node host (system.run)

Gateway（ゲートウェイ）を 1 台のマシンで実行し、別のマシンでコマンドを実行したい場合は **node host** を使用します。モデルは引き続き **ゲートウェイ** と通信し、`host=node` が選択されている場合、ゲートウェイは `exec` の呼び出しを **node host** に転送します。

### What runs where

- **Gateway host**：メッセージを受信し、モデルを実行し、ツール呼び出しをルーティングします。
- **Node host**：ノードマシン上で `system.run`／`system.which` を実行します。
- **Approvals**：`~/.openclaw/exec-approvals.json` により node host 上で強制されます。

### Start a node host (foreground)

ノードマシン上で：

```bash
openclaw node run --host <gateway-host> --port 18789 --display-name "Build Node"
```

### Remote gateway via SSH tunnel (loopback bind)

Gateway（ゲートウェイ）が loopback（`gateway.bind=loopback`、ローカルモードの既定）にバインドしている場合、リモートの node host は直接接続できません。SSH トンネルを作成し、トンネルのローカル端を node host に指定してください。

例（node host → gateway host）：

```bash
# Terminal A (keep running): forward local 18790 -> gateway 127.0.0.1:18789
ssh -N -L 18790:127.0.0.1:18789 user@gateway-host

# Terminal B: export the gateway token and connect through the tunnel
export OPENCLAW_GATEWAY_TOKEN="<gateway-token>"
openclaw node run --host 127.0.0.1 --port 18790 --display-name "Build Node"
```

注記：

- トークンはゲートウェイ設定の `gateway.auth.token` です（gateway host 上の `~/.openclaw/openclaw.json`）。
- `openclaw node run` は認証のために `OPENCLAW_GATEWAY_TOKEN` を読み取ります。

### Start a node host (service)

```bash
openclaw node install --host <gateway-host> --port 18789 --display-name "Build Node"
openclaw node restart
```

### Pair + name

gateway host 上で：

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes list
```

命名オプション：

- `openclaw node run`／`openclaw node install` の `--display-name`（ノード上の `~/.openclaw/node.json` に永続化）。
- `openclaw nodes rename --node <id|name|ip> --name "Build Node"`（ゲートウェイ側の上書き）。

### Allowlist the commands

実行承認は **node host ごと** です。ゲートウェイから allowlist エントリーを追加します：

```bash
openclaw approvals allowlist add --node <id|name|ip> "/usr/bin/uname"
openclaw approvals allowlist add --node <id|name|ip> "/usr/bin/sw_vers"
```

承認は node host 上の `~/.openclaw/exec-approvals.json` に保存されます。

### Point exec at the node

既定値を設定（ゲートウェイ設定）：

```bash
openclaw config set tools.exec.host node
openclaw config set tools.exec.security allowlist
openclaw config set tools.exec.node "<id-or-name>"
```

またはセッション単位で：

```
/exec host=node security=allowlist node=<id-or-name>
```

設定後、`host=node` を伴う `exec` の呼び出しは、（ノードの allowlist／承認に従って）node host 上で実行されます。

関連：

- [Node host CLI](/cli/node)
- [Exec tool](/tools/exec)
- [Exec approvals](/tools/exec-approvals)

## Invoking commands

低レベル（生 RPC）：

```bash
openclaw nodes invoke --node <idOrNameOrIp> --command canvas.eval --params '{"javaScript":"location.href"}'
```

一般的な「エージェントに MEDIA 添付を与える」ワークフロー向けに、より高レベルなヘルパーが用意されています。

## Screenshots (canvas snapshots)

ノードが Canvas（WebView）を表示している場合、`canvas.snapshot` は `{ format, base64 }` を返します。

CLI ヘルパー（テンポラリファイルに書き込み、`MEDIA:<path>` を出力）：

```bash
openclaw nodes canvas snapshot --node <idOrNameOrIp> --format png
openclaw nodes canvas snapshot --node <idOrNameOrIp> --format jpg --max-width 1200 --quality 0.9
```

### Canvas controls

```bash
openclaw nodes canvas present --node <idOrNameOrIp> --target https://example.com
openclaw nodes canvas hide --node <idOrNameOrIp>
openclaw nodes canvas navigate https://example.com --node <idOrNameOrIp>
openclaw nodes canvas eval --node <idOrNameOrIp> --js "document.title"
```

注記：

- `canvas present` は URL またはローカルファイルパス（`--target`）を受け取り、位置指定用のオプション `--x/--y/--width/--height` を指定できます。
- `canvas eval` はインライン JS（`--js`）または位置引数を受け取ります。

### A2UI (Canvas)

```bash
openclaw nodes canvas a2ui push --node <idOrNameOrIp> --text "Hello"
openclaw nodes canvas a2ui push --node <idOrNameOrIp> --jsonl ./payload.jsonl
openclaw nodes canvas a2ui reset --node <idOrNameOrIp>
```

注記：

- A2UI v0.8 JSONL のみをサポートします（v0.9／createSurface は拒否されます）。

## Photos + videos (node camera)

写真（`jpg`）：

```bash
openclaw nodes camera list --node <idOrNameOrIp>
openclaw nodes camera snap --node <idOrNameOrIp>            # default: both facings (2 MEDIA lines)
openclaw nodes camera snap --node <idOrNameOrIp> --facing front
```

動画クリップ（`mp4`）：

```bash
openclaw nodes camera clip --node <idOrNameOrIp> --duration 10s
openclaw nodes camera clip --node <idOrNameOrIp> --duration 3000 --no-audio
```

注記：

- `canvas.*` および `camera.*` では、ノードが **フォアグラウンド** である必要があります（バックグラウンド呼び出しは `NODE_BACKGROUND_UNAVAILABLE` を返します）。
- クリップの長さは、過大な base64 ペイロードを避けるために（現在は `<= 60s`）に制限されます。
- Android では可能な場合、`CAMERA`／`RECORD_AUDIO` の権限が求められます。拒否された場合は `*_PERMISSION_REQUIRED` で失敗します。

## Screen recordings (nodes)

ノードは `screen.record`（mp4）を公開します。例：

```bash
openclaw nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10
openclaw nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10 --no-audio
```

注記：

- `screen.record` には、ノードアプリがフォアグラウンドである必要があります。
- Android では、録画前にシステムの画面キャプチャ許可プロンプトが表示されます。
- 画面録画は `<= 60s` に制限されます。
- `--no-audio` はマイク収音を無効化します（iOS／Android でサポート；macOS はシステムキャプチャ音声を使用）。
- 複数ディスプレイがある場合、`--screen <index>` を使用して表示を選択します。

## Location (nodes)

設定で Location が有効な場合、ノードは `location.get` を公開します。

CLI ヘルパー：

```bash
openclaw nodes location get --node <idOrNameOrIp>
openclaw nodes location get --node <idOrNameOrIp> --accuracy precise --max-age 15000 --location-timeout 10000
```

注記：

- Location は **既定でオフ** です。
- 「常に」はシステム権限が必要です。バックグラウンド取得はベストエフォートです。
- 応答には緯度／経度、精度（メートル）、タイムスタンプが含まれます。

## SMS (Android nodes)

Android ノードは、ユーザーが **SMS** 権限を付与し、デバイスがテレフォニーをサポートしている場合に `sms.send` を公開できます。

低レベルの呼び出し：

```bash
openclaw nodes invoke --node <idOrNameOrIp> --command sms.send --params '{"to":"+15555550123","message":"Hello from OpenClaw"}'
```

注記：

- 機能が広告される前に、Android デバイス上で権限プロンプトを承認する必要があります。
- テレフォニーを持たない Wi‑Fi 専用デバイスは `sms.send` を広告しません。

## System commands (node host / mac node)

macOS ノードは `system.run`、`system.notify`、`system.execApprovals.get/set` を公開します。
ヘッドレス node host は `system.run`、`system.which`、`system.execApprovals.get/set` を公開します。

例：

```bash
openclaw nodes run --node <idOrNameOrIp> -- echo "Hello from mac node"
openclaw nodes notify --node <idOrNameOrIp> --title "Ping" --body "Gateway ready"
```

注記：

- `system.run` はペイロードに stdout／stderr／終了コードを返します。
- `system.notify` は macOS アプリの通知権限状態を尊重します。
- `system.run` は `--cwd`、`--env KEY=VAL`、`--command-timeout`、`--needs-screen-recording` をサポートします。
- `system.notify` は `--priority <passive|active|timeSensitive>` および `--delivery <system|overlay|auto>` をサポートします。
- macOS ノードは `PATH` の上書きを無視します。ヘッドレス node host は、node host の PATH を前置する場合にのみ `PATH` を受け付けます。
- macOS の node モードでは、`system.run` は macOS アプリの exec 承認（設定 → Exec approvals）によって制御されます。Ask／allowlist／full の挙動はヘッドレス node host と同一で、拒否されたプロンプトは `SYSTEM_RUN_DENIED` を返します。
- ヘッドレス node host では、`system.run` は exec 承認（`~/.openclaw/exec-approvals.json`）によって制御されます。

## Exec node binding

複数のノードが利用可能な場合、exec を特定のノードにバインドできます。これにより `exec host=node` の既定ノードが設定されます（エージェントごとに上書き可能）。

グローバル既定：

```bash
openclaw config set tools.exec.node "node-id-or-name"
```

エージェントごとの上書き：

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

任意のノードを許可するには解除：

```bash
openclaw config unset tools.exec.node
openclaw config unset agents.list[0].tools.exec.node
```

## Permissions map

ノードは `node.list`／`node.describe` 内に、権限名（例：`screenRecording`、`accessibility`）をキー、ブール値（`true`＝許可）を値とする `permissions` マップを含める場合があります。

## Headless node host (cross-platform)

OpenClaw は、Gateway（ゲートウェイ）の WebSocket に接続し、`system.run`／`system.which` を公開する **ヘッドレス node host**（UI なし）を実行できます。これは Linux／Windows、またはサーバーに最小構成のノードを併設する用途に有用です。

起動方法：

```bash
openclaw node run --host <gateway-host> --port 18789
```

注記：

- 依然としてペアリングが必要です（ゲートウェイにノード承認プロンプトが表示されます）。
- node host は、ノード ID、トークン、表示名、ゲートウェイ接続情報を `~/.openclaw/node.json` に保存します。
- exec 承認は `~/.openclaw/exec-approvals.json` によりローカルで強制されます
  （[Exec approvals](/tools/exec-approvals) を参照）。
- macOS では、ヘッドレス node host は到達可能な場合にコンパニオンアプリの exec ホストを優先し、アプリが利用できない場合はローカル実行にフォールバックします。アプリを必須にするには `OPENCLAW_NODE_EXEC_HOST=app`、フォールバックを無効化するには `OPENCLAW_NODE_EXEC_FALLBACK=0` を設定してください。
- Gateway WS が TLS を使用する場合は、`--tls`／`--tls-fingerprint` を追加してください。

## Mac node mode

- macOS のメニューバーアプリは、Gateway（ゲートウェイ）の WS サーバーにノードとして接続します（そのため、この Mac に対して `openclaw nodes …` が動作します）。
- リモートモードでは、アプリが Gateway のポート用に SSH トンネルを開き、`localhost` に接続します。
