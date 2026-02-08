---
summary: "헬스 체크 + 가이드형 복구를 위한 `openclaw doctor` CLI 참조"
read_when:
  - 연결성/인증 문제가 있어 가이드형 수정이 필요한 경우
  - 업데이트 후 정상 동작 여부를 점검하고 싶은 경우
title: "doctor"
x-i18n:
  source_path: cli/doctor.md
  source_hash: 92310aa3f3d111e9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:29Z
---

# `openclaw doctor`

Gateway(게이트웨이)와 채널을 위한 헬스 체크 + 빠른 수정 기능입니다.

관련 항목:

- 문제 해결: [Troubleshooting](/gateway/troubleshooting)
- 보안 감사: [Security](/gateway/security)

## 예제

```bash
openclaw doctor
openclaw doctor --repair
openclaw doctor --deep
```

참고:

- 대화형 프롬프트(예: 키체인/OAuth 수정)는 stdin 이 TTY 이고 `--non-interactive` 가 설정되지 않은 경우에만 실행됩니다. 헤드리스 실행(cron, Telegram, 터미널 없음)에서는 프롬프트를 건너뜁니다.
- `--fix` (`--repair` 의 별칭)는 `~/.openclaw/openclaw.json.bak` 에 백업을 작성하고, 알 수 없는 설정 키를 제거하며 각 제거 항목을 나열합니다.

## macOS: `launchctl` 환경 변수 오버라이드

이전에 `launchctl setenv OPENCLAW_GATEWAY_TOKEN ...` (또는 `...PASSWORD`) 를 실행했다면, 해당 값이 설정 파일을 오버라이드하여 지속적인 “unauthorized” 오류를 유발할 수 있습니다.

```bash
launchctl getenv OPENCLAW_GATEWAY_TOKEN
launchctl getenv OPENCLAW_GATEWAY_PASSWORD

launchctl unsetenv OPENCLAW_GATEWAY_TOKEN
launchctl unsetenv OPENCLAW_GATEWAY_PASSWORD
```
