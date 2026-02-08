---
summary: "Gateway(게이트웨이)에 연결된 터미널 UI를 위한 CLI 레퍼런스인 `openclaw tui`"
read_when:
  - Gateway(게이트웨이)를 위한 터미널 UI가 필요할 때(원격 친화적)
  - 스크립트에서 url/token/session 을 전달하고 싶을 때
title: "tui"
x-i18n:
  source_path: cli/tui.md
  source_hash: f0a97d92e08746a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:37Z
---

# `openclaw tui`

Gateway(게이트웨이)에 연결된 터미널 UI를 엽니다.

관련 항목:

- TUI 가이드: [TUI](/tui)

## 예제

```bash
openclaw tui
openclaw tui --url ws://127.0.0.1:18789 --token <token>
openclaw tui --session main --deliver
```
