---
summary: "원격 Gateway(게이트웨이)에 연결하는 OpenClaw.app 용 SSH 터널 설정"
read_when: "SSH 를 통해 macOS 앱을 원격 Gateway(게이트웨이)에 연결할 때"
title: "원격 Gateway(게이트웨이) 설정"
x-i18n:
  source_path: gateway/remote-gateway-readme.md
  source_hash: b1ae266a7cb4911b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:38:53Z
---

# 원격 Gateway(게이트웨이)로 OpenClaw.app 실행하기

OpenClaw.app 은 SSH 터널링을 사용하여 원격 Gateway(게이트웨이)에 연결합니다. 이 가이드는 설정 방법을 안내합니다.

## 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Machine                          │
│                                                              │
│  OpenClaw.app ──► ws://127.0.0.1:18789 (local port)           │
│                     │                                        │
│                     ▼                                        │
│  SSH Tunnel ────────────────────────────────────────────────│
│                     │                                        │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                         Remote Machine                        │
│                                                              │
│  Gateway WebSocket ──► ws://127.0.0.1:18789 ──►              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 빠른 설정

### 1단계: SSH 설정 추가

`~/.ssh/config` 을(를) 편집하고 다음을 추가합니다:

```ssh
Host remote-gateway
    HostName <REMOTE_IP>          # e.g., 172.27.187.184
    User <REMOTE_USER>            # e.g., jefferson
    LocalForward 18789 127.0.0.1:18789
    IdentityFile ~/.ssh/id_rsa
```

`<REMOTE_IP>` 및 `<REMOTE_USER>` 을(를) 본인의 값으로 바꾸십시오.

### 2단계: SSH 키 복사

공개 키를 원격 머신에 복사합니다(비밀번호 1회 입력):

```bash
ssh-copy-id -i ~/.ssh/id_rsa <REMOTE_USER>@<REMOTE_IP>
```

### 3단계: Gateway(게이트웨이) 토큰 설정

```bash
launchctl setenv OPENCLAW_GATEWAY_TOKEN "<your-token>"
```

### 4단계: SSH 터널 시작

```bash
ssh -N remote-gateway &
```

### 5단계: OpenClaw.app 재시작

```bash
# Quit OpenClaw.app (⌘Q), then reopen:
open /path/to/OpenClaw.app
```

이제 앱은 SSH 터널을 통해 원격 Gateway(게이트웨이)에 연결합니다.

---

## 로그인 시 터널 자동 시작

로그인할 때 SSH 터널이 자동으로 시작되도록 하려면 Launch Agent 를 생성하십시오.

### PLIST 파일 생성

이를 `~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist` 로 저장하십시오:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>bot.molt.ssh-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>remote-gateway</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

### Launch Agent 로드

```bash
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist
```

이제 터널은 다음을 수행합니다:

- 로그인 시 자동으로 시작
- 충돌 시 재시작
- 백그라운드에서 계속 실행

레거시 참고: 남아 있는 `com.openclaw.ssh-tunnel` LaunchAgent 가 있으면 제거하십시오.

---

## 문제 해결

**터널이 실행 중인지 확인:**

```bash
ps aux | grep "ssh -N remote-gateway" | grep -v grep
lsof -i :18789
```

**터널 재시작:**

```bash
launchctl kickstart -k gui/$UID/bot.molt.ssh-tunnel
```

**터널 중지:**

```bash
launchctl bootout gui/$UID/bot.molt.ssh-tunnel
```

---

## 작동 방식

| 구성 요소                            | 수행하는 작업                                      |
| ------------------------------------ | -------------------------------------------------- |
| `LocalForward 18789 127.0.0.1:18789` | 로컬 포트 18789 를 원격 포트 18789 로 포워딩합니다 |
| `ssh -N`                             | 원격 명령을 실행하지 않는 SSH (포트 포워딩만 수행) |
| `KeepAlive`                          | 충돌 시 터널을 자동으로 재시작합니다               |
| `RunAtLoad`                          | 에이전트가 로드될 때 터널을 시작합니다             |

OpenClaw.app 은 클라이언트 머신의 `ws://127.0.0.1:18789` 에 연결합니다. SSH 터널은 해당 연결을 Gateway(게이트웨이)가 실행 중인 원격 머신의 포트 18789 로 포워딩합니다.
