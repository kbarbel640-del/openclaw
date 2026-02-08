---
summary: "`openclaw update` の CLI リファレンス（安全寄りのソース更新 + Gateway（ゲートウェイ）の自動再起動）"
read_when:
  - ソースのチェックアウトを安全に更新したい場合
  - `--update` のショートハンド動作を理解する必要がある場合
title: "update"
x-i18n:
  source_path: cli/update.md
  source_hash: 3a08e8ac797612c4
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:01:27Z
---

# `openclaw update`

OpenClaw を安全に更新し、stable/beta/dev チャンネル間を切り替えます。

**npm/pnpm**（グローバルインストール、git メタデータなし）でインストールした場合、更新は [Updating](/install/updating) のパッケージマネージャーフローで行われます。

## Usage

```bash
openclaw update
openclaw update status
openclaw update wizard
openclaw update --channel beta
openclaw update --channel dev
openclaw update --tag beta
openclaw update --no-restart
openclaw update --json
openclaw --update
```

## Options

- `--no-restart`: 更新が成功した後の Gateway（ゲートウェイ）サービスの再起動をスキップします。
- `--channel <stable|beta|dev>`: 更新チャンネルを設定します（git + npm；設定に永続化されます）。
- `--tag <dist-tag|version>`: この更新に限り、npm の dist-tag またはバージョンを上書きします。
- `--json`: 機械可読な `UpdateRunResult` JSON を出力します。
- `--timeout <seconds>`: ステップごとのタイムアウト（デフォルトは 1200s）。

注: ダウングレードは、古いバージョンが設定を破壊する可能性があるため、確認が必要です。

## `update status`

アクティブな更新チャンネル + git のタグ/ブランチ/SHA（ソースチェックアウトの場合）に加え、更新の可用性を表示します。

```bash
openclaw update status
openclaw update status --json
openclaw update status --timeout 10
```

Options:

- `--json`: 機械可読なステータス JSON を出力します。
- `--timeout <seconds>`: チェックのタイムアウト（デフォルトは 3s）。

## `update wizard`

更新チャンネルを選択し、更新後に Gateway（ゲートウェイ）を再起動するかどうかを確認する（デフォルトは再起動）対話型フローです。git チェックアウトがない状態で `dev` を選ぶと、作成するかどうかを提案します。

## What it does

チャンネルを明示的に切り替えると（`--channel ...`）、OpenClaw はインストール方法も整合させます。

- `dev` → git チェックアウトを確保し（デフォルト: `~/openclaw`、`OPENCLAW_GIT_DIR` で上書き）、それを更新して、そのチェックアウトからグローバル CLI をインストールします。
- `stable`/`beta` → 対応する dist-tag を使って npm からインストールします。

## Git checkout flow

Channels:

- `stable`: 最新の non-beta タグをチェックアウトし、その後に build + doctor を実行します。
- `beta`: 最新の `-beta` タグをチェックアウトし、その後に build + doctor を実行します。
- `dev`: `main` をチェックアウトし、その後に fetch + rebase を実行します。

High-level:

1. クリーンな worktree（未コミットの変更がないこと）が必要です。
2. 選択したチャンネル（タグまたはブランチ）に切り替えます。
3. upstream を fetch します（dev のみ）。
4. dev のみ: 一時 worktree でプレフライトの lint + TypeScript build を実行します。先端が失敗した場合は、最新のクリーンな build を見つけるために最大 10 コミットまで遡ります。
5. 選択したコミットへ rebase します（dev のみ）。
6. 依存関係をインストールします（pnpm 優先；npm フォールバック）。
7. build + Control UI を build します。
8. 最終の「安全な更新」チェックとして `openclaw doctor` を実行します。
9. プラグインをアクティブなチャンネルへ同期します（dev は同梱拡張機能を使用；stable/beta は npm を使用）し、npm インストールのプラグインを更新します。

## `--update` shorthand

`openclaw --update` は `openclaw update` に書き換えられます（シェルやランチャースクリプトに便利です）。

## See also

- `openclaw doctor`（git チェックアウトでは、先に update を実行する提案をします）
- [Development channels](/install/development-channels)
- [Updating](/install/updating)
- [CLI reference](/cli)
