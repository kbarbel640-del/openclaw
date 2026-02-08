---
summary: "Zalo Personal 플러그인: zca-cli를 통한 QR 로그인 + 메시징 (플러그인 설치 + 채널 설정 + CLI + 도구)"
read_when:
  - OpenClaw에서 Zalo Personal(비공식) 지원이 필요할 때
  - zalouser 플러그인을 설정하거나 개발할 때
title: "Zalo Personal 플러그인"
x-i18n:
  source_path: plugins/zalouser.md
  source_hash: b29b788b023cd507
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:09Z
---

# Zalo Personal (플러그인)

일반 Zalo 사용자 계정을 자동화하기 위해 `zca-cli`를 사용하는 플러그인을 통해 OpenClaw에서 Zalo Personal을 지원합니다.

> **경고:** 비공식 자동화는 계정 정지 또는 차단으로 이어질 수 있습니다. 사용에 따른 위험은 사용자 본인에게 있습니다.

## 명명 규칙

채널 id는 **개인 Zalo 사용자 계정**(비공식)을 자동화한다는 점을 명확히 하기 위해 `zalouser`입니다. 향후 공식 Zalo API 통합 가능성을 위해 `zalo`은 예약해 둡니다.

## 실행 위치

이 플러그인은 **Gateway(게이트웨이) 프로세스 내부**에서 실행됩니다.

원격 Gateway를 사용하는 경우, **Gateway가 실행 중인 머신**에 설치 및 설정한 다음 Gateway를 재시작하십시오.

## 설치

### 옵션 A: npm에서 설치

```bash
openclaw plugins install @openclaw/zalouser
```

이후 Gateway를 재시작하십시오.

### 옵션 B: 로컬 폴더에서 설치 (개발용)

```bash
openclaw plugins install ./extensions/zalouser
cd ./extensions/zalouser && pnpm install
```

이후 Gateway를 재시작하십시오.

## 사전 요구 사항: zca-cli

Gateway 머신에는 `zca`가 `PATH`에 있어야 합니다.

```bash
zca --version
```

## 설정

채널 설정은 `channels.zalouser` 아래에 있습니다(`plugins.entries.*` 아님).

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
}
```

## CLI

```bash
openclaw channels login --channel zalouser
openclaw channels logout --channel zalouser
openclaw channels status --probe
openclaw message send --channel zalouser --target <threadId> --message "Hello from OpenClaw"
openclaw directory peers list --channel zalouser --query "name"
```

## 에이전트 도구

도구 이름: `zalouser`

동작: `send`, `image`, `link`, `friends`, `groups`, `me`, `status`
