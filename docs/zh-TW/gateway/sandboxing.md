---
summary: "OpenClaw 沙箱隔離的運作方式：模式、範圍、工作區存取與映像"
title: 沙箱隔離
read_when: "當你需要專門的沙箱隔離說明，或需要調整 agents.defaults.sandbox 時。"
status: active
x-i18n:
  source_path: gateway/sandboxing.md
  source_hash: 184fc53001fc6b28
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:42Z
---

# 沙箱隔離

OpenClaw 可以在 **Docker 容器內執行工具**，以降低影響範圍。
這是 **選用** 功能，並由設定控制（`agents.defaults.sandbox` 或
`agents.list[].sandbox`）。若關閉沙箱隔離，工具會在主機上執行。
Gateway 閘道器 會留在主機上；啟用時，工具執行會在隔離的沙箱中進行。

這不是完美的安全邊界，但當模型做出不當行為時，能實質限制檔案系統
與行程的存取。

## 什麼會被沙箱隔離

- 工具執行（`exec`、`read`、`write`、`edit`、`apply_patch`、`process` 等）。
- 選用的沙箱隔離瀏覽器（`agents.defaults.sandbox.browser`）。
  - 預設情況下，當瀏覽器工具需要時，沙箱瀏覽器會自動啟動（確保 CDP 可連線）。
    透過 `agents.defaults.sandbox.browser.autoStart` 與 `agents.defaults.sandbox.browser.autoStartTimeoutMs` 設定。
  - `agents.defaults.sandbox.browser.allowHostControl` 允許沙箱隔離的工作階段明確指向主機瀏覽器。
  - 選用的允許清單用於管控 `target: "custom"`：`allowedControlUrls`、`allowedControlHosts`、`allowedControlPorts`。

不進行沙箱隔離：

- Gateway 閘道器 程序本身。
- 任何被明確允許在主機上執行的工具（例如 `tools.elevated`）。
  - **提升權限的 exec 會在主機上執行並繞過沙箱隔離。**
  - 若關閉沙箱隔離，`tools.elevated` 不會改變執行位置（本來就在主機上）。請參見 [Elevated Mode](/tools/elevated)。

## 模式

`agents.defaults.sandbox.mode` 控制 **何時** 使用沙箱隔離：

- `"off"`：不使用沙箱隔離。
- `"non-main"`：只對 **非主要** 工作階段進行沙箱隔離（若你希望一般聊天在主機上執行，這是預設）。
- `"all"`：每個工作階段都在沙箱中執行。
  注意：`"non-main"` 是基於 `session.mainKey`（預設為 `"main"`），而非代理程式 id。
  群組／頻道工作階段使用各自的金鑰，因此會被視為非主要並進行沙箱隔離。

## 範圍

`agents.defaults.sandbox.scope` 控制 **會建立多少容器**：

- `"session"`（預設）：每個工作階段一個容器。
- `"agent"`：每個代理程式一個容器。
- `"shared"`：所有沙箱隔離的工作階段共用一個容器。

## 工作區存取

`agents.defaults.sandbox.workspaceAccess` 控制 **沙箱能看到什麼**：

- `"none"`（預設）：工具會看到位於 `~/.openclaw/sandboxes` 下的沙箱工作區。
- `"ro"`：以唯讀方式將代理程式工作區掛載到 `/agent`（會停用 `write`/`edit`/`apply_patch`）。
- `"rw"`：以讀寫方式將代理程式工作區掛載到 `/workspace`。

傳入的媒體會被複製到作用中的沙箱工作區（`media/inbound/*`）。
Skills 注意事項：`read` 工具以沙箱根目錄為基準。搭配 `workspaceAccess: "none"`，
OpenClaw 會將符合條件的 Skills 映射到沙箱工作區（`.../skills`）以供讀取。
使用 `"rw"` 時，工作區的 Skills 可從 `/workspace/skills` 讀取。

## 自訂綁定掛載

`agents.defaults.sandbox.docker.binds` 會將額外的主機目錄掛載到容器中。
格式：`host:container:mode`（例如 `"/home/user/source:/source:rw"`）。

全域與每個代理程式的綁定會 **合併**（而非取代）。在 `scope: "shared"` 之下，會忽略每個代理程式的綁定。

範例（唯讀來源 + docker socket）：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        docker: {
          binds: ["/home/user/source:/source:ro", "/var/run/docker.sock:/var/run/docker.sock"],
        },
      },
    },
    list: [
      {
        id: "build",
        sandbox: {
          docker: {
            binds: ["/mnt/cache:/cache:rw"],
          },
        },
      },
    ],
  },
}
```

安全性注意事項：

- 綁定會繞過沙箱檔案系統：它們會以你設定的模式暴露主機路徑（`:ro` 或 `:rw`）。
- 敏感掛載（例如 `docker.sock`、機密、SSH 金鑰）除非絕對必要，否則應為 `:ro`。
- 若你只需要對工作區的讀取權限，請搭配 `workspaceAccess: "ro"`；綁定模式彼此獨立。
- 綁定如何與工具政策與提升權限的 exec 互動，請參見 [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)。

## 映像 + 設定

預設映像：`openclaw-sandbox:bookworm-slim`

建置一次即可：

```bash
scripts/sandbox-setup.sh
```

注意：預設映像 **不** 包含 Node。若某個 Skill 需要 Node（或
其他執行階段），請改用自訂映像，或透過
`sandbox.docker.setupCommand` 安裝（需要網路對外連線 + 可寫入的 root +
root 使用者）。

沙箱隔離瀏覽器映像：

```bash
scripts/sandbox-browser-setup.sh
```

預設情況下，沙箱容器以 **無網路** 執行。
可透過 `agents.defaults.sandbox.docker.network` 覆寫。

Docker 的安裝與容器化的 Gateway 閘道器 位於此：
[Docker](/install/docker)

## setupCommand（一次性的容器設定）

`setupCommand` 會在建立沙箱容器後 **只執行一次**（不會在每次執行時執行）。
它會透過 `sh -lc` 在容器內執行。

路徑：

- 全域：`agents.defaults.sandbox.docker.setupCommand`
- 每個代理程式：`agents.list[].sandbox.docker.setupCommand`

常見陷阱：

- 預設 `docker.network` 為 `"none"`（無對外連線），因此套件安裝會失敗。
- `readOnlyRoot: true` 會阻止寫入；請設定 `readOnlyRoot: false` 或製作自訂映像。
- 套件安裝需要 `user` 為 root（省略 `user` 或設定 `user: "0:0"`）。
- 沙箱內的 exec **不會** 繼承主機的 `process.env`。請使用
  `agents.defaults.sandbox.docker.env`（或自訂映像）提供 Skill 的 API 金鑰。

## 工具政策 + 逃生出口

在套用沙箱規則之前，工具的允許／拒絕政策仍然會先行生效。若某個工具在全域或每個代理程式層級被拒絕，沙箱隔離不會將其恢復。

`tools.elevated` 是明確的逃生出口，會在主機上執行 `exec`。
`/exec` 指令僅適用於已授權的傳送者，並會在每個工作階段中持續存在；若要硬性停用
`exec`，請使用工具政策的拒絕（請參見 [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)）。

除錯：

- 使用 `openclaw sandbox explain` 檢視實際生效的沙箱模式、工具政策，以及修正用的設定金鑰。
- 關於「為什麼被阻擋？」的思考模型，請參見 [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)。
  請保持嚴格鎖定。

## 多代理程式覆寫

每個代理程式都可以覆寫沙箱 + 工具：
`agents.list[].sandbox` 與 `agents.list[].tools`（以及 `agents.list[].tools.sandbox.tools` 作為沙箱工具政策）。
優先順序請參見 [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)。

## 最小啟用範例

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
      },
    },
  },
}
```

## 相關文件

- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)
- [Security](/gateway/security)
