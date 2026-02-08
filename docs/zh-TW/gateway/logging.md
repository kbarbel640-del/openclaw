---
summary: "記錄介面、檔案日誌、WS 日誌樣式與主控台格式"
read_when:
  - 變更記錄輸出或格式
  - 偵錯 CLI 或 Gateway 閘道器 輸出
title: "記錄"
x-i18n:
  source_path: gateway/logging.md
  source_hash: efb8eda5e77e3809
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:30Z
---

# 記錄

如需面向使用者的總覽（CLI + Control UI + 設定），請參閱 [/logging](/logging)。

OpenClaw 有兩種記錄「介面」：

- **主控台輸出**（你在終端機／Debug UI 看到的內容）。
- **檔案日誌**（JSON lines），由 Gateway 閘道器 記錄器寫入。

## 以檔案為基礎的記錄器

- 預設的輪替日誌檔位於 `/tmp/openclaw/`（每天一個檔案）：`openclaw-YYYY-MM-DD.log`
  - 日期使用 Gateway 閘道器 主機的本地時區。
- 日誌檔路徑與層級可透過 `~/.openclaw/openclaw.json` 設定：
  - `logging.file`
  - `logging.level`

檔案格式為每行一個 JSON 物件。

Control UI 的 Logs 分頁會透過 Gateway 閘道器 尾隨（tail）此檔案（`logs.tail`）。
CLI 也能做同樣的事：

```bash
openclaw logs --follow
```

**Verbose 與記錄層級**

- **檔案日誌**僅由 `logging.level` 控制。
- `--verbose` 只影響 **主控台冗長度**（以及 WS 日誌樣式）；**不會**
  提高檔案日誌層級。
- 若要在檔案日誌中擷取僅存在於 verbose 的細節，請將 `logging.level` 設為 `debug` 或
  `trace`。

## 主控台擷取

CLI 會擷取 `console.log/info/warn/error/debug/trace` 並寫入檔案日誌，
同時仍會輸出到 stdout／stderr。

你可以獨立調整主控台冗長度：

- `logging.consoleLevel`（預設 `info`）
- `logging.consoleStyle`（`pretty` | `compact` | `json`）

## 工具摘要遮罩

冗長的工具摘要（例如 `🛠️ Exec: ...`）在進入
主控台串流前可先遮罩敏感權杖。這 **僅限工具**，不會改變檔案日誌。

- `logging.redactSensitive`：`off` | `tools`（預設：`tools`）
- `logging.redactPatterns`：正規表示式字串陣列（會覆寫預設）
  - 使用原始 regex 字串（自動 `gi`），或在需要自訂旗標時使用 `/pattern/flags`。
  - 符合項目會以保留前 6 + 後 4 個字元進行遮罩（長度 >= 18），否則為 `***`。
  - 預設涵蓋常見的金鑰指定、CLI 旗標、JSON 欄位、Bearer 標頭、PEM 區塊，以及常見的權杖前綴。

## Gateway 閘道器 WebSocket 日誌

Gateway 閘道器 以兩種模式列印 WebSocket 協定日誌：

- **一般模式（未設定 `--verbose`）**：只列印「有意義」的 RPC 結果：
  - 錯誤（`ok=false`）
  - 緩慢呼叫（預設門檻：`>= 50ms`）
  - 剖析錯誤
- **Verbose 模式（`--verbose`）**：列印所有 WS 請求／回應流量。

### WS 日誌樣式

`openclaw gateway` 支援每個 Gateway 閘道器 的樣式切換：

- `--ws-log auto`（預設）：一般模式最佳化；verbose 模式使用精簡輸出
- `--ws-log compact`：在 verbose 時使用精簡輸出（成對的請求／回應）
- `--ws-log full`：在 verbose 時使用每個 frame 的完整輸出
- `--compact`：`--ws-log compact` 的別名

範例：

```bash
# optimized (only errors/slow)
openclaw gateway

# show all WS traffic (paired)
openclaw gateway --verbose --ws-log compact

# show all WS traffic (full meta)
openclaw gateway --verbose --ws-log full
```

## 主控台格式（子系統記錄）

主控台格式化器 **具備 TTY 感知能力**，並列印一致、帶前綴的行。
子系統記錄器讓輸出保持分組且易於掃描。

行為：

- 每行都有 **子系統前綴**（例如 `[gateway]`、`[canvas]`、`[tailscale]`）
- **子系統顏色**（每個子系統固定）加上層級顏色
- **當輸出為 TTY 或環境看起來像豐富終端機時啟用顏色**（`TERM`/`COLORTERM`/`TERM_PROGRAM`），並遵循 `NO_COLOR`
- **縮短的子系統前綴**：移除開頭的 `gateway/` + `channels/`，保留最後 2 個區段（例如 `whatsapp/outbound`）
- **依子系統的子記錄器**（自動前綴 + 結構化欄位 `{ subsystem }`）
- **`logRaw()`** 用於 QR／UX 輸出（無前綴、無格式）
- **主控台樣式**（例如 `pretty | compact | json`）
- **主控台記錄層級** 與檔案記錄層級分離（當 `logging.level` 設為 `debug`/`trace` 時，檔案仍保留完整細節）
- **WhatsApp 訊息本文** 以 `debug` 記錄（使用 `--verbose` 可查看）

這能在維持既有檔案日誌穩定的同時，讓互動式輸出更易於掃描。
