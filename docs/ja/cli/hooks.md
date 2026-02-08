---
summary: "エージェントフック向け `openclaw hooks` の CLI リファレンス"
read_when:
  - エージェントフックを管理したい場合
  - フックをインストールまたは更新したい場合
title: "hooks"
x-i18n:
  source_path: cli/hooks.md
  source_hash: e2032e61ff4b9135
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:51Z
---

# `openclaw hooks`

エージェントフック（`/new`、`/reset`、および Gateway（ゲートウェイ）の起動などのコマンド向けのイベント駆動オートメーション）を管理します。

関連:

- フック: [Hooks](/hooks)
- プラグインフック: [Plugins](/plugin#plugin-hooks)

## すべてのフックを一覧表示

```bash
openclaw hooks list
```

ワークスペース、managed、および bundled ディレクトリから検出されたすべてのフックを一覧表示します。

**オプション:**

- `--eligible`: 適格なフック（要件を満たすもの）のみを表示します
- `--json`: JSON として出力します
- `-v, --verbose`: 不足している要件を含む詳細情報を表示します

**出力例:**

```
Hooks (4/4 ready)

Ready:
  🚀 boot-md ✓ - Run BOOT.md on gateway startup
  📝 command-logger ✓ - Log all command events to a centralized audit file
  💾 session-memory ✓ - Save session context to memory when /new command is issued
  😈 soul-evil ✓ - Swap injected SOUL content during a purge window or by random chance
```

**例（詳細）:**

```bash
openclaw hooks list --verbose
```

不適格なフックの不足要件を表示します。

**例（JSON）:**

```bash
openclaw hooks list --json
```

プログラムから利用するための構造化された JSON を返します。

## フック情報を取得

```bash
openclaw hooks info <name>
```

特定のフックに関する詳細情報を表示します。

**引数:**

- `<name>`: フック名（例: `session-memory`）

**オプション:**

- `--json`: JSON として出力します

**例:**

```bash
openclaw hooks info session-memory
```

**出力:**

```
💾 session-memory ✓ Ready

Save session context to memory when /new command is issued

Details:
  Source: openclaw-bundled
  Path: /path/to/openclaw/hooks/bundled/session-memory/HOOK.md
  Handler: /path/to/openclaw/hooks/bundled/session-memory/handler.ts
  Homepage: https://docs.openclaw.ai/hooks#session-memory
  Events: command:new

Requirements:
  Config: ✓ workspace.dir
```

## フックの適格性を確認

```bash
openclaw hooks check
```

フックの適格性ステータス（準備完了と未完了がそれぞれいくつか）を要約して表示します。

**オプション:**

- `--json`: JSON として出力します

**出力例:**

```
Hooks Status

Total hooks: 4
Ready: 4
Not ready: 0
```

## フックを有効化

```bash
openclaw hooks enable <name>
```

フックを設定（`~/.openclaw/config.json`）に追加して、特定のフックを有効化します。

**注:** プラグインによって管理されるフックは、`openclaw hooks list` 内で `plugin:<id>` を表示し、
ここでは有効化/無効化できません。代わりにプラグインを有効化/無効化してください。

**引数:**

- `<name>`: フック名（例: `session-memory`）

**例:**

```bash
openclaw hooks enable session-memory
```

**出力:**

```
✓ Enabled hook: 💾 session-memory
```

**実行内容:**

- フックが存在し、かつ適格であるかを確認します
- 設定内の `hooks.internal.entries.<name>.enabled = true` を更新します
- 設定をディスクに保存します

**有効化後:**

- Gateway（ゲートウェイ）を再起動してフックが再読み込みされるようにします（macOS ではメニューバーアプリを再起動、または dev では Gateway（ゲートウェイ）プロセスを再起動します）。

## フックを無効化

```bash
openclaw hooks disable <name>
```

設定を更新して、特定のフックを無効化します。

**引数:**

- `<name>`: フック名（例: `command-logger`）

**例:**

```bash
openclaw hooks disable command-logger
```

**出力:**

```
⏸ Disabled hook: 📝 command-logger
```

**無効化後:**

- Gateway（ゲートウェイ）を再起動してフックが再読み込みされるようにします

## フックをインストール

```bash
openclaw hooks install <path-or-spec>
```

ローカルのフォルダ/アーカイブ、または npm からフックパックをインストールします。

**実行内容:**

- フックパックを `~/.openclaw/hooks/<id>` にコピーします
- インストールしたフックを `hooks.internal.entries.*` で有効化します
- インストール内容を `hooks.internal.installs` 配下に記録します

**オプション:**

- `-l, --link`: コピーする代わりにローカルディレクトリをリンクします（`hooks.internal.load.extraDirs` に追加します）

**対応アーカイブ:** `.zip`、`.tgz`、`.tar.gz`、`.tar`

**例:**

```bash
# Local directory
openclaw hooks install ./my-hook-pack

# Local archive
openclaw hooks install ./my-hook-pack.zip

# NPM package
openclaw hooks install @openclaw/my-hook-pack

# Link a local directory without copying
openclaw hooks install -l ./my-hook-pack
```

## フックを更新

```bash
openclaw hooks update <id>
openclaw hooks update --all
```

インストール済みのフックパックを更新します（npm インストールのみ）。

**オプション:**

- `--all`: 追跡されているすべてのフックパックを更新します
- `--dry-run`: 書き込みを行わず、何が変わるかを表示します

## 同梱フック

### session-memory

`/new` を実行したときに、セッションコンテキストをメモリへ保存します。

**有効化:**

```bash
openclaw hooks enable session-memory
```

**出力:** `~/.openclaw/workspace/memory/YYYY-MM-DD-slug.md`

**参照:** [session-memory documentation](/hooks#session-memory)

### command-logger

すべてのコマンドイベントを集中監査ファイルにログとして記録します。

**有効化:**

```bash
openclaw hooks enable command-logger
```

**出力:** `~/.openclaw/logs/commands.log`

**ログを表示:**

```bash
# Recent commands
tail -n 20 ~/.openclaw/logs/commands.log

# Pretty-print
cat ~/.openclaw/logs/commands.log | jq .

# Filter by action
grep '"action":"new"' ~/.openclaw/logs/commands.log | jq .
```

**参照:** [command-logger documentation](/hooks#command-logger)

### soul-evil

パージ期間中またはランダムな確率で、注入された `SOUL.md` コンテンツを `SOUL_EVIL.md` に差し替えます。

**有効化:**

```bash
openclaw hooks enable soul-evil
```

**参照:** [SOUL Evil Hook](/hooks/soul-evil)

### boot-md

Gateway（ゲートウェイ）の起動時（チャンネル開始後）に `BOOT.md` を実行します。

**イベント**: `gateway:startup`

**有効化**:

```bash
openclaw hooks enable boot-md
```

**参照:** [boot-md documentation](/hooks#boot-md)
