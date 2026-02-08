---
summary: "온보딩 마법사 및 설정 스키마를 위한 RPC 프로토콜 노트"
read_when: "온보딩 마법사 단계 또는 설정 스키마 엔드포인트를 변경할 때"
title: "온보딩 및 설정 프로토콜"
x-i18n:
  source_path: experiments/onboarding-config-protocol.md
  source_hash: 55163b3ee029c024
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:11Z
---

# 온보딩 + 설정 프로토콜

목적: CLI, macOS 앱, Web UI 전반에서 공유되는 온보딩 + 설정 표면입니다.

## 구성 요소

- 마법사 엔진(공유 세션 + 프롬프트 + 온보딩 상태).
- CLI 온보딩은 UI 클라이언트와 동일한 마법사 흐름을 사용합니다.
- Gateway(게이트웨이) RPC 는 마법사 + 설정 스키마 엔드포인트를 노출합니다.
- macOS 온보딩은 마법사 단계 모델을 사용합니다.
- Web UI 는 JSON Schema + UI 힌트로부터 설정 폼을 렌더링합니다.

## Gateway(게이트웨이) RPC

- `wizard.start` 매개변수: `{ mode?: "local"|"remote", workspace?: string }`
- `wizard.next` 매개변수: `{ sessionId, answer?: { stepId, value? } }`
- `wizard.cancel` 매개변수: `{ sessionId }`
- `wizard.status` 매개변수: `{ sessionId }`
- `config.schema` 매개변수: `{}`

응답(형태)

- 마법사: `{ sessionId, done, step?, status?, error? }`
- 설정 스키마: `{ schema, uiHints, version, generatedAt }`

## UI 힌트

- 경로로 키를 지정하는 `uiHints`; 선택적 메타데이터(label/help/group/order/advanced/sensitive/placeholder).
- 민감한 필드는 비밀번호 입력으로 렌더링됩니다. 리댁션 계층은 없습니다.
- 지원되지 않는 스키마 노드는 원시 JSON 편집기로 폴백됩니다.

## 참고

- 이 문서는 온보딩/설정에 대한 프로토콜 리팩터링을 추적하는 단일 위치입니다.
