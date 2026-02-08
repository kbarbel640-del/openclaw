---
summary: "높은 신호 품질의 PR 을 제출하는 방법"
title: "PR 제출하기"
x-i18n:
  source_path: help/submitting-a-pr.md
  source_hash: 277b0f51b948d1a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:50Z
---

좋은 PR 은 리뷰하기 쉽습니다. 리뷰어는 의도를 빠르게 파악하고, 동작을 검증하며, 변경 사항을 안전하게 병합할 수 있어야 합니다. 이 가이드는 사람과 LLM 리뷰를 모두 고려한 간결하고 높은 신호 품질의 제출 방법을 다룹니다.

## 좋은 PR 의 기준

- [ ] 문제점, 왜 중요한지, 어떤 변경을 했는지 설명합니다.
- [ ] 변경 범위를 집중합니다. 광범위한 리팩터링은 피합니다.
- [ ] 사용자에게 보이는 변경 사항 / 설정 / 기본값 변경을 요약합니다.
- [ ] 테스트 커버리지, 스킵 항목, 그 이유를 나열합니다.
- [ ] 증거를 추가합니다: 로그, 스크린샷, 또는 녹화(UI/UX).
- [ ] 코드 워드: 이 가이드를 읽었다면 PR 설명에 “lobster-biscuit” 를 넣습니다.
- [ ] PR 생성 전에 관련 `pnpm` 명령을 실행하고 실패를 수정합니다.
- [ ] 코드베이스와 GitHub 에서 관련 기능/이슈/수정을 검색합니다.
- [ ] 주장에는 증거 또는 관찰 결과를 근거로 합니다.
- [ ] 좋은 제목: 동사 + 범위 + 결과 (예: `Docs: add PR and issue templates`).

간결함을 우선합니다. 문법보다 간결한 리뷰가 더 중요합니다. 적용되지 않는 섹션은 생략합니다.

### 기준 검증 명령(변경 사항에 대해 실행하고 실패를 수정)

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- 프로토콜 변경: `pnpm protocol:check`

## 점진적 정보 공개

- 상단: 요약 / 의도
- 다음: 변경 사항 / 위험
- 다음: 테스트 / 검증
- 마지막: 구현 / 증거

## 일반적인 PR 유형별 세부 사항

- [ ] Fix: 재현 방법, 근본 원인, 검증을 추가합니다.
- [ ] Feature: 사용 사례, 동작, 데모/스크린샷(UI)을 추가합니다.
- [ ] Refactor: “동작 변경 없음”을 명시하고, 이동/단순화된 항목을 나열합니다.
- [ ] Chore: 이유를 명시합니다(예: 빌드 시간, CI, 의존성).
- [ ] Docs: 변경 전/후 맥락, 업데이트된 페이지 링크, `pnpm format` 실행.
- [ ] Test: 어떤 공백을 커버하는지, 회귀를 어떻게 방지하는지 설명합니다.
- [ ] Perf: 변경 전/후 지표와 측정 방법을 추가합니다.
- [ ] UX/UI: 스크린샷/영상, 접근성 영향 사항을 명시합니다.
- [ ] Infra/Build: 환경 / 검증 내용을 포함합니다.
- [ ] Security: 위험 요약, 재현, 검증을 포함하고 민감한 데이터는 제외합니다. 근거 있는 주장만 작성합니다.

## 체크리스트

- [ ] 명확한 문제 / 의도
- [ ] 집중된 범위
- [ ] 동작 변경 사항 나열
- [ ] 테스트 목록 및 결과
- [ ] 수동 테스트 단계(해당 시)
- [ ] 비밀 정보 / 개인 데이터 없음
- [ ] 증거 기반

## 일반 PR 템플릿

```md
#### Summary

#### Behavior Changes

#### Codebase and GitHub Search

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort (self-reported):
- Agent notes (optional, cite evidence):
```

## PR 유형 템플릿(자신의 유형으로 교체)

### Fix

```md
#### Summary

#### Repro Steps

#### Root Cause

#### Behavior Changes

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Feature

```md
#### Summary

#### Use Cases

#### Behavior Changes

#### Existing Functionality Check

- [ ] I searched the codebase for existing functionality.
      Searches performed (1-3 bullets):
  -
  -

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Refactor

```md
#### Summary

#### Scope

#### No Behavior Change Statement

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Chore/Maintenance

```md
#### Summary

#### Why This Matters

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Docs

```md
#### Summary

#### Pages Updated

#### Before/After

#### Formatting

pnpm format

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Test

```md
#### Summary

#### Gap Covered

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Perf

```md
#### Summary

#### Baseline

#### After

#### Measurement Method

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### UX/UI

```md
#### Summary

#### Screenshots or Video

#### Accessibility Impact

#### Tests

#### Manual Testing

### Prerequisites

-

### Steps

1.
2. **Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Infra/Build

```md
#### Summary

#### Environments Affected

#### Validation Steps

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Security

```md
#### Summary

#### Risk Summary

#### Repro Steps

#### Mitigation or Fix

#### Verification

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```
