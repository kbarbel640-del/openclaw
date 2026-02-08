---
summary: "`openclaw pairing`에 대한 CLI 참조(페어링 요청 승인/목록)"
read_when:
  - 페어링 모드 다이렉트 메시지를 사용하며 발신자를 승인해야 할 때
title: "페어링"
x-i18n:
  source_path: cli/pairing.md
  source_hash: e0bc9707294463c9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:32Z
---

# `openclaw pairing`

다이렉트 메시지 페어링 요청을 승인하거나 검사합니다(페어링을 지원하는 채널의 경우).

관련:

- 페어링 흐름: [페어링](/start/pairing)

## 명령어

```bash
openclaw pairing list whatsapp
openclaw pairing approve whatsapp <code> --notify
```
