---
summary: "OpenClaw와 함께 OpenCode Zen(선별된 모델)을 사용합니다"
read_when:
  - 모델 액세스를 위해 OpenCode Zen이 필요합니다
  - 코딩에 친화적인 모델의 선별 목록이 필요합니다
title: "OpenCode Zen"
x-i18n:
  source_path: providers/opencode.md
  source_hash: b3b5c640ac32f317
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:21Z
---

# OpenCode Zen

OpenCode Zen은 코딩 에이전트를 위해 OpenCode 팀이 권장하는 **선별된 모델 목록**입니다.
API 키와 `opencode` 프로바이더를 사용하는 선택적 호스팅 모델 액세스 경로입니다.
Zen은 현재 베타 상태입니다.

## CLI 설정

```bash
openclaw onboard --auth-choice opencode-zen
# or non-interactive
openclaw onboard --opencode-zen-api-key "$OPENCODE_API_KEY"
```

## 설정 스니펫

```json5
{
  env: { OPENCODE_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

## 참고 사항

- `OPENCODE_ZEN_API_KEY` 또한 지원됩니다.
- Zen에 로그인하고 결제 정보를 추가한 다음 API 키를 복사합니다.
- OpenCode Zen은 요청당 과금됩니다. 자세한 내용은 OpenCode 대시보드를 확인하십시오.
