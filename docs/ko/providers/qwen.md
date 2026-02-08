---
summary: "OpenClaw 에서 Qwen OAuth(무료 티어) 사용"
read_when:
  - OpenClaw 에서 Qwen 을 사용하려는 경우
  - Qwen Coder 에 무료 티어 OAuth 접근을 사용하려는 경우
title: "Qwen"
x-i18n:
  source_path: providers/qwen.md
  source_hash: 88b88e224e2fecbb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:22Z
---

# Qwen

Qwen 은 Qwen Coder 및 Qwen Vision 모델을 위한 무료 티어 OAuth 플로우를 제공합니다
(하루 2,000 요청, Qwen 속도 제한 적용).

## 플러그인 활성화

```bash
openclaw plugins enable qwen-portal-auth
```

활성화한 후 Gateway 를 재시작합니다.

## 인증

```bash
openclaw models auth login --provider qwen-portal --set-default
```

이 과정은 Qwen 디바이스 코드 OAuth 플로우를 실행하고,
`models.json` 에 프로바이더 항목을 기록합니다
(빠른 전환을 위한 `qwen` 별칭 포함).

## 모델 ID

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

다음으로 모델을 전환합니다:

```bash
openclaw models set qwen-portal/coder-model
```

## Qwen Code CLI 로그인 재사용

이미 Qwen Code CLI 로 로그인했다면, OpenClaw 는 인증 스토어를 로드할 때
`~/.qwen/oauth_creds.json` 에서 자격 증명을 동기화합니다. 그래도
`models.providers.qwen-portal` 항목은 필요합니다(위의 로그인 명령을 사용해 생성하세요).

## 참고 사항

- 토큰은 자동으로 갱신됩니다. 갱신에 실패하거나 접근이 취소되면 로그인 명령을 다시 실행하세요.
- 기본 base URL: `https://portal.qwen.ai/v1` (Qwen 이 다른 엔드포인트를 제공하는 경우
  `models.providers.qwen-portal.baseUrl` 으로 재정의할 수 있습니다).
- 프로바이더 전반의 규칙은 [Model providers](/concepts/model-providers)를 참고하세요.
