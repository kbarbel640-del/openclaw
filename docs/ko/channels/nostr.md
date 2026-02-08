---
summary: "NIP-04 암호화 메시지를 통한 Nostr 다이렉트 메시지 채널"
read_when:
  - OpenClaw가 Nostr를 통해 다이렉트 메시지를 수신하도록 하려는 경우
  - 탈중앙화 메시징을 설정하는 경우
title: "Nostr"
x-i18n:
  source_path: channels/nostr.md
  source_hash: 6b9fe4c74bf5e7c0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:17Z
---

# Nostr

**상태:** 선택적 플러그인 (기본적으로 비활성화됨).

Nostr는 소셜 네트워킹을 위한 탈중앙화 프로토콜입니다. 이 채널을 통해 OpenClaw는 NIP-04를 통한 암호화된 다이렉트 메시지 (DM)를 수신하고 응답할 수 있습니다.

## 설치 (필요 시)

### 온보딩 (권장)

- 온보딩 마법사 (`openclaw onboard`) 및 `openclaw channels add` 에서 선택적 채널 플러그인을 나열합니다.
- Nostr를 선택하면 필요 시 플러그인 설치를 안내합니다.

기본 설치 동작:

- **Dev 채널 + git checkout 사용 가능:** 로컬 플러그인 경로를 사용합니다.
- **Stable/Beta:** npm에서 다운로드합니다.

프롬프트에서 언제든지 선택을 재정의할 수 있습니다.

### 수동 설치

```bash
openclaw plugins install @openclaw/nostr
```

로컬 체크아웃 사용 (개발 워크플로):

```bash
openclaw plugins install --link <path-to-openclaw>/extensions/nostr
```

플러그인을 설치하거나 활성화한 후 Gateway(게이트웨이)를 재시작하십시오.

## 빠른 설정

1. Nostr 키페어 생성 (필요한 경우):

```bash
# Using nak
nak key generate
```

2. 설정에 추가:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}"
    }
  }
}
```

3. 키 내보내기:

```bash
export NOSTR_PRIVATE_KEY="nsec1..."
```

4. Gateway(게이트웨이)를 재시작합니다.

## 설정 참조

| 키           | 유형     | 기본값                                      | 설명                           |
| ------------ | -------- | ------------------------------------------- | ------------------------------ |
| `privateKey` | string   | required                                    | `nsec` 또는 hex 형식의 개인 키 |
| `relays`     | string[] | `['wss://relay.damus.io', 'wss://nos.lol']` | 릴레이 URL (WebSocket)         |
| `dmPolicy`   | string   | `pairing`                                   | DM 접근 정책                   |
| `allowFrom`  | string[] | `[]`                                        | 허용된 발신자 공개 키          |
| `enabled`    | boolean  | `true`                                      | 채널 활성화/비활성화           |
| `name`       | string   | -                                           | 표시 이름                      |
| `profile`    | object   | -                                           | NIP-01 프로필 메타데이터       |

## 프로필 메타데이터

프로필 데이터는 NIP-01 `kind:0` 이벤트로 게시됩니다. Control UI (Channels -> Nostr -> Profile)에서 관리하거나 설정에서 직접 지정할 수 있습니다.

예시:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "profile": {
        "name": "openclaw",
        "displayName": "OpenClaw",
        "about": "Personal assistant DM bot",
        "picture": "https://example.com/avatar.png",
        "banner": "https://example.com/banner.png",
        "website": "https://example.com",
        "nip05": "openclaw@example.com",
        "lud16": "openclaw@example.com"
      }
    }
  }
}
```

참고 사항:

- 프로필 URL은 `https://` 를 사용해야 합니다.
- 릴레이에서 가져오기를 수행하면 필드를 병합하며 로컬 재정의는 유지됩니다.

## 접근 제어

### DM 정책

- **pairing** (기본값): 알 수 없는 발신자는 페어링 코드를 받습니다.
- **allowlist**: `allowFrom` 에 있는 공개 키만 DM을 보낼 수 있습니다.
- **open**: 모든 수신 DM 허용 ( `allowFrom: ["*"]` 필요).
- **disabled**: 수신 DM을 무시합니다.

### 허용 목록 예시

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "dmPolicy": "allowlist",
      "allowFrom": ["npub1abc...", "npub1xyz..."]
    }
  }
}
```

## 키 형식

지원되는 형식:

- **개인 키:** `nsec...` 또는 64자 hex
- **공개 키 (`allowFrom`):** `npub...` 또는 hex

## 릴레이

기본값: `relay.damus.io` 및 `nos.lol`.

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nostr.wine"]
    }
  }
}
```

팁:

- 중복 대비를 위해 2~3개의 릴레이를 사용하십시오.
- 너무 많은 릴레이는 피하십시오 (지연 시간, 중복 발생).
- 유료 릴레이는 신뢰성을 향상시킬 수 있습니다.
- 로컬 릴레이는 테스트에 적합합니다 (`ws://localhost:7777`).

## 프로토콜 지원

| NIP    | 상태   | 설명                                 |
| ------ | ------ | ------------------------------------ |
| NIP-01 | 지원됨 | 기본 이벤트 형식 + 프로필 메타데이터 |
| NIP-04 | 지원됨 | 암호화된 DM (`kind:4`)               |
| NIP-17 | 계획됨 | 기프트 래핑된 DM                     |
| NIP-44 | 계획됨 | 버전 관리 암호화                     |

## 테스트

### 로컬 릴레이

```bash
# Start strfry
docker run -p 7777:7777 ghcr.io/hoytech/strfry
```

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["ws://localhost:7777"]
    }
  }
}
```

### 수동 테스트

1. 로그에서 봇 공개 키 (npub)를 확인합니다.
2. Nostr 클라이언트 (Damus, Amethyst 등)를 엽니다.
3. 봇 공개 키로 DM을 보냅니다.
4. 응답을 확인합니다.

## 문제 해결

### 메시지를 수신하지 못하는 경우

- 개인 키가 유효한지 확인하십시오.
- 릴레이 URL에 접근 가능하며 `wss://` (또는 로컬의 경우 `ws://`) 를 사용하는지 확인하십시오.
- `enabled` 이 `false` 이 아닌지 확인하십시오.
- Gateway(게이트웨이) 로그에서 릴레이 연결 오류를 확인하십시오.

### 응답을 전송하지 못하는 경우

- 릴레이가 쓰기를 허용하는지 확인하십시오.
- 아웃바운드 연결을 확인하십시오.
- 릴레이 속도 제한을 확인하십시오.

### 중복 응답

- 여러 릴레이를 사용할 때 정상적인 동작입니다.
- 메시지는 이벤트 ID로 중복 제거되며, 첫 번째 전달만 응답을 트리거합니다.

## 보안

- 개인 키를 절대 커밋하지 마십시오.
- 키에는 환경 변수를 사용하십시오.
- 프로덕션 봇의 경우 `allowlist` 사용을 고려하십시오.

## 제한 사항 (MVP)

- 다이렉트 메시지만 지원 (그룹 채팅 미지원).
- 미디어 첨부 미지원.
- NIP-04만 지원 (NIP-17 기프트 래핑은 예정됨).
