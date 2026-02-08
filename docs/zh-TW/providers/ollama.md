---
summary: 「使用 Ollama（本地 LLM 執行環境）執行 OpenClaw」
read_when:
  - 你想透過 Ollama 使用本地模型執行 OpenClaw
  - 你需要 Ollama 的安裝與設定指引
title: 「Ollama」
x-i18n:
  source_path: providers/ollama.md
  source_hash: 2992dd0a456d19c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:29Z
---

# Ollama

Ollama 是一個本地 LLM 執行環境，讓你能夠輕鬆在自己的機器上執行開源模型。OpenClaw 與 Ollama 的 OpenAI 相容 API 整合，並且在你透過 `OLLAMA_API_KEY`（或驗證設定檔）選擇加入，且未定義明確的 `models.providers.ollama` 項目時，能夠 **自動探索支援工具的模型**。

## 快速開始

1. 安裝 Ollama：https://ollama.ai

2. 下載一個模型：

```bash
ollama pull gpt-oss:20b
# or
ollama pull llama3.3
# or
ollama pull qwen2.5-coder:32b
# or
ollama pull deepseek-r1:32b
```

3. 為 OpenClaw 啟用 Ollama（任何值都可以；Ollama 不需要真正的金鑰）：

```bash
# Set environment variable
export OLLAMA_API_KEY="ollama-local"

# Or configure in your config file
openclaw config set models.providers.ollama.apiKey "ollama-local"
```

4. 使用 Ollama 模型：

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/gpt-oss:20b" },
    },
  },
}
```

## 模型探索（隱含提供者）

當你設定 `OLLAMA_API_KEY`（或驗證設定檔），且 **未** 定義 `models.providers.ollama` 時，OpenClaw 會從位於 `http://127.0.0.1:11434` 的本地 Ollama 實例探索模型：

- 查詢 `/api/tags` 與 `/api/show`
- 僅保留回報具備 `tools` 能力的模型
- 當模型回報 `thinking` 時，標記 `reasoning`
- 在可用時，從 `model_info["<arch>.context_length"]` 讀取 `contextWindow`
- 將 `maxTokens` 設為內容視窗大小的 10×
- 將所有成本設為 `0`

這可避免手動新增模型，同時讓模型目錄與 Ollama 的能力保持一致。

查看可用的模型：

```bash
ollama list
openclaw models list
```

要新增模型，只需透過 Ollama 下載即可：

```bash
ollama pull mistral
```

新模型將會自動被探索並可供使用。

如果你明確設定了 `models.providers.ollama`，則會跳過自動探索，你必須手動定義模型（見下方）。

## 設定

### 基本設定（隱含探索）

啟用 Ollama 最簡單的方式是使用環境變數：

```bash
export OLLAMA_API_KEY="ollama-local"
```

### 明確設定（手動模型）

在以下情況下使用明確設定：

- Ollama 執行在另一個主機或連接埠。
- 你想強制指定特定的內容視窗大小或模型清單。
- 你想納入未回報工具支援的模型。

```json5
{
  models: {
    providers: {
      ollama: {
        // Use a host that includes /v1 for OpenAI-compatible APIs
        baseUrl: "http://ollama-host:11434/v1",
        apiKey: "ollama-local",
        api: "openai-completions",
        models: [
          {
            id: "gpt-oss:20b",
            name: "GPT-OSS 20B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 8192 * 10
          }
        ]
      }
    }
  }
}
```

如果設定了 `OLLAMA_API_KEY`，你可以在提供者項目中省略 `apiKey`，OpenClaw 會自動填入以進行可用性檢查。

### 自訂基礎 URL（明確設定）

如果 Ollama 執行在不同的主機或連接埠（明確設定會停用自動探索，因此需手動定義模型）：

```json5
{
  models: {
    providers: {
      ollama: {
        apiKey: "ollama-local",
        baseUrl: "http://ollama-host:11434/v1",
      },
    },
  },
}
```

### 模型選擇

完成設定後，你的所有 Ollama 模型都可使用：

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/gpt-oss:20b",
        fallbacks: ["ollama/llama3.3", "ollama/qwen2.5-coder:32b"],
      },
    },
  },
}
```

## 進階

### 推理模型

當 Ollama 在 `/api/show` 中回報 `thinking` 時，OpenClaw 會將模型標記為具備推理能力：

```bash
ollama pull deepseek-r1:32b
```

### 模型成本

Ollama 為免費且在本地執行，因此所有模型成本皆設為 $0。

### 串流設定

由於底層 SDK 在處理 Ollama 回應格式時存在一個 [已知問題](https://github.com/badlogic/pi-mono/issues/1205)，**預設會停用 Ollama 模型的串流**。這可避免在使用支援工具的模型時產生損毀的回應。

當串流停用時，回應會一次性傳送（非串流模式），可避免內容與推理增量交錯而導致輸出混亂的問題。

#### 重新啟用串流（進階）

如果你想為 Ollama 重新啟用串流（可能會對支援工具的模型造成問題）：

```json5
{
  agents: {
    defaults: {
      models: {
        "ollama/gpt-oss:20b": {
          streaming: true,
        },
      },
    },
  },
}
```

#### 停用其他提供者的串流

如有需要，你也可以為任何提供者停用串流：

```json5
{
  agents: {
    defaults: {
      models: {
        "openai/gpt-4": {
          streaming: false,
        },
      },
    },
  },
}
```

### 內容視窗

對於自動探索的模型，OpenClaw 會使用 Ollama 回報的內容視窗大小；若無回報，則預設為 `8192`。你可以在明確的提供者設定中覆寫 `contextWindow` 與 `maxTokens`。

## 疑難排解

### 未偵測到 Ollama

請確認 Ollama 正在執行，且你已設定 `OLLAMA_API_KEY`（或驗證設定檔），並且 **未** 定義明確的 `models.providers.ollama` 項目：

```bash
ollama serve
```

並確認 API 可連線：

```bash
curl http://localhost:11434/api/tags
```

### 沒有可用模型

OpenClaw 只會自動探索回報支援工具的模型。若你的模型未列出，請擇一：

- 下載支援工具的模型，或
- 在 `models.providers.ollama` 中明確定義模型。

新增模型：

```bash
ollama list  # See what's installed
ollama pull gpt-oss:20b  # Pull a tool-capable model
ollama pull llama3.3     # Or another model
```

### 連線被拒

請確認 Ollama 正在正確的連接埠上執行：

```bash
# Check if Ollama is running
ps aux | grep ollama

# Or restart Ollama
ollama serve
```

### 回應損毀或輸出中出現工具名稱

如果你在使用 Ollama 模型時看到包含工具名稱（如 `sessions_send`、`memory_get`）的混亂回應，或出現片段化文字，這是由於上游 SDK 在串流回應上的問題所致。**在最新版本的 OpenClaw 中，這已透過預設停用 Ollama 模型的串流而修復。**

如果你手動啟用了串流並遇到此問題：

1. 從你的 Ollama 模型項目中移除 `streaming: true` 設定，或
2. 為 Ollama 模型明確設定 `streaming: false`（請參閱 [串流設定](#streaming-configuration)）

## 另請參閱

- [Model Providers](/concepts/model-providers) - 所有提供者的概覽
- [Model Selection](/concepts/models) - 如何選擇模型
- [Configuration](/gateway/configuration) - 完整設定參考
