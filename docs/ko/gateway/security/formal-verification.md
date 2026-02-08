---
title: 형식 검증(보안 모델)
summary: OpenClaw 의 최고 위험 경로를 위한 머신 검증 보안 모델.
permalink: /security/formal-verification/
x-i18n:
  source_path: gateway/security/formal-verification.md
  source_hash: 8dff6ea41a37fb6b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:25Z
---

# 형식 검증(보안 모델)

이 페이지는 OpenClaw 의 **형식적 보안 모델**(현재는 TLA+/TLC, 필요 시 추가)을 추적합니다.

> 참고: 일부 오래된 링크는 이전 프로젝트 이름을 참조할 수 있습니다.

**목표(궁극적 지향점):** 명시적인 가정하에서, OpenClaw 가 의도한 보안 정책(권한 부여, 세션 격리, 도구 게이팅, 오구성 안전성)을 시행한다는 점에 대해 머신 검증된 논증을 제공합니다.

**이것이 무엇인지(현재):** 실행 가능한, 공격자 주도형 **보안 회귀 테스트 스위트**입니다.

- 각 주장에는 유한한 상태 공간에 대해 실행 가능한 모델 검사(model-check)가 있습니다.
- 많은 주장에는 현실적인 버그 클래스에 대한 반례 트레이스를 생성하는 짝이 되는 **부정 모델(negative model)** 이 있습니다.

**이것이 아닌 것(아직):** "OpenClaw 는 모든 측면에서 안전하다"는 증명이나, 전체 TypeScript 구현이 올바르다는 증명은 아닙니다.

## 모델이 위치한 곳

모델은 별도의 저장소에서 유지 관리됩니다: [vignesh07/openclaw-formal-models](https://github.com/vignesh07/openclaw-formal-models).

## 중요한 주의 사항

- 이것들은 전체 TypeScript 구현이 아니라 **모델**입니다. 모델과 코드 사이에 드리프트가 발생할 수 있습니다.
- 결과는 TLC 가 탐색한 상태 공간에 의해 제한됩니다. "green"은 모델링된 가정과 경계를 넘어서는 보안을 의미하지 않습니다.
- 일부 주장은 명시적인 환경 가정(예: 올바른 배포, 올바른 구성 입력)에 의존합니다.

## 결과 재현

현재는 모델 저장소를 로컬로 클론하고 TLC 를 실행하여(아래 참조) 결과를 재현합니다. 향후 반복에서는 다음을 제공할 수 있습니다:

- 공개 아티팩트(반례 트레이스, 실행 로그)와 함께 CI 로 실행되는 모델
- 작고 제한된 검사에 대한 호스티드 "이 모델 실행" 워크플로

시작하기:

```bash
git clone https://github.com/vignesh07/openclaw-formal-models
cd openclaw-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.

make <target>
```

### Gateway(게이트웨이) 노출 및 open gateway 오구성

**주장:** 인증 없이 loopback 을 넘어 바인딩하면 원격 침해가 가능해지거나 / 노출이 증가할 수 있습니다. 토큰/비밀번호는(모델 가정에 따라) 인증되지 않은 공격자를 차단합니다.

- Green 실행:
  - `make gateway-exposure-v2`
  - `make gateway-exposure-v2-protected`
- Red(예상):
  - `make gateway-exposure-v2-negative`

또한 참조: 모델 저장소의 `docs/gateway-exposure-matrix.md`.

### Nodes.run 파이프라인(최고 위험 기능)

**주장:** `nodes.run` 는 (a) 노드 명령 허용 목록과 선언된 명령, 그리고 (b) 구성된 경우 라이브 승인(live approval)을 요구합니다. 승인은(모델에서) 재생(replay)을 방지하기 위해 토큰화됩니다.

- Green 실행:
  - `make nodes-pipeline`
  - `make approvals-token`
- Red(예상):
  - `make nodes-pipeline-negative`
  - `make approvals-token-negative`

### 페어링 저장소(DM 게이팅)

**주장:** 페어링 요청은 TTL 과 pending-request 상한을 준수합니다.

- Green 실행:
  - `make pairing`
  - `make pairing-cap`
- Red(예상):
  - `make pairing-negative`
  - `make pairing-cap-negative`

### 인그레스 게이팅(멘션 + control-command 우회)

**주장:** 멘션이 필요한 그룹 컨텍스트에서, 권한 없는 "control command"는 멘션 게이팅을 우회할 수 없습니다.

- Green:
  - `make ingress-gating`
- Red(예상):
  - `make ingress-gating-negative`

### 라우팅/세션 키 격리

**주장:** 서로 다른 피어로부터의 다이렉트 메시지(DM)는 명시적으로 연결/구성되지 않는 한 동일한 세션으로 합쳐지지 않습니다.

- Green:
  - `make routing-isolation`
- Red(예상):
  - `make routing-isolation-negative`

## v1++: 추가 제한 모델(동시성, 재시도, 트레이스 정확성)

이는 실제 환경의 실패 모드(비원자적 업데이트, 재시도, 메시지 팬아웃) 주변의 충실도를 강화하는 후속 모델입니다.

### 페어링 저장소 동시성 / 멱등성

**주장:** 페어링 저장소는 인터리빙이 있는 경우에도(즉, "check-then-write"는 원자적이어야 함 / 잠금되어야 함; refresh 는 중복을 생성하지 않아야 함) `MaxPending` 와 멱등성을 강제해야 합니다.

의미:

- 동시 요청 하에서, 한 채널에 대해 `MaxPending` 를 초과할 수 없습니다.
- 동일한 `(channel, sender)` 에 대한 반복 요청/refresh 는 중복된 라이브 pending 행을 생성하지 않아야 합니다.

- Green 실행:
  - `make pairing-race` (원자적/잠금된 상한 검사)
  - `make pairing-idempotency`
  - `make pairing-refresh`
  - `make pairing-refresh-race`
- Red(예상):
  - `make pairing-race-negative` (비원자적 begin/commit 상한 레이스)
  - `make pairing-idempotency-negative`
  - `make pairing-refresh-negative`
  - `make pairing-refresh-race-negative`

### 인그레스 트레이스 상관관계 / 멱등성

**주장:** 인제스천은 팬아웃 전반에 걸쳐 트레이스 상관관계를 보존해야 하며 프로바이더 재시도 하에서 멱등적이어야 합니다.

의미:

- 하나의 외부 이벤트가 여러 내부 메시지가 될 때, 모든 부분이 동일한 트레이스/이벤트 아이덴티티를 유지합니다.
- 재시도는 이중 처리로 이어지지 않습니다.
- 프로바이더 이벤트 ID 가 누락된 경우, 디듀프는 안전한 키(예: 트레이스 ID)로 폴백하여 서로 다른 이벤트가 드롭되는 것을 방지합니다.

- Green:
  - `make ingress-trace`
  - `make ingress-trace2`
  - `make ingress-idempotency`
  - `make ingress-dedupe-fallback`
- Red(예상):
  - `make ingress-trace-negative`
  - `make ingress-trace2-negative`
  - `make ingress-idempotency-negative`
  - `make ingress-dedupe-fallback-negative`

### 라우팅 dmScope 우선순위 + identityLinks

**주장:** 라우팅은 기본적으로 DM 세션을 격리된 상태로 유지해야 하며, 명시적으로 구성된 경우에만 세션을 합쳐야 합니다(채널 우선순위 + 아이덴티티 링크).

의미:

- 채널별 dmScope 오버라이드는 전역 기본값보다 우선해야 합니다.
- identityLinks 는 서로 관련 없는 피어 사이가 아니라, 명시적으로 링크된 그룹 내부에서만 세션을 합쳐야 합니다.

- Green:
  - `make routing-precedence`
  - `make routing-identitylinks`
- Red(예상):
  - `make routing-precedence-negative`
  - `make routing-identitylinks-negative`
