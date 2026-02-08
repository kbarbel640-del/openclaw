---
summary: "WebSocket 리스너 바인드를 사용한 Gateway(게이트웨이) 싱글턴 가드"
read_when:
  - Gateway(게이트웨이) 프로세스를 실행하거나 디버깅할 때
  - 단일 인스턴스 강제를 조사할 때
title: "Gateway(게이트웨이) 락"
x-i18n:
  source_path: gateway/gateway-lock.md
  source_hash: 15fdfa066d1925da
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:46Z
---

# Gateway(게이트웨이) 락

마지막 업데이트: 2025-12-11

## 이유

- 동일한 호스트에서 동일한 기본 포트당 Gateway(게이트웨이) 인스턴스는 하나만 실행되도록 보장합니다. 추가 Gateway(게이트웨이)는 격리된 프로필과 고유한 포트를 사용해야 합니다.
- 충돌/SIGKILL 이후에도 오래된 락 파일을 남기지 않고 생존합니다.
- 컨트롤 포트가 이미 점유된 경우 명확한 오류로 빠르게 실패합니다.

## 메커니즘

- Gateway(게이트웨이)는 시작 시 즉시 전용 TCP 리스너를 사용하여 WebSocket 리스너(기본값 `ws://127.0.0.1:18789`)를 바인드합니다.
- 바인드가 `EADDRINUSE`로 실패하면, 시작 시 `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")`가 발생합니다.
- OS 는 충돌 및 SIGKILL 을 포함한 모든 프로세스 종료 시 리스너를 자동으로 해제하므로, 별도의 락 파일이나 정리 단계가 필요하지 않습니다.
- 종료 시 Gateway(게이트웨이)는 WebSocket 서버와 그 기반이 되는 HTTP 서버를 닫아 포트를 즉시 해제합니다.

## 오류 표면

- 다른 프로세스가 포트를 점유하고 있으면, 시작 시 `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")`가 발생합니다.
- 그 밖의 바인드 실패는 `GatewayLockError("failed to bind gateway socket on ws://127.0.0.1:<port>: …")`로 노출됩니다.

## 운영 참고 사항

- 포트가 _다른_ 프로세스에 의해 점유된 경우에도 오류는 동일합니다. 포트를 해제하거나 `openclaw gateway --port <port>`로 다른 포트를 선택합니다.
- macOS 앱은 Gateway(게이트웨이)를 생성하기 전에 자체 경량 PID 가드를 여전히 유지하지만, 런타임 락은 WebSocket 바인드로 강제됩니다.
