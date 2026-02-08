---
summary:「Exec 工具的使用方式、stdin 模式與 TTY 支援」
read_when:
  - 使用或修改 exec 工具時
  - 除錯 stdin 或 TTY 行為時
title:「Exec 工具」
x-i18n:
  source_path: tools/exec.md
  source_hash: 3b32238dd8dce93d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:09Z
---

# Exec 工具

在工作區中執行 shell 指令。透過 `process` 支援前景 + 背景執行。
若 `process` 被禁止，`exec` 會以同步方式執行並忽略 `yieldMs`/`background`。
背景工作階段以代理程式為作用範圍；`process` 只能看到同一個代理程式的工作階段。

## 參數

- `command`（必填）
- `workdir`（預設為 cwd）
- `env`（鍵/值覆寫）
- `yieldMs`（預設 10000）：延遲後自動轉為背景
- `background`（bool）：立即在背景執行
- `timeout`（秒，預設 1800）：到期時終止
- `pty`（bool）：可用時在虛擬終端中執行（僅 TTY 的 CLI、程式設計代理、終端 UI）
- `host`（`sandbox | gateway | node`）：執行位置
- `security`（`deny | allowlist | full`）：`gateway`/`node` 的強制模式
- `ask`（`off | on-miss | always`）：`gateway`/`node` 的核准提示
- `node`（string）：`host=node` 的節點 id/名稱
- `elevated`（bool）：請求提升模式（Gateway 閘道器 主機）；僅在提升解析為 `full` 時才會強制 `security=full`

注意事項：

- `host` 預設為 `sandbox`。
- 當沙箱隔離關閉時會忽略 `elevated`（exec 已直接在主機上執行）。
- `gateway`/`node` 的核准由 `~/.openclaw/exec-approvals.json` 控制。
- `node` 需要已配對的節點（配套應用程式或無頭節點主機）。
- 若有多個節點可用，請設定 `exec.node` 或 `tools.exec.node` 來選擇其中一個。
- 在非 Windows 主機上，若設定了 `SHELL`，exec 會使用它；如果 `SHELL` 為 `fish`，則會優先使用
  `bash`（或 `sh`）來自 `PATH`，以避免與 fish 不相容的腳本，若兩者皆不存在則回退到 `SHELL`。
- 主機執行（`gateway`/`node`）會拒絕 `env.PATH` 與載入器覆寫（`LD_*`/`DYLD_*`），以防止二進位劫持或注入程式碼。
- 重要：沙箱隔離**預設為關閉**。若沙箱隔離關閉，`host=sandbox` 會直接在
  Gateway 閘道器 主機上執行（不使用容器），且**不需要核准**。若要強制核准，請搭配
  `host=gateway` 執行並設定 exec 核准（或啟用沙箱隔離）。

## 設定

- `tools.exec.notifyOnExit`（預設：true）：為 true 時，背景化的 exec 工作階段會排入一個系統事件，並在結束時請求一次心跳。
- `tools.exec.approvalRunningNoticeMs`（預設：10000）：當需要核准的 exec 執行時間超過此值時，發出一次「執行中」通知（0 表示停用）。
- `tools.exec.host`（預設：`sandbox`）
- `tools.exec.security`（預設：沙箱為 `deny`；未設定時 Gateway 閘道器 + 節點為 `allowlist`）
- `tools.exec.ask`（預設：`on-miss`）
- `tools.exec.node`（預設：未設定）
- `tools.exec.pathPrepend`：在 exec 執行時要加入到 `PATH` 前面的目錄清單。
- `tools.exec.safeBins`：僅 stdin 的安全二進位檔，可在沒有明確 allowlist 項目的情況下執行。

範例：

```json5
{
  tools: {
    exec: {
      pathPrepend: ["~/bin", "/opt/oss/bin"],
    },
  },
}
```

### PATH 處理

- `host=gateway`：將你的登入 shell 的 `PATH` 合併到 exec 環境中。主機執行會拒絕 `env.PATH` 的覆寫。守護程式本身仍以最小化的 `PATH` 執行：
  - macOS：`/opt/homebrew/bin`、`/usr/local/bin`、`/usr/bin`、`/bin`
  - Linux：`/usr/local/bin`、`/usr/bin`、`/bin`
- `host=sandbox`：在容器內執行 `sh -lc`（登入 shell），因此 `/etc/profile` 可能會重設 `PATH`。
  OpenClaw 會在透過內部 env var 完成設定檔來源後，將 `env.PATH` 加到前面（不進行 shell 插值）；
  `tools.exec.pathPrepend` 在此同樣適用。
- `host=node`：僅會將你傳遞的、未被封鎖的 env 覆寫送至節點。主機執行會拒絕 `env.PATH` 的覆寫。
  無頭節點主機僅在它會將 `PATH` 加到節點主機 PATH 前端（不取代）時才接受。macOS 節點會完全捨棄 `PATH` 的覆寫。

每個代理程式的節點繫結（在設定中使用代理程式清單索引）：

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

控制 UI：Nodes 分頁包含一個小型的「Exec node binding」面板，用於相同設定。

## 工作階段覆寫（`/exec`）

使用 `/exec` 設定**每個工作階段**的 `host`、`security`、`ask` 與 `node` 預設值。
傳送不帶參數的 `/exec` 以顯示目前值。

範例：

```
/exec host=gateway security=allowlist ask=on-miss node=mac-1
```

## 授權模型

`/exec` 僅對**已授權的傳送者**生效（頻道 allowlist／配對加上 `commands.useAccessGroups`）。
它只會更新**工作階段狀態**，不會寫入設定。若要硬性停用 exec，請透過工具
政策（`tools.deny: ["exec"]` 或每個代理程式）拒絕。除非你明確設定
`security=full` 與 `ask=off`，否則主機核准仍然適用。

## Exec 核准（配套應用程式／節點主機）

沙箱隔離的代理程式可以在 `exec` 於 Gateway 閘道器 或節點主機上執行前，要求每次請求的核准。
請參閱 [Exec 核准](/tools/exec-approvals) 以了解政策、allowlist 與 UI 流程。

當需要核准時，exec 工具會立即回傳
`status: "approval-pending"` 與一個核准 id。一旦核准（或拒絕／逾時），
Gateway 閘道器 會送出系統事件（`Exec finished` / `Exec denied`）。如果指令在
`tools.exec.approvalRunningNoticeMs` 之後仍在執行，會送出一次 `Exec running` 通知。

## Allowlist + 安全二進位檔

Allowlist 強制僅比對**解析後的二進位路徑**（不比對檔名）。當
`security=allowlist` 時，只有在管線中的每個區段都在 allowlist 中或為安全二進位檔時，shell 指令才會自動允許。
在 allowlist 模式下，會拒絕鏈結（`;`、`&&`、`||`）與重新導向。

## 範例

前景：

```json
{ "tool": "exec", "command": "ls -la" }
```

背景 + 輪詢：

```json
{"tool":"exec","command":"npm run build","yieldMs":1000}
{"tool":"process","action":"poll","sessionId":"<id>"}
```

傳送按鍵（tmux 風格）：

```json
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Enter"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["C-c"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Up","Up","Enter"]}
```

提交（僅送出 CR）：

```json
{ "tool": "process", "action": "submit", "sessionId": "<id>" }
```

貼上（預設為括號包住）：

```json
{ "tool": "process", "action": "paste", "sessionId": "<id>", "text": "line1\nline2\n" }
```

## apply_patch（實驗性）

`apply_patch` 是 `exec` 的子工具，用於結構化的多檔案編輯。
請明確啟用它：

```json5
{
  tools: {
    exec: {
      applyPatch: { enabled: true, allowModels: ["gpt-5.2"] },
    },
  },
}
```

注意事項：

- 僅適用於 OpenAI/OpenAI Codex 模型。
- 工具政策仍然適用；`allow: ["exec"]` 會隱含允許 `apply_patch`。
- 設定位於 `tools.exec.applyPatch` 之下。
