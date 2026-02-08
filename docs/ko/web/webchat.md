---
summary: "루프백 WebChat 정적 호스트 및 채팅 UI 를 위한 Gateway(게이트웨이) WS 사용"
read_when:
  - WebChat 접근을 디버깅하거나 구성할 때
title: "WebChat"
x-i18n:
  source_path: web/webchat.md
  source_hash: b5ee2b462c8c979a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:53Z
---

# WebChat (Gateway(게이트웨이) WebSocket UI)

상태: macOS/iOS SwiftUI 채팅 UI 는 Gateway(게이트웨이) WebSocket 과 직접 통신합니다.

## 무엇인가요

- 게이트웨이를 위한 네이티브 채팅 UI 입니다(임베디드 브라우저 및 로컬 정적 서버 없음).
- 다른 채널과 동일한 세션 및 라우팅 규칙을 사용합니다.
- 결정적 라우팅: 응답은 항상 WebChat 으로 돌아옵니다.

## 빠른 시작

1. 게이트웨이를 시작합니다.
2. WebChat UI(macOS/iOS 앱) 또는 Control UI 채팅 탭을 엽니다.
3. 게이트웨이 인증이 구성되어 있는지 확인합니다(루프백에서도 기본적으로 필요).

## 작동 방식(동작)

- UI 는 Gateway(게이트웨이) WebSocket 에 연결하고 `chat.history`, `chat.send`, `chat.inject` 를 사용합니다.
- `chat.inject` 는 어시스턴트 노트를 트랜스크립트에 직접 추가하고 UI 로 브로드캐스트합니다(에이전트 실행 없음).
- 기록은 항상 게이트웨이에서 가져옵니다(로컬 파일 감시 없음).
- 게이트웨이에 연결할 수 없으면 WebChat 은 읽기 전용입니다.

## 원격 사용

- 원격 모드는 SSH/Tailscale 을 통해 Gateway(게이트웨이) WebSocket 을 터널링합니다.
- 별도의 WebChat 서버를 실행할 필요가 없습니다.

## 구성 참조(WebChat)

전체 구성: [Configuration](/gateway/configuration)

채널 옵션:

- 전용 `webchat.*` 블록이 없습니다. WebChat 은 아래의 게이트웨이 엔드포인트 + 인증 설정을 사용합니다.

관련 전역 옵션:

- `gateway.port`, `gateway.bind`: WebSocket 호스트/포트.
- `gateway.auth.mode`, `gateway.auth.token`, `gateway.auth.password`: WebSocket 인증.
- `gateway.remote.url`, `gateway.remote.token`, `gateway.remote.password`: 원격 게이트웨이 대상.
- `session.*`: 세션 스토리지 및 기본 메인 키.
