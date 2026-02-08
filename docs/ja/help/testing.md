---
summary: "テストキット: ユニット / e2e / live スイート、Docker ランナー、および各テストがカバーする内容"
read_when:
  - ローカルまたは CI でテストを実行する場合
  - モデル / プロバイダーのバグに対するリグレッションを追加する場合
  - ゲートウェイ + エージェントの挙動をデバッグする場合
title: "テスト"
x-i18n:
  source_path: help/testing.md
  source_hash: 9bb77454e18e1d0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:26Z
---

# テスト

OpenClaw には、3 つの Vitest スイート（unit/integration、e2e、live）と、少数の Docker ランナーがあります。

このドキュメントは「どのようにテストしているか」を説明するガイドです。

- 各スイートが何をカバーするか（そして、意図的に _カバーしない_ もの）
- 一般的なワークフロー（ローカル、プッシュ前、デバッグ）で実行するコマンド
- live テストがどのように認証情報を検出し、モデル / プロバイダーを選択するか
- 実運用で見つかったモデル / プロバイダー問題に対するリグレッションの追加方法

## クイックスタート

普段は以下で十分です。

- フルゲート（プッシュ前に期待される）: `pnpm build && pnpm check && pnpm test`

テストを触った場合や、追加の信頼性が欲しい場合:

- カバレッジゲート: `pnpm test:coverage`
- E2E スイート: `pnpm test:e2e`

実在するプロバイダー / モデルをデバッグする場合（実際の認証情報が必要）:

- Live スイート（モデル + ゲートウェイのツール / 画像プローブ）: `pnpm test:live`

ヒント: 失敗ケースを 1 つだけ確認したい場合は、後述の allowlist 環境変数を使って live テストを絞り込むことを推奨します。

## テストスイート（どこで何が実行されるか）

各スイートは「現実性が増す」（同時に不安定さ / コストも増す）ものとして考えてください。

### Unit / integration（デフォルト）

- コマンド: `pnpm test`
- 設定: `vitest.config.ts`
- ファイル: `src/**/*.test.ts`
- 対象範囲:
  - 純粋なユニットテスト
  - プロセス内の統合テスト（ゲートウェイ認証、ルーティング、ツール、パース、設定）
  - 既知のバグに対する決定論的なリグレッション
- 期待事項:
  - CI で実行される
  - 実際のキーは不要
  - 高速かつ安定していること

### E2E（ゲートウェイスモーク）

- コマンド: `pnpm test:e2e`
- 設定: `vitest.e2e.config.ts`
- ファイル: `src/**/*.e2e.test.ts`
- 対象範囲:
  - 複数インスタンスのゲートウェイにおけるエンドツーエンドの挙動
  - WebSocket / HTTP のサーフェス、ノードペアリング、より重いネットワーク処理
- 期待事項:
  - パイプラインで有効な場合は CI で実行される
  - 実際のキーは不要
  - ユニットテストより構成要素が多く、遅くなることがある

### Live（実プロバイダー + 実モデル）

- コマンド: `pnpm test:live`
- 設定: `vitest.live.config.ts`
- ファイル: `src/**/*.live.test.ts`
- デフォルト: `pnpm test:live` により **有効**（`OPENCLAW_LIVE_TEST=1` を設定）
- 対象範囲:
  - 「このプロバイダー / モデルは、今日、実際の認証情報で動作するか？」
  - プロバイダーのフォーマット変更、ツール呼び出しの癖、認証問題、レート制限挙動の検出
- 期待事項:
  - 設計上 CI では安定しない（実ネットワーク、実プロバイダー方針、クォータ、障害）
  - コストが発生 / レート制限を消費する
  - 「すべて」を実行するより、絞り込んだサブセットを推奨
  - Live 実行時は、不足している API キーを取得するために `~/.profile` を読み込む
  - Anthropic のキー回転: `OPENCLAW_LIVE_ANTHROPIC_KEYS="sk-...,sk-..."`（または `OPENCLAW_LIVE_ANTHROPIC_KEY=sk-...`）や複数の `ANTHROPIC_API_KEY*` 変数を設定可能。レート制限時はリトライする

## どのスイートを実行すべきか？

以下の判断表を使ってください。

- ロジック / テストを編集: `pnpm test`（変更が多い場合は `pnpm test:coverage` も）
- ゲートウェイのネットワーク / WS プロトコル / ペアリングに触れた場合: `pnpm test:e2e` を追加
- 「ボットが落ちている」/ プロバイダー固有の失敗 / ツール呼び出しのデバッグ: 絞り込んだ `pnpm test:live` を実行

## Live: モデルスモーク（プロファイルキー）

Live テストは、失敗を切り分けるために 2 層に分かれています。

- 「Direct model」は、そのキーでプロバイダー / モデルが最低限応答できるかを確認します。
- 「Gateway smoke」は、モデルに対して完全な ゲートウェイ + エージェントのパイプライン（セッション、履歴、ツール、サンドボックスポリシーなど）が動作するかを確認します。

### レイヤー 1: Direct model completion（ゲートウェイなし）

- テスト: `src/agents/models.profiles.live.test.ts`
- 目的:
  - 検出されたモデルを列挙
  - 認証情報を持つモデルを `getApiKeyForModel` で選択
  - 各モデルで小さな completion を実行（必要に応じて対象リグレッション）
- 有効化方法:
  - `pnpm test:live`（Vitest を直接起動する場合は `OPENCLAW_LIVE_TEST=1`）
- このスイートを実行するには `OPENCLAW_LIVE_MODELS=modern`（またはモダン向けエイリアスの `all`）を設定します。設定しない場合、`pnpm test:live` をゲートウェイスモークに集中させるためスキップされます。
- モデルの選択方法:
  - `OPENCLAW_LIVE_MODELS=modern` でモダン allowlist を実行（Opus/Sonnet/Haiku 4.5、GPT-5.x + Codex、Gemini 3、GLM 4.7、MiniMax M2.1、Grok 4）
  - `OPENCLAW_LIVE_MODELS=all` はモダン allowlist のエイリアス
  - または `OPENCLAW_LIVE_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,..."`（カンマ区切りの allowlist）
- プロバイダーの選択方法:
  - `OPENCLAW_LIVE_PROVIDERS="google,google-antigravity,google-gemini-cli"`（カンマ区切りの allowlist）
- キーの取得元:
  - デフォルト: プロファイルストア + 環境変数フォールバック
  - **プロファイルストアのみ**を強制するには `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` を設定
- このレイヤーが存在する理由:
  - 「プロバイダー API が壊れている / キーが無効」と「ゲートウェイのエージェントパイプラインが壊れている」を切り分ける
  - 小さく独立したリグレッションを収容（例: OpenAI Responses / Codex Responses の reasoning リプレイ + ツール呼び出しフロー）

### レイヤー 2: Gateway + dev agent スモーク（「@openclaw」が実際に行うこと）

- テスト: `src/gateway/gateway-models.profiles.live.test.ts`
- 目的:
  - プロセス内ゲートウェイを起動
  - `agent:dev:*` セッションを作成 / パッチ（実行ごとにモデル上書き）
  - キーを持つモデルを反復し、以下を検証:
    - 「意味のある」応答（ツールなし）
    - 実際のツール呼び出しが動作すること（read プローブ）
    - 任意の追加ツールプローブ（exec + read プローブ）
    - OpenAI のリグレッション経路（ツール呼び出しのみ → フォローアップ）が維持されていること
- プローブ詳細（失敗を迅速に説明するため）:
  - `read` プローブ: ワークスペースに nonce ファイルを書き込み、エージェントにそれを `read` して nonce を返すよう依頼
  - `exec+read` プローブ: エージェントに nonce を一時ファイルへ `exec` 書き込みさせ、その後 `read` させる
  - image プローブ: 生成した PNG（猫 + ランダムコード）を添付し、モデルが `cat <CODE>` を返すことを期待
  - 実装参照: `src/gateway/gateway-models.profiles.live.test.ts` および `src/gateway/live-image-probe.ts`
- 有効化方法:
  - `pnpm test:live`（Vitest を直接起動する場合は `OPENCLAW_LIVE_TEST=1`）
- モデルの選択方法:
  - デフォルト: モダン allowlist（Opus/Sonnet/Haiku 4.5、GPT-5.x + Codex、Gemini 3、GLM 4.7、MiniMax M2.1、Grok 4）
  - `OPENCLAW_LIVE_GATEWAY_MODELS=all` はモダン allowlist のエイリアス
  - または `OPENCLAW_LIVE_GATEWAY_MODELS="provider/model"`（カンマ区切り）で絞り込み
- プロバイダーの選択方法（「OpenRouter 全部」を避ける）:
  - `OPENCLAW_LIVE_GATEWAY_PROVIDERS="google,google-antigravity,google-gemini-cli,openai,anthropic,zai,minimax"`（カンマ区切りの allowlist）
- ツール + 画像プローブは、この live テストでは常に有効:
  - `read` プローブ + `exec+read` プローブ（ツール耐久）
  - モデルが画像入力対応を広告している場合、image プローブを実行
  - フロー（概要）:
    - テストが「CAT」+ ランダムコードの小さな PNG を生成（`src/gateway/live-image-probe.ts`）
    - `agent` `attachments: [{ mimeType: "image/png", content: "<base64>" }]` 経由で送信
    - ゲートウェイが添付ファイルを `images[]`（`src/gateway/server-methods/agent.ts` + `src/gateway/chat-attachments.ts`）にパース
    - 埋め込みエージェントがマルチモーダルなユーザーメッセージをモデルに転送
    - 検証: 応答に `cat` とコードが含まれること（OCR の許容誤差として軽微なミスは可）

ヒント: 自分のマシンで何がテスト可能か（および正確な `provider/model` ID）を確認するには、次を実行してください。

```bash
openclaw models list
openclaw models list --json
```

## Live: Anthropic setup-token スモーク

- テスト: `src/agents/anthropic.setup-token.live.test.ts`
- 目的: Claude Code CLI の setup-token（または貼り付けた setup-token プロファイル）で Anthropic プロンプトを完了できることを検証
- 有効化:
  - `pnpm test:live`（Vitest を直接起動する場合は `OPENCLAW_LIVE_TEST=1`）
  - `OPENCLAW_LIVE_SETUP_TOKEN=1`
- トークンの取得元（いずれか 1 つ）:
  - プロファイル: `OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test`
  - 生トークン: `OPENCLAW_LIVE_SETUP_TOKEN_VALUE=sk-ant-oat01-...`
- モデル上書き（任意）:
  - `OPENCLAW_LIVE_SETUP_TOKEN_MODEL=anthropic/claude-opus-4-6`

セットアップ例:

```bash
openclaw models auth paste-token --provider anthropic --profile-id anthropic:setup-token-test
OPENCLAW_LIVE_SETUP_TOKEN=1 OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test pnpm test:live src/agents/anthropic.setup-token.live.test.ts
```

## Live: CLI バックエンドスモーク（Claude Code CLI などのローカル CLI）

- テスト: `src/gateway/gateway-cli-backend.live.test.ts`
- 目的: デフォルト設定に触れず、ローカル CLI バックエンドを使って Gateway + エージェントのパイプラインを検証
- 有効化:
  - `pnpm test:live`（Vitest を直接起動する場合は `OPENCLAW_LIVE_TEST=1`）
  - `OPENCLAW_LIVE_CLI_BACKEND=1`
- デフォルト:
  - モデル: `claude-cli/claude-sonnet-4-5`
  - コマンド: `claude`
  - 引数: `["-p","--output-format","json","--dangerously-skip-permissions"]`
- 上書き（任意）:
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-opus-4-6"`
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="codex-cli/gpt-5.3-codex"`
  - `OPENCLAW_LIVE_CLI_BACKEND_COMMAND="/full/path/to/claude"`
  - `OPENCLAW_LIVE_CLI_BACKEND_ARGS='["-p","--output-format","json","--permission-mode","bypassPermissions"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_CLEAR_ENV='["ANTHROPIC_API_KEY","ANTHROPIC_API_KEY_OLD"]'`
  - 実際の画像添付を送信するには `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_PROBE=1`（パスはプロンプトに注入されます）
  - 画像ファイルパスをプロンプト注入ではなく CLI 引数として渡すには `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_ARG="--image"`
  - `IMAGE_ARG` が設定されている場合の画像引数の渡し方を制御するには `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_MODE="repeat"`（または `"list"`）
  - 2 ターン目を送信して再開フローを検証するには `OPENCLAW_LIVE_CLI_BACKEND_RESUME_PROBE=1`
- `OPENCLAW_LIVE_CLI_BACKEND_DISABLE_MCP_CONFIG=0` を設定すると、Claude Code CLI の MCP 設定を有効のままにします（デフォルトでは一時的な空ファイルで MCP 設定を無効化します）。

例:

```bash
OPENCLAW_LIVE_CLI_BACKEND=1 \
  OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-sonnet-4-5" \
  pnpm test:live src/gateway/gateway-cli-backend.live.test.ts
```

### 推奨 live レシピ

明示的で狭い allowlist が最速かつ最も安定します。

- 単一モデル、direct（ゲートウェイなし）:
  - `OPENCLAW_LIVE_MODELS="openai/gpt-5.2" pnpm test:live src/agents/models.profiles.live.test.ts`

- 単一モデル、ゲートウェイスモーク:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- 複数プロバイダーでのツール呼び出し:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,google/gemini-3-flash-preview,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Google フォーカス（Gemini API キー + Antigravity）:
  - Gemini（API キー）: `OPENCLAW_LIVE_GATEWAY_MODELS="google/gemini-3-flash-preview" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`
  - Antigravity（OAuth）: `OPENCLAW_LIVE_GATEWAY_MODELS="google-antigravity/claude-opus-4-6-thinking,google-antigravity/gemini-3-pro-high" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

注記:

- `google/...` は Gemini API（API キー）を使用します。
- `google-antigravity/...` は Antigravity OAuth ブリッジ（Cloud Code Assist 風のエージェントエンドポイント）を使用します。
- `google-gemini-cli/...` はローカルマシン上の Gemini CLI を使用します（認証やツールの癖が別）。
- Gemini API と Gemini CLI の違い:
  - API: OpenClaw が Google ホストの Gemini API を HTTP 経由で呼び出します（API キー / プロファイル認証）。一般に「Gemini」と言われるのはこちらです。
  - CLI: OpenClaw がローカルの `gemini` バイナリを実行します。独自の認証があり、挙動が異なる場合があります（ストリーミング / ツール対応 / バージョン差）。

## Live: モデルマトリクス（カバー範囲）

固定の「CI モデルリスト」はありません（live はオプトイン）が、以下はキーを持つ開発マシンで定期的にカバーする **推奨** モデルです。

### モダンスモークセット（ツール呼び出し + 画像）

「一般的なモデル」が動作し続けることを期待する実行セットです。

- OpenAI（非 Codex）: `openai/gpt-5.2`（任意: `openai/gpt-5.1`）
- OpenAI Codex: `openai-codex/gpt-5.3-codex`（任意: `openai-codex/gpt-5.3-codex-codex`）
- Anthropic: `anthropic/claude-opus-4-6`（または `anthropic/claude-sonnet-4-5`）
- Google（Gemini API）: `google/gemini-3-pro-preview` および `google/gemini-3-flash-preview`（古い Gemini 2.x モデルは避ける）
- Google（Antigravity）: `google-antigravity/claude-opus-4-6-thinking` および `google-antigravity/gemini-3-flash`
- Z.AI（GLM）: `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

ツール + 画像付きでゲートウェイスモークを実行:
`OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,openai-codex/gpt-5.3-codex,anthropic/claude-opus-4-6,google/gemini-3-pro-preview,google/gemini-3-flash-preview,google-antigravity/claude-opus-4-6-thinking,google-antigravity/gemini-3-flash,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

### ベースライン: ツール呼び出し（Read + 任意の Exec）

各プロバイダーファミリーから最低 1 つ選択してください。

- OpenAI: `openai/gpt-5.2`（または `openai/gpt-5-mini`）
- Anthropic: `anthropic/claude-opus-4-6`（または `anthropic/claude-sonnet-4-5`）
- Google: `google/gemini-3-flash-preview`（または `google/gemini-3-pro-preview`）
- Z.AI（GLM）: `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

任意の追加カバレッジ（あると良い）:

- xAI: `xai/grok-4`（または最新利用可能モデル）
- Mistral: `mistral/`…（ツール対応モデルを 1 つ）
- Cerebras: `cerebras/`…（アクセス可能な場合）
- LM Studio: `lmstudio/`…（ローカル。ツール呼び出しは API モード依存）

### Vision: 画像送信（添付 → マルチモーダルメッセージ）

画像対応モデルを `OPENCLAW_LIVE_GATEWAY_MODELS` に最低 1 つ含め、image プローブを実行してください（Claude / Gemini / OpenAI の画像対応バリアントなど）。

### アグリゲーター / 代替ゲートウェイ

キーが有効であれば、以下経由のテストもサポートしています。

- OpenRouter: `openrouter/...`（数百モデル。ツール + 画像対応候補の探索には `openclaw models scan` を使用）
- OpenCode Zen: `opencode/...`（認証は `OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY`）

live マトリクスに含められるその他のプロバイダー（認証情報 / 設定がある場合）:

- 内蔵: `openai`, `openai-codex`, `anthropic`, `google`, `google-vertex`, `google-antigravity`, `google-gemini-cli`, `zai`, `openrouter`, `opencode`, `xai`, `groq`, `cerebras`, `mistral`, `github-copilot`
- `models.providers` 経由（カスタムエンドポイント）: `minimax`（クラウド / API）、および OpenAI / Anthropic 互換プロキシ（LM Studio、vLLM、LiteLLM など）

ヒント: ドキュメントに「すべてのモデル」をハードコードしないでください。権威ある一覧は、あなたのマシンで `discoverModels(...)` が返す内容 + 利用可能なキーです。

## 認証情報（決してコミットしない）

Live テストは、CLI と同じ方法で認証情報を検出します。実用上の意味は以下の通りです。

- CLI が動作すれば、live テストも同じキーを見つけるはずです。
- live テストで「認証情報がない」と表示された場合、`openclaw models list` / モデル選択をデバッグするのと同じ手順で確認してください。

- プロファイルストア: `~/.openclaw/credentials/`（推奨。テストで言う「プロファイルキー」とはこれ）
- 設定: `~/.openclaw/openclaw.json`（または `OPENCLAW_CONFIG_PATH`）

環境変数キー（例: `~/.profile` に export）に依存したい場合は、`source ~/.profile` の後にローカルテストを実行するか、以下の Docker ランナーを使用してください（`~/.profile` をコンテナにマウント可能）。

## Deepgram live（音声文字起こし）

- テスト: `src/media-understanding/providers/deepgram/audio.live.test.ts`
- 有効化: `DEEPGRAM_API_KEY=... DEEPGRAM_LIVE_TEST=1 pnpm test:live src/media-understanding/providers/deepgram/audio.live.test.ts`

## Docker ランナー（任意の「Linux で動くか」チェック）

これらは、リポジトリの Docker イメージ内で `pnpm test:live` を実行し、ローカルの設定ディレクトリとワークスペースをマウントします（マウントされていれば `~/.profile` を読み込みます）。

- Direct models: `pnpm test:docker:live-models`（スクリプト: `scripts/test-live-models-docker.sh`）
- Gateway + dev agent: `pnpm test:docker:live-gateway`（スクリプト: `scripts/test-live-gateway-models-docker.sh`）
- オンボーディングウィザード（TTY、完全スキャフォールディング）: `pnpm test:docker:onboard`（スクリプト: `scripts/e2e/onboard-docker.sh`）
- ゲートウェイネットワーク（2 コンテナ、WS 認証 + ヘルス）: `pnpm test:docker:gateway-network`（スクリプト: `scripts/e2e/gateway-network-docker.sh`）
- プラグイン（カスタム拡張のロード + レジストリスモーク）: `pnpm test:docker:plugins`（スクリプト: `scripts/e2e/plugins-docker.sh`）

有用な環境変数:

- `OPENCLAW_CONFIG_DIR=...`（デフォルト: `~/.openclaw`）→ `/home/node/.openclaw` にマウント
- `OPENCLAW_WORKSPACE_DIR=...`（デフォルト: `~/.openclaw/workspace`）→ `/home/node/.openclaw/workspace` にマウント
- `OPENCLAW_PROFILE_FILE=...`（デフォルト: `~/.profile`）→ `/home/node/.profile` にマウントされ、テスト実行前に読み込まれる
- 実行を絞り込むには `OPENCLAW_LIVE_GATEWAY_MODELS=...` / `OPENCLAW_LIVE_MODELS=...`
- 認証情報を環境変数ではなくプロファイルストアから取得させるには `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1`

## ドキュメント健全性チェック

ドキュメント編集後は次を実行してください: `pnpm docs:list`。

## オフラインリグレッション（CI セーフ）

実プロバイダーなしでの「実パイプライン」リグレッションです。

- ゲートウェイのツール呼び出し（OpenAI をモック、実ゲートウェイ + エージェントループ）: `src/gateway/gateway.tool-calling.mock-openai.test.ts`
- ゲートウェイウィザード（WS `wizard.start`/`wizard.next`、設定書き込み + 認証強制）: `src/gateway/gateway.wizard.e2e.test.ts`

## エージェント信頼性評価（Skills）

すでに、CI セーフで「エージェント信頼性評価」のように振る舞うテストがいくつかあります。

- 実ゲートウェイ + エージェントループを通したモックのツール呼び出し（`src/gateway/gateway.tool-calling.mock-openai.test.ts`）。
- セッション配線と設定効果を検証するエンドツーエンドのウィザードフロー（`src/gateway/gateway.wizard.e2e.test.ts`）。

Skills に関してまだ不足している点（[Skills](/tools/skills) 参照）:

- **意思決定:** プロンプトに Skills が列挙されたとき、エージェントは正しいスキルを選択できるか（または無関係なものを避けられるか）。
- **準拠性:** 使用前に `SKILL.md` を読み、必要な手順 / 引数に従うか。
- **ワークフロー契約:** ツールの順序、セッション履歴の引き継ぎ、サンドボックス境界を検証するマルチターンシナリオ。

将来の評価は、まず決定論的であるべきです。

- モックプロバイダーを使い、ツール呼び出し + 順序、スキルファイル読み取り、セッション配線を検証するシナリオランナー。
- スキルに特化した小規模シナリオ群（使用 vs 回避、ゲーティング、プロンプトインジェクション）。
- CI セーフなスイートが整った後にのみ、任意の live 評価（オプトイン、環境変数で制御）。

## リグレッションの追加（ガイダンス）

Live で発見したプロバイダー / モデル問題を修正した場合:

- 可能であれば CI セーフなリグレッションを追加（プロバイダーをモック / スタブ、または正確なリクエスト変換をキャプチャ）
- 本質的に live 専用（レート制限、認証ポリシー）の場合は、live テストを狭く保ち、環境変数でオプトイン
- バグを捕捉できる最小レイヤーを優先:
  - プロバイダーのリクエスト変換 / リプレイのバグ → direct models テスト
  - ゲートウェイのセッション / 履歴 / ツールパイプラインのバグ → ゲートウェイ live スモーク、または CI セーフなゲートウェイモックテスト
