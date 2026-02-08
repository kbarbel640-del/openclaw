---
summary: 「規劃：一個乾淨的插件 SDK + runtime，適用於所有訊息連接器」
read_when:
  - 定義或重構插件架構時
  - 將頻道連接器遷移至插件 SDK/runtime 時
title: 「插件 SDK 重構」
x-i18n:
  source_path: refactor/plugin-sdk.md
  source_hash: d1964e2e47a19ee1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:30Z
---

# 插件 SDK + Runtime 重構計畫

目標：每個訊息連接器都是一個插件（內建或外部），並使用一個穩定的 API。
任何插件都不得直接從 `src/**` 匯入。所有相依性都必須透過 SDK 或 runtime。

## 為什麼是現在

- 目前的連接器混用多種模式：直接匯入核心、僅 dist 的橋接層，以及自訂輔助工具。
- 這使得升級變得脆弱，並阻礙乾淨的外部插件介面。

## 目標架構（兩層）

### 1) 插件 SDK（編譯期、穩定、可發佈）

範圍：型別、輔助工具與設定工具。沒有 runtime 狀態，也沒有副作用。

內容（範例）：

- 型別：`ChannelPlugin`、adapters、`ChannelMeta`、`ChannelCapabilities`、`ChannelDirectoryEntry`。
- 設定輔助工具：`buildChannelConfigSchema`、`setAccountEnabledInConfigSection`、`deleteAccountFromConfigSection`、
  `applyAccountNameToChannelSection`。
- 配對輔助工具：`PAIRING_APPROVED_MESSAGE`、`formatPairingApproveHint`。
- 入門引導輔助工具：`promptChannelAccessConfig`、`addWildcardAllowFrom`、onboarding 型別。
- 工具參數輔助工具：`createActionGate`、`readStringParam`、`readNumberParam`、`readReactionParams`、`jsonResult`。
- 文件連結輔助工具：`formatDocsLink`。

交付方式：

- 以 `openclaw/plugin-sdk` 發佈（或在核心中以 `openclaw/plugin-sdk` 匯出）。
- 採用語意化版本（semver），並提供明確的穩定性保證。

### 2) 插件 Runtime（執行介面，注入式）

範圍：所有會接觸核心 runtime 行為的內容。
透過 `OpenClawPluginApi.runtime` 存取，因此插件永遠不會匯入 `src/**`。

建議的介面（最小但完整）：

```ts
export type PluginRuntime = {
  channel: {
    text: {
      chunkMarkdownText(text: string, limit: number): string[];
      resolveTextChunkLimit(cfg: OpenClawConfig, channel: string, accountId?: string): number;
      hasControlCommand(text: string, cfg: OpenClawConfig): boolean;
    };
    reply: {
      dispatchReplyWithBufferedBlockDispatcher(params: {
        ctx: unknown;
        cfg: unknown;
        dispatcherOptions: {
          deliver: (payload: {
            text?: string;
            mediaUrls?: string[];
            mediaUrl?: string;
          }) => void | Promise<void>;
          onError?: (err: unknown, info: { kind: string }) => void;
        };
      }): Promise<void>;
      createReplyDispatcherWithTyping?: unknown; // adapter for Teams-style flows
    };
    routing: {
      resolveAgentRoute(params: {
        cfg: unknown;
        channel: string;
        accountId: string;
        peer: { kind: "dm" | "group" | "channel"; id: string };
      }): { sessionKey: string; accountId: string };
    };
    pairing: {
      buildPairingReply(params: { channel: string; idLine: string; code: string }): string;
      readAllowFromStore(channel: string): Promise<string[]>;
      upsertPairingRequest(params: {
        channel: string;
        id: string;
        meta?: { name?: string };
      }): Promise<{ code: string; created: boolean }>;
    };
    media: {
      fetchRemoteMedia(params: { url: string }): Promise<{ buffer: Buffer; contentType?: string }>;
      saveMediaBuffer(
        buffer: Uint8Array,
        contentType: string | undefined,
        direction: "inbound" | "outbound",
        maxBytes: number,
      ): Promise<{ path: string; contentType?: string }>;
    };
    mentions: {
      buildMentionRegexes(cfg: OpenClawConfig, agentId?: string): RegExp[];
      matchesMentionPatterns(text: string, regexes: RegExp[]): boolean;
    };
    groups: {
      resolveGroupPolicy(
        cfg: OpenClawConfig,
        channel: string,
        accountId: string,
        groupId: string,
      ): {
        allowlistEnabled: boolean;
        allowed: boolean;
        groupConfig?: unknown;
        defaultConfig?: unknown;
      };
      resolveRequireMention(
        cfg: OpenClawConfig,
        channel: string,
        accountId: string,
        groupId: string,
        override?: boolean,
      ): boolean;
    };
    debounce: {
      createInboundDebouncer<T>(opts: {
        debounceMs: number;
        buildKey: (v: T) => string | null;
        shouldDebounce: (v: T) => boolean;
        onFlush: (entries: T[]) => Promise<void>;
        onError?: (err: unknown) => void;
      }): { push: (v: T) => void; flush: () => Promise<void> };
      resolveInboundDebounceMs(cfg: OpenClawConfig, channel: string): number;
    };
    commands: {
      resolveCommandAuthorizedFromAuthorizers(params: {
        useAccessGroups: boolean;
        authorizers: Array<{ configured: boolean; allowed: boolean }>;
      }): boolean;
    };
  };
  logging: {
    shouldLogVerbose(): boolean;
    getChildLogger(name: string): PluginLogger;
  };
  state: {
    resolveStateDir(cfg: OpenClawConfig): string;
  };
};
```

備註：

- Runtime 是存取核心行為的唯一方式。
- SDK 刻意保持小且穩定。
- 每個 runtime 方法都對應到現有的核心實作（不重複）。

## 遷移計畫（分階段、安全）

### Phase 0：腳手架

- 引入 `openclaw/plugin-sdk`。
- 將 `api.runtime` 加入 `OpenClawPluginApi`，並提供上述介面。
- 在過渡期間維持既有匯入（附加棄用警告）。

### Phase 1：橋接清理（低風險）

- 以 `api.runtime` 取代各擴充的 `core-bridge.ts`。
- 優先遷移 BlueBubbles、Zalo、Zalo Personal（已相當接近）。
- 移除重複的橋接程式碼。

### Phase 2：輕度直接匯入插件

- 將 Matrix 遷移至 SDK + runtime。
- 驗證入門引導、目錄、群組提及邏輯。

### Phase 3：重度直接匯入插件

- 遷移 MS Teams（擁有最多 runtime 輔助工具）。
- 確保回覆／輸入中語意與目前行為一致。

### Phase 4：iMessage 插件化

- 將 iMessage 移至 `extensions/imessage`。
- 以 `api.runtime` 取代直接核心呼叫。
- 保留設定金鑰、CLI 行為與文件不變。

### Phase 5：強制執行

- 新增 lint 規則／CI 檢查：`src/**` 不得匯入 `extensions/**`。
- 新增插件 SDK／版本相容性檢查（runtime + SDK 的 semver）。

## 相容性與版本管理

- SDK：採用 semver，對外發佈，並有文件化的變更說明。
- Runtime：依核心版本管理。新增 `api.runtime.version`。
- 插件宣告所需的 runtime 範圍（例如 `openclawRuntime: ">=2026.2.0"`）。

## 測試策略

- Adapter 層級的單元測試（以真實核心實作來測試 runtime 函式）。
- 每個插件的黃金測試：確保行為不漂移（路由、配對、allowlist、提及閘控）。
- 在 CI 中使用單一端到端插件範例（安裝 + 執行 + 冒煙測試）。

## 開放問題

- SDK 型別應放在哪裡：獨立套件還是核心匯出？
- Runtime 型別的分發方式：放在 SDK（僅型別）還是核心？
- 如何為內建與外部插件公開文件連結？
- 在過渡期間，是否允許 repo 內插件有限度地直接匯入核心？

## 成功標準

- 所有頻道連接器皆為使用 SDK + runtime 的插件。
- `src/**` 不得匯入 `extensions/**`。
- 新的連接器範本僅相依於 SDK + runtime。
- 外部插件可在不存取核心原始碼的情況下開發與更新。

相關文件：[Plugins](/plugin)、[Channels](/channels/index)、[Configuration](/gateway/configuration)。
