---
summary: "Gateway(게이트웨이)를 통해 `openclaw agent`로 하나의 에이전트 턴을 전송하기 위한 CLI 참조"
read_when:
  - 스크립트에서 하나의 에이전트 턴을 실행하려는 경우(선택적으로 응답 전달)
title: "에이전트"
x-i18n:
  source_path: cli/agent.md
  source_hash: dcf12fb94e207c68
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:21Z
---

# `openclaw agent`

Gateway(게이트웨이)를 통해 에이전트 턴을 실행합니다(임베디드의 경우 `--local` 사용).
구성된 에이전트를 직접 대상으로 지정하려면 `--agent <id>`을 사용합니다.

관련 항목:

- 에이전트 전송 도구: [에이전트 전송](/tools/agent-send)

## 예제

```bash
openclaw agent --to +15555550123 --message "status update" --deliver
openclaw agent --agent ops --message "Summarize logs"
openclaw agent --session-id 1234 --message "Summarize inbox" --thinking medium
openclaw agent --agent ops --message "Generate report" --deliver --reply-channel slack --reply-to "#reports"
```
