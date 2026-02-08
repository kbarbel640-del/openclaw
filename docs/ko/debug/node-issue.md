---
summary: Node + tsx "__name is not a function" 크래시 노트 및 우회 방법
read_when:
  - Node 전용 개발 스크립트 또는 watch 모드 실패를 디버깅할 때
  - OpenClaw 에서 tsx/esbuild 로더 크래시를 조사할 때
title: "Node + tsx 크래시"
x-i18n:
  source_path: debug/node-issue.md
  source_hash: f9e9bd2281508337
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:20Z
---

# Node + tsx "\_\_name is not a function" 크래시

## 요약

Node 로 OpenClaw 를 `tsx` 와 함께 실행하면 시작 시 다음 오류로 실패합니다:

```
[openclaw] Failed to start CLI: TypeError: __name is not a function
    at createSubsystemLogger (.../src/logging/subsystem.ts:203:25)
    at .../src/agents/auth-profiles/constants.ts:25:20
```

이는 개발 스크립트를 Bun 에서 `tsx` 로 전환한 이후(커밋 `2871657e`, 2026-01-06) 시작되었습니다. 동일한 런타임 경로는 Bun 에서는 동작했습니다.

## 환경

- Node: v25.x (v25.3.0 에서 관찰됨)
- tsx: 4.21.0
- OS: macOS (Node 25 를 실행하는 다른 플랫폼에서도 재현될 가능성이 높음)

## 재현 (Node 전용)

```bash
# in repo root
node --version
pnpm install
node --import tsx src/entry.ts status
```

## 저장소 내 최소 재현

```bash
node --import tsx scripts/repro/tsx-name-repro.ts
```

## Node 버전 확인

- Node 25.3.0: 실패
- Node 22.22.0 (Homebrew `node@22`): 실패
- Node 24: 아직 여기에는 설치되지 않음; 검증 필요

## 노트 / 가설

- `tsx` 는 esbuild 를 사용해 TS/ESM 을 변환합니다. esbuild 의 `keepNames` 는 `__name` 헬퍼를 생성하고, 함수 정의를 `__name(...)` 로 래핑합니다.
- 크래시는 런타임에서 `__name` 가 존재하지만 함수가 아니라는 것을 나타내며, 이는 Node 25 로더 경로에서 해당 모듈에 대해 헬퍼가 누락되었거나 덮어써졌음을 시사합니다.
- 유사한 `__name` 헬퍼 문제는 헬퍼가 누락되거나 다시 작성될 때 다른 esbuild 소비자에서도 보고된 바 있습니다.

## 회귀 이력

- `2871657e` (2026-01-06): Bun 을 선택 사항으로 만들기 위해 스크립트를 Bun 에서 tsx 로 변경했습니다.
- 그 이전(Bun 경로)에는 `openclaw status` 와 `gateway:watch` 이 동작했습니다.

## 우회 방법

- 개발 스크립트에 Bun 을 사용합니다(현재 임시 되돌리기).
- Node + tsc watch 를 사용한 다음, 컴파일된 출력물을 실행합니다:
  ```bash
  pnpm exec tsc --watch --preserveWatchOutput
  node --watch openclaw.mjs status
  ```
- 로컬에서 확인됨: `pnpm exec tsc -p tsconfig.json` + `node openclaw.mjs status` 는 Node 25 에서 동작합니다.
- 가능하다면 TS 로더에서 esbuild keepNames 를 비활성화합니다(`__name` 헬퍼 삽입을 방지함). tsx 는 현재 이를 노출하지 않습니다.
- `tsx` 로 Node LTS(22/24) 를 테스트하여 이 문제가 Node 25 특정인지 확인합니다.

## 참고 자료

- https://opennext.js.org/cloudflare/howtos/keep_names
- https://esbuild.github.io/api/#keep-names
- https://github.com/evanw/esbuild/issues/1031

## 다음 단계

- Node 22/24 에서 재현하여 Node 25 회귀인지 확인합니다.
- 알려진 회귀가 있다면 `tsx` 나이틀리를 테스트하거나 이전 버전으로 고정합니다.
- Node LTS 에서도 재현된다면, `__name` 스택 트레이스와 함께 업스트림에 최소 재현을 제출합니다.
