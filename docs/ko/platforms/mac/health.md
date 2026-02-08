---
summary: "macOS 앱이 Gateway/Baileys 상태를 어떻게 보고하는지"
read_when:
  - macOS 앱 상태 표시기를 디버깅할 때
title: "상태 점검"
x-i18n:
  source_path: platforms/mac/health.md
  source_hash: 0560e96501ddf53a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:00Z
---

# macOS 에서의 상태 점검

메뉴 바 앱에서 연결된 채널이 정상인지 확인하는 방법입니다.

## 메뉴 바

- 상태 점은 이제 Baileys 상태를 반영합니다:
  - 녹색: 연결됨 + 최근에 소켓이 열림.
  - 주황색: 연결 중/재시도 중.
  - 빨간색: 로그아웃됨 또는 프로브 실패.
- 보조 라인은 "linked · auth 12m"을 표시하거나 실패 사유를 표시합니다.
- "Run Health Check" 메뉴 항목은 주문형 프로브를 실행합니다.

## 설정

- 일반 탭에 상태 카드가 추가되어 다음을 표시합니다: 연결된 인증 경과 시간, 세션 저장소 경로/개수, 마지막 점검 시간, 마지막 오류/상태 코드, 그리고 Run Health Check / Reveal Logs 버튼.
- UI 가 즉시 로드되도록 캐시된 스냅샷을 사용하며, 오프라인일 때도 우아하게 대체 동작합니다.
- **채널 탭**은 WhatsApp/Telegram 에 대한 채널 상태와 컨트롤(로그인 QR, 로그아웃, 프로브, 마지막 연결 해제/오류)을 표시합니다.

## 프로브 동작 방식

- 앱은 약 60초마다 및 주문형으로 `ShellExecutor`를 통해 `openclaw health --json`를 실행합니다. 이 프로브는 자격 증명을 로드하고 메시지를 보내지 않고 상태를 보고합니다.
- 깜빡임을 방지하기 위해 마지막으로 정상인 스냅샷과 마지막 오류를 각각 캐시하고, 각 타임스탬프를 표시합니다.

## 문제가 있을 때

- [Gateway health](/gateway/health)에서 CLI 흐름(`openclaw status`, `openclaw status --deep`, `openclaw health --json`)을 계속 사용할 수 있으며, `web-heartbeat` / `web-reconnect`에 대해 `/tmp/openclaw/openclaw-*.log`를 tail 하십시오.
