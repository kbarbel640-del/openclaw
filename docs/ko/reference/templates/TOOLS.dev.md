---
summary: "개발 에이전트 도구 메모 (C-3PO)"
read_when:
  - 개발 Gateway(게이트웨이) 템플릿을 사용할 때
  - 기본 개발 에이전트 아이덴티티를 업데이트할 때
x-i18n:
  source_path: reference/templates/TOOLS.dev.md
  source_hash: 3d41097967c98116
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:19Z
---

# TOOLS.md - 사용자 도구 메모 (편집 가능)

이 파일은 외부 도구와 관례에 대한 _사용자_ 개인 메모를 위한 것입니다.
어떤 도구가 존재하는지를 정의하지는 않으며, OpenClaw 는 내부적으로 기본 제공 도구를 제공합니다.

## 예시

### imsg

- iMessage/SMS 보내기: 누구에게/무엇을 보낼지 설명하고, 전송 전에 확인합니다.
- 짧은 메시지를 선호하며, 비밀 정보 전송은 피합니다.

### sag

- 텍스트 음성 변환: 음성, 대상 화자/방, 그리고 스트리밍 여부를 지정합니다.

어시스턴트가 로컬 도구 체인에 대해 알아야 할 다른 사항이 있다면 무엇이든 추가하세요.
