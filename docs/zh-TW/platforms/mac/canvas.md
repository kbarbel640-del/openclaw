---
summary: 「透過 WKWebView 與自訂 URL 配置嵌入的、由代理程式控制的 Canvas 面板」
read_when:
  - 實作 macOS Canvas 面板
  - 新增視覺化工作空間的代理程式控制
  - 偵錯 WKWebView Canvas 載入問題
title: 「Canvas」
x-i18n:
  source_path: platforms/mac/canvas.md
  source_hash: e39caa21542e839d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:04Z
---

# Canvas（macOS 應用程式）

macOS 應用程式使用 `WKWebView` 嵌入由代理程式控制的 **Canvas 面板**。它
是一個輕量級的視覺化工作空間，適用於 HTML/CSS/JS、A2UI，以及小型互動式
UI 介面。

## Canvas 的位置

Canvas 狀態會儲存在「Application Support」之下：

- `~/Library/Application Support/OpenClaw/canvas/<session>/...`

Canvas 面板透過 **自訂 URL 配置** 提供這些檔案：

- `openclaw-canvas://<session>/<path>`

範例：

- `openclaw-canvas://main/` → `<canvasRoot>/main/index.html`
- `openclaw-canvas://main/assets/app.css` → `<canvasRoot>/main/assets/app.css`
- `openclaw-canvas://main/widgets/todo/` → `<canvasRoot>/main/widgets/todo/index.html`

如果在根目錄不存在 `index.html`，應用程式會顯示 **內建的鷹架頁面**。

## 面板行為

- 無邊框、可調整大小的面板，固定在選單列附近（或滑鼠游標旁）。
- 每個工作階段會記住大小與位置。
- 當本機 Canvas 檔案變更時自動重新載入。
- 同一時間只會顯示一個 Canvas 面板（視需要切換工作階段）。

可在「設定」→ **Allow Canvas** 中停用 Canvas。停用後，Canvas
節點指令會回傳 `CANVAS_DISABLED`。

## 代理程式 API 介面

Canvas 透過 **Gateway WebSocket** 對外提供，因此代理程式可以：

- 顯示／隱藏面板
- 導覽至路徑或 URL
- 執行 JavaScript
- 擷取快照影像

CLI 範例：

```bash
openclaw nodes canvas present --node <id>
openclaw nodes canvas navigate --node <id> --url "/"
openclaw nodes canvas eval --node <id> --js "document.title"
openclaw nodes canvas snapshot --node <id>
```

注意事項：

- `canvas.navigate` 接受 **本機 Canvas 路徑**、`http(s)` URL，以及 `file://` URL。
- 若傳入 `"/"`，Canvas 會顯示本機鷹架或 `index.html`。

## Canvas 中的 A2UI

A2UI 由 Gateway Canvas 主機託管，並在 Canvas 面板內渲染。
當 Gateway 宣告提供 Canvas 主機時，macOS 應用程式在首次開啟時會自動導覽至
A2UI 主機頁面。

預設 A2UI 主機 URL：

```
http://<gateway-host>:18793/__openclaw__/a2ui/
```

### A2UI 指令（v0.8）

Canvas 目前接受 **A2UI v0.8** 的 server→client 訊息：

- `beginRendering`
- `surfaceUpdate`
- `dataModelUpdate`
- `deleteSurface`

`createSurface`（v0.9）尚未支援。

CLI 範例：

```bash
cat > /tmp/a2ui-v0.8.jsonl <<'EOFA2'
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title","content"]}}}},{"id":"title","component":{"Text":{"text":{"literalString":"Canvas (A2UI v0.8)"},"usageHint":"h1"}}},{"id":"content","component":{"Text":{"text":{"literalString":"If you can read this, A2UI push works."},"usageHint":"body"}}}]}}
{"beginRendering":{"surfaceId":"main","root":"root"}}
EOFA2

openclaw nodes canvas a2ui push --jsonl /tmp/a2ui-v0.8.jsonl --node <id>
```

快速冒煙測試：

```bash
openclaw nodes canvas a2ui push --node <id> --text "Hello from A2UI"
```

## 從 Canvas 觸發代理程式執行

Canvas 可透過深層連結觸發新的代理程式執行：

- `openclaw://agent?...`

範例（於 JS 中）：

```js
window.location.href = "openclaw://agent?message=Review%20this%20design";
```

除非提供有效金鑰，否則應用程式會要求確認。

## 安全性注意事項

- Canvas 配置會阻擋目錄穿越；檔案必須位於工作階段根目錄之下。
- 本機 Canvas 內容使用自訂配置（不需要 local loopback 伺服器）。
- 外部 `http(s)` URL 僅在明確導覽時才允許。
