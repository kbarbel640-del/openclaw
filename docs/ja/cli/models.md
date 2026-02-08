---
summary: "`openclaw models` の CLI リファレンス（status/list/set/scan、エイリアス、フォールバック、認証）"
read_when:
  - デフォルトモデルを変更したり、プロバイダーの認証ステータスを確認したい場合
  - 利用可能なモデル/プロバイダーをスキャンし、認証プロファイルのデバッグを行いたい場合
title: "models"
x-i18n:
  source_path: cli/models.md
  source_hash: 923b6ffc7de382ba
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:37Z
---

# `openclaw models`

モデルの検出、スキャン、設定（デフォルトモデル、フォールバック、認証プロファイル）。

関連:

- プロバイダー + モデル: [Models](/providers/models)
- プロバイダー認証のセットアップ: [はじめに](/start/getting-started)

## よく使うコマンド

```bash
openclaw models status
openclaw models list
openclaw models set <model-or-alias>
openclaw models scan
```

`openclaw models status` は、解決済みのデフォルト/フォールバックに加えて、認証の概要を表示します。
プロバイダーの使用状況スナップショットが利用可能な場合、OAuth/トークンのステータスセクションに
プロバイダー使用状況ヘッダーが含まれます。
`--probe` を追加すると、設定済みの各プロバイダープロファイルに対してライブ認証プローブを実行します。
プローブは実際のリクエストです（トークンを消費し、レート制限を引き起こす可能性があります）。
`--agent <id>` を使用すると、設定済みエージェントのモデル/認証状態を確認できます。省略した場合、
コマンドは、設定されていれば `OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR` を使用し、それ以外の場合は
設定済みのデフォルトエージェントを使用します。

注記:

- `models set <model-or-alias>` は `provider/model` またはエイリアスを受け付けます。
- モデル参照は、**最初の** `/` で分割して解析します。モデル ID に `/`（OpenRouter 形式）が含まれる場合は、プロバイダー接頭辞を含めてください（例: `openrouter/moonshotai/kimi-k2`）。
- プロバイダーを省略すると、OpenClaw は入力をエイリアス、または **デフォルトプロバイダー** のモデルとして扱います（モデル ID に `/` が存在しない場合にのみ機能します）。

### `models status`

オプション:

- `--json`
- `--plain`
- `--check`（終了コード 1=期限切れ/不足、2=期限が近い）
- `--probe`（設定済み認証プロファイルのライブプローブ）
- `--probe-provider <name>`（1 つのプロバイダーをプローブ）
- `--probe-profile <id>`（繰り返し、またはカンマ区切りのプロファイル ID）
- `--probe-timeout <ms>`
- `--probe-concurrency <n>`
- `--probe-max-tokens <n>`
- `--agent <id>`（設定済みエージェント ID。`OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR` を上書きします）

## エイリアス + フォールバック

```bash
openclaw models aliases list
openclaw models fallbacks list
```

## 認証プロファイル

```bash
openclaw models auth add
openclaw models auth login --provider <id>
openclaw models auth setup-token
openclaw models auth paste-token
```

`models auth login` は、プロバイダープラグインの認証フロー（OAuth/API キー）を実行します。
`openclaw plugins list` を使用して、インストール済みのプロバイダーを確認してください。

注記:

- `setup-token` は setup-token の値を求めます（どのマシンでも `claude setup-token` で生成できます）。
- `paste-token` は、別の場所で生成されたトークン文字列、または自動化から渡されたトークン文字列を受け付けます。
