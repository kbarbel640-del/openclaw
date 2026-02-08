---
title: 沙箱 vs 工具政策 vs Elevated
summary: 「為什麼工具會被阻擋：沙箱執行階段、工具允許/拒絕政策，以及 Elevated 執行閘門」
read_when: 「你遇到「sandbox jail」或看到工具/Elevated 被拒絕，並且想知道要修改的確切設定金鑰時。」
status: active
x-i18n:
  source_path: gateway/sandbox-vs-tool-policy-vs-elevated.md
  source_hash: 863ea5e6d137dfb6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:37Z
---

# 沙箱 vs 工具政策 vs Elevated

OpenClaw 有三個相關（但不同）的控制機制：

1. **沙箱**（`agents.defaults.sandbox.*` / `agents.list[].sandbox.*`）決定 **工具在哪裡執行**（Docker vs 主機）。
2. **工具政策**（`tools.*`、`tools.sandbox.tools.*`、`agents.list[].tools.*`）決定 **哪些工具可用/被允許**。
3. **Elevated**（`tools.elevated.*`、`agents.list[].tools.elevated.*`）是在你處於沙箱時，用於在主機上執行的 **僅限 exec 的逃生艙**。

## 快速除錯

使用檢查器查看 OpenClaw _實際上_ 在做什麼：

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

它會輸出：

- 有效的沙箱模式/範圍/工作區存取
- 工作階段目前是否被沙箱化（主工作階段 vs 非主工作階段）
- 有效的沙箱工具允許/拒絕（以及其來源是 agent/全域/預設）
- Elevated 閘門與修復用的金鑰路徑

## 沙箱：工具在哪裡執行

沙箱隔離由 `agents.defaults.sandbox.mode` 控制：

- `"off"`：所有內容都在主機上執行。
- `"non-main"`：只有非主工作階段會被沙箱化（對群組/頻道而言常見的「意外」）。
- `"all"`：所有內容都被沙箱化。

完整矩陣（範圍、工作區掛載、映像）請參閱 [Sandboxing](/gateway/sandboxing)。

### Bind mounts（安全性快速檢查）

- `docker.binds` 會「穿透」沙箱檔案系統：你掛載的任何內容都會以你設定的模式（`:ro` 或 `:rw`）在容器內可見。
- 若省略模式，預設為可讀寫；對於原始碼/祕密資訊，建議使用 `:ro`。
- `scope: "shared"` 會忽略每個 agent 的綁定（僅套用全域綁定）。
- 綁定 `/var/run/docker.sock` 等同於將主機控制權交給沙箱；請僅在刻意為之時使用。
- 工作區存取（`workspaceAccess: "ro"`/`"rw"`）與綁定模式是相互獨立的。

## 工具政策：哪些工具存在/可被呼叫

有兩層需要注意：

- **工具設定檔**：`tools.profile` 與 `agents.list[].tools.profile`（基礎允許清單）
- **提供者工具設定檔**：`tools.byProvider[provider].profile` 與 `agents.list[].tools.byProvider[provider].profile`
- **全域/每個 agent 的工具政策**：`tools.allow`/`tools.deny` 與 `agents.list[].tools.allow`/`agents.list[].tools.deny`
- **提供者工具政策**：`tools.byProvider[provider].allow/deny` 與 `agents.list[].tools.byProvider[provider].allow/deny`
- **沙箱工具政策**（僅在沙箱化時套用）：`tools.sandbox.tools.allow`/`tools.sandbox.tools.deny` 與 `agents.list[].tools.sandbox.tools.*`

經驗法則：

- `deny` 永遠優先。
- 如果 `allow` 非空，其餘所有項目都會被視為已封鎖。
- 工具政策是硬性停止點：`/exec` 無法覆寫被拒絕的 `exec` 工具。
- `/exec` 只會為已授權的傳送者變更工作階段預設值；它不會授予工具存取權。
  提供者工具金鑰可接受 `provider`（例如 `google-antigravity`）或 `provider/model`（例如 `openai/gpt-5.2`）。

### 工具群組（簡寫）

工具政策（全域、agent、沙箱）支援 `group:*` 項目，會展開為多個工具：

```json5
{
  tools: {
    sandbox: {
      tools: {
        allow: ["group:runtime", "group:fs", "group:sessions", "group:memory"],
      },
    },
  },
}
```

可用的群組：

- `group:runtime`：`exec`、`bash`、`process`
- `group:fs`：`read`、`write`、`edit`、`apply_patch`
- `group:sessions`：`sessions_list`、`sessions_history`、`sessions_send`、`sessions_spawn`、`session_status`
- `group:memory`：`memory_search`、`memory_get`
- `group:ui`：`browser`、`canvas`
- `group:automation`：`cron`、`gateway`
- `group:messaging`：`message`
- `group:nodes`：`nodes`
- `group:openclaw`：所有內建的 OpenClaw 工具（不含提供者外掛）

## Elevated：僅限 exec 的「在主機上執行」

Elevated **不會** 授予額外工具；它只影響 `exec`。

- 若你處於沙箱中，`/elevated on`（或搭配 `elevated: true` 的 `exec`）會在主機上執行（仍可能需要核准）。
- 使用 `/elevated full` 可在該工作階段中略過 exec 核准。
- 如果你已經是直接執行，Elevated 實際上是 no-op（仍受閘門限制）。
- Elevated **不是** 以 Skills 為範圍，且 **不會** 覆寫工具的允許/拒絕。
- `/exec` 與 Elevated 分開。它只會為已授權的傳送者調整每個工作階段的 exec 預設值。

閘門：

- 啟用：`tools.elevated.enabled`（以及選用的 `agents.list[].tools.elevated.enabled`）
- 傳送者允許清單：`tools.elevated.allowFrom.<provider>`（以及選用的 `agents.list[].tools.elevated.allowFrom.<provider>`）

請參閱 [Elevated Mode](/tools/elevated)。

## 常見的「sandbox jail」修復方式

### 「工具 X 被沙箱工具政策封鎖」

修復用金鑰（擇一）：

- 停用沙箱：`agents.defaults.sandbox.mode=off`（或每個 agent 的 `agents.list[].sandbox.mode=off`）
- 在沙箱內允許該工具：
  - 從 `tools.sandbox.tools.deny` 移除（或每個 agent 的 `agents.list[].tools.sandbox.tools.deny`）
  - 或將其加入 `tools.sandbox.tools.allow`（或每個 agent 的允許清單）

### 「我以為這是主工作階段，為什麼被沙箱化？」

在 `"non-main"` 模式中，群組/頻道金鑰 _不是_ 主工作階段。請使用主工作階段金鑰（由 `sandbox explain` 顯示），或將模式切換為 `"off"`。
