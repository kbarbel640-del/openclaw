---
metadata:
  openclaw:
    events:
      - gateway:startup
      - session:start
---

# Context Atoms Indexer

將 workspace .md 檔案拆成語義原子，存入 sqlite-vec 向量表。
Agent 回覆時透過 vector search 只取最相關的幾段，取代整檔載入。

## 索引的檔案

- MEMORY.md, TOOLS.md, AGENTS.md, TASKS.md
- CONTACTS.md, ROUTING.md, GROUPS.md
- (SOUL.md 不索引 — 永遠全載為身份咒語)

## 觸發時機

- gateway:startup — 啟動時全量索引
- session:start — 新 session 時檢查是否需要更新
