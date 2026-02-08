---
summary: 「Exec 核准、允許清單與沙箱逃逸提示」
read_when:
  - 設定 Exec 核准或允許清單
  - 在 macOS 應用程式中實作 Exec 核准 UX
  - 檢視沙箱逃逸提示及其影響
title: 「Exec 核准」
x-i18n:
  source_path: tools/exec-approvals.md
  source_hash: 97736427752eb905
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:11Z
---

# Exec 核准

Exec 核准是 **配套應用程式 / 節點主機的防護機制**，用於允許沙箱隔離的代理程式在真實主機上執行
指令（`gateway` 或 `node`）。可將其視為一種安全聯鎖：
只有在「政策 + 允許清單 +（可選）使用者核准」全部同意時，指令才會被允許。
Exec 核准是 **額外** 疊加於工具政策與 elevated 閘控之上（除非 elevated 設為 `full`，此時會略過核准）。
實際生效的政策是 `tools.exec.*` 與核准預設值中 **較嚴格** 的那一個；若省略某個核准欄位，則使用 `tools.exec` 的值。

若配套應用程式 UI **不可用**，任何需要提示的請求都會
由 **詢問後備機制** 解決（預設：拒絕）。

## 適用位置

Exec 核准會在執行主機本機強制套用：

- **gateway 主機** → Gateway 機器上的 `openclaw` 程序
- **節點主機** → 節點執行器（macOS 配套應用程式或無頭節點主機）

macOS 分工：

- **節點主機服務** 透過本機 IPC 將 `system.run` 轉送至 **macOS 應用程式**。
- **macOS 應用程式** 負責強制核准 + 在 UI 內容中執行指令。

## 設定與儲存

核准設定會儲存在執行主機上的本機 JSON 檔案中：

`~/.openclaw/exec-approvals.json`

範例結構描述：

```json
{
  "version": 1,
  "socket": {
    "path": "~/.openclaw/exec-approvals.sock",
    "token": "base64url-token"
  },
  "defaults": {
    "security": "deny",
    "ask": "on-miss",
    "askFallback": "deny",
    "autoAllowSkills": false
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "askFallback": "deny",
      "autoAllowSkills": true,
      "allowlist": [
        {
          "id": "B0C8C0B3-2C2D-4F8A-9A3C-5A4B3C2D1E0F",
          "pattern": "~/Projects/**/bin/rg",
          "lastUsedAt": 1737150000000,
          "lastUsedCommand": "rg -n TODO",
          "lastResolvedPath": "/Users/user/Projects/.../bin/rg"
        }
      ]
    }
  }
}
```

## 政策調整項

### Security（`exec.security`）

- **deny**：封鎖所有主機 exec 請求。
- **allowlist**：僅允許符合允許清單的指令。
- **full**：允許所有內容（等同於 elevated）。

### Ask（`exec.ask`）

- **off**：永不提示。
- **on-miss**：僅在未命中允許清單時提示。
- **always**：每個指令都提示。

### Ask fallback（`askFallback`）

若需要提示但無法連線到任何 UI，後備機制將決定結果：

- **deny**：封鎖。
- **allowlist**：僅在符合允許清單時允許。
- **full**：允許。

## 允許清單（每個代理程式）

允許清單是 **以代理程式為單位**。若存在多個代理程式，請在 macOS 應用程式中切換正在編輯的代理程式。
比對模式為 **不區分大小寫的 glob 比對**。
模式應解析為 **二進位檔路徑**（僅檔名的項目會被忽略）。
舊版 `agents.default` 項目會在載入時遷移至 `agents.main`。

範例：

- `~/Projects/**/bin/bird`
- `~/.local/bin/*`
- `/opt/homebrew/bin/rg`

每個允許清單項目會追蹤：

- **id**：用於 UI 身分識別的穩定 UUID（可選）
- **last used**：最後使用時間戳
- **last used command**
- **last resolved path**

## 自動允許 Skills CLI

啟用 **Auto-allow skill CLIs** 時，已知 Skills 所引用的可執行檔
會在節點上被視為已加入允許清單（macOS 節點或無頭節點主機）。
此功能會透過 Gateway RPC 使用 `skills.bins` 取得 skill 的 bin 清單。
若需要嚴格的手動允許清單，請停用此功能。

## 安全 bin（僅 stdin）

`tools.exec.safeBins` 定義了一小組 **僅 stdin** 的二進位檔（例如 `jq`），
在允許清單模式下 **不需要** 明確的允許清單項目即可執行。
安全 bin 會拒絕位置型檔案參數與類路徑權杖，因此只能處理輸入串流。
在允許清單模式下，不會自動允許 shell 串接與重新導向。

當每個頂層區段都符合允許清單（包含安全 bin 或 skill 自動允許）時，
允許 shell 串接（`&&`、`||`、`;`）。
在允許清單模式下，重新導向仍不受支援。
在允許清單解析期間會拒絕指令替換（`$()` / 反引號），即使在
雙引號內亦然；若需要字面上的 `$()` 文字，請使用單引號。

預設安全 bin：`jq`、`grep`、`cut`、`sort`、`uniq`、`head`、`tail`、`tr`、`wc`。

## 控制 UI 編輯

使用 **Control UI → Nodes → Exec 核准** 卡片來編輯預設值、每個代理程式的
覆寫設定與允許清單。選擇範圍（Defaults 或某個代理程式），調整政策，
新增或移除允許清單模式，然後按 **Save**。
UI 會顯示每個模式的 **last used** 中繼資料，方便維持清單整潔。

目標選擇器可選 **Gateway**（本機核准）或某個 **Node**。
節點必須宣告 `system.execApprovals.get/set`（macOS 應用程式或無頭節點主機）。
若節點尚未宣告 exec 核准，請直接編輯其本機
`~/.openclaw/exec-approvals.json`。

CLI：`openclaw approvals` 支援 Gateway 或節點的編輯（請參閱 [Approvals CLI](/cli/approvals)）。

## 核准流程

當需要提示時，Gateway 會向操作人員客戶端廣播 `exec.approval.requested`。
Control UI 與 macOS 應用程式會透過 `exec.approval.resolve` 處理，
接著 Gateway 會將已核准的請求轉送至節點主機。

當需要核准時，exec 工具會立即回傳一個核准 id。
請使用該 id 與後續的系統事件進行關聯（`Exec finished` / `Exec denied`）。
若在逾時前未收到決策，該請求會被視為核准逾時，並以拒絕原因呈現。

確認對話框包含：

- 指令 + 參數
- cwd
- agent id
- 已解析的可執行檔路徑
- 主機 + 政策中繼資料

動作：

- **Allow once** → 立即執行
- **Always allow** → 加入允許清單 + 執行
- **Deny** → 封鎖

## 將核准轉送至聊天頻道

你可以將 exec 核准提示轉送到任何聊天頻道（包含外掛頻道），並透過
`/approve` 進行核准。此功能使用一般的對外傳遞管線。

設定：

```json5
{
  approvals: {
    exec: {
      enabled: true,
      mode: "session", // "session" | "targets" | "both"
      agentFilter: ["main"],
      sessionFilter: ["discord"], // substring or regex
      targets: [
        { channel: "slack", to: "U12345678" },
        { channel: "telegram", to: "123456789" },
      ],
    },
  },
}
```

在聊天中回覆：

```
/approve <id> allow-once
/approve <id> allow-always
/approve <id> deny
```

### macOS IPC 流程

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + approvals + system.run)
```

安全性注意事項：

- Unix socket 模式 `0600`，權杖儲存在 `exec-approvals.json`。
- 相同 UID 的對等端檢查。
- 挑戰 / 回應（nonce + HMAC 權杖 + 請求雜湊）+ 短 TTL。

## 系統事件

Exec 生命週期會以系統訊息呈現：

- `Exec running`（僅當指令超過執行中通知門檻時）
- `Exec finished`
- `Exec denied`

這些事件會在節點回報後，張貼到代理程式的工作階段中。
Gateway 主機上的 exec 核准在指令完成時（且可選在執行時間超過門檻時）也會送出相同的生命週期事件。
受核准管控的 exec 會在這些訊息中重用核准 id 作為 `runId`，以利關聯。

## 影響

- **full** 功能強大；能用允許清單時，請優先使用允許清單。
- **ask** 可讓你保持掌握，同時仍能快速核准。
- 每個代理程式的允許清單可防止某個代理程式的核准外洩到其他代理程式。
- 核准僅適用於來自 **已授權傳送者** 的主機 exec 請求。未授權的傳送者無法發出 `/exec`。
- `/exec security=full` 是為已授權操作人員提供的工作階段層級便利功能，且設計上會略過核准。
  若要硬性封鎖主機 exec，請將核准安全性設為 `deny`，或透過工具政策拒絕 `exec` 工具。

相關：

- [Exec tool](/tools/exec)
- [Elevated mode](/tools/elevated)
- [Skills](/tools/skills)
