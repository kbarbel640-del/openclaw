---
summary: "OpenClaw 를 위한 고급 설정 및 개발 워크플로"
read_when:
  - 새 머신을 설정할 때
  - 개인 설정을 망가뜨리지 않으면서 “최신 + 최고의” 구성을 원할 때
title: "설정"
x-i18n:
  source_path: start/setup.md
  source_hash: 6620daddff099dc0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:43Z
---

# 설정

<Note>
처음 설정하는 경우 [시작하기](/start/getting-started)부터 시작하십시오.
마법사에 대한 자세한 내용은 [온보딩 마법사](/start/wizard)를 참조하십시오.
</Note>

마지막 업데이트: 2026-01-01

## TL;DR

- **커스터마이징은 저장소 밖에 둡니다:** `~/.openclaw/workspace` (workspace) + `~/.openclaw/openclaw.json` (config).
- **안정적인 워크플로:** macOS 앱을 설치하고, 번들된 Gateway 를 실행하도록 둡니다.
- **최신 워크플로:** `pnpm gateway:watch` 로 Gateway 를 직접 실행한 다음, macOS 앱을 Local 모드로 연결합니다.

## 사전 요구 사항 (소스 기준)

- Node `>=22`
- `pnpm`
- Docker (선택 사항; 컨테이너 기반 설정/e2e 에서만 사용 — [Docker](/install/docker) 참조)

## 커스터마이징 전략 (업데이트로 인해 문제가 생기지 않도록)

“나에게 100% 맞춘 설정”과 쉬운 업데이트를 모두 원한다면, 사용자 정의는 다음 위치에 보관하십시오:

- **Config:** `~/.openclaw/openclaw.json` (JSON/JSON5 유사)
- **Workspace:** `~/.openclaw/workspace` (skills, 프롬프트, 메모리; 개인 git 저장소로 유지)

초기 부트스트랩은 한 번만 수행합니다:

```bash
openclaw setup
```

이 저장소 내부에서 로컬 CLI 엔트리를 사용하십시오:

```bash
openclaw setup
```

아직 전역 설치가 없다면 `pnpm openclaw setup` 로 실행하십시오.

## 이 저장소에서 Gateway 실행

`pnpm build` 이후에는 패키징된 CLI 를 직접 실행할 수 있습니다:

```bash
node openclaw.mjs gateway --port 18789 --verbose
```

## 안정적인 워크플로 (macOS 앱 우선)

1. **OpenClaw.app** 을 설치하고 실행합니다 (메뉴 바).
2. 온보딩/권한 체크리스트 (TCC 프롬프트)를 완료합니다.
3. Gateway 가 **Local** 로 설정되어 있고 실행 중인지 확인합니다 (앱이 관리합니다).
4. 표면을 연결합니다 (예: WhatsApp):

```bash
openclaw channels login
```

5. 정상 동작 확인:

```bash
openclaw health
```

현재 빌드에서 온보딩을 사용할 수 없는 경우:

- `openclaw setup` 을 실행한 다음 `openclaw channels login` 을 실행하고, 이후 Gateway 를 수동으로 시작하십시오 (`openclaw gateway`).

## 최신 워크플로 (터미널에서 Gateway 실행)

목표: TypeScript Gateway 를 작업하면서 핫 리로드를 사용하고, macOS 앱 UI 를 연결된 상태로 유지합니다.

### 0) (선택 사항) macOS 앱도 소스에서 실행

macOS 앱도 최신 상태로 사용하려면:

```bash
./scripts/restart-mac.sh
```

### 1) 개발용 Gateway 시작

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` 은 watch 모드로 gateway 를 실행하며 TypeScript 변경 시 다시 로드합니다.

### 2) macOS 앱을 실행 중인 Gateway 에 연결

**OpenClaw.app** 에서:

- 연결 모드: **Local**
  앱은 설정된 포트에서 실행 중인 gateway 에 연결합니다.

### 3) 확인

- 앱 내 Gateway 상태가 **“Using existing gateway …”** 로 표시되어야 합니다.
- 또는 CLI 를 통해 확인:

```bash
openclaw health
```

### 흔한 실수

- **잘못된 포트:** Gateway WS 기본값은 `ws://127.0.0.1:18789` 입니다; 앱과 CLI 를 동일한 포트로 유지하십시오.
- **상태 저장 위치:**
  - 자격 증명: `~/.openclaw/credentials/`
  - 세션: `~/.openclaw/agents/<agentId>/sessions/`
  - 로그: `/tmp/openclaw/`

## 자격 증명 저장 맵

인증 문제를 디버깅하거나 백업 대상을 결정할 때 사용하십시오:

- **WhatsApp**: `~/.openclaw/credentials/whatsapp/<accountId>/creds.json`
- **Telegram 봇 토큰**: config/env 또는 `channels.telegram.tokenFile`
- **Discord 봇 토큰**: config/env (토큰 파일은 아직 지원되지 않음)
- **Slack 토큰**: config/env (`channels.slack.*`)
- **페어링 허용 목록**: `~/.openclaw/credentials/<channel>-allowFrom.json`
- **모델 인증 프로파일**: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- **레거시 OAuth 가져오기**: `~/.openclaw/credentials/oauth.json`
  자세한 내용은 [Security](/gateway/security#credential-storage-map)를 참조하십시오.

## 업데이트 (설정을 망가뜨리지 않고)

- `~/.openclaw/workspace` 와 `~/.openclaw/` 을 “사용자 영역”으로 유지하고, 개인 프롬프트/설정을 `openclaw` 저장소에 넣지 마십시오.
- 소스 업데이트: `git pull` + `pnpm install` (lockfile 이 변경된 경우) + 계속해서 `pnpm gateway:watch` 을 사용하십시오.

## Linux (systemd 사용자 서비스)

Linux 설치는 systemd **user** 서비스를 사용합니다. 기본적으로 systemd 는 로그아웃/유휴 상태에서 사용자 서비스를 중지하며, 이로 인해 Gateway 가 종료됩니다. 온보딩 과정에서 lingering 을 활성화하려고 시도합니다 (sudo 를 요청할 수 있음). 여전히 비활성화되어 있다면 다음을 실행하십시오:

```bash
sudo loginctl enable-linger $USER
```

항상 실행되거나 다중 사용자 서버의 경우, 사용자 서비스 대신 **system** 서비스를 고려하십시오 (lingering 불필요). systemd 관련 내용은 [Gateway runbook](/gateway)을 참조하십시오.

## 관련 문서

- [Gateway runbook](/gateway) (플래그, 감독, 포트)
- [Gateway configuration](/gateway/configuration) (설정 스키마 + 예제)
- [Discord](/channels/discord) 및 [Telegram](/channels/telegram) (답장 태그 + replyToMode 설정)
- [OpenClaw assistant setup](/start/openclaw)
- [macOS app](/platforms/macos) (gateway 수명 주기)
