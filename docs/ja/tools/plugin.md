---
summary: "OpenClaw プラグイン／拡張機能：検出、設定、安全性"
read_when:
  - プラグイン／拡張機能を追加または変更する場合
  - プラグインのインストールやロード規則を文書化する場合
title: "プラグイン"
x-i18n:
  source_path: tools/plugin.md
  source_hash: b36ca6b90ca03eaa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:22Z
---

# プラグイン（拡張機能）

## クイックスタート（プラグインが初めての方）

プラグインとは、OpenClaw に追加の
機能（コマンド、ツール、Gateway RPC）を拡張する **小さなコードモジュール** です。

多くの場合、コアの OpenClaw にはまだ組み込まれていない機能が必要なとき（または、オプション機能をメインのインストールから切り離したいとき）にプラグインを使用します。

最短手順：

1. すでにロードされているものを確認します：

```bash
openclaw plugins list
```

2. 公式プラグインをインストールします（例：Voice Call）：

```bash
openclaw plugins install @openclaw/voice-call
```

3. Gateway（ゲートウェイ）を再起動し、`plugins.entries.<id>.config` の下で設定します。

具体的なプラグイン例については、[Voice Call](/plugins/voice-call) を参照してください。

## 利用可能なプラグイン（公式）

- Microsoft Teams は 2026.1.15 時点でプラグイン専用です。Teams を使用する場合は `@openclaw/msteams` をインストールしてください。
- Memory（Core）— バンドルされたメモリ検索プラグイン（`plugins.slots.memory` によりデフォルトで有効）
- Memory（LanceDB）— バンドルされた長期記憶プラグイン（自動リコール／キャプチャ；`plugins.slots.memory = "memory-lancedb"` を設定）
- [Voice Call](/plugins/voice-call) — `@openclaw/voice-call`
- [Zalo Personal](/plugins/zalouser) — `@openclaw/zalouser`
- [Matrix](/channels/matrix) — `@openclaw/matrix`
- [Nostr](/channels/nostr) — `@openclaw/nostr`
- [Zalo](/channels/zalo) — `@openclaw/zalo`
- [Microsoft Teams](/channels/msteams) — `@openclaw/msteams`
- Google Antigravity OAuth（プロバイダー認証）— `google-antigravity-auth` としてバンドル（デフォルト無効）
- Gemini CLI OAuth（プロバイダー認証）— `google-gemini-cli-auth` としてバンドル（デフォルト無効）
- Qwen OAuth（プロバイダー認証）— `qwen-portal-auth` としてバンドル（デフォルト無効）
- Copilot Proxy（プロバイダー認証）— ローカル VS Code Copilot Proxy ブリッジ；組み込みの `github-copilot` デバイスログインとは別物（バンドル、デフォルト無効）

OpenClaw プラグインは、jiti により実行時にロードされる **TypeScript モジュール** です。**設定の検証ではプラグインコードは実行されません**。代わりに、プラグインマニフェストと JSON Schema を使用します。[Plugin manifest](/plugins/manifest) を参照してください。

プラグインで登録できるもの：

- Gateway RPC メソッド
- Gateway HTTP ハンドラ
- エージェントツール
- CLI コマンド
- バックグラウンドサービス
- 任意の設定検証
- **Skills**（プラグインマニフェストで `skills` ディレクトリを列挙）
- **自動返信コマンド**（AI エージェントを呼び出さずに実行）

プラグインは Gateway と **同一プロセス** で実行されるため、信頼できるコードとして扱ってください。
ツール作成ガイド：[Plugin agent tools](/plugins/agent-tools)。

## ランタイムヘルパー

プラグインは、`api.runtime` を介して選択されたコアヘルパーにアクセスできます。テレフォニー用 TTS の例：

```ts
const result = await api.runtime.tts.textToSpeechTelephony({
  text: "Hello from OpenClaw",
  cfg: api.config,
});
```

注記：

- コアの `messages.tts` 設定（OpenAI または ElevenLabs）を使用します。
- PCM オーディオバッファとサンプルレートを返します。プラグイン側でプロバイダー向けに再サンプリング／エンコードが必要です。
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

バンドルされたプラグインは、`plugins.entries.<id>.enabled` または `openclaw plugins enable <id>` で明示的に有効化する必要があります。インストールされたプラグインはデフォルトで有効ですが、同じ方法で無効化できます。

各プラグインは、ルートに `openclaw.plugin.json` ファイルを含める必要があります。パスがファイルを指している場合、プラグインのルートはそのファイルのディレクトリとなり、マニフェストを含んでいなければなりません。

同一の id に解決されるプラグインが複数ある場合、上記順序で最初に一致したものが優先され、低優先度のコピーは無視されます。

### パッケージパック

プラグインディレクトリには、`openclaw.extensions` を含む `package.json` を置くことができます：

```json
{
  "name": "my-pack",
  "openclaw": {
    "extensions": ["./src/safety.ts", "./src/tools.ts"]
  }
}
```

各エントリが 1 つのプラグインになります。パックに複数の拡張が列挙されている場合、プラグイン id は `name/<fileBase>` になります。

プラグインが npm 依存関係をインポートする場合は、そのディレクトリにインストールして、`node_modules` が利用可能になるようにしてください（`npm install`／`pnpm install`）。

### チャンネルカタログのメタデータ

チャンネルプラグインは、`openclaw.channel` によりオンボーディング用メタデータを、`openclaw.install` によりインストールヒントを公開できます。これにより、コアのカタログはデータフリーのまま保たれます。

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

OpenClaw は **外部チャンネルカタログ**（例：MPM レジストリエクスポート）もマージできます。次のいずれかに JSON ファイルを配置してください：

- `~/.openclaw/mpm/plugins.json`
- `~/.openclaw/mpm/catalog.json`
- `~/.openclaw/plugins/catalog.json`

または、`OPENCLAW_PLUGIN_CATALOG_PATHS`（または `OPENCLAW_MPM_CATALOG_PATHS`）を 1 つ以上の JSON ファイル（カンマ／セミコロン／`PATH` 区切り）に向けてください。各ファイルには `{ "entries": [ { "name": "@scope/pkg", "openclaw": { "channel": {...}, "install": {...} } } ] }` を含める必要があります。

## プラグイン ID

デフォルトのプラグイン id：

- パッケージパック：`package.json` `name`
- 単体ファイル：ファイルのベース名（`~/.../voice-call.ts` → `voice-call`）

プラグインが `id` をエクスポートしている場合、OpenClaw はそれを使用しますが、設定された id と一致しない場合は警告を出します。

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
- `deny`：拒否リスト（任意；拒否が優先）
- `load.paths`：追加のプラグインファイル／ディレクトリ
- `entries.<id>`：プラグインごとのトグルと設定

設定変更には **Gateway の再起動** が必要です。

検証ルール（厳格）：

- `entries`、`allow`、`deny`、`slots` に未知のプラグイン id がある場合は **エラー** です。
- 未知の `channels.<id>` キーは、プラグインマニフェストでチャンネル id が宣言されていない限り **エラー** です。
- プラグイン設定は、`openclaw.plugin.json`（`configSchema`）に埋め込まれた JSON Schema を使用して検証されます。
- プラグインが無効の場合、その設定は保持され、**警告** が出力されます。

## プラグインスロット（排他的カテゴリ）

一部のプラグインカテゴリは **排他的**（同時に有効なのは 1 つのみ）です。どのプラグインがスロットを所有するかは `plugins.slots` で選択します：

```json5
{
  plugins: {
    slots: {
      memory: "memory-core", // or "none" to disable memory plugins
    },
  },
}
```

複数のプラグインが `kind: "memory"` を宣言している場合、選択されたもののみがロードされます。その他は診断付きで無効化されます。

## コントロール UI（スキーマ + ラベル）

コントロール UI は、`config.schema`（JSON Schema + `uiHints`）を使用して、より良いフォームをレンダリングします。

OpenClaw は、検出されたプラグインに基づいて実行時に `uiHints` を拡張します：

- `plugins.entries.<id>`／`.enabled`／`.config` 用のプラグイン別ラベルを追加
- 次の場所に、プラグインが提供する任意の設定フィールドヒントをマージ：
  `plugins.entries.<id>.config.<field>`

プラグイン設定フィールドに適切なラベル／プレースホルダーを表示し（機密情報をセンシティブとしてマークする）たい場合は、プラグインマニフェスト内の JSON Schema と併せて `uiHints` を提供してください。

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

`plugins update` は、`plugins.installs` 配下で追跡されている npm インストールに対してのみ動作します。

プラグインは、独自のトップレベルコマンド（例：`openclaw voicecall`）を登録することもできます。

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

注記：

- フックディレクトリは通常のフック構造（`HOOK.md` + `handler.ts`）に従います。
- フックの適格性ルール（OS／バイナリ／環境変数／設定要件）は引き続き適用されます。
- プラグイン管理のフックは、`openclaw hooks list` に `plugin:<id>` として表示されます。
- `openclaw hooks` からプラグイン管理フックを有効／無効にすることはできません。代わりにプラグイン自体を有効／無効にしてください。

## プロバイダープラグイン（モデル認証）

プラグインは **モデルプロバイダー認証** フローを登録でき、ユーザーは OpenClaw 内で OAuth や API キーのセットアップを実行できます（外部スクリプト不要）。

`api.registerProvider(...)` でプロバイダーを登録します。各プロバイダーは、1 つ以上の認証方式（OAuth、API キー、デバイスコードなど）を公開します。これらの方式は次を支えます：

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

注記：

- `run` は、`prompter`、`runtime`、`openUrl`、`oauth.createVpsAwareHandlers` ヘルパーを備えた `ProviderAuthContext` を受け取ります。
- デフォルトのモデルやプロバイダー設定を追加する必要がある場合は `configPatch` を返してください。
- `--set-default` がエージェントのデフォルトを更新できるように、`defaultModel` を返してください。

### メッセージングチャンネルを登録する

プラグインは、組み込みチャンネル（WhatsApp、Telegram など）のように振る舞う **チャンネルプラグイン** を登録できます。チャンネル設定は `channels.<id>` 配下に置かれ、チャンネルプラグインのコードによって検証されます。

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

注記：

- 設定は `channels.<id>` 配下に置いてください（`plugins.entries` ではありません）。
- `meta.label` は CLI／UI リストのラベルに使用されます。
- `meta.aliases` は正規化および CLI 入力用の代替 id を追加します。
- `meta.preferOver` は、両方が設定されている場合に自動有効化をスキップするチャンネル id を列挙します。
- `meta.detailLabel` と `meta.systemImage` により、UI はよりリッチなチャンネルラベル／アイコンを表示できます。

### 新しいメッセージングチャンネルを書く（ステップバイステップ）

モデルプロバイダーではなく、**新しいチャットサーフェス**（「メッセージングチャンネル」）が必要な場合に使用してください。モデルプロバイダーのドキュメントは `/providers/*` にあります。

1. id と設定形状を選ぶ

- すべてのチャンネル設定は `channels.<id>` 配下に置きます。
- マルチアカウント構成では `channels.<id>.accounts.<accountId>` を推奨します。

2. チャンネルメタデータを定義する

- `meta.label`、`meta.selectionLabel`、`meta.docsPath`、`meta.blurb` が CLI／UI リストを制御します。
- `meta.docsPath` は、`/channels/<id>` のようなドキュメントページを指す必要があります。
- `meta.preferOver` により、プラグインは別のチャンネルを置き換えることができます（自動有効化で優先）。
- `meta.detailLabel` と `meta.systemImage` は、UI で詳細テキスト／アイコンに使用されます。

3. 必須アダプターを実装する

- `config.listAccountIds` + `config.resolveAccount`
- `capabilities`（チャット種別、メディア、スレッドなど）
- `outbound.deliveryMode` + `outbound.sendText`（基本的な送信）

4. 必要に応じて任意アダプターを追加する

- `setup`（ウィザード）、`security`（DM ポリシー）、`status`（ヘルス／診断）
- `gateway`（開始／停止／ログイン）、`mentions`、`threading`、`streaming`
- `actions`（メッセージアクション）、`commands`（ネイティブコマンド動作）

5. プラグイン内でチャンネルを登録する

- `api.registerChannel({ plugin })`

最小設定例：

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

最小チャンネルプラグイン（送信のみ）：

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

プラグインをロード（拡張ディレクトリまたは `plugins.load.paths`）し、Gateway を再起動してから、設定内の `channels.<id>` を構成してください。

### エージェントツール

専用ガイドを参照してください：[Plugin agent tools](/plugins/agent-tools)。

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

プラグインは、**AI エージェントを呼び出さずに実行される** カスタムスラッシュコマンドを登録できます。これは、トグルコマンド、ステータス確認、LLM 処理を必要としないクイックアクションに有用です。

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
- `commandBody`：コマンド全文
- `config`：現在の OpenClaw 設定

コマンドオプション：

- `name`：コマンド名（先頭の `/` なし）
- `description`：コマンド一覧に表示されるヘルプテキスト
- `acceptsArgs`：引数を受け付けるかどうか（デフォルト：false）。false の場合に引数が指定されると、コマンドは一致せず、メッセージは他のハンドラーにフォールスルーします
- `requireAuth`：認可された送信者を必須とするか（デフォルト：true）
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

注記：

- プラグインコマンドは、組み込みコマンドおよび AI エージェントより **前** に処理されます
- コマンドはグローバルに登録され、すべてのチャンネルで動作します
- コマンド名は大文字小文字を区別しません（`/MyStatus` は `/mystatus` に一致）
- コマンド名は文字で始まり、文字、数字、ハイフン、アンダースコアのみを含める必要があります
- 予約済みコマンド名（`help`、`status`、`reset` など）は、プラグインで上書きできません
- プラグイン間でコマンド登録が重複した場合、診断エラーで失敗します

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

プラグインは、リポジトリ内に skill（`skills/<name>/SKILL.md`）を同梱できます。
`plugins.entries.<id>.enabled`（または他の設定ゲート）で有効化し、
ワークスペース／管理された skills の配置場所に存在することを確認してください。

## 配布（npm）

推奨されるパッケージ構成：

- メインパッケージ：`openclaw`（本リポジトリ）
- プラグイン：`@openclaw/*` 配下の個別 npm パッケージ（例：`@openclaw/voice-call`）

公開時の契約：

- プラグインの `package.json` には、1 つ以上のエントリファイルを含む `openclaw.extensions` が必要です。
- エントリファイルは `.js` または `.ts` にできます（jiti が実行時に TS をロードします）。
- `openclaw plugins install <npm-spec>` は `npm pack` を使用し、`~/.openclaw/extensions/<id>/` に展開して、設定で有効化します。
- 設定キーの安定性：スコープ付きパッケージは、`plugins.entries.*` 用に **非スコープ** の id に正規化されます。

## 例のプラグイン：Voice Call

本リポジトリには、音声通話プラグイン（Twilio またはログフォールバック）が含まれています：

- ソース：`extensions/voice-call`
- Skill：`skills/voice-call`
- CLI：`openclaw voicecall start|status`
- ツール：`voice_call`
- RPC：`voicecall.start`、`voicecall.status`
- 設定（twilio）：`provider: "twilio"` + `twilio.accountSid/authToken/from`（任意：`statusCallbackUrl`、`twimlUrl`）
- 設定（dev）：`provider: "log"`（ネットワークなし）

セットアップと使用方法については、[Voice Call](/plugins/voice-call) および `extensions/voice-call/README.md` を参照してください。

## 安全性に関する注記

プラグインは Gateway と同一プロセスで実行されます。信頼できるコードとして扱ってください：

- 信頼できるプラグインのみをインストールしてください。
- 可能な限り `plugins.allow` の許可リストを使用してください。
- 変更後は Gateway を再起動してください。

## プラグインのテスト

プラグインはテストを同梱できます（また、同梱すべきです）：

- リポジトリ内プラグインは、`src/**` 配下に Vitest テストを配置できます（例：`src/plugins/voice-call.plugin.test.ts`）。
- 個別に公開されるプラグインは、独自の CI（lint／build／test）を実行し、`openclaw.extensions` がビルドされたエントリポイント（`dist/index.js`）を指していることを検証してください。
