---
summary: "채널별 문제 해결 바로가기 (Discord/Telegram/WhatsApp)"
read_when:
  - 채널은 연결되지만 메시지가 흐르지 않을 때
  - 채널 오구성(인텐트, 권한, 프라이버시 모드)을 조사할 때
title: "채널 문제 해결"
x-i18n:
  source_path: channels/troubleshooting.md
  source_hash: 6542ee86b3e50929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:14Z
---

# 채널 문제 해결

다음부터 시작합니다:

```bash
openclaw doctor
openclaw channels status --probe
```

`channels status --probe` 은 일반적인 채널 오구성을 감지할 수 있을 때 경고를 출력하며, 작은 라이브 검사(자격 증명, 일부 권한/멤버십)를 포함합니다.

## 채널

- Discord: [/channels/discord#troubleshooting](/channels/discord#troubleshooting)
- Telegram: [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)
- WhatsApp: [/channels/whatsapp#troubleshooting-quick](/channels/whatsapp#troubleshooting-quick)

## Telegram 빠른 해결 방법

- 로그에 `HttpError: Network request for 'sendMessage' failed` 또는 `sendChatAction` 이 표시되면 → IPv6 DNS 를 확인합니다. `api.telegram.org` 가 IPv6 로 먼저 해석되고 호스트에 IPv6 이그레스가 없다면, IPv4 를 강제하거나 IPv6 를 활성화합니다. 자세한 내용은 [/channels/telegram#troubleshooting](/channels/telegram#troubleshooting) 를 참고하십시오.
- 로그에 `setMyCommands failed` 이 표시되면 → 아웃바운드 HTTPS 및 DNS 가 `api.telegram.org` 로 도달 가능한지 확인합니다(잠긴 VPS 또는 프록시에서 흔합니다).
