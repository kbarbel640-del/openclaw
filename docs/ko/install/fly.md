---
title: Fly.io
description: Fly.io에서 OpenClaw 배포
x-i18n:
  source_path: install/fly.md
  source_hash: 148f8e3579f185f1
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:33Z
---

# Fly.io 배포

**목표:** 영구 스토리지, 자동 HTTPS, Discord/채널 접근을 갖춘 [Fly.io](https://fly.io) 머신에서 실행되는 OpenClaw Gateway(게이트웨이).

## 준비 사항

- [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/) 설치됨
- Fly.io 계정(무료 티어로도 가능)
- 모델 인증: Anthropic API 키(또는 다른 프로바이더 키)
- 채널 자격 증명: Discord 봇 토큰, Telegram 토큰 등

## 초보자용 빠른 경로

1. 저장소 복제 → `fly.toml` 사용자 지정
2. 앱 + 볼륨 생성 → 시크릿 설정
3. `fly deploy`로 배포
4. SSH 로 접속해 설정을 생성하거나 Control UI 사용

## 1) Fly 앱 생성

```bash
# Clone the repo
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# Create a new Fly app (pick your own name)
fly apps create my-openclaw

# Create a persistent volume (1GB is usually enough)
fly volumes create openclaw_data --size 1 --region iad
```

**팁:** 사용자와 가까운 리전을 선택합니다. 일반적인 옵션: `lhr` (London), `iad` (Virginia), `sjc` (San Jose).

## 2) fly.toml 설정

앱 이름과 요구 사항에 맞게 `fly.toml`을(를) 편집합니다.

**보안 참고:** 기본 설정은 공개 URL 을 노출합니다. 공개 IP 가 없는 강화된 배포를 원하면 [비공개 배포](#private-deployment-hardened)를 참고하거나 `fly.private.toml`을(를) 사용합니다.

```toml
app = "my-openclaw"  # Your app name
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  OPENCLAW_PREFER_PNPM = "1"
  OPENCLAW_STATE_DIR = "/data"
  NODE_OPTIONS = "--max-old-space-size=1536"

[processes]
  app = "node dist/index.js gateway --allow-unconfigured --port 3000 --bind lan"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[vm]]
  size = "shared-cpu-2x"
  memory = "2048mb"

[mounts]
  source = "openclaw_data"
  destination = "/data"
```

**핵심 설정:**

| 설정                           | 이유                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `--bind lan`                   | Fly 프록시가 게이트웨이에 도달할 수 있도록 `0.0.0.0`에 바인딩합니다                 |
| `--allow-unconfigured`         | 설정 파일 없이 시작합니다(이후에 생성합니다)                                        |
| `internal_port = 3000`         | Fly 상태 점검을 위해 `--port 3000` (또는 `OPENCLAW_GATEWAY_PORT`)와 일치해야 합니다 |
| `memory = "2048mb"`            | 512MB 는 너무 작습니다. 2GB 권장                                                    |
| `OPENCLAW_STATE_DIR = "/data"` | 볼륨에 상태를 영구 저장합니다                                                       |

## 3) 시크릿 설정

```bash
# Required: Gateway token (for non-loopback binding)
fly secrets set OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)

# Model provider API keys
fly secrets set ANTHROPIC_API_KEY=sk-ant-...

# Optional: Other providers
fly secrets set OPENAI_API_KEY=sk-...
fly secrets set GOOGLE_API_KEY=...

# Channel tokens
fly secrets set DISCORD_BOT_TOKEN=MTQ...
```

**참고:**

- non-loopback 바인딩(`--bind lan`)에는 보안을 위해 `OPENCLAW_GATEWAY_TOKEN`이(가) 필요합니다.
- 이러한 토큰은 비밀번호처럼 취급합니다.
- 모든 API 키와 토큰은 **설정 파일보다 환경 변수**를 선호합니다. 이렇게 하면 `openclaw.json`에 시크릿이 남지 않아 실수로 노출되거나 로깅될 가능성을 줄일 수 있습니다.

## 4) 배포

```bash
fly deploy
```

첫 배포는 Docker 이미지를 빌드합니다(~2-3분). 이후 배포는 더 빠릅니다.

배포 후 다음을 확인합니다:

```bash
fly status
fly logs
```

다음이 표시되어야 합니다:

```
[gateway] listening on ws://0.0.0.0:3000 (PID xxx)
[discord] logged in to discord as xxx
```

## 5) 설정 파일 생성

SSH 로 머신에 접속하여 올바른 설정을 생성합니다:

```bash
fly ssh console
```

설정 디렉토리와 파일을 생성합니다:

```bash
mkdir -p /data
cat > /data/openclaw.json << 'EOF'
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-opus-4-6",
        "fallbacks": ["anthropic/claude-sonnet-4-5", "openai/gpt-4o"]
      },
      "maxConcurrent": 4
    },
    "list": [
      {
        "id": "main",
        "default": true
      }
    ]
  },
  "auth": {
    "profiles": {
      "anthropic:default": { "mode": "token", "provider": "anthropic" },
      "openai:default": { "mode": "token", "provider": "openai" }
    }
  },
  "bindings": [
    {
      "agentId": "main",
      "match": { "channel": "discord" }
    }
  ],
  "channels": {
    "discord": {
      "enabled": true,
      "groupPolicy": "allowlist",
      "guilds": {
        "YOUR_GUILD_ID": {
          "channels": { "general": { "allow": true } },
          "requireMention": false
        }
      }
    }
  },
  "gateway": {
    "mode": "local",
    "bind": "auto"
  },
  "meta": {
    "lastTouchedVersion": "2026.1.29"
  }
}
EOF
```

**참고:** `OPENCLAW_STATE_DIR=/data` 사용 시 설정 경로는 `/data/openclaw.json`입니다.

**참고:** Discord 토큰은 다음 중 하나에서 가져올 수 있습니다:

- 환경 변수: `DISCORD_BOT_TOKEN` (시크릿에 권장)
- 설정 파일: `channels.discord.token`

env var 를 사용하는 경우 설정에 토큰을 추가할 필요가 없습니다. 게이트웨이는 `DISCORD_BOT_TOKEN`을(를) 자동으로 읽습니다.

적용을 위해 재시작합니다:

```bash
exit
fly machine restart <machine-id>
```

## 6) Gateway(게이트웨이) 접근

### Control UI

브라우저에서 엽니다:

```bash
fly open
```

또는 `https://my-openclaw.fly.dev/`에 방문합니다.

인증을 위해 게이트웨이 토큰(`OPENCLAW_GATEWAY_TOKEN`에서 얻은 토큰)을 붙여넣습니다.

### 로그

```bash
fly logs              # Live logs
fly logs --no-tail    # Recent logs
```

### SSH 콘솔

```bash
fly ssh console
```

## 문제 해결

### "App is not listening on expected address"

게이트웨이가 `0.0.0.0` 대신 `127.0.0.1`에 바인딩하고 있습니다.

**해결:** `fly.toml`의 프로세스 명령에 `--bind lan`을(를) 추가합니다.

### 상태 점검 실패 / connection refused

Fly 가 설정된 포트에서 게이트웨이에 도달할 수 없습니다.

**해결:** `internal_port`이(가) 게이트웨이 포트와 일치하는지 확인합니다(`--port 3000` 또는 `OPENCLAW_GATEWAY_PORT=3000` 설정).

### OOM / 메모리 문제

컨테이너가 계속 재시작되거나 종료됩니다. 징후: `SIGABRT`, `v8::internal::Runtime_AllocateInYoungGeneration` 또는 조용한 재시작.

**해결:** `fly.toml`에서 메모리를 늘립니다:

```toml
[[vm]]
  memory = "2048mb"
```

또는 기존 머신을 업데이트합니다:

```bash
fly machine update <machine-id> --vm-memory 2048 -y
```

**참고:** 512MB 는 너무 작습니다. 1GB 는 동작할 수 있지만 부하가 있거나 상세 로깅을 사용하면 OOM 이 날 수 있습니다. **2GB 를 권장합니다.**

### Gateway(게이트웨이) 락 문제

Gateway(게이트웨이)가 "already running" 오류로 시작을 거부합니다.

이는 컨테이너가 재시작되었지만 PID 락 파일이 볼륨에 남아 있을 때 발생합니다.

**해결:** 락 파일을 삭제합니다:

```bash
fly ssh console --command "rm -f /data/gateway.*.lock"
fly machine restart <machine-id>
```

락 파일은 `/data/gateway.*.lock`에 있습니다(하위 디렉토리 안이 아닙니다).

### 설정이 읽히지 않음

`--allow-unconfigured`을(를) 사용하면 게이트웨이가 최소 설정을 생성합니다. `/data/openclaw.json`의 사용자 지정 설정은 재시작 시 읽혀야 합니다.

설정이 존재하는지 확인합니다:

```bash
fly ssh console --command "cat /data/openclaw.json"
```

### SSH 를 통한 설정 작성

`fly ssh console -C` 명령은 셸 리디렉션을 지원하지 않습니다. 설정 파일을 작성하려면:

```bash
# Use echo + tee (pipe from local to remote)
echo '{"your":"config"}' | fly ssh console -C "tee /data/openclaw.json"

# Or use sftp
fly sftp shell
> put /local/path/config.json /data/openclaw.json
```

**참고:** 파일이 이미 존재하면 `fly sftp`이(가) 실패할 수 있습니다. 먼저 삭제합니다:

```bash
fly ssh console --command "rm /data/openclaw.json"
```

### 상태가 영구 저장되지 않음

재시작 후 자격 증명이나 세션이 사라진다면 상태 디렉토리가 컨테이너 파일시스템에 기록되고 있습니다.

**해결:** `fly.toml`에서 `OPENCLAW_STATE_DIR=/data`이(가) 설정되어 있는지 확인하고 다시 배포합니다.

## 업데이트

```bash
# Pull latest changes
git pull

# Redeploy
fly deploy

# Check health
fly status
fly logs
```

### 머신 명령 업데이트

전체 재배포 없이 시작 명령을 변경해야 하는 경우:

```bash
# Get machine ID
fly machines list

# Update command
fly machine update <machine-id> --command "node dist/index.js gateway --port 3000 --bind lan" -y

# Or with memory increase
fly machine update <machine-id> --vm-memory 2048 --command "node dist/index.js gateway --port 3000 --bind lan" -y
```

**참고:** `fly deploy` 이후 머신 명령이 `fly.toml`에 있는 값으로 재설정될 수 있습니다. 수동 변경을 했다면 배포 후 다시 적용합니다.

## 비공개 배포(강화됨)

기본적으로 Fly 는 공개 IP 를 할당하므로 게이트웨이는 `https://your-app.fly.dev`에서 접근 가능해집니다. 이는 편리하지만, 배포가 인터넷 스캐너(Shodan, Censys 등)에 의해 탐지될 수 있음을 의미합니다.

**공개 노출이 없는** 강화된 배포를 위해 비공개 템플릿을 사용합니다.

### 비공개 배포를 사용할 때

- **아웃바운드** 호출/메시지만 수행합니다(인바운드 웹훅 없음)
- 웹훅 콜백에는 **ngrok 또는 Tailscale** 터널을 사용합니다
- 브라우저 대신 **SSH, 프록시 또는 WireGuard**로 게이트웨이에 접근합니다
- 배포를 **인터넷 스캐너로부터 숨기고** 싶습니다

### 설정

표준 설정 대신 `fly.private.toml`을(를) 사용합니다:

```bash
# Deploy with private config
fly deploy -c fly.private.toml
```

또는 기존 배포를 변환합니다:

```bash
# List current IPs
fly ips list -a my-openclaw

# Release public IPs
fly ips release <public-ipv4> -a my-openclaw
fly ips release <public-ipv6> -a my-openclaw

# Switch to private config so future deploys don't re-allocate public IPs
# (remove [http_service] or deploy with the private template)
fly deploy -c fly.private.toml

# Allocate private-only IPv6
fly ips allocate-v6 --private -a my-openclaw
```

이후 `fly ips list`에는 `private` 유형 IP 만 표시되어야 합니다:

```
VERSION  IP                   TYPE             REGION
v6       fdaa:x:x:x:x::x      private          global
```

### 비공개 배포 접근

공개 URL 이 없으므로 다음 방법 중 하나를 사용합니다:

**옵션 1: 로컬 프록시(가장 간단함)**

```bash
# Forward local port 3000 to the app
fly proxy 3000:3000 -a my-openclaw

# Then open http://localhost:3000 in browser
```

**옵션 2: WireGuard VPN**

```bash
# Create WireGuard config (one-time)
fly wireguard create

# Import to WireGuard client, then access via internal IPv6
# Example: http://[fdaa:x:x:x:x::x]:3000
```

**옵션 3: SSH 전용**

```bash
fly ssh console -a my-openclaw
```

### 비공개 배포에서의 웹훅

공개 노출 없이 웹훅 콜백(Twilio, Telnyx 등)이 필요하다면:

1. **ngrok 터널** - 컨테이너 내부 또는 사이드카로 ngrok 을 실행합니다
2. **Tailscale Funnel** - Tailscale 을 통해 특정 경로를 노출합니다
3. **아웃바운드 전용** - 일부 프로바이더(Twilio)는 웹훅 없이도 아웃바운드 통화가 잘 동작합니다

ngrok 을 사용한 음성 통화 설정 예시:

```json
{
  "plugins": {
    "entries": {
      "voice-call": {
        "enabled": true,
        "config": {
          "provider": "twilio",
          "tunnel": { "provider": "ngrok" },
          "webhookSecurity": {
            "allowedHosts": ["example.ngrok.app"]
          }
        }
      }
    }
  }
}
```

ngrok 터널은 컨테이너 내부에서 실행되며, Fly 앱 자체를 노출하지 않고도 공개 웹훅 URL 을 제공합니다. 전달된 호스트 헤더가 허용되도록 `webhookSecurity.allowedHosts`을(를) 공개 터널 호스트명으로 설정합니다.

### 보안 이점

| 항목            | 공개      | 비공개      |
| --------------- | --------- | ----------- |
| 인터넷 스캐너   | 탐지 가능 | 숨김        |
| 직접 공격       | 가능      | 차단됨      |
| Control UI 접근 | 브라우저  | 프록시/VPN  |
| 웹훅 전달       | 직접      | 터널을 통해 |

## 참고

- Fly.io 는 **x86 아키텍처**를 사용합니다(ARM 아님)
- Dockerfile 은 두 아키텍처 모두와 호환됩니다
- WhatsApp/Telegram 온보딩은 `fly ssh console`을(를) 사용합니다
- 영구 데이터는 볼륨의 `/data`에 저장됩니다
- Signal 은 Java + signal-cli 가 필요합니다. 커스텀 이미지를 사용하고 메모리는 2GB+로 유지합니다.

## 비용

권장 설정(`shared-cpu-2x`, RAM 2GB) 기준:

- 사용량에 따라 월 ~$10-15
- 무료 티어에는 일부 사용량이 포함됩니다

자세한 내용은 [Fly.io 가격](https://fly.io/docs/about/pricing/)을 참고합니다.
