---
title: "쇼케이스"
description: "커뮤니티의 실제 OpenClaw 프로젝트"
summary: "OpenClaw 로 구동되는 커뮤니티 제작 프로젝트와 통합 사례"
x-i18n:
  source_path: start/showcase.md
  source_hash: b3460f6a7b994879
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:38:05Z
---

# 쇼케이스

커뮤니티에서 탄생한 실제 프로젝트입니다. 사람들이 OpenClaw 로 무엇을 만들고 있는지 확인해 보세요.

<Info>
**소개되고 싶으신가요?** [Discord 의 #showcase](https://discord.gg/clawd)에 프로젝트를 공유하거나 [X 에서 @openclaw 태그](https://x.com/openclaw)로 알려주세요.
</Info>

## 🎥 OpenClaw 실제 활용

VelvetShark 가 제작한 전체 설정 가이드 (28분).

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
    title="OpenClaw: Siri 가 되었어야 할 셀프 호스팅 AI (전체 설정)"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[YouTube 에서 보기](https://www.youtube.com/watch?v=SaWSPZoPX34)

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
    title="OpenClaw 쇼케이스 영상"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[YouTube 에서 보기](https://www.youtube.com/watch?v=mMSKQvlmFuQ)

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
    title="OpenClaw 커뮤니티 쇼케이스"
    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
    frameBorder="0"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
  />
</div>

[YouTube 에서 보기](https://www.youtube.com/watch?v=5kkIJNUGFho)

## 🆕 Discord 에서 새로 올라온 프로젝트

<CardGroup cols={2}>

<Card title="PR 리뷰 → Telegram 피드백" icon="code-pull-request" href="https://x.com/i/status/2010878524543131691">
  **@bangnokia** • `review` `github` `telegram`

OpenCode 가 변경 사항을 완료 → PR 을 열고 → OpenClaw 가 diff 를 리뷰한 뒤 Telegram 에서 '사소한 제안'과 함께 명확한 병합 판단 (먼저 적용해야 할 중요한 수정 사항 포함)을 전달합니다.

  <img src="/assets/showcase/pr-review-telegram.jpg" alt="Telegram 으로 전달된 OpenClaw PR 리뷰 피드백" />
</Card>

<Card title="몇 분 만에 완성한 와인 셀러 Skill" icon="wine-glass" href="https://x.com/i/status/2010916352454791216">
  **@prades_maxime** • `skills` `local` `csv`

'Robby'(@openclaw)에게 로컬 와인 셀러 Skill 을 요청했습니다. 샘플 CSV 내보내기와 저장 위치를 묻고, 이후 빠르게 Skill 을 빌드 및 테스트합니다 (예시에서는 962 병).

  <img src="/assets/showcase/wine-cellar-skill.jpg" alt="CSV 로부터 로컬 와인 셀러 Skill 을 빌드하는 OpenClaw" />
</Card>

<Card title="Tesco 쇼핑 자동 파일럿" icon="cart-shopping" href="https://x.com/i/status/2009724862470689131">
  **@marchattonhere** • `automation` `browser` `shopping`

주간 식단 계획 → 단골 상품 → 배송 슬롯 예약 → 주문 확인. API 없이 브라우저 제어만 사용합니다.

  <img src="/assets/showcase/tesco-shop.jpg" alt="채팅을 통한 Tesco 쇼핑 자동화" />
</Card>

<Card title="SNAG 스크린샷 → Markdown" icon="scissors" href="https://github.com/am-will/snag">
  **@am-will** • `devtools` `screenshots` `markdown`

화면 영역을 단축키로 지정 → Gemini 비전 → 즉시 클립보드에 Markdown 생성.

  <img src="/assets/showcase/snag.png" alt="SNAG 스크린샷 → Markdown 도구" />
</Card>

<Card title="Agents UI" icon="window-maximize" href="https://releaseflow.net/kitze/agents-ui">
  **@kitze** • `ui` `skills` `sync`

Agents, Claude, Codex, OpenClaw 전반에서 Skills/명령을 관리하기 위한 데스크톱 앱입니다.

  <img src="/assets/showcase/agents-ui.jpg" alt="Agents UI 앱" />
</Card>

<Card title="Telegram 음성 메모 (papla.media)" icon="microphone" href="https://papla.media/docs">
  **Community** • `voice` `tts` `telegram`

papla.media TTS 를 래핑하여 결과를 Telegram 음성 메모로 전송합니다 (성가신 자동 재생 없음).

  <img src="/assets/showcase/papla-tts.jpg" alt="TTS 로 생성된 Telegram 음성 메모 출력" />
</Card>

<Card title="CodexMonitor" icon="eye" href="https://clawhub.com/odrobnik/codexmonitor">
  **@odrobnik** • `devtools` `codex` `brew`

Homebrew 로 설치하는 헬퍼 도구로, 로컬 OpenAI Codex 세션을 나열/검사/감시합니다 (CLI + VS Code).

  <img src="/assets/showcase/codexmonitor.png" alt="ClawHub 의 CodexMonitor" />
</Card>

<Card title="Bambu 3D 프린터 제어" icon="print" href="https://clawhub.com/tobiasbischoff/bambu-cli">
  **@tobiasbischoff** • `hardware` `3d-printing` `skill`

BambuLab 프린터를 제어하고 문제를 해결합니다: 상태, 작업, 카메라, AMS, 보정 등.

  <img src="/assets/showcase/bambu-cli.png" alt="ClawHub 의 Bambu CLI Skill" />
</Card>

<Card title="비엔나 교통 (Wiener Linien)" icon="train" href="https://clawhub.com/hjanuschka/wienerlinien">
  **@hjanuschka** • `travel` `transport` `skill`

비엔나 대중교통의 실시간 출발 정보, 장애, 엘리베이터 상태, 경로 안내를 제공합니다.

  <img src="/assets/showcase/wienerlinien.png" alt="ClawHub 의 Wiener Linien Skill" />
</Card>

<Card title="ParentPay 학교 급식" icon="utensils" href="#">
  **@George5562** • `automation` `browser` `parenting`

ParentPay 를 통한 영국 학교 급식 예약 자동화. 안정적인 테이블 셀 클릭을 위해 마우스 좌표를 사용합니다.
</Card>

<Card title="R2 업로드 (Send Me My Files)" icon="cloud-arrow-up" href="https://clawhub.com/skills/r2-upload">
  **@julianengel** • `files` `r2` `presigned-urls`

Cloudflare R2/S3 로 업로드하고 안전한 사전 서명 다운로드 링크를 생성합니다. 원격 OpenClaw 인스턴스에 적합합니다.
</Card>

<Card title="Telegram 기반 iOS 앱" icon="mobile" href="#">
  **@coard** • `ios` `xcode` `testflight`

지도와 음성 녹음을 포함한 완전한 iOS 앱을 Telegram 채팅만으로 빌드하여 TestFlight 에 배포했습니다.

  <img src="/assets/showcase/ios-testflight.jpg" alt="TestFlight 의 iOS 앱" />
</Card>

<Card title="Oura Ring 헬스 어시스턴트" icon="heart-pulse" href="#">
  **@AS** • `health` `oura` `calendar`

Oura Ring 데이터를 캘린더, 약속, 운동 일정과 통합한 개인 AI 건강 어시스턴트입니다.

  <img src="/assets/showcase/oura-health.png" alt="Oura Ring 헬스 어시스턴트" />
</Card>
<Card title="Kev's Dream Team (14+ 에이전트)" icon="robot" href="https://github.com/adam91holt/orchestrated-ai-articles">
  **@adam91holt** • `multi-agent` `orchestration` `architecture` `manifesto`

Opus 4.5 오케스트레이터가 Codex 워커로 위임하는 구조로, 하나의 Gateway(게이트웨이) 아래 14개 이상의 에이전트를 운용합니다. Dream Team 구성, 모델 선택, 샌드박스 처리, 웹훅, 하트비트, 위임 흐름을 다루는 포괄적인 [기술 문서](https://github.com/adam91holt/orchestrated-ai-articles)가 포함되어 있습니다. 에이전트 샌드박스 처리를 위한 [Clawdspace](https://github.com/adam91holt/clawdspace). [블로그 게시글](https://adams-ai-journey.ghost.io/2026-the-year-of-the-orchestrator/).
</Card>

<Card title="Linear CLI" icon="terminal" href="https://github.com/Finesssee/linear-cli">
  **@NessZerra** • `devtools` `linear` `cli` `issues`

에이전트 기반 워크플로 (Claude Code, OpenClaw)와 통합되는 Linear 용 CLI 입니다. 터미널에서 이슈, 프로젝트, 워크플로를 관리할 수 있습니다. 첫 외부 PR 이 병합되었습니다!
</Card>

<Card title="Beeper CLI" icon="message" href="https://github.com/blqke/beepcli">
  **@jules** • `messaging` `beeper` `cli` `automation`

Beeper Desktop 을 통해 메시지를 읽고, 보내고, 보관합니다. Beeper local MCP API 를 사용하여 에이전트가 하나의 장소에서 모든 채팅 (iMessage, WhatsApp 등)을 관리할 수 있습니다.
</Card>

</CardGroup>

## 🤖 자동화 및 워크플로

<CardGroup cols={2}>

<Card title="Winix 공기청정기 제어" icon="wind" href="https://x.com/antonplex/status/2010518442471006253">
  **@antonplex** • `automation` `hardware` `air-quality`

Claude Code 가 공기청정기 제어 방식을 발견하고 확인한 뒤, OpenClaw 가 이를 인계받아 실내 공기 질을 관리합니다.

  <img src="/assets/showcase/winix-air-purifier.jpg" alt="OpenClaw 를 통한 Winix 공기청정기 제어" />
</Card>

<Card title="예쁜 하늘 카메라 샷" icon="camera" href="https://x.com/signalgaining/status/2010523120604746151">
  **@signalgaining** • `automation` `camera` `skill` `images`

옥상 카메라를 트리거로, 하늘이 예뻐 보일 때마다 OpenClaw 에게 사진 촬영을 요청합니다 — Skill 을 설계하고 직접 촬영했습니다.

  <img src="/assets/showcase/roof-camera-sky.jpg" alt="OpenClaw 가 촬영한 옥상 카메라 하늘 사진" />
</Card>

<Card title="시각적 아침 브리핑 씬" icon="robot" href="https://x.com/buddyhadry/status/2010005331925954739">
  **@buddyhadry** • `automation` `briefing` `images` `telegram`

예약된 프롬프트가 OpenClaw 페르소나를 통해 매일 아침 하나의 '씬' 이미지 (날씨, 할 일, 날짜, 좋아하는 게시물/문구)를 생성합니다.
</Card>

<Card title="Padel 코트 예약" icon="calendar-check" href="https://github.com/joshp123/padel-cli">
  **@joshp123** • `automation` `booking` `cli`
  
  Playtomic 예약 가능 여부 확인 + 예약 CLI 입니다. 더 이상 빈 코트를 놓치지 마세요.
  
  <img src="/assets/showcase/padel-screenshot.jpg" alt="padel-cli 스크린샷" />
</Card>

<Card title="회계 인테이크" icon="file-invoice-dollar">
  **Community** • `automation` `email` `pdf`
  
  이메일에서 PDF 를 수집하고 세무사를 위한 문서를 준비합니다. 매월 회계를 자동 파일럿으로 처리합니다.
</Card>

<Card title="소파 감자 개발 모드" icon="couch" href="https://davekiss.com">
  **@davekiss** • `telegram` `website` `migration` `astro`

Netflix 를 보면서 Telegram 으로 개인 사이트 전체를 재구축했습니다 — Notion → Astro, 게시글 18개 마이그레이션, DNS 를 Cloudflare 로 이전. 노트북을 한 번도 열지 않았습니다.
</Card>

<Card title="구직 에이전트" icon="briefcase">
  **@attol8** • `automation` `api` `skill`

채용 공고를 검색하고 CV 키워드와 매칭하여 관련 기회를 링크와 함께 반환합니다. JSearch API 를 사용해 30분 만에 구축되었습니다.
</Card>

<Card title="Jira Skill 빌더" icon="diagram-project" href="https://x.com/jdrhyne/status/2008336434827002232">
  **@jdrhyne** • `automation` `jira` `skill` `devtools`

OpenClaw 를 Jira 에 연결한 뒤, 즉석에서 새로운 Skill 을 생성했습니다 (아직 ClawHub 에 존재하기 전).
</Card>

<Card title="Telegram 기반 Todoist Skill" icon="list-check" href="https://x.com/iamsubhrajyoti/status/2009949389884920153">
  **@iamsubhrajyoti** • `automation` `todoist` `skill` `telegram`

Todoist 작업을 자동화하고, Telegram 채팅에서 직접 Skill 을 생성하도록 OpenClaw 를 활용했습니다.
</Card>

<Card title="TradingView 분석" icon="chart-line">
  **@bheem1798** • `finance` `browser` `automation`

브라우저 자동화를 통해 TradingView 에 로그인하고 차트를 스크린샷으로 캡처하여 요청 시 기술적 분석을 수행합니다. API 없이 브라우저 제어만 사용합니다.
</Card>

<Card title="Slack 자동 지원" icon="slack">
  **@henrymascot** • `slack` `automation` `support`

회사 Slack 채널을 감시하고 유용한 답변을 제공하며 Telegram 으로 알림을 전달합니다. 요청 없이도 배포된 앱의 프로덕션 버그를 자율적으로 수정했습니다.
</Card>

</CardGroup>

## 🧠 지식 및 메모리

<CardGroup cols={2}>

<Card title="xuezh 중국어 학습" icon="language" href="https://github.com/joshp123/xuezh">
  **@joshp123** • `learning` `voice` `skill`
  
  OpenClaw 를 통한 발음 피드백과 학습 흐름을 제공하는 중국어 학습 엔진입니다.
  
  <img src="/assets/showcase/xuezh-pronunciation.jpeg" alt="xuezh 발음 피드백" />
</Card>

<Card title="WhatsApp 메모리 금고" icon="vault">
  **Community** • `memory` `transcription` `indexing`
  
  WhatsApp 전체 내보내기를 수집하고, 1천 개 이상의 음성 메모를 전사하며, git 로그와 교차 검증하여 연결된 Markdown 보고서를 출력합니다.
</Card>

<Card title="Karakeep 시맨틱 검색" icon="magnifying-glass" href="https://github.com/jamesbrooksco/karakeep-semantic-search">
  **@jamesbrooksco** • `search` `vector` `bookmarks`
  
  Qdrant + OpenAI/Ollama 임베딩을 사용해 Karakeep 북마크에 벡터 검색을 추가합니다.
</Card>

<Card title="인사이드 아웃 2 메모리" icon="brain">
  **Community** • `memory` `beliefs` `self-model`
  
  세션 파일을 메모리 → 신념 → 진화하는 자기 모델로 변환하는 분리형 메모리 관리자입니다.
</Card>

</CardGroup>

## 🎙️ 음성 및 전화

<CardGroup cols={2}>

<Card title="Clawdia 전화 브리지" icon="phone" href="https://github.com/alejandroOPI/clawdia-bridge">
  **@alejandroOPI** • `voice` `vapi` `bridge`
  
  Vapi 음성 어시스턴트 ↔ OpenClaw HTTP 브리지입니다. 에이전트와 거의 실시간으로 전화 통화를 할 수 있습니다.
</Card>

<Card title="OpenRouter 전사" icon="microphone" href="https://clawhub.com/obviyus/openrouter-transcribe">
  **@obviyus** • `transcription` `multilingual` `skill`

OpenRouter (Gemini 등)를 통한 다국어 오디오 전사입니다. ClawHub 에서 제공됩니다.
</Card>

</CardGroup>

## 🏗️ 인프라 및 배포

<CardGroup cols={2}>

<Card title="Home Assistant 애드온" icon="home" href="https://github.com/ngutman/openclaw-ha-addon">
  **@ngutman** • `homeassistant` `docker` `raspberry-pi`
  
  SSH 터널 지원과 영속 상태를 갖춘 Home Assistant OS 상의 OpenClaw Gateway(게이트웨이)입니다.
</Card>

<Card title="Home Assistant Skill" icon="toggle-on" href="https://clawhub.com/skills/homeassistant">
  **ClawHub** • `homeassistant` `skill` `automation`
  
  자연어를 통해 Home Assistant 디바이스를 제어하고 자동화합니다.
</Card>

<Card title="Nix 패키징" icon="snowflake" href="https://github.com/openclaw/nix-openclaw">
  **@openclaw** • `nix` `packaging` `deployment`
  
  재현 가능한 배포를 위한 배터리 포함 nix 기반 OpenClaw 설정입니다.
</Card>

<Card title="CalDAV 캘린더" icon="calendar" href="https://clawhub.com/skills/caldav-calendar">
  **ClawHub** • `calendar` `caldav` `skill`
  
  khal/vdirsyncer 를 사용하는 캘린더 Skill 입니다. 셀프 호스팅 캘린더 통합을 제공합니다.
</Card>

</CardGroup>

## 🏠 홈 및 하드웨어

<CardGroup cols={2}>

<Card title="GoHome 자동화" icon="house-signal" href="https://github.com/joshp123/gohome">
  **@joshp123** • `home` `nix` `grafana`
  
  OpenClaw 를 인터페이스로 사용하는 Nix 네이티브 홈 자동화와 아름다운 Grafana 대시보드를 제공합니다.
  
  <img src="/assets/showcase/gohome-grafana.png" alt="GoHome Grafana 대시보드" />
</Card>

<Card title="Roborock 로봇 청소기" icon="robot" href="https://github.com/joshp123/gohome/tree/main/plugins/roborock">
  **@joshp123** • `vacuum` `iot` `plugin`
  
  자연스러운 대화를 통해 Roborock 로봇 청소기를 제어합니다.
  
  <img src="/assets/showcase/roborock-screenshot.jpg" alt="Roborock 상태" />
</Card>

</CardGroup>

## 🌟 커뮤니티 프로젝트

<CardGroup cols={2}>

<Card title="StarSwap 마켓플레이스" icon="star" href="https://star-swap.com/">
  **Community** • `marketplace` `astronomy` `webapp`
  
  완전한 천문 장비 마켓플레이스입니다. OpenClaw 생태계와 함께 또는 이를 중심으로 구축되었습니다.
</Card>

</CardGroup>

---

## 프로젝트 제출하기

공유할 것이 있으신가요? 기꺼이 소개해 드리겠습니다!

<Steps>
  <Step title="공유하기">
    [Discord 의 #showcase](https://discord.gg/clawd)에 게시하거나 [@openclaw 에 트윗](https://x.com/openclaw)하세요
  </Step>
  <Step title="세부 정보 포함">
    무엇을 하는지 설명하고, 저장소/데모 링크를 추가하며, 가능하다면 스크린샷을 공유해 주세요
  </Step>
  <Step title="소개되기">
    눈에 띄는 프로젝트를 이 페이지에 추가합니다
  </Step>
</Steps>
