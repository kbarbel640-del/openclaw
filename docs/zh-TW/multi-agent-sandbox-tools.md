---
summary: 「每個代理程式的沙箱 + 工具限制、優先順序與範例」
title: 多代理程式沙箱與工具
read_when: 「當你在多代理程式 Gateway 閘道器中需要每個代理程式的沙箱隔離或工具允許 / 拒絕策略時。」
status: active
x-i18n:
  source_path: multi-agent-sandbox-tools.md
  source_hash: f602cb6192b84b40
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:58Z
---

# 多代理程式沙箱與工具設定

## 概覽

在多代理程式設定中，每個代理程式現在都可以擁有自己的：

- **沙箱設定**（`agents.list[].sandbox` 覆寫 `agents.defaults.sandbox`）
- **工具限制**（`tools.allow` / `tools.deny`，以及 `agents.list[].tools`）

這讓你可以以不同的安全設定檔執行多個代理程式：

- 具備完整存取權限的個人助理
- 具有限制工具的家庭 / 工作代理程式
- 在沙箱中執行的對外公開代理程式

`setupCommand` 屬於 `sandbox.docker`（全域或每個代理程式），並且只會在建立容器時執行一次。

驗證是以代理程式為單位：每個代理程式都會從自己的 `agentDir` 驗證儲存區讀取，位置在：

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

認證資訊 **不會** 在代理程式之間共用。請勿在不同代理程式之間重複使用 `agentDir`。
如果你想要共用憑證，請將 `auth-profiles.json` 複製到另一個代理程式的 `agentDir` 中。

關於沙箱在執行階段的行為，請參閱 [Sandboxing](/gateway/sandboxing)。
若要除錯「為什麼這個被阻擋？」，請參閱 [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) 與 `openclaw sandbox explain`。

---

## 設定範例

### 範例 1：個人 + 受限制的家庭代理程式

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "name": "Personal Assistant",
        "workspace": "~/.openclaw/workspace",
        "sandbox": { "mode": "off" }
      },
      {
        "id": "family",
        "name": "Family Bot",
        "workspace": "~/.openclaw/workspace-family",
        "sandbox": {
          "mode": "all",
          "scope": "agent"
        },
        "tools": {
          "allow": ["read"],
          "deny": ["exec", "write", "edit", "apply_patch", "process", "browser"]
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "family",
      "match": {
        "provider": "whatsapp",
        "accountId": "*",
        "peer": {
          "kind": "group",
          "id": "120363424282127706@g.us"
        }
      }
    }
  ]
}
```

**結果：**

- `main` 代理程式：在主機上執行，具備完整工具存取權
- `family` 代理程式：在 Docker 中執行（每個代理程式一個容器），僅允許 `read` 工具

---

### 範例 2：共用沙箱的工作代理程式

```json
{
  "agents": {
    "list": [
      {
        "id": "personal",
        "workspace": "~/.openclaw/workspace-personal",
        "sandbox": { "mode": "off" }
      },
      {
        "id": "work",
        "workspace": "~/.openclaw/workspace-work",
        "sandbox": {
          "mode": "all",
          "scope": "shared",
          "workspaceRoot": "/tmp/work-sandboxes"
        },
        "tools": {
          "allow": ["read", "write", "apply_patch", "exec"],
          "deny": ["browser", "gateway", "discord"]
        }
      }
    ]
  }
}
```

---

### 範例 2b：全域程式設計設定檔 + 僅限訊息的代理程式

```json
{
  "tools": { "profile": "coding" },
  "agents": {
    "list": [
      {
        "id": "support",
        "tools": { "profile": "messaging", "allow": ["slack"] }
      }
    ]
  }
}
```

**結果：**

- 預設代理程式取得程式設計工具
- `support` 代理程式僅限訊息功能（+ Slack 工具）

---

### 範例 3：每個代理程式使用不同的沙箱模式

```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main", // Global default
        "scope": "session"
      }
    },
    "list": [
      {
        "id": "main",
        "workspace": "~/.openclaw/workspace",
        "sandbox": {
          "mode": "off" // Override: main never sandboxed
        }
      },
      {
        "id": "public",
        "workspace": "~/.openclaw/workspace-public",
        "sandbox": {
          "mode": "all", // Override: public always sandboxed
          "scope": "agent"
        },
        "tools": {
          "allow": ["read"],
          "deny": ["exec", "write", "edit", "apply_patch"]
        }
      }
    ]
  }
}
```

---

## 設定優先順序

當同時存在全域（`agents.defaults.*`）與代理程式專屬（`agents.list[].*`）設定時：

### 沙箱設定

代理程式專屬設定會覆寫全域設定：

```
agents.list[].sandbox.mode > agents.defaults.sandbox.mode
agents.list[].sandbox.scope > agents.defaults.sandbox.scope
agents.list[].sandbox.workspaceRoot > agents.defaults.sandbox.workspaceRoot
agents.list[].sandbox.workspaceAccess > agents.defaults.sandbox.workspaceAccess
agents.list[].sandbox.docker.* > agents.defaults.sandbox.docker.*
agents.list[].sandbox.browser.* > agents.defaults.sandbox.browser.*
agents.list[].sandbox.prune.* > agents.defaults.sandbox.prune.*
```

**注意事項：**

- `agents.list[].sandbox.{docker,browser,prune}.*` 會覆寫該代理程式的 `agents.defaults.sandbox.{docker,browser,prune}.*`（當沙箱範圍解析為 `"shared"` 時會被忽略）。

### 工具限制

過濾順序如下：

1. **工具設定檔**（`tools.profile` 或 `agents.list[].tools.profile`）
2. **提供者工具設定檔**（`tools.byProvider[provider].profile` 或 `agents.list[].tools.byProvider[provider].profile`）
3. **全域工具政策**（`tools.allow` / `tools.deny`）
4. **提供者工具政策**（`tools.byProvider[provider].allow/deny`）
5. **代理程式專屬工具政策**（`agents.list[].tools.allow/deny`）
6. **代理程式提供者政策**（`agents.list[].tools.byProvider[provider].allow/deny`）
7. **沙箱工具政策**（`tools.sandbox.tools` 或 `agents.list[].tools.sandbox.tools`）
8. **子代理程式工具政策**（`tools.subagents.tools`，若適用）

每一層都只能進一步限制工具，無法重新允許先前層級已拒絕的工具。
如果設定了 `agents.list[].tools.sandbox.tools`，它會取代該代理程式的 `tools.sandbox.tools`。
如果設定了 `agents.list[].tools.profile`，它會覆寫該代理程式的 `tools.profile`。
提供者工具金鑰可接受 `provider`（例如 `google-antigravity`）或 `provider/model`（例如 `openai/gpt-5.2`）。

### 工具群組（簡寫）

工具政策（全域、代理程式、沙箱）支援 `group:*` 項目，會展開為多個具體工具：

- `group:runtime`：`exec`、`bash`、`process`
- `group:fs`：`read`、`write`、`edit`、`apply_patch`
- `group:sessions`：`sessions_list`、`sessions_history`、`sessions_send`、`sessions_spawn`、`session_status`
- `group:memory`：`memory_search`、`memory_get`
- `group:ui`：`browser`、`canvas`
- `group:automation`：`cron`、`gateway`
- `group:messaging`：`message`
- `group:nodes`：`nodes`
- `group:openclaw`：所有內建的 OpenClaw 工具（不包含提供者外掛）

### Elevated 模式

`tools.elevated` 是全域基準（以傳送者為基礎的允許清單）。`agents.list[].tools.elevated` 可以進一步限制特定代理程式的 Elevated（兩者都必須允許）。

緩解模式：

- 對不受信任的代理程式拒絕 `exec`（`agents.list[].tools.deny: ["exec"]`）
- 避免將允許清單中的傳送者路由到受限制的代理程式
- 若只想要沙箱執行，請在全域停用 Elevated（`tools.elevated.enabled: false`）
- 對敏感設定檔，逐一代理程式停用 Elevated（`agents.list[].tools.elevated.enabled: false`）

---

## 從單一代理程式遷移

**之前（單一代理程式）：**

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "sandbox": {
        "mode": "non-main"
      }
    }
  },
  "tools": {
    "sandbox": {
      "tools": {
        "allow": ["read", "write", "apply_patch", "exec"],
        "deny": []
      }
    }
  }
}
```

**之後（多代理程式，具有不同設定檔）：**

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "default": true,
        "workspace": "~/.openclaw/workspace",
        "sandbox": { "mode": "off" }
      }
    ]
  }
}
```

舊版 `agent.*` 設定會由 `openclaw doctor` 進行遷移；未來請優先使用 `agents.defaults` + `agents.list`。

---

## 工具限制範例

### 唯讀代理程式

```json
{
  "tools": {
    "allow": ["read"],
    "deny": ["exec", "write", "edit", "apply_patch", "process"]
  }
}
```

### 安全執行代理程式（不修改檔案）

```json
{
  "tools": {
    "allow": ["read", "exec", "process"],
    "deny": ["write", "edit", "apply_patch", "browser", "gateway"]
  }
}
```

### 僅限通訊的代理程式

```json
{
  "tools": {
    "allow": ["sessions_list", "sessions_send", "sessions_history", "session_status"],
    "deny": ["exec", "write", "edit", "apply_patch", "read", "browser"]
  }
}
```

---

## 常見陷阱：「non-main」

`agents.defaults.sandbox.mode: "non-main"` 是基於 `session.mainKey`（預設為 `"main"`），
而不是代理程式 id。群組 / 頻道的工作階段一律會取得自己的金鑰，
因此會被視為 non-main 並套用沙箱隔離。如果你希望某個代理程式永遠不進入沙箱，請設定 `agents.list[].sandbox.mode: "off"`。

---

## 測試

在設定多代理程式沙箱與工具之後：

1. **檢查代理程式解析：**

   ```exec
   openclaw agents list --bindings
   ```

2. **確認沙箱容器：**

   ```exec
   docker ps --filter "name=openclaw-sbx-"
   ```

3. **測試工具限制：**
   - 傳送一則需要受限制工具的訊息
   - 確認代理程式無法使用被拒絕的工具

4. **監控日誌：**
   ```exec
   tail -f "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/logs/gateway.log" | grep -E "routing|sandbox|tools"
   ```

---

## 疑難排解

### 即使設定了 `mode: "all"`，代理程式仍未進入沙箱

- 檢查是否有全域的 `agents.defaults.sandbox.mode` 覆寫了它
- 代理程式專屬設定具有優先權，因此請設定 `agents.list[].sandbox.mode: "all"`

### 即使在拒絕清單中，工具仍然可用

- 檢查工具過濾順序：全域 → 代理程式 → 沙箱 → 子代理程式
- 每一層只能進一步限制，無法重新允許
- 透過日誌驗證：`[tools] filtering tools for agent:${agentId}`

### 容器未針對每個代理程式隔離

- 在代理程式專屬沙箱設定中設定 `scope: "agent"`
- 預設為 `"session"`，會為每個工作階段建立一個容器

---

## 另請參閱

- [Multi-Agent Routing](/concepts/multi-agent)
- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Session Management](/concepts/session)
