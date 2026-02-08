---
summary: "モデル CLI: 一覧、設定、エイリアス、フォールバック、スキャン、ステータス"
read_when:
  - モデル CLI（models list/set/scan/aliases/fallbacks）を追加または変更する場合
  - モデルのフォールバック挙動または選択 UX を変更する場合
  - モデルスキャンのプローブ（ツール/画像）を更新する場合
title: "モデル CLI"
x-i18n:
  source_path: concepts/models.md
  source_hash: c4eeb0236c645b55
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:06:40Z
---

# モデル CLI

認証プロファイルのローテーション、クールダウン、およびそれらがフォールバックとどう相互作用するかは、[/concepts/model-failover](/concepts/model-failover) を参照してください。
プロバイダーの概要 + 例は、[/concepts/model-providers](/concepts/model-providers) を参照してください。

## モデル選択の仕組み

OpenClaw は次の順序でモデルを選択します。

1. **プライマリ** モデル（`agents.defaults.model.primary` または `agents.defaults.model`）。
2. `agents.defaults.model.fallbacks` 内の **フォールバック**（順番どおり）。
3. **プロバイダー認証のフェイルオーバー** は、次のモデルへ移る前に、同一プロバイダー内で行われます。

関連:

- `agents.defaults.models` は、OpenClaw が使用できるモデル（+ エイリアス）の許可リスト/カタログです。
- `agents.defaults.imageModel` は、プライマリモデルが画像を受け付けられない場合に **のみ** 使用されます。
- エージェントごとのデフォルトは、`agents.list[].model` とバインディングにより `agents.defaults.model` を上書きできます（[/concepts/multi-agent](/concepts/multi-agent) を参照）。

## クイックなモデル選び（経験則）

- **GLM**: コーディング/ツール呼び出しが少し良いです。
- **MiniMax**: 文章作成や雰囲気が良いです。

## セットアップウィザード（推奨）

設定を手編集したくない場合は、オンボーディングウィザードを実行してください。

```bash
openclaw onboard
```

これは一般的なプロバイダー向けに、モデル + 認証をセットアップできます。対象には **OpenAI Code（Codex） サブスクリプション**（OAuth）と **Anthropic**（API キー推奨。`claude setup-token` もサポート）が含まれます。

## 設定キー（概要）

- `agents.defaults.model.primary` と `agents.defaults.model.fallbacks`
- `agents.defaults.imageModel.primary` と `agents.defaults.imageModel.fallbacks`
- `agents.defaults.models`（許可リスト + エイリアス + プロバイダーパラメータ）
- `models.providers`（`models.json` に書き込まれるカスタムプロバイダー）

モデル参照は小文字に正規化されます。`z.ai/*` のようなプロバイダーエイリアスは `zai/*` に正規化されます。

プロバイダー設定例（OpenCode Zen を含む）は、[/gateway/configuration](/gateway/configuration#opencode-zen-multi-model-proxy) にあります。

## 「モデルが許可されていません」（そして返信が止まる理由）

`agents.defaults.models` が設定されている場合、これは `/model` とセッション上書きの **許可リスト** になります。ユーザーがその許可リストにないモデルを選択すると、OpenClaw は次を返します。

```
Model "provider/model" is not allowed. Use /model to list available models.
```

これは通常の返信が生成される **前** に発生するため、メッセージが「応答しなかった」ように感じられることがあります。対処法は次のいずれかです。

- モデルを `agents.defaults.models` に追加する、または
- 許可リストをクリアする（`agents.defaults.models` を削除する）、または
- `/model list` からモデルを選ぶ

許可リスト設定例:

```json5
{
  agent: {
    model: { primary: "anthropic/claude-sonnet-4-5" },
    models: {
      "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
      "anthropic/claude-opus-4-6": { alias: "Opus" },
    },
  },
}
```

## チャットでモデルを切り替える（`/model`）

再起動せずに、現在のセッションのモデルを切り替えられます。

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model status
```

注記:

- `/model`（および `/model list`）は、コンパクトな番号付きピッカー（モデルファミリー + 利用可能なプロバイダー）です。
- `/model <#>` は、そのピッカーから選択します。
- `/model status` は詳細表示（認証候補、および設定されている場合はプロバイダーエンドポイント `baseUrl` + `api` モード）です。
- モデル参照は、**最初の** `/` で分割してパースされます。`/model <ref>` を入力するときは `provider/model` を使用してください。
- モデル ID 自体に `/`（OpenRouter 形式）が含まれる場合、プロバイダープレフィックスを含める必要があります（例: `/model openrouter/moonshotai/kimi-k2`）。
- プロバイダーを省略すると、OpenClaw は入力をエイリアス、または **デフォルトプロバイダー** のモデルとして扱います（モデル ID に `/` がない場合にのみ動作します）。

コマンドの完全な挙動/設定: [Slash commands](/tools/slash-commands)。

## CLI コマンド

```bash
openclaw models list
openclaw models status
openclaw models set <provider/model>
openclaw models set-image <provider/model>

openclaw models aliases list
openclaw models aliases add <alias> <provider/model>
openclaw models aliases remove <alias>

openclaw models fallbacks list
openclaw models fallbacks add <provider/model>
openclaw models fallbacks remove <provider/model>
openclaw models fallbacks clear

openclaw models image-fallbacks list
openclaw models image-fallbacks add <provider/model>
openclaw models image-fallbacks remove <provider/model>
openclaw models image-fallbacks clear
```

`openclaw models`（サブコマンドなし）は、`models status` のショートカットです。

### `models list`

デフォルトでは設定済みのモデルを表示します。便利なフラグ:

- `--all`: 完全なカタログ
- `--local`: ローカルプロバイダーのみ
- `--provider <name>`: プロバイダーでフィルタ
- `--plain`: 1 行につき 1 モデル
- `--json`: 機械可読な出力

### `models status`

解決済みのプライマリモデル、フォールバック、画像モデル、および設定済みプロバイダーの認証概要を表示します。また、認証ストアで見つかったプロファイルの OAuth 期限ステータスも表示します（デフォルトでは 24 時間以内を警告）。`--plain` は解決済みのプライマリモデルのみを出力します。
OAuth ステータスは常に表示されます（`--json` 出力にも含まれます）。設定済みプロバイダーに認証情報がない場合、`models status` は **認証がありません** セクションを出力します。
JSON には `auth.oauth`（警告ウィンドウ + プロファイル）および `auth.providers`（プロバイダーごとの有効な認証）が含まれます。
自動化には `--check` を使用してください（不足/期限切れの場合は exit `1`、期限が近い場合は `2`）。

推奨される Anthropic 認証は Claude Code CLI の setup-token です（どこで実行してもよく、必要なら Gateway（ゲートウェイ）ホストに貼り付けます）。

```bash
claude setup-token
openclaw models status
```

## スキャン（OpenRouter の無料モデル）

`openclaw models scan` は OpenRouter の **無料モデルカタログ** を検査し、任意でモデルをプローブしてツール/画像サポートを確認できます。

主なフラグ:

- `--no-probe`: ライブプローブをスキップ（メタデータのみ）
- `--min-params <b>`: 最小パラメータサイズ（10 億単位）
- `--max-age-days <days>`: 古いモデルをスキップ
- `--provider <name>`: プロバイダープレフィックスフィルタ
- `--max-candidates <n>`: フォールバックリストのサイズ
- `--set-default`: `agents.defaults.model.primary` を最初の選択に設定
- `--set-image`: `agents.defaults.imageModel.primary` を最初の画像選択に設定

プローブには OpenRouter API キー（認証プロファイルまたは `OPENROUTER_API_KEY`）が必要です。キーがない場合は、候補のみを一覧表示するために `--no-probe` を使用してください。

スキャン結果のランキング基準:

1. 画像サポート
2. ツールレイテンシ
3. コンテキストサイズ
4. パラメータ数

入力

- OpenRouter の `/models` リスト（`:free` でフィルタ）
- 認証プロファイルまたは `OPENROUTER_API_KEY`（[/environment](/environment) を参照）からの OpenRouter API キーが必要です
- 任意フィルタ: `--max-age-days`、`--min-params`、`--provider`、`--max-candidates`
- プローブ制御: `--timeout`、`--concurrency`

TTY で実行する場合、フォールバックを対話的に選択できます。非対話モードでは、デフォルトを受け入れるために `--yes` を渡してください。

## モデルレジストリ（`models.json`）

`models.providers` 内のカスタムプロバイダーは、エージェントディレクトリ（デフォルトは `~/.openclaw/agents/<agentId>/models.json`）配下の `models.json` に書き込まれます。このファイルは、`models.mode` が `replace` に設定されていない限り、デフォルトでマージされます。
