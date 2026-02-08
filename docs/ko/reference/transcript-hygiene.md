---
summary: "참고: 프로바이더별 트랜스크립트 정제 및 복구 규칙"
read_when:
  - 트랜스크립트 형태와 연관된 프로바이더 요청 거부를 디버깅할 때
  - 트랜스크립트 정제 또는 도구 호출 복구 로직을 변경할 때
  - 프로바이더 간 도구 호출 id 불일치를 조사할 때
title: "트랜스크립트 위생"
x-i18n:
  source_path: reference/transcript-hygiene.md
  source_hash: 43ed460827d514a8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:37Z
---

# 트랜스크립트 위생 (프로바이더 보정)

이 문서는 실행 전에(모델 컨텍스트를 구성할 때) 트랜스크립트에 적용되는 **프로바이더별 수정 사항**을 설명합니다. 이는 엄격한 프로바이더 요구 사항을 충족하기 위해 사용되는 **메모리 내** 조정입니다. 이러한 위생 단계는 디스크에 저장된 JSONL 트랜스크립트를 다시 작성하지 **않습니다**. 다만, 별도의 세션 파일 복구 단계에서 세션이 로드되기 전에 잘못된 JSONL 파일을 복구하기 위해 유효하지 않은 라인을 삭제할 수 있습니다. 복구가 발생하면 원본 파일은 세션 파일과 함께 백업됩니다.

범위에는 다음이 포함됩니다.

- 도구 호출 id 정제
- 도구 호출 입력 검증
- 도구 결과 페어링 복구
- 턴 검증 / 정렬
- 사고 시그니처 정리
- 이미지 페이로드 정제

트랜스크립트 저장소 세부 정보가 필요하면 다음을 참조하세요.

- [/reference/session-management-compaction](/reference/session-management-compaction)

---

## 실행 위치

모든 트랜스크립트 위생 처리는 임베디드 러너에 중앙화되어 있습니다.

- 정책 선택: `src/agents/transcript-policy.ts`
- 정제/복구 적용: `src/agents/pi-embedded-runner/google.ts`의 `sanitizeSessionHistory`

이 정책은 적용 대상을 결정하기 위해 `provider`, `modelApi`, `modelId`를 사용합니다.

트랜스크립트 위생과는 별도로, 세션 파일은 로드 전에(필요 시) 복구됩니다.

- `src/agents/session-file-repair.ts`의 `repairSessionFileIfNeeded`
- `run/attempt.ts` 및 `compact.ts`에서 호출됨 (임베디드 러너)

---

## 전역 규칙: 이미지 정제

이미지 페이로드는 크기 제한으로 인한 프로바이더 측 거부를 방지하기 위해 항상 정제됩니다
(과도하게 큰 base64 이미지의 다운스케일/재압축).

구현:

- `src/agents/pi-embedded-helpers/images.ts`의 `sanitizeSessionMessagesImages`
- `src/agents/tool-images.ts`의 `sanitizeContentBlocksImages`

---

## 전역 규칙: 잘못된 도구 호출

`input`와 `arguments`가 모두 누락된 어시스턴트 도구 호출 블록은
모델 컨텍스트가 구성되기 전에 삭제됩니다. 이는 부분적으로만
영속화된 도구 호출(예: 속도 제한 실패 이후)로 인한 프로바이더 거부를 방지합니다.

구현:

- `src/agents/session-transcript-repair.ts`의 `sanitizeToolCallInputs`
- `src/agents/pi-embedded-runner/google.ts`의 `sanitizeSessionHistory`에서 적용

---

## 프로바이더 매트릭스 (현재 동작)

**OpenAI / OpenAI Codex**

- 이미지 정제만 수행.
- OpenAI Responses/Codex로 모델 전환 시, 고아 reasoning 시그니처(뒤따르는 콘텐츠 블록이 없는 독립 reasoning 항목)를 제거.
- 도구 호출 id 정제 없음.
- 도구 결과 페어링 복구 없음.
- 턴 검증 또는 재정렬 없음.
- 합성 도구 결과 없음.
- 사고 시그니처 제거 없음.

**Google (Generative AI / Gemini CLI / Antigravity)**

- 도구 호출 id 정제: 엄격한 영숫자.
- 도구 결과 페어링 복구 및 합성 도구 결과.
- 턴 검증 (Gemini 스타일의 턴 교대).
- Google 턴 정렬 보정(히스토리가 어시스턴트로 시작하는 경우 작은 사용자 부트스트랩을 앞에 추가).
- Antigravity Claude: thinking 시그니처 정규화; 서명되지 않은 thinking 블록 삭제.

**Anthropic / Minimax (Anthropic 호환)**

- 도구 결과 페어링 복구 및 합성 도구 결과.
- 턴 검증 (엄격한 교대를 만족시키기 위해 연속된 사용자 턴 병합).

**Mistral (모델 id 기반 감지 포함)**

- 도구 호출 id 정제: strict9 (길이 9의 영숫자).

**OpenRouter Gemini**

- 사고 시그니처 정리: base64가 아닌 `thought_signature` 값 제거 (base64는 유지).

**그 외 모두**

- 이미지 정제만 수행.

---

## 과거 동작 (2026.1.22 이전)

2026.1.22 릴리스 이전에는 OpenClaw가 여러 계층의 트랜스크립트 위생 처리를 적용했습니다.

- **트랜스크립트 정제 확장**이 모든 컨텍스트 빌드에서 실행되며 다음을 수행할 수 있었습니다.
  - 도구 사용/결과 페어링 복구.
  - 도구 호출 id 정제(`_`/`-`를 보존하는 비엄격 모드 포함).
- 러너 또한 프로바이더별 정제를 수행하여 작업이 중복되었습니다.
- 프로바이더 정책 외부에서도 추가 변형이 발생했으며, 여기에는 다음이 포함됩니다.
  - 영속화 전에 어시스턴트 텍스트에서 `<final>` 태그 제거.
  - 비어 있는 어시스턴트 오류 턴 삭제.
  - 도구 호출 이후의 어시스턴트 콘텐츠 트리밍.

이러한 복잡성은 프로바이더 간 회귀(특히 `openai-responses`
`call_id|fc_id` 페어링)를 초래했습니다. 2026.1.22 정리에서는 확장을 제거하고,
로직을 러너에 중앙화했으며, OpenAI는 이미지 정제를 제외하고 **무접촉(no-touch)** 으로 변경했습니다.
