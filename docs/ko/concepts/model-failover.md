---
summary: "OpenClaw 가 인증 프로파일을 순환하고 모델 전반에서 폴백하는 방식"
read_when:
  - 인증 프로파일 순환, 쿨다운 또는 모델 폴백 동작을 진단할 때
  - 인증 프로파일 또는 모델에 대한 페일오버 규칙을 업데이트할 때
title: "모델 페일오버"
x-i18n:
  source_path: concepts/model-failover.md
  source_hash: eab7c0633824d941
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:42Z
---

# 모델 페일오버

OpenClaw 는 실패를 두 단계로 처리합니다:

1. 현재 프로바이더 내에서의 **인증 프로파일 순환**.
2. `agents.defaults.model.fallbacks` 에서 다음 모델로의 **모델 폴백**.

이 문서는 런타임 규칙과 이를 뒷받침하는 데이터에 대해 설명합니다.

## 인증 저장소 (키 + OAuth)

OpenClaw 는 API 키와 OAuth 토큰 모두에 **인증 프로파일**을 사용합니다.

- 시크릿은 `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` 에 저장됩니다 (레거시: `~/.openclaw/agent/auth-profiles.json`).
- 설정 `auth.profiles` / `auth.order` 는 **메타데이터 + 라우팅 전용**입니다 (시크릿 없음).
- 레거시 import 전용 OAuth 파일: `~/.openclaw/credentials/oauth.json` (최초 사용 시 `auth-profiles.json` 로 가져와짐).

자세한 내용은 다음을 참조하세요: [/concepts/oauth](/concepts/oauth)

자격 증명 유형:

- `type: "api_key"` → `{ provider, key }`
- `type: "oauth"` → `{ provider, access, refresh, expires, email? }` (+ 일부 프로바이더의 경우 `projectId`/`enterpriseUrl`)

## 프로파일 ID

OAuth 로그인은 여러 계정이 공존할 수 있도록 서로 다른 프로파일을 생성합니다.

- 기본값: 이메일을 사용할 수 없을 때 `provider:default`.
- 이메일이 있는 OAuth: `provider:<email>` (예: `google-antigravity:user@gmail.com`).

프로파일은 `profiles` 아래의 `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` 에 저장됩니다.

## 순환 순서

프로바이더에 여러 프로파일이 있는 경우, OpenClaw 는 다음과 같은 순서로 선택합니다:

1. **명시적 설정**: `auth.order[provider]` (설정된 경우).
2. **설정된 프로파일**: 프로바이더로 필터링된 `auth.profiles`.
3. **저장된 프로파일**: 해당 프로바이더에 대한 `auth-profiles.json` 항목.

명시적인 순서가 설정되지 않은 경우, OpenClaw 는 라운드 로빈 순서를 사용합니다:

- **기본 키:** 프로파일 유형 (**OAuth 가 API 키보다 우선**).
- **보조 키:** `usageStats.lastUsed` (각 유형 내에서 오래된 것부터).
- **쿨다운/비활성화된 프로파일**은 가장 뒤로 이동하며, 만료 시점이 가장 빠른 순으로 정렬됩니다.

### 세션 고정성 (캐시 친화적)

OpenClaw 는 프로바이더 캐시를 따뜻하게 유지하기 위해 **세션당 선택된 인증 프로파일을 고정**합니다.
모든 요청마다 순환하지 않습니다. 고정된 프로파일은 다음 경우까지 재사용됩니다:

- 세션이 재설정될 때 (`/new` / `/reset`)
- 컴팩션이 완료될 때 (컴팩션 카운트 증가)
- 프로파일이 쿨다운 또는 비활성화 상태일 때

`/model …@<profileId>` 을 통한 수동 선택은 해당 세션에 대한 **사용자 오버라이드**를 설정하며,
새 세션이 시작될 때까지 자동 순환되지 않습니다.

자동 고정된 프로파일(세션 라우터에 의해 선택됨)은 **선호도**로 취급됩니다:
우선적으로 시도되지만, 속도 제한이나 타임아웃이 발생하면 OpenClaw 가 다른 프로파일로 순환할 수 있습니다.
사용자 고정 프로파일은 해당 프로파일에 잠긴 상태를 유지하며, 실패하고 모델 폴백이 설정되어 있다면
프로파일을 전환하는 대신 다음 모델로 이동합니다.

### OAuth 가 '사라진 것처럼 보일 수 있는' 이유

동일한 프로바이더에 대해 OAuth 프로파일과 API 키 프로파일이 모두 있는 경우,
고정되지 않았다면 라운드 로빈으로 인해 메시지 간에 전환될 수 있습니다.
단일 프로파일을 강제하려면 다음 중 하나를 사용하세요:

- `auth.order[provider] = ["provider:profileId"]` 으로 고정, 또는
- 지원되는 UI/채팅 표면에서 프로파일 오버라이드를 사용하여 `/model …` 을 통한 세션별 오버라이드

## 쿨다운

프로파일이 인증/속도 제한 오류(또는 속도 제한처럼 보이는 타임아웃)로 실패하면,
OpenClaw 는 이를 쿨다운 상태로 표시하고 다음 프로파일로 이동합니다.
형식 오류/잘못된 요청 오류(예: Cloud Code Assist 도구 호출 ID 검증 실패)도
페일오버 대상 오류로 처리되며 동일한 쿨다운을 사용합니다.

쿨다운은 지수 백오프를 사용합니다:

- 1분
- 5분
- 25분
- 1시간 (상한)

상태는 `usageStats` 아래의 `auth-profiles.json` 에 저장됩니다:

```json
{
  "usageStats": {
    "provider:profile": {
      "lastUsed": 1736160000000,
      "cooldownUntil": 1736160600000,
      "errorCount": 2
    }
  }
}
```

## 결제 비활성화

결제/크레딧 실패(예: "크레딧 부족" / "크레딧 잔액이 너무 낮음")는 페일오버 대상이지만,
대개 일시적이지 않습니다. 짧은 쿨다운 대신, OpenClaw 는 프로파일을 **비활성화** 상태로 표시하고
(더 긴 백오프와 함께) 다음 프로파일/프로바이더로 순환합니다.

상태는 `auth-profiles.json` 에 저장됩니다:

```json
{
  "usageStats": {
    "provider:profile": {
      "disabledUntil": 1736178000000,
      "disabledReason": "billing"
    }
  }
}
```

기본값:

- 결제 백오프는 **5시간**에서 시작하여 결제 실패마다 두 배로 증가하며, **24시간**에서 상한을 가집니다.
- 프로파일이 **24시간** 동안 실패하지 않으면 백오프 카운터가 재설정됩니다 (설정 가능).

## 모델 폴백

프로바이더의 모든 프로파일이 실패하면, OpenClaw 는
`agents.defaults.model.fallbacks` 에서 다음 모델로 이동합니다. 이는 인증 실패, 속도 제한,
그리고 프로파일 순환을 모두 소진한 타임아웃에 적용됩니다
(기타 오류는 폴백을 진행시키지 않습니다).

실행이 모델 오버라이드(훅 또는 CLI)로 시작된 경우에도,
설정된 모든 폴백을 시도한 후에는 폴백이 `agents.defaults.model.primary` 에서 종료됩니다.

## 관련 설정

다음 항목은 [Gateway 설정](/gateway/configuration) 을 참조하세요:

- `auth.profiles` / `auth.order`
- `auth.cooldowns.billingBackoffHours` / `auth.cooldowns.billingBackoffHoursByProvider`
- `auth.cooldowns.billingMaxHours` / `auth.cooldowns.failureWindowHours`
- `agents.defaults.model.primary` / `agents.defaults.model.fallbacks`
- `agents.defaults.imageModel` 라우팅

보다 광범위한 모델 선택 및 폴백 개요는 [Models](/concepts/models) 를 참조하세요.
