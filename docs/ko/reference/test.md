---
summary: "로컬에서 테스트를 실행하는 방법(vitest)과 force/coverage 모드를 언제 사용해야 하는지"
read_when:
  - 테스트를 실행하거나 수정할 때
title: "테스트"
x-i18n:
  source_path: reference/test.md
  source_hash: be7b751fb81c8c94
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:29Z
---

# 테스트

- 전체 테스트 키트(스위트, 라이브, Docker): [Testing](/testing)

- `pnpm test:force`: 기본 제어 포트를 점유하고 있는 잔존 gateway 프로세스를 모두 종료한 다음, 실행 중인 인스턴스와 서버 테스트가 충돌하지 않도록 격리된 gateway 포트로 전체 Vitest 스위트를 실행합니다. 이전 gateway 실행으로 포트 18789가 점유된 경우 사용합니다.
- `pnpm test:coverage`: V8 커버리지로 Vitest를 실행합니다. 전역 임계값은 라인/브랜치/함수/문 각각 70%입니다. 커버리지는 통합 비중이 높은 엔트리포인트(CLI 연결, gateway/telegram 브리지, webchat 정적 서버)를 제외하여 단위 테스트가 가능한 로직에 목표를 집중합니다.
- `pnpm test:e2e`: gateway 엔드 투 엔드 스모크 테스트(다중 인스턴스 WS/HTTP/node 페어링)를 실행합니다.
- `pnpm test:live`: 프로바이더 라이브 테스트(minimax/zai)를 실행합니다. API 키와 `LIVE=1`(또는 프로바이더별 `*_LIVE_TEST=1`)가 필요하며, 이를 통해 스킵을 해제합니다.

## 모델 지연 시간 벤치(로컬 키)

스크립트: [`scripts/bench-model.ts`](https://github.com/openclaw/openclaw/blob/main/scripts/bench-model.ts)

사용법:

- `source ~/.profile && pnpm tsx scripts/bench-model.ts --runs 10`
- 선택적 환경 변수: `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, `ANTHROPIC_API_KEY`
- 기본 프롬프트: '한 단어로만 답하세요: ok. 구두점이나 추가 텍스트는 사용하지 마세요.'

최근 실행(2025-12-31, 20회):

- minimax 중앙값 1279ms(최소 1114, 최대 2431)
- opus 중앙값 2454ms(최소 1224, 최대 3170)

## 온보딩 E2E(Docker)

Docker는 선택 사항이며, 컨테이너화된 온보딩 스모크 테스트에만 필요합니다.

깨끗한 Linux 컨테이너에서의 전체 콜드 스타트 흐름:

```bash
scripts/e2e/onboard-docker.sh
```

이 스크립트는 가상 TTY를 통해 대화형 마법사를 구동하고, config/workspace/session 파일을 검증한 다음 gateway를 시작하고 `openclaw health`를 실행합니다.

## QR 가져오기 스모크(Docker)

Docker에서 Node 22+ 환경에서 `qrcode-terminal`가 로드되는지 확인합니다:

```bash
pnpm test:docker:qr
```
