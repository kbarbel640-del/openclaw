---
summary: "CLI 後端：透過本機 AI CLI 的純文字後備方案"
read_when:
  - 你需要在 API 提供者失效時的可靠後備方案
  - 你正在執行 Claude Code CLI 或其他本機 AI CLI，並希望重複利用它們
  - 你需要一條僅限文字、無工具，但仍支援工作階段與圖片的路徑
title: "CLI 後端"
x-i18n:
  source_path: gateway/cli-backends.md
  source_hash: 8285f4829900bc81
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:26Z
---

# CLI 後端（後備執行環境）

OpenClaw 可以在 API 提供者停機、遭到速率限制，或暫時行為異常時，將 **本機 AI CLI** 作為 **純文字後備** 來執行。這項設計刻意保守：

- **停用工具**（不進行工具呼叫）。
- **文字輸入 → 文字輸出**（可靠）。
- **支援工作階段**（讓後續回合保持連貫）。
- **可傳遞圖片**（若 CLI 接受圖片路徑）。

這是作為 **安全網** 而非主要路徑來設計。當你想要「永遠可用」的文字回應、且不依賴外部 API 時再使用。

## 新手友善的快速開始

你可以 **不需任何設定** 就使用 Claude Code CLI（OpenClaw 內建預設）：

```bash
openclaw agent --message "hi" --model claude-cli/opus-4.6
```

Codex CLI 也可直接使用：

```bash
openclaw agent --message "hi" --model codex-cli/gpt-5.3-codex
```

如果你的 Gateway 閘道器 在 launchd/systemd 下執行且 PATH 很精簡，只需加入
指令路徑即可：

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
      },
    },
  },
}
```

就這樣。不需要金鑰，也不需要額外的驗證設定（除了 CLI 本身）。

## 作為後備使用

將 CLI 後端加入你的後備清單，讓它只在主要模型失敗時才執行：

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["claude-cli/opus-4.6", "claude-cli/opus-4.5"],
      },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "claude-cli/opus-4.6": {},
        "claude-cli/opus-4.5": {},
      },
    },
  },
}
```

注意事項：

- 若你使用 `agents.defaults.models`（allowlist），必須包含 `claude-cli/...`。
- 若主要提供者失敗（驗證、速率限制、逾時），OpenClaw 會接著嘗試 CLI 後端。

## 設定總覽

所有 CLI 後端都位於：

```
agents.defaults.cliBackends
```

每個項目都以 **提供者 id** 作為鍵（例如 `claude-cli`、`my-cli`）。
提供者 id 會成為你的模型參照左側：

```
<provider>/<model>
```

### 範例設定

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
        "my-cli": {
          command: "my-cli",
          args: ["--json"],
          output: "json",
          input: "arg",
          modelArg: "--model",
          modelAliases: {
            "claude-opus-4-6": "opus",
            "claude-opus-4-5": "opus",
            "claude-sonnet-4-5": "sonnet",
          },
          sessionArg: "--session",
          sessionMode: "existing",
          sessionIdFields: ["session_id", "conversation_id"],
          systemPromptArg: "--system",
          systemPromptWhen: "first",
          imageArg: "--image",
          imageMode: "repeat",
          serialize: true,
        },
      },
    },
  },
}
```

## 運作方式

1. 依據提供者前綴（`claude-cli/...`）**選擇後端**。
2. 使用相同的 OpenClaw 提示詞 + 工作區內容 **建立 system prompt**。
3. **執行 CLI** 並附上工作階段 id（若支援），以保持歷史一致。
4. **解析輸出**（JSON 或純文字）並回傳最終文字。
5. **持久化工作階段 id**（按後端），讓後續互動重用同一個 CLI 工作階段。

## 工作階段

- 若 CLI 支援工作階段，請設定 `sessionArg`（例如 `--session-id`）或
  `sessionArgs`（當 id 需要插入到多個旗標時，使用佔位符 `{sessionId}`）。
- 若 CLI 使用 **resume 子指令** 並搭配不同旗標，請設定
  `resumeArgs`（在續用時取代 `args`），並可選擇設定 `resumeOutput`
  （用於非 JSON 的續用）。
- `sessionMode`：
  - `always`：一律傳送工作階段 id（若未儲存則產生新的 UUID）。
  - `existing`：僅在先前已儲存時才傳送工作階段 id。
  - `none`：永不傳送工作階段 id。

## 圖片（直通傳遞）

若你的 CLI 接受圖片路徑，請設定 `imageArg`：

```json5
imageArg: "--image",
imageMode: "repeat"
```

OpenClaw 會將 base64 圖片寫入暫存檔。若設定了 `imageArg`，這些
路徑會作為 CLI 參數傳遞。若缺少 `imageArg`，OpenClaw 會將檔案路徑附加到
提示詞中（路徑注入），這對於會從純路徑自動載入本機檔案的 CLI 已足夠
（Claude Code CLI 的行為）。

## 輸入 / 輸出

- `output: "json"`（預設）嘗試解析 JSON 並擷取文字 + 工作階段 id。
- `output: "jsonl"` 解析 JSONL 串流（Codex CLI `--json`），並擷取
  最後一則代理程式訊息，以及存在時的 `thread_id`。
- `output: "text"` 將 stdout 視為最終回應。

輸入模式：

- `input: "arg"`（預設）將提示詞作為最後一個 CLI 參數傳遞。
- `input: "stdin"` 透過 stdin 傳送提示詞。
- 若提示詞非常長且設定了 `maxPromptArgChars`，將改用 stdin。

## 預設值（內建）

OpenClaw 內建了 `claude-cli` 的預設設定：

- `command: "claude"`
- `args: ["-p", "--output-format", "json", "--dangerously-skip-permissions"]`
- `resumeArgs: ["-p", "--output-format", "json", "--dangerously-skip-permissions", "--resume", "{sessionId}"]`
- `modelArg: "--model"`
- `systemPromptArg: "--append-system-prompt"`
- `sessionArg: "--session-id"`
- `systemPromptWhen: "first"`
- `sessionMode: "always"`

OpenClaw 也內建了 `codex-cli` 的預設設定：

- `command: "codex"`
- `args: ["exec","--json","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `resumeArgs: ["exec","resume","{sessionId}","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `output: "jsonl"`
- `resumeOutput: "text"`
- `modelArg: "--model"`
- `imageArg: "--image"`
- `sessionMode: "existing"`

僅在需要時覆寫（常見情境：使用絕對 `command` 路徑）。

## 限制

- **沒有 OpenClaw 工具**（CLI 後端不會接收工具呼叫）。部分 CLI 仍可能執行其自身的代理工具。
- **不支援串流**（會收集 CLI 輸出後再回傳）。
- **結構化輸出** 取決於 CLI 的 JSON 格式。
- **Codex CLI 工作階段** 透過文字輸出續用（非 JSONL），其結構性不如初始的
  `--json` 執行。但 OpenClaw 的工作階段仍可正常運作。

## 疑難排解

- **找不到 CLI**：將 `command` 設為完整路徑。
- **模型名稱錯誤**：使用 `modelAliases` 將 `provider/model` 對應到 CLI 模型。
- **沒有工作階段連續性**：確認已設定 `sessionArg`，且 `sessionMode` 不是
  `none`（Codex CLI 目前無法以 JSON 輸出進行續用）。
- **圖片被忽略**：設定 `imageArg`（並確認 CLI 支援檔案路徑）。
