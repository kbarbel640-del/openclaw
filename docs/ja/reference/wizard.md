---
summary: "CLI オンボーディングウィザードの完全リファレンス：すべてのステップ、フラグ、設定フィールド"
read_when:
  - 特定のウィザードステップやフラグを調べるとき
  - 非対話モードでオンボーディングを自動化するとき
  - ウィザードの挙動をデバッグするとき
title: "オンボーディングウィザード リファレンス"
sidebarTitle: "Wizard Reference"
x-i18n:
  source_path: reference/wizard.md
  source_hash: 1dd46ad12c53668c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:12Z
---

# オンボーディングウィザード リファレンス

これは `openclaw onboard` CLI ウィザードの完全リファレンスです。
概要については、[Onboarding Wizard](/start/wizard) を参照してください。

## フロー詳細（ローカルモード）

<Steps>
  <Step title="既存設定の検出">
    - `~/.openclaw/openclaw.json` が存在する場合、**Keep / Modify / Reset** を選択します。
    - ウィザードを再実行しても、明示的に **Reset** を選択しない限り
      （または `--reset` を渡さない限り）何も消去されません。
    - 設定が無効、またはレガシーキーを含む場合、ウィザードは停止し、
      続行する前に `openclaw doctor` を実行するよう求めます。
    - Reset は `trash` を使用します（`rm` は使用しません）し、次のスコープを提供します。
      - 設定のみ
      - 設定 + 認証情報 + セッション
      - フルリセット（ワークスペースも削除）
  </Step>
  <Step title="モデル / 認証">
    - **Anthropic API キー（推奨）**：存在する場合は `ANTHROPIC_API_KEY` を使用し、なければキーの入力を求め、デーモン用に保存します。
    - **Anthropic OAuth（Claude Code CLI）**：macOS ではウィザードがキーチェーン項目「Claude Code-credentials」を確認します（「常に許可」を選択して、launchd 起動がブロックされないようにしてください）。Linux/Windows では、存在する場合に `~/.claude/.credentials.json` を再利用します。
    - **Anthropic トークン（setup-token を貼り付け）**：任意のマシンで `claude setup-token` を実行し、その後トークンを貼り付けます（名前を付けられます。空欄＝デフォルト）。
    - **OpenAI Code（Codex）サブスクリプション（Codex CLI）**：`~/.codex/auth.json` が存在する場合、ウィザードは再利用できます。
    - **OpenAI Code（Codex）サブスクリプション（OAuth）**：ブラウザフローで `code#state` を貼り付けます。
      - モデルが未設定、または `openai/*` の場合に、`agents.defaults.model` を `openai-codex/gpt-5.2` に設定します。
    - **OpenAI API キー**：存在する場合は `OPENAI_API_KEY` を使用し、なければキーの入力を求め、launchd が読み取れるよう `~/.openclaw/.env` に保存します。
    - **OpenCode Zen（マルチモデルプロキシ）**：`OPENCODE_API_KEY`（または `OPENCODE_ZEN_API_KEY`、取得先：https://opencode.ai/auth）を求めます。
    - **API キー**：キーを保存します。
    - **Vercel AI Gateway（マルチモデルプロキシ）**：`AI_GATEWAY_API_KEY` を求めます。
    - 詳細： [Vercel AI Gateway](/providers/vercel-ai-gateway)
    - **Cloudflare AI Gateway**：アカウント ID、Gateway ID、`CLOUDFLARE_AI_GATEWAY_API_KEY` を求めます。
    - 詳細： [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
    - **MiniMax M2.1**：設定は自動的に書き込まれます。
    - 詳細： [MiniMax](/providers/minimax)
    - **Synthetic（Anthropic 互換）**：`SYNTHETIC_API_KEY` を求めます。
    - 詳細： [Synthetic](/providers/synthetic)
    - **Moonshot（Kimi K2）**：設定は自動的に書き込まれます。
    - **Kimi Coding**：設定は自動的に書き込まれます。
    - 詳細： [Moonshot AI（Kimi + Kimi Coding）](/providers/moonshot)
    - **Skip**：まだ認証を設定しません。
    - 検出された選択肢からデフォルトモデルを選択します（またはプロバイダー / モデルを手動入力）。
    - ウィザードはモデルチェックを実行し、設定されたモデルが不明、または認証が不足している場合に警告します。
    - OAuth 認証情報は `~/.openclaw/credentials/oauth.json` に、認証プロファイルは `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`（API キー + OAuth）に保存されます。
    - 詳細： [/concepts/oauth](/concepts/oauth)
    <Note>
    ヘッドレス / サーバー向けのヒント：ブラウザのあるマシンで OAuth を完了し、
    `~/.openclaw/credentials/oauth.json`（または `$OPENCLAW_STATE_DIR/credentials/oauth.json`）を
    ゲートウェイホストにコピーしてください。
    </Note>
  </Step>
  <Step title="ワークスペース">
    - デフォルトは `~/.openclaw/workspace`（変更可能）。
    - エージェントのブートストラップ儀式に必要なワークスペースファイルを生成します。
    - ワークスペースの完全なレイアウト + バックアップガイド： [Agent workspace](/concepts/agent-workspace)
  </Step>
  <Step title="Gateway（ゲートウェイ）">
    - ポート、バインド、認証モード、Tailscale 公開。
    - 認証の推奨：local loopback であっても **Token** を維持し、ローカルの WS クライアントが認証を必須とするようにしてください。
    - 認証を無効化するのは、すべてのローカルプロセスを完全に信頼できる場合のみにしてください。
    - 非 loopback のバインドでは引き続き認証が必要です。
  </Step>
  <Step title="チャンネル">
    - [WhatsApp](/channels/whatsapp)：任意の QR ログイン。
    - [Telegram](/channels/telegram)：ボットトークン。
    - [Discord](/channels/discord)：ボットトークン。
    - [Google Chat](/channels/googlechat)：サービスアカウント JSON + webhook オーディエンス。
    - [Mattermost](/channels/mattermost)（プラグイン）：ボットトークン + ベース URL。
    - [Signal](/channels/signal)：任意の `signal-cli` インストール + アカウント設定。
    - [BlueBubbles](/channels/bluebubbles)：**iMessage に推奨**；サーバー URL + パスワード + webhook。
    - [iMessage](/channels/imessage)：レガシー `imsg` CLI パス + DB アクセス。
    - ダイレクトメッセージのセキュリティ：デフォルトはペアリングです。最初のダイレクトメッセージでコードが送信され、`openclaw pairing approve <channel> <code>` で承認するか、許可リストを使用します。
  </Step>
  <Step title="デーモンのインストール">
    - macOS：LaunchAgent
      - ログイン中のユーザーセッションが必要です。ヘッドレスの場合は、カスタム LaunchDaemon（未同梱）を使用してください。
    - Linux（および WSL2 経由の Windows）：systemd ユーザーユニット
      - ログアウト後も Gateway（ゲートウェイ）を稼働させるため、ウィザードは `loginctl enable-linger <user>` による lingering の有効化を試みます。
      - sudo を求められる場合があります（`/var/lib/systemd/linger` に書き込み）。最初は sudo なしで試行します。
    - **ランタイムの選択：** Node（推奨；WhatsApp / Telegram に必須）。Bun は **推奨されません**。
  </Step>
  <Step title="ヘルスチェック">
    - 必要に応じて Gateway（ゲートウェイ）を起動し、`openclaw health` を実行します。
    - ヒント：`openclaw status --deep` はステータス出力にゲートウェイのヘルスプローブを追加します（到達可能なゲートウェイが必要）。
  </Step>
  <Step title="Skills（推奨）">
    - 利用可能な Skills を読み取り、要件を確認します。
    - ノードマネージャーを選択できます：**npm / pnpm**（bun は推奨されません）。
    - 任意の依存関係をインストールします（macOS では Homebrew を使用するものがあります）。
  </Step>
  <Step title="完了">
    - 追加機能のための iOS / Android / macOS アプリを含む、概要と次のステップを表示します。
  </Step>
</Steps>

<Note>
GUI が検出されない場合、ウィザードはブラウザを開く代わりに Control UI 用の SSH ポートフォワード手順を表示します。
Control UI のアセットが欠落している場合、ウィザードはそれらのビルドを試みます。フォールバックは `pnpm ui:build`（UI 依存関係を自動インストール）です。
</Note>

## 非対話モード

`--non-interactive` を使用して、オンボーディングを自動化またはスクリプト化できます：

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice apiKey \
  --anthropic-api-key "$ANTHROPIC_API_KEY" \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --install-daemon \
  --daemon-runtime node \
  --skip-skills
```

機械可読なサマリーを得るには `--json` を追加します。

<Note>
`--json` は **非対話モードを意味しません**。スクリプトでは `--non-interactive`（および `--workspace`）を使用してください。
</Note>

<AccordionGroup>
  <Accordion title="Gemini の例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice gemini-api-key \
      --gemini-api-key "$GEMINI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Z.AI の例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice zai-api-key \
      --zai-api-key "$ZAI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Vercel AI Gateway の例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice ai-gateway-api-key \
      --ai-gateway-api-key "$AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Cloudflare AI Gateway の例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice cloudflare-ai-gateway-api-key \
      --cloudflare-ai-gateway-account-id "your-account-id" \
      --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
      --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Moonshot の例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice moonshot-api-key \
      --moonshot-api-key "$MOONSHOT_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Synthetic の例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice synthetic-api-key \
      --synthetic-api-key "$SYNTHETIC_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="OpenCode Zen の例">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice opencode-zen \
      --opencode-zen-api-key "$OPENCODE_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
</AccordionGroup>

### エージェントの追加（非対話）

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.2 \
  --bind whatsapp:biz \
  --non-interactive \
  --json
```

## Gateway（ゲートウェイ）ウィザード RPC

Gateway（ゲートウェイ）は RPC（`wizard.start`、`wizard.next`、`wizard.cancel`、`wizard.status`）を介してウィザードフローを公開します。
クライアント（macOS アプリ、Control UI）は、オンボーディングロジックを再実装することなくステップを描画できます。

## Signal のセットアップ（signal-cli）

ウィザードは GitHub リリースから `signal-cli` をインストールできます：

- 適切なリリースアセットをダウンロードします。
- `~/.openclaw/tools/signal-cli/<version>/` 配下に保存します。
- 設定に `channels.signal.cliPath` を書き込みます。

注意事項：

- JVM ビルドには **Java 21** が必要です。
- 利用可能な場合はネイティブビルドが使用されます。
- Windows では WSL2 を使用し、signal-cli のインストールは WSL 内で Linux フローに従います。

## ウィザードが書き込む内容

`~/.openclaw/openclaw.json` に含まれる一般的なフィールド：

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers`（Minimax を選択した場合）
- `gateway.*`（モード、バインド、認証、Tailscale）
- `channels.telegram.botToken`、`channels.discord.token`、`channels.signal.*`、`channels.imessage.*`
- プロンプト時にオプトインした場合のチャンネル許可リスト（Slack / Discord / Matrix / Microsoft Teams）。可能な場合、名前は ID に解決されます。
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` は `agents.list[]` と、任意の `bindings` を書き込みます。

WhatsApp の認証情報は `~/.openclaw/credentials/whatsapp/<accountId>/` 配下に保存されます。
セッションは `~/.openclaw/agents/<agentId>/sessions/` 配下に保存されます。

一部のチャンネルはプラグインとして提供されます。オンボーディング中に選択すると、設定前にそれらをインストール（npm またはローカルパス）するようウィザードが促します。

## 関連ドキュメント

- ウィザード概要： [Onboarding Wizard](/start/wizard)
- macOS アプリのオンボーディング： [Onboarding](/start/onboarding)
- 設定リファレンス： [Gateway configuration](/gateway/configuration)
- プロバイダー： [WhatsApp](/channels/whatsapp)、[Telegram](/channels/telegram)、[Discord](/channels/discord)、[Google Chat](/channels/googlechat)、[Signal](/channels/signal)、[BlueBubbles](/channels/bluebubbles)（iMessage）、[iMessage](/channels/imessage)（レガシー）
- Skills： [Skills](/tools/skills)、[Skills 設定](/tools/skills-config)
