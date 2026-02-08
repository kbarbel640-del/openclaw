---
summary: "關於 OpenClaw 設定、組態與使用的常見問題"
title: "常見問題"
x-i18n:
  source_path: help/faq.md
  source_hash: e87e52a9edaec927
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:20Z
---

# 常見問題

提供快速解答，以及針對實際部署情境（本機開發、VPS、多代理、OAuth / API 金鑰、模型容錯）的深入疑難排解。關於執行期診斷，請參閱 [疑難排解](/gateway/troubleshooting)。完整組態參考請見 [設定](/gateway/configuration)。

## 目錄

- [快速開始與首次執行設定](#quick-start-and-firstrun-setup)
  - [我卡住了，最快脫困的方法是什麼？](#im-stuck-whats-the-fastest-way-to-get-unstuck)
  - [安裝與設定 OpenClaw 的建議方式是什麼？](#whats-the-recommended-way-to-install-and-set-up-openclaw)
  - [完成入門引導後，如何開啟儀表板？](#how-do-i-open-the-dashboard-after-onboarding)
  - [在 localhost 與遠端時，如何驗證儀表板（token）？](#how-do-i-authenticate-the-dashboard-token-on-localhost-vs-remote)
  - [需要什麼執行環境？](#what-runtime-do-i-need)
  - [能在 Raspberry Pi 上執行嗎？](#does-it-run-on-raspberry-pi)
  - [Raspberry Pi 安裝有什麼建議？](#any-tips-for-raspberry-pi-installs)
  - [卡在「wake up my friend」/ 入門引導無法孵化，該怎麼辦？](#it-is-stuck-on-wake-up-my-friend-onboarding-will-not-hatch-what-now)
  - [能否在不重新入門引導的情況下，將設定遷移到新機器（Mac mini）？](#can-i-migrate-my-setup-to-a-new-machine-mac-mini-without-redoing-onboarding)
  - [哪裡可以看到最新版本的新內容？](#where-do-i-see-what-is-new-in-the-latest-version)
  - [無法存取 docs.openclaw.ai（SSL 錯誤），該怎麼辦？](#i-cant-access-docsopenclawai-ssl-error-what-now)
  - [stable 與 beta 有什麼差別？](#whats-the-difference-between-stable-and-beta)
  - [如何安裝 beta 版本？beta 與 dev 的差異是什麼？](#how-do-i-install-the-beta-version-and-whats-the-difference-between-beta-and-dev)
  - [如何試用最新功能？](#how-do-i-try-the-latest-bits)
  - [安裝與入門引導通常需要多久？](#how-long-does-install-and-onboarding-usually-take)
  - [安裝程式卡住了？如何取得更多回饋？](#installer-stuck-how-do-i-get-more-feedback)
  - [Windows 安裝顯示找不到 git 或 openclaw 未被辨識](#windows-install-says-git-not-found-or-openclaw-not-recognized)
  - [文件沒有回答我的問題，如何得到更好的答案？](#the-docs-didnt-answer-my-question-how-do-i-get-a-better-answer)
  - [如何在 Linux 上安裝 OpenClaw？](#how-do-i-install-openclaw-on-linux)
  - [如何在 VPS 上安裝 OpenClaw？](#how-do-i-install-openclaw-on-a-vps)
  - [雲端 / VPS 的安裝指南在哪？](#where-are-the-cloudvps-install-guides)
  - [我可以要求 OpenClaw 自行更新嗎？](#can-i-ask-openclaw-to-update-itself)
  - [入門引導精靈實際做了哪些事？](#what-does-the-onboarding-wizard-actually-do)
  - [執行需要 Claude 或 OpenAI 的訂閱嗎？](#do-i-need-a-claude-or-openai-subscription-to-run-this)
  - [沒有 API 金鑰，可以使用 Claude Max 訂閱嗎？](#can-i-use-claude-max-subscription-without-an-api-key)
  - [Anthropic 的 setup-token 驗證如何運作？](#how-does-anthropic-setuptoken-auth-work)
  - [在哪裡取得 Anthropic setup-token？](#where-do-i-find-an-anthropic-setuptoken)
  - [是否支援 Claude 訂閱驗證（Claude Code OAuth）？](#do-you-support-claude-subscription-auth-claude-code-oauth)
  - [為什麼會看到來自 Anthropic 的 `HTTP 429: rate_limit_error`？](#why-am-i-seeing-http-429-ratelimiterror-from-anthropic)
  - [是否支援 AWS Bedrock？](#is-aws-bedrock-supported)
  - [Codex 驗證如何運作？](#how-does-codex-auth-work)
  - [是否支援 OpenAI 訂閱驗證（Codex OAuth）？](#do-you-support-openai-subscription-auth-codex-oauth)
  - [如何設定 Gemini CLI OAuth](#how-do-i-set-up-gemini-cli-oauth)
  - [本機模型適合隨意聊天嗎？](#is-a-local-model-ok-for-casual-chats)
  - [如何讓託管模型的流量維持在特定區域？](#how-do-i-keep-hosted-model-traffic-in-a-specific-region)
  - [一定要買 Mac Mini 才能安裝嗎？](#do-i-have-to-buy-a-mac-mini-to-install-this)
  - [iMessage 支援需要 Mac mini 嗎？](#do-i-need-a-mac-mini-for-imessage-support)
  - [如果買 Mac mini 來執行 OpenClaw，能連線到我的 MacBook Pro 嗎？](#if-i-buy-a-mac-mini-to-run-openclaw-can-i-connect-it-to-my-macbook-pro)
  - [可以使用 Bun 嗎？](#can-i-use-bun)
  - [Telegram：`allowFrom` 要填什麼？](#telegram-what-goes-in-allowfrom)
  - [多個人可以用同一個 WhatsApp 號碼搭配不同的 OpenClaw 執行個體嗎？](#can-multiple-people-use-one-whatsapp-number-with-different-openclaw-instances)
  - [可以同時執行「快速聊天」代理與「用於寫程式的 Opus」代理嗎？](#can-i-run-a-fast-chat-agent-and-an-opus-for-coding-agent)
  - [Homebrew 在 Linux 上可用嗎？](#does-homebrew-work-on-linux)
  - [可修改（git）安裝與 npm 安裝有什麼差別？](#whats-the-difference-between-the-hackable-git-install-and-npm-install)
  - [之後可以在 npm 與 git 安裝之間切換嗎？](#can-i-switch-between-npm-and-git-installs-later)
  - [Gateway 應該跑在筆電還是 VPS？](#should-i-run-the-gateway-on-my-laptop-or-a-vps)
  - [在專用機器上執行 OpenClaw 有多重要？](#how-important-is-it-to-run-openclaw-on-a-dedicated-machine)
  - [VPS 的最低需求與建議作業系統是什麼？](#what-are-the-minimum-vps-requirements-and-recommended-os)
  - [可以在 VM 中執行 OpenClaw 嗎？需求是什麼？](#can-i-run-openclaw-in-a-vm-and-what-are-the-requirements)
- [什麼是 OpenClaw？](#what-is-openclaw)
  - [用一段話說明 OpenClaw 是什麼](#what-is-openclaw-in-one-paragraph)
  - [價值主張是什麼？](#whats-the-value-proposition)
  - [我剛設定好，接下來該做什麼？](#i-just-set-it-up-what-should-i-do-first)
  - [OpenClaw 日常最常見的五大使用情境是什麼？](#what-are-the-top-five-everyday-use-cases-for-openclaw)
  - [OpenClaw 能協助 SaaS 的名單開發、外聯廣告與部落格嗎？](#can-openclaw-help-with-lead-gen-outreach-ads-and-blogs-for-a-saas)
  - [相較於 Claude Code，在網頁開發上的優勢是什麼？](#what-are-the-advantages-vs-claude-code-for-web-development)
- [Skills 與自動化](#skills-and-automation)
  - [如何在不弄髒 repo 的情況下自訂 Skills？](#how-do-i-customize-skills-without-keeping-the-repo-dirty)
  - [可以從自訂資料夾載入 Skills 嗎？](#can-i-load-skills-from-a-custom-folder)
  - [如何為不同任務使用不同模型？](#how-can-i-use-different-models-for-different-tasks)
  - [機器人在執行大量工作時會卡住，如何卸載？](#the-bot-freezes-while-doing-heavy-work-how-do-i-offload-that)
  - [Cron 或提醒沒有觸發，該檢查什麼？](#cron-or-reminders-do-not-fire-what-should-i-check)
  - [如何在 Linux 上安裝 Skills？](#how-do-i-install-skills-on-linux)
  - [OpenClaw 可以排程或在背景持續執行任務嗎？](#can-openclaw-run-tasks-on-a-schedule-or-continuously-in-the-background)
  - [可以從 Linux 執行僅限 Apple / macOS 的 Skills 嗎？](#can-i-run-applemacosonly-skills-from-linux)
  - [是否有 Notion 或 HeyGen 整合？](#do-you-have-a-notion-or-heygen-integration)
  - [如何安裝用於瀏覽器接管的 Chrome 擴充功能？](#how-do-i-install-the-chrome-extension-for-browser-takeover)
- [沙箱隔離與記憶](#sandboxing-and-memory)
  - [是否有專門的沙箱隔離文件？](#is-there-a-dedicated-sandboxing-doc)
  - [如何將主機資料夾綁定到沙箱？](#how-do-i-bind-a-host-folder-into-the-sandbox)
  - [記憶如何運作？](#how-does-memory-work)
  - [記憶一直忘記，如何讓它留下來？](#memory-keeps-forgetting-things-how-do-i-make-it-stick)
  - [記憶會永久保存嗎？限制是什麼？](#does-memory-persist-forever-what-are-the-limits)
  - [語意記憶搜尋需要 OpenAI API 金鑰嗎？](#does-semantic-memory-search-require-an-openai-api-key)
- [磁碟上的資料位置](#where-things-live-on-disk)
  - [OpenClaw 使用的所有資料都保存在本機嗎？](#is-all-data-used-with-openclaw-saved-locally)
  - [OpenClaw 將資料存在哪裡？](#where-does-openclaw-store-its-data)
  - [AGENTS.md / SOUL.md / USER.md / MEMORY.md 應該放在哪？](#where-should-agentsmd-soulmd-usermd-memorymd-live)
  - [建議的備份策略是什麼？](#whats-the-recommended-backup-strategy)
  - [如何完整解除安裝 OpenClaw？](#how-do-i-completely-uninstall-openclaw)
  - [代理可以在 workspace 之外工作嗎？](#can-agents-work-outside-the-workspace)
  - [我在遠端模式中，工作階段儲存在哪？](#im-in-remote-mode-where-is-the-session-store)
- [設定基礎](#config-basics)
  - [設定是什麼格式？在哪裡？](#what-format-is-the-config-where-is-it)
  - [我設定了 `gateway.bind: "lan"`（或 `"tailnet"`），現在沒有任何服務在監聽 / UI 顯示未授權](#i-set-gatewaybind-lan-or-tailnet-and-now-nothing-listens-the-ui-says-unauthorized)
  - [為什麼現在在 localhost 也需要 token？](#why-do-i-need-a-token-on-localhost-now)
  - [修改設定後需要重新啟動嗎？](#do-i-have-to-restart-after-changing-config)
  - [如何啟用網頁搜尋（以及網頁抓取）？](#how-do-i-enable-web-search-and-web-fetch)
  - [config.apply 清空了我的設定，如何復原並避免？](#configapply-wiped-my-config-how-do-i-recover-and-avoid-this)
  - [如何在多個裝置間以中央 Gateway 搭配專用工作節點？](#how-do-i-run-a-central-gateway-with-specialized-workers-across-devices)
  - [OpenClaw 瀏覽器可以無頭執行嗎？](#can-the-openclaw-browser-run-headless)
  - [如何使用 Brave 進行瀏覽器控制？](#how-do-i-use-brave-for-browser-control)
- [遠端 Gateway + 節點](#remote-gateways-nodes)
  - [指令如何在 Telegram、Gateway 與節點之間傳遞？](#how-do-commands-propagate-between-telegram-the-gateway-and-nodes)
  - [如果 Gateway 託管在遠端，代理如何存取我的電腦？](#how-can-my-agent-access-my-computer-if-the-gateway-is-hosted-remotely)
  - [Tailscale 已連線但沒有回覆，該怎麼辦？](#tailscale-is-connected-but-i-get-no-replies-what-now)
  - [兩個 OpenClaw 執行個體能互相通訊嗎（本機 + VPS）？](#can-two-openclaw-instances-talk-to-each-other-local-vps)
  - [多個代理需要各自一台 VPS 嗎？](#do-i-need-separate-vpses-for-multiple-agents)
  - [相較於從 VPS 透過 SSH，在個人筆電上使用節點有好處嗎？](#is-there-a-benefit-to-using-a-node-on-my-personal-laptop-instead-of-ssh-from-a-vps)
  - [節點會執行 Gateway 服務嗎？](#do-nodes-run-a-gateway-service)
  - [是否有 API / RPC 的方式套用設定？](#is-there-an-api-rpc-way-to-apply-config)
  - [首次安裝的最小「合理」設定是什麼？](#whats-a-minimal-sane-config-for-a-first-install)
  - [如何在 VPS 上設定 Tailscale 並從 Mac 連線？](#how-do-i-set-up-tailscale-on-a-vps-and-connect-from-my-mac)
  - [如何將 Mac 節點連線到遠端 Gateway（Tailscale Serve）？](#how-do-i-connect-a-mac-node-to-a-remote-gateway-tailscale-serve)
  - [我應該在第二台筆電安裝，還是只新增節點？](#should-i-install-on-a-second-laptop-or-just-add-a-node)
- [環境變數與 .env 載入](#env-vars-and-env-loading)
  - [OpenClaw 如何載入環境變數？](#how-does-openclaw-load-environment-variables)
  - [「我透過服務啟動 Gateway，環境變數卻不見了。」該怎麼辦？](#i-started-the-gateway-via-the-service-and-my-env-vars-disappeared-what-now)
  - [我設定了 `COPILOT_GITHUB_TOKEN`，但模型狀態顯示「Shell env: off。」為什麼？](#i-set-copilotgithubtoken-but-models-status-shows-shell-env-off-why)
- [工作階段與多重聊天](#sessions-multiple-chats)
  - [如何開始全新的對話？](#how-do-i-start-a-fresh-conversation)
  - [如果我從未傳送 `/new`，工作階段會自動重置嗎？](#do-sessions-reset-automatically-if-i-never-send-new)
  - [是否能讓一組 OpenClaw 執行個體成為「一位 CEO 多位代理」？](#is-there-a-way-to-make-a-team-of-openclaw-instances-one-ceo-and-many-agents)
  - [為什麼任務進行到一半上下文被截斷？如何避免？](#why-did-context-get-truncated-midtask-how-do-i-prevent-it)
  - [如何在保留安裝的情況下完全重置 OpenClaw？](#how-do-i-completely-reset-openclaw-but-keep-it-installed)
  - [出現「context too large」錯誤，如何重置或壓縮？](#im-getting-context-too-large-errors-how-do-i-reset-or-compact)
  - [為什麼會看到「LLM request rejected: messages.N.content.X.tool_use.input: Field required」？](#why-am-i-seeing-llm-request-rejected-messagesncontentxtooluseinput-field-required)
  - [為什麼每 30 分鐘會收到 heartbeat 訊息？](#why-am-i-getting-heartbeat-messages-every-30-minutes)
  - [需要在 WhatsApp 群組中加入「機器人帳號」嗎？](#do-i-need-to-add-a-bot-account-to-a-whatsapp-group)
  - [如何取得 WhatsApp 群組的 JID？](#how-do-i-get-the-jid-of-a-whatsapp-group)
  - [為什麼 OpenClaw 在群組中不回覆？](#why-doesnt-openclaw-reply-in-a-group)
  - [群組 / 討論串會與私訊共享上下文嗎？](#do-groupsthreads-share-context-with-dms)
  - [我可以建立多少個 workspace 與代理？](#how-many-workspaces-and-agents-can-i-create)
  - [可以同時執行多個機器人或聊天（Slack）嗎？該如何設定？](#can-i-run-multiple-bots-or-chats-at-the-same-time-slack-and-how-should-i-set-that-up)
- [模型：預設、選擇、別名、切換](#models-defaults-selection-aliases-switching)
  - [什麼是「預設模型」？](#what-is-the-default-model)
  - [你們推薦哪個模型？](#what-model-do-you-recommend)
  - [如何在不清空設定的情況下切換模型？](#how-do-i-switch-models-without-wiping-my-config)
  - [可以使用自架模型（llama.cpp、vLLM、Ollama）嗎？](#can-i-use-selfhosted-models-llamacpp-vllm-ollama)
  - [OpenClaw、Flawd 與 Krill 使用哪些模型？](#what-do-openclaw-flawd-and-krill-use-for-models)
  - [如何在不中斷服務的情況下即時切換模型？](#how-do-i-switch-models-on-the-fly-without-restarting)
  - [可以用 GPT 5.2 處理日常任務、用 Codex 5.3 寫程式嗎？](#can-i-use-gpt-52-for-daily-tasks-and-codex-53-for-coding)
  - [為什麼看到「Model … is not allowed」然後沒有回覆？](#why-do-i-see-model-is-not-allowed-and-then-no-reply)
  - [為什麼看到「Unknown model: minimax/MiniMax-M2.1」？](#why-do-i-see-unknown-model-minimaxminimaxm21)
  - [可以將 MiniMax 作為預設，複雜任務再用 OpenAI 嗎？](#can-i-use-minimax-as-my-default-and-openai-for-complex-tasks)
  - [opus / sonnet / gpt 是內建捷徑嗎？](#are-opus-sonnet-gpt-builtin-shortcuts)
  - [如何定義 / 覆寫模型捷徑（別名）？](#how-do-i-defineoverride-model-shortcuts-aliases)
  - [如何新增 OpenRouter 或 Z.AI 等其他提供者的模型？](#how-do-i-add-models-from-other-providers-like-openrouter-or-zai)
- [模型容錯與「All models failed」](#model-failover-and-all-models-failed)
  - [容錯如何運作？](#how-does-failover-work)
  - [這個錯誤代表什麼？](#what-does-this-error-mean)
  - [`No credentials found for profile "anthropic:default"` 的修復檢查清單](#fix-checklist-for-no-credentials-found-for-profile-anthropicdefault)
  - [為什麼也嘗試了 Google Gemini 並失敗？](#why-did-it-also-try-google-gemini-and-fail)
- [驗證設定檔：是什麼以及如何管理](#auth-profiles-what-they-are-and-how-to-manage-them)
  - [什麼是驗證設定檔？](#what-is-an-auth-profile)
  - [常見的設定檔 ID 有哪些？](#what-are-typical-profile-ids)
  - [可以控制先嘗試哪個驗證設定檔嗎？](#can-i-control-which-auth-profile-is-tried-first)
  - [OAuth 與 API 金鑰有什麼差別？](#oauth-vs-api-key-whats-the-difference)
- [Gateway：連接埠、「已在執行」與遠端模式](#gateway-ports-already-running-and-remote-mode)
  - [Gateway 使用哪個連接埠？](#what-port-does-the-gateway-use)
  - [為什麼 `openclaw gateway status` 顯示 `Runtime: running` 但 `RPC probe: failed`？](#why-does-openclaw-gateway-status-say-runtime-running-but-rpc-probe-failed)
  - [為什麼 `openclaw gateway status` 顯示 `Config (cli)` 與 `Config (service)` 不同？](#why-does-openclaw-gateway-status-show-config-cli-and-config-service-different)
  - [「another gateway instance is already listening」代表什麼？](#what-does-another-gateway-instance-is-already-listening-mean)
  - [如何以遠端模式執行 OpenClaw（用戶端連線到其他地方的 Gateway）？](#how-do-i-run-openclaw-in-remote-mode-client-connects-to-a-gateway-elsewhere)
  - [控制 UI 顯示「unauthorized」（或不斷重新連線），該怎麼辦？](#the-control-ui-says-unauthorized-or-keeps-reconnecting-what-now)
  - [我設定了 `gateway.bind: "tailnet"`，但無法綁定 / 沒有任何監聽](#i-set-gatewaybind-tailnet-but-it-cant-bind-nothing-listens)
  - [可以在同一台主機上執行多個 Gateway 嗎？](#can-i-run-multiple-gateways-on-the-same-host)
  - [「invalid handshake」/ code 1008 代表什麼？](#what-does-invalid-handshake-code-1008-mean)
- [記錄與除錯](#logging-and-debugging)
  - [記錄在哪裡？](#where-are-logs)
  - [如何啟動 / 停止 / 重新啟動 Gateway 服務？](#how-do-i-startstoprestart-the-gateway-service)
  - [我在 Windows 關閉了終端機，如何重新啟動 OpenClaw？](#i-closed-my-terminal-on-windows-how-do-i-restart-openclaw)
  - [Gateway 正在執行但回覆始終沒有到達，該檢查什麼？](#the-gateway-is-up-but-replies-never-arrive-what-should-i-check)
  - [「Disconnected from gateway: no reason」— 該怎麼辦？](#disconnected-from-gateway-no-reason-what-now)
  - [Telegram 的 setMyCommands 因網路錯誤失敗，該檢查什麼？](#telegram-setmycommands-fails-with-network-errors-what-should-i-check)
  - [TUI 沒有任何輸出，該檢查什麼？](#tui-shows-no-output-what-should-i-check)
  - [如何完全停止後再啟動 Gateway？](#how-do-i-completely-stop-then-start-the-gateway)
  - [ELI5：`openclaw gateway restart` vs `openclaw gateway`](#eli5-openclaw-gateway-restart-vs-openclaw-gateway)
  - [當發生失敗時，最快取得更多細節的方法是什麼？](#whats-the-fastest-way-to-get-more-details-when-something-fails)
- [媒體與附件](#media-attachments)
  - [Skill 產生了圖片 / PDF，但沒有送出](#my-skill-generated-an-imagepdf-but-nothing-was-sent)
- [安全性與存取控制](#security-and-access-control)
  - [將 OpenClaw 暴露給傳入私訊安全嗎？](#is-it-safe-to-expose-openclaw-to-inbound-dms)
  - [提示注入只對公開機器人有風險嗎？](#is-prompt-injection-only-a-concern-for-public-bots)
  - [我的機器人是否應該有獨立的電子郵件、GitHub 帳號或電話號碼？](#should-my-bot-have-its-own-email-github-account-or-phone-number)
  - [我可以讓它自主管理我的簡訊嗎？這安全嗎？](#can-i-give-it-autonomy-over-my-text-messages-and-is-that-safe)
  - [可以為個人助理任務使用較便宜的模型嗎？](#can-i-use-cheaper-models-for-personal-assistant-tasks)
  - [我在 Telegram 執行了 `/start`，但沒有收到配對碼](#i-ran-start-in-telegram-but-didnt-get-a-pairing-code)
  - [WhatsApp：它會傳訊給我的聯絡人嗎？配對如何運作？](#whatsapp-will-it-message-my-contacts-how-does-pairing-work)
- [聊天指令、終止任務，以及「停不下來」](#chat-commands-aborting-tasks-and-it-wont-stop)
  - [如何停止在聊天中顯示內部系統訊息](#how-do-i-stop-internal-system-messages-from-showing-in-chat)
  - [如何停止 / 取消正在執行的任務？](#how-do-i-stopcancel-a-running-task)
  - [如何從 Telegram 傳送 Discord 訊息？（「Cross-context messaging denied」）](#how-do-i-send-a-discord-message-from-telegram-crosscontext-messaging-denied)
  - [為什麼感覺機器人會「忽略」連續快速的訊息？](#why-does-it-feel-like-the-bot-ignores-rapidfire-messages)

## 最初的 60 秒（如果東西壞了）

1. **快速狀態（第一步檢查）**

   ```bash
   openclaw status
   ```

   快速的本機摘要：作業系統 + 更新、Gateway / 服務可達性、代理 / 工作階段、提供者設定 + 執行期問題（當 Gateway 可達時）。

2. **可貼上報告（可安全分享）**

   ```bash
   openclaw status --all
   ```

   唯讀診斷，包含最新記錄（token 已遮罩）。

3. **常駐程式 + 連接埠狀態**

   ```bash
   openclaw gateway status
   ```

   顯示監督程式的執行狀態與 RPC 可達性、探測目標 URL，以及服務可能使用的設定。

4. **深度探測**

   ```bash
   openclaw status --deep
   ```

   執行 Gateway 健康檢查 + 提供者探測（需要 Gateway 可達）。請見 [Health](/gateway/health)。

5. **追蹤最新記錄**

   ```bash
   openclaw logs --follow
   ```

   若 RPC 掛掉，改用：

   ```bash
   tail -f "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)"
   ```

   檔案記錄與服務記錄是分開的；請見 [Logging](/logging) 與 [疑難排解](/gateway/troubleshooting)。

6. **執行 doctor（修復）**

   ```bash
   openclaw doctor
   ```

   修復 / 遷移設定與狀態 + 執行健康檢查。請見 [Doctor](/gateway/doctor)。

7. **Gateway 快照**
   ```bash
   openclaw health --json
   openclaw health --verbose   # shows the target URL + config path on errors
   ```
   向正在執行的 Gateway 要求完整快照（僅 WS）。請見 [Health](/gateway/health)。

---

仍然卡住嗎？請到 [Discord](https://discord.com/invite/clawd) 詢問，或開啟 [GitHub discussion](https://github.com/openclaw/openclaw/discussions)。
