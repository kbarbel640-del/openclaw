---
summary: 「`openclaw memory` 的 CLI 參考（status/index/search）」
read_when:
  - 當你想要為語意記憶建立索引或進行搜尋時
  - 當你正在偵錯記憶可用性或索引時
title: 「記憶」
x-i18n:
  source_path: cli/memory.md
  source_hash: 95a9e94306f95be2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:41Z
---

# `openclaw memory`

管理語意記憶的索引與搜尋。
由目前啟用的記憶外掛提供（預設：`memory-core`；設定 `plugins.slots.memory = "none"` 以停用）。

相關內容：

- 記憶概念：[Memory](/concepts/memory)
- 外掛：[Plugins](/plugins)

## 範例

```bash
openclaw memory status
openclaw memory status --deep
openclaw memory status --deep --index
openclaw memory status --deep --index --verbose
openclaw memory index
openclaw memory index --verbose
openclaw memory search "release checklist"
openclaw memory status --agent main
openclaw memory index --agent main --verbose
```

## 選項

常見：

- `--agent <id>`：將範圍限定為單一代理程式（預設：所有已設定的代理程式）。
- `--verbose`：在探測與索引期間輸出詳細記錄。

注意事項：

- `memory status --deep` 會探測向量與嵌入的可用性。
- `memory status --deep --index` 會在儲存區為髒狀態時執行重新索引。
- `memory index --verbose` 會輸出各階段的詳細資訊（提供者、模型、來源、批次活動）。
- `memory status` 會包含透過 `memorySearch.extraPaths` 設定的任何額外路徑。
