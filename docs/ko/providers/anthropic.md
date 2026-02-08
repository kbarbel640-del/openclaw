---
summary: "OpenClaw 에서 API 키 또는 setup-token 으로 Anthropic Claude 를 사용합니다"
read_when:
  - OpenClaw 에서 Anthropic 모델을 사용하려는 경우
  - API 키 대신 setup-token 을 사용하려는 경우
title: "Anthropic"
x-i18n:
  source_path: providers/anthropic.md
  source_hash: 5e50b3bca35be37e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:17Z
---

# Anthropic (Claude)

Anthropic 은 **Claude** 모델 패밀리를 개발하며 API 를 통해 액세스를 제공합니다.
OpenClaw 에서는 API 키 또는 **setup-token** 으로 인증할 수 있습니다.

## 옵션 A: Anthropic API 키

**적합한 경우:** 표준 API 액세스 및 사용량 기반 과금.
Anthropic 콘솔에서 API 키를 생성합니다.

### CLI 설정

```bash
openclaw onboard
# choose: Anthropic API key

# or non-interactive
openclaw onboard --anthropic-api-key "$ANTHROPIC_API_KEY"
```

### 설정 스니펫

```json5
{
  env: { ANTHROPIC_API_KEY: "sk-ant-..." },
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## 프롬프트 캐싱 (Anthropic API)

OpenClaw 는 Anthropic 의 프롬프트 캐싱 기능을 지원합니다. 이는 **API 전용**이며, 구독 인증은 캐시 설정을 적용하지 않습니다.

### 설정

모델 설정에서 `cacheRetention` 파라미터를 사용합니다:

| 값      | 캐시 기간 | 설명                         |
| ------- | --------- | ---------------------------- |
| `none`  | 캐싱 없음 | 프롬프트 캐싱 비활성화       |
| `short` | 5분       | API 키 인증의 기본값         |
| `long`  | 1시간     | 확장 캐시 (베타 플래그 필요) |

```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": {
          params: { cacheRetention: "long" },
        },
      },
    },
  },
}
```

### 기본값

Anthropic API 키 인증을 사용할 때 OpenClaw 는 모든 Anthropic 모델에 대해 자동으로 `cacheRetention: "short"` (5분 캐시)를 적용합니다. 설정에서 `cacheRetention` 을 명시적으로 설정하여 이를 재정의할 수 있습니다.

### 레거시 파라미터

이전 `cacheControlTtl` 파라미터는 하위 호환성을 위해 여전히 지원됩니다:

- `"5m"` 는 `short` 에 매핑됩니다
- `"1h"` 는 `long` 에 매핑됩니다

새로운 `cacheRetention` 파라미터로의 마이그레이션을 권장합니다.

OpenClaw 는 Anthropic API 요청에 대해 `extended-cache-ttl-2025-04-11` 베타 플래그를 포함합니다;
프로바이더 헤더를 재정의하는 경우에도 이를 유지하세요 (자세한 내용은 [/gateway/configuration](/gateway/configuration) 참조).

## 옵션 B: Claude setup-token

**적합한 경우:** Claude 구독을 사용하는 경우.

### setup-token 을 얻는 방법

Setup-token 은 Anthropic 콘솔이 아니라 **Claude Code CLI** 에서 생성됩니다. **어떤 머신에서든** 실행할 수 있습니다:

```bash
claude setup-token
```

토큰을 OpenClaw 에 붙여넣거나 (마법사: **Anthropic token (paste setup-token)**), 게이트웨이 호스트에서 실행하세요:

```bash
openclaw models auth setup-token --provider anthropic
```

다른 머신에서 토큰을 생성한 경우, 붙여넣습니다:

```bash
openclaw models auth paste-token --provider anthropic
```

### CLI 설정

```bash
# Paste a setup-token during onboarding
openclaw onboard --auth-choice setup-token
```

### 설정 스니펫

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## 참고

- `claude setup-token` 로 setup-token 을 생성하여 붙여넣거나, 게이트웨이 호스트에서 `openclaw models auth setup-token` 를 실행합니다.
- Claude 구독에서 “OAuth token refresh failed …” 메시지가 표시되면 setup-token 으로 다시 인증하세요. [/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription](/gateway/troubleshooting#oauth-token-refresh-failed-anthropic-claude-subscription) 를 참조하세요.
- 인증 세부 사항 및 재사용 규칙은 [/concepts/oauth](/concepts/oauth) 에 있습니다.

## 문제 해결

**401 오류 / 토큰이 갑자기 무효화됨**

- Claude 구독 인증은 만료되거나 철회될 수 있습니다. `claude setup-token` 를 다시 실행하고
  **게이트웨이 호스트**에 붙여넣으세요.
- Claude CLI 로그인이 다른 머신에 있는 경우,
  게이트웨이 호스트에서 `openclaw models auth paste-token --provider anthropic` 를 사용하세요.

**프로바이더 "anthropic" 에 대한 API 키를 찾을 수 없음**

- 인증은 **에이전트별**입니다. 새 에이전트는 메인 에이전트의 키를 상속하지 않습니다.
- 해당 에이전트에 대해 온보딩을 다시 실행하거나, 게이트웨이 호스트에 setup-token / API 키를 붙여넣은 다음 `openclaw models status` 로 확인하세요.

**프로필 `anthropic:default` 에 대한 자격 증명을 찾을 수 없음**

- 활성 인증 프로필을 확인하려면 `openclaw models status` 를 실행하세요.
- 온보딩을 다시 실행하거나, 해당 프로필에 대한 setup-token / API 키를 붙여넣으세요.

**사용 가능한 인증 프로필 없음 (모두 쿨다운/사용 불가)**

- `openclaw models status --json` 에서 `auth.unusableProfiles` 를 확인하세요.
- 다른 Anthropic 프로필을 추가하거나 쿨다운이 끝날 때까지 기다리세요.

자세한 내용: [/gateway/troubleshooting](/gateway/troubleshooting) 및 [/help/faq](/help/faq).
