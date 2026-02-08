---
summary: 「除錯工具：監看模式、原始模型串流，以及推理外洩的追蹤」
read_when:
  - 「你需要檢視原始模型輸出以確認是否有推理外洩」
  - 「你想在反覆迭代時以監看模式執行 Gateway 閘道器」
  - 「你需要可重現的除錯工作流程」
title: 「除錯」
x-i18n:
  source_path: help/debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:07Z
---

# 除錯

本頁涵蓋用於串流輸出的除錯輔助工具，特別是在提供者將推理混入一般文字時。

## 執行階段除錯覆寫

在聊天中使用 `/debug` 來設定 **僅限執行階段** 的設定覆寫（記憶體中，不寫入磁碟）。
`/debug` 預設為停用；請使用 `commands.debug: true` 啟用。
當你需要切換較少見的設定而不想編輯 `openclaw.json` 時，這非常實用。

範例：

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` 會清除所有覆寫並回復為磁碟上的設定。

## Gateway 閘道器監看模式

為了快速迭代，請在檔案監看器下執行 Gateway 閘道器：

```bash
pnpm gateway:watch --force
```

這等同於：

```bash
tsx watch src/entry.ts gateway --force
```

在 `gateway:watch` 之後加入任何 gateway CLI 旗標，它們會在每次重新啟動時被傳遞。

## 開發設定檔 + 開發 gateway（--dev）

使用開發設定檔可隔離狀態，並啟動安全、可拋棄的除錯環境。這裡有 **兩個** `--dev` 旗標：

- **全域 `--dev`（設定檔）：** 將狀態隔離在 `~/.openclaw-dev` 之下，並將 gateway 連接埠預設為 `19001`（衍生連接埠會隨之位移）。
- **`gateway --dev`：告知 Gateway 在缺少時自動建立預設設定 +
  工作區**（並略過 BOOTSTRAP.md）。

建議流程（開發設定檔 + 開發啟動）：

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

如果你尚未進行全域安裝，請透過 `pnpm openclaw ...` 執行 CLI。

其作用如下：

1. **設定檔隔離**（全域 `--dev`）
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001`（瀏覽器／畫布也會相應位移）

2. **開發啟動**（`gateway --dev`）
   - 若缺少則寫入最小設定（`gateway.mode=local`，綁定 loopback）。
   - 將 `agent.workspace` 設為開發工作區。
   - 設定 `agent.skipBootstrap=true`（不使用 BOOTSTRAP.md）。
   - 若缺少則建立工作區檔案：
     `AGENTS.md`、`SOUL.md`、`TOOLS.md`、`IDENTITY.md`、`USER.md`、`HEARTBEAT.md`。
   - 預設身分：**C3‑PO**（protocol droid）。
   - 在開發模式中略過頻道提供者（`OPENCLAW_SKIP_CHANNELS=1`）。

重置流程（全新開始）：

```bash
pnpm gateway:dev:reset
```

注意：`--dev` 是 **全域** 設定檔旗標，且會被某些執行器吃掉。
如果需要明確指定，請使用環境變數形式：

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` 會清除設定、憑證、工作階段，以及開發工作區（使用
`trash`，而非 `rm`），接著重新建立預設的開發設定。

提示：如果已經有非開發的 gateway 在執行（launchd/systemd），請先停止它：

```bash
openclaw gateway stop
```

## 原始串流記錄（OpenClaw）

OpenClaw 可以在任何過濾／格式化之前記錄 **原始助理串流**。
這是確認推理是否以純文字增量到達（或以獨立的 thinking 區塊到達）的最佳方式。

透過 CLI 啟用：

```bash
pnpm gateway:watch --force --raw-stream
```

可選的路徑覆寫：

```bash
pnpm gateway:watch --force --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl
```

等效的環境變數：

```bash
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=~/.openclaw/logs/raw-stream.jsonl
```

預設檔案：

`~/.openclaw/logs/raw-stream.jsonl`

## 原始區塊記錄（pi-mono）

為了在區塊被解析之前擷取 **原始 OpenAI 相容區塊**，
pi-mono 提供了獨立的記錄器：

```bash
PI_RAW_STREAM=1
```

可選路徑：

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

預設檔案：

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> 注意：此記錄僅會由使用 pi-mono 的
> `openai-completions` 提供者的處理程序輸出。

## 安全注意事項

- 原始串流記錄可能包含完整提示、工具輸出，以及使用者資料。
- 請將記錄保留在本機，並在除錯完成後刪除。
- 若需分享記錄，請先移除祕密資訊與個人可識別資訊（PII）。
