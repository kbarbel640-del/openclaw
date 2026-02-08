---
summary: "`openclaw health` 를 위한 CLI 참조 (RPC 를 통한 Gateway(게이트웨이) 상태 엔드포인트)"
read_when:
  - 실행 중인 Gateway(게이트웨이)의 상태를 빠르게 확인하려는 경우
title: "상태"
x-i18n:
  source_path: cli/health.md
  source_hash: 82a78a5a97123f7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:27Z
---

# `openclaw health`

실행 중인 Gateway(게이트웨이)에서 상태를 가져옵니다.

```bash
openclaw health
openclaw health --json
openclaw health --verbose
```

참고 사항:

- `--verbose` 는 라이브 프로브를 실행하며, 여러 계정이 구성된 경우 계정별 타이밍을 출력합니다.
- 여러 에이전트가 구성된 경우 에이전트별 세션 스토어가 출력에 포함됩니다.
