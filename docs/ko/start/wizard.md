---
summary: "CLI 온보딩 마법사: 게이트웨이, 워크스페이스, 채널 및 Skills 를 위한 단계별 설정"
read_when:
  - 온보딩 마법사를 실행하거나 구성할 때
  - 새 머신을 설정할 때
title: "온보딩 마법사 (CLI)"
sidebarTitle: "온보딩: CLI"
x-i18n:
  source_path: start/wizard.md
  source_hash: 5495d951a2d78ffb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:39Z
---

# 온보딩 마법사 (CLI)

온보딩 마법사는 macOS, Linux 또는 Windows (WSL2 경유; 강력 권장)에서 OpenClaw 를 설정하는 **권장** 방법입니다.
로컬 Gateway 또는 원격 Gateway 연결을 구성하고, 채널, Skills,
그리고 워크스페이스 기본값을 하나의 단계별 흐름으로 설정합니다.

```bash
openclaw onboard
```

<Info>
가장 빠른 첫 채팅: Control UI 를 엽니다 (채널 설정 불필요).  
`openclaw dashboard` 를 실행하고 브라우저에서 채팅하세요. 문서: [Dashboard](/web/dashboard).
</Info>

나중에 다시 구성하려면:

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` 는 비대화형 모드를 의미하지 않습니다. 스크립트에서는 `--non-interactive` 를 사용하세요.
</Note>

<Tip>
권장 사항: 에이전트가 `web_search` 를 사용할 수 있도록 Brave Search API 키를 설정하세요
(`web_fetch` 는 키 없이도 동작합니다). 가장 쉬운 방법: `openclaw configure --section web`,
이는 `tools.web.search.apiKey` 를 저장합니다. 문서: [Web tools](/tools/web).
</Tip>

## 빠른 시작 vs 고급

마법사는 **QuickStart** (기본값)와 **Advanced** (전체 제어) 중에서 시작합니다.

<Tabs>
  <Tab title="QuickStart (기본값)">
    - 로컬 게이트웨이 (loopback)
    - 워크스페이스 기본값 (또는 기존 워크스페이스)
    - Gateway 포트 **18789**
    - Gateway 인증 **Token** (loopback 에서도 자동 생성)
    - Tailscale 노출 **Off**
    - Telegram + WhatsApp 다이렉트 메시지는 기본적으로 **allowlist** 사용 (전화번호 입력을 요청받습니다)
  </Tab>
  <Tab title="Advanced (전체 제어)">
    - 모든 단계 노출 (모드, 워크스페이스, Gateway, 채널, 데몬, Skills).
  </Tab>
</Tabs>

## 마법사가 구성하는 항목

**로컬 모드 (기본값)** 에서는 다음 단계를 안내합니다:

1. **모델/인증** — Anthropic API 키 (권장), OAuth, OpenAI 또는 기타 프로바이더. 기본 모델을 선택합니다.
2. **워크스페이스** — 에이전트 파일 위치 (기본값 `~/.openclaw/workspace`). 부트스트랩 파일을 생성합니다.
3. **Gateway** — 포트, 바인드 주소, 인증 모드, Tailscale 노출.
4. **채널** — WhatsApp, Telegram, Discord, Google Chat, Mattermost, Signal, BlueBubbles 또는 iMessage.
5. **데몬** — LaunchAgent (macOS) 또는 systemd 사용자 유닛 (Linux/WSL2) 설치.
6. **상태 점검** — Gateway 를 시작하고 정상 실행 여부를 확인합니다.
7. **Skills** — 권장 Skills 와 선택적 의존성을 설치합니다.

<Note>
마법사를 다시 실행해도 **Reset** 을 명시적으로 선택하거나 `--reset` 를 전달하지 않는 한
아무 것도 삭제되지 않습니다.
구성이 유효하지 않거나 레거시 키를 포함하는 경우, 먼저 `openclaw doctor` 를 실행하라는 안내가 표시됩니다.
</Note>

**원격 모드** 는 로컬 클라이언트를 다른 위치의 Gateway 에 연결하도록 구성하기만 합니다.
원격 호스트에는 아무 것도 설치하거나 변경하지 않습니다.

## 다른 에이전트 추가

`openclaw agents add <name>` 를 사용하면 자체 워크스페이스,
세션 및 인증 프로파일을 가진 별도의 에이전트를 생성할 수 있습니다.
`--workspace` 없이 실행하면 마법사가 시작됩니다.

설정되는 항목:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

참고 사항:

- 기본 워크스페이스는 `~/.openclaw/workspace-<agentId>` 를 따릅니다.
- 수신 메시지를 라우팅하려면 `bindings` 를 추가하세요 (마법사에서 설정 가능).
- 비대화형 플래그: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## 전체 참조

단계별 상세 설명, 비대화형 스크립팅, Signal 설정,
RPC API, 그리고 마법사가 작성하는 전체 설정 필드 목록은
[Wizard Reference](/reference/wizard)를 참조하세요.

## 관련 문서

- CLI 명령 참조: [`openclaw onboard`](/cli/onboard)
- macOS 앱 온보딩: [온보딩](/start/onboarding)
- 에이전트 첫 실행 절차: [Agent Bootstrapping](/start/bootstrapping)
