---
summary: "`openclaw security` (감사 및 일반적인 보안 실수에 대한 수정)용 CLI 참조"
read_when:
  - 설정/상태에 대해 빠른 보안 감사를 실행하려는 경우
  - 안전한 '수정' 제안(chmod, 기본값 강화)을 적용하려는 경우
title: "security"
x-i18n:
  source_path: cli/security.md
  source_hash: 96542b4784e53933
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:35Z
---

# `openclaw security`

보안 도구(감사 + 선택적 수정).

관련:

- 보안 가이드: [Security](/gateway/security)

## 감사

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --fix
```

감사는 여러 DM 발신자가 메인 세션을 공유하는 경우 경고를 표시하고, 공유 수신함에 대해 **보안 DM 모드**: `session.dmScope="per-channel-peer"` (또는 다중 계정 채널의 경우 `per-account-channel-peer`)를 권장합니다.
또한 작은 모델(`<=300B`)이 샌드박스 처리 없이 사용되면서 웹/브라우저 도구가 활성화된 경우에도 경고합니다.
