---
summary: "계획: OpenResponses /v1/responses 엔드포인트를 추가하고 Chat Completions 를 깔끔하게 사용 중단"
owner: "openclaw"
status: "draft"
last_updated: "2026-01-19"
title: "OpenResponses Gateway 계획"
x-i18n:
  source_path: experiments/plans/openresponses-gateway.md
  source_hash: 71a22c48397507d1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:53Z
---

# OpenResponses Gateway 통합 계획

## 컨텍스트

OpenClaw Gateway 는 현재
`/v1/chat/completions` 에서 최소한의 OpenAI 호환 Chat Completions 엔드포인트를 노출합니다
([OpenAI Chat Completions](/gateway/openai-http-api) 참조).

Open Responses 는 OpenAI Responses API 를 기반으로 한 오픈 추론 표준입니다. 이는 에이전트형 워크플로를 위해 설계되었으며, 아이템 기반 입력과 의미론적 스트리밍 이벤트를 사용합니다. OpenResponses 사양은 `/v1/responses` 를 정의하며, `/v1/chat/completions` 는 정의하지 않습니다.

## 목표

- OpenResponses 의미론을 준수하는 `/v1/responses` 엔드포인트를 추가합니다.
- Chat Completions 를 쉽게 비활성화할 수 있고 궁극적으로 제거 가능한 호환성 레이어로 유지합니다.
- 격리되고 재사용 가능한 스키마로 검증과 파싱을 표준화합니다.

## 비목표

- 첫 번째 단계에서의 전체 OpenResponses 기능 동등성(이미지, 파일, 호스티드 도구).
- 내부 에이전트 실행 로직 또는 도구 오케스트레이션의 교체.
- 첫 단계 동안 기존 `/v1/chat/completions` 동작의 변경.

## 연구 요약

출처: OpenResponses OpenAPI, OpenResponses 사양 사이트, Hugging Face 블로그 게시물.

핵심 요약:

- `POST /v1/responses` 는 `model`, `input`(문자열 또는
  `ItemParam[]`), `instructions`, `tools`, `tool_choice`, `stream`, `max_output_tokens`, 그리고
  `max_tool_calls` 와 같은 `CreateResponseBody` 필드를 허용합니다.
- `ItemParam` 는 다음의 판별 가능한 유니온입니다:
  - 역할이 `system`, `developer`, `user`, `assistant` 인 `message` 아이템
  - `function_call` 및 `function_call_output`
  - `reasoning`
  - `item_reference`
- 성공적인 응답은 `object: "response"`, `status`, 그리고
  `output` 아이템을 포함하는 `ResponseResource` 을 반환합니다.
- 스트리밍은 다음과 같은 의미론적 이벤트를 사용합니다:
  - `response.created`, `response.in_progress`, `response.completed`, `response.failed`
  - `response.output_item.added`, `response.output_item.done`
  - `response.content_part.added`, `response.content_part.done`
  - `response.output_text.delta`, `response.output_text.done`
- 사양 요구사항:
  - `Content-Type: text/event-stream`
  - `event:` 는 JSON `type` 필드와 일치해야 합니다.
  - 종료 이벤트는 리터럴 `[DONE]` 이어야 합니다.
- 추론 아이템은 `content`, `encrypted_content`, 그리고 `summary` 을 노출할 수 있습니다.
- HF 예제에는 요청에 `OpenResponses-Version: latest` (선택적 헤더)가 포함됩니다.

## 제안 아키텍처

- Zod 스키마만 포함하는 `src/gateway/open-responses.schema.ts` 를 추가합니다(Gateway 가져오기 없음).
- `/v1/responses` 를 위한 `src/gateway/openresponses-http.ts` (또는 `open-responses-http.ts`) 를 추가합니다.
- 레거시 호환성 어댑터로서 `src/gateway/openai-http.ts` 를 그대로 유지합니다.
- 설정 `gateway.http.endpoints.responses.enabled` 를 추가합니다(기본값 `false`).
- `gateway.http.endpoints.chatCompletions.enabled` 를 독립적으로 유지하고, 두 엔드포인트를
  각각 토글할 수 있도록 허용합니다.
- Chat Completions 가 활성화되어 있을 때 레거시 상태를 알리기 위해 시작 시 경고를 출력합니다.

## Chat Completions 사용 중단 경로

- 엄격한 모듈 경계를 유지합니다: responses 와 chat completions 간에 스키마 타입을 공유하지 않습니다.
- Chat Completions 를 설정으로 옵트인하도록 하여 코드 변경 없이 비활성화할 수 있게 합니다.
- `/v1/responses` 가 안정화되면 문서에서 Chat Completions 를 레거시로 표기합니다.
- 선택적 향후 단계: 더 단순한 제거 경로를 위해 Chat Completions 요청을 Responses 핸들러로 매핑합니다.

## 1단계 지원 범위

- `input` 를 문자열 또는 메시지 역할과 `function_call_output` 를 포함하는 `ItemParam[]` 로 허용합니다.
- 시스템 및 개발자 메시지를 `extraSystemPrompt` 으로 추출합니다.
- 에이전트 실행의 현재 메시지로 가장 최근의 `user` 또는 `function_call_output` 를 사용합니다.
- 지원되지 않는 콘텐츠 파트(이미지/파일)는 `invalid_request_error` 로 거부합니다.
- `output_text` 콘텐츠를 가진 단일 어시스턴트 메시지를 반환합니다.
- 토큰 계측이 연결될 때까지 값이 0 인 `usage` 를 반환합니다.

## 검증 전략(SDK 없음)

- 지원되는 하위 집합에 대해 Zod 스키마를 구현합니다:
  - `CreateResponseBody`
  - `ItemParam` + 메시지 콘텐츠 파트 유니온
  - `ResponseResource`
  - Gateway 에서 사용하는 스트리밍 이벤트 형태
- 드리프트를 방지하고 향후 코드 생성을 허용하기 위해 스키마를 단일 격리 모듈에 유지합니다.

## 스트리밍 구현(1단계)

- `event:` 와 `data:` 를 모두 포함하는 SSE 라인.
- 필수 시퀀스(최소 실행 가능):
  - `response.created`
  - `response.output_item.added`
  - `response.content_part.added`
  - `response.output_text.delta` (필요 시 반복)
  - `response.output_text.done`
  - `response.content_part.done`
  - `response.completed`
  - `[DONE]`

## 테스트 및 검증 계획

- `/v1/responses` 에 대한 e2e 커버리지를 추가합니다:
  - 인증 필요
  - 비스트림 응답 형태
  - 스트림 이벤트 순서 및 `[DONE]`
  - 헤더와 `user` 를 사용한 세션 라우팅
- `src/gateway/openai-http.e2e.test.ts` 는 변경하지 않습니다.
- 수동: `stream: true` 로 `/v1/responses` 에 curl 을 보내 이벤트 순서와 종료
  `[DONE]` 를 확인합니다.

## 문서 업데이트(후속)

- `/v1/responses` 사용법과 예제를 위한 새 문서 페이지를 추가합니다.
- 레거시 노트와 `/v1/responses` 에 대한 포인터를 포함하도록 `/gateway/openai-http-api` 를 업데이트합니다.
