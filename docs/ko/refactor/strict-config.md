---
summary: "엄격한 config 검증 + doctor 전용 마이그레이션"
read_when:
  - config 검증 동작을 설계하거나 구현할 때
  - config 마이그레이션 또는 doctor 워크플로를 작업할 때
  - 플러그인 config 스키마 또는 플러그인 로드 게이팅을 처리할 때
title: "엄격한 Config 검증"
x-i18n:
  source_path: refactor/strict-config.md
  source_hash: 5bc7174a67d2234e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:29Z
---

# 엄격한 config 검증 (doctor 전용 마이그레이션)

## 목표

- **알 수 없는 config 키를 모든 위치에서 거부** (루트 + 중첩).
- **스키마가 없는 플러그인 config 를 거부**; 해당 플러그인은 로드하지 않습니다.
- **로드 시 레거시 자동 마이그레이션 제거**; 마이그레이션은 doctor 를 통해서만 실행합니다.
- **시작 시 doctor (드라이런) 자동 실행**; 유효하지 않으면 비진단 명령을 차단합니다.

## 비목표

- 로드 시 하위 호환성 (레거시 키는 자동 마이그레이션되지 않음).
- 인식되지 않은 키의 무음 제거.

## 엄격한 검증 규칙

- Config 는 모든 수준에서 스키마와 정확히 일치해야 합니다.
- 알 수 없는 키는 검증 오류입니다 (루트 또는 중첩에서 패스스루 없음).
- `plugins.entries.<id>.config` 는 플러그인의 스키마로 검증되어야 합니다.
  - 플러그인에 스키마가 없으면 **플러그인 로드를 거부**하고 명확한 오류를 표시합니다.
- 알 수 없는 `channels.<id>` 키는 플러그인 매니페스트가 채널 id 를 선언하지 않는 한 오류입니다.
- 모든 플러그인에는 플러그인 매니페스트 (`openclaw.plugin.json`) 가 필요합니다.

## 플러그인 스키마 강제

- 각 플러그인은 자신의 config 에 대한 엄격한 JSON Schema 를 제공합니다 (매니페스트에 인라인).
- 플러그인 로드 흐름:
  1. 플러그인 매니페스트 + 스키마 해석 (`openclaw.plugin.json`).
  2. 스키마에 대해 config 검증.
  3. 스키마 누락 또는 config 가 유효하지 않으면: 플러그인 로드를 차단하고 오류를 기록.
- 오류 메시지에 포함:
  - 플러그인 id
  - 사유 (스키마 누락 / 유효하지 않은 config)
  - 검증에 실패한 경로
- 비활성화된 플러그인은 config 를 유지하지만, Doctor + 로그에서 경고를 표시합니다.

## Doctor 흐름

- Doctor 는 config 가 로드될 때 **매번** 실행됩니다 (기본값은 드라이런).
- Config 가 유효하지 않으면:
  - 요약 + 실행 가능한 오류를 출력.
  - 지침: `openclaw doctor --fix`.
- `openclaw doctor --fix`:
  - 마이그레이션을 적용합니다.
  - 알 수 없는 키를 제거합니다.
  - 업데이트된 config 를 기록합니다.

## 명령 게이팅 (config 가 유효하지 않을 때)

허용됨 (진단 전용):

- `openclaw doctor`
- `openclaw logs`
- `openclaw health`
- `openclaw help`
- `openclaw status`
- `openclaw gateway status`

그 외 모든 것은 다음 메시지와 함께 즉시 실패해야 합니다: "Config 가 유효하지 않습니다. `openclaw doctor --fix` 를 실행하세요."

## 오류 UX 형식

- 단일 요약 헤더.
- 그룹화된 섹션:
  - 알 수 없는 키 (전체 경로)
  - 레거시 키 / 필요한 마이그레이션
  - 플러그인 로드 실패 (플러그인 id + 사유 + 경로)

## 구현 터치포인트

- `src/config/zod-schema.ts`: 루트 패스스루 제거; 모든 객체를 엄격하게 처리.
- `src/config/zod-schema.providers.ts`: 엄격한 채널 스키마 보장.
- `src/config/validation.ts`: 알 수 없는 키에서 실패; 레거시 마이그레이션을 적용하지 않음.
- `src/config/io.ts`: 레거시 자동 마이그레이션 제거; 항상 doctor 드라이런 실행.
- `src/config/legacy*.ts`: 사용을 doctor 전용으로 이동.
- `src/plugins/*`: 스키마 레지스트리 + 게이팅 추가.
- `src/cli` 에서 CLI 명령 게이팅.

## 테스트

- 알 수 없는 키 거부 (루트 + 중첩).
- 플러그인 스키마 누락 → 명확한 오류와 함께 플러그인 로드 차단.
- 유효하지 않은 config → 진단 명령을 제외하고 gateway 시작 차단.
- Doctor 드라이런 자동 실행; `doctor --fix` 이 수정된 config 를 기록.
