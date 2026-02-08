---
summary: "OpenProse：OpenClaw 中的 .prose 工作流程、斜線指令與狀態"
read_when:
  - 你想要執行或撰寫 .prose 工作流程
  - 你想要啟用 OpenProse 外掛
  - 你需要了解狀態儲存
title: "OpenProse"
x-i18n:
  source_path: prose.md
  source_hash: cf7301e927b9a463
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:17Z
---

# OpenProse

OpenProse 是一種可攜、以 Markdown 為優先的工作流程格式，用於協調 AI 工作階段。在 OpenClaw 中，它以外掛形式提供，會安裝一個 OpenProse Skills 套件，並提供一個 `/prose` 斜線指令。程式存在於 `.prose` 檔案中，並且可以透過明確的控制流程啟動多個子代理程式。

官方網站：https://www.prose.md

## 它能做什麼

- 具備明確平行處理的多代理研究與綜合。
- 可重複、符合審批安全的工作流程（程式碼審查、事件分流、內容管線）。
- 可重用的 `.prose` 程式，可在支援的代理執行環境中執行。

## 安裝 + 啟用

隨附的外掛預設為停用。請啟用 OpenProse：

```bash
openclaw plugins enable open-prose
```

啟用外掛後請重新啟動 Gateway 閘道器。

開發／本機檢出：`openclaw plugins install ./extensions/open-prose`

相關文件：[Plugins](/plugin)、[Plugin manifest](/plugins/manifest)、[Skills](/tools/skills)。

## 斜線指令

OpenProse 會註冊 `/prose` 作為使用者可呼叫的 Skills 指令。它會路由至 OpenProse VM 指令，並在底層使用 OpenClaw 工具。

常見指令：

```
/prose help
/prose run <file.prose>
/prose run <handle/slug>
/prose run <https://example.com/file.prose>
/prose compile <file.prose>
/prose examples
/prose update
```

## 範例：一個簡單的 `.prose` 檔案

```prose
# Research + synthesis with two agents running in parallel.

input topic: "What should we research?"

agent researcher:
  model: sonnet
  prompt: "You research thoroughly and cite sources."

agent writer:
  model: opus
  prompt: "You write a concise summary."

parallel:
  findings = session: researcher
    prompt: "Research {topic}."
  draft = session: writer
    prompt: "Summarize {topic}."

session "Merge the findings + draft into a final answer."
context: { findings, draft }
```

## 檔案位置

OpenProse 會將狀態儲存在你的工作區中的 `.prose/` 之下：

```
.prose/
├── .env
├── runs/
│   └── {YYYYMMDD}-{HHMMSS}-{random}/
│       ├── program.prose
│       ├── state.md
│       ├── bindings/
│       └── agents/
└── agents/
```

使用者層級的持久代理程式位於：

```
~/.prose/agents/
```

## 狀態模式

OpenProse 支援多種狀態後端：

- **filesystem**（預設）：`.prose/runs/...`
- **in-context**：暫時性，適用於小型程式
- **sqlite**（實驗性）：需要 `sqlite3` 二進位檔
- **postgres**（實驗性）：需要 `psql` 與連線字串

注意事項：

- sqlite／postgres 為選用且屬於實驗性功能。
- postgres 憑證會流入子代理程式日誌；請使用專用且最低權限的資料庫。

## 遠端程式

`/prose run <handle/slug>` 會解析為 `https://p.prose.md/<handle>/<slug>`。
直接 URL 會原樣擷取。這會使用 `web_fetch` 工具（或用於 POST 的 `exec`）。

## OpenClaw 執行環境對應

OpenProse 程式會對應到 OpenClaw 的原語：

| OpenProse 概念         | OpenClaw 工具    |
| ---------------------- | ---------------- |
| 啟動工作階段／任務工具 | `sessions_spawn` |
| 檔案讀寫               | `read` / `write` |
| 網頁擷取               | `web_fetch`      |

如果你的工具允許清單封鎖了這些工具，OpenProse 程式將會失敗。請參閱 [Skills 設定](/tools/skills-config)。

## 安全性 + 審批

請將 `.prose` 檔案視為程式碼。在執行前進行審查。使用 OpenClaw 的工具允許清單與審批閘道來控制副作用。

若需要具備決定性、受審批管控的工作流程，可與 [Lobster](/tools/lobster) 進行比較。
