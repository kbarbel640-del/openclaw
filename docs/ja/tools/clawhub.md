---
summary: "ClawHub ガイド: 公開 Skills レジストリ + CLI ワークフロー"
read_when:
  - ClawHub を新規ユーザーに紹介する場合
  - Skills のインストール、検索、または公開
  - ClawHub CLI フラグと同期挙動の説明
title: "ClawHub"
x-i18n:
  source_path: tools/clawhub.md
  source_hash: b572473a11246357
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:33Z
---

# ClawHub

ClawHub は **OpenClaw の公開スキルレジストリ**です。無料のサービスで、すべての Skills は公開されており、オープンで、共有と再利用のために誰からも閲覧できます。スキルは、`SKILL.md` ファイル（および補助的なテキストファイル）を含む単なるフォルダです。Web アプリで Skills を閲覧することも、CLI を使って Skills の検索、インストール、更新、公開を行うこともできます。

サイト: [clawhub.ai](https://clawhub.ai)

## ClawHub とは

- OpenClaw Skills の公開レジストリです。
- スキルバンドルとメタデータのバージョン管理されたストアです。
- 検索、タグ、利用シグナルのための発見サーフェスです。

## 仕組み

1. ユーザーがスキルバンドル（ファイル + メタデータ）を公開します。
2. ClawHub がバンドルを保存し、メタデータを解析し、バージョンを割り当てます。
3. レジストリがスキルを検索と発見のためにインデックス化します。
4. ユーザーが OpenClaw で Skills を閲覧、ダウンロード、インストールします。

## できること

- 新しい Skills および既存 Skills の新バージョンを公開します。
- 名前、タグ、または検索で Skills を発見します。
- スキルバンドルをダウンロードし、そのファイルを検査します。
- 悪用的または危険な Skills を報告します。
- モデレーターの場合は、非表示、表示、削除、またはバンを行えます。

## 対象（初心者向け）

OpenClaw エージェントに新しい機能を追加したい場合、ClawHub は Skills を見つけてインストールする最も簡単な方法です。バックエンドの仕組みを知る必要はありません。次のことができます。

- 平易な言葉で Skills を検索します。
- ワークスペースにスキルをインストールします。
- 後で 1 つのコマンドで Skills を更新します。
- 自分の Skills を公開してバックアップします。

## クイックスタート（非技術者向け）

1. CLI をインストールします（次のセクションを参照）。
2. 必要なものを検索します:
   - `clawhub search "calendar"`
3. スキルをインストールします:
   - `clawhub install <skill-slug>`
4. 新しいスキルが取り込まれるように、新しい OpenClaw セッションを開始します。

## CLI をインストールする

次のいずれかを選択します:

```bash
npm i -g clawhub
```

```bash
pnpm add -g clawhub
```

## OpenClaw への組み込み

デフォルトでは、CLI は現在の作業ディレクトリ配下の `./skills` に Skills をインストールします。OpenClaw ワークスペースが設定されている場合、`clawhub` は `--workdir`（または `CLAWHUB_WORKDIR`）で上書きしない限り、そのワークスペースにフォールバックします。OpenClaw はワークスペース Skills を `<workspace>/skills` から読み込み、**次の**セッションで取り込みます。すでに `~/.openclaw/skills` またはバンドルされた Skills を使用している場合でも、ワークスペース Skills が優先されます。

Skills の読み込み、共有、ゲートのされ方についての詳細は、以下を参照してください
[Skills](/tools/skills)。

## スキルシステムの概要

スキルは、OpenClaw に特定のタスクの実行方法を教える、ファイルのバージョン管理されたバンドルです。公開のたびに新しいバージョンが作成され、レジストリはバージョン履歴を保持するため、ユーザーは変更を監査できます。

典型的なスキルには次が含まれます:

- 主な説明と使用方法を含む `SKILL.md` ファイル。
- スキルが使用する任意の設定、スクリプト、または補助ファイル。
- タグ、要約、インストール要件などのメタデータ。

ClawHub はメタデータを使用して発見を支援し、スキル機能を安全に公開します。レジストリはランキングと可視性を改善するために、利用シグナル（スターやダウンロードなど）も追跡します。

## サービスが提供するもの（機能）

- Skills およびその `SKILL.md` 内容の **公開ブラウジング**。
- キーワードだけでなく、埋め込み（ベクター検索）によって実現される **検索**。
- semver、変更履歴、タグ（`latest` を含む）による **バージョン管理**。
- バージョンごとの zip としての **ダウンロード**。
- コミュニティのフィードバックのための **スターとコメント**。
- 承認と監査のための **モデレーション** フック。
- 自動化とスクリプト化のための **CLI フレンドリーな API**。

## セキュリティとモデレーション

ClawHub はデフォルトでオープンです。誰でも Skills をアップロードできますが、公開するには GitHub アカウントが少なくとも 1 週間以上経過している必要があります。これにより、正当な貢献者を妨げることなく、悪用の抑止に役立ちます。

報告とモデレーション:

- サインインしているユーザーであれば誰でもスキルを報告できます。
- 報告理由は必須で、記録されます。
- 各ユーザーは同時に最大 20 件のアクティブな報告を持てます。
- 3 件を超えるユニークな報告がある Skills は、デフォルトで自動的に非表示になります。
- モデレーターは非表示の Skills を閲覧し、表示に戻す、削除する、またはユーザーをバンできます。
- 報告機能の悪用はアカウントのバンにつながる可能性があります。

モデレーターになることに興味がありますか？OpenClaw Discord で質問し、モデレーターまたはメンテナーに連絡してください。

## CLI コマンドとパラメーター

グローバルオプション（すべてのコマンドに適用）:

- `--workdir <dir>`: 作業ディレクトリ（デフォルト: カレントディレクトリ。OpenClaw ワークスペースにフォールバック）。
- `--dir <dir>`: workdir からの相対パスの Skills ディレクトリ（デフォルト: `skills`）。
- `--site <url>`: サイトのベース URL（ブラウザログイン）。
- `--registry <url>`: レジストリ API のベース URL。
- `--no-input`: プロンプトを無効化（非インタラクティブ）。
- `-V, --cli-version`: CLI バージョンを出力します。

認証:

- `clawhub login`（ブラウザフロー）または `clawhub login --token <token>`
- `clawhub logout`
- `clawhub whoami`

オプション:

- `--token <token>`: API トークンを貼り付けます。
- `--label <label>`: ブラウザログイントークンに保存されるラベル（デフォルト: `CLI token`）。
- `--no-browser`: ブラウザを開きません（`--token` が必要）。

検索:

- `clawhub search "query"`
- `--limit <n>`: 最大結果数。

インストール:

- `clawhub install <slug>`
- `--version <version>`: 特定のバージョンをインストールします。
- `--force`: フォルダがすでに存在する場合に上書きします。

更新:

- `clawhub update <slug>`
- `clawhub update --all`
- `--version <version>`: 特定のバージョンに更新します（単一 slug のみ）。
- `--force`: ローカルファイルが公開済みのどのバージョンとも一致しない場合に上書きします。

一覧:

- `clawhub list`（`.clawhub/lock.json` を読み取ります）

公開:

- `clawhub publish <path>`
- `--slug <slug>`: スキル slug。
- `--name <name>`: 表示名。
- `--version <version>`: semver バージョン。
- `--changelog <text>`: 変更履歴テキスト（空でも可）。
- `--tags <tags>`: カンマ区切りのタグ（デフォルト: `latest`）。

削除/削除取り消し（オーナー/管理者のみ）:

- `clawhub delete <slug> --yes`
- `clawhub undelete <slug> --yes`

同期（ローカル Skills をスキャン + 新規/更新を公開）:

- `clawhub sync`
- `--root <dir...>`: 追加のスキャンルート。
- `--all`: プロンプトなしで全てをアップロードします。
- `--dry-run`: アップロードされる内容を表示します。
- `--bump <type>`: 更新のための `patch|minor|major`（デフォルト: `patch`）。
- `--changelog <text>`: 非インタラクティブ更新向けの変更履歴。
- `--tags <tags>`: カンマ区切りのタグ（デフォルト: `latest`）。
- `--concurrency <n>`: レジストリチェック（デフォルト: 4）。

## エージェント向けの一般的なワークフロー

### Skills を検索する

```bash
clawhub search "postgres backups"
```

### 新しい Skills をダウンロードする

```bash
clawhub install my-skill-pack
```

### インストール済み Skills を更新する

```bash
clawhub update --all
```

### Skills をバックアップする（公開または同期）

単一のスキルフォルダの場合:

```bash
clawhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0 --tags latest
```

一度に多数の Skills をスキャンしてバックアップするには:

```bash
clawhub sync --all
```

## 高度な詳細（技術）

### バージョニングとタグ

- 公開のたびに新しい **semver** `SkillVersion` が作成されます。
- （`latest` のような）タグはバージョンを指します。タグを移動するとロールバックできます。
- 変更履歴はバージョンごとに付与され、同期や更新の公開時には空にできます。

### ローカル変更 vs レジストリバージョン

更新では、コンテンツハッシュを使ってローカルのスキル内容とレジストリのバージョンを比較します。ローカルファイルが公開済みのどのバージョンとも一致しない場合、CLI は上書き前に確認します（または非インタラクティブ実行では `--force` が必要です）。

### 同期スキャンとフォールバックルート

`clawhub sync` は最初に現在の workdir をスキャンします。Skills が見つからない場合、既知のレガシーな場所（例: `~/openclaw/skills` および `~/.openclaw/skills`）にフォールバックします。これは、追加のフラグなしで古いスキルインストールを見つけるための設計です。

### ストレージとロックファイル

- インストールされた Skills は、workdir 配下の `.clawhub/lock.json` に記録されます。
- 認証トークンは ClawHub CLI 設定ファイルに保存されます（`CLAWHUB_CONFIG_PATH` で上書き）。

### テレメトリー（インストール数）

ログイン中に `clawhub sync` を実行すると、CLI はインストール数を算出するための最小限のスナップショットを送信します。これを完全に無効化できます:

```bash
export CLAWHUB_DISABLE_TELEMETRY=1
```

## 環境変数

- `CLAWHUB_SITE`: サイト URL を上書きします。
- `CLAWHUB_REGISTRY`: レジストリ API URL を上書きします。
- `CLAWHUB_CONFIG_PATH`: CLI がトークン/設定を保存する場所を上書きします。
- `CLAWHUB_WORKDIR`: デフォルトの workdir を上書きします。
- `CLAWHUB_DISABLE_TELEMETRY=1`: `sync` のテレメトリーを無効化します。
