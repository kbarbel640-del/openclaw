---
summary: 「將 WhatsApp 訊息廣播給多個代理程式」
read_when:
  - 設定廣播群組
  - 在 WhatsApp 中除錯多代理程式回覆
status: experimental
title: 「廣播群組」
x-i18n:
  source_path: channels/broadcast-groups.md
  source_hash: 25866bc0d519552d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:08Z
---

# 廣播群組

**狀態：** 實驗性  
**版本：** 於 2026.1.9 新增

## 概覽

廣播群組可讓多個代理程式同時處理並回覆同一則訊息。這使你能建立在單一 WhatsApp 群組或私訊中協同運作的專門代理程式團隊 —— 全部共用一個電話號碼。

目前範圍：**僅支援 WhatsApp**（網頁頻道）。

廣播群組會在頻道允許清單與群組啟用規則之後評估。在 WhatsApp 群組中，這代表當 OpenClaw 原本會回覆時才會進行廣播（例如：依你的群組設定，在被提及時）。

## 使用案例

### 1. 專門化代理程式團隊

部署多個具有原子化、聚焦職責的代理程式：

```
Group: "Development Team"
Agents:
  - CodeReviewer (reviews code snippets)
  - DocumentationBot (generates docs)
  - SecurityAuditor (checks for vulnerabilities)
  - TestGenerator (suggests test cases)
```

每個代理程式都會處理同一則訊息，並提供其專業視角。

### 2. 多語言支援

```
Group: "International Support"
Agents:
  - Agent_EN (responds in English)
  - Agent_DE (responds in German)
  - Agent_ES (responds in Spanish)
```

### 3. 品質保證流程

```
Group: "Customer Support"
Agents:
  - SupportAgent (provides answer)
  - QAAgent (reviews quality, only responds if issues found)
```

### 4. 任務自動化

```
Group: "Project Management"
Agents:
  - TaskTracker (updates task database)
  - TimeLogger (logs time spent)
  - ReportGenerator (creates summaries)
```

## 設定

### 基本設定

新增一個最上層的 `broadcast` 區段（與 `bindings` 並列）。金鑰為 WhatsApp peer ID：

- 群組聊天：群組 JID（例如：`120363403215116621@g.us`）
- 私訊：E.164 電話號碼（例如：`+15551234567`）

```json
{
  "broadcast": {
    "120363403215116621@g.us": ["alfred", "baerbel", "assistant3"]
  }
}
```

**結果：** 當 OpenClaw 會在此聊天中回覆時，將同時執行這三個代理程式。

### 處理策略

控制代理程式如何處理訊息：

#### 平行（預設）

所有代理程式同時處理：

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

#### 依序

代理程式依順序處理（後者會等待前者完成）：

```json
{
  "broadcast": {
    "strategy": "sequential",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

### 完整範例

```json
{
  "agents": {
    "list": [
      {
        "id": "code-reviewer",
        "name": "Code Reviewer",
        "workspace": "/path/to/code-reviewer",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "security-auditor",
        "name": "Security Auditor",
        "workspace": "/path/to/security-auditor",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "docs-generator",
        "name": "Documentation Generator",
        "workspace": "/path/to/docs-generator",
        "sandbox": { "mode": "all" }
      }
    ]
  },
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["code-reviewer", "security-auditor", "docs-generator"],
    "120363424282127706@g.us": ["support-en", "support-de"],
    "+15555550123": ["assistant", "logger"]
  }
}
```

## 運作方式

### 訊息流程

1. **傳入訊息** 抵達 WhatsApp 群組
2. **廣播檢查**：系統檢查 peer ID 是否存在於 `broadcast`
3. **若在廣播清單中**：
   - 所有列出的代理程式都會處理訊息
   - 每個代理程式都有自己的工作階段金鑰與隔離的上下文
   - 代理程式以平行（預設）或依序方式處理
4. **若不在廣播清單中**：
   - 套用一般路由（第一個符合的綁定）

注意：廣播群組不會繞過頻道允許清單或群組啟用規則（提及／指令等）。它們只會在訊息符合處理條件時，改變「執行哪些代理程式」。

### 工作階段隔離

廣播群組中的每個代理程式都維持完全獨立的：

- **工作階段金鑰**（`agent:alfred:whatsapp:group:120363...` vs `agent:baerbel:whatsapp:group:120363...`）
- **對話歷史**（代理程式看不到其他代理程式的訊息）
- **工作區**（若有設定，則為獨立的沙箱）
- **工具存取**（不同的允許／拒絕清單）
- **記憶／上下文**（獨立的 IDENTITY.md、SOUL.md 等）
- **群組上下文緩衝區**（用於上下文的近期群組訊息）會依 peer 共用，因此所有被觸發的廣播代理程式都會看到相同的上下文

這讓每個代理程式可以擁有：

- 不同的個性
- 不同的工具存取（例如：唯讀 vs. 讀寫）
- 不同的模型（例如：opus vs. sonnet）
- 不同的 Skills 已安裝

### 範例：隔離的工作階段

在群組 `120363403215116621@g.us` 中，代理程式為 `["alfred", "baerbel"]`：

**Alfred 的上下文：**

```
Session: agent:alfred:whatsapp:group:120363403215116621@g.us
History: [user message, alfred's previous responses]
Workspace: /Users/pascal/openclaw-alfred/
Tools: read, write, exec
```

**Bärbel 的上下文：**

```
Session: agent:baerbel:whatsapp:group:120363403215116621@g.us
History: [user message, baerbel's previous responses]
Workspace: /Users/pascal/openclaw-baerbel/
Tools: read only
```

## 最佳實務

### 1. 保持代理程式專注

為每個代理程式設計單一且清楚的職責：

```json
{
  "broadcast": {
    "DEV_GROUP": ["formatter", "linter", "tester"]
  }
}
```

✅ **好：** 每個代理程式只有一項工作  
❌ **不好：** 一個通用的「dev-helper」代理程式

### 2. 使用具描述性的名稱

清楚表達每個代理程式的功能：

```json
{
  "agents": {
    "security-scanner": { "name": "Security Scanner" },
    "code-formatter": { "name": "Code Formatter" },
    "test-generator": { "name": "Test Generator" }
  }
}
```

### 3. 設定不同的工具存取

只給代理程式它們所需的工具：

```json
{
  "agents": {
    "reviewer": {
      "tools": { "allow": ["read", "exec"] } // Read-only
    },
    "fixer": {
      "tools": { "allow": ["read", "write", "edit", "exec"] } // Read-write
    }
  }
}
```

### 4. 監控效能

在代理程式數量較多時，請考量：

- 使用 `"strategy": "parallel"`（預設）以提升速度
- 將廣播群組限制在 5–10 個代理程式
- 為較簡單的代理程式使用較快的模型

### 5. 妥善處理失敗

代理程式會獨立失敗；其中一個代理程式的錯誤不會阻擋其他代理程式：

```
Message → [Agent A ✓, Agent B ✗ error, Agent C ✓]
Result: Agent A and C respond, Agent B logs error
```

## 相容性

### 提供者

廣播群組目前可搭配以下平台使用：

- ✅ WhatsApp（已實作）
- 🚧 Telegram（規劃中）
- 🚧 Discord（規劃中）
- 🚧 Slack（規劃中）

### 路由

廣播群組可與既有路由並行運作：

```json
{
  "bindings": [
    {
      "match": { "channel": "whatsapp", "peer": { "kind": "group", "id": "GROUP_A" } },
      "agentId": "alfred"
    }
  ],
  "broadcast": {
    "GROUP_B": ["agent1", "agent2"]
  }
}
```

- `GROUP_A`：僅 alfred 回覆（一般路由）
- `GROUP_B`：agent1 與 agent2 都會回覆（廣播）

**優先順序：** `broadcast` 的優先權高於 `bindings`。

## 疑難排解

### 代理程式未回應

**檢查：**

1. `agents.list` 中存在代理程式 ID
2. Peer ID 格式正確（例如：`120363403215116621@g.us`）
3. 代理程式未被列入拒絕清單

**除錯：**

```bash
tail -f ~/.openclaw/logs/gateway.log | grep broadcast
```

### 只有一個代理程式回應

**原因：** Peer ID 可能存在於 `bindings`，但不在 `broadcast`。

**解決方式：** 新增至廣播設定，或從綁定中移除。

### 效能問題

**若在代理程式很多時變慢：**

- 減少每個群組的代理程式數量
- 使用較輕量的模型（以 sonnet 取代 opus）
- 檢查沙箱啟動時間

## 範例

### 範例 1：程式碼審查團隊

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": [
      "code-formatter",
      "security-scanner",
      "test-coverage",
      "docs-checker"
    ]
  },
  "agents": {
    "list": [
      {
        "id": "code-formatter",
        "workspace": "~/agents/formatter",
        "tools": { "allow": ["read", "write"] }
      },
      {
        "id": "security-scanner",
        "workspace": "~/agents/security",
        "tools": { "allow": ["read", "exec"] }
      },
      {
        "id": "test-coverage",
        "workspace": "~/agents/testing",
        "tools": { "allow": ["read", "exec"] }
      },
      { "id": "docs-checker", "workspace": "~/agents/docs", "tools": { "allow": ["read"] } }
    ]
  }
}
```

**使用者送出：** 程式碼片段  
**回覆：**

- code-formatter：「已修正縮排並加入型別提示」
- security-scanner：「⚠️ 第 12 行存在 SQL injection 漏洞」
- test-coverage：「覆蓋率為 45%，缺少錯誤情境的測試」
- docs-checker：「函式 `process_data` 缺少說明文件字串」

### 範例 2：多語言支援

```json
{
  "broadcast": {
    "strategy": "sequential",
    "+15555550123": ["detect-language", "translator-en", "translator-de"]
  },
  "agents": {
    "list": [
      { "id": "detect-language", "workspace": "~/agents/lang-detect" },
      { "id": "translator-en", "workspace": "~/agents/translate-en" },
      { "id": "translator-de", "workspace": "~/agents/translate-de" }
    ]
  }
}
```

## API 參考

### 設定結構描述

```typescript
interface OpenClawConfig {
  broadcast?: {
    strategy?: "parallel" | "sequential";
    [peerId: string]: string[];
  };
}
```

### 欄位

- `strategy`（選用）：代理程式的處理方式
  - `"parallel"`（預設）：所有代理程式同時處理
  - `"sequential"`：代理程式依陣列順序處理
- `[peerId]`：WhatsApp 群組 JID、E.164 號碼，或其他 peer ID
  - 值：應處理訊息的代理程式 ID 陣列

## 限制

1. **最大代理程式數：** 無硬性上限，但 10 個以上可能較慢
2. **共用上下文：** 代理程式彼此看不到對方的回覆（設計如此）
3. **訊息順序：** 平行回覆可能以任何順序送達
4. **速率限制：** 所有代理程式都會計入 WhatsApp 的速率限制

## 未來強化

規劃中的功能：

- [ ] 共用上下文模式（代理程式可看到彼此的回覆）
- [ ] 代理程式協調（代理程式可彼此傳遞訊號）
- [ ] 動態代理程式選擇（依訊息內容選擇代理程式）
- [ ] 代理程式優先順序（部分代理程式先於其他代理程式回覆）

## 另請參閱

- [多代理程式設定](/tools/multi-agent-sandbox-tools)
- [路由設定](/channels/channel-routing)
- [工作階段管理](/concepts/sessions)
