---
summary: "CLI 온보딩 마법사의 전체 참조: 모든 단계, 플래그 및 설정 필드"
read_when:
  - 특정 마법사 단계나 플래그를 찾아볼 때
  - 비대화형 모드로 온보딩을 자동화할 때
  - 마법사 동작을 디버깅할 때
title: "온보딩 마법사 참조"
sidebarTitle: "마법사 참조"
x-i18n:
  source_path: reference/wizard.md
  source_hash: 1dd46ad12c53668c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:49Z
---

# 온보딩 마법사 참조

이 문서는 `openclaw onboard` CLI 마법사의 전체 참조입니다.
개요 수준의 설명은 [온보딩 마법사](/start/wizard)를 참고하십시오.

## 흐름 상세 (로컬 모드)

<Steps>
  <Step title="기존 설정 감지">
    - `~/.openclaw/openclaw.json` 이(가) 존재하면 **유지 / 수정 / 초기화** 중에서 선택합니다.
    - 마법사를 다시 실행해도 명시적으로 **초기화**를 선택하지 않는 한
      (또는 `--reset` 을(를) 전달하지 않는 한) 아무 것도 삭제되지 않습니다.
    - 설정이 유효하지 않거나 레거시 키를 포함하는 경우, 마법사는 중단되고
      계속하기 전에 `openclaw doctor` 을(를) 실행하라는 안내를 합니다.
    - 초기화는 `trash` 을(를) 사용하며 (`rm` 은(는) 절대 사용하지 않음) 다음 범위를 제공합니다:
      - 설정만
      - 설정 + 자격 증명 + 세션
      - 전체 초기화 (워크스페이스도 제거)
  </Step>
  <Step title="모델/인증">
    - **Anthropic API 키 (권장)**: `ANTHROPIC_API_KEY` 이(가) 있으면 이를 사용하고, 없으면 키 입력을 요청한 뒤 데몬 사용을 위해 저장합니다.
    - **Anthropic OAuth (Claude Code CLI)**: macOS 에서는 Keychain 항목 "Claude Code-credentials" 를 확인합니다 ("항상 허용"을 선택하여 launchd 시작이 차단되지 않도록 하십시오). Linux/Windows 에서는 `~/.claude/.credentials.json` 이(가) 있으면 재사용합니다.
    - **Anthropic 토큰 (setup-token 붙여넣기)**: 어떤 머신에서든 `claude setup-token` 을(를) 실행한 다음 토큰을 붙여넣습니다 (이름을 지정할 수 있으며, 비워두면 기본값).
    - **OpenAI Code (Codex) 구독 (Codex CLI)**: `~/.codex/auth.json` 이(가) 존재하면 마법사에서 이를 재사용할 수 있습니다.
    - **OpenAI Code (Codex) 구독 (OAuth)**: 브라우저 플로우를 사용하며 `code#state` 을(를) 붙여넣습니다.
      - 모델이 설정되지 않았거나 `openai/*` 인 경우 `agents.defaults.model` 을(를) `openai-codex/gpt-5.2` 로 설정합니다.
    - **OpenAI API 키**: `OPENAI_API_KEY` 이(가) 있으면 이를 사용하고, 없으면 키 입력을 요청한 뒤 launchd 가 읽을 수 있도록 `~/.openclaw/.env` 에 저장합니다.
    - **OpenCode Zen (멀티 모델 프록시)**: `OPENCODE_API_KEY` (또는 `OPENCODE_ZEN_API_KEY`, https://opencode.ai/auth 에서 획득) 입력을 요청합니다.
    - **API 키**: 키를 대신 저장합니다.
    - **Vercel AI Gateway (멀티 모델 프록시)**: `AI_GATEWAY_API_KEY` 입력을 요청합니다.
    - 자세한 내용: [Vercel AI Gateway](/providers/vercel-ai-gateway)
    - **Cloudflare AI Gateway**: 계정 ID, Gateway ID 및 `CLOUDFLARE_AI_GATEWAY_API_KEY` 입력을 요청합니다.
    - 자세한 내용: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
    - **MiniMax M2.1**: 설정이 자동으로 작성됩니다.
    - 자세한 내용: [MiniMax](/providers/minimax)
    - **Synthetic (Anthropic 호환)**: `SYNTHETIC_API_KEY` 입력을 요청합니다.
    - 자세한 내용: [Synthetic](/providers/synthetic)
    - **Moonshot (Kimi K2)**: 설정이 자동으로 작성됩니다.
    - **Kimi Coding**: 설정이 자동으로 작성됩니다.
    - 자세한 내용: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
    - **건너뛰기**: 아직 인증을 설정하지 않습니다.
    - 감지된 옵션에서 기본 모델을 선택합니다 (또는 프로바이더/모델을 수동으로 입력).
    - 마법사는 모델 확인을 실행하고 설정된 모델을 알 수 없거나 인증이 누락된 경우 경고합니다.
    - OAuth 자격 증명은 `~/.openclaw/credentials/oauth.json` 에, 인증 프로필은 `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` 에 저장됩니다 (API 키 + OAuth).
    - 자세한 내용: [/concepts/oauth](/concepts/oauth)
    <Note>
    헤드리스/서버 팁: 브라우저가 있는 머신에서 OAuth 를 완료한 다음
    `~/.openclaw/credentials/oauth.json` (또는 `$OPENCLAW_STATE_DIR/credentials/oauth.json`) 을(를)
    Gateway(게이트웨이) 호스트로 복사하십시오.
    </Note>
  </Step>
  <Step title="워크스페이스">
    - 기본값은 `~/.openclaw/workspace` (구성 가능).
    - 에이전트 부트스트랩 의식을 위해 필요한 워크스페이스 파일을 시드합니다.
    - 전체 워크스페이스 레이아웃 + 백업 가이드: [에이전트 워크스페이스](/concepts/agent-workspace)
  </Step>
  <Step title="Gateway">
    - 포트, 바인드, 인증 모드, Tailscale 노출.
    - 인증 권장 사항: local loopback 이더라도 로컬 WS 클라이언트가 인증해야 하므로 **토큰**을 유지하십시오.
    - 모든 로컬 프로세스를 완전히 신뢰하는 경우에만 인증을 비활성화하십시오.
    - non‑loopback 바인드에는 여전히 인증이 필요합니다.
  </Step>
  <Step title="채널">
    - [WhatsApp](/channels/whatsapp): 선택적 QR 로그인.
    - [Telegram](/channels/telegram): 봇 토큰.
    - [Discord](/channels/discord): 봇 토큰.
    - [Google Chat](/channels/googlechat): 서비스 계정 JSON + 웹훅 audience.
    - [Mattermost](/channels/mattermost) (플러그인): 봇 토큰 + 기본 URL.
    - [Signal](/channels/signal): 선택적 `signal-cli` 설치 + 계정 설정.
    - [BlueBubbles](/channels/bluebubbles): **iMessage 에 권장**; 서버 URL + 비밀번호 + 웹훅.
    - [iMessage](/channels/imessage): 레거시 `imsg` CLI 경로 + DB 접근.
    - DM 보안: 기본값은 페어링입니다. 첫 번째 다이렉트 메시지에서 코드가 전송되며, `openclaw pairing approve <channel> <code>` 을(를) 통해 승인하거나 허용 목록을 사용합니다.
  </Step>
  <Step title="데몬 설치">
    - macOS: LaunchAgent
      - 로그인된 사용자 세션이 필요합니다. 헤드리스 환경에서는 사용자 정의 LaunchDaemon 을 사용하십시오 (기본 제공되지 않음).
    - Linux (및 WSL2 를 통한 Windows): systemd 사용자 유닛
      - 로그아웃 후에도 Gateway(게이트웨이)가 유지되도록 `loginctl enable-linger <user>` 을(를) 통해 lingering 활성화를 시도합니다.
      - sudo 를 요청할 수 있습니다 (`/var/lib/systemd/linger` 을(를) 작성). 먼저 sudo 없이 시도합니다.
    - **런타임 선택:** Node (권장; WhatsApp/Telegram 에 필수). Bun 은 **권장되지 않음**.
  </Step>
  <Step title="상태 점검">
    - 필요 시 Gateway(게이트웨이)를 시작하고 `openclaw health` 을(를) 실행합니다.
    - 팁: `openclaw status --deep` 은(는) 상태 출력에 Gateway(게이트웨이) 상태 프로브를 추가합니다 (도달 가능한 Gateway 필요).
  </Step>
  <Step title="Skills (권장)">
    - 사용 가능한 Skills 를 읽고 요구 사항을 확인합니다.
    - 노드 매니저를 선택합니다: **npm / pnpm** (bun 은 권장되지 않음).
    - 선택적 의존성을 설치합니다 (일부는 macOS 에서 Homebrew 사용).
  </Step>
  <Step title="완료">
    - 요약 및 다음 단계, 추가 기능을 위한 iOS/Android/macOS 앱을 포함합니다.
  </Step>
</Steps>

<Note>
GUI 가 감지되지 않으면, 마법사는 브라우저를 여는 대신 Control UI 를 위한 SSH 포트 포워딩 지침을 출력합니다.
Control UI 에셋이 없는 경우, 마법사는 이를 빌드하려고 시도하며, 대체 경로는 `pnpm ui:build` 입니다 (UI 의존성을 자동 설치).
</Note>

## 비대화형 모드

`--non-interactive` 을(를) 사용하여 온보딩을 자동화하거나 스크립트로 실행할 수 있습니다:

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

기계 판독 가능한 요약을 위해 `--json` 을(를) 추가하십시오.

<Note>
`--json` 은(는) **비대화형 모드**를 의미하지 않습니다. 스크립트에서는 `--non-interactive` (및 `--workspace`) 을(를) 사용하십시오.
</Note>

<AccordionGroup>
  <Accordion title="Gemini 예제">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice gemini-api-key \
      --gemini-api-key "$GEMINI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Z.AI 예제">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice zai-api-key \
      --zai-api-key "$ZAI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Vercel AI Gateway 예제">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice ai-gateway-api-key \
      --ai-gateway-api-key "$AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Cloudflare AI Gateway 예제">
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
  <Accordion title="Moonshot 예제">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice moonshot-api-key \
      --moonshot-api-key "$MOONSHOT_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Synthetic 예제">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice synthetic-api-key \
      --synthetic-api-key "$SYNTHETIC_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="OpenCode Zen 예제">
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

### 에이전트 추가 (비대화형)

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.2 \
  --bind whatsapp:biz \
  --non-interactive \
  --json
```

## Gateway 마법사 RPC

Gateway(게이트웨이)는 RPC (`wizard.start`, `wizard.next`, `wizard.cancel`, `wizard.status`) 를 통해 마법사 흐름을 노출합니다.
클라이언트 (macOS 앱, Control UI)는 온보딩 로직을 다시 구현하지 않고도 단계를 렌더링할 수 있습니다.

## Signal 설정 (signal-cli)

마법사는 GitHub 릴리스에서 `signal-cli` 설치를 수행할 수 있습니다:

- 적절한 릴리스 에셋을 다운로드합니다.
- `~/.openclaw/tools/signal-cli/<version>/` 아래에 저장합니다.
- 설정에 `channels.signal.cliPath` 을(를) 작성합니다.

참고 사항:

- JVM 빌드는 **Java 21** 이 필요합니다.
- 가능하면 네이티브 빌드를 사용합니다.
- Windows 는 WSL2 를 사용하며, signal-cli 설치는 WSL 내부에서 Linux 흐름을 따릅니다.

## 마법사가 작성하는 항목

`~/.openclaw/openclaw.json` 의 일반적인 필드:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers` (MiniMax 선택 시)
- `gateway.*` (모드, 바인드, 인증, Tailscale)
- `channels.telegram.botToken`, `channels.discord.token`, `channels.signal.*`, `channels.imessage.*`
- 프롬프트 중에 선택한 경우 채널 허용 목록 (Slack/Discord/Matrix/Microsoft Teams) (가능하면 이름을 ID 로 해석).
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` 은(는) `agents.list[]` 및 선택적 `bindings` 을(를) 작성합니다.

WhatsApp 자격 증명은 `~/.openclaw/credentials/whatsapp/<accountId>/` 아래에 저장됩니다.
세션은 `~/.openclaw/agents/<agentId>/sessions/` 아래에 저장됩니다.

일부 채널은 플러그인으로 제공됩니다. 온보딩 중 하나를 선택하면,
설정하기 전에 이를 설치하라는 프롬프트가 표시됩니다 (npm 또는 로컬 경로).

## 관련 문서

- 마법사 개요: [온보딩 마법사](/start/wizard)
- macOS 앱 온보딩: [온보딩](/start/onboarding)
- 설정 참조: [Gateway 구성](/gateway/configuration)
- 프로바이더: [WhatsApp](/channels/whatsapp), [Telegram](/channels/telegram), [Discord](/channels/discord), [Google Chat](/channels/googlechat), [Signal](/channels/signal), [BlueBubbles](/channels/bluebubbles) (iMessage), [iMessage](/channels/imessage) (레거시)
- Skills: [Skills](/tools/skills), [Skills 설정](/tools/skills-config)
