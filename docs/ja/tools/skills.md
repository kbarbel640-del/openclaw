---
summary: "Skills：管理型とワークスペース、ゲーティングルール、および設定/環境変数の配線"
read_when:
  - Skills の追加または変更
  - Skill のゲーティングまたはロードルールの変更
title: "Skills"
x-i18n:
  source_path: tools/skills.md
  source_hash: 54685da5885600b3
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:32Z
---

# Skills（OpenClaw）

OpenClaw は、ツールの使い方をエージェントに教えるために **[AgentSkills](https://agentskills.io) 互換**の Skill フォルダを使用します。各 Skill は、YAML フロントマターと手順を含む `SKILL.md` を含むディレクトリです。OpenClaw は **同梱 Skills** に加えて任意のローカル上書きを読み込み、環境、設定、バイナリの有無に基づいてロード時にそれらをフィルタリングします。

## 場所と優先順位

Skills は **3 つ**の場所から読み込まれます。

1. **同梱 Skills**：インストールに同梱（npm パッケージまたは OpenClaw.app）
2. **管理/ローカル Skills**：`~/.openclaw/skills`
3. **ワークスペース Skills**：`<workspace>/skills`

Skill 名が競合する場合の優先順位は次のとおりです。

`<workspace>/skills`（最高）→ `~/.openclaw/skills` → 同梱 Skills（最低）

さらに、`~/.openclaw/openclaw.json` 内の `skills.load.extraDirs` により、追加の Skill フォルダ（最も低い優先順位）を設定できます。

## エージェントごとの Skills と共有 Skills

**マルチエージェント**構成では、各エージェントはそれぞれ独自のワークスペースを持ちます。つまり次のとおりです。

- **エージェントごとの Skills** は、そのエージェント専用に `<workspace>/skills` に置かれます。
- **共有 Skills** は `~/.openclaw/skills`（管理/ローカル）に置かれ、同じマシン上の **すべてのエージェント**から見えます。
- **共有フォルダ**は、複数エージェントで共通の Skills パックを使いたい場合、`skills.load.extraDirs`（最も低い優先順位）でも追加できます。

同じ Skill 名が複数の場所に存在する場合は、通常の優先順位が適用されます。ワークスペースが最優先で、次に管理/ローカル、最後に同梱です。

## プラグイン + Skills

プラグインは、プラグインルートからの相対パスとして `openclaw.plugin.json` に `skills` ディレクトリを列挙することで、独自の Skills を同梱できます。プラグインの Skills はプラグインが有効なときにロードされ、通常の Skill 優先順位ルールに参加します。プラグインの設定エントリ上の `metadata.openclaw.requires.config` によりゲートできます。検出/設定については [Plugins](/plugin) を、これらの Skills が教えるツール面については [Tools](/tools) を参照してください。

## ClawHub（インストール + 同期）

ClawHub は OpenClaw 向けの公開 Skills レジストリです。https://clawhub.com で閲覧できます。Skills の検出、インストール、更新、バックアップに使用します。完全ガイド： [ClawHub](/tools/clawhub)。

一般的なフロー：

- Skill をワークスペースにインストール：
  - `clawhub install <skill-slug>`
- インストール済みの Skills をすべて更新：
  - `clawhub update --all`
- 同期（スキャン + 更新の公開）：
  - `clawhub sync --all`

デフォルトでは、`clawhub` は現在の作業ディレクトリ配下の `./skills` にインストールします（または設定された OpenClaw ワークスペースにフォールバックします）。OpenClaw は次回セッションでそれを `<workspace>/skills` として取り込みます。

## セキュリティメモ

- サードパーティの Skills は **信頼できないコード**として扱ってください。有効化する前に内容を確認してください。
- 信頼できない入力や危険なツールには、サンドボックス化された実行を優先してください。[Sandboxing](/gateway/sandboxing) を参照してください。
- `skills.entries.*.env` と `skills.entries.*.apiKey` は、そのエージェントのターンに対して **ホスト**プロセスにシークレットを注入します（サンドボックスではありません）。プロンプトやログからシークレットを排除してください。
- より広い脅威モデルとチェックリストについては、[Security](/gateway/security) を参照してください。

## 形式（AgentSkills + Pi 互換）

`SKILL.md` には少なくとも次のものを含める必要があります：

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
---
```

注記：

- レイアウト/意図については AgentSkills 仕様に従います。
- 組み込みエージェントで使われるパーサーは、**単一行**のフロントマターキーのみをサポートします。
- `metadata` は **単一行の JSON オブジェクト**である必要があります。
- 手順内で Skill フォルダパスを参照するには `{baseDir}` を使用します。
- 任意のフロントマターキー：
  - `homepage` — macOS の Skills UI で「Website」として表示される URL（`metadata.openclaw.homepage` 経由でもサポート）。
  - `user-invocable` — `true|false`（デフォルト：`true`）。`true` の場合、Skill はユーザーのスラッシュコマンドとして公開されます。
  - `disable-model-invocation` — `true|false`（デフォルト：`false`）。`true` の場合、Skill はモデルプロンプトから除外されます（ユーザー呼び出しでは引き続き利用可能）。
  - `command-dispatch` — `tool`（任意）。`tool` に設定すると、スラッシュコマンドはモデルをバイパスしてツールへ直接ディスパッチします。
  - `command-tool` — `command-dispatch: tool` が設定されているときに呼び出すツール名。
  - `command-arg-mode` — `raw`（デフォルト）。ツールディスパッチでは、生の args 文字列をツールへ転送します（コアでの解析なし）。

    ツールは次の params で呼び出されます：
    `{ command: "<raw args>", commandName: "<slash command>", skillName: "<skill name>" }`。

## ゲーティング（ロード時フィルタ）

OpenClaw は、`metadata`（単一行 JSON）を使用して **ロード時に Skills をフィルタリング**します：

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["uv"], "env": ["GEMINI_API_KEY"], "config": ["browser.enabled"] },
        "primaryEnv": "GEMINI_API_KEY",
      },
  }
---
```

`metadata.openclaw` 配下のフィールド：

- `always: true` — Skill を常に含めます（他のゲートをスキップ）。
- `emoji` — macOS の Skills UI で使われる任意の絵文字。
- `homepage` — macOS の Skills UI で「Website」として表示される任意の URL。
- `os` — プラットフォーム（`darwin`、`linux`、`win32`）の任意のリスト。設定されている場合、Skill はそれらの OS 上でのみ適格です。
- `requires.bins` — リスト；各項目は `PATH` 上に存在する必要があります。
- `requires.anyBins` — リスト；少なくとも 1 つは `PATH` 上に存在する必要があります。
- `requires.env` — リスト；環境変数が存在する **または** 設定で提供されている必要があります。
- `requires.config` — 真となる必要がある `openclaw.json` パスのリスト。
- `primaryEnv` — `skills.entries.<name>.apiKey` に関連付けられた環境変数名。
- `install` — macOS の Skills UI で使用されるインストーラ仕様（brew/node/go/uv/download）の任意の配列。

サンドボックス化に関する注意：

- `requires.bins` は Skill ロード時に **ホスト**でチェックされます。
- エージェントがサンドボックス化されている場合、バイナリはコンテナ **内**にも存在する必要があります。
  `agents.defaults.sandbox.docker.setupCommand`（またはカスタムイメージ）でインストールしてください。
  `setupCommand` はコンテナ作成後に一度だけ実行されます。
  パッケージのインストールには、ネットワークの外向き通信、書き込み可能なルート FS、サンドボックス内での root ユーザーも必要です。
  例：`summarize` Skill（`skills/summarize/SKILL.md`）は、サンドボックスコンテナ内で実行するには `summarize` CLI が必要です。

インストーラ例：

```markdown
---
name: gemini
description: Use Gemini CLI for coding assistance and Google search lookups.
metadata:
  {
    "openclaw":
      {
        "emoji": "♊️",
        "requires": { "bins": ["gemini"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "gemini-cli",
              "bins": ["gemini"],
              "label": "Install Gemini CLI (brew)",
            },
          ],
      },
  }
---
```

注記：

- 複数のインストーラが列挙されている場合、Gateway（ゲートウェイ）は **単一**の優先オプションを選びます（利用可能なら brew、そうでなければ node）。
- すべてのインストーラが `download` の場合、OpenClaw は利用可能なアーティファクトを確認できるように各エントリを列挙します。
- インストーラ仕様には、プラットフォーム別にオプションをフィルタするための `os: ["darwin"|"linux"|"win32"]` を含められます。
- Node のインストールは、`openclaw.json` 内の `skills.install.nodeManager` を尊重します（デフォルト：npm；選択肢：npm/pnpm/yarn/bun）。
  これは **Skill のインストール**にのみ影響します。Gateway（ゲートウェイ）のランタイムは引き続き Node であるべきです
  （WhatsApp/Telegram には Bun は推奨されません）。
- Go のインストール：`go` が欠けていて `brew` が利用可能な場合、Gateway（ゲートウェイ）はまず Homebrew 経由で Go をインストールし、可能であれば `GOBIN` を Homebrew の `bin` に設定します。
- Download のインストール：`url`（必須）、`archive`（`tar.gz` | `tar.bz2` | `zip`）、`extract`（デフォルト：アーカイブ検出時は auto）、`stripComponents`、`targetDir`（デフォルト：`~/.openclaw/tools/<skillKey>`）。

`metadata.openclaw` が存在しない場合、その Skill は常に適格です（設定で無効化されている場合、または同梱 Skills については `skills.allowBundled` によってブロックされている場合を除きます）。

## 設定の上書き（`~/.openclaw/openclaw.json`）

同梱/管理 Skills は、切り替えおよび env 値の供給が可能です：

```json5
{
  skills: {
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
        config: {
          endpoint: "https://example.invalid",
          model: "nano-pro",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

注：Skill 名にハイフンが含まれる場合、キーを引用符で囲んでください（JSON5 は引用符付きキーを許可します）。

設定キーはデフォルトで **Skill 名**に一致します。Skill が `metadata.openclaw.skillKey` を定義している場合は、`skills.entries` 配下でそのキーを使用してください。

ルール：

- `enabled: false` は、同梱/インストール済みであっても Skill を無効化します。
- `env`：変数がプロセス内で未設定の場合に **のみ**注入されます。
- `apiKey`：`metadata.openclaw.primaryEnv` を宣言する Skills のための利便機能です。
- `config`：Skill ごとのカスタムフィールド用の任意のバッグです。カスタムキーはここに置く必要があります。
- `allowBundled`：**同梱** Skills のみの任意の許可リストです。設定されている場合、リスト内の同梱 Skills のみが適格です（管理/ワークスペース Skills には影響しません）。

## 環境変数の注入（エージェント実行ごと）

エージェント実行が開始すると、OpenClaw は次を行います。

1. Skill メタデータを読み取ります。
2. `skills.entries.<key>.env` または `skills.entries.<key>.apiKey` を `process.env` に適用します。
3. **適格**な Skills でシステムプロンプトを構築します。
4. 実行終了後に元の環境を復元します。

これは **エージェント実行にスコープ**されており、グローバルなシェル環境ではありません。

## セッションスナップショット（性能）

OpenClaw は、**セッション開始時**に適格な Skills をスナップショットし、同一セッション内の後続ターンではそのリストを再利用します。Skills または設定の変更は、次に新しいセッションが開始されると反映されます。

Skills は、Skills ウォッチャーが有効な場合、または新しい適格なリモートノードが出現した場合（下記参照）にもセッション途中で更新できます。これは **ホットリロード**と考えてください。更新されたリストは次のエージェントターンで取り込まれます。

## リモート macOS ノード（Linux gateway）

Gateway（ゲートウェイ）が Linux 上で動作している一方で、**macOS ノード**が **`system.run` が許可された状態で**接続されている場合（Exec approvals のセキュリティが `deny` に設定されていない）、OpenClaw は、そのノード上に必要なバイナリが存在するときに macOS 専用 Skills を適格として扱えます。エージェントは、それらの Skills を `nodes` ツール（通常は `nodes.run`）経由で実行するべきです。

これは、ノードが自身のコマンド対応を報告することと、`system.run` による bin プローブに依存します。後で macOS ノードがオフラインになった場合でも Skills は表示されたままですが、ノードが再接続するまで呼び出しが失敗する可能性があります。

## Skills watcher（自動更新）

デフォルトでは、OpenClaw は Skill フォルダを監視し、`SKILL.md` ファイルが変更されたときに Skills スナップショットを更新します。これは `skills.load` 配下で設定します：

```json5
{
  skills: {
    load: {
      watch: true,
      watchDebounceMs: 250,
    },
  },
}
```

## トークンへの影響（Skills リスト）

Skills が適格な場合、OpenClaw は利用可能な Skills のコンパクトな XML リストをシステムプロンプトへ注入します（`pi-coding-agent` 内の `formatSkillsForPrompt` 経由）。コストは決定的です。

- **ベースのオーバーヘッド（Skill が 1 つ以上のときのみ）：** 195 文字。
- **Skill ごと：** 97 文字 + XML エスケープされた `<name>`、`<description>`、`<location>` 値の長さ。

式（文字数）：

```
total = 195 + Σ (97 + len(name_escaped) + len(description_escaped) + len(location_escaped))
```

注記：

- XML エスケープにより `& < > " '` はエンティティ（`&amp;`、`&lt;` など）へ展開され、長さが増加します。
- トークン数はモデルのトークナイザによって変動します。OpenAI 風の概算は約 4 文字/トークンなので、Skill ごとに **97 文字 ≈ 24 トークン**に加えて実際のフィールド長が上乗せされます。

## 管理 Skills のライフサイクル

OpenClaw は、インストール（npm パッケージまたは OpenClaw.app）の一部として、ベースラインの Skills セットを **同梱 Skills** として提供します。ローカル上書きのために `~/.openclaw/skills` が存在します（例：同梱コピーを変更せずに Skill をピン留め/パッチ適用する）。ワークスペース Skills はユーザー所有であり、名前の競合時には両者を上書きします。

## 設定リファレンス

完全な設定スキーマについては、[Skills config](/tools/skills-config) を参照してください。

## さらに Skills をお探しですか？

https://clawhub.com を閲覧してください。

---
