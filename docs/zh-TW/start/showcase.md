---
title: "展示案例"
description: "Real-world OpenClaw projects from the community"
summary: "由社群打造、以 OpenClaw 為動力的專案與整合"
x-i18n:
  source_path: start/showcase.md
  source_hash: b3460f6a7b994879
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:14Z
---

# 展示案例

來自社群的真實專案。看看大家正在用 OpenClaw 打造什麼。

<Info>
**想被收錄嗎？** 在 [Discord 的 #showcase](https://discord.gg/clawd) 分享你的專案，或是在 X 上 [標記 @openclaw](https://x.com/openclaw)。
</Info>

## 🎥 OpenClaw 實際運作

由 VelvetShark 製作的完整設定流程（28 分鐘）。

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

[在 YouTube 上觀看](https://www.youtube.com/watch?v=SaWSPZoPX34)

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

[在 YouTube 上觀看](https://www.youtube.com/watch?v=mMSKQvlmFuQ)

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

[在 YouTube 上觀看](https://www.youtube.com/watch?v=5kkIJNUGFho)

## 🆕 來自 Discord 的最新分享

<CardGroup cols={2}>

<Card title="PR Review → Telegram Feedback" icon="code-pull-request" href="https://x.com/i/status/2010878524543131691">
  **@bangnokia** • `review` `github` `telegram`

OpenCode 完成修改 → 開啟 PR → OpenClaw 檢視差異，並在 Telegram 中回覆「小幅建議」與明確的合併結論（包含需先套用的關鍵修正）。

  <img src="/assets/showcase/pr-review-telegram.jpg" alt="OpenClaw PR review feedback delivered in Telegram" />
</Card>

<Card title="Wine Cellar Skill in Minutes" icon="wine-glass" href="https://x.com/i/status/2010916352454791216">
  **@prades_maxime** • `skills` `local` `csv`

向「Robby」（@openclaw）要求一個本機酒窖 skill。它會請求一份 CSV 匯出範例與儲存位置，接著快速建置／測試 skill（範例中有 962 瓶酒）。

  <img src="/assets/showcase/wine-cellar-skill.jpg" alt="OpenClaw building a local wine cellar skill from CSV" />
</Card>

<Card title="Tesco Shop Autopilot" icon="cart-shopping" href="https://x.com/i/status/2009724862470689131">
  **@marchattonhere** • `automation` `browser` `shopping`

每週餐點規劃 → 常購清單 → 預約配送時段 → 確認訂單。無需 API，只用瀏覽器控制。

  <img src="/assets/showcase/tesco-shop.jpg" alt="Tesco shop automation via chat" />
</Card>

<Card title="SNAG Screenshot-to-Markdown" icon="scissors" href="https://github.com/am-will/snag">
  **@am-will** • `devtools` `screenshots` `markdown`

以熱鍵選取螢幕區域 → Gemini 視覺 → 即時將 Markdown 放入剪貼簿。

  <img src="/assets/showcase/snag.png" alt="SNAG screenshot-to-markdown tool" />
</Card>

<Card title="Agents UI" icon="window-maximize" href="https://releaseflow.net/kitze/agents-ui">
  **@kitze** • `ui` `skills` `sync`

用於管理 Agents、Claude、Codex 與 OpenClaw 的 skills／commands 的桌面應用程式。

  <img src="/assets/showcase/agents-ui.jpg" alt="Agents UI app" />
</Card>

<Card title="Telegram Voice Notes (papla.media)" icon="microphone" href="https://papla.media/docs">
  **Community** • `voice` `tts` `telegram`

包裝 papla.media TTS，並將結果以 Telegram 語音備忘錄傳送（沒有惱人的自動播放）。

  <img src="/assets/showcase/papla-tts.jpg" alt="Telegram voice note output from TTS" />
</Card>

<Card title="CodexMonitor" icon="eye" href="https://clawhub.com/odrobnik/codexmonitor">
  **@odrobnik** • `devtools` `codex` `brew`

以 Homebrew 安裝的輔助工具，用於列出／檢視／監看本機 OpenAI Codex 工作階段（CLI + VS Code）。

  <img src="/assets/showcase/codexmonitor.png" alt="CodexMonitor on ClawHub" />
</Card>

<Card title="Bambu 3D Printer Control" icon="print" href="https://clawhub.com/tobiasbischoff/bambu-cli">
  **@tobiasbischoff** • `hardware` `3d-printing` `skill`

控制與疑難排解 BambuLab 印表機：狀態、工作、相機、AMS、校正等。

  <img src="/assets/showcase/bambu-cli.png" alt="Bambu CLI skill on ClawHub" />
</Card>

<Card title="Vienna Transport (Wiener Linien)" icon="train" href="https://clawhub.com/hjanuschka/wienerlinien">
  **@hjanuschka** • `travel` `transport` `skill`

維也納大眾運輸的即時發車、異動、電梯狀態與路線規劃。

  <img src="/assets/showcase/wienerlinien.png" alt="Wiener Linien skill on ClawHub" />
</Card>

<Card title="ParentPay School Meals" icon="utensils" href="#">
  **@George5562** • `automation` `browser` `parenting`

透過 ParentPay 自動化英國學校餐點預訂。使用滑鼠座標以可靠地點擊表格儲存格。
</Card>

<Card title="R2 Upload (Send Me My Files)" icon="cloud-arrow-up" href="https://clawhub.com/skills/r2-upload">
  **@julianengel** • `files` `r2` `presigned-urls`

上傳至 Cloudflare R2／S3，並產生安全的預先簽署下載連結。非常適合遠端 OpenClaw 實例。
</Card>

<Card title="iOS App via Telegram" icon="mobile" href="#">
  **@coard** • `ios` `xcode` `testflight`

完全透過 Telegram 對話打造一個包含地圖與語音錄製的完整 iOS 應用程式，並部署至 TestFlight。

  <img src="/assets/showcase/ios-testflight.jpg" alt="iOS app on TestFlight" />
</Card>

<Card title="Oura Ring Health Assistant" icon="heart-pulse" href="#">
  **@AS** • `health` `oura` `calendar`

個人 AI 健康助理，整合 Oura 戒指資料與行事曆、約會及健身排程。

  <img src="/assets/showcase/oura-health.png" alt="Oura ring health assistant" />
</Card>
<Card title="Kev's Dream Team (14+ Agents)" icon="robot" href="https://github.com/adam91holt/orchestrated-ai-articles">
  **@adam91holt** • `multi-agent` `orchestration` `architecture` `manifesto`

在單一 gateway 下運行 14+ 個 agents，由 Opus 4.5 orchestrator 指派給 Codex workers。完整的[技術說明](https://github.com/adam91holt/orchestrated-ai-articles)涵蓋 Dream Team 名單、模型選擇、沙箱隔離、webhooks、heartbeats 與委派流程。[Clawdspace](https://github.com/adam91holt/clawdspace) 用於 agent 沙箱隔離。[部落格文章](https://adams-ai-journey.ghost.io/2026-the-year-of-the-orchestrator/)。
</Card>

<Card title="Linear CLI" icon="terminal" href="https://github.com/Finesssee/linear-cli">
  **@NessZerra** • `devtools` `linear` `cli` `issues`

整合代理式工作流程（Claude Code、OpenClaw）的 Linear CLI。可從終端機管理 issues、projects 與 workflows。第一個外部 PR 已合併！
</Card>

<Card title="Beeper CLI" icon="message" href="https://github.com/blqke/beepcli">
  **@jules** • `messaging` `beeper` `cli` `automation`

透過 Beeper Desktop 讀取、傳送與封存訊息。使用 Beeper local MCP API，讓 agents 在同一處管理所有聊天（iMessage、WhatsApp 等）。
</Card>

</CardGroup>

## 🤖 自動化與工作流程

<CardGroup cols={2}>

<Card title="Winix Air Purifier Control" icon="wind" href="https://x.com/antonplex/status/2010518442471006253">
  **@antonplex** • `automation` `hardware` `air-quality`

Claude Code 發現並確認清淨機控制項後，由 OpenClaw 接手管理室內空氣品質。

  <img src="/assets/showcase/winix-air-purifier.jpg" alt="Winix air purifier control via OpenClaw" />
</Card>

<Card title="Pretty Sky Camera Shots" icon="camera" href="https://x.com/signalgaining/status/2010523120604746151">
  **@signalgaining** • `automation` `camera` `skill` `images`

由屋頂攝影機觸發：每當天空看起來很美時，請 OpenClaw 拍一張照片——它設計了 skill 並完成拍攝。

  <img src="/assets/showcase/roof-camera-sky.jpg" alt="Roof camera sky snapshot captured by OpenClaw" />
</Card>

<Card title="Visual Morning Briefing Scene" icon="robot" href="https://x.com/buddyhadry/status/2010005331925954739">
  **@buddyhadry** • `automation` `briefing` `images` `telegram`

排程提示每天早上產生一張單一「場景」影像（天氣、任務、日期、喜愛的貼文／名言），由 OpenClaw persona 生成。
</Card>

<Card title="Padel Court Booking" icon="calendar-check" href="https://github.com/joshp123/padel-cli">
  **@joshp123** • `automation` `booking` `cli`
  
  Playtomic 可用時段檢查＋訂場 CLI。再也不會錯過空場。
  
  <img src="/assets/showcase/padel-screenshot.jpg" alt="padel-cli screenshot" />
</Card>

<Card title="Accounting Intake" icon="file-invoice-dollar">
  **Community** • `automation` `email` `pdf`
  
  從電子郵件收集 PDF，為稅務顧問準備文件。每月會計自動駕駛。
</Card>

<Card title="Couch Potato Dev Mode" icon="couch" href="https://davekiss.com">
  **@davekiss** • `telegram` `website` `migration` `astro`

一邊看 Netflix、一邊透過 Telegram 重建整個個人網站——Notion → Astro，遷移 18 篇文章，DNS 指向 Cloudflare。從未打開筆電。
</Card>

<Card title="Job Search Agent" icon="briefcase">
  **@attol8** • `automation` `api` `skill`

搜尋職缺列表，與履歷關鍵字比對，並回傳相關機會與連結。使用 JSearch API，30 分鐘內完成。
</Card>

<Card title="Jira Skill Builder" icon="diagram-project" href="https://x.com/jdrhyne/status/2008336434827002232">
  **@jdrhyne** • `automation` `jira` `skill` `devtools`

OpenClaw 連接到 Jira，並即時產生新的 skill（在 ClawHub 上出現之前）。
</Card>

<Card title="Todoist Skill via Telegram" icon="list-check" href="https://x.com/iamsubhrajyoti/status/2009949389884920153">
  **@iamsubhrajyoti** • `automation` `todoist` `skill` `telegram`

自動化 Todoist 任務，並讓 OpenClaw 直接在 Telegram 對話中產生 skill。
</Card>

<Card title="TradingView Analysis" icon="chart-line">
  **@bheem1798** • `finance` `browser` `automation`

透過瀏覽器自動化登入 TradingView，擷取圖表截圖並按需進行技術分析。無需 API——只要瀏覽器控制。
</Card>

<Card title="Slack Auto-Support" icon="slack">
  **@henrymascot** • `slack` `automation` `support`

監看公司 Slack 頻道，自動回覆並轉發通知至 Telegram。未經要求即自主修復已部署應用程式中的生產環境錯誤。
</Card>

</CardGroup>

## 🧠 知識與記憶

<CardGroup cols={2}>

<Card title="xuezh Chinese Learning" icon="language" href="https://github.com/joshp123/xuezh">
  **@joshp123** • `learning` `voice` `skill`
  
  透過 OpenClaw 提供發音回饋與學習流程的中文學習引擎。
  
  <img src="/assets/showcase/xuezh-pronunciation.jpeg" alt="xuezh pronunciation feedback" />
</Card>

<Card title="WhatsApp Memory Vault" icon="vault">
  **Community** • `memory` `transcription` `indexing`
  
  匯入完整的 WhatsApp 匯出檔，轉錄 1,000+ 則語音備忘錄，與 git logs 交叉比對，輸出具連結的 Markdown 報告。
</Card>

<Card title="Karakeep Semantic Search" icon="magnifying-glass" href="https://github.com/jamesbrooksco/karakeep-semantic-search">
  **@jamesbrooksco** • `search` `vector` `bookmarks`
  
  使用 Qdrant + OpenAI／Ollama embeddings，為 Karakeep 書籤加入向量搜尋。
</Card>

<Card title="Inside-Out-2 Memory" icon="brain">
  **Community** • `memory` `beliefs` `self-model`
  
  獨立的記憶管理器，將工作階段檔案轉換為記憶 → 信念 → 持續演進的自我模型。
</Card>

</CardGroup>

## 🎙️ 語音與電話

<CardGroup cols={2}>

<Card title="Clawdia Phone Bridge" icon="phone" href="https://github.com/alejandroOPI/clawdia-bridge">
  **@alejandroOPI** • `voice` `vapi` `bridge`
  
  Vapi 語音助理 ↔ OpenClaw HTTP 橋接。與你的 agent 進行近乎即時的電話通話。
</Card>

<Card title="OpenRouter Transcription" icon="microphone" href="https://clawhub.com/obviyus/openrouter-transcribe">
  **@obviyus** • `transcription` `multilingual` `skill`

透過 OpenRouter（Gemini 等）進行多語言音訊轉錄。可於 ClawHub 取得。
</Card>

</CardGroup>

## 🏗️ 基礎架構與部署

<CardGroup cols={2}>

<Card title="Home Assistant Add-on" icon="home" href="https://github.com/ngutman/openclaw-ha-addon">
  **@ngutman** • `homeassistant` `docker` `raspberry-pi`
  
  在 Home Assistant OS 上執行的 OpenClaw gateway，支援 SSH 通道與持久化狀態。
</Card>

<Card title="Home Assistant Skill" icon="toggle-on" href="https://clawhub.com/skills/homeassistant">
  **ClawHub** • `homeassistant` `skill` `automation`
  
  以自然語言控制與自動化 Home Assistant 裝置。
</Card>

<Card title="Nix Packaging" icon="snowflake" href="https://github.com/openclaw/nix-openclaw">
  **@openclaw** • `nix` `packaging` `deployment`
  
  內建電池的 nix 化 OpenClaw 設定，用於可重現的部署。
</Card>

<Card title="CalDAV Calendar" icon="calendar" href="https://clawhub.com/skills/caldav-calendar">
  **ClawHub** • `calendar` `caldav` `skill`
  
  使用 khal／vdirsyncer 的行事曆 skill。自架行事曆整合。
</Card>

</CardGroup>

## 🏠 家庭與硬體

<CardGroup cols={2}>

<Card title="GoHome Automation" icon="house-signal" href="https://github.com/joshp123/gohome">
  **@joshp123** • `home` `nix` `grafana`
  
  以 OpenClaw 作為介面的 Nix 原生家庭自動化，並搭配精美的 Grafana 儀表板。
  
  <img src="/assets/showcase/gohome-grafana.png" alt="GoHome Grafana dashboard" />
</Card>

<Card title="Roborock Vacuum" icon="robot" href="https://github.com/joshp123/gohome/tree/main/plugins/roborock">
  **@joshp123** • `vacuum` `iot` `plugin`
  
  透過自然對話控制你的 Roborock 掃地機器人。
  
  <img src="/assets/showcase/roborock-screenshot.jpg" alt="Roborock status" />
</Card>

</CardGroup>

## 🌟 社群專案

<CardGroup cols={2}>

<Card title="StarSwap Marketplace" icon="star" href="https://star-swap.com/">
  **Community** • `marketplace` `astronomy` `webapp`
  
  完整的天文器材市集。以 OpenClaw 生態系建置／圍繞而成。
</Card>

</CardGroup>

---

## 提交你的專案

有想分享的內容嗎？我們很樂意收錄！

<Steps>
  <Step title="分享它">
    在 [Discord 的 #showcase](https://discord.gg/clawd) 發文，或在 X 上 [推文 @openclaw](https://x.com/openclaw)
  </Step>
  <Step title="包含細節">
    告訴我們它的功能，提供 repo／demo 連結，若有截圖也請分享
  </Step>
  <Step title="獲得收錄">
    我們會將亮眼的專案加入此頁面
  </Step>
</Steps>
