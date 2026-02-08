---
summary: 「Bonjour/mDNS 探索 + 除錯（Gateway 信標、用戶端與常見失敗模式）」
read_when:
  - 在 macOS/iOS 上除錯 Bonjour 探索問題
  - 變更 mDNS 服務類型、TXT 記錄或探索 UX
title: 「Bonjour 探索」
x-i18n:
  source_path: gateway/bonjour.md
  source_hash: 47569da55f0c0523
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:24Z
---

# Bonjour / mDNS 探索

OpenClaw 使用 Bonjour（mDNS / DNS‑SD）作為 **僅限 LAN 的便利機制** 來探索
作用中的 Gateway（WebSocket 端點）。這是最佳努力機制，並 **不** 取代 SSH 或
基於 Tailnet 的連線能力。

## 透過 Tailscale 的廣域 Bonjour（單播 DNS‑SD）

如果節點與 Gateway 位於不同網路，多播 mDNS 無法跨越
邊界。你可以改用透過 Tailscale 的 **單播 DNS‑SD**
（「廣域 Bonjour」）來維持相同的探索 UX。

高階步驟：

1. 在 Gateway 主機上執行一個 DNS 伺服器（可透過 Tailnet 存取）。
2. 在專用區域下為 `_openclaw-gw._tcp` 發佈 DNS‑SD 記錄
   （範例：`openclaw.internal.`）。
3. 設定 Tailscale **分割 DNS**，讓你的選定網域透過該
   DNS 伺服器為用戶端（包含 iOS）進行解析。

OpenClaw 支援任何探索網域；`openclaw.internal.` 只是範例。
iOS/Android 節點會同時瀏覽 `local.` 與你設定的廣域網域。

### Gateway 設定（建議）

```json5
{
  gateway: { bind: "tailnet" }, // tailnet-only (recommended)
  discovery: { wideArea: { enabled: true } }, // enables wide-area DNS-SD publishing
}
```

### 一次性的 DNS 伺服器設定（Gateway 主機）

```bash
openclaw dns setup --apply
```

這會安裝 CoreDNS 並設定為：

- 僅在 Gateway 的 Tailscale 介面上監聽 53 連接埠
- 從 `~/.openclaw/dns/<domain>.db` 提供你選定的網域（範例：`openclaw.internal.`）

從已連線至 tailnet 的機器驗證：

```bash
dns-sd -B _openclaw-gw._tcp openclaw.internal.
dig @<TAILNET_IPV4> -p 53 _openclaw-gw._tcp.openclaw.internal PTR +short
```

### Tailscale DNS 設定

在 Tailscale 管理主控台中：

- 新增一個指向 Gateway tailnet IP 的名稱伺服器（UDP/TCP 53）。
- 新增分割 DNS，讓你的探索網域使用該名稱伺服器。

一旦用戶端接受 tailnet DNS，iOS 節點即可在你的探索網域中
瀏覽 `_openclaw-gw._tcp`，而不需多播。

### Gateway 監聽器安全性（建議）

Gateway 的 WS 連接埠（預設 `18789`）預設綁定在 loopback。若需 LAN/tailnet
存取，請明確綁定並保持驗證啟用。

僅限 tailnet 的設定：

- 在 `~/.openclaw/openclaw.json` 中設定 `gateway.bind: "tailnet"`。
- 重新啟動 Gateway（或重新啟動 macOS 選單列應用程式）。

## 何者會進行廣告

只有 Gateway 會廣告 `_openclaw-gw._tcp`。

## 服務類型

- `_openclaw-gw._tcp` — Gateway 傳輸信標（由 macOS/iOS/Android 節點使用）。

## TXT 金鑰（非機密提示）

Gateway 會廣告一些小型且非機密的提示，以讓 UI 流程更便利：

- `role=gateway`
- `displayName=<friendly name>`
- `lanHost=<hostname>.local`
- `gatewayPort=<port>`（Gateway WS + HTTP）
- `gatewayTls=1`（僅在啟用 TLS 時）
- `gatewayTlsSha256=<sha256>`（僅在啟用 TLS 且指紋可用時）
- `canvasPort=<port>`（僅在啟用畫布主機時；預設 `18793`）
- `sshPort=<port>`（未覆寫時預設為 22）
- `transport=gateway`
- `cliPath=<path>`（選用；可執行的 `openclaw` 進入點之絕對路徑）
- `tailnetDns=<magicdns>`（當 Tailnet 可用時的選用提示）

## 在 macOS 上除錯

實用的內建工具：

- 瀏覽實例：
  ```bash
  dns-sd -B _openclaw-gw._tcp local.
  ```
- 解析單一實例（替換 `<instance>`）：
  ```bash
  dns-sd -L "<instance>" _openclaw-gw._tcp local.
  ```

如果瀏覽可行但解析失敗，通常是遇到 LAN 政策或
mDNS 解析器問題。

## 在 Gateway 記錄中除錯

Gateway 會寫入循環記錄檔（在啟動時列印為
`gateway log file: ...`）。請尋找 `bonjour:` 行，特別是：

- `bonjour: advertise failed ...`
- `bonjour: ... name conflict resolved` / `hostname conflict resolved`
- `bonjour: watchdog detected non-announced service ...`

## 在 iOS 節點上除錯

iOS 節點使用 `NWBrowser` 來探索 `_openclaw-gw._tcp`。

擷取記錄：

- 設定 → Gateway → 進階 → **探索除錯記錄**
- 設定 → Gateway → 進階 → **探索記錄** → 重現 → **複製**

記錄包含瀏覽器狀態轉換與結果集變更。

## 常見失敗模式

- **Bonjour 無法跨網路**：使用 Tailnet 或 SSH。
- **多播被封鎖**：某些 Wi‑Fi 網路會停用 mDNS。
- **睡眠 / 介面變動**：macOS 可能暫時丟失 mDNS 結果；請重試。
- **瀏覽可行但解析失敗**：保持機器名稱簡單（避免表情符號或
  標點符號），然後重新啟動 Gateway。服務實例名稱源自
  主機名稱，過於複雜的名稱可能會讓部分解析器困惑。

## 逸出處理的實例名稱（`\032`）

Bonjour/DNS‑SD 常會將服務實例名稱中的位元組
以十進位 `\DDD` 序列進行逸出（例如，空白會變成 `\032`）。

- 這在通訊協定層級屬於正常行為。
- UI 應解碼後再顯示（iOS 使用 `BonjourEscapes.decode`）。

## 停用 / 設定

- `OPENCLAW_DISABLE_BONJOUR=1` 會停用廣告（舊版：`OPENCLAW_DISABLE_BONJOUR`）。
- `gateway.bind`（於 `~/.openclaw/openclaw.json`）控制 Gateway 綁定模式。
- `OPENCLAW_SSH_PORT` 會覆寫在 TXT 中廣告的 SSH 連接埠（舊版：`OPENCLAW_SSH_PORT`）。
- `OPENCLAW_TAILNET_DNS` 會在 TXT 中發佈 MagicDNS 提示（舊版：`OPENCLAW_TAILNET_DNS`）。
- `OPENCLAW_CLI_PATH` 會覆寫廣告的 CLI 路徑（舊版：`OPENCLAW_CLI_PATH`）。

## 相關文件

- 探索政策與傳輸選擇：[Discovery](/gateway/discovery)
- 節點配對與核准：[Gateway pairing](/gateway/pairing)
