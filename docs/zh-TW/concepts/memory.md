---
summary: "OpenClaw 記憶體的運作方式（工作區檔案 + 自動記憶體清空）"
read_when:
  - 你想了解記憶體檔案配置與工作流程
  - 你想調整自動的預先壓縮記憶體清空
x-i18n:
  source_path: concepts/memory.md
  source_hash: 5fe705d89fb30998
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:40Z
---

# 記憶體

OpenClaw 記憶體是 **代理程式工作區中的純 Markdown**。這些檔案是
唯一的事實來源；模型只會「記住」被寫入磁碟的內容。

記憶體搜尋工具由啟用中的記憶體外掛提供（預設：
`memory-core`）。可使用 `plugins.slots.memory = "none"` 停用記憶體外掛。

## 記憶體檔案（Markdown）

預設的工作區配置使用兩層記憶體：

- `memory/YYYY-MM-DD.md`
  - 每日紀錄（僅追加）。
  - 工作階段開始時讀取今天 + 昨天。
- `MEMORY.md`（選用）
  - 經整理的長期記憶。
  - **只在主要的私人工作階段載入**（絕不在群組情境中）。

這些檔案位於工作區之下（`agents.defaults.workspace`，預設
`~/.openclaw/workspace`）。完整配置請參閱 [Agent workspace](/concepts/agent-workspace)。

## 何時寫入記憶體

- 決策、偏好與可長期保存的事實寫入 `MEMORY.md`。
- 日常筆記與進行中的情境寫入 `memory/YYYY-MM-DD.md`。
- 若有人說「記住這個」，就把它寫下來（不要留在 RAM）。
- 這個區域仍在演進中。提醒模型儲存記憶很有幫助；它會知道該怎麼做。
- 若你希望某件事能留下來，**請要求機器人把它寫入** 記憶體。

## 自動記憶體清空（預先壓縮提示）

當工作階段 **接近自動壓縮** 時，OpenClaw 會觸發一次 **靜默的、
具代理性的回合**，提醒模型在情境被壓縮 **之前** 寫入可長期保存的記憶。
預設提示明確表示模型 _可以回覆_，但通常 `NO_REPLY`
才是正確回應，讓使用者永遠不會看到這個回合。

這由 `agents.defaults.compaction.memoryFlush` 控制：

```json5
{
  agents: {
    defaults: {
      compaction: {
        reserveTokensFloor: 20000,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000,
          systemPrompt: "Session nearing compaction. Store durable memories now.",
          prompt: "Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store.",
        },
      },
    },
  },
}
```

詳細說明：

- **軟性門檻**：當工作階段權杖估計值超過
  `contextWindow - reserveTokensFloor - softThresholdTokens` 時觸發清空。
- **預設為靜默**：提示包含 `NO_REPLY`，因此不會傳遞任何內容。
- **兩個提示**：一個使用者提示加上一個系統提示附加提醒。
- **每個壓縮循環僅一次清空**（於 `sessions.json` 追蹤）。
- **工作區必須可寫入**：若工作階段以沙箱方式執行並搭配
  `workspaceAccess: "ro"` 或 `"none"`，則會略過清空。

完整的壓縮生命週期請參閱
[Session management + compaction](/reference/session-management-compaction)。

## 向量記憶搜尋

OpenClaw 可以在 `MEMORY.md` 與 `memory/*.md` 上建立小型向量索引，
讓語意查詢即使措辭不同也能找到相關筆記。

預設值：

- 預設啟用。
- 監看記憶體檔案的變更（去抖動）。
- 預設使用遠端嵌入。若未設定 `memorySearch.provider`，OpenClaw 會自動選擇：
  1. 若已設定 `memorySearch.local.modelPath` 且檔案存在，使用 `local`。
  2. 若可解析 OpenAI 金鑰，使用 `openai`。
  3. 若可解析 Gemini 金鑰，使用 `gemini`。
  4. 否則在完成設定前，記憶搜尋將維持停用。
- 本地模式使用 node-llama-cpp，可能需要 `pnpm approve-builds`。
- 在可用時使用 sqlite-vec，加速 SQLite 內的向量搜尋。

遠端嵌入 **需要** 嵌入提供者的 API 金鑰。OpenClaw
會從驗證設定檔、`models.providers.*.apiKey` 或
環境變數解析金鑰。Codex OAuth 只涵蓋聊天／補全，**不** 滿足
記憶搜尋的嵌入需求。Gemini 請使用 `GEMINI_API_KEY` 或
`models.providers.google.apiKey`。使用自訂的 OpenAI 相容端點時，
請設定 `memorySearch.remote.apiKey`（以及選用的 `memorySearch.remote.headers`）。

### QMD 後端（實驗性）

設定 `memory.backend = "qmd"`，即可將內建的 SQLite 索引器替換為
[QMD](https://github.com/tobi/qmd)：一個以本地為優先的搜尋側車，結合
BM25 + 向量 + 重新排序。Markdown 仍是事實來源；OpenClaw
透過呼叫 QMD 進行檢索。重點如下：

**先決條件**

- 預設停用。需逐一設定啟用（`memory.backend = "qmd"`）。
- 另行安裝 QMD CLI（`bun install -g github.com/tobi/qmd` 或下載
  發行版），並確保 `qmd` 可執行檔位於 Gateway 閘道器的 `PATH`。
- QMD 需要允許擴充的 SQLite 組建（macOS 為 `brew install sqlite`）。
- QMD 透過 Bun + `node-llama-cpp` 完全在本地執行，首次使用會從 HuggingFace
  自動下載 GGUF 模型（不需要另行啟動 Ollama 常駐程式）。
- Gateway 閘道器 會在
  `~/.openclaw/agents/<agentId>/qmd/` 下設定 `XDG_CONFIG_HOME` 與
  `XDG_CACHE_HOME`，於自包含的 XDG home 中執行 QMD。
- 作業系統支援：macOS 與 Linux 在安裝 Bun + SQLite 後即可直接使用。
  Windows 最佳做法是透過 WSL2。

**側車如何運作**

- Gateway 閘道器 會在
  `~/.openclaw/agents/<agentId>/qmd/` 下寫入自包含的 QMD home（設定 + 快取 + sqlite DB）。
- 會將 `memory.qmd.paths`（加上預設工作區記憶體檔案）重寫為
  `index.yml`，接著在啟動與可設定的間隔
  （`memory.qmd.update.interval`，預設 5 m）執行 `qmd update` + `qmd embed`。
- 搜尋透過 `qmd query --json` 執行。若 QMD 失敗或缺少可執行檔，
  OpenClaw 會自動回退至內建的 SQLite 管理器，確保記憶工具持續可用。
- **首次搜尋可能較慢**：QMD 可能在第一次
  `qmd query` 執行時下載本地 GGUF 模型（重新排序／查詢擴展）。
  - OpenClaw 在執行 QMD 時會自動設定 `XDG_CONFIG_HOME`/`XDG_CACHE_HOME`。
  - 若你想手動預先下載模型（並暖身 OpenClaw 使用的同一個索引），
    可使用代理程式的 XDG 目錄執行一次性查詢。

    OpenClaw 的 QMD 狀態位於你的 **狀態目錄**（預設為 `~/.openclaw`）。
    你可以將 `qmd` 指向完全相同的索引，方法是匯出
    OpenClaw 使用的相同 XDG 變數：

    ```bash
    # Pick the same state dir OpenClaw uses
    STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
    if [ -d "$HOME/.moltbot" ] && [ ! -d "$HOME/.openclaw" ] \
      && [ -z "${OPENCLAW_STATE_DIR:-}" ]; then
      STATE_DIR="$HOME/.moltbot"
    fi

    export XDG_CONFIG_HOME="$STATE_DIR/agents/main/qmd/xdg-config"
    export XDG_CACHE_HOME="$STATE_DIR/agents/main/qmd/xdg-cache"

    # (Optional) force an index refresh + embeddings
    qmd update
    qmd embed

    # Warm up / trigger first-time model downloads
    qmd query "test" -c memory-root --json >/dev/null 2>&1
    ```

**設定介面（`memory.qmd.*`）**

- `command`（預設 `qmd`）：覆寫可執行檔路徑。
- `includeDefaultMemory`（預設 `true`）：自動索引 `MEMORY.md` + `memory/**/*.md`。
- `paths[]`：加入額外目錄／檔案（`path`，選用 `pattern`，選用
  穩定的 `name`）。
- `sessions`：選擇加入工作階段 JSONL 索引（`enabled`、`retentionDays`、
  `exportDir`）。
- `update`：控制重新整理節奏（`interval`、`debounceMs`、`onBoot`、`embedInterval`）。
- `limits`：限制回憶載荷（`maxResults`、`maxSnippetChars`、
  `maxInjectedChars`、`timeoutMs`）。
- `scope`：與 [`session.sendPolicy`](/gateway/configuration#session) 相同的結構。
  預設僅限私訊（`deny` 全部、`allow` 直接聊天）；放寬後即可在群組／頻道中呈現 QMD 命中。
- 來自工作區外的片段會以 `qmd/<collection>/<relative-path>` 顯示於 `memory_search` 結果中；
  `memory_get` 能理解此前綴，並從已設定的 QMD 集合根目錄讀取。
- 當 `memory.qmd.sessions.enabled = true` 時，OpenClaw 會將已清理的工作階段
  逐字稿（使用者／助理回合）匯出到
  `~/.openclaw/agents/<id>/qmd/sessions/` 下的專用 QMD 集合，讓 `memory_search` 能回憶近期
  對話而不需觸及內建的 SQLite 索引。
- 當 `memory.citations` 為 `auto`/`on` 時，
  `memory_search` 片段會包含 `Source: <path#line>` 頁尾；設定 `memory.citations = "off"`
  可將路徑中繼資料保留在內部（代理程式仍會收到路徑以供
  `memory_get` 使用，但片段文字會省略頁尾，且系統提示會警告代理程式不要引用它）。

**範例**

```json5
memory: {
  backend: "qmd",
  citations: "auto",
  qmd: {
    includeDefaultMemory: true,
    update: { interval: "5m", debounceMs: 15000 },
    limits: { maxResults: 6, timeoutMs: 4000 },
    scope: {
      default: "deny",
      rules: [{ action: "allow", match: { chatType: "direct" } }]
    },
    paths: [
      { name: "docs", path: "~/notes", pattern: "**/*.md" }
    ]
  }
}
```

**引用與回退**

- `memory.citations` 會套用至所有後端（`auto`/`on`/`off`）。
- 當 `qmd` 執行時，我們會標記 `status().backend = "qmd"`，
  以便診斷顯示由哪個引擎提供結果。若 QMD 子程序退出或無法解析 JSON 輸出，
  搜尋管理器會記錄警告並回傳內建提供者
  （既有的 Markdown 嵌入），直到 QMD 恢復。

### 其他記憶路徑

若你想索引預設工作區配置以外的 Markdown 檔案，請加入明確路徑：

```json5
agents: {
  defaults: {
    memorySearch: {
      extraPaths: ["../team-docs", "/srv/shared-notes/overview.md"]
    }
  }
}
```

注意事項：

- 路徑可為絕對路徑或相對於工作區。
- 目錄會遞迴掃描 `.md` 檔案。
- 只會索引 Markdown 檔案。
- 會忽略符號連結（檔案或目錄）。

### Gemini 嵌入（原生）

將提供者設定為 `gemini`，即可直接使用 Gemini 嵌入 API：

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "gemini",
      model: "gemini-embedding-001",
      remote: {
        apiKey: "YOUR_GEMINI_API_KEY"
      }
    }
  }
}
```

注意事項：

- `remote.baseUrl` 為選用（預設為 Gemini API 基底 URL）。
- `remote.headers` 可在需要時加入額外標頭。
- 預設模型：`gemini-embedding-001`。

若你想使用 **自訂的 OpenAI 相容端點**（OpenRouter、vLLM 或代理），
可搭配 OpenAI 提供者使用 `remote` 設定：

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_OPENAI_COMPAT_API_KEY",
        headers: { "X-Custom-Header": "value" }
      }
    }
  }
}
```

若不想設定 API 金鑰，請使用 `memorySearch.provider = "local"` 或設定
`memorySearch.fallback = "none"`。

回退機制：

- `memorySearch.fallback` 可為 `openai`、`gemini`、`local` 或 `none`。
- 回退提供者僅在主要嵌入提供者失敗時使用。

批次索引（OpenAI + Gemini）：

- OpenAI 與 Gemini 嵌入預設啟用。設定 `agents.defaults.memorySearch.remote.batch.enabled = false` 可停用。
- 預設行為會等待批次完成；如有需要可調整 `remote.batch.wait`、`remote.batch.pollIntervalMs` 與 `remote.batch.timeoutMinutes`。
- 設定 `remote.batch.concurrency` 以控制並行提交的批次工作數（預設：2）。
- 當 `memorySearch.provider = "openai"` 或 `"gemini"` 時套用批次模式，並使用對應的 API 金鑰。
- Gemini 批次工作使用非同步嵌入批次端點，且需要 Gemini Batch API 可用。

為何 OpenAI 批次又快又便宜：

- 對於大型回填，OpenAI 通常是我們支援中最快的選項，因為可在單一批次工作中提交多個嵌入請求，並讓 OpenAI 非同步處理。
- OpenAI 為 Batch API 工作負載提供折扣定價，因此大型索引通常比同步送出相同請求更便宜。
- 詳情請參閱 OpenAI Batch API 文件與定價：
  - https://platform.openai.com/docs/api-reference/batch
  - https://platform.openai.com/pricing

設定範例：

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      fallback: "openai",
      remote: {
        batch: { enabled: true, concurrency: 2 }
      },
      sync: { watch: true }
    }
  }
}
```

工具：

- `memory_search` — 回傳含檔案 + 行號範圍的片段。
- `memory_get` — 依路徑讀取記憶體檔案內容。

本地模式：

- 設定 `agents.defaults.memorySearch.provider = "local"`。
- 提供 `agents.defaults.memorySearch.local.modelPath`（GGUF 或 `hf:` URI）。
- 選用：設定 `agents.defaults.memorySearch.fallback = "none"` 以避免遠端回退。

### 記憶工具如何運作

- `memory_search` 會從 `MEMORY.md` + `memory/**/*.md` 中，對 Markdown 片段進行語意搜尋（目標約 400 權杖，80 權杖重疊）。它會回傳片段文字（上限約 700 字元）、檔案路徑、行號範圍、分數、提供者／模型，以及是否從本地 → 遠端嵌入回退。不會回傳完整檔案內容。
- `memory_get` 會讀取指定的記憶 Markdown 檔案（相對於工作區），可選擇從起始行讀取並讀取 N 行。位於 `MEMORY.md` / `memory/` 之外的路徑會被拒絕。
- 僅當 `memorySearch.enabled` 對代理程式解析為 true 時，兩個工具才會啟用。

### 會被索引的內容（以及時機）

- 檔案類型：僅限 Markdown（`MEMORY.md`、`memory/**/*.md`）。
- 索引儲存：每個代理程式一個 SQLite，位於 `~/.openclaw/memory/<agentId>.sqlite`（可透過 `agents.defaults.memorySearch.store.path` 設定，支援 `{agentId}` 權杖）。
- 新鮮度：監看 `MEMORY.md` + `memory/` 會將索引標記為髒（去抖動 1.5 秒）。同步會在工作階段開始、搜尋時或依間隔排程，並以非同步方式執行。工作階段逐字稿使用差量門檻觸發背景同步。
- 重新索引觸發：索引會儲存嵌入 **提供者／模型 + 端點指紋 + 分塊參數**。若其中任一變更，OpenClaw 會自動重置並重新索引整個資料庫。

### 混合搜尋（BM25 + 向量）

啟用後，OpenClaw 會結合：

- **向量相似度**（語意匹配，措辭可不同）
- **BM25 關鍵字相關性**（精確權杖，如 ID、環境變數、程式碼符號）

若你的平台無法使用全文搜尋，OpenClaw 會回退為僅向量搜尋。

#### 為何使用混合？

向量搜尋擅長「意思相同」：

- 「Mac Studio gateway host」vs「執行 Gateway 閘道器 的機器」
- 「debounce file updates」vs「避免在每次寫入時索引」

但對精確、高訊號權杖可能較弱：

- ID（`a828e60`、`b3b9895a…`）
- 程式碼符號（`memorySearch.query.hybrid`）
- 錯誤字串（「sqlite-vec unavailable」）

BM25（全文）正好相反：對精確權杖很強，對改寫較弱。
混合搜尋是務實的中間解法：**同時使用兩種檢索訊號**，
讓「自然語言」與「大海撈針」查詢都能得到好結果。

#### 我們如何合併結果（目前設計）

實作概念：

1. 從兩側各自擷取候選集：

- **向量**：依餘弦相似度取前 `maxResults * candidateMultiplier` 名。
- **BM25**：依 FTS5 BM25 排名取前 `maxResults * candidateMultiplier` 名（數值越低越好）。

2. 將 BM25 排名轉換為近似 0..1 的分數：

- `textScore = 1 / (1 + max(0, bm25Rank))`

3. 依片段 id 聯集候選，並計算加權分數：

- `finalScore = vectorWeight * vectorScore + textWeight * textScore`

注意事項：

- `vectorWeight` + `textWeight` 在設定解析時會正規化為 1.0，因此權重可視為百分比。
- 若嵌入不可用（或提供者回傳零向量），仍會執行 BM25 並回傳關鍵字命中。
- 若無法建立 FTS5，則維持僅向量搜尋（不會硬性失敗）。

這並非「資訊檢索理論上完美」，但簡單、快速，且在真實筆記上通常能提升召回率／精準度。
若之後要更進階，常見的下一步是 Reciprocal Rank Fusion（RRF）或在混合前進行分數正規化
（最小／最大或 z-score）。

設定：

```json5
agents: {
  defaults: {
    memorySearch: {
      query: {
        hybrid: {
          enabled: true,
          vectorWeight: 0.7,
          textWeight: 0.3,
          candidateMultiplier: 4
        }
      }
    }
  }
}
```

### 嵌入快取

OpenClaw 可在 SQLite 中快取 **片段嵌入**，讓重新索引與頻繁更新（特別是工作階段逐字稿）
不必為未變更的文字重新嵌入。

設定：

```json5
agents: {
  defaults: {
    memorySearch: {
      cache: {
        enabled: true,
        maxEntries: 50000
      }
    }
  }
}
```

### 工作階段記憶搜尋（實驗性）

你可以選擇性地索引 **工作階段逐字稿**，並透過 `memory_search` 呈現。
此功能受實驗性旗標控管。

```json5
agents: {
  defaults: {
    memorySearch: {
      experimental: { sessionMemory: true },
      sources: ["memory", "sessions"]
    }
  }
}
```

注意事項：

- 工作階段索引為 **選擇加入**（預設關閉）。
- 工作階段更新會去抖動，並在超過差量門檻後 **以非同步方式索引**（盡力而為）。
- `memory_search` 不會因索引而阻塞；在背景同步完成前，結果可能略為過期。
- 結果仍只包含片段；`memory_get` 仍僅限記憶體檔案。
- 工作階段索引以代理程式為單位隔離（只索引該代理程式的工作階段紀錄）。
- 工作階段紀錄儲存在磁碟上（`~/.openclaw/agents/<agentId>/sessions/*.jsonl`）。任何具有檔案系統存取權的程序／使用者都能讀取，
  因此請將磁碟存取視為信任邊界。若需更嚴格的隔離，請以不同 OS 使用者或主機執行代理程式。

差量門檻（顯示預設值）：

```json5
agents: {
  defaults: {
    memorySearch: {
      sync: {
        sessions: {
          deltaBytes: 100000,   // ~100 KB
          deltaMessages: 50     // JSONL lines
        }
      }
    }
  }
}
```

### SQLite 向量加速（sqlite-vec）

當 sqlite-vec 擴充可用時，OpenClaw 會將嵌入儲存在
SQLite 虛擬表（`vec0`）中，並在資料庫內執行向量距離查詢。
這可在不將所有嵌入載入 JS 的情況下維持搜尋效能。

設定（選用）：

```json5
agents: {
  defaults: {
    memorySearch: {
      store: {
        vector: {
          enabled: true,
          extensionPath: "/path/to/sqlite-vec"
        }
      }
    }
  }
}
```

注意事項：

- `enabled` 預設為 true；停用後，搜尋會回退為在程序內對已儲存嵌入進行餘弦相似度計算。
- 若 sqlite-vec 擴充缺失或載入失敗，OpenClaw 會記錄錯誤並持續使用 JS 回退（無向量表）。
- `extensionPath` 可覆寫內建的 sqlite-vec 路徑（適用於自訂組建或非標準安裝位置）。

### 本地嵌入自動下載

- 預設本地嵌入模型：`hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf`（約 0.6 GB）。
- 當 `memorySearch.provider = "local"` 時，`node-llama-cpp` 解析為 `modelPath`；若 GGUF 缺失，
  會 **自動下載** 至快取（或若設定則至 `local.modelCacheDir`），然後載入。下載可在重試時續傳。
- 原生組建需求：執行 `pnpm approve-builds`，選擇 `node-llama-cpp`，然後 `pnpm rebuild node-llama-cpp`。
- 回退：若本地設定失敗且 `memorySearch.fallback = "openai"`，我們會自動切換至遠端嵌入
  （除非覆寫，預設為 `openai/text-embedding-3-small`），並記錄原因。

### 自訂 OpenAI 相容端點範例

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_REMOTE_API_KEY",
        headers: {
          "X-Organization": "org-id",
          "X-Project": "project-id"
        }
      }
    }
  }
}
```

注意事項：

- `remote.*` 優先於 `models.providers.openai.*`。
- `remote.headers` 會與 OpenAI 標頭合併；若金鑰衝突，遠端優先。省略 `remote.headers`
  即可使用 OpenAI 預設值。
