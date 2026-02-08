---
title: "Pi 개발 워크플로"
x-i18n:
  source_path: pi-dev.md
  source_hash: 65bd0580dd03df05
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:51Z
---

# Pi 개발 워크플로

이 가이드는 OpenClaw 에서 pi 통합 작업을 위한 합리적인 워크플로를 요약합니다.

## 타입 검사 및 린팅

- 타입 검사 및 빌드: `pnpm build`
- 린트: `pnpm lint`
- 포맷 검사: `pnpm format`
- 푸시 전 전체 게이트: `pnpm lint && pnpm build && pnpm test`

## Pi 테스트 실행

pi 통합 테스트 세트를 위한 전용 스크립트를 사용합니다:

```bash
scripts/pi/run-tests.sh
```

실제 프로바이더 동작을 검증하는 라이브 테스트를 포함하려면:

```bash
scripts/pi/run-tests.sh --live
```

이 스크립트는 다음 글롭을 통해 모든 pi 관련 유닛 테스트를 실행합니다:

- `src/agents/pi-*.test.ts`
- `src/agents/pi-embedded-*.test.ts`
- `src/agents/pi-tools*.test.ts`
- `src/agents/pi-settings.test.ts`
- `src/agents/pi-tool-definition-adapter.test.ts`
- `src/agents/pi-extensions/*.test.ts`

## 수동 테스트

권장 흐름:

- dev 모드에서 Gateway(게이트웨이) 실행:
  - `pnpm gateway:dev`
- 에이전트를 직접 트리거:
  - `pnpm openclaw agent --message "Hello" --thinking low`
- 대화형 디버깅을 위해 TUI 사용:
  - `pnpm tui`

도구 호출 동작을 확인하려면 `read` 또는 `exec` 액션을 프롬프트로 요청하여 도구 스트리밍과 페이로드 처리를 확인합니다.

## 클린 슬레이트 리셋

상태는 OpenClaw 상태 디렉토리 아래에 저장됩니다. 기본값은 `~/.openclaw` 입니다. `OPENCLAW_STATE_DIR` 가 설정된 경우 해당 디렉토리를 대신 사용합니다.

모든 것을 리셋하려면:

- 설정을 위한 `openclaw.json`
- 인증 프로필과 토큰을 위한 `credentials/`
- 에이전트 세션 기록을 위한 `agents/<agentId>/sessions/`
- 세션 인덱스를 위한 `agents/<agentId>/sessions.json`
- 레거시 경로가 존재하는 경우 `sessions/`
- 빈 워크스페이스를 원할 경우 `workspace/`

세션만 리셋하려면 해당 에이전트에 대해 `agents/<agentId>/sessions/` 와 `agents/<agentId>/sessions.json` 를 삭제합니다. 재인증을 원하지 않는 경우 `credentials/` 는 유지합니다.

## 참고 자료

- https://docs.openclaw.ai/testing
- https://docs.openclaw.ai/start/getting-started
