---
summary: 「OpenClaw 外掛／擴充功能：探索、設定與安全性」
read_when:
  - 新增或修改外掛／擴充功能
  - 撰寫外掛安裝或載入規則文件
title: 「外掛」
x-i18n:
  source_path: plugin.md
  source_hash: b36ca6b90ca03eaa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:47Z
---

# 外掛（Extensions）

## 快速開始（第一次使用外掛？）

外掛就是一個 **小型程式碼模組**，用來為 OpenClaw 擴充額外功能
（指令、工具，以及 Gateway RPC）。

大多數時候，當你需要核心 OpenClaw 尚未內建的功能
（或希望將可選功能與主要安裝分離）時，就會使用外掛。

快速路徑：

1. 查看目前已載入的項目：

```bash
openclaw plugins list
```

2. 安裝官方外掛（範例：Voice Call）：

```bash
openclaw plugins install @openclaw/voice-call
```

3. 重新啟動 Gateway，然後在 `plugins.entries.<id>.config` 底下進行設定。

請參閱 [Voice Call](/plugins/voice-call) 取得具體的外掛範例。

## 可用外掛（官方）

- Microsoft Teams 自 2026.1.15 起僅提供外掛形式；若你使用 Teams，請安裝 `@openclaw/msteams`。
- Memory（Core）— 內建的記憶搜尋外掛（預設透過 `plugins.slots.memory` 啟用）
- Memory（LanceDB）— 內建的長期記憶外掛（自動回憶／擷取；設定 `plugins.slots.memory = "memory-lancedb"`）
- [Voice Call](/plugins/voice-call) — `@openclaw/voice-call`
- [Zalo Personal](/plugins/zalouser) — `@openclaw/zalouser`
- [Matrix](/channels/matrix) — `@openclaw/matrix`
- [Nostr](/channels/nostr) — `@openclaw/nostr`
- [Zalo](/channels/zalo) — `@openclaw/zalo`
- [Microsoft Teams](/channels/msteams) — `@openclaw/msteams`
- Google Antigravity OAuth（提供者驗證）— 以 `google-antigravity-auth` 形式隨附（預設停用）
- Gemini CLI OAuth（提供者驗證）— 以 `google-gemini-cli-auth` 形式隨附（預設停用）
- Qwen OAuth（提供者驗證）— 以 `qwen-portal-auth` 形式隨附（預設停用）
- Copilot Proxy（提供者驗證）— 本機 VS Code Copilot Proxy 橋接；與內建的 `github-copilot` 裝置登入不同（隨附、預設停用）

OpenClaw 外掛是 **TypeScript 模組**，在執行階段透過 jiti 載入。**設定驗證不會執行外掛程式碼**；它改用外掛資訊清單與 JSON Schema。請參閱 [外掛資訊清單](/plugins/manifest)。

外掛可以註冊：

- Gateway RPC 方法
- Gateway HTTP 處理器
- 代理程式工具
- CLI 指令
- 背景服務
- 可選的設定驗證
- **Skills**（在外掛資訊清單中列出 `skills` 目錄）
- **自動回覆指令**（不呼叫 AI 代理程式即可執行）

外掛 **與 Gateway 同行程執行**，因此請將其視為受信任的程式碼。
工具撰寫指南：[外掛代理程式工具](/plugins/agent-tools)。

## 執行期輔助工具

外掛可透過 `api.runtime` 存取選定的核心輔助工具。用於電話語音 TTS：

```ts
const result = await api.runtime.tts.textToSpeechTelephony({
  text: "Hello from OpenClaw",
  cfg: api.config,
});
```

注意事項：

- 使用核心 `messages.tts` 設定（OpenAI 或 ElevenLabs）。
- 回傳 PCM 音訊緩衝區 + 取樣率。外掛必須為各提供者進行重新取樣／編碼。
- 電話語音不支援 Edge TTS。

## 探索與優先順序

OpenClaw 依序掃描：

1. 設定路徑

- `plugins.load.paths`（檔案或目錄）

2. 工作區擴充功能

- `<workspace>/.openclaw/extensions/*.ts`
- `<workspace>/.openclaw/extensions/*/index.ts`

3. 全域擴充功能

- `~/.openclaw/extensions/*.ts`
- `~/.openclaw/extensions/*/index.ts`

4. 內建擴充功能（隨 OpenClaw 發佈，**預設停用**）

- `<openclaw>/extensions/*`

內建外掛必須透過 `plugins.entries.<id>.enabled`
或 `openclaw plugins enable <id>` 明確啟用。已安裝的外掛預設為啟用，
但也可用相同方式停用。

每個外掛的根目錄都必須包含 `openclaw.plugin.json` 檔案。若路徑指向檔案，
則該檔案的目錄即為外掛根目錄，且必須包含資訊清單。

若多個外掛解析為相同的 id，以上述順序中最先匹配者為準，
優先順序較低的副本會被忽略。

### 套件包（Package packs）

外掛目錄可包含一個 `package.json`，其中列出 `openclaw.extensions`：

```json
{
  "name": "my-pack",
  "openclaw": {
    "extensions": ["./src/safety.ts", "./src/tools.ts"]
  }
}
```

每個項目都會成為一個外掛。若套件包列出多個擴充，
外掛 id 會變成 `name/<fileBase>`。

若你的外掛匯入 npm 相依套件，請在該目錄中安裝它們，
以確保 `node_modules` 可用（`npm install`／`pnpm install`）。

### 頻道目錄中繼資料

頻道外掛可透過 `openclaw.channel` 宣告入門引導中繼資料，
並透過 `openclaw.install` 提供安裝提示。這可讓核心目錄保持無資料狀態。

範例：

```json
{
  "name": "@openclaw/nextcloud-talk",
  "openclaw": {
    "extensions": ["./index.ts"],
    "channel": {
      "id": "nextcloud-talk",
      "label": "Nextcloud Talk",
      "selectionLabel": "Nextcloud Talk (self-hosted)",
      "docsPath": "/channels/nextcloud-talk",
      "docsLabel": "nextcloud-talk",
      "blurb": "Self-hosted chat via Nextcloud Talk webhook bots.",
      "order": 65,
      "aliases": ["nc-talk", "nc"]
    },
    "install": {
      "npmSpec": "@openclaw/nextcloud-talk",
      "localPath": "extensions/nextcloud-talk",
      "defaultChoice": "npm"
    }
  }
}
```

OpenClaw 也可合併 **外部頻道目錄**
（例如 MPM 登錄匯出）。將 JSON 檔放置於以下任一路徑：

- `~/.openclaw/mpm/plugins.json`
- `~/.openclaw/mpm/catalog.json`
- `~/.openclaw/plugins/catalog.json`

或將 `OPENCLAW_PLUGIN_CATALOG_PATHS`（或 `OPENCLAW_MPM_CATALOG_PATHS`）指向
一個或多個 JSON 檔（以逗號／分號／`PATH` 分隔）。
每個檔案都應包含 `{ "entries": [ { "name": "@scope/pkg", "openclaw": { "channel": {...}, "install": {...} } } ] }`。

## 外掛 ID

預設外掛 id：

- 套件包：`package.json` `name`
- 獨立檔案：檔名基底（`~/.../voice-call.ts` → `voice-call`）

若外掛匯出 `id`，OpenClaw 會使用它，
但當其與設定的 id 不一致時會發出警告。

## 設定

```json5
{
  plugins: {
    enabled: true,
    allow: ["voice-call"],
    deny: ["untrusted-plugin"],
    load: { paths: ["~/Projects/oss/voice-call-extension"] },
    entries: {
      "voice-call": { enabled: true, config: { provider: "twilio" } },
    },
  },
}
```

欄位：

- `enabled`：總開關（預設：true）
- `allow`：允許清單（可選）
- `deny`：封鎖清單（可選；封鎖優先）
- `load.paths`：額外的外掛檔案／目錄
- `entries.<id>`：各外掛的開關與設定

設定變更 **需要重新啟動 Gateway**。

驗證規則（嚴格）：

- 在 `entries`、`allow`、`deny` 或 `slots` 中出現未知的外掛 id 會被視為 **錯誤**。
- 未知的 `channels.<id>` 金鑰會被視為 **錯誤**，除非外掛資訊清單宣告了該頻道 id。
- 外掛設定會使用嵌入於 `openclaw.plugin.json` 的 JSON Schema 進行驗證（`configSchema`）。
- 若外掛被停用，其設定會被保留，並發出 **警告**。

## 外掛插槽（互斥類別）

某些外掛類別是 **互斥的**（同時間僅能啟用一個）。請使用
`plugins.slots` 選擇由哪個外掛擁有該插槽：

```json5
{
  plugins: {
    slots: {
      memory: "memory-core", // or "none" to disable memory plugins
    },
  },
}
```

若多個外掛宣告 `kind: "memory"`，僅會載入被選取的那一個；
其餘外掛會被停用並顯示診斷資訊。

## 控制 UI（Schema + 標籤）

控制 UI 使用 `config.schema`（JSON Schema + `uiHints`）來呈現更佳的表單。

OpenClaw 會在執行階段根據已探索到的外掛，擴充 `uiHints`：

- 為 `plugins.entries.<id>`／`.enabled`／`.config` 新增各外掛的標籤
- 合併外掛可選提供的設定欄位提示至：
  `plugins.entries.<id>.config.<field>`

若你希望外掛設定欄位顯示良好的標籤／預留文字（並將祕密標記為敏感），
請在外掛資訊清單中，於 JSON Schema 旁提供 `uiHints`。

範例：

```json
{
  "id": "my-plugin",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "apiKey": { "type": "string" },
      "region": { "type": "string" }
    }
  },
  "uiHints": {
    "apiKey": { "label": "API Key", "sensitive": true },
    "region": { "label": "Region", "placeholder": "us-east-1" }
  }
}
```

## CLI

```bash
openclaw plugins list
openclaw plugins info <id>
openclaw plugins install <path>                 # copy a local file/dir into ~/.openclaw/extensions/<id>
openclaw plugins install ./extensions/voice-call # relative path ok
openclaw plugins install ./plugin.tgz           # install from a local tarball
openclaw plugins install ./plugin.zip           # install from a local zip
openclaw plugins install -l ./extensions/voice-call # link (no copy) for dev
openclaw plugins install @openclaw/voice-call # install from npm
openclaw plugins update <id>
openclaw plugins update --all
openclaw plugins enable <id>
openclaw plugins disable <id>
openclaw plugins doctor
```

`plugins update` 僅適用於在 `plugins.installs` 下追蹤的 npm 安裝。

外掛也可以註冊自己的頂層指令（範例：`openclaw voicecall`）。

## 外掛 API（概覽）

外掛匯出以下其一：

- 函式：`(api) => { ... }`
- 物件：`{ id, name, configSchema, register(api) { ... } }`

## 外掛 Hook

外掛可以隨附 hook，並在執行階段註冊。這讓外掛能在不另行安裝
hook 套件的情況下，封裝事件驅動的自動化。

### 範例

```
import { registerPluginHooksFromDir } from "openclaw/plugin-sdk";

export default function register(api) {
  registerPluginHooksFromDir(api, "./hooks");
}
```

注意事項：

- Hook 目錄遵循一般的 hook 結構（`HOOK.md` + `handler.ts`）。
- Hook 的適用規則仍然適用（作業系統／bin／環境／設定需求）。
- 由外掛管理的 hook 會顯示在 `openclaw hooks list` 中，並標示為 `plugin:<id>`。
- 你無法透過 `openclaw hooks` 啟用／停用外掛管理的 hook；請改為啟用／停用外掛本身。

## 提供者外掛（模型驗證）

外掛可註冊 **模型提供者驗證** 流程，讓使用者能在 OpenClaw 內完成 OAuth 或
API 金鑰設定（不需要外部指令碼）。

透過 `api.registerProvider(...)` 註冊提供者。每個提供者會暴露一種或多種驗證方式
（OAuth、API 金鑰、裝置碼等）。這些方式支援：

- `openclaw models auth login --provider <id> [--method <id>]`

範例：

```ts
api.registerProvider({
  id: "acme",
  label: "AcmeAI",
  auth: [
    {
      id: "oauth",
      label: "OAuth",
      kind: "oauth",
      run: async (ctx) => {
        // Run OAuth flow and return auth profiles.
        return {
          profiles: [
            {
              profileId: "acme:default",
              credential: {
                type: "oauth",
                provider: "acme",
                access: "...",
                refresh: "...",
                expires: Date.now() + 3600 * 1000,
              },
            },
          ],
          defaultModel: "acme/opus-1",
        };
      },
    },
  ],
});
```

注意事項：

- `run` 會接收一個 `ProviderAuthContext`，其中包含 `prompter`、`runtime`、
  `openUrl` 與 `oauth.createVpsAwareHandlers` 輔助工具。
- 當你需要新增預設模型或提供者設定時，請回傳 `configPatch`。
- 回傳 `defaultModel`，以便 `--set-default` 更新代理程式預設值。

### 註冊訊息頻道

外掛可註冊 **頻道外掛**，其行為與內建頻道
（WhatsApp、Telegram 等）相同。頻道設定位於 `channels.<id>` 下，
並由你的頻道外掛程式碼進行驗證。

```ts
const myChannel = {
  id: "acmechat",
  meta: {
    id: "acmechat",
    label: "AcmeChat",
    selectionLabel: "AcmeChat (API)",
    docsPath: "/channels/acmechat",
    blurb: "demo channel plugin.",
    aliases: ["acme"],
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.acmechat?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.acmechat?.accounts?.[accountId ?? "default"] ?? {
        accountId,
      },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async () => ({ ok: true }),
  },
};

export default function (api) {
  api.registerChannel({ plugin: myChannel });
}
```

注意事項：

- 請將設定放在 `channels.<id>`（而非 `plugins.entries`）。
- `meta.label` 用於 CLI／UI 清單中的標籤。
- `meta.aliases` 可新增替代 id 以利正規化與 CLI 輸入。
- `meta.preferOver` 列出在同時設定時要跳過自動啟用的頻道 id。
- `meta.detailLabel` 與 `meta.systemImage` 讓 UI 顯示更豐富的頻道標籤／圖示。

### 撰寫新的訊息頻道（逐步）

當你想要 **新的聊天介面**（「訊息頻道」）而非模型提供者時使用此節。
模型提供者文件位於 `/providers/*`。

1. 選擇 id 與設定結構

- 所有頻道設定都位於 `channels.<id>` 下。
- 多帳號情境建議使用 `channels.<id>.accounts.<accountId>`。

2. 定義頻道中繼資料

- `meta.label`、`meta.selectionLabel`、`meta.docsPath`、`meta.blurb` 控制 CLI／UI 清單。
- `meta.docsPath` 應指向如 `/channels/<id>` 的文件頁面。
- `meta.preferOver` 允許外掛取代另一個頻道（自動啟用時會優先）。
- `meta.detailLabel` 與 `meta.systemImage` 供 UI 顯示詳細文字／圖示。

3. 實作必要的介面卡（adapters）

- `config.listAccountIds` + `config.resolveAccount`
- `capabilities`（聊天類型、媒體、執行緒等）
- `outbound.deliveryMode` + `outbound.sendText`（基本傳送）

4. 視需要加入選用介面卡

- `setup`（精靈）、`security`（私訊政策）、`status`（健康狀態／診斷）
- `gateway`（啟動／停止／登入）、`mentions`、`threading`、`streaming`
- `actions`（訊息動作）、`commands`（原生命令行為）

5. 在你的外掛中註冊頻道

- `api.registerChannel({ plugin })`

最小設定範例：

```json5
{
  channels: {
    acmechat: {
      accounts: {
        default: { token: "ACME_TOKEN", enabled: true },
      },
    },
  },
}
```

最小頻道外掛（僅輸出）：

```ts
const plugin = {
  id: "acmechat",
  meta: {
    id: "acmechat",
    label: "AcmeChat",
    selectionLabel: "AcmeChat (API)",
    docsPath: "/channels/acmechat",
    blurb: "AcmeChat messaging channel.",
    aliases: ["acme"],
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.acmechat?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.acmechat?.accounts?.[accountId ?? "default"] ?? {
        accountId,
      },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ text }) => {
      // deliver `text` to your channel here
      return { ok: true };
    },
  },
};

export default function (api) {
  api.registerChannel({ plugin });
}
```

載入外掛（extensions 目錄或 `plugins.load.paths`），重新啟動 Gateway，
然後在設定中設定 `channels.<id>`。

### 代理程式工具

請參閱專用指南：[外掛代理程式工具](/plugins/agent-tools)。

### 註冊 Gateway RPC 方法

```ts
export default function (api) {
  api.registerGatewayMethod("myplugin.status", ({ respond }) => {
    respond(true, { ok: true });
  });
}
```

### 註冊 CLI 指令

```ts
export default function (api) {
  api.registerCli(
    ({ program }) => {
      program.command("mycmd").action(() => {
        console.log("Hello");
      });
    },
    { commands: ["mycmd"] },
  );
}
```

### 註冊自動回覆指令

外掛可註冊自訂斜線指令，並在 **不呼叫 AI 代理程式** 的情況下執行。
這對於切換指令、狀態檢查或不需要 LLM 處理的快速動作很有用。

```ts
export default function (api) {
  api.registerCommand({
    name: "mystatus",
    description: "Show plugin status",
    handler: (ctx) => ({
      text: `Plugin is running! Channel: ${ctx.channel}`,
    }),
  });
}
```

指令處理器內容：

- `senderId`：傳送者的 ID（若可用）
- `channel`：送出指令的頻道
- `isAuthorizedSender`：傳送者是否為授權使用者
- `args`：指令後傳入的參數（若 `acceptsArgs: true`）
- `commandBody`：完整指令文字
- `config`：目前的 OpenClaw 設定

指令選項：

- `name`：指令名稱（不含前置 `/`）
- `description`：在指令清單中顯示的說明文字
- `acceptsArgs`：是否接受參數（預設：false）。若為 false 且提供了參數，指令將不會匹配，訊息會交由其他處理器
- `requireAuth`：是否要求授權傳送者（預設：true）
- `handler`：回傳 `{ text: string }` 的函式（可為 async）

包含授權與參數的範例：

```ts
api.registerCommand({
  name: "setmode",
  description: "Set plugin mode",
  acceptsArgs: true,
  requireAuth: true,
  handler: async (ctx) => {
    const mode = ctx.args?.trim() || "default";
    await saveMode(mode);
    return { text: `Mode set to: ${mode}` };
  },
});
```

注意事項：

- 外掛指令會在 **內建指令與 AI 代理程式之前** 處理
- 指令為全域註冊，適用於所有頻道
- 指令名稱不分大小寫（`/MyStatus` 會匹配 `/mystatus`）
- 指令名稱必須以字母開頭，且僅能包含字母、數字、連字號與底線
- 保留指令名稱（如 `help`、`status`、`reset` 等）不可由外掛覆寫
- 不同外掛之間重複註冊相同指令會以診斷錯誤失敗

### 註冊背景服務

```ts
export default function (api) {
  api.registerService({
    id: "my-service",
    start: () => api.logger.info("ready"),
    stop: () => api.logger.info("bye"),
  });
}
```

## 命名慣例

- Gateway 方法：`pluginId.action`（範例：`voicecall.status`）
- 工具：`snake_case`（範例：`voice_call`）
- CLI 指令：kebab 或 camel 皆可，但請避免與核心指令衝突

## Skills

外掛可在儲存庫中隨附一個 skill（`skills/<name>/SKILL.md`）。
請使用 `plugins.entries.<id>.enabled`（或其他設定閘道）啟用，
並確保它存在於你的工作區／受管 skills 位置。

## 發佈（npm）

建議的封裝方式：

- 主套件：`openclaw`（此儲存庫）
- 外掛：獨立的 npm 套件，位於 `@openclaw/*`（範例：`@openclaw/voice-call`）

發佈合約：

- 外掛 `package.json` 必須包含 `openclaw.extensions`，其中列出一個或多個進入點檔案。
- 進入點檔案可為 `.js` 或 `.ts`（jiti 會在執行階段載入 TS）。
- `openclaw plugins install <npm-spec>` 會使用 `npm pack`，解壓至 `~/.openclaw/extensions/<id>/`，並在設定中啟用。
- 設定鍵穩定性：具 scope 的套件會正規化為 **無 scope** 的 id，用於 `plugins.entries.*`。

## 範例外掛：Voice Call

此儲存庫包含一個語音通話外掛（Twilio 或記錄回退）：

- 原始碼：`extensions/voice-call`
- Skill：`skills/voice-call`
- CLI：`openclaw voicecall start|status`
- 工具：`voice_call`
- RPC：`voicecall.start`、`voicecall.status`
- 設定（twilio）：`provider: "twilio"` + `twilio.accountSid/authToken/from`（選用 `statusCallbackUrl`、`twimlUrl`）
- 設定（dev）：`provider: "log"`（無網路）

請參閱 [Voice Call](/plugins/voice-call) 與 `extensions/voice-call/README.md` 了解設定與使用方式。

## 安全注意事項

外掛與 Gateway 同行程執行。請將其視為受信任的程式碼：

- 僅安裝你信任的外掛。
- 優先使用 `plugins.allow` 允許清單。
- 變更後請重新啟動 Gateway。

## 測試外掛

外掛可以（也應該）隨附測試：

- 儲存庫內的外掛可在 `src/**` 下放置 Vitest 測試（範例：`src/plugins/voice-call.plugin.test.ts`）。
- 獨立發佈的外掛應執行自有的 CI（lint／build／test），並驗證 `openclaw.extensions` 指向已建置的進入點（`dist/index.js`）。
