---
summary: "OpenClaw 설정, 구성 및 사용에 관한 자주 묻는 질문"
title: "FAQ"
x-i18n:
  source_path: help/faq.md
  source_hash: e87e52a9edaec927
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:42:08Z
---

# FAQ

실제 환경 설정 (로컬 개발, VPS, 멀티 에이전트, OAuth/API 키, 모델 페일오버)에 대한 빠른 답변과 심층 문제 해결을 제공합니다. 런타임 진단은 [문제 해결](/gateway/troubleshooting)을 참조하십시오. 전체 설정 참조는 [구성](/gateway/configuration)을 확인하십시오.

## 목차

- [빠른 시작 및 최초 실행 설정](#quick-start-and-firstrun-setup)
  - [막혔습니다. 가장 빠르게 해결하는 방법은 무엇인가요?](#im-stuck-whats-the-fastest-way-to-get-unstuck)
  - [OpenClaw 를 설치하고 설정하는 권장 방법은 무엇인가요?](#whats-the-recommended-way-to-install-and-set-up-openclaw)
  - [온보딩 이후 대시보드는 어떻게 여나요?](#how-do-i-open-the-dashboard-after-onboarding)
  - [localhost 와 원격에서 대시보드 인증 (토큰)은 어떻게 하나요?](#how-do-i-authenticate-the-dashboard-token-on-localhost-vs-remote)
  - [어떤 런타임이 필요하나요?](#what-runtime-do-i-need)
  - [Raspberry Pi 에서 실행되나요?](#does-it-run-on-raspberry-pi)
  - [Raspberry Pi 설치 팁이 있나요?](#any-tips-for-raspberry-pi-installs)
  - ["wake up my friend" 에서 멈추거나 온보딩이 시작되지 않습니다. 어떻게 하나요?](#it-is-stuck-on-wake-up-my-friend-onboarding-will-not-hatch-what-now)
  - [온보딩을 다시 하지 않고 새 머신 (Mac mini) 으로 이전할 수 있나요?](#can-i-migrate-my-setup-to-a-new-machine-mac-mini-without-redoing-onboarding)
  - [최신 버전의 변경 사항은 어디에서 확인하나요?](#where-do-i-see-what-is-new-in-the-latest-version)
  - [docs.openclaw.ai 에 접근할 수 없습니다 (SSL 오류). 어떻게 하나요?](#i-cant-access-docsopenclawai-ssl-error-what-now)
  - [stable 과 beta 의 차이는 무엇인가요?](#whats-the-difference-between-stable-and-beta)
  - [beta 버전은 어떻게 설치하며, beta 와 dev 의 차이는 무엇인가요?](#how-do-i-install-the-beta-version-and-whats-the-difference-between-beta-and-dev)
  - [최신 빌드를 사용해 보려면 어떻게 하나요?](#how-do-i-try-the-latest-bits)
  - [설치와 온보딩은 보통 얼마나 걸리나요?](#how-long-does-install-and-onboarding-usually-take)
  - [설치 프로그램이 멈췄나요? 더 많은 피드백을 받으려면 어떻게 하나요?](#installer-stuck-how-do-i-get-more-feedback)
  - [Windows 설치 시 git 을 찾을 수 없거나 openclaw 를 인식하지 못합니다](#windows-install-says-git-not-found-or-openclaw-not-recognized)
  - [문서에 답이 없습니다. 더 나은 답을 얻으려면 어떻게 하나요?](#the-docs-didnt-answer-my-question-how-do-i-get-a-better-answer)
  - [Linux 에 OpenClaw 는 어떻게 설치하나요?](#how-do-i-install-openclaw-on-linux)
  - [VPS 에 OpenClaw 는 어떻게 설치하나요?](#how-do-i-install-openclaw-on-a-vps)
  - [클라우드 / VPS 설치 가이드는 어디에 있나요?](#where-are-the-cloudvps-install-guides)
  - [OpenClaw 에게 스스로 업데이트하도록 요청할 수 있나요?](#can-i-ask-openclaw-to-update-itself)
  - [온보딩 마법사는 실제로 무엇을 하나요?](#what-does-the-onboarding-wizard-actually-do)
  - [이를 실행하려면 Claude 또는 OpenAI 구독이 필요한가요?](#do-i-need-a-claude-or-openai-subscription-to-run-this)
  - [API 키 없이 Claude Max 구독을 사용할 수 있나요?](#can-i-use-claude-max-subscription-without-an-api-key)
  - [Anthropic "setup-token" 인증은 어떻게 작동하나요?](#how-does-anthropic-setuptoken-auth-work)
  - [Anthropic setup-token 은 어디에서 찾나요?](#where-do-i-find-an-anthropic-setuptoken)
  - [Claude 구독 인증 (Claude Code OAuth) 을 지원하나요?](#do-you-support-claude-subscription-auth-claude-code-oauth)
  - [Anthropic 에서 `HTTP 429: rate_limit_error` 가 보이는 이유는 무엇인가요?](#why-am-i-seeing-http-429-ratelimiterror-from-anthropic)
  - [AWS Bedrock 을 지원하나요?](#is-aws-bedrock-supported)
  - [Codex 인증은 어떻게 작동하나요?](#how-does-codex-auth-work)
  - [OpenAI 구독 인증 (Codex OAuth) 을 지원하나요?](#do-you-support-openai-subscription-auth-codex-oauth)
  - [Gemini CLI OAuth 는 어떻게 설정하나요?](#how-do-i-set-up-gemini-cli-oauth)
  - [가벼운 대화에는 로컬 모델이 괜찮나요?](#is-a-local-model-ok-for-casual-chats)
  - [호스팅 모델 트래픽을 특정 지역으로 제한하려면 어떻게 하나요?](#how-do-i-keep-hosted-model-traffic-in-a-specific-region)
  - [설치하려면 Mac mini 를 구매해야 하나요?](#do-i-have-to-buy-a-mac-mini-to-install-this)
  - [iMessage 지원을 위해 Mac mini 가 필요한가요?](#do-i-need-a-mac-mini-for-imessage-support)
  - [OpenClaw 를 실행하기 위해 Mac mini 를 구매하면 MacBook Pro 에 연결할 수 있나요?](#if-i-buy-a-mac-mini-to-run-openclaw-can-i-connect-it-to-my-macbook-pro)
  - [Bun 을 사용할 수 있나요?](#can-i-use-bun)
  - [Telegram: `allowFrom` 에 무엇을 입력하나요?](#telegram-what-goes-in-allowfrom)
  - [하나의 WhatsApp 번호를 여러 OpenClaw 인스턴스에서 사용할 수 있나요?](#can-multiple-people-use-one-whatsapp-number-with-different-openclaw-instances)
  - ["빠른 채팅" 에이전트와 "코딩용 Opus" 에이전트를 함께 실행할 수 있나요?](#can-i-run-a-fast-chat-agent-and-an-opus-for-coding-agent)
  - [Linux 에서 Homebrew 가 작동하나요?](#does-homebrew-work-on-linux)
  - [해킹 가능한 (git) 설치와 npm 설치의 차이는 무엇인가요?](#whats-the-difference-between-the-hackable-git-install-and-npm-install)
  - [나중에 npm 과 git 설치 간에 전환할 수 있나요?](#can-i-switch-between-npm-and-git-installs-later)
  - [Gateway 는 노트북에서 실행해야 하나요, VPS 에서 실행해야 하나요?](#should-i-run-the-gateway-on-my-laptop-or-a-vps)
  - [OpenClaw 를 전용 머신에서 실행하는 것이 얼마나 중요한가요?](#how-important-is-it-to-run-openclaw-on-a-dedicated-machine)
  - [최소 VPS 요구 사항과 권장 OS 는 무엇인가요?](#what-are-the-minimum-vps-requirements-and-recommended-os)
  - [VM 에서 OpenClaw 를 실행할 수 있나요? 요구 사항은 무엇인가요?](#can-i-run-openclaw-in-a-vm-and-what-are-the-requirements)
- [OpenClaw 란 무엇인가요?](#what-is-openclaw)
  - [한 문단으로 설명하는 OpenClaw 는 무엇인가요?](#what-is-openclaw-in-one-paragraph)
  - [가치 제안은 무엇인가요?](#whats-the-value-proposition)
  - [막 설치했습니다. 먼저 무엇을 하면 좋을까요?](#i-just-set-it-up-what-should-i-do-first)
  - [OpenClaw 의 일상적인 상위 5 가지 활용 사례는 무엇인가요?](#what-are-the-top-five-everyday-use-cases-for-openclaw)
  - [SaaS 를 위한 리드 생성, 아웃리치 광고 및 블로그에 도움이 되나요?](#can-openclaw-help-with-lead-gen-outreach-ads-and-blogs-for-a-saas)
  - [웹 개발에서 Claude Code 대비 장점은 무엇인가요?](#what-are-the-advantages-vs-claude-code-for-web-development)
- [Skills 및 자동화](#skills-and-automation)
  - [리포지토리를 더럽히지 않고 Skills 를 커스터마이즈하려면 어떻게 하나요?](#how-do-i-customize-skills-without-keeping-the-repo-dirty)
  - [커스텀 폴더에서 Skills 를 로드할 수 있나요?](#can-i-load-skills-from-a-custom-folder)
  - [작업별로 서로 다른 모델을 사용하려면 어떻게 하나요?](#how-can-i-use-different-models-for-different-tasks)
  - [무거운 작업 중 봇이 멈춥니다. 어떻게 오프로딩하나요?](#the-bot-freezes-while-doing-heavy-work-how-do-i-offload-that)
  - [Cron 또는 리마인더가 실행되지 않습니다. 무엇을 확인해야 하나요?](#cron-or-reminders-do-not-fire-what-should-i-check)
  - [Linux 에서 Skills 는 어떻게 설치하나요?](#how-do-i-install-skills-on-linux)
  - [OpenClaw 는 백그라운드에서 일정 작업이나 연속 작업을 실행할 수 있나요?](#can-openclaw-run-tasks-on-a-schedule-or-continuously-in-the-background)
  - [Linux 에서 Apple / macOS 전용 Skills 를 실행할 수 있나요?](#can-i-run-applemacosonly-skills-from-linux)
  - [Notion 또는 HeyGen 통합이 있나요?](#do-you-have-a-notion-or-heygen-integration)
  - [브라우저 장악을 위한 Chrome 확장 프로그램은 어떻게 설치하나요?](#how-do-i-install-the-chrome-extension-for-browser-takeover)
- [샌드박스 처리 및 메모리](#sandboxing-and-memory)
  - [전용 샌드박스 처리 문서가 있나요?](#is-there-a-dedicated-sandboxing-doc)
  - [호스트 폴더를 샌드박스에 바인딩하려면 어떻게 하나요?](#how-do-i-bind-a-host-folder-into-the-sandbox)
  - [메모리는 어떻게 작동하나요?](#how-does-memory-work)
  - [메모리가 계속 잊어버립니다. 어떻게 고정하나요?](#memory-keeps-forgetting-things-how-do-i-make-it-stick)
  - [메모리는 영구적으로 유지되나요? 제한은 무엇인가요?](#does-memory-persist-forever-what-are-the-limits)
  - [시맨틱 메모리 검색에 OpenAI API 키가 필요한가요?](#does-semantic-memory-search-require-an-openai-api-key)
- [디스크 상의 위치](#where-things-live-on-disk)
  - [OpenClaw 와 함께 사용하는 모든 데이터가 로컬에 저장되나요?](#is-all-data-used-with-openclaw-saved-locally)
  - [OpenClaw 는 데이터를 어디에 저장하나요?](#where-does-openclaw-store-its-data)
  - [AGENTS.md / SOUL.md / USER.md / MEMORY.md 는 어디에 두어야 하나요?](#where-should-agentsmd-soulmd-usermd-memorymd-live)
  - [권장 백업 전략은 무엇인가요?](#whats-the-recommended-backup-strategy)
  - [OpenClaw 를 완전히 제거하려면 어떻게 하나요?](#how-do-i-completely-uninstall-openclaw)
  - [에이전트가 워크스페이스 외부에서 작업할 수 있나요?](#can-agents-work-outside-the-workspace)
  - [원격 모드입니다. 세션 스토어는 어디에 있나요?](#im-in-remote-mode-where-is-the-session-store)
- [설정 기본](#config-basics)
  - [설정 형식은 무엇이며, 어디에 있나요?](#what-format-is-the-config-where-is-it)
  - [`gateway.bind: "lan"` (또는 `"tailnet"`) 를 설정했더니 아무 것도 수신하지 않거나 UI 에서 unauthorized 로 표시됩니다](#i-set-gatewaybind-lan-or-tailnet-and-now-nothing-listens-the-ui-says-unauthorized)
  - [왜 이제 localhost 에서도 토큰이 필요한가요?](#why-do-i-need-a-token-on-localhost-now)
  - [설정을 변경한 후 재시작해야 하나요?](#do-i-have-to-restart-after-changing-config)
  - [웹 검색 (및 웹 가져오기) 은 어떻게 활성화하나요?](#how-do-i-enable-web-search-and-web-fetch)
  - [config.apply 가 제 설정을 지웠습니다. 어떻게 복구하고 방지하나요?](#configapply-wiped-my-config-how-do-i-recover-and-avoid-this)
  - [여러 디바이스에 특화된 워커를 두고 중앙 Gateway 를 실행하려면 어떻게 하나요?](#how-do-i-run-a-central-gateway-with-specialized-workers-across-devices)
  - [OpenClaw 브라우저를 headless 로 실행할 수 있나요?](#can-the-openclaw-browser-run-headless)
  - [브라우저 제어에 Brave 를 사용하려면 어떻게 하나요?](#how-do-i-use-brave-for-browser-control)
- [원격 게이트웨이 + 노드](#remote-gateways-nodes)
  - [Telegram, Gateway, 노드 간 명령은 어떻게 전파되나요?](#how-do-commands-propagate-between-telegram-the-gateway-and-nodes)
  - [Gateway 가 원격에 호스팅된 경우 에이전트가 제 컴퓨터에 접근하려면 어떻게 하나요?](#how-can-my-agent-access-my-computer-if-the-gateway-is-hosted-remotely)
  - [Tailscale 은 연결되었지만 응답이 없습니다. 어떻게 하나요?](#tailscale-is-connected-but-i-get-no-replies-what-now)
  - [두 개의 OpenClaw 인스턴스가 서로 통신할 수 있나요 (로컬 + VPS)?](#can-two-openclaw-instances-talk-to-each-other-local-vps)
  - [여러 에이전트에 대해 별도의 VPS 가 필요한가요?](#do-i-need-separate-vpses-for-multiple-agents)
  - [VPS 에서 SSH 하는 대신 개인 노트북에서 노드를 사용하는 이점이 있나요?](#is-there-a-benefit-to-using-a-node-on-my-personal-laptop-instead-of-ssh-from-a-vps)
  - [노드는 게이트웨이 서비스를 실행하나요?](#do-nodes-run-a-gateway-service)
  - [설정을 적용하는 API / RPC 방식이 있나요?](#is-there-an-api-rpc-way-to-apply-config)
  - [첫 설치를 위한 최소한의 "합리적인" 설정은 무엇인가요?](#whats-a-minimal-sane-config-for-a-first-install)
  - [VPS 에서 Tailscale 을 설정하고 Mac 에서 연결하려면 어떻게 하나요?](#how-do-i-set-up-tailscale-on-a-vps-and-connect-from-my-mac)
  - [Mac 노드를 원격 Gateway 에 연결하려면 어떻게 하나요 (Tailscale Serve)?](#how-do-i-connect-a-mac-node-to-a-remote-gateway-tailscale-serve)
  - [두 번째 노트북에 설치해야 하나요, 아니면 노드만 추가하면 되나요?](#should-i-install-on-a-second-laptop-or-just-add-a-node)
- [환경 변수 및 .env 로딩](#env-vars-and-env-loading)
  - [OpenClaw 는 환경 변수를 어떻게 로드하나요?](#how-does-openclaw-load-environment-variables)
  - ["서비스를 통해 Gateway 를 시작했더니 환경 변수가 사라졌습니다." 어떻게 하나요?](#i-started-the-gateway-via-the-service-and-my-env-vars-disappeared-what-now)
  - [`COPILOT_GITHUB_TOKEN` 를 설정했는데 모델 상태에 "Shell env: off." 가 표시됩니다. 왜인가요?](#i-set-copilotgithubtoken-but-models-status-shows-shell-env-off-why)
- [세션 및 다중 채팅](#sessions-multiple-chats)
  - [새 대화를 시작하려면 어떻게 하나요?](#how-do-i-start-a-fresh-conversation)
  - [`/new` 를 보내지 않으면 세션이 자동으로 리셋되나요?](#do-sessions-reset-automatically-if-i-never-send-new)
  - [하나의 CEO 와 여러 에이전트로 구성된 OpenClaw 팀을 만들 수 있나요?](#is-there-a-way-to-make-a-team-of-openclaw-instances-one-ceo-and-many-agents)
  - [작업 중간에 컨텍스트가 잘렸습니다. 어떻게 방지하나요?](#why-did-context-get-truncated-midtask-how-do-i-prevent-it)
  - [설치는 유지한 채 OpenClaw 를 완전히 리셋하려면 어떻게 하나요?](#how-do-i-completely-reset-openclaw-but-keep-it-installed)
  - ["context too large" 오류가 발생합니다. 어떻게 리셋 또는 압축하나요?](#im-getting-context-too-large-errors-how-do-i-reset-or-compact)
  - ["LLM request rejected: messages.N.content.X.tool_use.input: Field required" 오류가 보이는 이유는 무엇인가요?](#why-am-i-seeing-llm-request-rejected-messagesncontentxtooluseinput-field-required)
  - [30 분마다 heartbeat 메시지가 오는 이유는 무엇인가요?](#why-am-i-getting-heartbeat-messages-every-30-minutes)
  - [WhatsApp 그룹에 "봇 계정" 을 추가해야 하나요?](#do-i-need-to-add-a-bot-account-to-a-whatsapp-group)
  - [WhatsApp 그룹의 JID 는 어떻게 얻나요?](#how-do-i-get-the-jid-of-a-whatsapp-group)
  - [그룹에서 OpenClaw 가 답장하지 않는 이유는 무엇인가요?](#why-doesnt-openclaw-reply-in-a-group)
  - [그룹 / 스레드는 다이렉트 메시지와 컨텍스트를 공유하나요?](#do-groupsthreads-share-context-with-dms)
  - [워크스페이스와 에이전트는 몇 개까지 만들 수 있나요?](#how-many-workspaces-and-agents-can-i-create)
  - [Slack 에서 여러 봇이나 채팅을 동시에 실행할 수 있나요? 설정 방법은 무엇인가요?](#can-i-run-multiple-bots-or-chats-at-the-same-time-slack-and-how-should-i-set-that-up)
- [모델: 기본값, 선택, 별칭, 전환](#models-defaults-selection-aliases-switching)
  - ["기본 모델" 이란 무엇인가요?](#what-is-the-default-model)
  - [어떤 모델을 추천하나요?](#what-model-do-you-recommend)
  - [설정을 지우지 않고 모델을 전환하려면 어떻게 하나요?](#how-do-i-switch-models-without-wiping-my-config)
  - [자체 호스팅 모델 (llama.cpp, vLLM, Ollama) 을 사용할 수 있나요?](#can-i-use-selfhosted-models-llamacpp-vllm-ollama)
  - [OpenClaw, Flawd, Krill 은 어떤 모델을 사용하나요?](#what-do-openclaw-flawd-and-krill-use-for-models)
  - [재시작 없이 즉시 모델을 전환하려면 어떻게 하나요?](#how-do-i-switch-models-on-the-fly-without-restarting)
  - [일상 작업에는 GPT 5.2, 코딩에는 Codex 5.3 을 사용할 수 있나요?](#can-i-use-gpt-52-for-daily-tasks-and-codex-53-for-coding)
  - ["Model … is not allowed" 가 보이고 응답이 없는 이유는 무엇인가요?](#why-do-i-see-model-is-not-allowed-and-then-no-reply)
  - ["Unknown model: minimax/MiniMax-M2.1" 이 보이는 이유는 무엇인가요?](#why-do-i-see-unknown-model-minimaxminimaxm21)
  - [기본값은 MiniMax 로 두고 복잡한 작업에는 OpenAI 를 사용할 수 있나요?](#can-i-use-minimax-as-my-default-and-openai-for-complex-tasks)
  - [opus / sonnet / gpt 는 내장 단축키인가요?](#are-opus-sonnet-gpt-builtin-shortcuts)
  - [모델 단축키 (별칭) 를 정의 / 재정의하려면 어떻게 하나요?](#how-do-i-defineoverride-model-shortcuts-aliases)
  - [OpenRouter 나 Z.AI 같은 다른 프로바이더의 모델을 추가하려면 어떻게 하나요?](#how-do-i-add-models-from-other-providers-like-openrouter-or-zai)
- [모델 페일오버 및 "All models failed"](#model-failover-and-all-models-failed)
  - [페일오버는 어떻게 작동하나요?](#how-does-failover-work)
  - [이 오류의 의미는 무엇인가요?](#what-does-this-error-mean)
  - [`No credentials found for profile "anthropic:default"` 수정 체크리스트](#fix-checklist-for-no-credentials-found-for-profile-anthropicdefault)
  - [왜 Google Gemini 도 시도했다가 실패했나요?](#why-did-it-also-try-google-gemini-and-fail)
- [인증 프로필: 개념 및 관리 방법](#auth-profiles-what-they-are-and-how-to-manage-them)
  - [인증 프로필이란 무엇인가요?](#what-is-an-auth-profile)
  - [일반적인 프로필 ID 는 무엇인가요?](#what-are-typical-profile-ids)
  - [어떤 인증 프로필을 먼저 시도할지 제어할 수 있나요?](#can-i-control-which-auth-profile-is-tried-first)
  - [OAuth 와 API 키의 차이는 무엇인가요?](#oauth-vs-api-key-whats-the-difference)
- [Gateway: 포트, "already running", 원격 모드](#gateway-ports-already-running-and-remote-mode)
  - [Gateway 는 어떤 포트를 사용하나요?](#what-port-does-the-gateway-use)
  - [`openclaw gateway status` 에서 `Runtime: running` 이라고 나오지만 `RPC probe: failed` 인 이유는 무엇인가요?](#why-does-openclaw-gateway-status-say-runtime-running-but-rpc-probe-failed)
  - [`openclaw gateway status` 에서 `Config (cli)` 과 `Config (service)` 가 다르게 표시되는 이유는 무엇인가요?](#why-does-openclaw-gateway-status-show-config-cli-and-config-service-different)
  - ["another gateway instance is already listening" 은 무슨 뜻인가요?](#what-does-another-gateway-instance-is-already-listening-mean)
  - [원격 모드로 OpenClaw 를 실행하려면 어떻게 하나요 (클라이언트가 다른 Gateway 에 연결)?](#how-do-i-run-openclaw-in-remote-mode-client-connects-to-a-gateway-elsewhere)
  - [Control UI 에서 "unauthorized" 가 표시되거나 계속 재연결됩니다. 어떻게 하나요?](#the-control-ui-says-unauthorized-or-keeps-reconnecting-what-now)
  - [`gateway.bind: "tailnet"` 를 설정했지만 바인딩되지 않거나 아무 것도 수신하지 않습니다](#i-set-gatewaybind-tailnet-but-it-cant-bind-nothing-listens)
  - [같은 호스트에서 여러 Gateway 를 실행할 수 있나요?](#can-i-run-multiple-gateways-on-the-same-host)
  - ["invalid handshake" / code 1008 은 무슨 의미인가요?](#what-does-invalid-handshake-code-1008-mean)
- [로깅 및 디버깅](#logging-and-debugging)
  - [로그는 어디에 있나요?](#where-are-logs)
  - [Gateway 서비스를 시작 / 중지 / 재시작하려면 어떻게 하나요?](#how-do-i-startstoprestart-the-gateway-service)
  - [Windows 에서 터미널을 닫았습니다. OpenClaw 를 어떻게 재시작하나요?](#i-closed-my-terminal-on-windows-how-do-i-restart-openclaw)
  - [Gateway 는 실행 중이지만 응답이 오지 않습니다. 무엇을 확인해야 하나요?](#the-gateway-is-up-but-replies-never-arrive-what-should-i-check)
  - ["Disconnected from gateway: no reason" 이 보입니다. 어떻게 하나요?](#disconnected-from-gateway-no-reason-what-now)
  - [Telegram setMyCommands 가 네트워크 오류로 실패합니다. 무엇을 확인해야 하나요?](#telegram-setmycommands-fails-with-network-errors-what-should-i-check)
  - [TUI 에 출력이 없습니다. 무엇을 확인해야 하나요?](#tui-shows-no-output-what-should-i-check)
  - [Gateway 를 완전히 중지한 뒤 다시 시작하려면 어떻게 하나요?](#how-do-i-completely-stop-then-start-the-gateway)
  - [ELI5: `openclaw gateway restart` vs `openclaw gateway`](#eli5-openclaw-gateway-restart-vs-openclaw-gateway)
  - [무언가 실패했을 때 더 많은 세부 정보를 가장 빠르게 얻는 방법은 무엇인가요?](#whats-the-fastest-way-to-get-more-details-when-something-fails)
- [미디어 및 첨부 파일](#media-attachments)
  - [Skill 이 이미지 / PDF 를 생성했지만 아무 것도 전송되지 않았습니다](#my-skill-generated-an-imagepdf-but-nothing-was-sent)
- [보안 및 접근 제어](#security-and-access-control)
  - [OpenClaw 를 인바운드 다이렉트 메시지에 노출해도 안전한가요?](#is-it-safe-to-expose-openclaw-to-inbound-dms)
  - [프롬프트 인젝션은 공개 봇에서만 문제가 되나요?](#is-prompt-injection-only-a-concern-for-public-bots)
  - [봇에 전용 이메일, GitHub 계정 또는 전화번호를 제공해야 하나요?](#should-my-bot-have-its-own-email-github-account-or-phone-number)
  - [문자 메시지에 대한 자율성을 부여할 수 있나요? 안전한가요?](#can-i-give-it-autonomy-over-my-text-messages-and-is-that-safe)
  - [개인 비서 작업에 더 저렴한 모델을 사용할 수 있나요?](#can-i-use-cheaper-models-for-personal-assistant-tasks)
  - [Telegram 에서 `/start` 를 실행했지만 페어링 코드가 오지 않았습니다](#i-ran-start-in-telegram-but-didnt-get-a-pairing-code)
  - [WhatsApp: 내 연락처에 메시지를 보내나요? 페어링은 어떻게 작동하나요?](#whatsapp-will-it-message-my-contacts-how-does-pairing-work)
- [채팅 명령, 작업 중단, "멈추지 않아요"](#chat-commands-aborting-tasks-and-it-wont-stop)
  - [내부 시스템 메시지가 채팅에 표시되지 않게 하려면 어떻게 하나요?](#how-do-i-stop-internal-system-messages-from-showing-in-chat)
  - [실행 중인 작업을 중지 / 취소하려면 어떻게 하나요?](#how-do-i-stopcancel-a-running-task)
  - [Telegram 에서 Discord 메시지를 보내려면 어떻게 하나요? ("Cross-context messaging denied")](#how-do-i-send-a-discord-message-from-telegram-crosscontext-messaging-denied)
  - [연속으로 메시지를 보내면 봇이 "무시" 하는 것처럼 느껴지는 이유는 무엇인가요?](#why-does-it-feel-like-the-bot-ignores-rapidfire-messages)

## 문제가 발생했을 때 처음 60 초

1. **빠른 상태 확인 (첫 점검)**

   ```bash
   openclaw status
   ```

   빠른 로컬 요약: OS + 업데이트, 게이트웨이 / 서비스 접근성, 에이전트 / 세션, 프로바이더 설정 + 런타임 문제 (게이트웨이에 접근 가능한 경우).

2. **공유 가능한 보고서 (안전)**

   ```bash
   openclaw status --all
   ```

   로그 꼬리 포함 읽기 전용 진단 (토큰 마스킹됨).

3. **데몬 + 포트 상태**

   ```bash
   openclaw gateway status
   ```

   슈퍼바이저 런타임 대비 RPC 접근성, 프로브 대상 URL, 서비스가 사용한 것으로 보이는 설정을 표시합니다.

4. **심층 프로브**

   ```bash
   openclaw status --deep
   ```

   게이트웨이 상태 점검 + 프로바이더 프로브를 실행합니다 (접근 가능한 게이트웨이가 필요). [Health](/gateway/health)를 참조하십시오.

5. **최신 로그 확인**

   ```bash
   openclaw logs --follow
   ```

   RPC 가 다운된 경우 다음으로 대체하십시오:

   ```bash
   tail -f "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)"
   ```

   파일 로그는 서비스 로그와 별개입니다. [Logging](/logging) 및 [문제 해결](/gateway/troubleshooting)을 참조하십시오.

6. **Doctor 실행 (복구)**

   ```bash
   openclaw doctor
   ```

   설정 / 상태를 복구 / 마이그레이션하고 상태 점검을 실행합니다. [Doctor](/gateway/doctor)를 참조하십시오.

7. **Gateway 스냅샷**
   ```bash
   openclaw health --json
   openclaw health --verbose   # shows the target URL + config path on errors
   ```
   실행 중인 게이트웨이에 전체 스냅샷을 요청합니다 (WS 전용). [Health](/gateway/health)를 참조하십시오.

## 빠른 시작 및 최초 실행 설정

### Im stuck whats the fastest way to get unstuck

사용 중인 머신을 **직접 볼 수 있는** 로컬 AI 에이전트를 사용하십시오. Discord 에서 질문하는 것보다 훨씬 효과적입니다. 대부분의 "막혔어요" 사례는 **로컬 설정 또는 환경 문제**이기 때문에 원격 도움으로는 확인할 수 없습니다.

- **Claude Code**: https://www.anthropic.com/claude-code/
- **OpenAI Codex**: https://openai.com/codex/

이 도구들은 리포지토리를 읽고, 명령을 실행하며, 로그를 검사하고, 머신 수준의 설정 (PATH, 서비스, 권한, 인증 파일) 을 수정하는 데 도움을 줄 수 있습니다. 해킹 가능한 (git) 설치로 **전체 소스 체크아웃**을 제공하십시오:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

이 방식은 OpenClaw 를 **git 체크아웃에서 설치**하므로, 에이전트가 코드와 문서를 읽고 현재 실행 중인 정확한 버전을 기준으로 추론할 수 있습니다. 나중에 `--install-method git` 없이 설치 프로그램을 다시 실행하여 언제든지 stable 로 되돌릴 수 있습니다.

팁: 에이전트에게 수정 작업을 **계획하고 감독**하도록 요청한 뒤 (단계별), 필요한 명령만 실행하게 하십시오. 변경 사항을 작게 유지하면 감사하기도 쉬워집니다.

실제 버그나 수정 사항을 발견하셨다면 GitHub 이슈를 등록하거나 PR 을 보내주십시오:
https://github.com/openclaw/openclaw/issues
https://github.com/openclaw/openclaw/pulls

도움 요청 시 다음 명령부터 실행하십시오 (출력을 공유):

```bash
openclaw status
openclaw models status
openclaw doctor
```

역할:

- `openclaw status`: 게이트웨이 / 에이전트 상태 + 기본 설정의 빠른 스냅샷.
- `openclaw models status`: 프로바이더 인증 + 모델 가용성 점검.
- `openclaw doctor`: 일반적인 설정 / 상태 문제를 검증하고 복구.

기타 유용한 CLI 점검: `openclaw status --all`, `openclaw logs --follow`,
`openclaw gateway status`, `openclaw health --verbose`.

빠른 디버그 루프: [문제가 발생했을 때 처음 60 초](#first-60-seconds-if-somethings-broken).
설치 문서: [Install](/install), [Installer flags](/install/installer), [Updating](/install/updating).

### What's the recommended way to install and set up OpenClaw

리포지토리에서는 소스에서 실행하고 온보딩 마법사를 사용하는 것을 권장합니다:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw onboard --install-daemon
```

마법사는 UI 자산을 자동으로 빌드할 수도 있습니다. 온보딩 후에는 일반적으로 **18789** 포트에서 Gateway 를 실행합니다.

소스 기준 (기여자 / 개발자):

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm build
pnpm ui:build # auto-installs UI deps on first run
openclaw onboard
```

전역 설치가 아직 없다면 `pnpm openclaw onboard` 를 통해 실행하십시오.

### How do I open the dashboard after onboarding

마법사는 온보딩 직후 토큰이 없는 깨끗한 대시보드 URL 로 브라우저를 엽니다. 또한 요약에 링크를 출력합니다. 해당 탭을 열어 두십시오. 실행되지 않았다면 같은 머신에서 출력된 URL 을 복사 / 붙여넣기 하십시오.

### How do I authenticate the dashboard token on localhost vs remote

**Localhost (같은 머신):**

- `http://127.0.0.1:18789/` 을 여십시오.
- 인증을 요청하면 `gateway.auth.token` (또는 `OPENCLAW_GATEWAY_TOKEN`) 에서 토큰을 복사해 Control UI 설정에 붙여넣으십시오.
- 게이트웨이 호스트에서 가져오십시오: `openclaw config get gateway.auth.token` (또는 생성: `openclaw doctor --generate-gateway-token`).

**Localhost 가 아닌 경우:**

- **Tailscale Serve** (권장): loopback 바인드를 유지하고 `openclaw gateway --tailscale serve` 을 실행한 뒤 `https://<magicdns>/` 를 여십시오. `gateway.auth.allowTailscale` 이 `true` 이면 ID 헤더로 인증이 충족됩니다 (토큰 불필요).
- **Tailnet 바인드**: `openclaw gateway --bind tailnet --token "<token>"` 실행 후 `http://<tailscale-ip>:18789/` 를 열고 대시보드 설정에 토큰을 붙여넣으십시오.
- **SSH 터널**: `ssh -N -L 18789:127.0.0.1:18789 user@host` 실행 후 `http://127.0.0.1:18789/` 를 열고 Control UI 설정에 토큰을 붙여넣으십시오.

바인드 모드와 인증 세부 정보는 [Dashboard](/web/dashboard) 및 [Web surfaces](/web)를 참조하십시오.

### What runtime do I need

Node **>= 22** 가 필요합니다. `pnpm` 를 권장합니다. Gateway 에서는 Bun 을 **권장하지 않습니다**.

### Does it run on Raspberry Pi

네. Gateway 는 경량입니다. 문서에는 개인 사용 기준으로 **512MB-1GB RAM**, **1 코어**, 약 **500MB** 디스크면 충분하다고 명시되어 있으며, **Raspberry Pi 4 에서 실행 가능**하다고 안내합니다.

추가 여유 (로그, 미디어, 기타 서비스) 를 원한다면 **2GB** 를 권장하지만 필수는 아닙니다.

팁: 소형 Pi / VPS 에 Gateway 를 호스팅하고, 노트북 / 휴대폰에서 **노드**를 페어링하여 로컬 화면 / 카메라 / 캔버스 또는 명령 실행을 사용할 수 있습니다. [Nodes](/nodes)를 참조하십시오.

### Any tips for Raspberry Pi installs

요약: 동작은 하지만 다소 거친 부분이 있을 수 있습니다.

- **64-bit** OS 를 사용하고 Node >= 22 를 유지하십시오.
- 로그 확인과 빠른 업데이트를 위해 **해킹 가능한 (git) 설치**를 선호하십시오.
- 채널 / Skills 없이 시작한 뒤 하나씩 추가하십시오.
- 이상한 바이너리 문제는 보통 **ARM 호환성** 문제입니다.

문서: [Linux](/platforms/linux), [Install](/install).

### It is stuck on wake up my friend onboarding will not hatch What now

이 화면은 Gateway 가 접근 가능하고 인증되어 있어야 합니다. TUI 는 최초 해치 시 "Wake up, my friend!" 를 자동 전송합니다. 해당 문구가 **응답 없이** 보이고 토큰이 0 으로 유지된다면 에이전트가 실행되지 않은 것입니다.

1. Gateway 재시작:

```bash
openclaw gateway restart
```

2. 상태 + 인증 확인:

```bash
openclaw status
openclaw models status
openclaw logs --follow
```

3. 여전히 멈추면 다음을 실행하십시오:

```bash
openclaw doctor
```

Gateway 가 원격인 경우 터널 / Tailscale 연결이 활성화되어 있고 UI 가 올바른 Gateway 를 가리키는지 확인하십시오. [Remote access](/gateway/remote)를 참조하십시오.

### Can I migrate my setup to a new machine Mac mini without redoing onboarding

네. **상태 디렉토리**와 **워크스페이스**를 복사한 뒤 Doctor 를 한 번 실행하면 됩니다. 두 위치를 **모두** 복사하면 봇의 상태 (메모리, 세션 기록, 인증, 채널 상태) 가 그대로 유지됩니다.

1. 새 머신에 OpenClaw 설치.
2. 이전 머신의 `$OPENCLAW_STATE_DIR` (기본값: `~/.openclaw`) 복사.
3. 워크스페이스 복사 (기본값: `~/.openclaw/workspace`).
4. `openclaw doctor` 실행 후 Gateway 서비스 재시작.

이렇게 하면 설정, 인증 프로필, WhatsApp 자격 증명, 세션, 메모리가 유지됩니다. 원격 모드인 경우 세션 스토어와 워크스페이스는 게이트웨이 호스트에 있음을 기억하십시오.

**중요:** 워크스페이스만 GitHub 에 커밋 / 푸시하면 **메모리 + 부트스트랩 파일**만 백업됩니다. 세션 기록이나 인증은 백업되지 않습니다. 이는 `~/.openclaw/` (예: `~/.openclaw/agents/<agentId>/sessions/`) 아래에 있습니다.

관련 문서: [Migrating](/install/migrating), [디스크 상의 위치](/help/faq#where-does-openclaw-store-its-data),
[에이전트 워크스페이스](/concepts/agent-workspace), [Doctor](/gateway/doctor),
[원격 모드](/gateway/remote).

### Where do I see what is new in the latest version

GitHub 변경 로그를 확인하십시오:
https://github.com/openclaw/openclaw/blob/main/CHANGELOG.md

최신 항목은 상단에 있습니다. 상단 섹션이 **Unreleased** 로 표시되어 있으면, 다음 날짜가 있는 섹션이 최신 배포 버전입니다. 항목은 **Highlights**, **Changes**, **Fixes** 로 그룹화되어 있습니다.

### I cant access docs.openclaw.ai SSL error What now

일부 Comcast / Xfinity 연결에서는 Xfinity Advanced Security 가 `docs.openclaw.ai` 를 잘못 차단합니다. 이를 비활성화하거나 `docs.openclaw.ai` 를 허용 목록에 추가한 뒤 다시 시도하십시오. 자세한 내용은 [문제 해결](/help/troubleshooting#docsopenclawai-shows-an-ssl-error-comcastxfinity)를 참조하십시오.
차단 해제를 돕기 위해 다음에 보고해 주십시오: https://spa.xfinity.com/check_url_status.

여전히 접근할 수 없다면 문서는 GitHub 에도 미러되어 있습니다:
https://github.com/openclaw/openclaw/tree/main/docs

### What's the difference between stable and beta

**Stable** 과 **beta** 는 별도의 코드 라인이 아니라 **npm dist-tag** 입니다:

- `latest` = stable
- `beta` = 테스트용 초기 빌드

빌드는 먼저 **beta** 로 배포되어 테스트되며, 안정화되면 **같은 버전**이 `latest` 로 승격됩니다. 따라서 beta 와 stable 이 **같은 버전**을 가리킬 수 있습니다.

변경 사항 확인:
https://github.com/openclaw/openclaw/blob/main/CHANGELOG.md

### How do I install the beta version and whats the difference between beta and dev

**Beta** 는 npm dist-tag `beta` 입니다 (`latest` 와 일치할 수 있음).
**Dev** 는 `main` (git) 의 이동 헤드이며, 게시 시 npm dist-tag `dev` 를 사용합니다.

원라인 (macOS / Linux):

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --beta
```

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --install-method git
```

Windows 설치 프로그램 (PowerShell):
https://openclaw.ai/install.ps1

자세한 내용: [Development channels](/install/development-channels) 및 [Installer flags](/install/installer).

### How long does install and onboarding usually take

대략적인 기준:

- **설치:** 2-5 분
- **온보딩:** 구성하는 채널 / 모델 수에 따라 5-15 분

멈추면 [Installer stuck](/help/faq#installer-stuck-how-do-i-get-more-feedback) 와
[Im stuck](/help/faq#im-stuck--whats-the-fastest-way-to-get-unstuck) 의 빠른 디버그 루프를 사용하십시오.

### How do I try the latest bits

두 가지 방법이 있습니다:

1. **Dev 채널 (git 체크아웃):**

```bash
openclaw update --channel dev
```

이는 `main` 브랜치로 전환하고 소스에서 업데이트합니다.

2. **해킹 가능한 설치 (설치 사이트에서):**

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

편집 가능한 로컬 리포지토리를 제공하며, git 으로 업데이트합니다.

수동으로 깨끗한 클론을 원하면 다음을 사용하십시오:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm build
```

문서: [Update](/cli/update), [Development channels](/install/development-channels),
[Install](/install).

### Installer stuck How do I get more feedback

**상세 출력**으로 설치 프로그램을 다시 실행하십시오:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --verbose
```

상세 출력으로 beta 설치:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --beta --verbose
```

해킹 가능한 (git) 설치의 경우:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --verbose
```

추가 옵션: [Installer flags](/install/installer).

### Windows install says git not found or openclaw not recognized

Windows 에서 흔한 두 가지 문제:

**1) npm 오류 spawn git / git not found**

- **Git for Windows** 를 설치하고 `git` 가 PATH 에 있는지 확인하십시오.
- PowerShell 을 닫았다가 다시 열고 설치 프로그램을 재실행하십시오.

**2) 설치 후 openclaw 를 인식하지 못함**

- npm 전역 bin 폴더가 PATH 에 없습니다.
- 경로 확인:
  ```powershell
  npm config get prefix
  ```
- `<prefix>\\bin` 가 PATH 에 있는지 확인하십시오 (대부분의 시스템에서는 `%AppData%\\npm`).
- PATH 업데이트 후 PowerShell 을 닫았다가 다시 여십시오.

가장 매끄러운 Windows 설정을 원하면 네이티브 Windows 대신 **WSL2** 를 사용하십시오.
문서: [Windows](/platforms/windows).

### The docs didnt answer my question how do I get a better answer

**해킹 가능한 (git) 설치**를 사용해 전체 소스와 문서를 로컬에 두고, 해당 폴더에서 봇 (또는 Claude / Codex) 에게 질문하십시오. 그러면 리포지토리를 읽고 정확히 답변할 수 있습니다.

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

자세한 내용: [Install](/install) 및 [Installer flags](/install/installer).

### How do I install OpenClaw on Linux

간단히 말해 Linux 가이드를 따른 뒤 온보딩 마법사를 실행하십시오.

- Linux 빠른 경로 + 서비스 설치: [Linux](/platforms/linux).
- 전체 안내: [시작하기](/start/getting-started).
- 설치 및 업데이트: [Install & updates](/install/updating).

### How do I install OpenClaw on a VPS

모든 Linux VPS 에서 작동합니다. 서버에 설치한 뒤 SSH / Tailscale 로 Gateway 에 접근하십시오.

가이드: [exe.dev](/install/exe-dev), [Hetzner](/install/hetzner), [Fly.io](/install/fly).
원격 접근: [Gateway remote](/gateway/remote).

### Where are the cloudVPS install guides

일반적인 프로바이더를 모아둔 **호스팅 허브**가 있습니다. 하나를 선택해 가이드를 따르십시오:

- [VPS hosting](/vps) (모든 프로바이더)
- [Fly.io](/install/fly)
- [Hetzner](/install/hetzner)
- [exe.dev](/install/exe-dev)

클라우드에서의 동작 방식: **Gateway 는 서버에서 실행**되며, Control UI (또는 Tailscale / SSH) 를 통해 노트북 / 휴대폰에서 접근합니다. 상태 + 워크스페이스는 서버에 있으므로, 해당 호스트를 단일 진실 원본으로 취급하고 백업하십시오.

클라우드 Gateway 에 **노드** (Mac / iOS / Android / headless) 를 페어링하여 로컬 화면 / 카메라 / 캔버스 접근이나 노트북에서 명령 실행을 유지할 수 있습니다.

허브: [Platforms](/platforms). 원격 접근: [Gateway remote](/gateway/remote).
노드: [Nodes](/nodes), [Nodes CLI](/cli/nodes).

### Can I ask OpenClaw to update itself

요약: **가능하지만 권장하지 않습니다**. 업데이트 과정에서 Gateway 가 재시작되어 활성 세션이 끊길 수 있고, 깨끗한 git 체크아웃이 필요할 수 있으며, 확인을 요청할 수 있습니다. 운영자로서 셸에서 업데이트를 실행하는 것이 더 안전합니다.

CLI 사용:

```bash
openclaw update
openclaw update status
openclaw update --channel stable|beta|dev
openclaw update --tag <dist-tag|version>
openclaw update --no-restart
```

에이전트에서 자동화해야 한다면:

```bash
openclaw update --yes --no-restart
openclaw gateway restart
```

문서: [Update](/cli/update), [Updating](/install/updating).

### What does the onboarding wizard actually do

`openclaw onboard` 는 권장 설정 경로입니다. **로컬 모드**에서 다음을 안내합니다:

- **모델 / 인증 설정** (Claude 구독을 위한 Anthropic **setup-token** 권장, OpenAI Codex OAuth 지원, API 키 선택 사항, LM Studio 로컬 모델 지원)
- **워크스페이스** 위치 + 부트스트랩 파일
- **Gateway 설정** (바인드 / 포트 / 인증 / Tailscale)
- **프로바이더** (WhatsApp, Telegram, Discord, Mattermost (플러그인), Signal, iMessage)
- **데몬 설치** (macOS 에서는 LaunchAgent; Linux / WSL2 에서는 systemd 사용자 유닛)
- **상태 점검** 및 **Skills** 선택

설정한 모델이 알 수 없거나 인증이 없는 경우 경고합니다.

### Do I need a Claude or OpenAI subscription to run this

아니요. **API 키** (Anthropic / OpenAI / 기타) 또는 **로컬 전용 모델**로 OpenClaw 를 실행할 수 있어 데이터가 디바이스에 유지됩니다. 구독 (Claude Pro / Max 또는 OpenAI Codex) 은 선택적 인증 방식입니다.

문서: [Anthropic](/providers/anthropic), [OpenAI](/providers/openai),
[Local models](/gateway/local-models), [Models](/concepts/models).

### Can I use Claude Max subscription without an API key

네. API 키 대신 **setup-token** 으로 인증할 수 있습니다. 이는 구독 경로입니다.

Claude Pro / Max 구독에는 **API 키가 포함되지 않으므로**, 구독 계정에는 이 방식이 올바릅니다. 중요: 해당 사용이 Anthropic 의 구독 정책과 약관에서 허용되는지 확인해야 합니다. 가장 명시적이고 지원되는 경로를 원한다면 Anthropic API 키를 사용하십시오.

### How does Anthropic setuptoken auth work

`claude setup-token` 는 Claude Code CLI 를 통해 **토큰 문자열**을 생성합니다 (웹 콘솔에서는 제공되지 않음). **어떤 머신에서든** 실행할 수 있습니다. 마법사에서 **Anthropic token (paste setup-token)** 을 선택하거나 `openclaw models auth paste-token --provider anthropic` 로 붙여넣으십시오. 토큰은 **anthropic** 프로바이더의 인증 프로필로 저장되어 API 키처럼 사용됩니다 (자동 갱신 없음). 자세한 내용: [OAuth](/concepts/oauth).

### Where do I find an Anthropic setuptoken

Anthropic Console 에는 없습니다. setup-token 은 **Claude Code CLI** 에서 **어떤 머신에서든** 생성됩니다:

```bash
claude setup-token
```

출력된 토큰을 복사한 뒤 마법사에서 **Anthropic token (paste setup-token)** 을 선택하십시오. 게이트웨이 호스트에서 실행하려면 `openclaw models auth setup-token --provider anthropic` 를 사용하십시오. 다른 곳에서 `claude setup-token` 를 실행했다면 `openclaw models auth paste-token --provider anthropic` 로 게이트웨이 호스트에 붙여넣으십시오. [Anthropic](/providers/anthropic)을 참조하십시오.

### Do you support Claude subscription auth (Claude Pro/Max)

네. **setup-token** 으로 지원합니다. OpenClaw 는 더 이상 Claude Code CLI OAuth 토큰을 재사용하지 않습니다. setup-token 또는 Anthropic API 키를 사용하십시오. 토큰은 어디에서든 생성해 게이트웨이 호스트에 붙여넣을 수 있습니다. [Anthropic](/providers/anthropic) 및 [OAuth](/concepts/oauth)를 참조하십시오.

참고: Claude 구독 접근은 Anthropic 의 약관에 따릅니다. 프로덕션 또는 다중 사용자 워크로드에는 API 키가 일반적으로 더 안전합니다.

### Why am I seeing HTTP 429 ratelimiterror from Anthropic

현재 윈도우에서 **Anthropic 할당량 / 속도 제한**을 초과했음을 의미합니다. **Claude 구독** (setup-token 또는 Claude Code OAuth) 을 사용 중이라면 윈도우가 리셋될 때까지 기다리거나 플랜을 업그레이드하십시오. **Anthropic API 키**를 사용 중이라면 Anthropic Console 에서 사용량 / 결제를 확인하고 필요 시 한도를 상향하십시오.

팁: 프로바이더가 속도 제한에 걸려도 응답을 유지할 수 있도록 **폴백 모델**을 설정하십시오.
[Models](/cli/models) 및 [OAuth](/concepts/oauth)를 참조하십시오.

### Is AWS Bedrock supported

네. pi-ai 의 **Amazon Bedrock (Converse)** 프로바이더를 **수동 설정**으로 지원합니다. 게이트웨이 호스트에 AWS 자격 증명 / 리전을 제공하고 모델 설정에 Bedrock 프로바이더 항목을 추가해야 합니다. [Amazon Bedrock](/bedrock) 및 [Model providers](/providers/models)를 참조하십시오. 관리형 키 흐름을 선호한다면 Bedrock 앞에 OpenAI 호환 프록시를 두는 것도 유효한 옵션입니다.

### How does Codex auth work

OpenClaw 는 OAuth (ChatGPT 로그인) 를 통해 **OpenAI Code (Codex)** 를 지원합니다. 마법사는 OAuth 흐름을 실행할 수 있으며, 적절한 경우 기본 모델을 `openai-codex/gpt-5.3-codex` 로 설정합니다. [Model providers](/concepts/model-providers) 및 [Wizard](/start/wizard)를 참조하십시오.

### Do you support OpenAI subscription auth Codex OAuth

네. OpenClaw 는 **OpenAI Code (Codex) 구독 OAuth** 를 완전히 지원합니다. 온보딩 마법사가 OAuth 흐름을 실행해 줍니다.

[OAuth](/concepts/oauth), [Model providers](/concepts/model-providers), [Wizard](/start/wizard)를 참조하십시오.

### How do I set up Gemini CLI OAuth

Gemini CLI 는 `openclaw.json` 의 클라이언트 ID 또는 시크릿이 아닌 **플러그인 인증 흐름**을 사용합니다.

단계:

1. 플러그인 활성화: `openclaw plugins enable google-gemini-cli-auth`
2. 로그인: `openclaw models auth login --provider google-gemini-cli --set-default`

이렇게 하면 게이트웨이 호스트의 인증 프로필에 OAuth 토큰이 저장됩니다. 자세한 내용: [Model providers](/concepts/model-providers).

### Is a local model OK for casual chats

대개 아닙니다. OpenClaw 는 큰 컨텍스트와 강력한 안전 장치가 필요합니다. 소형 카드에서는 잘림과 누출이 발생합니다. 꼭 사용해야 한다면 로컬에서 가능한 **가장 큰** MiniMax M2.1 빌드 (LM Studio) 를 실행하고 [/gateway/local-models](/gateway/local-models)를 확인하십시오. 소형 / 양자화 모델은 프롬프트 인젝션 위험이 더 큽니다. [Security](/gateway/security)를 참조하십시오.

### How do I keep hosted model traffic in a specific region

리전 고정 엔드포인트를 선택하십시오. OpenRouter 는 MiniMax, Kimi, GLM 에 대해 US 호스팅 옵션을 제공합니다. US 호스팅 변형을 선택하면 데이터가 해당 리전에 유지됩니다. 이와 함께 `models.mode: "merge"` 를 사용해 Anthropic / OpenAI 를 나열하여 선택한 리전 프로바이더를 존중하면서 폴백을 유지할 수 있습니다.

### Do I have to buy a Mac Mini to install this

아니요. OpenClaw 는 macOS 또는 Linux (Windows 는 WSL2) 에서 실행됩니다. Mac mini 는 선택 사항입니다. 항상 켜진 호스트로 구매하는 경우도 있지만, 소형 VPS, 홈 서버, Raspberry Pi 급 장비도 충분합니다.

macOS 전용 도구에는 Mac 이 필요합니다. iMessage 는 [BlueBubbles](/channels/bluebubbles) (권장) 를 사용하십시오. BlueBubbles 서버는 어떤 Mac 에서든 실행되며, Gateway 는 Linux 나 다른 곳에서 실행할 수 있습니다. 다른 macOS 전용 도구가 필요하다면 Gateway 를 Mac 에서 실행하거나 macOS 노드를 페어링하십시오.

문서: [BlueBubbles](/channels/bluebubbles), [Nodes](/nodes), [Mac remote mode](/platforms/mac/remote).

### Do I need a Mac mini for iMessage support

Messages 에 로그인된 **어떤 macOS 디바이스**든 필요합니다. 반드시 Mac mini 일 필요는 없습니다. **[BlueBubbles](/channels/bluebubbles)** (권장) 를 사용하십시오. BlueBubbles 서버는 macOS 에서 실행되고, Gateway 는 Linux 나 다른 곳에서 실행할 수 있습니다.

일반적인 구성:

- Gateway 는 Linux / VPS 에서 실행, BlueBubbles 서버는 Messages 에 로그인된 Mac 에서 실행.
- 가장 간단한 단일 머신 구성을 원하면 모든 것을 Mac 에서 실행.

문서: [BlueBubbles](/channels/bluebubbles), [Nodes](/nodes),
[Mac remote mode](/platforms/mac/remote).

### If I buy a Mac mini to run OpenClaw can I connect it to my MacBook Pro

네. **Mac mini 에서 Gateway 를 실행**하고 MacBook Pro 를 **노드** (컴패니언 디바이스) 로 연결할 수 있습니다. 노드는 Gateway 를 실행하지 않으며, 해당 디바이스의 화면 / 카메라 / 캔버스 및 `system.run` 같은 추가 기능을 제공합니다.

일반적인 패턴:

- Mac mini 에 Gateway (항상 켜짐).
- MacBook Pro 에서 macOS 앱 또는 노드 호스트 실행 후 Gateway 와 페어링.
- `openclaw nodes status` / `openclaw nodes list` 로 확인.

문서: [Nodes](/nodes), [Nodes CLI](/cli/nodes).

### Can I use Bun

Bun 은 **권장하지 않습니다**. 특히 WhatsApp 및 Telegram 에서 런타임 버그가 관찰됩니다.
안정적인 Gateway 를 위해 **Node** 를 사용하십시오.

그래도 Bun 을 실험하려면 WhatsApp / Telegram 이 없는 비프로덕션 Gateway 에서만 사용하십시오.

### Telegram what goes in allowFrom

`channels.telegram.allowFrom` 는 **사람 발신자의 Telegram 사용자 ID** (숫자, 권장) 또는 `@username` 입니다. 봇 사용자명은 아닙니다.

더 안전한 방법 (서드파티 봇 불필요):

- 봇에게 DM 을 보내고 `openclaw logs --follow` 를 실행한 뒤 `from.id` 를 확인하십시오.

공식 Bot API:

- 봇에게 DM 을 보내고 `https://api.telegram.org/bot<bot_token>/getUpdates` 를 호출한 뒤 `message.from.id` 를 확인하십시오.

서드파티 (프라이버시 감소):

- `@userinfobot` 또는 `@getidsbot` 에 DM.

[/channels/telegram](/channels/telegram#access-control-dms--groups)를 참조하십시오.

### Can multiple people use one WhatsApp number with different OpenClaw instances

네. **멀티 에이전트 라우팅**을 통해 가능합니다. 각 발신자의 WhatsApp **DM** (피어 `kind: "dm"`, 발신자 E.164 형식 예: `+15551234567`) 를 서로 다른 `agentId` 에 바인딩하여 각 사람이 고유한 워크스페이스와 세션 스토어를 갖도록 합니다. 응답은 여전히 **같은 WhatsApp 계정**에서 오며, DM 접근 제어 (`channels.whatsapp.dmPolicy` / `channels.whatsapp.allowFrom`) 는 WhatsApp 계정 단위로 전역 적용됩니다. [Multi-Agent Routing](/concepts/multi-agent) 및 [WhatsApp](/channels/whatsapp)를 참조하십시오.

### Can I run a fast chat agent and an Opus for coding agent

네. 멀티 에이전트 라우팅을 사용하십시오. 각 에이전트에 기본 모델을 지정하고, 인바운드 라우트 (프로바이더 계정 또는 특정 피어) 를 각 에이전트에 바인딩하십시오. 예제 설정은 [Multi-Agent Routing](/concepts/multi-agent)에 있습니다. [Models](/concepts/models) 및 [Configuration](/gateway/configuration)도 함께 참조하십시오.

### Does Homebrew work on Linux

네. Homebrew 는 Linux (Linuxbrew) 를 지원합니다. 빠른 설정:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"' >> ~/.profile
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
brew install <formula>
```

systemd 로 OpenClaw 를 실행하는 경우 서비스 PATH 에 `/home/linuxbrew/.linuxbrew/bin` (또는 brew 프리픽스) 가 포함되어 `brew` 로 설치한 도구가 비로그인 셸에서도 해석되도록 하십시오.
최근 빌드는 Linux systemd 서비스에서 일반적인 사용자 bin 디렉토리 (예: `~/.local/bin`, `~/.npm-global/bin`, `~/.local/share/pnpm`, `~/.bun/bin`) 를 앞에 추가하고, 설정 시 `PNPM_HOME`, `NPM_CONFIG_PREFIX`, `BUN_INSTALL`, `VOLTA_HOME`, `ASDF_DATA_DIR`, `NVM_DIR`, `FNM_DIR` 를 존중합니다.

### What's the difference between the hackable git install and npm install

- **해킹 가능한 (git) 설치:** 전체 소스 체크아웃, 편집 가능, 기여자에게 최적.
  로컬에서 빌드하고 코드 / 문서를 패치할 수 있습니다.
- **npm 설치:** 전역 CLI 설치, 리포지토리 없음, "그냥 실행" 용도.
  업데이트는 npm dist-tag 에서 가져옵니다.

문서: [시작하기](/start/getting-started), [Updating](/install/updating).

### Can I switch between npm and git installs later

네. 다른 설치 방식을 설치한 뒤 Doctor 를 실행하여 게이트웨이 서비스가 새 엔트리포인트를 가리키도록 하십시오.
이는 **데이터를 삭제하지 않습니다**. OpenClaw 코드 설치만 변경합니다. 상태 (`~/.openclaw`) 와 워크스페이스 (`~/.openclaw/workspace`) 는 그대로 유지됩니다.

npm → git:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm build
openclaw doctor
openclaw gateway restart
```

git → npm:

```bash
npm install -g openclaw@latest
openclaw doctor
openclaw gateway restart
```

Doctor 는 게이트웨이 서비스 엔트리포인트 불일치를 감지하고 현재 설치에 맞게 서비스 설정을 재작성할 것을 제안합니다 (자동화에서는 `--repair` 사용).

백업 팁: [백업 전략](/help/faq#whats-the-recommended-backup-strategy)를 참조하십시오.

### Should I run the Gateway on my laptop or a VPS

요약: **24/7 안정성이 필요하면 VPS** 를 사용하십시오. 수면 / 재시작을 감수할 수 있고 가장 낮은 마찰을 원하면 로컬에서 실행하십시오.

**노트북 (로컬 Gateway)**

- **장점:** 서버 비용 없음, 로컬 파일 직접 접근, 보이는 브라우저 창.
- **단점:** 수면 / 네트워크 중단 시 연결 끊김, OS 업데이트 / 재부팅으로 중단, 항상 깨어 있어야 함.

**VPS / 클라우드**

- **장점:** 항상 켜짐, 안정적인 네트워크, 노트북 수면 문제 없음, 지속 실행 용이.
- **단점:** headless 실행이 일반적 (스크린샷 사용), 원격 파일 접근만 가능, 업데이트 시 SSH 필요.

**OpenClaw 특이사항:** WhatsApp / Telegram / Slack / Mattermost (플러그인) / Discord 는 VPS 에서 문제없이 작동합니다. 실제 트레이드오프는 **headless 브라우저** vs 보이는 창입니다. [Browser](/tools/browser)를 참조하십시오.

**권장 기본값:** 이전에 게이트웨이 연결 끊김을 겪었다면 VPS. Mac 을 적극적으로 사용하며 로컬 파일 접근이나 보이는 브라우저로 UI 자동화가 필요하면 로컬.

### How important is it to run OpenClaw on a dedicated machine

필수는 아니지만 **안정성과 격리를 위해 권장**합니다.

- **전용 호스트 (VPS / Mac mini / Pi):** 항상 켜짐, 수면 / 재부팅 중단 감소, 권한이 깔끔, 지속 실행 용이.
- **공용 노트북 / 데스크톱:** 테스트와 적극적인 사용에는 충분하지만, 수면이나 업데이트 시 중단이 발생할 수 있습니다.

최선의 방법은 전용 호스트에 Gateway 를 두고 노트북을 **노드**로 페어링하여 로컬 화면 / 카메라 / 실행 도구를 사용하는 것입니다. [Nodes](/nodes)를 참조하십시오.
보안 가이드는 [Security](/gateway/security)를 확인하십시오.

### What are the minimum VPS requirements and recommended OS

OpenClaw 는 경량입니다. 기본 Gateway + 채널 하나 기준:

- **절대 최소:** 1 vCPU, 1GB RAM, 약 500MB 디스크.
- **권장:** 1-2 vCPU, 2GB RAM 이상 (로그, 미디어, 다중 채널 여유). 노드 도구와 브라우저 자동화는 리소스를 많이 사용합니다.

OS: **Ubuntu LTS** (또는 최신 Debian / Ubuntu) 를 사용하십시오. Linux 설치 경로가 가장 잘 테스트되어 있습니다.

문서: [Linux](/platforms/linux), [VPS hosting](/vps).

### Can I run OpenClaw in a VM and what are the requirements

네. VM 은 VPS 와 동일하게 취급하십시오. 항상 켜져 있어야 하고 접근 가능하며, 활성화한 채널을 위한 충분한 RAM 이 필요합니다.

기본 가이드:

- **절대 최소:** 1 vCPU, 1GB RAM.
- **권장:** 여러 채널, 브라우저 자동화, 미디어 도구를 실행한다면 2GB RAM 이상.
- **OS:** Ubuntu LTS 또는 최신 Debian / Ubuntu.

Windows 환경에서는 **WSL2 가 가장 쉬운 VM 스타일 설정**이며 도구 호환성이 가장 좋습니다. [Windows](/platforms/windows), [VPS hosting](/vps)를 참조하십시오.
macOS 를 VM 에서 실행한다면 [macOS VM](/install/macos-vm)을 참조하십시오.

## What is OpenClaw?

### What is OpenClaw in one paragraph

OpenClaw 는 사용자의 디바이스에서 실행하는 개인 AI 비서입니다. 이미 사용 중인 메시징 표면 (WhatsApp, Telegram, Slack, Mattermost (플러그인), Discord, Google Chat, Signal, iMessage, WebChat) 에서 응답하며, 지원되는 플랫폼에서는 음성과 라이브 Canvas 도 제공합니다. **Gateway(게이트웨이)** 는 항상 켜진 제어 평면이며, 비서 자체가 제품입니다.

### What's the value proposition

OpenClaw 는 "단순한 Claude 래퍼"가 아닙니다. **로컬 우선 제어 평면**으로, **자신의 하드웨어**에서 강력한 비서를 실행하고, 이미 사용하는 채팅 앱에서 접근할 수 있으며, 상태가 유지되는 세션, 메모리, 도구를 제공하면서 호스팅 SaaS 에 워크플로 제어를 넘기지 않습니다.

하이라이트:

- **내 디바이스, 내 데이터:** Gateway 를 원하는 곳 (Mac, Linux, VPS) 에서 실행하고 워크스페이스 + 세션 기록을 로컬에 유지.
- **웹 샌드박스가 아닌 실제 채널:** WhatsApp / Telegram / Slack / Discord / Signal / iMessage 등, 지원 플랫폼에서는 모바일 음성 및 Canvas 제공.
- **모델 독립적:** Anthropic, OpenAI, MiniMax, OpenRouter 등 사용 가능, 에이전트별 라우팅과 페일오버.
- **로컬 전용 옵션:** 로컬 모델을 실행해 **모든 데이터를 디바이스에 유지** 가능.
- **멀티 에이전트 라우팅:** 채널, 계정, 작업별로 에이전트를 분리하고 각자 워크스페이스와 기본값 보유.
- **오픈 소스 및 해킹 가능:** 벤더 종속 없이 검사, 확장, 셀프 호스팅.

문서: [Gateway](/gateway), [Channels](/channels), [Multi-agent](/concepts/multi-agent),
[Memory](/concepts/memory).

### I just set it up what should I do first

첫 프로젝트로 좋은 예:

- 웹사이트 구축 (WordPress, Shopify, 간단한 정적 사이트).
- 모바일 앱 프로토타입 (개요, 화면, API 계획).
- 파일과 폴더 정리 (정리, 명명, 태깅).
- Gmail 연결 후 요약 또는 후속 조치 자동화.

대규모 작업도 처리할 수 있지만, 단계로 나누고 병렬 작업에는 서브 에이전트를 사용하면 가장 잘 작동합니다.

### What are the top five everyday use cases for OpenClaw

일상적인 활용은 보통 다음과 같습니다:

- **개인 브리핑:** 받은 편지함, 캘린더, 관심 뉴스 요약.
- **조사 및 초안 작성:** 빠른 조사, 요약, 이메일 또는 문서 초안.
- **리마인더 및 후속 조치:** cron 또는 heartbeat 기반 알림과 체크리스트.
- **브라우저 자동화:** 양식 작성, 데이터 수집, 반복 웹 작업.
- **디바이스 간 협업:** 휴대폰에서 작업을 보내고 Gateway 가 서버에서 실행한 뒤 결과를 채팅으로 수신.

### Can OpenClaw help with lead gen outreach ads and blogs for a SaaS

네. **조사, 자격 판단, 초안 작성**에는 도움이 됩니다. 사이트를 스캔하고, 후보 목록을 만들고, 잠재 고객을 요약하며, 아웃리치나 광고 카피 초안을 작성할 수 있습니다.

**아웃리치 또는 광고 실행**에는 사람의 검토를 유지하십시오. 스팸을 피하고 현지 법률과 플랫폼 정책을 준수하며, 발송 전 반드시 검토하십시오. 가장 안전한 패턴은 OpenClaw 가 초안을 작성하고 사람이 승인하는 것입니다.

문서: [Security](/gateway/security).

### What are the advantages vs Claude Code for web development

OpenClaw 는 IDE 대체제가 아닌 **개인 비서** 및 조정 레이어입니다. 리포지토리 내부에서 가장 빠른 코딩 루프에는 Claude Code 나 Codex 를 사용하십시오. 지속적인 메모리, 디바이스 간 접근, 도구 오케스트레이션이 필요할 때 OpenClaw 를 사용하십시오.

장점:

- **영속적인 메모리 + 워크스페이스**
- **멀티 플랫폼 접근** (WhatsApp, Telegram, TUI, WebChat)
- **도구 오케스트레이션** (브라우저, 파일, 스케줄링, 훅)
- **항상 켜진 Gateway** (VPS 에서 실행, 어디서나 상호작용)
- **노드**를 통한 로컬 브라우저 / 화면 / 카메라 / 실행

쇼케이스: https://openclaw.ai/showcase

---

여전히 해결되지 않았나요? [Discord](https://discord.com/invite/clawd) 에서 질문하거나 [GitHub discussion](https://github.com/openclaw/openclaw/discussions)을 여십시오.
