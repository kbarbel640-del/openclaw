---
summary: "計画: すべてのメッセージングコネクター向けに、1 つのクリーンな Plugin SDK + runtime を提供します"
read_when:
  - プラグインアーキテクチャを定義またはリファクタリングする場合
  - チャンネルコネクターを Plugin SDK / runtime に移行する場合
title: "Plugin SDK リファクタリング"
x-i18n:
  source_path: refactor/plugin-sdk.md
  source_hash: d1964e2e47a19ee1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:51Z
---

# Plugin SDK + Runtime リファクタリング計画

目標: すべてのメッセージングコネクターを、1 つの安定した API を使用するプラグイン（バンドルまたは外部）にします。  
どのプラグインも `src/**` から直接インポートしません。すべての依存関係は SDK または runtime を経由します。

## なぜ今なのか

- 現在のコネクターは、直接的な core のインポート、dist 専用ブリッジ、カスタムヘルパーといったパターンが混在しています。
- これによりアップグレードが壊れやすくなり、クリーンな外部プラグイン向けのサーフェスを妨げています。

## 目標アーキテクチャ（2 レイヤー）

### 1) Plugin SDK（コンパイル時、安定、公開可能）

スコープ: 型、ヘルパー、設定ユーティリティ。runtime の状態や副作用は含みません。

内容（例）:

- 型: `ChannelPlugin`、アダプター、`ChannelMeta`、`ChannelCapabilities`、`ChannelDirectoryEntry`。
- 設定ヘルパー: `buildChannelConfigSchema`、`setAccountEnabledInConfigSection`、`deleteAccountFromConfigSection`、  
  `applyAccountNameToChannelSection`。
- ペアリングヘルパー: `PAIRING_APPROVED_MESSAGE`、`formatPairingApproveHint`。
- オンボーディングヘルパー: `promptChannelAccessConfig`、`addWildcardAllowFrom`、オンボーディング型。
- ツールパラメータヘルパー: `createActionGate`、`readStringParam`、`readNumberParam`、`readReactionParams`、`jsonResult`。
- ドキュメントリンクヘルパー: `formatDocsLink`。

提供方法:

- `openclaw/plugin-sdk` として公開（または core から `openclaw/plugin-sdk` 配下でエクスポート）します。
- 明確な安定性保証を伴う semver を採用します。

### 2) Plugin Runtime（実行サーフェス、注入）

スコープ: core の runtime 振る舞いに触れるすべて。  
プラグインが `src/**` をインポートしないよう、`OpenClawPluginApi.runtime` 経由でアクセスします。

提案されるサーフェス（最小限かつ完全）:

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

注記:

- runtime は core の振る舞いにアクセスする唯一の方法です。
- SDK は意図的に小さく、安定しています。
- 各 runtime メソッドは既存の core 実装にマッピングされます（重複はありません）。

## 移行計画（段階的、安全）

### フェーズ 0: スキャフォールディング

- `openclaw/plugin-sdk` を導入します。
- 上記サーフェスを持つ `api.runtime` を `OpenClawPluginApi` に追加します。
- 移行期間中は既存のインポートを維持します（非推奨警告を付与）。

### フェーズ 1: ブリッジの整理（低リスク）

- 拡張ごとの `core-bridge.ts` を `api.runtime` に置き換えます。
- BlueBubbles、Zalo、Zalo Personal を最初に移行します（すでに近い状態です）。
- 重複したブリッジコードを削除します。

### フェーズ 2: 軽量な直接インポートのプラグイン

- Matrix を SDK + runtime に移行します。
- オンボーディング、ディレクトリ、グループメンションのロジックを検証します。

### フェーズ 3: 重量な直接インポートのプラグイン

- MS Teams を移行します（runtime ヘルパーの最大セット）。
- 返信／入力中のセマンティクスが現在の挙動と一致することを確認します。

### フェーズ 4: iMessage のプラグイン化

- iMessage を `extensions/imessage` に移動します。
- 直接的な core 呼び出しを `api.runtime` に置き換えます。
- 設定キー、CLI の挙動、ドキュメントはそのまま維持します。

### フェーズ 5: 強制

- lint ルール／CI チェックを追加します: `src/**` からの `extensions/**` インポートを禁止します。
- プラグイン SDK / バージョン互換性チェックを追加します（runtime + SDK の semver）。

## 互換性とバージョニング

- SDK: semver、公開、変更点を文書化します。
- Runtime: core リリースごとにバージョン管理します。`api.runtime.version` を追加します。
- プラグインは必要な runtime の範囲を宣言します（例: `openclawRuntime: ">=2026.2.0"`）。

## テスト戦略

- アダプターレベルのユニットテスト（実際の core 実装で runtime 関数を検証）。
- プラグインごとのゴールデンテスト: 挙動のドリフトがないことを確認します（ルーティング、ペアリング、許可リスト、メンションのゲーティング）。
- CI で使用する単一のエンドツーエンドのプラグインサンプル（インストール + 実行 + スモーク）。

## 未解決の質問

- SDK の型をどこに配置するか: 別パッケージか、core からのエクスポートか。
- runtime の型配布: SDK（型のみ）か、core か。
- バンドルプラグインと外部プラグインで、ドキュメントリンクをどのように公開するか。
- 移行期間中、リポジトリ内プラグインに限定して core への直接インポートを許可するか。

## 成功基準

- すべてのチャンネルコネクターが SDK + runtime を使用するプラグインであること。
- `src/**` からの `extensions/**` インポートが存在しないこと。
- 新しいコネクターテンプレートが SDK + runtime のみに依存していること。
- 外部プラグインが core のソースアクセスなしに開発・更新できること。

関連ドキュメント: [Plugins](/plugin)、[Channels](/channels/index)、[Configuration](/gateway/configuration)。
