---
summary: 「整合式瀏覽器控制服務 + 動作指令」
read_when:
  - 新增由代理程式控制的瀏覽器自動化
  - 偵錯為何 OpenClaw 正在干擾你自己的 Chrome
  - 在 macOS 應用程式中實作瀏覽器設定與生命週期
title: 「瀏覽器（由 OpenClaw 管理）」
x-i18n:
  source_path: tools/browser.md
  source_hash: a868d040183436a1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:38Z
---

# 瀏覽器（由 openclaw 管理）

OpenClaw 可以執行一個**專用的 Chrome/Brave/Edge/Chromium 設定檔**，由代理程式進行控制。
它與你的個人瀏覽器相互隔離，並透過 Gateway 閘道器 內部的一個小型本機
控制服務進行管理（僅限 loopback）。

初學者視角：

- 把它想成一個**只給代理程式使用的獨立瀏覽器**。
- `openclaw` 設定檔**不會**接觸你的個人瀏覽器設定檔。
- 代理程式可以在安全通道中**開啟分頁、讀取頁面、點擊與輸入**。
- 預設的 `chrome` 設定檔會透過
  擴充功能轉送使用**系統預設的 Chromium 瀏覽器**；切換到 `openclaw` 以使用隔離的受管瀏覽器。

## 你能獲得什麼

- 一個名為 **openclaw** 的獨立瀏覽器設定檔（預設為橘色重點色）。
- 可預期的分頁控制（列出／開啟／聚焦／關閉）。
- 代理程式動作（點擊／輸入／拖曳／選取）、快照、螢幕截圖、PDF。
- 選用的多設定檔支援（`openclaw`、`work`、`remote`、…）。

此瀏覽器**不是**你的日常主力。它是一個安全、隔離的介面，
用於代理程式自動化與驗證。

## 快速開始

```bash
openclaw browser --browser-profile openclaw status
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

如果你看到「Browser disabled」，請在設定中啟用它（見下方）並重新啟動
Gateway 閘道器。

## 設定檔：`openclaw` vs `chrome`

- `openclaw`：受管、隔離的瀏覽器（不需要擴充功能）。
- `chrome`：透過擴充功能轉送到你的**系統瀏覽器**
  （需要將 OpenClaw 擴充功能附加到某個分頁）。

如果你希望預設使用受管模式，請設定 `browser.defaultProfile: "openclaw"`。

## 設定

瀏覽器設定位於 `~/.openclaw/openclaw.json`。

```json5
{
  browser: {
    enabled: true, // default: true
    // cdpUrl: "http://127.0.0.1:18792", // legacy single-profile override
    remoteCdpTimeoutMs: 1500, // remote CDP HTTP timeout (ms)
    remoteCdpHandshakeTimeoutMs: 3000, // remote CDP WebSocket handshake timeout (ms)
    defaultProfile: "chrome",
    color: "#FF4500",
    headless: false,
    noSandbox: false,
    attachOnly: false,
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    profiles: {
      openclaw: { cdpPort: 18800, color: "#FF4500" },
      work: { cdpPort: 18801, color: "#0066CC" },
      remote: { cdpUrl: "http://10.0.0.42:9222", color: "#00AA00" },
    },
  },
}
```

注意事項：

- 瀏覽器控制服務會綁定到來自 `gateway.port` 推導出的 loopback 連接埠
  （預設：`18791`，即 gateway + 2）。轉送器使用下一個連接埠（`18792`）。
- 如果你覆寫 Gateway 連接埠（`gateway.port` 或 `OPENCLAW_GATEWAY_PORT`），
  推導出的瀏覽器連接埠會跟著移動，以維持同一個「家族」。
- `cdpUrl` 在未設定時預設為轉送器連接埠。
- `remoteCdpTimeoutMs` 適用於遠端（非 loopback）的 CDP 可達性檢查。
- `remoteCdpHandshakeTimeoutMs` 適用於遠端 CDP WebSocket 可達性檢查。
- `attachOnly: true` 表示「永不啟動本機瀏覽器；僅在其已執行時才附加」。
- `color` + 各設定檔的 `color` 會為瀏覽器 UI 著色，
  讓你能辨識目前啟用的是哪個設定檔。
- 預設設定檔為 `chrome`（擴充功能轉送）。使用 `defaultProfile: "openclaw"` 以啟用受管瀏覽器。
- 自動偵測順序：若系統預設瀏覽器為 Chromium 系列則優先使用；否則依序為 Chrome → Brave → Edge → Chromium → Chrome Canary。
- 本機的 `openclaw` 設定檔會自動指派 `cdpPort`/`cdpUrl` — 僅在遠端 CDP 時才需要設定它們。

## 使用 Brave（或其他 Chromium 系列瀏覽器）

如果你的**系統預設**瀏覽器是 Chromium 系列（Chrome/Brave/Edge 等），
OpenClaw 會自動使用它。設定 `browser.executablePath` 以覆寫
自動偵測：

CLI 範例：

```bash
openclaw config set browser.executablePath "/usr/bin/google-chrome"
```

```json5
// macOS
{
  browser: {
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  }
}

// Windows
{
  browser: {
    executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
  }
}

// Linux
{
  browser: {
    executablePath: "/usr/bin/brave-browser"
  }
}
```

## 本機 vs 遠端控制

- **本機控制（預設）：** Gateway 閘道器 啟動 loopback 控制服務，並可啟動本機瀏覽器。
- **遠端控制（node host）：** 在擁有瀏覽器的機器上執行 node host；Gateway 會將瀏覽器動作代理到該節點。
- **遠端 CDP：** 設定 `browser.profiles.<name>.cdpUrl`（或 `browser.cdpUrl`），
  以附加到遠端的 Chromium 系列瀏覽器。在此情況下，OpenClaw 不會啟動本機瀏覽器。

遠端 CDP URL 可以包含驗證資訊：

- 查詢權杖（例如：`https://provider.example?token=<token>`）
- HTTP Basic 驗證（例如：`https://user:pass@provider.example`）

OpenClaw 在呼叫 `/json/*` 端點以及連線到
CDP WebSocket 時，會保留這些驗證資訊。請優先使用環境變數或祕密管理器
來存放權杖，而不是將它們提交到設定檔中。

## Node 瀏覽器代理（零設定預設）

如果你在擁有瀏覽器的機器上執行**node host**，OpenClaw 可以
自動將瀏覽器工具呼叫路由到該節點，而不需要任何額外的瀏覽器設定。
這是遠端 Gateway 的預設路徑。

注意事項：

- node host 會透過**代理指令**公開其本機瀏覽器控制伺服器。
- 設定檔來自節點自身的 `browser.profiles` 設定（與本機相同）。
- 若你不想使用此功能，可停用：
  - 在節點上：`nodeHost.browserProxy.enabled=false`
  - 在 Gateway 上：`gateway.nodes.browser.mode="off"`

## Browserless（代管的遠端 CDP）

[Browserless](https://browserless.io) 是一個代管的 Chromium 服務，
透過 HTTPS 提供 CDP 端點。你可以將 OpenClaw 的瀏覽器設定檔
指向 Browserless 的區域端點，並使用你的 API 金鑰進行驗證。

範例：

```json5
{
  browser: {
    enabled: true,
    defaultProfile: "browserless",
    remoteCdpTimeoutMs: 2000,
    remoteCdpHandshakeTimeoutMs: 4000,
    profiles: {
      browserless: {
        cdpUrl: "https://production-sfo.browserless.io?token=<BROWSERLESS_API_KEY>",
        color: "#00AA00",
      },
    },
  },
}
```

注意事項：

- 將 `<BROWSERLESS_API_KEY>` 替換為你實際的 Browserless 權杖。
- 選擇與你的 Browserless 帳戶相符的區域端點（請參閱其文件）。

## 安全性

核心概念：

- 瀏覽器控制僅限 loopback；存取流程會經過 Gateway 閘道器 的驗證或節點配對。
- 請將 Gateway 與任何 node host 保持在私有網路中（Tailscale）；避免公開暴露。
- 將遠端 CDP URL／權杖視為祕密；優先使用環境變數或祕密管理器。

遠端 CDP 建議：

- 優先使用 HTTPS 端點與短效權杖。
- 避免將長效權杖直接嵌入設定檔。

## 設定檔（多瀏覽器）

OpenClaw 支援多個具名設定檔（路由設定）。設定檔可以是：

- **openclaw-managed**：一個專用的 Chromium 系列瀏覽器執行個體，擁有自己的使用者資料目錄 + CDP 連接埠
- **remote**：明確指定的 CDP URL（在其他地方執行的 Chromium 系列瀏覽器）
- **extension relay**：透過本機轉送器 + Chrome 擴充功能，使用你現有的 Chrome 分頁

預設值：

- 若不存在，會自動建立 `openclaw` 設定檔。
- `chrome` 設定檔為內建的 Chrome 擴充功能轉送（預設指向 `http://127.0.0.1:18792`）。
- 本機 CDP 連接埠預設配置於 **18800–18899**。
- 刪除設定檔時，其本機資料目錄會移至垃圾桶。

所有控制端點都接受 `?profile=<name>`；CLI 使用 `--browser-profile`。

## Chrome 擴充功能轉送（使用你現有的 Chrome）

OpenClaw 也可以透過本機 CDP 轉送器 + Chrome 擴充功能，
驅動**你現有的 Chrome 分頁**（不會啟動獨立的「openclaw」Chrome 執行個體）。

完整指南：[Chrome extension](/tools/chrome-extension)

流程：

- Gateway 在本機執行（同一台機器），或在瀏覽器所在機器上執行 node host。
- 本機的**轉送伺服器**會在一個 loopback 的 `cdpUrl` 監聽（預設：`http://127.0.0.1:18792`）。
- 你在要控制的分頁上點擊 **OpenClaw Browser Relay** 擴充功能圖示以附加（不會自動附加）。
- 代理程式透過一般的 `browser` 工具，
  選擇正確的設定檔來控制該分頁。

如果 Gateway 在其他地方執行，請在瀏覽器所在機器上執行 node host，
以便 Gateway 能代理瀏覽器動作。

### 沙箱隔離的工作階段

如果代理程式工作階段是沙箱隔離的，`browser` 工具可能會預設使用 `target="sandbox"`（沙箱瀏覽器）。
Chrome 擴充功能轉送接管需要主機瀏覽器控制，因此你可以：

- 以非沙箱模式執行工作階段，或
- 設定 `agents.defaults.sandbox.browser.allowHostControl: true`，並在呼叫工具時使用 `target="host"`。

### 設定

1. 載入擴充功能（開發／未封裝）：

```bash
openclaw browser extension install
```

- Chrome → `chrome://extensions` → 啟用「Developer mode」
- 「Load unpacked」→ 選取由 `openclaw browser extension path` 輸出的目錄
- 將擴充功能釘選，然後在你要控制的分頁上點擊它（徽章顯示 `ON`）。

2. 使用方式：

- CLI：`openclaw browser --browser-profile chrome tabs`
- 代理程式工具：`browser` 搭配 `profile="chrome"`

選用：如果你想要不同的名稱或轉送連接埠，請建立你自己的設定檔：

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

注意事項：

- 此模式多數操作（螢幕截圖／快照／動作）依賴 Playwright-on-CDP。
- 再次點擊擴充功能圖示即可中斷附加。

## 隔離保證

- **專用使用者資料目錄**：永不接觸你的個人瀏覽器設定檔。
- **專用連接埠**：避免使用 `9222`，以防與開發工作流程衝突。
- **可預期的分頁控制**：以 `targetId` 為目標，而非「最後一個分頁」。

## 瀏覽器選擇

在本機啟動時，OpenClaw 會選擇第一個可用的：

1. Chrome
2. Brave
3. Edge
4. Chromium
5. Chrome Canary

你可以使用 `browser.executablePath` 進行覆寫。

平台：

- macOS：檢查 `/Applications` 與 `~/Applications`。
- Linux：尋找 `google-chrome`、`brave`、`microsoft-edge`、`chromium` 等。
- Windows：檢查常見的安裝位置。

## 控制 API（選用）

僅供本機整合使用，Gateway 閘道器 會公開一個小型的 loopback HTTP API：

- 狀態／啟動／停止：`GET /`、`POST /start`、`POST /stop`
- 分頁：`GET /tabs`、`POST /tabs/open`、`POST /tabs/focus`、`DELETE /tabs/:targetId`
- 快照／螢幕截圖：`GET /snapshot`、`POST /screenshot`
- 動作：`POST /navigate`、`POST /act`
- Hooks：`POST /hooks/file-chooser`、`POST /hooks/dialog`
- 下載：`POST /download`、`POST /wait/download`
- 偵錯：`GET /console`、`POST /pdf`
- 偵錯：`GET /errors`、`GET /requests`、`POST /trace/start`、`POST /trace/stop`、`POST /highlight`
- 網路：`POST /response/body`
- 狀態：`GET /cookies`、`POST /cookies/set`、`POST /cookies/clear`
- 狀態：`GET /storage/:kind`、`POST /storage/:kind/set`、`POST /storage/:kind/clear`
- 設定：`POST /set/offline`、`POST /set/headers`、`POST /set/credentials`、`POST /set/geolocation`、`POST /set/media`、`POST /set/timezone`、`POST /set/locale`、`POST /set/device`

所有端點都接受 `?profile=<name>`。

### Playwright 需求

部分功能（導覽／動作／AI 快照／角色快照、元素螢幕截圖、PDF）需要
Playwright。若未安裝 Playwright，這些端點會回傳清楚的 501
錯誤。ARIA 快照與基本螢幕截圖在 openclaw-managed Chrome 中仍可使用。
對於 Chrome 擴充功能轉送驅動程式，ARIA 快照與螢幕截圖需要 Playwright。

如果你看到 `Playwright is not available in this gateway build`，請安裝完整的
Playwright 套件（不是 `playwright-core`）並重新啟動 gateway，
或重新安裝支援瀏覽器的 OpenClaw。

#### Docker Playwright 安裝

如果你的 Gateway 在 Docker 中執行，請避免 `npx playwright`（npm 覆寫衝突）。
請改用隨附的 CLI：

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

若要保留瀏覽器下載內容，請設定 `PLAYWRIGHT_BROWSERS_PATH`（例如
`/home/node/.cache/ms-playwright`），並確保 `/home/node` 透過
`OPENCLAW_HOME_VOLUME` 或 bind mount 進行持久化。請參閱 [Docker](/install/docker)。

## 運作方式（內部）

高階流程：

- 一個小型的**控制伺服器**接受 HTTP 請求。
- 它透過 **CDP** 連線到 Chromium 系列瀏覽器（Chrome/Brave/Edge/Chromium）。
- 對於進階動作（點擊／輸入／快照／PDF），在 CDP 之上使用 **Playwright**。
- 當缺少 Playwright 時，僅提供非 Playwright 的操作。

此設計讓代理程式維持在穩定、可預期的介面，同時允許你切換本機／遠端瀏覽器與設定檔。

## CLI 快速參考

所有指令都接受 `--browser-profile <name>` 以指定特定設定檔。
所有指令也接受 `--json` 以取得機器可讀的輸出（穩定的 payload）。

基礎：

- `openclaw browser status`
- `openclaw browser start`
- `openclaw browser stop`
- `openclaw browser tabs`
- `openclaw browser tab`
- `openclaw browser tab new`
- `openclaw browser tab select 2`
- `openclaw browser tab close 2`
- `openclaw browser open https://example.com`
- `openclaw browser focus abcd1234`
- `openclaw browser close abcd1234`

檢視：

- `openclaw browser screenshot`
- `openclaw browser screenshot --full-page`
- `openclaw browser screenshot --ref 12`
- `openclaw browser screenshot --ref e12`
- `openclaw browser snapshot`
- `openclaw browser snapshot --format aria --limit 200`
- `openclaw browser snapshot --interactive --compact --depth 6`
- `openclaw browser snapshot --efficient`
- `openclaw browser snapshot --labels`
- `openclaw browser snapshot --selector "#main" --interactive`
- `openclaw browser snapshot --frame "iframe#main" --interactive`
- `openclaw browser console --level error`
- `openclaw browser errors --clear`
- `openclaw browser requests --filter api --clear`
- `openclaw browser pdf`
- `openclaw browser responsebody "**/api" --max-chars 5000`

動作：

- `openclaw browser navigate https://example.com`
- `openclaw browser resize 1280 720`
- `openclaw browser click 12 --double`
- `openclaw browser click e12 --double`
- `openclaw browser type 23 "hello" --submit`
- `openclaw browser press Enter`
- `openclaw browser hover 44`
- `openclaw browser scrollintoview e12`
- `openclaw browser drag 10 11`
- `openclaw browser select 9 OptionA OptionB`
- `openclaw browser download e12 /tmp/report.pdf`
- `openclaw browser waitfordownload /tmp/report.pdf`
- `openclaw browser upload /tmp/file.pdf`
- `openclaw browser fill --fields '[{"ref":"1","type":"text","value":"Ada"}]'`
- `openclaw browser dialog --accept`
- `openclaw browser wait --text "Done"`
- `openclaw browser wait "#main" --url "**/dash" --load networkidle --fn "window.ready===true"`
- `openclaw browser evaluate --fn '(el) => el.textContent' --ref 7`
- `openclaw browser highlight e12`
- `openclaw browser trace start`
- `openclaw browser trace stop`

狀態：

- `openclaw browser cookies`
- `openclaw browser cookies set session abc123 --url "https://example.com"`
- `openclaw browser cookies clear`
- `openclaw browser storage local get`
- `openclaw browser storage local set theme dark`
- `openclaw browser storage session clear`
- `openclaw browser set offline on`
- `openclaw browser set headers --json '{"X-Debug":"1"}'`
- `openclaw browser set credentials user pass`
- `openclaw browser set credentials --clear`
- `openclaw browser set geo 37.7749 -122.4194 --origin "https://example.com"`
- `openclaw browser set geo --clear`
- `openclaw browser set media dark`
- `openclaw browser set timezone America/New_York`
- `openclaw browser set locale en-US`
- `openclaw browser set device "iPhone 14"`

注意事項：

- `upload` 與 `dialog` 是**預備（arming）**呼叫；請在觸發選擇器／對話框的點擊／按鍵之前先執行它們。
- `upload` 也可以透過 `--input-ref` 或 `--element` 直接設定檔案輸入。
- `snapshot`：
  - `--format ai`（安裝 Playwright 時的預設）：回傳帶有數值參照（`aria-ref="<n>"`）的 AI 快照。
  - `--format aria`：回傳無參照的無障礙樹（僅供檢視）。
  - `--efficient`（或 `--mode efficient`）：精簡的角色快照預設（互動式 + 精簡 + 深度 + 較低的 maxChars）。
  - 設定預設（僅限工具／CLI）：設定 `browser.snapshotDefaults.mode: "efficient"`，在呼叫端未指定模式時使用高效率快照（見 [Gateway 設定](/gateway/configuration#browser-openclaw-managed-browser)）。
  - 角色快照選項（`--interactive`、`--compact`、`--depth`、`--selector`）會強制使用角色型快照，並產生如 `ref=e12` 的參照。
  - `--frame "<iframe selector>"` 會將角色快照限定在某個 iframe（與如 `e12` 的角色參照搭配）。
  - `--interactive` 會輸出扁平、易於選取的互動元素清單（最適合驅動動作）。
  - `--labels` 會新增僅視窗範圍的螢幕截圖，並覆蓋參照標籤（輸出 `MEDIA:<path>`）。
- `click`/`type`/等 需要一個來自 `snapshot` 的 `ref`
  （數值 `12` 或角色參照 `e12`）。
  動作刻意不支援 CSS selector。

## 快照與參照

OpenClaw 支援兩種「快照」樣式：

- **AI 快照（數值參照）**：`openclaw browser snapshot`（預設；`--format ai`）
  - 輸出：包含數值參照的文字快照。
  - 動作：`openclaw browser click 12`、`openclaw browser type 23 "hello"`。
  - 內部透過 Playwright 的 `aria-ref` 解析參照。

- **角色快照（如 `e12` 的角色參照）**：`openclaw browser snapshot --interactive`（或 `--compact`、`--depth`、`--selector`、`--frame`）
  - 輸出：基於角色的清單／樹，包含 `[ref=e12]`（以及選用的 `[nth=1]`）。
  - 動作：`openclaw browser click e12`、`openclaw browser highlight e12`。
  - 內部透過 `getByRole(...)` 解析參照（重複項目使用 `nth()`）。
  - 新增 `--labels` 可包含帶有覆蓋 `e12` 標籤的視窗螢幕截圖。

參照行為：

- 參照**不會在導覽之間保持穩定**；若失敗，請重新執行 `snapshot` 並使用新的參照。
- 如果角色快照是以 `--frame` 取得，角色參照會限定在該 iframe，直到下一次角色快照。

## 等待增強功能

你可以等待的不僅僅是時間／文字：

- 等待 URL（Playwright 支援 glob）：
  - `openclaw browser wait --url "**/dash"`
- 等待載入狀態：
  - `openclaw browser wait --load networkidle`
- 等待 JS 條件：
  - `openclaw browser wait --fn "window.ready===true"`
- 等待 selector 變為可見：
  - `openclaw browser wait "#main"`

這些可以組合使用：

```bash
openclaw browser wait "#main" \
  --url "**/dash" \
  --load networkidle \
  --fn "window.ready===true" \
  --timeout-ms 15000
```

## 偵錯工作流程

當動作失敗時（例如「不可見」、「嚴格模式違規」、「被遮擋」）：

1. `openclaw browser snapshot --interactive`
2. 使用 `click <ref>`／`type <ref>`（在互動模式下優先使用角色參照）
3. 若仍失敗：`openclaw browser highlight <ref>` 以查看 Playwright 的實際目標
4. 若頁面行為異常：
   - `openclaw browser errors --clear`
   - `openclaw browser requests --filter api --clear`
5. 深度偵錯：記錄追蹤：
   - `openclaw browser trace start`
   - 重現問題
   - `openclaw browser trace stop`（輸出 `TRACE:<path>`）

## JSON 輸出

`--json` 適用於腳本與結構化工具。

範例：

```bash
openclaw browser status --json
openclaw browser snapshot --interactive --json
openclaw browser requests --filter api --json
openclaw browser cookies --json
```

JSON 形式的角色快照包含 `refs`，以及一個小型的 `stats` 區塊（行數／字元／參照／互動性），
讓工具能推斷 payload 的大小與密度。

## 狀態與環境調整參數

這些對於「讓網站表現得像 X」的工作流程很有用：

- Cookies：`cookies`、`cookies set`、`cookies clear`
- 儲存空間：`storage local|session get|set|clear`
- 離線：`set offline on|off`
- 標頭：`set headers --json '{"X-Debug":"1"}'`（或 `--clear`）
- HTTP Basic 驗證：`set credentials user pass`（或 `--clear`）
- 地理位置：`set geo <lat> <lon> --origin "https://example.com"`（或 `--clear`）
- 媒體：`set media dark|light|no-preference|none`
- 時區／語系：`set timezone ...`、`set locale ...`
- 裝置／視窗大小：
  - `set device "iPhone 14"`（Playwright 裝置預設）
  - `set viewport 1280 720`

## 安全性與隱私

- openclaw 瀏覽器設定檔可能包含已登入的工作階段；請視為敏感資料。
- `browser act kind=evaluate`／`openclaw browser evaluate` 與 `wait --fn`
  會在頁面內容中執行任意 JavaScript。提示注入可能影響其行為。
  若不需要，請使用 `browser.evaluateEnabled=false` 停用。
- 登入與反機器人注意事項（X/Twitter 等），請參閱 [Browser login + X/Twitter posting](/tools/browser-login)。
- 請將 Gateway／node host 保持私有（僅 loopback 或 tailnet）。
- 遠端 CDP 端點功能強大；請妥善通道化並加以保護。

## 疑難排解

Linux 特有問題（尤其是 snap Chromium），請參閱
[Browser troubleshooting](/tools/browser-linux-troubleshooting)。

## 代理程式工具 + 控制方式

代理程式只有**一個工具**用於瀏覽器自動化：

- `browser` — 狀態／啟動／停止／分頁／開啟／聚焦／關閉／快照／螢幕截圖／導覽／動作

對應關係：

- `browser snapshot` 回傳穩定的 UI 樹（AI 或 ARIA）。
- `browser act` 使用快照中的 `ref` ID 來點擊／輸入／拖曳／選取。
- `browser screenshot` 擷取像素（整頁或元素）。
- `browser` 接受：
  - `profile` 以選擇具名的瀏覽器設定檔（openclaw、chrome 或遠端 CDP）。
  - `target`（`sandbox` | `host` | `node`）以選擇瀏覽器所在位置。
  - 在沙箱隔離的工作階段中，`target: "host"` 需要 `agents.defaults.sandbox.browser.allowHostControl=true`。
  - 若省略 `target`：沙箱工作階段預設為 `sandbox`，非沙箱工作階段預設為 `host`。
  - 若已連線具備瀏覽器能力的節點，工具可能會自動路由到該節點，除非你固定指定 `target="host"` 或 `target="node"`。

這讓代理程式保持可預期性，並避免脆弱的 selector。
