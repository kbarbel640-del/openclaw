---
summary: 「Android 應用程式（節點）：連線操作手冊 + Canvas／聊天／相機」
read_when:
  - 配對或重新連線 Android 節點
  - 偵錯 Android Gateway 閘道器探索或驗證
  - 驗證跨客戶端的聊天歷史一致性
title: 「Android 應用程式」
x-i18n:
  source_path: platforms/android.md
  source_hash: 9cd02f12065ce2bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:01Z
---

# Android 應用程式（節點）

## 支援概覽

- 角色：配套節點應用程式（Android 不會託管 Gateway 閘道器）。
- 需要 Gateway 閘道器：是（在 macOS、Linux 或 Windows（透過 WSL2）上執行）。
- 安裝：[入門指南](/start/getting-started) + [配對](/gateway/pairing)。
- Gateway 閘道器：[操作手冊](/gateway) + [設定](/gateway/configuration)。
  - 通訊協定：[Gateway protocol](/gateway/protocol)（節點 + 控制平面）。

## 系統控制

系統控制（launchd/systemd）位於 Gateway 閘道器主機上。請參閱 [Gateway](/gateway)。

## 連線操作手冊

Android 節點應用程式 ⇄（mDNS/NSD + WebSocket）⇄ **Gateway 閘道器**

Android 會直接連線至 Gateway WebSocket（預設 `ws://<host>:18789`），並使用 Gateway 所擁有的配對機制。

### 先決條件

- 你可以在「主控」機器上執行 Gateway 閘道器。
- Android 裝置／模擬器可以連線到 Gateway WebSocket：
  - 同一個 LAN，使用 mDNS/NSD，**或**
  - 同一個 Tailscale tailnet，使用 Wide-Area Bonjour／單播 DNS-SD（見下文），**或**
  - 手動指定 Gateway 主機／連接埠（備援）
- 你可以在 Gateway 機器上執行 CLI（`openclaw`）（或透過 SSH）。

### 1）啟動 Gateway 閘道器

```bash
openclaw gateway --port 18789 --verbose
```

在日誌中確認你看到類似以下內容：

- `listening on ws://0.0.0.0:18789`

僅 tailnet 的設定（建議用於 Vienna ⇄ London），請將 Gateway 綁定至 tailnet IP：

- 在 Gateway 主機的 `~/.openclaw/openclaw.json` 中設定 `gateway.bind: "tailnet"`。
- 重新啟動 Gateway／macOS 選單列應用程式。

### 2）驗證探索（選用）

在 Gateway 機器上：

```bash
dns-sd -B _openclaw-gw._tcp local.
```

更多偵錯說明：[Bonjour](/gateway/bonjour)。

#### 透過單播 DNS-SD 的 Tailnet（Vienna ⇄ London）探索

Android 的 NSD/mDNS 探索不會跨網路。如果你的 Android 節點與 Gateway 位於不同網路，但透過 Tailscale 連線，請改用 Wide-Area Bonjour／單播 DNS-SD：

1. 在 Gateway 主機上設定一個 DNS-SD 區域（例如 `openclaw.internal.`），並發布 `_openclaw-gw._tcp` 記錄。
2. 為你選擇的網域設定 Tailscale split DNS，指向該 DNS 伺服器。

詳細說明與 CoreDNS 設定範例：[Bonjour](/gateway/bonjour)。

### 3）從 Android 連線

在 Android 應用程式中：

- 應用程式會透過 **前景服務**（常駐通知）維持 Gateway 連線。
- 開啟 **Settings**。
- 在 **Discovered Gateways** 下，選擇你的 Gateway，然後點擊 **Connect**。
- 如果 mDNS 被阻擋，請使用 **Advanced → Manual Gateway**（主機 + 連接埠）並點擊 **Connect（Manual）**。

首次成功配對後，Android 會在啟動時自動重新連線：

- 手動端點（若已啟用），否則
- 最近一次探索到的 Gateway（盡力而為）。

### 4）核准配對（CLI）

在 Gateway 機器上：

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

配對詳情：[Gateway pairing](/gateway/pairing)。

### 5）驗證節點已連線

- 透過節點狀態：
  ```bash
  openclaw nodes status
  ```
- 透過 Gateway：
  ```bash
  openclaw gateway call node.list --params "{}"
  ```

### 6）聊天 + 歷史紀錄

Android 節點的 Chat 面板使用 Gateway 的 **主要工作階段金鑰**（`main`），因此歷史與回覆會與 WebChat 及其他客戶端共用：

- 歷史：`chat.history`
- 傳送：`chat.send`
- 推送更新（盡力而為）：`chat.subscribe` → `event:"chat"`

### 7）Canvas + 相機

#### Gateway Canvas Host（建議用於網頁內容）

如果你希望節點顯示代理程式可在磁碟上編輯的真實 HTML/CSS/JS，請將節點指向 Gateway 的 canvas host。

注意：節點使用位於 `canvasHost.port` 的獨立 canvas host（預設 `18793`）。

1. 在 Gateway 主機上建立 `~/.openclaw/workspace/canvas/index.html`。

2. 導航節點至該位置（LAN）：

```bash
openclaw nodes invoke --node "<Android Node>" --command canvas.navigate --params '{"url":"http://<gateway-hostname>.local:18793/__openclaw__/canvas/"}'
```

Tailnet（選用）：若兩個裝置都在 Tailscale 上，請使用 MagicDNS 名稱或 tailnet IP 取代 `.local`，例如 `http://<gateway-magicdns>:18793/__openclaw__/canvas/`。

此伺服器會將即時重新載入的用戶端注入 HTML，並在檔案變更時重新載入。
A2UI 主機位於 `http://<gateway-host>:18793/__openclaw__/a2ui/`。

Canvas 指令（僅前景）：

- `canvas.eval`、`canvas.snapshot`、`canvas.navigate`（使用 `{"url":""}` 或 `{"url":"/"}` 以返回預設骨架）。`canvas.snapshot` 會回傳 `{ format, base64 }`（預設 `format="jpeg"`）。
- A2UI：`canvas.a2ui.push`、`canvas.a2ui.reset`（`canvas.a2ui.pushJSONL` 為舊版別名）

相機指令（僅前景；需權限）：

- `camera.snap`（jpg）
- `camera.clip`（mp4）

參閱 [Camera node](/nodes/camera) 以了解參數與 CLI 輔助工具。
