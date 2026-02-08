---
summary: "OpenClaw（macOS アプリ）の初回オンボーディングフロー"
read_when:
  - macOS オンボーディングアシスタントを設計する場合
  - 認証またはアイデンティティ設定を実装する場合
title: "オンボーディング（macOS アプリ）"
sidebarTitle: "オンボーディング: macOS アプリ"
x-i18n:
  source_path: start/onboarding.md
  source_hash: 45f912067527158f
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:10:49Z
---

# オンボーディング（macOS アプリ）

このドキュメントでは、**現在**の初回オンボーディングフローについて説明します。目標は、スムーズな「day 0」体験です。Gateway（ゲートウェイ）をどこで実行するかを選び、認証を接続し、ウィザードを実行し、エージェントが自分自身をブートストラップできるようにします。

<Steps>
<Step title="Approve macOS warning">
<Frame>
<img src="/assets/macos-onboarding/01-macos-warning.jpeg" alt="" />
</Frame>
</Step>
<Step title="Approve find local networks">
<Frame>
<img src="/assets/macos-onboarding/02-local-networks.jpeg" alt="" />
</Frame>
</Step>
<Step title="Welcome and security notice">
<Frame caption="表示されたセキュリティ注意事項を読み、適宜判断します">
<img src="/assets/macos-onboarding/03-security-notice.png" alt="" />
</Frame>
</Step>
<Step title="Local vs Remote">
<Frame>
<img src="/assets/macos-onboarding/04-choose-gateway.png" alt="" />
</Frame>

**Gateway** はどこで実行しますか？

- **This Mac（Local only）:** オンボーディングが OAuth フローを実行し、認証情報をローカルに書き込みできます。
- **Remote（over SSH/Tailnet）:** オンボーディングは OAuth をローカルで実行**しません**。認証情報はゲートウェイホスト上に存在している必要があります。
- **Configure later:** セットアップをスキップし、アプリを未設定のままにします。

<Tip>
**Gateway 認証のヒント:**
- ウィザードは loopback であっても **token** を生成するようになったため、ローカルの WS クライアントは認証が必要です。
- 認証を無効にすると、任意のローカルプロセスが接続できます。これは完全に信頼できるマシンでのみ使用してください。
- 複数マシンからのアクセスや、非 loopback の bind には **token** を使用してください。
</Tip>
</Step>
<Step title="Permissions">
<Frame caption="OpenClaw に付与する権限を選択します">
<img src="/assets/macos-onboarding/05-permissions.png" alt="" />
</Frame>

オンボーディングでは、以下に必要な TCC 権限を要求します。

- Automation（AppleScript）
- Notifications
- Accessibility
- Screen Recording
- Microphone
- Speech Recognition
- Camera
- Location

</Step>
<Step title="CLI">
  <Info>このステップは任意です</Info>
  アプリは、npm/pnpm を介してグローバルな `openclaw` CLI をインストールできるため、ターミナルのワークフローや launchd タスクが初期状態のまま動作します。
</Step>
<Step title="Onboarding Chat (dedicated session)">
  セットアップ後、アプリは専用のオンボーディング用チャットセッションを開き、エージェントが自己紹介し、次のステップを案内できるようにします。これにより、初回実行時のガイダンスが通常の会話から分離されます。最初のエージェント実行中にゲートウェイホストで何が起こるかについては、[Bootstrapping](/start/bootstrapping) を参照してください。
</Step>
</Steps>
