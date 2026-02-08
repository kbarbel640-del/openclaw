---
summary: "에이전트 작업 공간과 ID 파일을 시드하는 부트스트래핑 절차"
read_when:
  - 첫 에이전트 실행 시 어떤 일이 발생하는지 이해할 때
  - 부트스트래핑 파일의 위치를 설명할 때
  - 온보딩 ID 설정을 디버깅할 때
title: "에이전트 부트스트래핑"
sidebarTitle: "Bootstrapping"
x-i18n:
  source_path: start/bootstrapping.md
  source_hash: 4a08b5102f25c6c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:30Z
---

# 에이전트 부트스트래핑

부트스트래핑은 에이전트 작업 공간을 준비하고 ID 세부 정보를 수집하는 **첫 실행** 절차입니다. 이는 온보딩 이후, 에이전트가 처음 시작될 때 수행됩니다.

## 부트스트래핑의 동작

첫 번째 에이전트 실행 시, OpenClaw 는 작업 공간(기본값
`~/.openclaw/workspace`)을 부트스트랩합니다:

- `AGENTS.md`, `BOOTSTRAP.md`, `IDENTITY.md`, `USER.md`를 시드합니다.
- 짧은 Q&A 절차를 실행합니다(한 번에 하나의 질문).
- ID + 환경 설정을 `IDENTITY.md`, `USER.md`, `SOUL.md`에 기록합니다.
- 완료되면 `BOOTSTRAP.md`를 제거하여 한 번만 실행되도록 합니다.

## 실행 위치

부트스트래핑은 항상 **게이트웨이 호스트**에서 실행됩니다. macOS 앱이 원격 Gateway(게이트웨이)에 연결되는 경우, 작업 공간과 부트스트래핑 파일은 해당 원격 머신에 위치합니다.

<Note>
Gateway(게이트웨이)가 다른 머신에서 실행되는 경우, 작업 공간 파일은 게이트웨이 호스트에서 편집하십시오(예: `user@gateway-host:~/.openclaw/workspace`).
</Note>

## 관련 문서

- macOS 앱 온보딩: [Onboarding](/start/onboarding)
- 작업 공간 레이아웃: [Agent workspace](/concepts/agent-workspace)
