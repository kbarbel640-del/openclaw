---
summary: "Linux 지원 및 컴패니언 앱 상태"
read_when:
  - Linux 컴패니언 앱 상태를 찾는 경우
  - 플랫폼 커버리지 또는 기여를 계획하는 경우
title: "Linux 앱"
x-i18n:
  source_path: platforms/linux.md
  source_hash: 93b8250cd1267004
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:54Z
---

# Linux 앱

Gateway(게이트웨이)는 Linux 에서 완전히 지원됩니다. **Node 는 권장 런타임**입니다.
Bun 은 Gateway 에 권장되지 않습니다(WhatsApp/Telegram 버그).

네이티브 Linux 컴패니언 앱은 계획 중입니다. 구축에 도움을 주고 싶다면 기여를 환영합니다.

## 초보자 빠른 경로(VPS)

1. Node 22+ 설치
2. `npm i -g openclaw@latest`
3. `openclaw onboard --install-daemon`
4. 노트북에서: `ssh -N -L 18789:127.0.0.1:18789 <user>@<host>`
5. `http://127.0.0.1:18789/` 을 열고 토큰을 붙여넣기

단계별 VPS 가이드: [exe.dev](/install/exe-dev)

## 설치

- [시작하기](/start/getting-started)
- [설치 및 업데이트](/install/updating)
- 선택적 흐름: [Bun (실험적)](/install/bun), [Nix](/install/nix), [Docker](/install/docker)

## Gateway

- [Gateway 런북](/gateway)
- [구성](/gateway/configuration)

## Gateway 서비스 설치(CLI)

다음 중 하나를 사용합니다:

```
openclaw onboard --install-daemon
```

또는:

```
openclaw gateway install
```

또는:

```
openclaw configure
```

프롬프트가 표시되면 **Gateway 서비스**를 선택합니다.

복구/마이그레이션:

```
openclaw doctor
```

## 시스템 제어(systemd 사용자 유닛)

OpenClaw 는 기본적으로 systemd **사용자** 서비스를 설치합니다. 공유 또는 항상 켜져 있어야 하는 서버에는 **시스템**
서비스를 사용합니다. 전체 유닛 예제와 가이드는 [Gateway 런북](/gateway)에 있습니다.

최소 설정:

`~/.config/systemd/user/openclaw-gateway[-<profile>].service` 을 생성합니다:

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

활성화합니다:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```
