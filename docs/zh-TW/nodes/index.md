---
summary: "Nodes：配對、能力、權限，以及 canvas／camera／screen／system 的 CLI 輔助工具"
read_when:
  - 將 iOS／Android 節點配對到 Gateway 閘道器
  - 使用節點的 canvas／camera 作為代理程式情境
  - 新增節點指令或 CLI 輔助工具
title: "Nodes"
x-i18n:
  source_path: nodes/index.md
  source_hash: 74e9420f61c653e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:11Z
---

# Nodes

**node** 是一個配套裝置（macOS／iOS／Android／headless），會連線到 Gateway **WebSocket**（與 operators 相同的連接埠），使用 `role: "node"`，並透過 `node.invoke` 暴露指令介面（例如 `canvas.*`、`camera.*`、`system.*`）。協定細節請見：[Gateway protocol](/gateway/protocol)。

舊版傳輸方式：[Bridge protocol](/gateway/bridge-protocol)（TCP JSONL；已淘汰／目前節點已移除）。

macOS 也可在 **node mode** 下執行：選單列應用程式會連線到 Gateway 的 WS 伺服器，並將其本機的 canvas／camera 指令作為節點暴露（因此 `openclaw nodes …` 可針對此 Mac 使用）。

注意事項：

- Nodes 是**周邊裝置**，不是 Gateway。它們不會執行 gateway 服務。
- Telegram／WhatsApp／等訊息會送達 **gateway**，而不是 nodes。

## Pairing + status

**WS nodes 使用裝置配對。** Nodes 在 `connect` 期間提供裝置身分；Gateway 會為 `role: node` 建立裝置配對請求。請透過裝置的 CLI（或 UI）核准。

快速 CLI：

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
openclaw nodes status
openclaw nodes describe --node <idOrNameOrIp>
```

注意事項：

- 當其裝置配對角色包含 `node` 時，`nodes status` 會將節點標記為**已配對**。
- `node.pair.*`（CLI：`openclaw nodes pending/approve/reject`）是由 gateway 擁有的獨立節點配對儲存；它**不會**限制 WS 的 `connect` 交握。

## Remote node host（system.run）

當 Gateway 執行在一台機器上，而你希望指令在另一台機器上執行時，請使用 **node host**。模型仍與 **gateway** 對話；當選擇 `host=node` 時，gateway 會將 `exec` 呼叫轉送至 **node host**。

### What runs where

- **Gateway host**：接收訊息、執行模型、路由工具呼叫。
- **Node host**：在節點機器上執行 `system.run`／`system.which`。
- **Approvals**：由 `~/.openclaw/exec-approvals.json` 在 node host 上強制執行。

### Start a node host（foreground）

在節點機器上：

```bash
openclaw node run --host <gateway-host> --port 18789 --display-name "Build Node"
```

### Remote gateway via SSH tunnel（loopback bind）

若 Gateway 綁定到 loopback（`gateway.bind=loopback`，本機模式預設），遠端 node host 無法直接連線。請建立 SSH tunnel，並將 node host 指向 tunnel 的本機端。

範例（node host -> gateway host）：

```bash
# Terminal A (keep running): forward local 18790 -> gateway 127.0.0.1:18789
ssh -N -L 18790:127.0.0.1:18789 user@gateway-host

# Terminal B: export the gateway token and connect through the tunnel
export OPENCLAW_GATEWAY_TOKEN="<gateway-token>"
openclaw node run --host 127.0.0.1 --port 18790 --display-name "Build Node"
```

注意事項：

- 權杖來自 gateway 設定中的 `gateway.auth.token`（在 gateway host 上的 `~/.openclaw/openclaw.json`）。
- `openclaw node run` 會讀取 `OPENCLAW_GATEWAY_TOKEN` 進行驗證。

### Start a node host（service）

```bash
openclaw node install --host <gateway-host> --port 18789 --display-name "Build Node"
openclaw node restart
```

### Pair + name

在 gateway host 上：

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes list
```

命名選項：

- 在 `openclaw node run`／`openclaw node install` 上設定 `--display-name`（會持久化到節點上的 `~/.openclaw/node.json`）。
- `openclaw nodes rename --node <id|name|ip> --name "Build Node"`（gateway 覆寫）。

### Allowlist the commands

Exec 核准是**以 node host 為單位**。請從 gateway 新增 allowlist 項目：

```bash
openclaw approvals allowlist add --node <id|name|ip> "/usr/bin/uname"
openclaw approvals allowlist add --node <id|name|ip> "/usr/bin/sw_vers"
```

核准資料會儲存在 node host 的 `~/.openclaw/exec-approvals.json`。

### Point exec at the node

設定預設值（gateway 設定）：

```bash
openclaw config set tools.exec.host node
openclaw config set tools.exec.security allowlist
openclaw config set tools.exec.node "<id-or-name>"
```

或於每個 session 設定：

```
/exec host=node security=allowlist node=<id-or-name>
```

設定完成後，任何帶有 `host=node` 的 `exec` 呼叫都會在 node host 上執行（受限於節點的 allowlist／核准）。

相關：

- [Node host CLI](/cli/node)
- [Exec tool](/tools/exec)
- [Exec approvals](/tools/exec-approvals)

## Invoking commands

低階（raw RPC）：

```bash
openclaw nodes invoke --node <idOrNameOrIp> --command canvas.eval --params '{"javaScript":"location.href"}'
```

針對常見的「為代理程式提供 MEDIA 附件」工作流程，提供了更高階的輔助工具。

## Screenshots（canvas snapshots）

若節點正在顯示 Canvas（WebView），`canvas.snapshot` 會回傳 `{ format, base64 }`。

CLI 輔助工具（寫入暫存檔並輸出 `MEDIA:<path>`）：

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

注意事項：

- `canvas present` 接受 URL 或本機檔案路徑（`--target`），以及用於定位的選用 `--x/--y/--width/--height`。
- `canvas eval` 接受內嵌 JS（`--js`）或位置參數。

### A2UI（Canvas）

```bash
openclaw nodes canvas a2ui push --node <idOrNameOrIp> --text "Hello"
openclaw nodes canvas a2ui push --node <idOrNameOrIp> --jsonl ./payload.jsonl
openclaw nodes canvas a2ui reset --node <idOrNameOrIp>
```

注意事項：

- 僅支援 A2UI v0.8 JSONL（v0.9／createSurface 會被拒絕）。

## Photos + videos（node camera）

照片（`jpg`）：

```bash
openclaw nodes camera list --node <idOrNameOrIp>
openclaw nodes camera snap --node <idOrNameOrIp>            # default: both facings (2 MEDIA lines)
openclaw nodes camera snap --node <idOrNameOrIp> --facing front
```

影片片段（`mp4`）：

```bash
openclaw nodes camera clip --node <idOrNameOrIp> --duration 10s
openclaw nodes camera clip --node <idOrNameOrIp> --duration 3000 --no-audio
```

注意事項：

- `canvas.*` 與 `camera.*` 需要節點在**前景**（背景呼叫會回傳 `NODE_BACKGROUND_UNAVAILABLE`）。
- 片段時長會被限制（目前為 `<= 60s`），以避免過大的 base64 負載。
- Android 會在可能時提示 `CAMERA`／`RECORD_AUDIO` 權限；被拒絕的權限會以 `*_PERMISSION_REQUIRED` 失敗。

## Screen recordings（nodes）

Nodes 會暴露 `screen.record`（mp4）。範例：

```bash
openclaw nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10
openclaw nodes screen record --node <idOrNameOrIp> --duration 10s --fps 10 --no-audio
```

注意事項：

- `screen.record` 需要節點應用程式在前景。
- Android 在錄製前會顯示系統螢幕擷取提示。
- 螢幕錄製會被限制為 `<= 60s`。
- `--no-audio` 會停用麥克風錄音（iOS／Android 支援；macOS 使用系統擷取音訊）。
- 使用 `--screen <index>` 在有多個螢幕時選擇顯示器。

## Location（nodes）

當設定中啟用 Location 時，Nodes 會暴露 `location.get`。

CLI 輔助工具：

```bash
openclaw nodes location get --node <idOrNameOrIp>
openclaw nodes location get --node <idOrNameOrIp> --accuracy precise --max-age 15000 --location-timeout 10000
```

注意事項：

- Location 預設為**關閉**。
- 「Always」需要系統權限；背景擷取為最佳努力。
- 回應包含 緯度／經度、精度（公尺），以及時間戳記。

## SMS（Android nodes）

當使用者授予 **SMS** 權限且裝置支援電信功能時，Android nodes 可暴露 `sms.send`。

低階呼叫：

```bash
openclaw nodes invoke --node <idOrNameOrIp> --command sms.send --params '{"to":"+15555550123","message":"Hello from OpenClaw"}'
```

注意事項：

- 在 Android 裝置上必須先接受權限提示，能力才會被宣告。
- 僅 Wi‑Fi、未支援電信的裝置不會宣告 `sms.send`。

## System commands（node host／mac node）

macOS node 會暴露 `system.run`、`system.notify`、以及 `system.execApprovals.get/set`。
headless node host 會暴露 `system.run`、`system.which`、以及 `system.execApprovals.get/set`。

範例：

```bash
openclaw nodes run --node <idOrNameOrIp> -- echo "Hello from mac node"
openclaw nodes notify --node <idOrNameOrIp> --title "Ping" --body "Gateway ready"
```

注意事項：

- `system.run` 會在負載中回傳 stdout／stderr／exit code。
- `system.notify` 會遵循 macOS 應用程式的通知權限狀態。
- `system.run` 支援 `--cwd`、`--env KEY=VAL`、`--command-timeout`、以及 `--needs-screen-recording`。
- `system.notify` 支援 `--priority <passive|active|timeSensitive>` 與 `--delivery <system|overlay|auto>`。
- macOS nodes 會忽略 `PATH` 覆寫；headless node hosts 僅在其前置 node host PATH 時接受 `PATH`。
- 在 macOS node mode 下，`system.run` 受 macOS 應用程式中的 exec 核准（設定 → Exec approvals）所限制。
  Ask／allowlist／full 的行為與 headless node host 相同；被拒絕的提示會回傳 `SYSTEM_RUN_DENIED`。
- 在 headless node host 上，`system.run` 受 exec 核准（`~/.openclaw/exec-approvals.json`）所限制。

## Exec node binding

當有多個 nodes 可用時，你可以將 exec 綁定到特定 node。
這會為 `exec host=node` 設定預設 node（也可依代理程式覆寫）。

全域預設：

```bash
openclaw config set tools.exec.node "node-id-or-name"
```

每個代理程式覆寫：

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

取消設定以允許任何 node：

```bash
openclaw config unset tools.exec.node
openclaw config unset agents.list[0].tools.exec.node
```

## Permissions map

Nodes 可能會在 `node.list`／`node.describe` 中包含 `permissions` 對應表，
以權限名稱為鍵（例如 `screenRecording`、`accessibility`），值為布林（`true` = 已授權）。

## Headless node host（cross-platform）

OpenClaw 可執行 **headless node host**（無 UI），連線到 Gateway
WebSocket 並暴露 `system.run`／`system.which`。這對於 Linux／Windows
或在伺服器旁執行最小化節點非常有用。

啟動方式：

```bash
openclaw node run --host <gateway-host> --port 18789
```

注意事項：

- 仍需要配對（Gateway 會顯示節點核准提示）。
- node host 會將其 node id、token、顯示名稱，以及 gateway 連線資訊儲存在 `~/.openclaw/node.json`。
- Exec 核准會透過 `~/.openclaw/exec-approvals.json` 在本機強制執行
  （請見 [Exec approvals](/tools/exec-approvals)）。
- 在 macOS 上，headless node host 在可連線時會優先使用配套應用程式的 exec host，
  若應用程式不可用則回退為本機執行。設定 `OPENCLAW_NODE_EXEC_HOST=app` 以要求
  必須使用應用程式，或設定 `OPENCLAW_NODE_EXEC_FALLBACK=0` 以停用回退。
- 當 Gateway WS 使用 TLS 時，加入 `--tls`／`--tls-fingerprint`。

## Mac node mode

- macOS 選單列應用程式會以 node 身分連線到 Gateway WS 伺服器（因此 `openclaw nodes …` 可針對此 Mac 使用）。
- 在遠端模式下，應用程式會為 Gateway 連接埠開啟 SSH tunnel，並連線到 `localhost`。
