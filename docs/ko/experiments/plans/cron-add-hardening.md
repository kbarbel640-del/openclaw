---
summary: "cron.add 입력 처리를 하드닝하고, 스키마를 정렬하며, cron UI/에이전트 도구를 개선합니다"
owner: "openclaw"
status: "complete"
last_updated: "2026-01-05"
title: "Cron Add 하드닝"
x-i18n:
  source_path: experiments/plans/cron-add-hardening.md
  source_hash: d7e469674bd9435b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:41Z
---

# Cron Add 하드닝 & 스키마 정렬

## 컨텍스트

최근 Gateway(게이트웨이) 로그에서 잘못된 파라미터(누락된 `sessionTarget`, `wakeMode`, `payload` 및 잘못된 형식의 `schedule`)로 인해 `cron.add` 실패가 반복적으로 나타납니다. 이는 최소 한 클라이언트(에이전트 도구 호출 경로일 가능성이 높음)가 래핑되었거나 부분적으로만 지정된 잡 페이로드를 전송하고 있음을 시사합니다. 별도로, TypeScript, Gateway(게이트웨이) 스키마, CLI 플래그, UI 폼 타입 전반에 걸쳐 cron 프로바이더 enum 간 드리프트가 있으며, `cron.status`에 대해서도 UI 불일치가 존재합니다(UI 는 `jobCount`을 기대하지만 Gateway(게이트웨이)는 `jobs`을 반환합니다).

## 목표

- 공통 래퍼 페이로드를 정규화하고 누락된 `kind` 필드를 추론하여 `cron.add` INVALID_REQUEST 스팸을 중단합니다.
- Gateway(게이트웨이) 스키마, cron 타입, CLI 문서, UI 폼 전반에서 cron 프로바이더 목록을 정렬합니다.
- LLM 이 올바른 잡 페이로드를 생성하도록 에이전트 cron 도구 스키마를 명시적으로 만듭니다.
- Control UI cron 상태 잡 카운트 표시를 수정합니다.
- 정규화 및 도구 동작을 커버하는 테스트를 추가합니다.

## 비목표

- cron 스케줄링 의미론 또는 잡 실행 동작을 변경하지 않습니다.
- 새로운 스케줄 종류를 추가하거나 cron 표현식 파싱을 추가하지 않습니다.
- 필요한 필드 수정 범위를 넘어 cron UI/UX 를 전면 개편하지 않습니다.

## 발견 사항(현재 격차)

- Gateway(게이트웨이)의 `CronPayloadSchema` 은 `signal` + `imessage` 를 제외하지만, TS 타입에는 포함됩니다.
- Control UI CronStatus 는 `jobCount` 를 기대하지만, Gateway(게이트웨이)는 `jobs` 를 반환합니다.
- 에이전트 cron 도구 스키마가 임의의 `job` 객체를 허용하여, 잘못된 입력을 가능하게 합니다.
- Gateway(게이트웨이)는 정규화 없이 `cron.add` 을 엄격히 검증하므로, 래핑된 페이로드가 실패합니다.

## 변경 사항

- `cron.add` 및 `cron.update` 은 이제 공통 래퍼 형태를 정규화하고 누락된 `kind` 필드를 추론합니다.
- 에이전트 cron 도구 스키마가 Gateway(게이트웨이) 스키마와 일치하여 잘못된 페이로드가 줄어듭니다.
- 프로바이더 enum 이 Gateway(게이트웨이), CLI, UI, macOS 피커 전반에서 정렬되었습니다.
- Control UI 는 상태를 위해 Gateway(게이트웨이)의 `jobs` 카운트 필드를 사용합니다.

## 현재 동작

- **정규화:** 래핑된 `data`/`job` 페이로드는 언래핑되며, `schedule.kind` 및 `payload.kind` 는 안전한 경우 추론됩니다.
- **기본값:** 누락된 경우 `wakeMode` 및 `sessionTarget` 에 대해 안전한 기본값이 적용됩니다.
- **프로바이더:** Discord/Slack/Signal/iMessage 가 이제 CLI/UI 전반에서 일관되게 노출됩니다.

정규화된 형태와 예시는 [Cron jobs](/automation/cron-jobs)를 참조하십시오.

## 검증

- Gateway(게이트웨이) 로그에서 `cron.add` INVALID_REQUEST 오류가 감소하는지 확인합니다.
- 새로고침 후 Control UI cron 상태에 잡 카운트가 표시되는지 확인합니다.

## 선택적 후속 작업

- 수동 Control UI 스모크: 프로바이더별로 cron 잡을 추가하고 상태 잡 카운트를 확인합니다.

## 미해결 질문

- `cron.add` 이 클라이언트에서 명시적 `state` 를 허용해야 합니까(현재 스키마에서 금지됨)?
- `webchat` 를 명시적 전달 프로바이더로 허용해야 합니까(현재 전달 해석에서 필터링됨)?
