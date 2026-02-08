---
summary: "Telegram 허용 목록 강화: 접두사 + 공백 정규화"
read_when:
  - 과거 Telegram 허용 목록 변경 사항을 검토할 때
title: "Telegram 허용 목록 강화"
x-i18n:
  source_path: experiments/plans/group-policy-hardening.md
  source_hash: a2eca5fcc8537694
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:06Z
---

# Telegram 허용 목록 강화

**날짜**: 2026-01-05  
**상태**: 완료  
**PR**: #216

## 요약

Telegram 허용 목록은 이제 `telegram:` 및 `tg:` 접두사를 대소문자 구분 없이 허용하며, 실수로 포함된 공백을 허용합니다. 이는 인바운드 허용 목록 검사와 아웃바운드 전송 정규화를 일치시킵니다.

## 변경 사항

- 접두사 `telegram:` 및 `tg:` 는 동일하게 처리됩니다(대소문자 구분 없음).
- 허용 목록 항목은 앞뒤 공백이 제거되며, 빈 항목은 무시됩니다.

## 예시

다음은 모두 동일한 ID 로 허용됩니다:

- `telegram:123456`
- `TG:123456`
- `tg:123456`

## 중요한 이유

로그나 채팅 ID 에서 복사/붙여넣기를 하면 접두사와 공백이 포함되는 경우가 많습니다. 정규화를 통해 다이렉트 메시지나 그룹에서 응답할지 여부를 결정할 때 거짓 음성을 방지합니다.

## 관련 문서

- [그룹 채팅](/concepts/groups)
- [Telegram 프로바이더](/channels/telegram)
