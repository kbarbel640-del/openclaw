---
summary: 「Skills 設定結構與範例」
read_when:
  - 新增或修改 Skills 設定
  - 調整隨附的 allowlist 或安裝行為
title: 「Skills 設定」
x-i18n:
  source_path: tools/skills-config.md
  source_hash: e265c93da7856887
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:59Z
---

# Skills 設定

所有與 Skills 相關的設定都位於 `skills` 之下，並存放於 `~/.openclaw/openclaw.json`。

```json5
{
  skills: {
    allowBundled: ["gemini", "peekaboo"],
    load: {
      extraDirs: ["~/Projects/agent-scripts/skills", "~/Projects/oss/some-skill-pack/skills"],
      watch: true,
      watchDebounceMs: 250,
    },
    install: {
      preferBrew: true,
      nodeManager: "npm", // npm | pnpm | yarn | bun (Gateway runtime still Node; bun not recommended)
    },
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

## 欄位

- `allowBundled`: 僅適用於 **隨附（bundled）** Skills 的選用 allowlist。設定後，只有清單中的隨附 Skills 具備資格（不影響 managed / workspace Skills）。
- `load.extraDirs`: 額外要掃描的 Skill 目錄（最低優先順序）。
- `load.watch`: 監看 Skill 資料夾並重新整理 Skills 快照（預設：true）。
- `load.watchDebounceMs`: Skill 監看事件的 debounce（毫秒，預設：250）。
- `install.preferBrew`: 可用時偏好使用 brew 安裝器（預設：true）。
- `install.nodeManager`: node 安裝器偏好（`npm` | `pnpm` | `yarn` | `bun`，預設：npm）。
  這只影響 **Skill 安裝**；Gateway 閘道器 的執行期仍應使用 Node
  （不建議 WhatsApp / Telegram 使用 Bun）。
- `entries.<skillKey>`: 逐 Skill 覆寫設定。

逐 Skill 欄位：

- `enabled`: 將 `false` 設為停用，即使該 Skill 已隨附／已安裝。
- `env`: 注入至代理程式執行時的環境變數（僅在尚未設定時）。
- `apiKey`: 針對宣告主要環境變數的 Skills 提供的選用便利設定。

## 注意事項

- `entries` 之下的鍵預設對應 Skill 名稱。若某個 Skill 定義了
  `metadata.openclaw.skillKey`，則改用該鍵。
- 啟用監看器時，對 Skills 的變更會在下一次代理程式輪次被套用。

### 沙箱隔離的 Skills + 環境變數

當工作階段為 **沙箱隔離** 時，Skill 行程會在 Docker 內執行。沙箱
**不會** 繼承主機的 `process.env`。

請使用以下其中一種方式：

- `agents.defaults.sandbox.docker.env`（或每個代理程式的 `agents.list[].sandbox.docker.env`）
- 將環境變數烘焙進你的自訂沙箱映像

全域的 `env` 與 `skills.entries.<skill>.env/apiKey` 僅適用於 **主機** 執行。
