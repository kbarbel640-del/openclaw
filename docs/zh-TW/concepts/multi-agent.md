---
summary: "多代理程式路由：隔離的代理程式、頻道帳戶與繫結"
title: 多代理程式路由
read_when: "你想在一個 Gateway 處理程序中使用多個彼此隔離的代理程式（工作區 + 驗證）。"
status: active
x-i18n:
  source_path: concepts/multi-agent.md
  source_hash: 49b3ba55d8a7f0b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:12Z
---

# 多代理程式路由

目標：在一個正在執行的 Gateway 中，同時運行多個「**隔離的**」代理程式（獨立的工作區 + `agentDir` + 工作階段），以及多個頻道帳戶（例如兩個 WhatsApp）。入站訊息會透過繫結被路由到指定的代理程式。

## 什麼是「一個代理程式」？

**代理程式** 是一個完整範圍的「大腦」，擁有自己的：

- **工作區**（檔案、AGENTS.md / SOUL.md / USER.md、本地筆記、角色規則）。
- **狀態目錄**（`agentDir`），用於驗證設定檔、模型登錄與每個代理程式的設定。
- **工作階段儲存**（聊天記錄 + 路由狀態），位於 `~/.openclaw/agents/<agentId>/sessions` 之下。

驗證設定檔是**每個代理程式各自獨立**的。每個代理程式都會從自己的：

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

主代理程式的憑證**不會**自動共用。請勿在代理程式之間重複使用 `agentDir`（這會造成驗證 / 工作階段衝突）。如果你想共用憑證，請將 `auth-profiles.json` 複製到另一個代理程式的 `agentDir`。

Skills 以每個代理程式為單位，透過各自工作區的 `skills/` 資料夾提供；共用的 Skills 則可從 `~/.openclaw/skills` 取得。請參閱 [Skills：每代理程式 vs 共用](/tools/skills#per-agent-vs-shared-skills)。

Gateway 可以同時承載**一個代理程式**（預設）或**多個代理程式**並排運行。

**工作區注意事項：** 每個代理程式的工作區是**預設的 cwd**，而不是硬性沙箱。相對路徑會在工作區內解析，但絕對路徑仍可能存取主機上的其他位置，除非啟用沙箱隔離。請參閱
[沙箱隔離](/gateway/sandboxing)。

## 路徑（快速對照）

- 設定：`~/.openclaw/openclaw.json`（或 `OPENCLAW_CONFIG_PATH`）
- 狀態目錄：`~/.openclaw`（或 `OPENCLAW_STATE_DIR`）
- 工作區：`~/.openclaw/workspace`（或 `~/.openclaw/workspace-<agentId>`）
- 代理程式目錄：`~/.openclaw/agents/<agentId>/agent`（或 `agents.list[].agentDir`）
- 工作階段：`~/.openclaw/agents/<agentId>/sessions`

### 單一代理程式模式（預設）

如果你什麼都不做，OpenClaw 會以單一代理程式執行：

- `agentId` 預設為 **`main`**。
- 工作階段以 `agent:main:<mainKey>` 作為鍵值。
- 工作區預設為 `~/.openclaw/workspace`（當設定 `OPENCLAW_PROFILE` 時則為 `~/.openclaw/workspace-<profile>`）。
- 狀態目錄預設為 `~/.openclaw/agents/main/agent`。

## 代理程式輔助工具

使用代理程式精靈來新增一個隔離的代理程式：

```bash
openclaw agents add work
```

接著新增 `bindings`（或讓精靈自動完成）以路由入站訊息。

使用以下方式驗證：

```bash
openclaw agents list --bindings
```

## 多個代理程式 = 多個人、多種人格

在**多代理程式**的情況下，每個 `agentId` 都會成為一個**完全隔離的人格**：

- **不同的電話號碼 / 帳戶**（每個頻道 `accountId`）。
- **不同的個性**（每個代理程式的工作區檔案，如 `AGENTS.md` 與 `SOUL.md`）。
- **獨立的驗證 + 工作階段**（除非明確啟用，否則不會互相干擾）。

這讓**多個人**可以共用一台 Gateway 伺服器，同時保持各自的 AI「大腦」與資料彼此隔離。

## 一個 WhatsApp 號碼，多個人（私訊分流）

你可以在**單一 WhatsApp 帳戶**下，將**不同的 WhatsApp 私訊**路由到不同的代理程式。透過 `peer.kind: "dm"` 依發送者的 E.164（例如 `+15551234567`）進行比對。回覆仍會由同一個 WhatsApp 號碼送出（沒有每代理程式的發送者身分）。

重要細節：直接聊天會折疊到代理程式的**主要工作階段鍵值**，因此要達到真正的隔離，必須為**每個人配置一個代理程式**。

範例：

```json5
{
  agents: {
    list: [
      { id: "alex", workspace: "~/.openclaw/workspace-alex" },
      { id: "mia", workspace: "~/.openclaw/workspace-mia" },
    ],
  },
  bindings: [
    { agentId: "alex", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230001" } } },
    { agentId: "mia", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230002" } } },
  ],
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551230001", "+15551230002"],
    },
  },
}
```

注意事項：

- 私訊存取控制是**每個 WhatsApp 帳戶的全域設定**（配對 / 允許清單），不是每個代理程式。
- 對於共用群組，請將該群組繫結到單一代理程式，或使用 [廣播群組](/broadcast-groups)。

## 路由規則（訊息如何選擇代理程式）

繫結是**具決定性**的，且**最具體者優先**：

1. `peer` 比對（精確的 私訊 / 群組 / 頻道 id）
2. `guildId`（Discord）
3. `teamId`（Slack）
4. 某頻道的 `accountId` 比對
5. 頻道層級比對（`accountId: "*"`）
6. 回退到預設代理程式（`agents.list[].default`，否則取清單中的第一個，預設：`main`）

## 多個帳戶 / 電話號碼

支援**多帳戶**的頻道（例如 WhatsApp）會使用 `accountId` 來識別每次登入。每個 `accountId` 都可以被路由到不同的代理程式，因此一台伺服器就能承載多個電話號碼而不混淆工作階段。

## 概念

- `agentId`：一個「大腦」（工作區、每代理程式驗證、每代理程式工作階段儲存）。
- `accountId`：一個頻道帳戶實例（例如 WhatsApp 帳戶 `"personal"` 與 `"biz"`）。
- `binding`：依 `(channel, accountId, peer)`（以及選用的公會 / 團隊 id）將入站訊息路由到某個 `agentId`。
- 直接聊天會折疊到 `agent:<agentId>:<mainKey>`（每代理程式的「主要」；`session.mainKey`）。

## 範例：兩個 WhatsApp → 兩個代理程式

`~/.openclaw/openclaw.json`（JSON5）：

```js
{
  agents: {
    list: [
      {
        id: "home",
        default: true,
        name: "Home",
        workspace: "~/.openclaw/workspace-home",
        agentDir: "~/.openclaw/agents/home/agent",
      },
      {
        id: "work",
        name: "Work",
        workspace: "~/.openclaw/workspace-work",
        agentDir: "~/.openclaw/agents/work/agent",
      },
    ],
  },

  // Deterministic routing: first match wins (most-specific first).
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } },

    // Optional per-peer override (example: send a specific group to work agent).
    {
      agentId: "work",
      match: {
        channel: "whatsapp",
        accountId: "personal",
        peer: { kind: "group", id: "1203630...@g.us" },
      },
    },
  ],

  // Off by default: agent-to-agent messaging must be explicitly enabled + allowlisted.
  tools: {
    agentToAgent: {
      enabled: false,
      allow: ["home", "work"],
    },
  },

  channels: {
    whatsapp: {
      accounts: {
        personal: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/personal
          // authDir: "~/.openclaw/credentials/whatsapp/personal",
        },
        biz: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/biz
          // authDir: "~/.openclaw/credentials/whatsapp/biz",
        },
      },
    },
  },
}
```

## 範例：WhatsApp 日常聊天 + Telegram 深度工作

依頻道分流：將 WhatsApp 路由到快速的日常代理程式，將 Telegram 路由到 Opus 代理程式。

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },
    { agentId: "opus", match: { channel: "telegram" } },
  ],
}
```

注意事項：

- 如果某個頻道有多個帳戶，請在繫結中加入 `accountId`（例如 `{ channel: "whatsapp", accountId: "personal" }`）。
- 若要將單一 私訊 / 群組 路由到 Opus，同時其餘維持在聊天代理程式，請為該對象新增一個 `match.peer` 繫結；對象比對永遠優先於頻道層級規則。

## 範例：相同頻道，單一對象路由到 Opus

讓 WhatsApp 保持在快速代理程式，但將其中一個私訊路由到 Opus：

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "opus", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551234567" } } },
    { agentId: "chat", match: { channel: "whatsapp" } },
  ],
}
```

對象繫結永遠優先，因此請將它們放在頻道層級規則之上。

## 綁定到 WhatsApp 群組的家庭代理程式

將一個專用的家庭代理程式繫結到單一 WhatsApp 群組，並啟用提及門檻與更嚴格的工具政策：

```json5
{
  agents: {
    list: [
      {
        id: "family",
        name: "Family",
        workspace: "~/.openclaw/workspace-family",
        identity: { name: "Family Bot" },
        groupChat: {
          mentionPatterns: ["@family", "@familybot", "@Family Bot"],
        },
        sandbox: {
          mode: "all",
          scope: "agent",
        },
        tools: {
          allow: [
            "exec",
            "read",
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "session_status",
          ],
          deny: ["write", "edit", "apply_patch", "browser", "canvas", "nodes", "cron"],
        },
      },
    ],
  },
  bindings: [
    {
      agentId: "family",
      match: {
        channel: "whatsapp",
        peer: { kind: "group", id: "120363999999999999@g.us" },
      },
    },
  ],
}
```

注意事項：

- 工具允許 / 拒絕清單屬於**工具**，不是 Skills。若某個 Skill 需要執行二進位檔，請確保允許 `exec`，且該二進位檔存在於沙箱中。
- 若需要更嚴格的門檻，請設定 `agents.list[].groupChat.mentionPatterns`，並保持該頻道的群組允許清單為啟用狀態。

## 每代理程式的沙箱與工具設定

自 v2026.1.6 起，每個代理程式都可以擁有自己的沙箱與工具限制：

```js
{
  agents: {
    list: [
      {
        id: "personal",
        workspace: "~/.openclaw/workspace-personal",
        sandbox: {
          mode: "off",  // No sandbox for personal agent
        },
        // No tool restrictions - all tools available
      },
      {
        id: "family",
        workspace: "~/.openclaw/workspace-family",
        sandbox: {
          mode: "all",     // Always sandboxed
          scope: "agent",  // One container per agent
          docker: {
            // Optional one-time setup after container creation
            setupCommand: "apt-get update && apt-get install -y git curl",
          },
        },
        tools: {
          allow: ["read"],                    // Only read tool
          deny: ["exec", "write", "edit", "apply_patch"],    // Deny others
        },
      },
    ],
  },
}
```

注意：`setupCommand` 位於 `sandbox.docker` 之下，並且只在容器建立時執行一次。當解析後的範圍為 `"shared"` 時，會忽略每代理程式的 `sandbox.docker.*` 覆寫。

**好處：**

- **安全隔離**：為不受信任的代理程式限制工具
- **資源控管**：僅將特定代理程式置於沙箱中，其他仍在主機上執行
- **彈性政策**：每個代理程式可套用不同的權限

注意：`tools.elevated` 是**全域**且以發送者為基礎；無法針對單一代理程式設定。
如果你需要每代理程式的邊界，請使用 `agents.list[].tools` 來拒絕 `exec`。
若要針對群組，請使用 `agents.list[].groupChat.mentionPatterns`，讓 @提及能清楚對應到預期的代理程式。

請參閱 [多代理程式沙箱與工具](/multi-agent-sandbox-tools) 以取得詳細範例。
