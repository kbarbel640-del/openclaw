---
summary: 「Gateway 服務的操作手冊，涵蓋生命週期與營運」
read_when:
  - 執行或除錯 Gateway 程序時
title: 「Gateway 操作手冊」
x-i18n:
  source_path: gateway/index.md
  source_hash: 497d58090faaa6bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:03Z
---

# Gateway 服務操作手冊

最後更新：2025-12-09

## 這是什麼

- 一個常駐程序，負責單一的 Baileys/Telegram 連線以及控制／事件平面。
- 取代舊版 `gateway` 指令。CLI 進入點：`openclaw gateway`。
- 會持續執行直到被停止；發生致命錯誤時以非零碼結束，讓監督程式重新啟動。

## 如何執行（本機）

```bash
openclaw gateway --port 18789
# for full debug/trace logs in stdio:
openclaw gateway --port 18789 --verbose
# if the port is busy, terminate listeners then start:
openclaw gateway --force
# dev loop (auto-reload on TS changes):
pnpm gateway:watch
```

- 設定熱重載會監看 `~/.openclaw/openclaw.json`（或 `OPENCLAW_CONFIG_PATH`）。
  - 預設模式：`gateway.reload.mode="hybrid"`（安全變更即時套用，關鍵變更需重啟）。
  - 需要時，熱重載會透過 **SIGUSR1** 進行行程內重啟。
  - 以 `gateway.reload.mode="off"` 停用。
- 將 WebSocket 控制平面繫結至 `127.0.0.1:<port>`（預設 18789）。
- 同一個連接埠也提供 HTTP（控制 UI、hooks、A2UI）。單一連接埠多工。
  - OpenAI Chat Completions（HTTP）：[`/v1/chat/completions`](/gateway/openai-http-api)。
  - OpenResponses（HTTP）：[`/v1/responses`](/gateway/openresponses-http-api)。
  - Tools Invoke（HTTP）：[`/tools/invoke`](/gateway/tools-invoke-http-api)。
- 預設在 `canvasHost.port` 啟動 Canvas 檔案伺服器（預設 `18793`），從 `~/.openclaw/workspace/canvas` 提供 `http://<gateway-host>:18793/__openclaw__/canvas/`。以 `canvasHost.enabled=false` 或 `OPENCLAW_SKIP_CANVAS_HOST=1` 停用。
- 記錄輸出至 stdout；使用 launchd/systemd 維持存活並輪替日誌。
- 疑難排解時，傳入 `--verbose` 以將除錯記錄（握手、req/res、事件）從日誌檔鏡射到 stdio。
- `--force` 會使用 `lsof` 尋找所選連接埠上的監聽者，送出 SIGTERM，記錄被終止的項目，然後啟動 Gateway（若缺少 `lsof` 則快速失敗）。
- 若在監督程式下執行（launchd/systemd/mac app 子行程模式），停止／重啟通常會送出 **SIGTERM**；較舊版本可能顯示為 `pnpm` `ELIFECYCLE` 結束碼 **143**（SIGTERM），這是正常關閉而非當機。
- **SIGUSR1** 在獲得授權時會觸發行程內重啟（gateway 工具／設定套用／更新，或啟用 `commands.restart` 以進行手動重啟）。
- 預設需要 Gateway 驗證：設定 `gateway.auth.token`（或 `OPENCLAW_GATEWAY_TOKEN`）或 `gateway.auth.password`。除非使用 Tailscale Serve 身分，否則用戶端必須送出 `connect.params.auth.token/password`。
- 精靈現在預設會產生權杖，即使在 loopback 亦然。
- 連接埠優先順序：`--port` > `OPENCLAW_GATEWAY_PORT` > `gateway.port` > 預設 `18789`。

## 遠端存取

- 優先使用 Tailscale/VPN；否則使用 SSH 通道：
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- 用戶端接著透過通道連線至 `ws://127.0.0.1:18789`。
- 若已設定權杖，即使經由通道，用戶端仍須在 `connect.params.auth.token` 中包含它。

## 多個 Gateway（同一主機）

通常沒有必要：單一 Gateway 可服務多個訊息頻道與代理程式。僅在需要備援或嚴格隔離（例如救援機器人）時才使用多個 Gateway。

在隔離狀態＋設定並使用唯一連接埠時可支援。完整指南：[Multiple gateways](/gateway/multiple-gateways)。

服務名稱具備設定檔感知：

- macOS：`bot.molt.<profile>`（可能仍存在舊版 `com.openclaw.*`）
- Linux：`openclaw-gateway-<profile>.service`
- Windows：`OpenClaw Gateway (<profile>)`

安裝中繼資料內嵌於服務設定：

- `OPENCLAW_SERVICE_MARKER=openclaw`
- `OPENCLAW_SERVICE_KIND=gateway`
- `OPENCLAW_SERVICE_VERSION=<version>`

救援機器人模式：保留第二個 Gateway，使用其專屬設定檔、狀態目錄、工作區與基準連接埠間距以達到隔離。完整指南：[Rescue-bot guide](/gateway/multiple-gateways#rescue-bot-guide)。

### Dev 設定檔（`--dev`）

快速路徑：在不影響主要設定的情況下，執行一個完全隔離的 dev 執行個體（設定／狀態／工作區）。

```bash
openclaw --dev setup
openclaw --dev gateway --allow-unconfigured
# then target the dev instance:
openclaw --dev status
openclaw --dev health
```

預設值（可透過 env／旗標／設定覆寫）：

- `OPENCLAW_STATE_DIR=~/.openclaw-dev`
- `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
- `OPENCLAW_GATEWAY_PORT=19001`（Gateway WS + HTTP）
- 瀏覽器控制服務連接埠 = `19003`（推導：`gateway.port+2`，僅 loopback）
- `canvasHost.port=19005`（推導：`gateway.port+4`）
- 當你在 `--dev` 下執行 `setup`/`onboard` 時，`agents.defaults.workspace` 的預設會變為 `~/.openclaw/workspace-dev`。

推導連接埠（經驗法則）：

- 基準連接埠 = `gateway.port`（或 `OPENCLAW_GATEWAY_PORT`／`--port`）
- 瀏覽器控制服務連接埠 = 基準 + 2（僅 loopback）
- `canvasHost.port = base + 4`（或 `OPENCLAW_CANVAS_HOST_PORT`／設定覆寫）
- 瀏覽器設定檔 CDP 連接埠自 `browser.controlPort + 9 .. + 108` 起自動配置（每個設定檔持久化）。

每個執行個體檢查清單：

- 唯一的 `gateway.port`
- 唯一的 `OPENCLAW_CONFIG_PATH`
- 唯一的 `OPENCLAW_STATE_DIR`
- 唯一的 `agents.defaults.workspace`
- 獨立的 WhatsApp 號碼（若使用 WA）

每個設定檔的服務安裝：

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

範例：

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/a.json OPENCLAW_STATE_DIR=~/.openclaw-a openclaw gateway --port 19001
OPENCLAW_CONFIG_PATH=~/.openclaw/b.json OPENCLAW_STATE_DIR=~/.openclaw-b openclaw gateway --port 19002
```

## 協定（操作人員視角）

- 完整文件：[Gateway protocol](/gateway/protocol) 與 [Bridge protocol（舊版）](/gateway/bridge-protocol)。
- 用戶端必須送出的第一個影格：`req {type:"req", id, method:"connect", params:{minProtocol,maxProtocol,client:{id,displayName?,version,platform,deviceFamily?,modelIdentifier?,mode,instanceId?}, caps, auth?, locale?, userAgent? } }`。
- Gateway 回覆 `res {type:"res", id, ok:true, payload:hello-ok }`（或發生錯誤時回覆 `ok:false`，然後關閉）。
- 握手完成後：
  - 請求：`{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - 事件：`{type:"event", event, payload, seq?, stateVersion?}`
- 結構化 presence 項目：`{host, ip, version, platform?, deviceFamily?, modelIdentifier?, mode, lastInputSeconds?, ts, reason?, tags?[], instanceId? }`（對 WS 用戶端，`instanceId` 來自 `connect.client.instanceId`）。
- `agent` 回應為兩階段：先回 `res` ack `{runId,status:"accepted"}`，待執行完成後再回最終的 `res` `{runId,status:"ok"|"error",summary}`；串流輸出會以 `event:"agent"` 抵達。

## 方法（初始集合）

- `health` — 完整健康快照（外形同 `openclaw health --json`）。
- `status` — 簡要摘要。
- `system-presence` — 目前的 presence 清單。
- `system-event` — 發布 presence／系統備註（結構化）。
- `send` — 透過作用中的頻道送出訊息。
- `agent` — 執行代理程式回合（在同一連線回傳事件串流）。
- `node.list` — 列出已配對與目前連線的節點（包含 `caps`、`deviceFamily`、`modelIdentifier`、`paired`、`connected`，以及宣告的 `commands`）。
- `node.describe` — 描述節點（能力＋支援的 `node.invoke` 指令；適用於已配對節點與目前連線但未配對的節點）。
- `node.invoke` — 在節點上呼叫指令（例如 `canvas.*`、`camera.*`）。
- `node.pair.*` — 配對生命週期（`request`、`list`、`approve`、`reject`、`verify`）。

另請參閱：[Presence](/concepts/presence) 以了解 presence 如何產生／去重，以及為何穩定的 `client.instanceId` 很重要。

## 事件

- `agent` — 來自代理程式執行的工具／輸出事件串流（具序列標記）。
- `presence` — presence 更新（含 stateVersion 的差量）推送給所有已連線用戶端。
- `tick` — 週期性的 keepalive／no-op，用於確認存活。
- `shutdown` — Gateway 正在結束；負載包含 `reason` 與可選的 `restartExpectedMs`。用戶端應重新連線。

## WebChat 整合

- WebChat 是原生 SwiftUI UI，直接透過 Gateway WebSocket 進行歷史、傳送、取消與事件。
- 遠端使用透過相同的 SSH/Tailscale 通道；若已設定 gateway 權杖，用戶端會在 `connect` 期間包含它。
- macOS 應用程式透過單一 WS 連線（共用連線）連接；它會從初始快照補水 presence，並監聽 `presence` 事件以更新 UI。

## 型別與驗證

- 伺服器使用 AJV，依據由協定定義產生的 JSON Schema 驗證每個入站影格。
- 用戶端（TS/Swift）使用產生的型別（TS 直接使用；Swift 透過儲存庫的產生器）。
- 協定定義是唯一事實來源；以以下方式重新產生 schema／models：
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`

## 連線快照

- `hello-ok` 包含一個 `snapshot`，其中含有 `presence`、`health`、`stateVersion` 與 `uptimeMs`，以及 `policy {maxPayload,maxBufferedBytes,tickIntervalMs}`，讓用戶端無需額外請求即可立即呈現。
- `health`/`system-presence` 仍可用於手動重新整理，但連線時並非必要。

## 錯誤碼（res.error 形狀）

- 錯誤使用 `{ code, message, details?, retryable?, retryAfterMs? }`。
- 標準碼：
  - `NOT_LINKED` — WhatsApp 未驗證。
  - `AGENT_TIMEOUT` — 代理程式未在設定的期限內回應。
  - `INVALID_REQUEST` — schema／參數驗證失敗。
  - `UNAVAILABLE` — Gateway 正在關閉或相依性不可用。

## Keepalive 行為

- 會定期送出 `tick` 事件（或 WS ping/pong），即使沒有流量也能讓用戶端知道 Gateway 仍存活。
- 傳送／代理程式的確認仍是獨立回應；不要將 ticks 過載用於傳送。

## 重播／缺口

- 事件不會重播。用戶端偵測到序列缺口時，應在繼續前重新整理（`health` + `system-presence`）。WebChat 與 macOS 用戶端現在會在發現缺口時自動重新整理。

## 監督（macOS 範例）

- 使用 launchd 維持服務存活：
  - Program：`openclaw` 的路徑
  - Arguments：`gateway`
  - KeepAlive：true
  - StandardOut/Err：檔案路徑或 `syslog`
- 失敗時，launchd 會重新啟動；致命錯誤的錯誤設定應持續退出，讓操作人員察覺。
- LaunchAgents 為每使用者，且需要登入中的工作階段；無頭設定請使用自訂 LaunchDaemon（未隨附）。
  - `openclaw gateway install` 會寫入 `~/Library/LaunchAgents/bot.molt.gateway.plist`
    （或 `bot.molt.<profile>.plist`；舊版 `com.openclaw.*` 會被清理）。
  - `openclaw doctor` 會稽核 LaunchAgent 設定，並可更新至目前預設。

## Gateway 服務管理（CLI）

使用 Gateway CLI 進行安裝／啟動／停止／重啟／狀態：

```bash
openclaw gateway status
openclaw gateway install
openclaw gateway stop
openclaw gateway restart
openclaw logs --follow
```

注意事項：

- `gateway status` 預設使用服務解析後的連接埠／設定探測 Gateway RPC（可用 `--url` 覆寫）。
- `gateway status --deep` 會加入系統層級掃描（LaunchDaemons/system units）。
- `gateway status --no-probe` 會略過 RPC 探測（網路中斷時很有用）。
- `gateway status --json` 對腳本而言是穩定的。
- `gateway status` 會分別回報 **監督程式執行狀態**（launchd/systemd 是否在跑）與 **RPC 可達性**（WS 連線 + status RPC）。
- `gateway status` 會印出設定路徑與探測目標，以避免「localhost vs LAN 綁定」混淆與設定檔不匹配。
- `gateway status` 在服務看似執行但連接埠關閉時，會包含最後一行 Gateway 錯誤。
- `logs` 會透過 RPC tail Gateway 檔案日誌（無需手動 `tail`/`grep`）。
- 若偵測到其他類似 gateway 的服務，CLI 會發出警告，除非它們是 OpenClaw 設定檔服務。
  我們仍建議 **每台機器一個 gateway** 作為多數設定；如需備援或救援機器人，請使用隔離的設定檔／連接埠。請參閱 [Multiple gateways](/gateway/multiple-gateways)。
  - 清理：`openclaw gateway uninstall`（目前服務）與 `openclaw doctor`（舊版遷移）。
- `gateway install` 在已安裝時為 no-op；使用 `openclaw gateway install --force` 重新安裝（設定檔／env／路徑變更）。

隨附的 mac 應用程式：

- OpenClaw.app 可封裝一個以 Node 為基礎的 gateway relay，並安裝每使用者的 LaunchAgent，標籤為
  `bot.molt.gateway`（或 `bot.molt.<profile>`；舊版 `com.openclaw.*` 標籤仍可乾淨卸載）。
- 要乾淨停止，使用 `openclaw gateway stop`（或 `launchctl bootout gui/$UID/bot.molt.gateway`）。
- 要重啟，使用 `openclaw gateway restart`（或 `launchctl kickstart -k gui/$UID/bot.molt.gateway`）。
  - `launchctl` 僅在已安裝 LaunchAgent 時可用；否則請先使用 `openclaw gateway install`。
  - 執行具名設定檔時，請以 `bot.molt.<profile>` 取代標籤。

## 監督（systemd 使用者單元）

OpenClaw 在 Linux/WSL2 上預設安裝 **systemd 使用者服務**。我們
建議單使用者機器使用使用者服務（環境較簡單、每使用者設定）。
多使用者或常駐伺服器則使用 **系統服務**（不需 lingering、共享監督）。

`openclaw gateway install` 會寫入使用者單元。`openclaw doctor` 會稽核
該單元，並可更新以符合目前建議的預設。

建立 `~/.config/systemd/user/openclaw-gateway[-<profile>].service`：

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5
Environment=OPENCLAW_GATEWAY_TOKEN=
WorkingDirectory=/home/youruser

[Install]
WantedBy=default.target
```

啟用 lingering（必要，讓使用者服務在登出／閒置後仍存活）：

```
sudo loginctl enable-linger youruser
```

在 Linux/WSL2 上，入門引導會執行此步驟（可能提示 sudo；會寫入 `/var/lib/systemd/linger`）。
接著啟用服務：

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```

**替代方案（系統服務）** — 對於常駐或多使用者伺服器，你可以
安裝 systemd **系統** 單元來取代使用者單元（不需 lingering）。
建立 `/etc/systemd/system/openclaw-gateway[-<profile>].service`（複製上方單元，
切換 `WantedBy=multi-user.target`，設定 `User=` + `WorkingDirectory=`），然後：

```
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway[-<profile>].service
```

## Windows（WSL2）

Windows 安裝應使用 **WSL2**，並遵循上方的 Linux systemd 章節。

## 營運檢查

- 存活度：開啟 WS 並送出 `req:connect` → 預期 `res`，其中含 `payload.type="hello-ok"`（含快照）。
- 就緒度：呼叫 `health` → 預期 `ok: true`，以及在適用時於 `linkChannel` 中有連結的頻道。
- 除錯：訂閱 `tick` 與 `presence` 事件；確認 `status` 顯示連結／驗證年齡；presence 項目顯示 Gateway 主機與已連線用戶端。

## 安全保證

- 預設假設每台主機一個 Gateway；若執行多個設定檔，請隔離連接埠／狀態並指向正確的執行個體。
- 不回退至直接的 Baileys 連線；若 Gateway 停機，傳送會快速失敗。
- 非連線首個影格或不正確的 JSON 會被拒絕並關閉 socket。
- 優雅關閉：在關閉前送出 `shutdown` 事件；用戶端必須處理關閉與重新連線。

## CLI 輔助指令

- `openclaw gateway health|status` — 透過 Gateway WS 請求健康／狀態。
- `openclaw message send --target <num> --message "hi" [--media ...]` — 透過 Gateway 傳送（對 WhatsApp 具冪等性）。
- `openclaw agent --message "hi" --to <num>` — 執行代理程式回合（預設等待最終結果）。
- `openclaw gateway call <method> --params '{"k":"v"}'` — 用於除錯的原始方法呼叫器。
- `openclaw gateway stop|restart` — 停止／重啟受監督的 gateway 服務（launchd/systemd）。
- Gateway 輔助子指令假設在 `--url` 上有正在執行的 gateway；不再自動啟動。

## 遷移指引

- 淘汰 `openclaw gateway` 與舊版 TCP 控制連接埠的使用。
- 更新用戶端以使用 WS 協定，包含強制的 connect 與結構化 presence。
