---
summary: "OpenClaw プラグイン／拡張機能：検出、設定、安全性"
read_when:
  - プラグイン／拡張機能を追加または変更する場合
  - プラグインのインストールや読み込みルールを文書化する場合
title: "プラグイン"
x-i18n:
  source_path: plugin.md
  source_hash: b36ca6b90ca03eaa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:10Z
---

# プラグイン（拡張機能）

## クイックスタート（プラグインが初めての場合）

プラグインは、OpenClaw に追加機能（コマンド、ツール、Gateway RPC）を拡張する **小さなコードモジュール** です。

多くの場合、コアの OpenClaw にはまだ組み込まれていない機能が必要なとき（または、オプション機能をメインのインストールから分離したいとき）にプラグインを使用します。

最短手順：

1. すでに読み込まれているものを確認します：

```bash
openclaw plugins list
```

2. 公式プラグインをインストールします（例：Voice Call）：

```bash
openclaw plugins install @openclaw/voice-call
```

3. Gateway（ゲートウェイ）を再起動し、`plugins.entries.<id>.config` で設定します。

具体的なプラグイン例については、[Voice Call](/plugins/voice-call) を参照してください。

## 利用可能なプラグイン（公式）

- Microsoft Teams は 2026.1.15 時点でプラグイン専用です。Teams を使用する場合は `@openclaw/msteams` をインストールしてください。
- Memory（Core）— バンドルされたメモリー検索プラグイン（`plugins.slots.memory` によりデフォルトで有効）
- Memory（LanceDB）— バンドルされた長期メモリープラグイン（自動リコール／キャプチャ。`plugins.slots.memory = "memory-lancedb"` を設定）
- [Voice Call](/plugins/voice-call) — `@openclaw/voice-call`
- [Zalo Personal](/plugins/zalouser) — `@openclaw/zalouser`
- [Matrix](/channels/matrix) — `@openclaw/matrix`
- [Nostr](/channels/nostr) — `@openclaw/nostr`
- [Zalo](/channels/zalo) — `@openclaw/zalo`
- [Microsoft Teams](/channels/msteams) — `@openclaw/msteams`
- Google Antigravity OAuth（プロバイダー認証）— `google-antigravity-auth` としてバンドル（デフォルト無効）
- Gemini CLI OAuth（プロバイダー認証）— `google-gemini-cli-auth` としてバンドル（デフォルト無効）
- Qwen OAuth（プロバイダー認証）— `qwen-portal-auth` としてバンドル（デフォルト無効）
- Copilot Proxy（プロバイダー認証）— ローカルの VS Code Copilot Proxy ブリッジ。組み込みの `github-copilot` デバイスログインとは別（バンドル、デフォルト無効）

OpenClaw のプラグインは、jiti を介して実行時に読み込まれる **TypeScript モジュール** です。**設定検証ではプラグインコードは実行されません**。代わりに、プラグインマニフェストと JSON Schema を使用します。詳細は [Plugin manifest](/plugins/manifest) を参照してください。

プラグインで登録できるもの：

- Gateway RPC メソッド
- Gateway HTTP ハンドラー
- エージェントツール
- CLI コマンド
- バックグラウンドサービス
- オプションの設定検証
- **Skills**（プラグインマニフェストで `skills` ディレクトリを列挙）
- **自動返信コマンド**（AI エージェントを呼び出さずに実行）

プラグインは Gateway（ゲートウェイ）と **同一プロセス内** で実行されるため、信頼できるコードとして扱ってください。ツール作成ガイド： [Plugin agent tools](/plugins/agent-tools)。

## ランタイムヘルパー

プラグインは、`api.runtime` を介して選択されたコアヘルパーにアクセスできます。テレフォニーの TTS については次を使用します：

```ts
const result = await api.runtime.tts.textToSpeechTelephony({
  text: "Hello from OpenClaw",
  cfg: api.config,
});
```

注意事項：

- コアの `messages.tts` 設定（OpenAI または ElevenLabs）を使用します。
- PCM オーディオバッファーとサンプルレートを返します。プラグイン側でプロバイダー向けにリサンプリング／エンコードが必要です。
- Edge TTS はテレフォニーではサポートされていません。

## 検出と優先順位

OpenClaw は次の順序でスキャンします：

1. 設定パス

- `plugins.load.paths`（ファイルまたはディレクトリ）

2. ワークスペース拡張

- `<workspace>/.openclaw/extensions/*.ts`
- `<workspace>/.openclaw/extensions/*/index.ts`

3. グローバル拡張

- `~/.openclaw/extensions/*.ts`
- `~/.openclaw/extensions/*/index.ts`

4. バンドル拡張（OpenClaw に同梱、**デフォルト無効**）

- `<openclaw>/extensions/*`

バンドルされたプラグインは、`plugins.entries.<id>.enabled` または `openclaw plugins enable <id>` により明示的に有効化する必要があります。インストール済みプラグインはデフォルトで有効ですが、同じ方法で無効化できます。

各プラグインは、ルートに `openclaw.plugin.json` ファイルを含める必要があります。パスがファイルを指す場合、プラグインルートはそのファイルのディレクトリであり、マニフェストを含んでいる必要があります。

複数のプラグインが同じ id に解決される場合、上記の順序で最初に一致したものが採用され、優先度の低いコピーは無視されます。

### パッケージパック

プラグインディレクトリには、`openclaw.extensions` を含む `package.json` を含めることができます：

```json
{
  "name": "my-pack",
  "openclaw": {
    "extensions": ["./src/safety.ts", "./src/tools.ts"]
  }
}
```

各エントリーは 1 つのプラグインになります。パックに複数の拡張が列挙されている場合、プラグイン id は `name/<fileBase>` になります。

プラグインが npm 依存関係をインポートする場合は、そのディレクトリにインストールして `node_modules` が利用可能であることを確認してください（`npm install` / `pnpm install`）。

### チャンネルカタログのメタデータ

チャンネルプラグインは、`openclaw.channel` を介してオンボーディングメタデータを、`openclaw.install` を介してインストールヒントを告知できます。これにより、コアのカタログをデータフリーに保てます。

例：

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

OpenClaw は **外部チャンネルカタログ**（例：MPM レジストリのエクスポート）もマージできます。次のいずれかに JSON ファイルを配置してください：

- `~/.openclaw/mpm/plugins.json`
- `~/.openclaw/mpm/catalog.json`
- `~/.openclaw/plugins/catalog.json`

または、`OPENCLAW_PLUGIN_CATALOG_PATHS`（または `OPENCLAW_MPM_CATALOG_PATHS`）に、1 つ以上の JSON ファイルを指定します（カンマ／セミコロン／`PATH` 区切り）。各ファイルには `{ "entries": [ { "name": "@scope/pkg", "openclaw": { "channel": {...}, "install": {...} } } ] }` を含めてください。

## プラグイン ID

デフォルトのプラグイン id：

- パッケージパック：`package.json` `name`
- 単一ファイル：ファイルのベース名（`~/.../voice-call.ts` → `voice-call`）

プラグインが `id` をエクスポートしている場合、OpenClaw はそれを使用しますが、設定された id と一致しない場合は警告します。

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

フィールド：

- `enabled`：マスタートグル（デフォルト：true）
- `allow`：許可リスト（任意）
- `deny`：拒否リスト（任意。拒否が優先）
- `load.paths`：追加のプラグインファイル／ディレクトリ
- `entries.<id>`：プラグインごとのトグル＋設定

設定変更は **Gateway（ゲートウェイ）の再起動が必要** です。

検証ルール（厳格）：

- `entries`、`allow`、`deny`、または `slots` に未知のプラグイン id がある場合は **エラー** です。
- 未知の `channels.<id>` キーは、プラグインマニフェストでチャンネル id が宣言されていない限り **エラー** です。
- プラグイン設定は、`openclaw.plugin.json` に埋め込まれた JSON Schema（`configSchema`）を使用して検証されます。
- プラグインが無効の場合でも設定は保持され、**警告** が出力されます。

## プラグインスロット（排他的カテゴリ）

一部のプラグインカテゴリは **排他的**（同時に 1 つのみ有効）です。`plugins.slots` を使用して、どのプラグインがスロットを所有するかを選択します：

```json5
{
  plugins: {
    slots: {
      memory: "memory-core", // or "none" to disable memory plugins
    },
  },
}
```

複数のプラグインが `kind: "memory"` を宣言している場合、選択されたもののみが読み込まれます。その他は診断付きで無効化されます。

## コントロール UI（スキーマ＋ラベル）

コントロール UI は、`config.schema`（JSON Schema ＋ `uiHints`）を使用して、より良いフォームをレンダリングします。

OpenClaw は、検出されたプラグインに基づいて実行時に `uiHints` を拡張します：

- `plugins.entries.<id>` / `.enabled` / `.config` のプラグイン別ラベルを追加
- 次の配下に、プラグイン提供のオプション設定フィールドヒントをマージ：
  `plugins.entries.<id>.config.<field>`

プラグイン設定フィールドに適切なラベル／プレースホルダーを表示し（シークレットを機密としてマークする）たい場合は、プラグインマニフェスト内の JSON Schema と並べて `uiHints` を提供してください。

例：

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

`plugins update` は、`plugins.installs` 配下で追跡されている npm インストールに対してのみ機能します。

プラグインは独自のトップレベルコマンドも登録できます（例：`openclaw voicecall`）。

## プラグイン API（概要）

プラグインは次のいずれかをエクスポートします：

- 関数：`(api) => { ... }`
- オブジェクト：`{ id, name, configSchema, register(api) { ... } }`

## プラグインフック

プラグインはフックを同梱し、実行時に登録できます。これにより、別途フックパックをインストールすることなく、イベント駆動の自動化をバンドルできます。

### 例

```
import { registerPluginHooksFromDir } from "openclaw/plugin-sdk";

export default function register(api) {
  registerPluginHooksFromDir(api, "./hooks");
}
```

注意事項：

- フックディレクトリは通常のフック構造（`HOOK.md` + `handler.ts`）に従います。
- フックの適格性ルール（OS／バイナリ／環境変数／設定要件）は引き続き適用されます。
- プラグイン管理のフックは、`openclaw hooks list` に `plugin:<id>` として表示されます。
- `openclaw hooks` からプラグイン管理フックを有効／無効にはできません。代わりにプラグイン自体を有効／無効にしてください。

## プロバイダープラグイン（モデル認証）

プラグインは **モデルプロバイダー認証** フローを登録でき、ユーザーは OpenClaw 内で OAuth や API キー設定を実行できます（外部スクリプトは不要）。

`api.registerProvider(...)` を介してプロバイダーを登録します。各プロバイダーは 1 つ以上の認証方法（OAuth、API キー、デバイスコードなど）を公開します。これらの方法は次を支えます：

- `openclaw models auth login --provider <id> [--method <id>]`

例：

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

- `run` は、`prompter`、`runtime`、`openUrl`、`oauth.createVpsAwareHandlers` ヘルパーを含む `ProviderAuthContext` を受け取ります。
- デフォルトモデルやプロバイダー設定を追加する必要がある場合は `configPatch` を返します。
- `--set-default` がエージェントのデフォルトを更新できるようにするには `defaultModel` を返します。

### メッセージングチャンネルを登録する

プラグインは、組み込みチャンネル（WhatsApp、Telegram など）のように振る舞う **チャンネルプラグイン** を登録できます。チャンネル設定は `channels.<id>` 配下に置かれ、チャンネルプラグインのコードで検証されます。

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

- 設定は `channels.<id>` 配下に置いてください（`plugins.entries` ではありません）。
- `meta.label` は CLI／UI の一覧でラベルとして使用されます。
- `meta.aliases` は正規化や CLI 入力のための代替 id を追加します。
- `meta.preferOver` は、両方が設定されている場合に自動有効化をスキップするチャンネル id を列挙します。
- `meta.detailLabel` と `meta.systemImage` により、UI はよりリッチなチャンネルラベル／アイコンを表示できます。

### 新しいメッセージングチャンネルを書く（ステップ別）

**新しいチャットサーフェス**（「メッセージングチャンネル」）が必要な場合に使用します。モデルプロバイダーではありません。モデルプロバイダーのドキュメントは `/providers/*` 配下にあります。

1. id と設定形状を選択します

- すべてのチャンネル設定は `channels.<id>` 配下に置きます。
- 複数アカウント構成では `channels.<id>.accounts.<accountId>` を推奨します。

2. チャンネルメタデータを定義します

- `meta.label`、`meta.selectionLabel`、`meta.docsPath`、`meta.blurb` が CLI／UI の一覧を制御します。
- `meta.docsPath` は、`/channels/<id>` のようなドキュメントページを指す必要があります。
- `meta.preferOver` により、プラグインは別のチャンネルを置き換えられます（自動有効化はそれを優先）。
- `meta.detailLabel` と `meta.systemImage` は、UI で詳細テキスト／アイコンに使用されます。

3. 必須アダプターを実装します

- `config.listAccountIds` + `config.resolveAccount`
- `capabilities`（チャットタイプ、メディア、スレッドなど）
- `outbound.deliveryMode` + `outbound.sendText`（基本的な送信）

4. 必要に応じて任意のアダプターを追加します

- `setup`（ウィザード）、`security`（DM ポリシー）、`status`（ヘルス／診断）
- `gateway`（開始／停止／ログイン）、`mentions`、`threading`、`streaming`
- `actions`（メッセージアクション）、`commands`（ネイティブコマンド動作）

5. プラグインでチャンネルを登録します

- `api.registerChannel({ plugin })`

最小構成の設定例：

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

最小のチャンネルプラグイン（送信のみ）：

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

プラグインを読み込み（拡張ディレクトリまたは `plugins.load.paths`）、Gateway（ゲートウェイ）を再起動してから、設定内の `channels.<id>` を構成してください。

### エージェントツール

専用ガイドを参照してください： [Plugin agent tools](/plugins/agent-tools)。

### Gateway RPC メソッドを登録する

```ts
export default function (api) {
  api.registerGatewayMethod("myplugin.status", ({ respond }) => {
    respond(true, { ok: true });
  });
}
```

### CLI コマンドを登録する

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

### 自動返信コマンドを登録する

プラグインは、**AI エージェントを呼び出さずに実行** されるカスタムスラッシュコマンドを登録できます。これは、トグルコマンド、ステータスチェック、LLM 処理を必要としないクイックアクションに有用です。

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

コマンドハンドラーのコンテキスト：

- `senderId`：送信者の ID（利用可能な場合）
- `channel`：コマンドが送信されたチャンネル
- `isAuthorizedSender`：送信者が認可ユーザーかどうか
- `args`：コマンド後に渡された引数（`acceptsArgs: true` の場合）
- `commandBody`：完全なコマンドテキスト
- `config`：現在の OpenClaw 設定

コマンドオプション：

- `name`：コマンド名（先頭の `/` を除く）
- `description`：コマンド一覧に表示されるヘルプテキスト
- `acceptsArgs`：引数を受け付けるかどうか（デフォルト：false）。false の場合に引数が提供されると、コマンドは一致せず、メッセージは他のハンドラーにフォールスルーします
- `requireAuth`：送信者の認可を必須にするかどうか（デフォルト：true）
- `handler`：`{ text: string }` を返す関数（async 可）

認可と引数を含む例：

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

- プラグインコマンドは、組み込みコマンドおよび AI エージェント **より前** に処理されます
- コマンドはグローバルに登録され、すべてのチャンネルで機能します
- コマンド名は大文字小文字を区別しません（`/MyStatus` は `/mystatus` に一致）
- コマンド名は英字で始まり、英字、数字、ハイフン、アンダースコアのみを含める必要があります
- 予約済みコマンド名（`help`、`status`、`reset` など）は、プラグインで上書きできません
- プラグイン間での重複コマンド登録は、診断エラーで失敗します

### バックグラウンドサービスを登録する

```ts
export default function (api) {
  api.registerService({
    id: "my-service",
    start: () => api.logger.info("ready"),
    stop: () => api.logger.info("bye"),
  });
}
```

## 命名規則

- Gateway メソッド：`pluginId.action`（例：`voicecall.status`）
- ツール：`snake_case`（例：`voice_call`）
- CLI コマンド：kebab または camel。コアコマンドとの衝突は避けてください

## Skills

プラグインは、リポジトリ内に Skill（`skills/<name>/SKILL.md`）を同梱できます。
`plugins.entries.<id>.enabled`（または他の設定ゲート）で有効化し、
ワークスペース／管理対象 Skills の場所に存在することを確認してください。

## 配布（npm）

推奨パッケージング：

- メインパッケージ：`openclaw`（このリポジトリ）
- プラグイン：`@openclaw/*` 配下の別 npm パッケージ（例：`@openclaw/voice-call`）

公開時の契約：

- プラグインの `package.json` には、1 つ以上のエントリーファイルを含む `openclaw.extensions` が必要です。
- エントリーファイルは `.js` または `.ts` にできます（jiti は TS を実行時に読み込みます）。
- `openclaw plugins install <npm-spec>` は `npm pack` を使用し、`~/.openclaw/extensions/<id>/` に展開して、設定で有効化します。
- 設定キーの安定性：スコープ付きパッケージは、`plugins.entries.*` のために **スコープなし** id に正規化されます。

## 例：Voice Call プラグイン

このリポジトリには、音声通話プラグイン（Twilio またはログフォールバック）が含まれています：

- ソース：`extensions/voice-call`
- Skill：`skills/voice-call`
- CLI：`openclaw voicecall start|status`
- ツール：`voice_call`
- RPC：`voicecall.start`、`voicecall.status`
- 設定（twilio）：`provider: "twilio"` + `twilio.accountSid/authToken/from`（任意：`statusCallbackUrl`、`twimlUrl`）
- 設定（dev）：`provider: "log"`（ネットワークなし）

セットアップと使用方法については、[Voice Call](/plugins/voice-call) および `extensions/voice-call/README.md` を参照してください。

## 安全上の注意

プラグインは Gateway（ゲートウェイ）と同一プロセス内で実行されます。信頼できるコードとして扱ってください：

- 信頼できるプラグインのみをインストールしてください。
- `plugins.allow` の許可リストを推奨します。
- 変更後は Gateway（ゲートウェイ）を再起動してください。

## プラグインのテスト

プラグインはテストを同梱できます（また、同梱すべきです）：

- リポジトリ内プラグインは、`src/**` 配下に Vitest テストを置けます（例：`src/plugins/voice-call.plugin.test.ts`）。
- 別途公開するプラグインは、独自の CI（lint／build／test）を実行し、`openclaw.extensions` がビルド済みエントリーポイント（`dist/index.js`）を指していることを検証してください。
