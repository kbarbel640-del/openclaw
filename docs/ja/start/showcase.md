---
title: "ショーケース"
description: "コミュニティによる実世界の OpenClaw プロジェクト"
summary: "OpenClaw によって実現された、コミュニティ製のプロジェクトと連携"
x-i18n:
  source_path: start/showcase.md
  source_hash: b3460f6a7b994879
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:15Z
---

# ショーケース

コミュニティの実プロジェクトをご紹介します。OpenClaw で人々が何を作っているのかをご覧ください。

<Info>
**掲載されたいですか？** [Discord の #showcase](https://discord.gg/clawd) でプロジェクトを共有するか、[X で @openclaw をタグ付け](https://x.com/openclaw) してください。
</Info>

## 🎥 動く OpenClaw

VelvetShark による完全なセットアップ手順（28 分）。

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/SaWSPZoPX34"
    title="OpenClaw: The self-hosted AI that Siri should have been (Full setup)"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[YouTube で視聴](https://www.youtube.com/watch?v=SaWSPZoPX34)

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/mMSKQvlmFuQ"
    title="OpenClaw showcase video"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[YouTube で視聴](https://www.youtube.com/watch?v=mMSKQvlmFuQ)

<div
  style={{
    position: "relative",
    paddingBottom: "56.25%",
    height: 0,
    overflow: "hidden",
    borderRadius: 16,
  }}
>
  <iframe
    src="https://www.youtube-nocookie.com/embed/5kkIJNUGFho"
    title="OpenClaw community showcase"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[YouTube で視聴](https://www.youtube.com/watch?v=5kkIJNUGFho)

## 🆕 Discord からの最新情報

<CardGroup cols={2}>

<Card title="PR Review → Telegram Feedback" icon="code-pull-request" href="https://x.com/i/status/2010878524543131691">
  **@bangnokia** • `review` `github` `telegram`

OpenCode が変更を完了 → PR を作成 → OpenClaw が diff をレビューし、「軽微な提案」と明確なマージ判定（先に適用すべき重大な修正を含む）を Telegram で返信します。

  <img src="/assets/showcase/pr-review-telegram.jpg" alt="OpenClaw PR review feedback delivered in Telegram" />
</Card>

<Card title="Wine Cellar Skill in Minutes" icon="wine-glass" href="https://x.com/i/status/2010916352454791216">
  **@prades_maxime** • `skills` `local` `csv`

ローカルのワインセラー Skill について「Robby」（@openclaw）に依頼しました。サンプルの CSV エクスポートと保存場所を尋ねた後、Skill を素早く構築／テストします（例では 962 本）。

  <img src="/assets/showcase/wine-cellar-skill.jpg" alt="OpenClaw building a local wine cellar skill from CSV" />
</Card>

<Card title="Tesco Shop Autopilot" icon="cart-shopping" href="https://x.com/i/status/2009724862470689131">
  **@marchattonhere** • `automation` `browser` `shopping`

週間の献立 → 定番商品 → 配達枠を予約 → 注文を確認。API は不要で、ブラウザ操作のみです。

  <img src="/assets/showcase/tesco-shop.jpg" alt="Tesco shop automation via chat" />
</Card>

<Card title="SNAG Screenshot-to-Markdown" icon="scissors" href="https://github.com/am-will/snag">
  **@am-will** • `devtools` `screenshots` `markdown`

ホットキーで画面領域を選択 → Gemini vision → クリップボードに即座に Markdown を生成します。

  <img src="/assets/showcase/snag.png" alt="SNAG screenshot-to-markdown tool" />
</Card>

<Card title="Agents UI" icon="window-maximize" href="https://releaseflow.net/kitze/agents-ui">
  **@kitze** • `ui` `skills` `sync`

Agents、Claude、Codex、OpenClaw 全体で Skills／コマンドを管理するデスクトップアプリです。

  <img src="/assets/showcase/agents-ui.jpg" alt="Agents UI app" />
</Card>

<Card title="Telegram Voice Notes (papla.media)" icon="microphone" href="https://papla.media/docs">
  **Community** • `voice` `tts` `telegram`

papla.media の TTS をラップして、結果を Telegram のボイスノートとして送信します（煩わしい自動再生なし）。

  <img src="/assets/showcase/papla-tts.jpg" alt="Telegram voice note output from TTS" />
</Card>

<Card title="CodexMonitor" icon="eye" href="https://clawhub.com/odrobnik/codexmonitor">
  **@odrobnik** • `devtools` `codex` `brew`

Homebrew でインストールできるヘルパーで、ローカルの OpenAI Codex セッションを一覧表示／検査／監視します（CLI + VS Code）。

  <img src="/assets/showcase/codexmonitor.png" alt="CodexMonitor on ClawHub" />
</Card>

<Card title="Bambu 3D Printer Control" icon="print" href="https://clawhub.com/tobiasbischoff/bambu-cli">
  **@tobiasbischoff** • `hardware` `3d-printing` `skill`

BambuLab プリンターの制御とトラブルシューティング：ステータス、ジョブ、カメラ、AMS、キャリブレーションなど。

  <img src="/assets/showcase/bambu-cli.png" alt="Bambu CLI skill on ClawHub" />
</Card>

<Card title="Vienna Transport (Wiener Linien)" icon="train" href="https://clawhub.com/hjanuschka/wienerlinien">
  **@hjanuschka** • `travel` `transport` `skill`

ウィーンの公共交通について、リアルタイムの出発情報、遅延／運休、エレベーター状況、経路案内を提供します。

  <img src="/assets/showcase/wienerlinien.png" alt="Wiener Linien skill on ClawHub" />
</Card>

<Card title="ParentPay School Meals" icon="utensils" href="#">
  **@George5562** • `automation` `browser` `parenting`

ParentPay による英国の学校給食予約を自動化します。確実に表のセルをクリックするためにマウス座標を使用します。
</Card>

<Card title="R2 Upload (Send Me My Files)" icon="cloud-arrow-up" href="https://clawhub.com/skills/r2-upload">
  **@julianengel** • `files` `r2` `presigned-urls`

Cloudflare R2/S3 にアップロードし、安全な署名付きダウンロードリンク（presigned）を生成します。リモートの OpenClaw インスタンスに最適です。
</Card>

<Card title="iOS App via Telegram" icon="mobile" href="#">
  **@coard** • `ios` `xcode` `testflight`

地図と音声録音を備えた完全な iOS アプリを構築し、Telegram チャットだけで TestFlight にデプロイしました。

  <img src="/assets/showcase/ios-testflight.jpg" alt="iOS app on TestFlight" />
</Card>

<Card title="Oura Ring Health Assistant" icon="heart-pulse" href="#">
  **@AS** • `health` `oura` `calendar`

Oura ring のデータをカレンダー、予定、ジムのスケジュールと統合する、個人向けの AI 健康アシスタントです。

  <img src="/assets/showcase/oura-health.png" alt="Oura ring health assistant" />
</Card>
<Card title="Kev's Dream Team (14+ Agents)" icon="robot" href="https://github.com/adam91holt/orchestrated-ai-articles">
  **@adam91holt** • `multi-agent` `orchestration` `architecture` `manifesto`

Opus 4.5 のオーケストレーターの配下で 1 つの gateway に 14 体以上の agent を配置し、Codex ワーカーへ委任します。Dream Team の構成、モデル選定、サンドボックス化、webhook、heartbeat、委任フローを網羅した包括的な[技術解説](https://github.com/adam91holt/orchestrated-ai-articles)があります。agent のサンドボックス化には [Clawdspace](https://github.com/adam91holt/clawdspace) を使用します。[ブログ記事](https://adams-ai-journey.ghost.io/2026-the-year-of-the-orchestrator/)。
</Card>

<Card title="Linear CLI" icon="terminal" href="https://github.com/Finesssee/linear-cli">
  **@NessZerra** • `devtools` `linear` `cli` `issues`

agentic ワークフロー（Claude Code、OpenClaw）と統合する Linear 向け CLI です。ターミナルから issue、プロジェクト、ワークフローを管理できます。初の外部 PR がマージされました！
</Card>

<Card title="Beeper CLI" icon="message" href="https://github.com/blqke/beepcli">
  **@jules** • `messaging` `beeper` `cli` `automation`

Beeper Desktop を介してメッセージの読み取り、送信、アーカイブを行います。Beeper の local MCP API を使用するため、agent が 1 か所で（iMessage、WhatsApp など）すべてのチャットを管理できます。
</Card>

</CardGroup>

## 🤖 自動化 & ワークフロー

<CardGroup cols={2}>

<Card title="Winix Air Purifier Control" icon="wind" href="https://x.com/antonplex/status/2010518442471006253">
  **@antonplex** • `automation` `hardware` `air-quality`

Claude Code が空気清浄機の操作を発見して確認し、その後は OpenClaw が引き継いで室内の空気品質を管理します。

  <img src="/assets/showcase/winix-air-purifier.jpg" alt="Winix air purifier control via OpenClaw" />
</Card>

<Card title="Pretty Sky Camera Shots" icon="camera" href="https://x.com/signalgaining/status/2010523120604746151">
  **@signalgaining** • `automation` `camera` `skill` `images`

屋根のカメラをトリガーに、「空がきれいに見えたら写真を撮って」と OpenClaw に依頼します。Skill を設計して実際に撮影しました。

  <img src="/assets/showcase/roof-camera-sky.jpg" alt="Roof camera sky snapshot captured by OpenClaw" />
</Card>

<Card title="Visual Morning Briefing Scene" icon="robot" href="https://x.com/buddyhadry/status/2010005331925954739">
  **@buddyhadry** • `automation` `briefing` `images` `telegram`

スケジュールされたプロンプトにより、OpenClaw の persona を通じて、毎朝 1 枚の「シーン」画像（天気、タスク、日付、お気に入りの投稿／引用）を生成します。
</Card>

<Card title="Padel Court Booking" icon="calendar-check" href="https://github.com/joshp123/padel-cli">
  **@joshp123** • `automation` `booking` `cli`
  
  Playtomic の空き状況チェッカー + 予約用 CLI です。もう空きコートを見逃しません。
  
  <img src="/assets/showcase/padel-screenshot.jpg" alt="padel-cli screenshot" />
</Card>

<Card title="Accounting Intake" icon="file-invoice-dollar">
  **Community** • `automation` `email` `pdf`
  
  メールから PDF を収集し、税理士向けに書類を準備します。月次の経理をオートパイロット化します。
</Card>

<Card title="Couch Potato Dev Mode" icon="couch" href="https://davekiss.com">
  **@davekiss** • `telegram` `website` `migration` `astro`

Netflix を観ながら Telegram 経由で個人サイト全体を再構築しました — Notion → Astro、18 本の記事を移行、DNS を Cloudflare へ。ノート PC を一度も開きませんでした。
</Card>

<Card title="Job Search Agent" icon="briefcase">
  **@attol8** • `automation` `api` `skill`

求人情報を検索し、CV のキーワードと照合して、リンク付きの関連案件を返します。JSearch API を使って 30 分で作成しました。
</Card>

<Card title="Jira Skill Builder" icon="diagram-project" href="https://x.com/jdrhyne/status/2008336434827002232">
  **@jdrhyne** • `automation` `jira` `skill` `devtools`

OpenClaw を Jira に接続し、その場で新しい Skill を生成しました（ClawHub に存在する前の時点）。
</Card>

<Card title="Todoist Skill via Telegram" icon="list-check" href="https://x.com/iamsubhrajyoti/status/2009949389884920153">
  **@iamsubhrajyoti** • `automation` `todoist` `skill` `telegram`

Todoist のタスクを自動化し、Telegram チャット内で OpenClaw に Skill を直接生成させました。
</Card>

<Card title="TradingView Analysis" icon="chart-line">
  **@bheem1798** • `finance` `browser` `automation`

ブラウザ自動化で TradingView にログインし、チャートのスクリーンショットを撮り、要求に応じてテクニカル分析を実行します。API は不要で、ブラウザ操作のみです。
</Card>

<Card title="Slack Auto-Support" icon="slack">
  **@henrymascot** • `slack` `automation` `support`

会社の Slack チャンネルを監視し、役立つ返信を行い、通知を Telegram に転送します。依頼されることなく、デプロイ済みアプリの本番バグを自律的に修正しました。
</Card>

</CardGroup>

## 🧠 知識 & 記憶

<CardGroup cols={2}>

<Card title="xuezh Chinese Learning" icon="language" href="https://github.com/joshp123/xuezh">
  **@joshp123** • `learning` `voice` `skill`
  
  OpenClaw を通じて発音フィードバックと学習フローを提供する、中国語学習エンジンです。
  
  <img src="/assets/showcase/xuezh-pronunciation.jpeg" alt="xuezh pronunciation feedback" />
</Card>

<Card title="WhatsApp Memory Vault" icon="vault">
  **Community** • `memory` `transcription` `indexing`
  
  WhatsApp のエクスポート全体を取り込み、1,000 件以上のボイスノートを文字起こしし、git ログと突合して、リンク付きの markdown レポートを出力します。
</Card>

<Card title="Karakeep Semantic Search" icon="magnifying-glass" href="https://github.com/jamesbrooksco/karakeep-semantic-search">
  **@jamesbrooksco** • `search` `vector` `bookmarks`
  
  Qdrant + OpenAI/Ollama embeddings を使用して、Karakeep のブックマークにベクトル検索を追加します。
</Card>

<Card title="Inside-Out-2 Memory" icon="brain">
  **Community** • `memory` `beliefs` `self-model`
  
  セッションファイルを記憶 → 信念 → 進化する自己モデルへと変換する、独立したメモリマネージャーです。
</Card>

</CardGroup>

## 🎙️ 音声 & 電話

<CardGroup cols={2}>

<Card title="Clawdia Phone Bridge" icon="phone" href="https://github.com/alejandroOPI/clawdia-bridge">
  **@alejandroOPI** • `voice` `vapi` `bridge`
  
  Vapi の音声アシスタント ↔ OpenClaw の HTTP ブリッジです。agent とのほぼリアルタイムな通話を実現します。
</Card>

<Card title="OpenRouter Transcription" icon="microphone" href="https://clawhub.com/obviyus/openrouter-transcribe">
  **@obviyus** • `transcription` `multilingual` `skill`

OpenRouter（Gemini など）による多言語音声の文字起こしです。ClawHub で利用できます。
</Card>

</CardGroup>

## 🏗️ インフラ & デプロイ

<CardGroup cols={2}>

<Card title="Home Assistant Add-on" icon="home" href="https://github.com/ngutman/openclaw-ha-addon">
  **@ngutman** • `homeassistant` `docker` `raspberry-pi`
  
  Home Assistant OS 上で動作する OpenClaw gateway で、SSH トンネル対応と永続的な状態を備えます。
</Card>

<Card title="Home Assistant Skill" icon="toggle-on" href="https://clawhub.com/skills/homeassistant">
  **ClawHub** • `homeassistant` `skill` `automation`
  
  自然言語で Home Assistant デバイスを制御および自動化します。
</Card>

<Card title="Nix Packaging" icon="snowflake" href="https://github.com/openclaw/nix-openclaw">
  **@openclaw** • `nix` `packaging` `deployment`
  
  再現可能なデプロイのための、バッテリー同梱の nix 化 OpenClaw 設定です。
</Card>

<Card title="CalDAV Calendar" icon="calendar" href="https://clawhub.com/skills/caldav-calendar">
  **ClawHub** • `calendar` `caldav` `skill`
  
  khal/vdirsyncer を使用するカレンダー Skill です。セルフホストのカレンダー連携です。
</Card>

</CardGroup>

## 🏠 ホーム & ハードウェア

<CardGroup cols={2}>

<Card title="GoHome Automation" icon="house-signal" href="https://github.com/joshp123/gohome">
  **@joshp123** • `home` `nix` `grafana`
  
  インターフェースとして OpenClaw を用いた Nix ネイティブのホームオートメーションと、美しい Grafana ダッシュボードを提供します。
  
  <img src="/assets/showcase/gohome-grafana.png" alt="GoHome Grafana dashboard" />
</Card>

<Card title="Roborock Vacuum" icon="robot" href="https://github.com/joshp123/gohome/tree/main/plugins/roborock">
  **@joshp123** • `vacuum` `iot` `plugin`
  
  自然な会話を通じて Roborock のロボット掃除機を操作できます。
  
  <img src="/assets/showcase/roborock-screenshot.jpg" alt="Roborock status" />
</Card>

</CardGroup>

## 🌟 コミュニティプロジェクト

<CardGroup cols={2}>

<Card title="StarSwap Marketplace" icon="star" href="https://star-swap.com/">
  **Community** • `marketplace` `astronomy` `webapp`
  
  天体観測機材の総合マーケットプレイスです。OpenClaw エコシステムとともに／その周辺で構築されています。
</Card>

</CardGroup>

---

## プロジェクトを投稿する

共有したいものがありますか？ぜひ掲載させてください！

<Steps>
  <Step title="共有する">
    [Discord の #showcase](https://discord.gg/clawd) に投稿するか、[X で @openclaw にツイート](https://x.com/openclaw) してください
  </Step>
  <Step title="詳細を含める">
    何をするものか、リポジトリ／デモへのリンク、可能であればスクリーンショットを共有してください
  </Step>
  <Step title="掲載される">
    注目プロジェクトをこのページに追加します
  </Step>
</Steps>
