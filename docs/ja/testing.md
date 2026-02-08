---
summary: "テストキット: unit/e2e/live スイート、Docker ランナー、および各テストがカバーする内容"
read_when:
  - ローカルまたは CI でテストを実行するとき
  - モデル/プロバイダーのバグに対するリグレッションを追加するとき
  - Gateway（ゲートウェイ） + エージェントの挙動をデバッグするとき
title: "テスト"
x-i18n:
  source_path: testing.md
  source_hash: 7a23ced0e6e3be5e
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:40Z
---

# テスト

OpenClaw には 3 つの Vitest スイート（unit/integration、e2e、live）と、小さなセットの Docker ランナーがあります。

このドキュメントは「どのようにテストしているか」のガイドです。

- 各スイートがカバーする内容（および意図的に _カバーしない_ 内容）
- よくあるワークフロー（ローカル、pre-push、デバッグ）で実行するコマンド
- live テストが認証情報を検出し、モデル/プロバイダーを選択する方法
- 現実のモデル/プロバイダーの問題に対するリグレッションを追加する方法

## クイックスタート

普段は:

- フルゲート（push 前に期待される）: `pnpm build && pnpm check && pnpm test`

テストに触れたとき、または追加の確信が欲しいとき:

- カバレッジゲート: `pnpm test:coverage`
- E2E スイート: `pnpm test:e2e`

実在のプロバイダー/モデルをデバッグするとき（実際の認証情報が必要）:

- Live スイート（モデル + Gateway（ゲートウェイ）のツール/イメージプローブ）: `pnpm test:live`

ヒント: 失敗ケースが 1 つだけ必要な場合は、後述の allowlist 環境変数で live テストを絞り込むことを優先してください。

## テストスイート（どこで何が動くか）

スイートは「現実に近づくほど」（そして不安定さ/コストも増えるほど）だと考えてください。

### Unit / integration（デフォルト）

- コマンド: `pnpm test`
- 設定: `vitest.config.ts`
- ファイル: `src/**/*.test.ts`
- スコープ:
  - 純粋なユニットテスト
  - 同一プロセス内の統合テスト（Gateway（ゲートウェイ）の認証、ルーティング、ツーリング、パース、設定）
  - 既知バグに対する決定論的なリグレッション
- 期待値:
  - CI で実行
  - 実キー不要
  - 高速で安定していること

### E2E（Gateway（ゲートウェイ）スモーク）

- コマンド: `pnpm test:e2e`
- 設定: `vitest.e2e.config.ts`
- ファイル: `src/**/*.e2e.test.ts`
- スコープ:
  - 複数インスタンスの Gateway（ゲートウェイ）のエンドツーエンド動作
  - WebSocket/HTTP の外部インターフェース、ノードのペアリング、より重いネットワーキング
- 期待値:
  - CI で実行（パイプラインで有効化されている場合）
  - 実キー不要
  - unit テストより可動部分が多い（遅くなることがあります）

### Live（実プロバイダー + 実モデル）

- コマンド: `pnpm test:live`
- 設定: `vitest.live.config.ts`
- ファイル: `src/**/*.live.test.ts`
- デフォルト: `pnpm test:live` により **有効**（`OPENCLAW_LIVE_TEST=1` を設定）
- スコープ:
  - 「このプロバイダー/モデルは実認証情報で _今日_ 実際に動くか？」
  - プロバイダーのフォーマット変更、ツール呼び出しの癖、認証問題、レートリミット挙動を捕捉
- 期待値:
  - 設計上 CI 安定ではありません（実ネットワーク、実プロバイダーのポリシー、クォータ、障害）
  - 課金/レートリミット消費があります
  - 「全部」よりも絞ったサブセットの実行を推奨します
  - live 実行は不足している API キーを拾うために `~/.profile` を source します
  - Anthropic のキー・ローテーション: `OPENCLAW_LIVE_ANTHROPIC_KEYS="sk-...,sk-..."`（または `OPENCLAW_LIVE_ANTHROPIC_KEY=sk-...`）または複数の `ANTHROPIC_API_KEY*` 変数を設定してください。テストはレートリミット時にリトライします

## どのスイートを実行すべきですか？

この判断表を使ってください。

- ロジック/テストを編集: `pnpm test`（変更が多いなら `pnpm test:coverage` も）
- Gateway（ゲートウェイ）のネットワーキング/WS プロトコル/ペアリングに触れた: `pnpm test:e2e` を追加
- 「ボットが落ちている」/プロバイダー固有の失敗/ツール呼び出しをデバッグ: 絞り込んだ `pnpm test:live` を実行

## Live: モデルスモーク（プロファイルキー）

Live テストは失敗を切り分けられるように 2 層に分かれています。

- 「Direct model」は、そのキーでプロバイダー/モデルがそもそも応答できるかを示します。
- 「Gateway smoke」は、そのモデルに対して Gateway（ゲートウェイ）+ エージェントのパイプライン全体が動作するか（セッション、履歴、ツール、サンドボックスポリシー等）を示します。

### レイヤー 1: Direct model completion（Gateway（ゲートウェイ）なし）

- テスト: `src/agents/models.profiles.live.test.ts`
- 目的:
  - 検出されたモデルを列挙
  - `getApiKeyForModel` で認証情報のあるモデルを選択
  - モデルごとに小さな completion を実行（必要に応じて狙い撃ちのリグレッションも）
- 有効化方法:
  - `pnpm test:live`（Vitest を直接起動する場合は `OPENCLAW_LIVE_TEST=1`）
- このスイートを実際に実行するには `OPENCLAW_LIVE_MODELS=modern`（またはモダン向けの別名 `all`）を設定してください。そうでない場合、`pnpm test:live` を Gateway（ゲートウェイ）スモークに集中させるためにスキップします
- モデルの選び方:
  - `OPENCLAW_LIVE_MODELS=modern` でモダン allowlist（Opus/Sonnet/Haiku 4.5、GPT-5.x + Codex、Gemini 3、GLM 4.7、MiniMax M2.1、Grok 4）を実行
  - `OPENCLAW_LIVE_MODELS=all` はモダン allowlist の別名です
  - または `OPENCLAW_LIVE_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,..."`（カンマ区切り allowlist）
- プロバイダーの選び方:
  - `OPENCLAW_LIVE_PROVIDERS="google,google-antigravity,google-gemini-cli"`（カンマ区切り allowlist）
- キーの取得元:
  - デフォルト: プロファイルストア + 環境変数のフォールバック
  - **プロファイルストア** のみを強制するには `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` を設定
- これが存在する理由:
  - 「プロバイダー API が壊れている/キーが無効」と「Gateway（ゲートウェイ）エージェントのパイプラインが壊れている」を切り分けるため
  - 小さく隔離されたリグレッションを含めるため（例: OpenAI Responses/Codex Responses の reasoning リプレイ + ツール呼び出しフロー）

### レイヤー 2: Gateway（ゲートウェイ） + dev エージェントスモーク（「@openclaw」が実際にやること）

- テスト: `src/gateway/gateway-models.profiles.live.test.ts`
- 目的:
  - 同一プロセス内の Gateway（ゲートウェイ）を起動
  - `agent:dev:*` セッションを作成/パッチ（実行ごとにモデルを上書き）
  - keys のあるモデルを反復し、以下を検証:
    - 「意味のある」応答（ツールなし）
    - 実際のツール呼び出しが動作（read プローブ）
    - 任意の追加ツールプローブ（exec+read プローブ）
    - OpenAI のリグレッション経路（tool-call-only → フォローアップ）が維持される
- プローブ詳細（失敗を素早く説明できるように）:
  - `read` プローブ: テストがワークスペースに nonce ファイルを書き込み、エージェントにそれを `read` して nonce をエコーバックするよう依頼します。
  - `exec+read` プローブ: テストがエージェントに temp ファイルへ nonce を `exec`-write させ、その後 `read` させて読み戻します。
  - image プローブ: テストが生成した PNG（cat + ランダム化コード）を添付し、モデルが `cat <CODE>` を返すことを期待します。
  - 実装参照: `src/gateway/gateway-models.profiles.live.test.ts` と `src/gateway/live-image-probe.ts`。
- 有効化方法:
  - `pnpm test:live`（Vitest を直接起動する場合は `OPENCLAW_LIVE_TEST=1`）
- モデルの選び方:
  - デフォルト: モダン allowlist（Opus/Sonnet/Haiku 4.5、GPT-5.x + Codex、Gemini 3、GLM 4.7、MiniMax M2.1、Grok 4）
  - `OPENCLAW_LIVE_GATEWAY_MODELS=all` はモダン allowlist の別名です
  - または `OPENCLAW_LIVE_GATEWAY_MODELS="provider/model"`（またはカンマ区切りリスト）で絞り込み
- プロバイダーの選び方（「OpenRouter 全部」を避ける）:
  - `OPENCLAW_LIVE_GATEWAY_PROVIDERS="google,google-antigravity,google-gemini-cli,openai,anthropic,zai,minimax"`（カンマ区切り allowlist）
- この live テストではツール + 画像プローブは常に有効です:
  - `read` プローブ + `exec+read` プローブ（ツール負荷）
  - image プローブは、モデルが画像入力対応を広告している場合に実行されます
  - フロー（高レベル）:
    - テストが「CAT」+ ランダムコードの小さな PNG を生成（`src/gateway/live-image-probe.ts`）
    - `agent` `attachments: [{ mimeType: "image/png", content: "<base64>" }]` 経由で送信
    - Gateway（ゲートウェイ）が添付を `images[]`（`src/gateway/server-methods/agent.ts` + `src/gateway/chat-attachments.ts`）へパース
    - 埋め込みエージェントがマルチモーダルなユーザーメッセージをモデルへ転送
    - アサーション: 返信に `cat` + コードが含まれること（OCR 許容: 小さな誤りは許容）

ヒント: あなたのマシンでテストできる内容（および正確な `provider/model` id）を確認するには、次を実行してください。

```bash
openclaw models list
openclaw models list --json
```

## Live: Anthropic setup-token スモーク

- テスト: `src/agents/anthropic.setup-token.live.test.ts`
- 目的: Claude Code CLI の setup-token（または貼り付けた setup-token プロファイル）で Anthropic のプロンプトを完了できることを検証します。
- 有効化:
  - `pnpm test:live`（Vitest を直接起動する場合は `OPENCLAW_LIVE_TEST=1`）
  - `OPENCLAW_LIVE_SETUP_TOKEN=1`
- トークンの取得元（いずれか 1 つを選択）:
  - プロファイル: `OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test`
  - 生トークン: `OPENCLAW_LIVE_SETUP_TOKEN_VALUE=sk-ant-oat01-...`
- モデル上書き（任意）:
  - `OPENCLAW_LIVE_SETUP_TOKEN_MODEL=anthropic/claude-opus-4-6`

セットアップ例:

```bash
openclaw models auth paste-token --provider anthropic --profile-id anthropic:setup-token-test
OPENCLAW_LIVE_SETUP_TOKEN=1 OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test pnpm test:live src/agents/anthropic.setup-token.live.test.ts
```

## Live: CLI バックエンドスモーク（Claude Code CLI または他のローカル CLI）

- テスト: `src/gateway/gateway-cli-backend.live.test.ts`
- 目的: デフォルト設定に触れずに、ローカル CLI バックエンドを使って Gateway（ゲートウェイ）+ エージェントのパイプラインを検証します。
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
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_PROBE=1` で実際の画像添付を送信します（パスはプロンプトに注入されます）。
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_ARG="--image"` で、プロンプト注入ではなく CLI 引数として画像ファイルパスを渡します。
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_MODE="repeat"`（または `"list"`）で、`IMAGE_ARG` が設定されている場合の画像引数の渡し方を制御します。
  - `OPENCLAW_LIVE_CLI_BACKEND_RESUME_PROBE=1` で 2 ターン目を送信し、レジュームフローを検証します。
- `OPENCLAW_LIVE_CLI_BACKEND_DISABLE_MCP_CONFIG=0` で Claude Code CLI の MCP 設定を有効のままにします（デフォルトでは一時的な空ファイルで MCP 設定を無効化します）。

例:

```bash
OPENCLAW_LIVE_CLI_BACKEND=1 \
  OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-sonnet-4-5" \
  pnpm test:live src/gateway/gateway-cli-backend.live.test.ts
```

### 推奨 live レシピ

明示的で狭い allowlist が最速で、最も不安定になりにくいです。

- 単一モデル、direct（Gateway（ゲートウェイ）なし）:
  - `OPENCLAW_LIVE_MODELS="openai/gpt-5.2" pnpm test:live src/agents/models.profiles.live.test.ts`

- 単一モデル、Gateway（ゲートウェイ）スモーク:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- 複数プロバイダーにまたがるツール呼び出し:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,google/gemini-3-flash-preview,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Google 集中（Gemini API キー + Antigravity）:
  - Gemini（API キー）: `OPENCLAW_LIVE_GATEWAY_MODELS="google/gemini-3-flash-preview" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`
  - Antigravity（OAuth）: `OPENCLAW_LIVE_GATEWAY_MODELS="google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-pro-high" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

注意:

- `google/...` は Gemini API（API キー）を使用します。
- `google-antigravity/...` は Antigravity OAuth ブリッジ（Cloud Code Assist 風のエージェントエンドポイント）を使用します。
- `google-gemini-cli/...` はあなたのマシン上のローカル Gemini CLI を使用します（別の認証 + ツーリングの癖）。
- Gemini API と Gemini CLI の違い:
  - API: OpenClaw が Google のホストされた Gemini API を HTTP で呼び出します（API キー/プロファイル認証）。多くのユーザーが「Gemini」と言って意味するのはこれです。
  - CLI: OpenClaw がローカルの `gemini` バイナリをシェル実行します。独自の認証を持ち、挙動が異なる場合があります（ストリーミング/ツール対応/バージョン差異）。

## Live: モデルマトリクス（カバー範囲）

固定の「CI モデルリスト」はありません（live はオプトイン）が、キーを持つ開発マシンで定期的にカバーする **推奨** モデルは次のとおりです。

### モダンスモークセット（ツール呼び出し + 画像）

これは「一般的なモデル」の実行で、動き続けることを期待しています。

- OpenAI（非 Codex）: `openai/gpt-5.2`（任意: `openai/gpt-5.1`）
- OpenAI Codex: `openai-codex/gpt-5.3-codex`（任意: `openai-codex/gpt-5.3-codex-codex`）
- Anthropic: `anthropic/claude-opus-4-6`（または `anthropic/claude-sonnet-4-5`）
- Google（Gemini API）: `google/gemini-3-pro-preview` と `google/gemini-3-flash-preview`（古い Gemini 2.x モデルは避けてください）
- Google（Antigravity）: `google-antigravity/claude-opus-4-5-thinking` と `google-antigravity/gemini-3-flash`
- Z.AI（GLM）: `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

ツール + 画像で Gateway（ゲートウェイ）スモークを実行:
`OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,openai-codex/gpt-5.3-codex,anthropic/claude-opus-4-6,google/gemini-3-pro-preview,google/gemini-3-flash-preview,google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-flash,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

### ベースライン: ツール呼び出し（Read + 任意 Exec）

プロバイダーファミリーごとに少なくとも 1 つ選んでください。

- OpenAI: `openai/gpt-5.2`（または `openai/gpt-5-mini`）
- Anthropic: `anthropic/claude-opus-4-6`（または `anthropic/claude-sonnet-4-5`）
- Google: `google/gemini-3-flash-preview`（または `google/gemini-3-pro-preview`）
- Z.AI（GLM）: `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

任意の追加カバレッジ（あると良い）:

- xAI: `xai/grok-4`（または利用可能な最新）
- Mistral: `mistral/`…（有効化している「tools」対応モデルを 1 つ選択）
- Cerebras: `cerebras/`…（アクセスがある場合）
- LM Studio: `lmstudio/`…（ローカル; ツール呼び出しは API モードに依存）

### Vision: 画像送信（添付 → マルチモーダルメッセージ）

image プローブを動かすために、`OPENCLAW_LIVE_GATEWAY_MODELS` に少なくとも 1 つ、画像対応モデル（Claude/Gemini/OpenAI の vision 対応バリアント等）を含めてください。

### アグリゲーター/代替ゲートウェイ

キーを有効にしている場合、次経由でのテストもサポートしています。

- OpenRouter: `openrouter/...`（数百モデル; ツール + 画像対応候補を見つけるには `openclaw models scan` を使用）
- OpenCode Zen: `opencode/...`（`OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY` で認証）

live マトリクスに含められる追加プロバイダー（認証情報/設定がある場合）:

- 内蔵: `openai`, `openai-codex`, `anthropic`, `google`, `google-vertex`, `google-antigravity`, `google-gemini-cli`, `zai`, `openrouter`, `opencode`, `xai`, `groq`, `cerebras`, `mistral`, `github-copilot`
- `models.providers` 経由（カスタムエンドポイント）: `minimax`（クラウド/API）、および任意の OpenAI/Anthropic 互換プロキシ（LM Studio、vLLM、LiteLLM など）

ヒント: ドキュメント内に「全モデル」をハードコードしないでください。権威あるリストは、あなたのマシンで `discoverModels(...)` が返すもの + 利用可能なキーです。

## 認証情報（絶対にコミットしない）

live テストは、CLI と同じ方法で認証情報を検出します。実務上の含意は次のとおりです。

- CLI が動くなら、live テストも同じキーを見つけられるはずです。
- live テストが「認証情報なし」と言う場合は、`openclaw models list` / モデル選択をデバッグするときと同じ手順でデバッグしてください。

- プロファイルストア: `~/.openclaw/credentials/`（推奨; テストで言う「profile keys」の意味）
- 設定: `~/.openclaw/openclaw.json`（または `OPENCLAW_CONFIG_PATH`）

環境変数キーに依存したい場合（例: `~/.profile` に export している）、`source ~/.profile` の後にローカルテストを実行するか、下記の Docker ランナーを使用してください（コンテナに `~/.profile` をマウントできます）。

## Deepgram live（音声文字起こし）

- テスト: `src/media-understanding/providers/deepgram/audio.live.test.ts`
- 有効化: `DEEPGRAM_API_KEY=... DEEPGRAM_LIVE_TEST=1 pnpm test:live src/media-understanding/providers/deepgram/audio.live.test.ts`

## Docker ランナー（任意の「Linux で動く」チェック）

これらはリポジトリの Docker イメージ内で `pnpm test:live` を実行し、ローカルの設定ディレクトリとワークスペースをマウントします（マウントされている場合は `~/.profile` を source します）。

- Direct models: `pnpm test:docker:live-models`（スクリプト: `scripts/test-live-models-docker.sh`）
- Gateway（ゲートウェイ） + dev エージェント: `pnpm test:docker:live-gateway`（スクリプト: `scripts/test-live-gateway-models-docker.sh`）
- オンボーディングウィザード（TTY、完全なスキャフォールディング）: `pnpm test:docker:onboard`（スクリプト: `scripts/e2e/onboard-docker.sh`）
- Gateway（ゲートウェイ）ネットワーキング（2 コンテナ、WS 認証 + ヘルス）: `pnpm test:docker:gateway-network`（スクリプト: `scripts/e2e/gateway-network-docker.sh`）
- プラグイン（カスタム拡張のロード + レジストリスモーク）: `pnpm test:docker:plugins`（スクリプト: `scripts/e2e/plugins-docker.sh`）

便利な環境変数:

- `OPENCLAW_CONFIG_DIR=...`（デフォルト: `~/.openclaw`）を `/home/node/.openclaw` にマウント
- `OPENCLAW_WORKSPACE_DIR=...`（デフォルト: `~/.openclaw/workspace`）を `/home/node/.openclaw/workspace` にマウント
- `OPENCLAW_PROFILE_FILE=...`（デフォルト: `~/.profile`）を `/home/node/.profile` にマウントし、テスト実行前に source
- 実行を絞り込むための `OPENCLAW_LIVE_GATEWAY_MODELS=...` / `OPENCLAW_LIVE_MODELS=...`
- 認証情報がプロファイルストア（環境変数ではない）から来ることを保証する `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1`

## ドキュメント健全性

ドキュメント編集後に docs チェックを実行してください: `pnpm docs:list`。

## オフラインリグレッション（CI セーフ）

これらは実プロバイダーなしの「実パイプライン」リグレッションです。

- Gateway（ゲートウェイ）ツール呼び出し（mock OpenAI、実 Gateway（ゲートウェイ） + エージェントループ）: `src/gateway/gateway.tool-calling.mock-openai.test.ts`
- Gateway（ゲートウェイ）ウィザード（WS `wizard.start`/`wizard.next`、設定を書き込み + 認証を強制）: `src/gateway/gateway.wizard.e2e.test.ts`

## エージェント信頼性 eval（Skills）

すでに「エージェント信頼性 eval」のように振る舞う CI セーフなテストがいくつかあります。

- 実 Gateway（ゲートウェイ） + エージェントループを通した mock のツール呼び出し（`src/gateway/gateway.tool-calling.mock-openai.test.ts`）。
- セッション配線と設定効果を検証するエンドツーエンドのウィザードフロー（`src/gateway/gateway.wizard.e2e.test.ts`）。

Skills でまだ不足しているもの（[Skills](/tools/skills) を参照）:

- **意思決定:** プロンプトに skills が列挙されているとき、エージェントは正しい skill を選ぶ（または無関係なものを避ける）でしょうか？
- **遵守:** エージェントは使用前に `SKILL.md` を読み、必須の手順/引数に従うでしょうか？
- **ワークフロー契約:** ツール順序、セッション履歴の引き継ぎ、サンドボックス境界をアサートするマルチターンシナリオ。

将来の eval は、まず決定論的であるべきです。

- mock プロバイダーを使ってツール呼び出し + 順序、skill ファイルの読み取り、セッション配線をアサートするシナリオランナー。
- skill にフォーカスした小さなシナリオ群（使用 vs 回避、ゲーティング、プロンプトインジェクション）。
- CI セーフなスイートが整ってからの、任意の live eval（オプトイン、環境変数でゲート）。

## リグレッションの追加（ガイダンス）

live で発見されたプロバイダー/モデルの問題を修正したら:

- 可能なら CI セーフなリグレッションを追加してください（プロバイダーの mock/stub、または正確な request 形状変換のキャプチャ）
- 本質的に live 専用（レートリミット、認証ポリシー）の場合は、live テストを狭く保ち、環境変数でオプトインにしてください
- バグを捕捉できる最小レイヤーを狙うことを推奨します:
  - プロバイダーの request 変換/リプレイのバグ → direct models テスト
  - Gateway（ゲートウェイ）のセッション/履歴/ツールのパイプラインバグ → Gateway（ゲートウェイ）live スモーク、または CI セーフな Gateway（ゲートウェイ）mock テスト
