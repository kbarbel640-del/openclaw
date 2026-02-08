---
summary: "채널 전반에 걸쳐 공유되는 반응 의미 체계"
read_when:
  - 모든 채널에서 반응 작업을 수행할 때
title: "반응"
x-i18n:
  source_path: tools/reactions.md
  source_hash: 0f11bff9adb4bd02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:46Z
---

# 반응 도구

채널 전반에 걸쳐 공유되는 반응 의미 체계:

- 반응을 추가할 때는 `emoji` 이(가) 필요합니다.
- `emoji=""` 은(는) 지원되는 경우 봇의 반응을 제거합니다.
- `remove: true` 은(는) 지원되는 경우 지정된 이모지를 제거합니다(`emoji` 필요).

채널별 참고 사항:

- **Discord/Slack**: 비어 있는 `emoji` 은(는) 메시지에서 봇의 모든 반응을 제거하며, `remove: true` 은(는) 해당 이모지만 제거합니다.
- **Google Chat**: 비어 있는 `emoji` 은(는) 메시지에서 앱의 반응을 제거하며, `remove: true` 은(는) 해당 이모지만 제거합니다.
- **Telegram**: 비어 있는 `emoji` 은(는) 봇의 반응을 제거합니다. `remove: true` 도 반응을 제거하지만, 도구 유효성 검사를 위해 여전히 비어 있지 않은 `emoji` 이(가) 필요합니다.
- **WhatsApp**: 비어 있는 `emoji` 은(는) 봇 반응을 제거합니다. `remove: true` 은(는) 비어 있는 이모지로 매핑됩니다(여전히 `emoji` 필요).
- **Signal**: `channels.signal.reactionNotifications` 이(가) 활성화되면 수신 반응 알림이 시스템 이벤트를 발생시킵니다.
