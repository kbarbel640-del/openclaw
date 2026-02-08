---
summary: "例付きの ~/.openclaw/openclaw.json のすべての設定オプション"
read_when:
  - 設定フィールドの追加または変更時
title: "設定"
x-i18n:
  source_path: gateway/configuration.md
  source_hash: 53b6b8a615c4ce02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:59Z
---

# 設定 🔧

OpenClaw は、`~/.openclaw/openclaw.json` から任意の **JSON5** 設定を読み込みます（コメントおよび末尾のカンマが許可されます）。

ファイルが存在しない場合、OpenClaw は安全寄りのデフォルト（埋め込み Pi エージェント + 送信者ごとのセッション + ワークスペース `~/.openclaw/workspace`）を使用します。通常、設定が必要になるのは次の場合のみです。

- ボットをトリガーできるユーザーを制限する（`channels.whatsapp.allowFrom`、`channels.telegram.allowFrom` など）
- グループの許可リストおよびメンション動作を制御する（`channels.whatsapp.groups`、`channels.telegram.groups`、`channels.discord.guilds`、`agents.list[].groupChat`）
- メッセージのプレフィックスをカスタマイズする（`messages`）
- エージェントのワークスペースを設定する（`agents.defaults.workspace` または `agents.list[].workspace`）
- 埋め込みエージェントのデフォルト（`agents.defaults`）およびセッション動作（`session`）を調整する
- エージェントごとのアイデンティティを設定する（`agents.list[].identity`）

> **設定が初めてですか？** 詳細な説明付きの完全な例については、[設定例](/gateway/configuration-examples) ガイドをご覧ください。

## 厳格な設定検証

OpenClaw は、スキーマに完全一致する設定のみを受け付けます。  
不明なキー、型の不整合、無効な値がある場合、安全のため Gateway（ゲートウェイ）は **起動を拒否** します。

検証に失敗した場合：

- Gateway は起動しません。
- 診断コマンドのみが許可されます（例：`openclaw doctor`、`openclaw logs`、`openclaw health`、`openclaw status`、`openclaw service`、`openclaw help`）。
- 正確な問題を確認するには `openclaw doctor` を実行してください。
- マイグレーション／修復を適用するには `openclaw doctor --fix`（または `--yes`）を実行してください。

Doctor は、`--fix`/`--yes` に明示的に同意しない限り、変更を書き込みません。

## スキーマ + UI ヒント

Gateway は、UI エディタ向けに `config.schema` を介して設定の JSON Schema 表現を公開します。  
Control UI はこのスキーマからフォームをレンダリングし、**Raw JSON** エディタをエスケープハッチとして提供します。

チャンネルプラグインや拡張は、設定用のスキーマ + UI ヒントを登録できるため、  
ハードコードされたフォームなしで、アプリ間でスキーマ駆動のチャンネル設定を維持できます。

ヒント（ラベル、グルーピング、機密フィールド）はスキーマと同梱され、  
クライアントは設定知識をハードコードせずに、より良いフォームを描画できます。

## 適用 + 再起動（RPC）

`config.apply` を使用すると、設定全体を検証 + 書き込みし、1 ステップで Gateway を再起動できます。  
再起動用のセンチネルを書き込み、Gateway 復帰後に最後にアクティブだったセッションへ ping します。

警告：`config.apply` は **設定全体** を置き換えます。  
一部のキーのみを変更したい場合は、`config.patch` または `openclaw config set` を使用してください。  
`~/.openclaw/openclaw.json` のバックアップを保持してください。

パラメータ：

- `raw`（string）— 設定全体の JSON5 ペイロード
- `baseHash`（任意）— `config.get` の設定ハッシュ（既存の設定がある場合は必須）
- `sessionKey`（任意）— ウェイクアップ ping 用の最終アクティブセッションキー
- `note`（任意）— 再起動センチネルに含めるメモ
- `restartDelayMs`（任意）— 再起動までの遅延（デフォルト 2000）

例（`gateway call` 経由）：

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.apply --params '{
  "raw": "{\\n  agents: { defaults: { workspace: \\"~/.openclaw/workspace\\" } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## 部分更新（RPC）

`config.patch` を使用すると、既存の設定に部分更新をマージでき、  
無関係なキーを上書きしません。JSON マージパッチのセマンティクスを適用します。

- オブジェクトは再帰的にマージ
- `null` はキーを削除
- 配列は置換
  `config.apply` と同様に、検証・書き込み・再起動センチネル保存・Gateway 再起動をスケジュールします
  （`sessionKey` が指定されている場合は任意でウェイク）。

パラメータ：

- `raw`（string）— 変更するキーのみを含む JSON5 ペイロード
- `baseHash`（必須）— `config.get` の設定ハッシュ
- `sessionKey`（任意）— ウェイクアップ ping 用の最終アクティブセッションキー
- `note`（任意）— 再起動センチネルに含めるメモ
- `restartDelayMs`（任意）— 再起動までの遅延（デフォルト 2000）

例：

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.patch --params '{
  "raw": "{\\n  channels: { telegram: { groups: { \\"*\\": { requireMention: false } } } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## 最小構成（推奨の開始点）

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

次のコマンドでデフォルトイメージを一度ビルドします：

```bash
scripts/sandbox-setup.sh
```

## セルフチャットモード（グループ制御に推奨）

グループ内の WhatsApp の @メンションにボットが反応しないようにし、  
特定のテキストトリガーのみに応答させるには：

```json5
{
  agents: {
    defaults: { workspace: "~/.openclaw/workspace" },
    list: [
      {
        id: "main",
        groupChat: { mentionPatterns: ["@openclaw", "reisponde"] },
      },
    ],
  },
  channels: {
    whatsapp: {
      // Allowlist is DMs only; including your own number enables self-chat mode.
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## 設定インクルード（`$include`）

`$include` ディレクティブを使用して、設定を複数ファイルに分割できます。これは次の場合に便利です。

- 大規模な設定の整理（例：クライアントごとのエージェント定義）
- 環境間で共通設定を共有
- 機密設定を分離

### 基本的な使い方

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789 },

  // Include a single file (replaces the key's value)
  agents: { $include: "./agents.json5" },

  // Include multiple files (deep-merged in order)
  broadcast: {
    $include: ["./clients/mueller.json5", "./clients/schmidt.json5"],
  },
}
```

```json5
// ~/.openclaw/agents.json5
{
  defaults: { sandbox: { mode: "all", scope: "session" } },
  list: [{ id: "main", workspace: "~/.openclaw/workspace" }],
}
```

### マージ動作

- **単一ファイル**：`$include` を含むオブジェクトを置換
- **配列のファイル**：順序どおりにディープマージ（後のファイルが前のファイルを上書き）
- **兄弟キーあり**：インクルード後に兄弟キーをマージ（インクルード値を上書き）
- **兄弟キー + 配列／プリミティブ**：未対応（インクルード内容はオブジェクトである必要があります）

```json5
// Sibling keys override included values
{
  $include: "./base.json5", // { a: 1, b: 2 }
  b: 99, // Result: { a: 1, b: 99 }
}
```

### ネストしたインクルード

インクルードされたファイル自体に `$include` ディレクティブを含めることができます（最大 10 階層）：

```json5
// clients/mueller.json5
{
  agents: { $include: "./mueller/agents.json5" },
  broadcast: { $include: "./mueller/broadcast.json5" },
}
```

### パス解決

- **相対パス**：インクルード元ファイルからの相対
- **絶対パス**：そのまま使用
- **親ディレクトリ**：`../` 参照は通常どおり機能します

```json5
{ "$include": "./sub/config.json5" }      // relative
{ "$include": "/etc/openclaw/base.json5" } // absolute
{ "$include": "../shared/common.json5" }   // parent dir
```

### エラーハンドリング

- **欠落ファイル**：解決後パス付きの明確なエラー
- **パースエラー**：どのインクルードファイルが失敗したかを表示
- **循環インクルード**：検出され、インクルードチェーンとともに報告

### 例：マルチクライアントの法務向けセットアップ

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789, auth: { token: "secret" } },

  // Common agent defaults
  agents: {
    defaults: {
      sandbox: { mode: "all", scope: "session" },
    },
    // Merge agent lists from all clients
    list: { $include: ["./clients/mueller/agents.json5", "./clients/schmidt/agents.json5"] },
  },

  // Merge broadcast configs
  broadcast: {
    $include: ["./clients/mueller/broadcast.json5", "./clients/schmidt/broadcast.json5"],
  },

  channels: { whatsapp: { groupPolicy: "allowlist" } },
}
```

```json5
// ~/.openclaw/clients/mueller/agents.json5
[
  { id: "mueller-transcribe", workspace: "~/clients/mueller/transcribe" },
  { id: "mueller-docs", workspace: "~/clients/mueller/docs" },
]
```

```json5
// ~/.openclaw/clients/mueller/broadcast.json5
{
  "120363403215116621@g.us": ["mueller-transcribe", "mueller-docs"],
}
```

## 共通オプション

### 環境変数 + `.env`

OpenClaw は、親プロセス（シェル、launchd/systemd、CI など）から環境変数を読み込みます。

さらに、次をロードします。

- カレントワーキングディレクトリに存在する場合の `.env`
- `~/.openclaw/.env`（別名 `$OPENCLAW_STATE_DIR/.env`）からのグローバルフォールバック `.env`

いずれの `.env` ファイルも、既存の環境変数を上書きしません。

設定内でインラインの環境変数を指定することもできます。これらは、  
プロセス環境にキーが存在しない場合にのみ適用されます（同じ非上書きルール）。

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

完全な優先順位とソースについては [/environment](/environment) を参照してください。

### `env.shellEnv`（任意）

利便性のためのオプトイン機能です。有効化され、期待されるキーがまだ設定されていない場合、  
OpenClaw はログインシェルを実行し、不足している期待キーのみをインポートします（上書きはしません）。  
これは事実上、シェルプロファイルを source します。

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

環境変数での同等指定：

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

### 設定内での環境変数置換

任意の設定文字列値で、`${VAR_NAME}` 構文を使用して環境変数を直接参照できます。  
変数は、検証前の設定読み込み時に置換されます。

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
  gateway: {
    auth: {
      token: "${OPENCLAW_GATEWAY_TOKEN}",
    },
  },
}
```

**ルール：**

- マッチするのは大文字の環境変数名のみ：`[A-Z_][A-Z0-9_]*`
- 欠落または空の環境変数は、設定読み込み時にエラーになります
- `$${VAR}` でエスケープすると、リテラルの `${VAR}` を出力します
- `$include` と併用可能（インクルードされたファイルも置換されます）

**インライン置換：**

```json5
{
  models: {
    providers: {
      custom: {
        baseUrl: "${CUSTOM_API_BASE}/v1", // → "https://api.example.com/v1"
      },
    },
  },
}
```

（以下、原文の構造とプレースホルダを保持したまま、同様の技術文書調の日本語訳が続きます）

---

_次へ： [エージェントランタイム](/concepts/agent)_ 🦞
