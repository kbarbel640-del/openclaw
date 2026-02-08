---
summary: 「Chrome 擴充功能：讓 OpenClaw 操控你現有的 Chrome 分頁」
read_when:
  - 你希望代理程式操控現有的 Chrome 分頁（工具列按鈕）
  - 你需要遠端 Gateway + 透過 Tailscale 的本機瀏覽器自動化
  - 你想了解瀏覽器接管的安全性影響
title: 「Chrome 擴充功能」
x-i18n:
  source_path: tools/chrome-extension.md
  source_hash: 3b77bdad7d3dab6a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:03Z
---

# Chrome 擴充功能（瀏覽器轉接）

OpenClaw Chrome 擴充功能可讓代理程式控制你的 **現有 Chrome 分頁**（一般的 Chrome 視窗），而不是啟動一個由 openclaw 管理的獨立 Chrome 設定檔。

透過 **單一的 Chrome 工具列按鈕** 即可進行附加 / 分離。

## 這是什麼（概念）

共有三個部分：

- **瀏覽器控制服務**（Gateway 或節點）：代理程式 / 工具 透過 Gateway 呼叫的 API
- **本機轉接伺服器**（loopback CDP）：在控制伺服器與擴充功能之間進行橋接（預設為 `http://127.0.0.1:18792`）
- **Chrome MV3 擴充功能**：使用 `chrome.debugger` 附加到目前的分頁，並將 CDP 訊息管道化到轉接伺服器

之後，OpenClaw 會透過一般的 `browser` 工具介面（選擇正確的設定檔）來控制已附加的分頁。

## 安裝 / 載入（未封裝）

1. 將擴充功能安裝到穩定的本機路徑：

```bash
openclaw browser extension install
```

2. 輸出已安裝的擴充功能目錄路徑：

```bash
openclaw browser extension path
```

3. Chrome → `chrome://extensions`

- 啟用「開發人員模式」
- 「載入未封裝項目」→ 選取上方輸出的目錄

4. 將擴充功能釘選。

## 更新（無建置步驟）

此擴充功能以靜態檔案形式隨 OpenClaw 發佈（npm 套件）提供，沒有獨立的「建置」步驟。

升級 OpenClaw 後：

- 重新執行 `openclaw browser extension install`，以重新整理 OpenClaw 狀態目錄下已安裝的檔案。
- Chrome → `chrome://extensions` → 在擴充功能上點擊「重新載入」。

## 使用方式（無需額外設定）

OpenClaw 內建一個名為 `chrome` 的瀏覽器設定檔，指向預設連接埠上的擴充功能轉接。

使用方式：

- CLI：`openclaw browser --browser-profile chrome tabs`
- 代理程式工具：`browser` 搭配 `profile="chrome"`

如果你想使用不同的名稱或不同的轉接連接埠，請建立自己的設定檔：

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

## 附加 / 分離（工具列按鈕）

- 開啟你希望 OpenClaw 控制的分頁。
- 點擊擴充功能圖示。
  - 附加時，徽章會顯示 `ON`。
- 再次點擊即可分離。

## 它會控制哪個分頁？

- 它 **不會** 自動控制「你正在查看的任何分頁」。
- 只會控制 **你明確透過工具列按鈕附加的分頁**。
- 若要切換：開啟另一個分頁，並在該分頁點擊擴充功能圖示。

## 徽章 + 常見錯誤

- `ON`：已附加；OpenClaw 可以操控該分頁。
- `…`：正在連線至本機轉接。
- `!`：無法連線至轉接（最常見原因：此機器上未執行瀏覽器轉接伺服器）。

如果你看到 `!`：

- 確認 Gateway 在本機執行（預設設定），或在此機器上執行節點主機（若 Gateway 在其他地方執行）。
- 開啟擴充功能的選項頁面；其中會顯示轉接是否可連線。

## 遠端 Gateway（使用節點主機）

### 本機 Gateway（與 Chrome 在同一台機器）— 通常 **不需額外步驟**

如果 Gateway 與 Chrome 在同一台機器上執行，它會在 loopback 上啟動瀏覽器控制服務，並自動啟動轉接伺服器。擴充功能與本機轉接通訊；CLI / 工具 呼叫則送往 Gateway。

### 遠端 Gateway（Gateway 在其他地方執行）— **執行節點主機**

如果你的 Gateway 在另一台機器上執行，請在執行 Chrome 的那台機器上啟動節點主機。
Gateway 會將瀏覽器操作代理到該節點；擴充功能 + 轉接仍保留在瀏覽器所在的機器。

如果連接了多個節點，請使用 `gateway.nodes.browser.node` 固定其中一個，或設定 `gateway.nodes.browser.mode`。

## 沙箱隔離（工具容器）

如果你的代理程式工作階段是沙箱隔離的（`agents.defaults.sandbox.mode != "off"`），`browser` 工具可能會受到限制：

- 預設情況下，沙箱隔離的工作階段通常會指向 **沙箱瀏覽器**（`target="sandbox"`），而不是你的主機 Chrome。
- Chrome 擴充功能轉接接管需要控制 **主機** 的瀏覽器控制伺服器。

選項：

- 最簡單：在 **非沙箱隔離** 的工作階段 / 代理程式中使用擴充功能。
- 或允許沙箱隔離工作階段控制主機瀏覽器：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

接著確保該工具未被工具政策拒絕，並且（如有需要）使用 `target="host"` 呼叫 `browser`。

除錯：`openclaw sandbox explain`

## 遠端存取提示

- 將 Gateway 與節點主機維持在同一個 tailnet；避免將轉接連接埠暴露到 LAN 或公用網際網路。
- 有意識地配對節點；若不希望遠端控制，請停用瀏覽器代理路由（`gateway.nodes.browser.mode="off"`）。

## 「擴充功能路徑」的運作方式

`openclaw browser extension path` 會輸出包含擴充功能檔案的 **已安裝** 磁碟目錄。

CLI 刻意 **不會** 輸出 `node_modules` 路徑。請務必先執行 `openclaw browser extension install`，將擴充功能複製到 OpenClaw 狀態目錄下的穩定位置。

如果你移動或刪除該安裝目錄，Chrome 會將擴充功能標記為損壞，直到你從有效路徑重新載入為止。

## 安全性影響（請閱讀）

這項功能非常強大，也具有風險。請將其視為「讓模型直接操作你的瀏覽器」。

- 此擴充功能使用 Chrome 的 debugger API（`chrome.debugger`）。附加後，模型可以：
  - 在該分頁中點擊 / 輸入 / 導航
  - 讀取頁面內容
  - 存取該分頁登入工作階段所能存取的任何資源
- **這並非隔離環境**，不像專用的 openclaw 管理設定檔。
  - 如果你附加到日常使用的設定檔 / 分頁，就等於授權存取該帳戶狀態。

建議事項：

- 優先使用專用的 Chrome 設定檔（與個人瀏覽分開）來進行擴充功能轉接。
- 將 Gateway 與任何節點主機限制在 tailnet 內；依賴 Gateway 驗證 + 節點配對。
- 避免透過 LAN 暴露轉接連接埠（`0.0.0.0`），並避免使用 Funnel（公開）。
- 轉接會封鎖非擴充功能來源，並要求 CDP 用戶端提供內部驗證權杖。

相關內容：

- 瀏覽器工具總覽：[Browser](/tools/browser)
- 安全性稽核：[Security](/gateway/security)
- Tailscale 設定：[Tailscale](/gateway/tailscale)
