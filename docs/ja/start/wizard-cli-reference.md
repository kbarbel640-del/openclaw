---
summary: "CLI オンボーディングフロー、認証/モデル設定、出力、および内部仕様の完全リファレンス"
read_when:
  - openclaw onboard の詳細な挙動が必要な場合
  - オンボーディング結果をデバッグしている、またはオンボーディングクライアントを統合している場合
title: "CLI オンボーディングリファレンス"
sidebarTitle: "CLI リファレンス"
x-i18n:
  source_path: start/wizard-cli-reference.md
  source_hash: 0ef6f01c3e29187b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:41Z
---

# CLI オンボーディングリファレンス

このページは、`openclaw onboard` の完全なリファレンスです。
短いガイドについては、[Onboarding Wizard (CLI)](/start/wizard) を参照してください。

## ウィザードの内容

ローカルモード（デフォルト）では、次の内容を順に案内します。

- モデルと認証の設定（OpenAI Code サブスクリプション OAuth、Anthropic API キーまたはセットアップトークン、さらに MiniMax、GLM、Moonshot、AI Gateway の各オプション）
- ワークスペースの場所とブートストラップファイル
- Gateway（ゲートウェイ）設定（ポート、bind、認証、Tailscale）
- チャンネルとプロバイダー（Telegram、WhatsApp、Discord、Google Chat、Mattermost プラグイン、Signal）
- デーモンのインストール（LaunchAgent または systemd ユーザーユニット）
- ヘルスチェック
- Skills の設定

リモートモードは、このマシンが別の場所にあるゲートウェイに接続するよう構成します。
リモートホストには何もインストールせず、変更もしません。

## ローカルフローの詳細

<Steps>
  <Step title="既存設定の検出">
    - `~/.openclaw/openclaw.json` が存在する場合、「保持」「変更」「リセット」を選択します。
    - ウィザードを再実行しても、明示的に「リセット」を選択（または `--reset` を渡す）しない限り、何も消去されません。
    - 設定が無効、またはレガシーキーを含む場合、ウィザードは停止し、続行する前に `openclaw doctor` を実行するよう求めます。
    - リセットは `trash` を使用し、次のスコープを提示します:
      - 設定のみ
      - 設定 + 認証情報 + セッション
      - フルリセット（ワークスペースも削除）
  </Step>
  <Step title="モデルと認証">
    - 完全な選択肢のマトリクスは、[認証とモデルのオプション](#auth-and-model-options) にあります。
  </Step>
  <Step title="ワークスペース">
    - デフォルトは `~/.openclaw/workspace`（設定可能）です。
    - 初回実行のブートストラップ手順に必要なワークスペースファイルを作成します。
    - ワークスペース構成: [エージェントのワークスペース](/concepts/agent-workspace)。
  </Step>
  <Step title="Gateway（ゲートウェイ）">
    - ポート、bind、認証モード、Tailscale 公開についてプロンプトします。
    - 推奨: loopback であってもトークン認証を有効のままにし、ローカルの WS クライアントが認証を必要とするようにします。
    - ローカルのあらゆるプロセスを完全に信頼する場合にのみ、認証を無効化してください。
    - loopback 以外の bind でも認証は必須です。
  </Step>
  <Step title="チャンネル">
    - [WhatsApp](/channels/whatsapp): 任意の QR ログイン
    - [Telegram](/channels/telegram): ボットトークン
    - [Discord](/channels/discord): ボットトークン
    - [Google Chat](/channels/googlechat): サービスアカウント JSON + webhook audience
    - [Mattermost](/channels/mattermost) プラグイン: ボットトークン + base URL
    - [Signal](/channels/signal): 任意の `signal-cli` インストール + アカウント設定
    - [BlueBubbles](/channels/bluebubbles): iMessage に推奨; サーバー URL + パスワード + webhook
    - [iMessage](/channels/imessage): レガシーな `imsg` CLI パス + DB アクセス
    - ダイレクトメッセージのセキュリティ: デフォルトはペアリングです。最初のダイレクトメッセージでコードが送信されます。`openclaw pairing approve <channel> <code>` で承認するか、許可リストを使用してください。
  </Step>
  <Step title="デーモンのインストール">
    - macOS: LaunchAgent
      - ログイン済みユーザーセッションが必要です。ヘッドレスの場合は、カスタム LaunchDaemon（未同梱）を使用してください。
    - Linux と Windows（WSL2 経由）: systemd ユーザーユニット
      - ウィザードは `loginctl enable-linger <user>` を試行し、ログアウト後もゲートウェイが稼働し続けるようにします。
      - sudo を求める場合があります（`/var/lib/systemd/linger` を書き込み）。まず sudo なしで試行します。
    - ランタイム選択: Node（推奨; WhatsApp と Telegram に必須）。Bun は推奨されません。
  </Step>
  <Step title="ヘルスチェック">
    - （必要であれば）ゲートウェイを起動し、`openclaw health` を実行します。
    - `openclaw status --deep` は、ステータス出力にゲートウェイのヘルスプローブを追加します。
  </Step>
  <Step title="Skills">
    - 利用可能なスキルを読み取り、要件を確認します。
    - node マネージャーとして npm または pnpm を選択できます（bun は推奨されません）。
    - 任意の依存関係をインストールします（macOS では一部が Homebrew を使用します）。
  </Step>
  <Step title="完了">
    - iOS、Android、macOS アプリの選択肢を含む要約と次のステップを表示します。
  </Step>
</Steps>

<Note>
GUI が検出されない場合、ウィザードはブラウザーを開く代わりに、Control UI 用の SSH ポートフォワード手順を表示します。
Control UI アセットが不足している場合、ウィザードはそれらのビルドを試行します。フォールバックは `pnpm ui:build`（UI 依存関係を自動インストール）です。
</Note>

## リモートモードの詳細

リモートモードは、このマシンが別の場所にあるゲートウェイに接続するよう構成します。

<Info>
リモートモードは、リモートホストに何もインストールせず、変更もしません。
</Info>

設定する内容:

- リモートゲートウェイ URL（`ws://...`）
- リモートゲートウェイで認証が必要な場合のトークン（推奨）

<Note>
- ゲートウェイが loopback のみの場合は、SSH トンネリングまたは tailnet を使用してください。
- デバイス検出のヒント:
  - macOS: Bonjour（`dns-sd`）
  - Linux: Avahi（`avahi-browse`）
</Note>

## 認証とモデルのオプション

<AccordionGroup>
  <Accordion title="Anthropic API キー（推奨）">
    `ANTHROPIC_API_KEY` が存在する場合はそれを使用し、存在しない場合はキーの入力を求めてから、デーモン利用のために保存します。
  </Accordion>
  <Accordion title="Anthropic OAuth（Claude Code CLI）">
    - macOS: Keychain アイテム「Claude Code-credentials」を確認します
    - Linux と Windows: `~/.claude/.credentials.json` が存在する場合は再利用します

    macOS では、launchd 起動がブロックされないように「Always Allow」を選択してください。

  </Accordion>
  <Accordion title="Anthropic トークン（setup-token の貼り付け）">
    任意のマシンで `claude setup-token` を実行し、そのトークンを貼り付けます。
    名前を付けることができます。空欄の場合はデフォルトを使用します。
  </Accordion>
  <Accordion title="OpenAI Code サブスクリプション（Codex CLI の再利用）">
    `~/.codex/auth.json` が存在する場合、ウィザードはそれを再利用できます。
  </Accordion>
  <Accordion title="OpenAI Code サブスクリプション（OAuth）">
    ブラウザーフローで、`code#state` を貼り付けます。

    モデルが未設定、または `openai/*` の場合、`agents.defaults.model` を `openai-codex/gpt-5.3-codex` に設定します。

  </Accordion>
  <Accordion title="OpenAI API キー">
    `OPENAI_API_KEY` が存在する場合はそれを使用し、存在しない場合はキーの入力を求めてから、launchd が読み取れるように `~/.openclaw/.env` に保存します。

    モデルが未設定、`openai/*`、または `openai-codex/*` の場合、`agents.defaults.model` を `openai/gpt-5.1-codex` に設定します。

  </Accordion>
  <Accordion title="OpenCode Zen">
    `OPENCODE_API_KEY`（または `OPENCODE_ZEN_API_KEY`）の入力を求めます。
    セットアップ URL: [opencode.ai/auth](https://opencode.ai/auth)。
  </Accordion>
  <Accordion title="API キー（汎用）">
    キーを保存します。
  </Accordion>
  <Accordion title="Vercel AI Gateway">
    `AI_GATEWAY_API_KEY` の入力を求めます。
    詳細: [Vercel AI Gateway](/providers/vercel-ai-gateway)。
  </Accordion>
  <Accordion title="Cloudflare AI Gateway">
    アカウント ID、ゲートウェイ ID、`CLOUDFLARE_AI_GATEWAY_API_KEY` の入力を求めます。
    詳細: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)。
  </Accordion>
  <Accordion title="MiniMax M2.1">
    設定は自動で書き込まれます。
    詳細: [MiniMax](/providers/minimax)。
  </Accordion>
  <Accordion title="Synthetic（Anthropic 互換）">
    `SYNTHETIC_API_KEY` の入力を求めます。
    詳細: [Synthetic](/providers/synthetic)。
  </Accordion>
  <Accordion title="Moonshot と Kimi Coding">
    Moonshot（Kimi K2）と Kimi Coding の設定は自動で書き込まれます。
    詳細: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)。
  </Accordion>
  <Accordion title="スキップ">
    認証を未設定のままにします。
  </Accordion>
</AccordionGroup>

モデルの挙動:

- 検出されたオプションからデフォルトモデルを選択するか、プロバイダーとモデルを手動で入力します。
- ウィザードはモデルチェックを実行し、設定されたモデルが不明、または認証が不足している場合に警告します。

認証情報とプロファイルのパス:

- OAuth 認証情報: `~/.openclaw/credentials/oauth.json`
- 認証プロファイル（API キー + OAuth）: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

<Note>
ヘッドレス/サーバー向けのヒント: ブラウザーがあるマシンで OAuth を完了し、その後 `~/.openclaw/credentials/oauth.json`（または `$OPENCLAW_STATE_DIR/credentials/oauth.json`）
をゲートウェイホストへコピーしてください。
</Note>

## 出力と内部仕様

`~/.openclaw/openclaw.json` における典型的なフィールド:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers`（MiniMax を選択した場合）
- `gateway.*`（mode、bind、auth、tailscale）
- `channels.telegram.botToken`、`channels.discord.token`、`channels.signal.*`、`channels.imessage.*`
- プロンプト中にオプトインした場合のチャンネル許可リスト（Slack、Discord、Matrix、Microsoft Teams）（可能な場合は名前が ID に解決されます）
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` は `agents.list[]` と、任意の `bindings` を書き込みます。

WhatsApp の認証情報は `~/.openclaw/credentials/whatsapp/<accountId>/` 配下に保存されます。
セッションは `~/.openclaw/agents/<agentId>/sessions/` 配下に保存されます。

<Note>
一部のチャンネルはプラグインとして提供されます。オンボーディング中に選択された場合、ウィザードはチャンネル設定の前に、プラグイン（npm またはローカルパス）のインストールを促します。
</Note>

Gateway（ゲートウェイ）ウィザード RPC:

- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`

クライアント（macOS アプリと Control UI）は、オンボーディングロジックを再実装せずにステップをレンダリングできます。

Signal のセットアップ挙動:

- 適切なリリースアセットをダウンロードします
- それを `~/.openclaw/tools/signal-cli/<version>/` 配下に保存します
- 設定に `channels.signal.cliPath` を書き込みます
- JVM ビルドには Java 21 が必要です
- 利用可能な場合はネイティブビルドが使用されます
- Windows は WSL2 を使用し、WSL 内で Linux の signal-cli フローに従います

## 関連ドキュメント

- オンボーディングハブ: [Onboarding Wizard (CLI)](/start/wizard)
- 自動化とスクリプト: [CLI Automation](/start/wizard-cli-automation)
- コマンドリファレンス: [`openclaw onboard`](/cli/onboard)
