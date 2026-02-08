---
summary: "iOS 및 기타 원격 노드를 위한 Gateway 소유 노드 페어링(옵션 B)"
read_when:
  - macOS UI 없이 노드 페어링 승인을 구현할 때
  - 원격 노드를 승인하기 위한 CLI 플로우를 추가할 때
  - 노드 관리를 포함하도록 게이트웨이 프로토콜을 확장할 때
title: "Gateway 소유 페어링"
x-i18n:
  source_path: gateway/pairing.md
  source_hash: 1f5154292a75ea2c
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:16Z
---

# Gateway 소유 페어링(옵션 B)

Gateway 소유 페어링에서는 **Gateway(게이트웨이)** 가 어떤 노드가 참여할 수 있는지에 대한 단일 진실 공급원입니다. UI(macOS 앱, 향후 클라이언트)는 보류 중인 요청을 승인하거나 거부하는 프런트엔드에 불과합니다.

**중요:** WS 노드는 `connect` 중에 **디바이스 페어링**(역할 `node`)을 사용합니다.
`node.pair.*` 는 별도의 페어링 저장소이며 WS 핸드셰이크를 **차단하지 않습니다**.
`node.pair.*` 를 명시적으로 호출하는 클라이언트만 이 플로우를 사용합니다.

## 개념

- **보류 중인 요청**: 노드가 참여를 요청한 상태이며, 승인이 필요합니다.
- **페어링된 노드**: 승인을 받아 인증 토큰이 발급된 노드입니다.
- **전송(Transport)**: Gateway WS 엔드포인트는 요청을 전달하지만 멤버십을 결정하지는 않습니다. (레거시 TCP 브리지 지원은 사용 중단/제거되었습니다.)

## 페어링 동작 방식

1. 노드가 Gateway WS 에 연결하고 페어링을 요청합니다.
2. Gateway(게이트웨이)가 **보류 중인 요청**을 저장하고 `node.pair.requested` 를 발생시킵니다.
3. 요청을 승인하거나 거부합니다(CLI 또는 UI).
4. 승인 시 Gateway(게이트웨이)가 **새 토큰**을 발급합니다(토큰은 재-페어링 시 회전됩니다).
5. 노드가 토큰을 사용해 다시 연결하면 이제 "페어링됨" 상태가 됩니다.

보류 중인 요청은 **5분** 후 자동으로 만료됩니다.

## CLI 워크플로(헤드리스 친화적)

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes reject <requestId>
openclaw nodes status
openclaw nodes rename --node <id|name|ip> --name "Living Room iPad"
```

`nodes status` 는 페어링됨/연결됨 노드와 해당 기능을 표시합니다.

## API 표면(게이트웨이 프로토콜)

이벤트:

- `node.pair.requested` — 새 보류 중인 요청이 생성될 때 발생합니다.
- `node.pair.resolved` — 요청이 승인/거부/만료될 때 발생합니다.

메서드:

- `node.pair.request` — 보류 중인 요청을 생성하거나 재사용합니다.
- `node.pair.list` — 보류 중인 노드 + 페어링된 노드를 나열합니다.
- `node.pair.approve` — 보류 중인 요청을 승인합니다(토큰 발급).
- `node.pair.reject` — 보류 중인 요청을 거부합니다.
- `node.pair.verify` — `{ nodeId, token }` 를 검증합니다.

참고:

- `node.pair.request` 는 노드별로 멱등입니다. 반복 호출해도 동일한 보류 중인 요청이 반환됩니다.
- 승인은 **항상** 새로운 토큰을 생성합니다. `node.pair.request` 에서는 어떤 토큰도 반환되지 않습니다.
- 요청에는 자동 승인 플로우를 위한 힌트로 `silent: true` 가 포함될 수 있습니다.

## 자동 승인(macOS 앱)

macOS 앱은 다음 조건에서 선택적으로 **무음 승인**을 시도할 수 있습니다.

- 요청이 `silent` 로 표시되어 있고,
- 앱이 동일한 사용자를 사용하여 게이트웨이 호스트에 대한 SSH 연결을 검증할 수 있는 경우.

무음 승인이 실패하면, 일반적인 "Approve/Reject" 프롬프트로 폴백합니다.

## 스토리지(로컬, 비공개)

페어링 상태는 Gateway(게이트웨이) 상태 디렉토리(기본값 `~/.openclaw`) 아래에 저장됩니다.

- `~/.openclaw/nodes/paired.json`
- `~/.openclaw/nodes/pending.json`

`OPENCLAW_STATE_DIR` 를 재정의하면 `nodes/` 폴더도 함께 이동합니다.

보안 참고 사항:

- 토큰은 비밀 정보입니다. `paired.json` 는 민감한 정보로 취급합니다.
- 토큰을 회전하려면 재승인이 필요합니다(또는 노드 항목을 삭제해야 합니다).

## 전송(Transport) 동작

- 전송 계층은 **상태 비저장**이며, 멤버십을 저장하지 않습니다.
- Gateway(게이트웨이)가 오프라인이거나 페어링이 비활성화되어 있으면 노드는 페어링할 수 없습니다.
- Gateway(게이트웨이)가 원격 모드인 경우에도, 페어링은 원격 Gateway(게이트웨이)의 저장소를 대상으로 여전히 수행됩니다.
