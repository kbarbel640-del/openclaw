---
summary: "브리지 프로토콜(레거시 노드): TCP JSONL, 페어링, 범위 지정 RPC"
read_when:
  - iOS/Android/macOS 노드 모드에서 노드 클라이언트를 빌드하거나 디버깅하는 경우
  - 페어링 또는 브리지 인증 실패를 조사하는 경우
  - 게이트웨이가 노출하는 노드 표면을 감사하는 경우
title: "브리지 프로토콜"
x-i18n:
  source_path: gateway/bridge-protocol.md
  source_hash: 789bcf3cbc6841fc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:01Z
---

# 브리지 프로토콜(레거시 노드 전송)

브리지 프로토콜은 **레거시** 노드 전송(TCP JSONL)입니다. 신규 노드 클라이언트는 대신 통합된 Gateway(게이트웨이) WebSocket 프로토콜을 사용해야 합니다.

오퍼레이터 또는 노드 클라이언트를 빌드하는 경우
[Gateway 프로토콜](/gateway/protocol)을 사용하십시오.

**참고:** 현재 OpenClaw 빌드는 더 이상 TCP 브리지 리스너를 포함하지 않으며, 이 문서는 역사적 참고용으로 유지됩니다.
레거시 `bridge.*` 설정 키는 더 이상 설정 스키마의 일부가 아닙니다.

## 둘 다 있는 이유

- **보안 경계**: 브리지는 전체 게이트웨이 API 표면이 아니라 작은 허용 목록을 노출합니다.
- **페어링 + 노드 아이덴티티**: 노드 승인(admission)은 게이트웨이가 소유하며 노드별 토큰에 연결됩니다.
- **디바이스 검색 UX**: 노드는 LAN 에서 Bonjour 로 게이트웨이를 디바이스 검색하거나, tailnet 을 통해 직접 연결할 수 있습니다.
- **Loopback WS**: 전체 WS 컨트롤 플레인은 SSH 를 통해 터널링하지 않는 한 로컬에 유지됩니다.

## 전송

- TCP, 줄당 하나의 JSON 객체(JSONL).
- 선택적 TLS(`bridge.tls.enabled` 이 true 인 경우).
- 레거시 기본 리스너 포트는 `18790` 였습니다(현재 빌드는 TCP 브리지를 시작하지 않습니다).

TLS 가 활성화되면, 디바이스 검색 TXT 레코드에 `bridgeTls=1` 와
`bridgeTlsSha256` 가 포함되어 노드가 인증서를 핀(pin)할 수 있습니다.

## 핸드셰이크 + 페어링

1. 클라이언트가 노드 메타데이터 + 토큰(이미 페어링된 경우)을 포함하여 `hello` 를 전송합니다.
2. 페어링되지 않은 경우, 게이트웨이가 `error` (`NOT_PAIRED`/`UNAUTHORIZED`)로 응답합니다.
3. 클라이언트가 `pair-request` 를 전송합니다.
4. 게이트웨이가 승인을 대기한 다음, `pair-ok` 및 `hello-ok` 를 전송합니다.

`hello-ok` 는 `serverName` 를 반환하며 `canvasHostUrl` 를 포함할 수 있습니다.

## 프레임

클라이언트 → 게이트웨이:

- `req` / `res`: 범위 지정된 게이트웨이 RPC(채팅, 세션, 설정, 상태, voicewake, skills.bins)
- `event`: 노드 시그널(음성 전사, 에이전트 요청, 채팅 구독, exec 라이프사이클)

게이트웨이 → 클라이언트:

- `invoke` / `invoke-res`: 노드 명령(`canvas.*`, `camera.*`, `screen.record`,
  `location.get`, `sms.send`)
- `event`: 구독된 세션에 대한 채팅 업데이트
- `ping` / `pong`: keepalive

레거시 허용 목록 강제(enforcement)는 `src/gateway/server-bridge.ts` 에 있었습니다(제거됨).

## Exec 라이프사이클 이벤트

노드는 system.run 활동을 노출하기 위해 `exec.finished` 또는 `exec.denied` 이벤트를 발생시킬 수 있습니다.
이들은 게이트웨이의 시스템 이벤트로 매핑됩니다. (레거시 노드는 여전히 `exec.started` 를 발생시킬 수 있습니다.)

페이로드 필드(명시되지 않은 한 모두 선택 사항):

- `sessionKey` (필수): 시스템 이벤트를 수신할 에이전트 세션.
- `runId`: 그룹화를 위한 고유 exec id.
- `command`: 원시 또는 서식이 적용된 명령 문자열.
- `exitCode`, `timedOut`, `success`, `output`: 완료 세부사항(완료된 경우에만).
- `reason`: 거부 사유(거부된 경우에만).

## Tailnet 사용

- 브리지를 tailnet IP 에 바인드: `bridge.bind: "tailnet"` 를
  `~/.openclaw/openclaw.json` 에 설정합니다.
- 클라이언트는 MagicDNS 이름 또는 tailnet IP 를 통해 연결합니다.
- Bonjour 는 네트워크를 **가로지르지** 않습니다. 필요 시 수동 호스트/포트 또는 광역 DNS‑SD 를 사용하십시오.

## 버저닝

브리지는 현재 **암묵적 v1** 입니다(최소/최대 협상 없음). 하위 호환은 예상됩니다. 호환성이 깨지는 변경 전에 브리지 프로토콜 버전 필드를 추가하십시오.
