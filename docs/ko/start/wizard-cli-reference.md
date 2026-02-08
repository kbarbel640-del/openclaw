---
summary: "CLI 온보딩 흐름, 인증/모델 설정, 출력 및 내부 동작에 대한 전체 참조"
read_when:
  - openclaw 온보딩의 상세 동작이 필요할 때
  - 온보딩 결과를 디버깅하거나 온보딩 클라이언트를 통합할 때
title: "CLI 온보딩 참조"
sidebarTitle: "CLI 참조"
x-i18n:
  source_path: start/wizard-cli-reference.md
  source_hash: 0ef6f01c3e29187b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:58Z
---

# CLI 온보딩 참조

이 페이지는 `openclaw onboard` 에 대한 전체 참조입니다.
간단한 가이드는 [온보딩 마법사 (CLI)](/start/wizard)를 참고하십시오.

## 마법사가 수행하는 작업

로컬 모드 (기본값)는 다음을 단계적으로 안내합니다:

- 모델 및 인증 설정 (OpenAI Code 구독 OAuth, Anthropic API 키 또는 설정 토큰, MiniMax, GLM, Moonshot 및 AI Gateway 옵션 포함)
- 워크스페이스 위치 및 부트스트랩 파일
- Gateway(게이트웨이) 설정 (포트, 바인드, 인증, Tailscale)
- 채널 및 프로바이더 (Telegram, WhatsApp, Discord, Google Chat, Mattermost 플러그인, Signal)
- 데몬 설치 (LaunchAgent 또는 systemd 사용자 유닛)
- 상태 점검
- Skills 설정

원격 모드는 이 머신을 다른 위치의 Gateway(게이트웨이)에 연결하도록 구성합니다.
원격 호스트에는 아무것도 설치하거나 수정하지 않습니다.

## 로컬 흐름 상세

<Steps>
  <Step title="기존 설정 감지">
    - `~/.openclaw/openclaw.json` 이 존재하면 유지, 수정 또는 재설정을 선택합니다.
    - 마법사를 다시 실행해도 명시적으로 재설정을 선택하지 않는 한 (또는 `--reset` 를 전달하지 않는 한) 아무것도 삭제되지 않습니다.
    - 설정이 유효하지 않거나 레거시 키를 포함하면, 계속하기 전에 `openclaw doctor` 를 실행하라는 요청과 함께 마법사가 중단됩니다.
    - 재설정은 `trash` 를 사용하며 다음 범위를 제공합니다:
      - 설정만
      - 설정 + 자격 증명 + 세션
      - 전체 재설정 (워크스페이스도 제거)
  </Step>
  <Step title="모델 및 인증">
    - 전체 옵션 매트릭스는 [인증 및 모델 옵션](#auth-and-model-options)에 있습니다.
  </Step>
  <Step title="워크스페이스">
    - 기본값은 `~/.openclaw/workspace` (구성 가능)입니다.
    - 최초 실행 부트스트랩 의식을 위해 필요한 워크스페이스 파일을 시드합니다.
    - 워크스페이스 레이아웃: [에이전트 워크스페이스](/concepts/agent-workspace).
  </Step>
  <Step title="Gateway(게이트웨이)">
    - 포트, 바인드, 인증 모드 및 Tailscale 노출을 묻습니다.
    - 권장 사항: local loopback 이더라도 로컬 WS 클라이언트가 인증해야 하므로 토큰 인증을 활성화된 상태로 유지하십시오.
    - 모든 로컬 프로세스를 완전히 신뢰하는 경우에만 인증을 비활성화하십시오.
    - non-loopback 바인드는 여전히 인증이 필요합니다.
  </Step>
  <Step title="채널">
    - [WhatsApp](/channels/whatsapp): 선택적 QR 로그인
    - [Telegram](/channels/telegram): 봇 토큰
    - [Discord](/channels/discord): 봇 토큰
    - [Google Chat](/channels/googlechat): 서비스 계정 JSON + 웹훅 오디언스
    - [Mattermost](/channels/mattermost) 플러그인: 봇 토큰 + 기본 URL
    - [Signal](/channels/signal): 선택적 `signal-cli` 설치 + 계정 구성
    - [BlueBubbles](/channels/bluebubbles): iMessage 에 권장됨; 서버 URL + 비밀번호 + 웹훅
    - [iMessage](/channels/imessage): 레거시 `imsg` CLI 경로 + DB 접근
    - DM 보안: 기본값은 페어링입니다. 첫 번째 다이렉트 메시지는 코드를 전송하며,
      `openclaw pairing approve <channel> <code>` 를 통해 승인하거나 허용 목록을 사용합니다.
  </Step>
  <Step title="데몬 설치">
    - macOS: LaunchAgent
      - 로그인된 사용자 세션이 필요합니다; 헤드리스 환경에서는 사용자 정의 LaunchDaemon 을 사용하십시오 (제공되지 않음).
    - Linux 및 Windows (WSL2): systemd 사용자 유닛
      - 로그아웃 후에도 Gateway(게이트웨이)가 유지되도록 마법사가 `loginctl enable-linger <user>` 를 시도합니다.
      - sudo 를 요청할 수 있습니다 (`/var/lib/systemd/linger` 를 기록); 먼저 sudo 없이 시도합니다.
    - 런타임 선택: Node (권장; WhatsApp 및 Telegram 에 필수). Bun 은 권장되지 않습니다.
  </Step>
  <Step title="상태 점검">
    - 필요 시 Gateway(게이트웨이)를 시작하고 `openclaw health` 를 실행합니다.
    - `openclaw status --deep` 는 상태 출력에 Gateway(게이트웨이) 상태 프로브를 추가합니다.
  </Step>
  <Step title="Skills">
    - 사용 가능한 Skills 를 읽고 요구 사항을 확인합니다.
    - 노드 매니저 선택: npm 또는 pnpm (bun 은 권장되지 않음).
    - 선택적 의존성을 설치합니다 (일부는 macOS 에서 Homebrew 를 사용).
  </Step>
  <Step title="완료">
    - iOS, Android 및 macOS 앱 옵션을 포함한 요약과 다음 단계가 표시됩니다.
  </Step>
</Steps>

<Note>
GUI 가 감지되지 않으면, 마법사는 브라우저를 여는 대신 Control UI 를 위한 SSH 포트 포워딩 지침을 출력합니다.
Control UI 자산이 누락된 경우 마법사는 이를 빌드하려고 시도하며, 대체 경로는 `pnpm ui:build` 입니다 (UI 의존성 자동 설치).
</Note>

## 원격 모드 상세

원격 모드는 이 머신을 다른 위치의 Gateway(게이트웨이)에 연결하도록 구성합니다.

<Info>
원격 모드는 원격 호스트에 아무것도 설치하거나 수정하지 않습니다.
</Info>

설정하는 항목:

- 원격 Gateway(게이트웨이) URL (`ws://...`)
- 원격 Gateway(게이트웨이) 인증이 필요한 경우 토큰 (권장)

<Note>
- Gateway(게이트웨이)가 loopback 전용인 경우 SSH 터널링 또는 tailnet 을 사용하십시오.
- 디바이스 검색 힌트:
  - macOS: Bonjour (`dns-sd`)
  - Linux: Avahi (`avahi-browse`)
</Note>

## 인증 및 모델 옵션

<AccordionGroup>
  <Accordion title="Anthropic API 키 (권장)">
    `ANTHROPIC_API_KEY` 이 존재하면 이를 사용하거나, 키 입력을 요청한 후 데몬 사용을 위해 저장합니다.
  </Accordion>
  <Accordion title="Anthropic OAuth (Claude Code CLI)">
    - macOS: Keychain 항목 'Claude Code-credentials' 를 확인합니다
    - Linux 및 Windows: 존재하는 경우 `~/.claude/.credentials.json` 를 재사용합니다

    macOS 에서는 launchd 시작 시 차단되지 않도록 'Always Allow' 를 선택하십시오.

  </Accordion>
  <Accordion title="Anthropic 토큰 (설정 토큰 붙여넣기)">
    어떤 머신에서든 `claude setup-token` 를 실행한 다음 토큰을 붙여넣으십시오.
    이름을 지정할 수 있으며, 비워 두면 기본값이 사용됩니다.
  </Accordion>
  <Accordion title="OpenAI Code 구독 (Codex CLI 재사용)">
    `~/.codex/auth.json` 이 존재하면 마법사가 이를 재사용할 수 있습니다.
  </Accordion>
  <Accordion title="OpenAI Code 구독 (OAuth)">
    브라우저 흐름; `code#state` 를 붙여넣습니다.

    모델이 설정되지 않았거나 `openai/*` 인 경우 `agents.defaults.model` 를 `openai-codex/gpt-5.3-codex` 로 설정합니다.

  </Accordion>
  <Accordion title="OpenAI API 키">
    `OPENAI_API_KEY` 가 존재하면 이를 사용하거나 키 입력을 요청한 후,
    launchd 가 읽을 수 있도록 `~/.openclaw/.env` 에 저장합니다.

    모델이 설정되지 않았거나 `openai/*` 또는 `openai-codex/*` 인 경우 `agents.defaults.model` 를 `openai/gpt-5.1-codex` 로 설정합니다.

  </Accordion>
  <Accordion title="OpenCode Zen">
    `OPENCODE_API_KEY` (또는 `OPENCODE_ZEN_API_KEY`) 입력을 요청합니다.
    설정 URL: [opencode.ai/auth](https://opencode.ai/auth).
  </Accordion>
  <Accordion title="API 키 (일반)">
    키를 저장합니다.
  </Accordion>
  <Accordion title="Vercel AI Gateway">
    `AI_GATEWAY_API_KEY` 입력을 요청합니다.
    자세한 내용: [Vercel AI Gateway](/providers/vercel-ai-gateway).
  </Accordion>
  <Accordion title="Cloudflare AI Gateway">
    계정 ID, Gateway(게이트웨이) ID 및 `CLOUDFLARE_AI_GATEWAY_API_KEY` 입력을 요청합니다.
    자세한 내용: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway).
  </Accordion>
  <Accordion title="MiniMax M2.1">
    설정이 자동으로 기록됩니다.
    자세한 내용: [MiniMax](/providers/minimax).
  </Accordion>
  <Accordion title="Synthetic (Anthropic 호환)">
    `SYNTHETIC_API_KEY` 입력을 요청합니다.
    자세한 내용: [Synthetic](/providers/synthetic).
  </Accordion>
  <Accordion title="Moonshot 및 Kimi Coding">
    Moonshot (Kimi K2) 및 Kimi Coding 설정이 자동으로 기록됩니다.
    자세한 내용: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot).
  </Accordion>
  <Accordion title="건너뛰기">
    인증을 구성하지 않습니다.
  </Accordion>
</AccordionGroup>

모델 동작:

- 감지된 옵션에서 기본 모델을 선택하거나, 프로바이더와 모델을 수동으로 입력합니다.
- 마법사는 모델 검사를 실행하고, 구성된 모델이 알 수 없거나 인증이 누락된 경우 경고합니다.

자격 증명 및 프로필 경로:

- OAuth 자격 증명: `~/.openclaw/credentials/oauth.json`
- 인증 프로필 (API 키 + OAuth): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

<Note>
헤드리스 및 서버 팁: 브라우저가 있는 머신에서 OAuth 를 완료한 다음,
`~/.openclaw/credentials/oauth.json` (또는 `$OPENCLAW_STATE_DIR/credentials/oauth.json`)
를 Gateway(게이트웨이) 호스트로 복사하십시오.
</Note>

## 출력 및 내부 동작

`~/.openclaw/openclaw.json` 의 일반적인 필드:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers` (Minimax 선택 시)
- `gateway.*` (모드, 바인드, 인증, Tailscale)
- `channels.telegram.botToken`, `channels.discord.token`, `channels.signal.*`, `channels.imessage.*`
- 프롬프트 중 선택한 경우 채널 허용 목록 (Slack, Discord, Matrix, Microsoft Teams) (가능하면 이름이 ID 로 해석됨)
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` 는 `agents.list[]` 및 선택적 `bindings` 를 기록합니다.

WhatsApp 자격 증명은 `~/.openclaw/credentials/whatsapp/<accountId>/` 아래에 저장됩니다.
세션은 `~/.openclaw/agents/<agentId>/sessions/` 아래에 저장됩니다.

<Note>
일부 채널은 플러그인으로 제공됩니다. 온보딩 중 선택되면,
채널 구성을 진행하기 전에 플러그인 설치 (npm 또는 로컬 경로)를 요청합니다.
</Note>

Gateway(게이트웨이) 마법사 RPC:

- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`

클라이언트 (macOS 앱 및 Control UI) 는 온보딩 로직을 재구현하지 않고도 단계를 렌더링할 수 있습니다.

Signal 설정 동작:

- 적절한 릴리스 자산을 다운로드합니다
- `~/.openclaw/tools/signal-cli/<version>/` 아래에 저장합니다
- 설정에 `channels.signal.cliPath` 를 기록합니다
- JVM 빌드는 Java 21 이 필요합니다
- 가능하면 네이티브 빌드를 사용합니다
- Windows 는 WSL2 를 사용하며 WSL 내부에서 Linux signal-cli 흐름을 따릅니다

## 관련 문서

- 온보딩 허브: [온보딩 마법사 (CLI)](/start/wizard)
- 자동화 및 스크립트: [CLI 자동화](/start/wizard-cli-automation)
- 명령 참조: [`openclaw onboard`](/cli/onboard)
