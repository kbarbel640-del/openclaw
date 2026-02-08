---
summary: "macOS 에서 OpenClaw 의 메뉴 막대 아이콘 상태와 애니메이션"
read_when:
  - 메뉴 막대 아이콘 동작 변경 시
title: "메뉴 막대 아이콘"
x-i18n:
  source_path: platforms/mac/icon.md
  source_hash: a67a6e6bbdc2b611
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:08Z
---

# 메뉴 막대 아이콘 상태

Author: steipete · Updated: 2025-12-06 · Scope: macOS 앱 (`apps/macos`)

- **대기(Idle):** 일반 아이콘 애니메이션(깜박임, 간헐적인 흔들림).
- **일시 중지(Paused):** 상태 항목이 `appearsDisabled` 을 사용하며, 움직임이 없습니다.
- **음성 트리거(큰 귀):** 음성 웨이크 감지기가 웨이크 워드가 감지되면 `AppState.triggerVoiceEars(ttl: nil)` 를 호출하고, 발화가 캡처되는 동안 `earBoostActive=true` 을 유지합니다. 귀는 1.9배로 확대되고 가독성을 위해 원형 귀 구멍이 생기며, 1초간의 무음 후 `stopVoiceEars()` 를 통해 내려옵니다. 인앱 음성 파이프라인에서만 트리거됩니다.
- **작업 중(에이전트 실행):** `AppState.isWorking=true` 가 '꼬리/다리 분주(scurry)' 마이크로 모션을 구동합니다. 작업이 진행 중일 때 다리 흔들림이 더 빨라지고 약간의 오프셋이 추가됩니다. 현재 WebChat 에이전트 실행 전후로 토글되며, 다른 장기 작업을 연결할 때도 동일한 토글을 추가하십시오.

연결 지점

- 음성 웨이크: 런타임/테스터는 트리거 시 `AppState.triggerVoiceEars(ttl: nil)` 를 호출하고, 캡처 창과 일치하도록 1초의 무음 후 `stopVoiceEars()` 를 호출합니다.
- 에이전트 활동: 작업 구간 전후로 `AppStateStore.shared.setWorking(true/false)` 를 설정합니다(이미 WebChat 에이전트 호출에서 처리됨). 애니메이션이 멈춘 상태로 남는 것을 방지하려면 구간을 짧게 유지하고 `defer` 블록에서 재설정하십시오.

형태 및 크기

- 기본 아이콘은 `CritterIconRenderer.makeIcon(blink:legWiggle:earWiggle:earScale:earHoles:)` 에서 그려집니다.
- 귀 스케일의 기본값은 `1.0` 이며, 음성 부스트는 `earScale=1.9` 를 설정하고 전체 프레임을 변경하지 않은 채 `earHoles=true` 를 토글합니다(18×18 pt 템플릿 이미지를 36×36 px Retina 백킹 스토어로 렌더링).
- 분주(scurry)는 다리 흔들림을 최대 약 1.0까지 사용하고 작은 수평 흔들림을 추가합니다. 이는 기존의 대기 흔들림에 가산됩니다.

동작 관련 참고 사항

- 귀/작업 상태에 대한 외부 CLI/브로커 토글은 제공하지 않습니다. 의도치 않은 플래핑을 피하기 위해 앱 내부 신호로만 유지하십시오.
- 작업이 중단될 경우 아이콘이 빠르게 기준 상태로 돌아오도록 TTL 을 짧게(&lt;10s) 유지하십시오.
