---
summary: "エージェントのワークスペース: 場所、レイアウト、バックアップ戦略"
read_when:
  - エージェントのワークスペース、またはそのファイルレイアウトを説明する必要がある場合
  - エージェントのワークスペースをバックアップまたは移行したい場合
title: "エージェントのワークスペース"
x-i18n:
  source_path: concepts/agent-workspace.md
  source_hash: 84c550fd89b5f247
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:02:04Z
---

# エージェントのワークスペース

ワークスペースは、エージェントのホームです。ファイルツールおよびワークスペースコンテキストに使用される唯一の作業ディレクトリです。非公開に保ち、メモリとして扱ってください。

これは、設定、認証情報、セッションを保存する `~/.openclaw/` とは別物です。

**重要:** ワークスペースは **デフォルトの cwd** であり、強制的なサンドボックスではありません。ツールは相対パスをワークスペース基準で解決しますが、サンドボックス化が有効でない限り、絶対パスはホスト上の別の場所へ到達できます。分離が必要な場合は、[`agents.defaults.sandbox`](/gateway/sandboxing)（および/またはエージェントごとのサンドボックス設定）を使用してください。サンドボックス化が有効で、かつ `workspaceAccess` が `"rw"` でない場合、ツールはホストのワークスペースではなく、`~/.openclaw/sandboxes` 配下のサンドボックスワークスペース内で動作します。

## デフォルトの場所

- デフォルト: `~/.openclaw/workspace`
- `OPENCLAW_PROFILE` が設定されていて `"default"` でない場合、デフォルトは `~/.openclaw/workspace-<profile>` になります。
- `~/.openclaw/openclaw.json` で上書きします:

```json5
{
  agent: {
    workspace: "~/.openclaw/workspace",
  },
}
```

`openclaw onboard`、`openclaw configure`、または `openclaw setup` は、ワークスペースを作成し、不足している場合はブートストラップファイルをシードします。

すでにワークスペースファイルを自分で管理している場合は、ブートストラップファイル作成を無効にできます:

```json5
{ agent: { skipBootstrap: true } }
```

## 追加のワークスペースフォルダー

古いインストールでは `~/openclaw` が作成されている場合があります。複数のワークスペースディレクトリを残しておくと、同時にアクティブになるワークスペースは 1 つだけであるため、認証や状態のドリフトが紛らわしくなることがあります。

**推奨:** アクティブなワークスペースは 1 つにしてください。追加フォルダーをもう使わない場合は、アーカイブするか、ゴミ箱へ移動してください（例: `trash ~/openclaw`）。意図的に複数のワークスペースを保持する場合は、`agents.defaults.workspace` がアクティブなものを指していることを確認してください。

`openclaw doctor` は、追加のワークスペースディレクトリを検出すると警告します。

## ワークスペースのファイルマップ（各ファイルの意味）

以下は、OpenClaw がワークスペース内にあることを想定している標準ファイルです:

- `AGENTS.md`
  - エージェント向けの運用手順と、メモリをどのように使うべきかの説明です。
  - すべてのセッション開始時に読み込まれます。
  - ルール、優先順位、「どう振る舞うか」の詳細を書くのに適しています。

- `SOUL.md`
  - ペルソナ、口調、境界です。
  - 毎セッション読み込まれます。

- `USER.md`
  - ユーザーが誰で、どのように呼びかけるべきかです。
  - 毎セッション読み込まれます。

- `IDENTITY.md`
  - エージェントの名前、雰囲気、絵文字です。
  - ブートストラップ儀式中に作成/更新されます。

- `TOOLS.md`
  - ローカルツールと慣習に関するメモです。
  - ツールの利用可否を制御するものではなく、あくまでガイダンスです。

- `HEARTBEAT.md`
  - ハートビート実行向けの任意の小さなチェックリストです。
  - トークン消費を避けるため短くしてください。

- `BOOT.md`
  - 内部フックが有効なときに Gateway（ゲートウェイ）の再起動時に実行される、任意の起動チェックリストです。
  - 短くしてください。外向き送信には message ツールを使用してください。

- `BOOTSTRAP.md`
  - 初回実行の 1 回限りの儀式です。
  - 新規ワークスペースにのみ作成されます。
  - 儀式が完了したら削除してください。

- `memory/YYYY-MM-DD.md`
  - 日次メモリログ（1 日につき 1 ファイル）です。
  - セッション開始時に今日 + 昨日を読むことを推奨します。

- `MEMORY.md`（任意）
  - 厳選した長期メモリです。
  - メインの非公開セッションでのみ読み込んでください（共有/グループコンテキストでは読み込まないでください）。

ワークフローと自動メモリフラッシュについては、[Memory](/concepts/memory) を参照してください。

- `skills/`（任意）
  - ワークスペース固有の Skills です。
  - 名前が衝突した場合、管理/バンドルされた Skills を上書きします。

- `canvas/`（任意）
  - ノード表示向けの Canvas UI ファイルです（例: `canvas/index.html`）。

ブートストラップファイルが欠けている場合、OpenClaw はセッションに「missing file」マーカーを注入して続行します。大きなブートストラップファイルは注入時に切り詰められます。制限は `agents.defaults.bootstrapMaxChars`（デフォルト: 20000）で調整してください。`openclaw setup` は、既存ファイルを上書きせずに不足しているデフォルトを再作成できます。

## ワークスペースに「含まれない」もの

以下は `~/.openclaw/` 配下にあり、ワークスペースのリポジトリにコミットすべきではありません:

- `~/.openclaw/openclaw.json`（設定）
- `~/.openclaw/credentials/`（OAuth トークン、API キー）
- `~/.openclaw/agents/<agentId>/sessions/`（セッションの文字起こし + メタデータ）
- `~/.openclaw/skills/`（管理された Skills）

セッションや設定を移行する必要がある場合は、それらを別途コピーし、バージョン管理から除外してください。

## Git によるバックアップ（推奨、非公開）

ワークスペースは非公開メモリとして扱ってください。**非公開**の git リポジトリに入れて、バックアップおよび復旧可能にします。

以下の手順は Gateway（ゲートウェイ）が動作しているマシンで実行してください（ワークスペースはそこにあります）。

### 1) リポジトリを初期化する

git がインストールされている場合、真新しいワークスペースは自動で初期化されます。このワークスペースがまだリポジトリでない場合は、次を実行してください:

```bash
cd ~/.openclaw/workspace
git init
git add AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md HEARTBEAT.md memory/
git commit -m "Add agent workspace"
```

### 2) 非公開リモートを追加する（初心者向けオプション）

オプション A: GitHub web UI

1. GitHub で新しい **private** リポジトリを作成します。
2. README で初期化しないでください（マージ競合を避けます）。
3. HTTPS のリモート URL をコピーします。
4. リモートを追加して push します:

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

オプション B: GitHub CLI（`gh`）

```bash
gh auth login
gh repo create openclaw-workspace --private --source . --remote origin --push
```

オプション C: GitLab web UI

1. GitLab で新しい **private** リポジトリを作成します。
2. README で初期化しないでください（マージ競合を避けます）。
3. HTTPS のリモート URL をコピーします。
4. リモートを追加して push します:

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

### 3) 継続的な更新

```bash
git status
git add .
git commit -m "Update memory"
git push
```

## シークレットをコミットしないでください

非公開リポジトリであっても、ワークスペースにシークレットを保存することは避けてください:

- API キー、OAuth トークン、パスワード、または非公開の認証情報。
- `~/.openclaw/` 配下のもの。
- チャットや機密の添付ファイルの生データダンプ。

機密の参照を保存せざるを得ない場合は、プレースホルダーを使用し、実際のシークレットは別の場所（パスワードマネージャー、環境変数、または `~/.openclaw/`）に保管してください。

推奨される `.gitignore` のスターター:

```gitignore
.DS_Store
.env
**/*.key
**/*.pem
**/secrets*
```

## 新しいマシンへワークスペースを移動する

1. 目的のパス（デフォルトは `~/.openclaw/workspace`）へリポジトリを clone します。
2. `~/.openclaw/openclaw.json` で `agents.defaults.workspace` をそのパスに設定します。
3. 不足しているファイルをシードするために `openclaw setup --workspace <path>` を実行します。
4. セッションが必要な場合は、古いマシンから `~/.openclaw/agents/<agentId>/sessions/` を別途コピーします。

## 高度な注意事項

- マルチエージェントルーティングでは、エージェントごとに異なるワークスペースを使用できます。ルーティング設定については、[Channel routing](/concepts/channel-routing) を参照してください。
- `agents.defaults.sandbox` が有効な場合、メイン以外のセッションは `agents.defaults.sandbox.workspaceRoot` 配下のセッションごとのサンドボックスワークスペースを使用できます。
