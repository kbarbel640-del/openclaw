---
summary: "記錄概覽：檔案日誌、主控台輸出、CLI 尾隨，以及 Control UI"
read_when:
  - 你需要適合初學者的日誌概覽
  - 你想要設定日誌層級或格式
  - 你正在進行疑難排解，需要快速找到日誌
title: "日誌"
x-i18n:
  source_path: logging.md
  source_hash: 884fcf4a906adff3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:09Z
---

# 日誌

OpenClaw 會在兩個地方記錄日誌：

- **檔案日誌**（JSON 行），由 Gateway 閘道器 寫入。
- **主控台輸出**，顯示於終端機與 Control UI。

本頁說明日誌的位置、如何閱讀，以及如何設定日誌層級與格式。

## 日誌位置

預設情況下，Gateway 閘道器 會在以下位置寫入循環式日誌檔：

`/tmp/openclaw/openclaw-YYYY-MM-DD.log`

日期使用 Gateway 閘道器 主機的本地時區。

你可以在 `~/.openclaw/openclaw.json` 中覆寫此設定：

```json
{
  "logging": {
    "file": "/path/to/openclaw.log"
  }
}
```

## 如何閱讀日誌

### CLI：即時尾隨（建議）

使用 CLI 透過 RPC 尾隨 gateway 日誌檔：

```bash
openclaw logs --follow
```

輸出模式：

- **TTY 工作階段**：美觀、具顏色、結構化的日誌行。
- **非 TTY 工作階段**：純文字。
- `--json`：以行分隔的 JSON（每行一個日誌事件）。
- `--plain`：在 TTY 工作階段中強制使用純文字。
- `--no-color`：停用 ANSI 顏色。

在 JSON 模式下，CLI 會輸出帶有 `type` 標記的物件：

- `meta`：串流中繼資料（檔案、游標、大小）
- `log`：已解析的日誌項目
- `notice`：截斷／輪替提示
- `raw`：未解析的日誌行

如果 Gateway 閘道器 無法連線，CLI 會印出簡短提示，要求執行：

```bash
openclaw doctor
```

### Control UI（網頁）

Control UI 的 **Logs** 分頁會使用 `logs.tail` 尾隨相同的檔案。
如何開啟請參考 [/web/control-ui](/web/control-ui)。

### 僅頻道日誌

若要篩選頻道活動（WhatsApp／Telegram／等），請使用：

```bash
openclaw channels logs --channel whatsapp
```

## 日誌格式

### 檔案日誌（JSONL）

日誌檔中的每一行都是一個 JSON 物件。CLI 與 Control UI 會解析這些
項目以呈現結構化輸出（時間、層級、子系統、訊息）。

### 主控台輸出

主控台日誌具 **TTY 感知**，並以可讀性為目標進行格式化：

- 子系統前綴（例如 `gateway/channels/whatsapp`）
- 層級著色（info／warn／error）
- 可選的精簡或 JSON 模式

主控台格式由 `logging.consoleStyle` 控制。

## 設定日誌

所有日誌設定皆位於 `~/.openclaw/openclaw.json` 中的 `logging` 之下。

```json
{
  "logging": {
    "level": "info",
    "file": "/tmp/openclaw/openclaw-YYYY-MM-DD.log",
    "consoleLevel": "info",
    "consoleStyle": "pretty",
    "redactSensitive": "tools",
    "redactPatterns": ["sk-.*"]
  }
}
```

### 日誌層級

- `logging.level`：**檔案日誌**（JSONL）的層級。
- `logging.consoleLevel`：**主控台**的詳細程度層級。

`--verbose` 僅影響主控台輸出；不會變更檔案日誌層級。

### 主控台樣式

`logging.consoleStyle`：

- `pretty`：以人為友善、具顏色、含時間戳。
- `compact`：更緊湊的輸出（適合長時間工作階段）。
- `json`：每行一個 JSON（供日誌處理器使用）。

### 去識別化

工具摘要可在輸出到主控台前去識別化敏感權杖：

- `logging.redactSensitive`：`off` | `tools`（預設：`tools`）
- `logging.redactPatterns`：用以覆寫預設集合的正規表示式字串清單

去識別化 **僅影響主控台輸出**，不會變更檔案日誌。

## 診斷 + OpenTelemetry

診斷是結構化、機器可讀的事件，用於模型執行 **以及**
訊息流遙測（Webhook、佇列、工作階段狀態）。它們 **不會**
取代日誌；其目的在於提供度量、追蹤與其他匯出器。

診斷事件在行程內產生，但只有在啟用診斷 **以及** 匯出器外掛時，
匯出器才會附加。

### OpenTelemetry 與 OTLP

- **OpenTelemetry（OTel）**：追蹤、度量與日誌的資料模型與 SDK。
- **OTLP**：用於將 OTel 資料匯出到收集器／後端的線路協定。
- OpenClaw 目前透過 **OTLP/HTTP（protobuf）** 匯出。

### 匯出的訊號

- **度量**：計數器 + 直方圖（權杖使用量、訊息流、佇列）。
- **追蹤**：模型使用 + Webhook／訊息處理的 Span。
- **日誌**：在啟用 `diagnostics.otel.logs` 時透過 OTLP 匯出。日誌
  量可能很高；請留意 `logging.level` 與匯出器篩選。

### 診斷事件目錄

模型使用：

- `model.usage`：權杖、成本、期間、內容、提供者／模型／頻道、工作階段 ID。

訊息流：

- `webhook.received`：各頻道的 Webhook 進入。
- `webhook.processed`：Webhook 已處理 + 期間。
- `webhook.error`：Webhook 處理器錯誤。
- `message.queued`：訊息已排入處理佇列。
- `message.processed`：結果 + 期間 + 可選錯誤。

佇列 + 工作階段：

- `queue.lane.enqueue`：命令佇列通道入列 + 深度。
- `queue.lane.dequeue`：命令佇列通道出列 + 等待時間。
- `session.state`：工作階段狀態轉換 + 原因。
- `session.stuck`：工作階段卡住警告 + 經過時間。
- `run.attempt`：執行重試／嘗試的中繼資料。
- `diagnostic.heartbeat`：彙總計數器（Webhook／佇列／工作階段）。

### 啟用診斷（無匯出器）

若你希望診斷事件可供外掛或自訂匯入使用，請使用：

```json
{
  "diagnostics": {
    "enabled": true
  }
}
```

### 診斷旗標（目標式日誌）

使用旗標在不提高 `logging.level` 的情況下，啟用額外且具目標性的除錯日誌。
旗標不分大小寫，並支援萬用字元（例如 `telegram.*` 或 `*`）。

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

環境變數覆寫（一次性）：

```
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

注意事項：

- 旗標日誌會寫入標準日誌檔（與 `logging.file` 相同）。
- 輸出仍會依 `logging.redactSensitive` 進行去識別化。
- 完整指南：[/diagnostics/flags](/diagnostics/flags)。

### 匯出到 OpenTelemetry

診斷可透過 `diagnostics-otel` 外掛（OTLP/HTTP）匯出。此方式
可與任何接受 OTLP/HTTP 的 OpenTelemetry 收集器／後端搭配使用。

```json
{
  "plugins": {
    "allow": ["diagnostics-otel"],
    "entries": {
      "diagnostics-otel": {
        "enabled": true
      }
    }
  },
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "endpoint": "http://otel-collector:4318",
      "protocol": "http/protobuf",
      "serviceName": "openclaw-gateway",
      "traces": true,
      "metrics": true,
      "logs": true,
      "sampleRate": 0.2,
      "flushIntervalMs": 60000
    }
  }
}
```

注意事項：

- 你也可以使用 `openclaw plugins enable diagnostics-otel` 啟用此外掛。
- `protocol` 目前僅支援 `http/protobuf`。`grpc` 會被忽略。
- 度量包含權杖使用量、成本、內容大小、執行期間，以及訊息流
  計數器／直方圖（Webhook、佇列、工作階段狀態、佇列深度／等待）。
- 追蹤／度量可透過 `traces`／`metrics` 切換（預設：開啟）。追蹤
  在啟用時包含模型使用 Span 以及 Webhook／訊息處理 Span。
- 當你的收集器需要驗證時，請設定 `headers`。
- 支援的環境變數：`OTEL_EXPORTER_OTLP_ENDPOINT`、
  `OTEL_SERVICE_NAME`、`OTEL_EXPORTER_OTLP_PROTOCOL`。

### 匯出的度量（名稱 + 類型）

模型使用：

- `openclaw.tokens`（計數器，屬性：`openclaw.token`、`openclaw.channel`、
  `openclaw.provider`、`openclaw.model`）
- `openclaw.cost.usd`（計數器，屬性：`openclaw.channel`、`openclaw.provider`、
  `openclaw.model`）
- `openclaw.run.duration_ms`（直方圖，屬性：`openclaw.channel`、
  `openclaw.provider`、`openclaw.model`）
- `openclaw.context.tokens`（直方圖，屬性：`openclaw.context`、
  `openclaw.channel`、`openclaw.provider`、`openclaw.model`）

訊息流：

- `openclaw.webhook.received`（計數器，屬性：`openclaw.channel`、
  `openclaw.webhook`）
- `openclaw.webhook.error`（計數器，屬性：`openclaw.channel`、
  `openclaw.webhook`）
- `openclaw.webhook.duration_ms`（直方圖，屬性：`openclaw.channel`、
  `openclaw.webhook`）
- `openclaw.message.queued`（計數器，屬性：`openclaw.channel`、
  `openclaw.source`）
- `openclaw.message.processed`（計數器，屬性：`openclaw.channel`、
  `openclaw.outcome`）
- `openclaw.message.duration_ms`（直方圖，屬性：`openclaw.channel`、
  `openclaw.outcome`）

佇列 + 工作階段：

- `openclaw.queue.lane.enqueue`（計數器，屬性：`openclaw.lane`）
- `openclaw.queue.lane.dequeue`（計數器，屬性：`openclaw.lane`）
- `openclaw.queue.depth`（直方圖，屬性：`openclaw.lane` 或
  `openclaw.channel=heartbeat`）
- `openclaw.queue.wait_ms`（直方圖，屬性：`openclaw.lane`）
- `openclaw.session.state`（計數器，屬性：`openclaw.state`、`openclaw.reason`）
- `openclaw.session.stuck`（計數器，屬性：`openclaw.state`）
- `openclaw.session.stuck_age_ms`（直方圖，屬性：`openclaw.state`）
- `openclaw.run.attempt`（計數器，屬性：`openclaw.attempt`）

### 匯出的 Span（名稱 + 關鍵屬性）

- `openclaw.model.usage`
  - `openclaw.channel`、`openclaw.provider`、`openclaw.model`
  - `openclaw.sessionKey`、`openclaw.sessionId`
  - `openclaw.tokens.*`（input/output/cache_read/cache_write/total）
- `openclaw.webhook.processed`
  - `openclaw.channel`、`openclaw.webhook`、`openclaw.chatId`
- `openclaw.webhook.error`
  - `openclaw.channel`、`openclaw.webhook`、`openclaw.chatId`、
    `openclaw.error`
- `openclaw.message.processed`
  - `openclaw.channel`、`openclaw.outcome`、`openclaw.chatId`、
    `openclaw.messageId`、`openclaw.sessionKey`、`openclaw.sessionId`、
    `openclaw.reason`
- `openclaw.session.stuck`
  - `openclaw.state`、`openclaw.ageMs`、`openclaw.queueDepth`、
    `openclaw.sessionKey`、`openclaw.sessionId`

### 取樣 + 刷新

- 追蹤取樣：`diagnostics.otel.sampleRate`（0.0–1.0，僅根 Span）。
- 度量匯出間隔：`diagnostics.otel.flushIntervalMs`（最小 1000ms）。

### 協定注意事項

- OTLP/HTTP 端點可透過 `diagnostics.otel.endpoint` 或
  `OTEL_EXPORTER_OTLP_ENDPOINT` 設定。
- 若端點已包含 `/v1/traces` 或 `/v1/metrics`，將直接使用。
- 若端點已包含 `/v1/logs`，將直接用於日誌。
- `diagnostics.otel.logs` 會為主要記錄器輸出啟用 OTLP 日誌匯出。

### 日誌匯出行為

- OTLP 日誌使用與寫入 `logging.file` 相同的結構化記錄。
- 會遵循 `logging.level`（檔案日誌層級）。主控台去識別化 **不會**
  套用到 OTLP 日誌。
- 高流量安裝建議偏好使用 OTLP 收集器的取樣／篩選。

## 疑難排解提示

- **Gateway 閘道器 無法連線？** 先執行 `openclaw doctor`。
- **日誌為空？** 檢查 Gateway 閘道器 是否正在執行，並寫入
  `logging.file` 中的檔案路徑。
- **需要更多細節？** 將 `logging.level` 設為 `debug` 或 `trace` 後重試。
