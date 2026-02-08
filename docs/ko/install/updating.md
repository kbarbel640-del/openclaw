---
summary: "OpenClaw 를 안전하게 업데이트하는 방법(전역 설치 또는 소스), 그리고 롤백 전략"
read_when:
  - OpenClaw 업데이트
  - 업데이트 후 문제가 발생함
title: "업데이트"
x-i18n:
  source_path: install/updating.md
  source_hash: 38cccac0839f0f22
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:56Z
---

# 업데이트

OpenClaw 는 (“1.0” 이전의) 빠른 개발 단계에 있습니다. 업데이트는 인프라 배포처럼 다루십시오: 업데이트 → 점검 실행 → 재시작(또는 재시작을 수행하는 `openclaw update` 사용) → 검증.

## 권장: 웹사이트 설치 프로그램을 다시 실행(제자리 업그레이드)

**권장되는** 업데이트 경로는 웹사이트의 설치 프로그램을 다시 실행하는 것입니다. 이 설치 프로그램은 기존 설치를 감지하고 제자리에서 업그레이드하며, 필요할 때 `openclaw doctor` 를 실행합니다.

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

참고:

- 온보딩 마법사가 다시 실행되지 않게 하려면 `--no-onboard` 를 추가하십시오.
- **소스 설치**의 경우 다음을 사용하십시오:
  ```bash
  curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
  ```
  설치 프로그램은 리포지토리가 깨끗한 경우에만 `git pull --rebase` 를 수행합니다.
- **전역 설치**의 경우 스크립트가 내부적으로 `npm install -g openclaw@latest` 를 사용합니다.
- 레거시 참고: `clawdbot` 는 호환성 시임으로 계속 제공됩니다.

## 업데이트하기 전에

- 설치 방식을 파악하십시오: **전역**(npm/pnpm) vs **소스에서**(git clone).
- Gateway(게이트웨이) 실행 방식을 파악하십시오: **포그라운드 터미널** vs **감시되는 서비스**(launchd/systemd).
- 커스터마이징 스냅샷을 남기십시오:
  - 설정: `~/.openclaw/openclaw.json`
  - 자격 증명: `~/.openclaw/credentials/`
  - 워크스페이스: `~/.openclaw/workspace`

## 업데이트(전역 설치)

전역 설치(하나 선택):

```bash
npm i -g openclaw@latest
```

```bash
pnpm add -g openclaw@latest
```

Gateway(게이트웨이) 런타임으로 Bun 사용은 **권장하지 않습니다**(WhatsApp/Telegram 버그).

업데이트 채널을 전환하려면(git + npm 설치):

```bash
openclaw update --channel beta
openclaw update --channel dev
openclaw update --channel stable
```

일회성 설치 태그/버전에는 `--tag <dist-tag|version>` 를 사용하십시오.

채널 의미와 릴리스 노트는 [Development channels](/install/development-channels) 를 참고하십시오.

참고: npm 설치에서는 게이트웨이가 시작 시 업데이트 힌트를 로그로 남깁니다(현재 채널 태그 확인). `update.checkOnStart: false` 로 비활성화할 수 있습니다.

그다음:

```bash
openclaw doctor
openclaw gateway restart
openclaw health
```

참고:

- Gateway(게이트웨이)가 서비스로 실행 중이면 PID 를 강제로 종료하는 것보다 `openclaw gateway restart` 를 사용하는 편이 좋습니다.
- 특정 버전에 고정되어 있다면 아래 “롤백 / 고정”을 참고하십시오.

## 업데이트(`openclaw update`)

**소스 설치**(git checkout)의 경우 다음을 권장합니다:

```bash
openclaw update
```

이는 다소 안전한 업데이트 플로우를 실행합니다:

- 깨끗한 worktree 가 필요합니다.
- 선택한 채널(태그 또는 브랜치)로 전환합니다.
- 설정된 업스트림(dev 채널)에 대해 fetch + rebase 를 수행합니다.
- 의존성을 설치하고, 빌드하고, Control UI 를 빌드하며, `openclaw doctor` 를 실행합니다.
- 기본적으로 게이트웨이를 재시작합니다(건너뛰려면 `--no-restart` 사용).

**npm/pnpm** 으로 설치한 경우(git 메타데이터 없음) `openclaw update` 이 패키지 매니저를 통해 업데이트를 시도합니다. 설치를 감지할 수 없으면 대신 “업데이트(전역 설치)”를 사용하십시오.

## 업데이트(Control UI / RPC)

Control UI 에는 **Update & Restart**(RPC: `update.run`)가 있습니다. 이는:

1. `openclaw update` 와 동일한 소스 업데이트 플로우를 실행합니다(git checkout 전용).
2. 구조화된 보고서(stdout/stderr tail 포함)와 함께 재시작 센티넬을 기록합니다.
3. 게이트웨이를 재시작하고, 마지막으로 활성화된 세션에 보고서를 핑합니다.

rebase 가 실패하면 게이트웨이는 업데이트 적용을 중단하고, 업데이트를 적용하지 않은 채로 재시작합니다.

## 업데이트(소스에서)

리포지토리 checkout 에서:

권장:

```bash
openclaw update
```

수동(대략 동등):

```bash
git pull
pnpm install
pnpm build
pnpm ui:build # auto-installs UI deps on first run
openclaw doctor
openclaw health
```

참고:

- `pnpm build` 는 패키징된 `openclaw` 바이너리([`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs))를 실행하거나, Node 로 `dist/` 를 실행할 때 중요합니다.
- 전역 설치 없이 리포지토리 checkout 에서 실행하는 경우 CLI 명령에는 `pnpm openclaw ...` 를 사용하십시오.
- TypeScript(`pnpm openclaw ...`)에서 직접 실행한다면 보통 리빌드는 불필요하지만, **설정 마이그레이션은 여전히 적용됩니다** → doctor 를 실행하십시오.
- 전역 설치와 git 설치 간 전환은 쉽습니다: 다른 형태를 설치한 다음 `openclaw doctor` 를 실행하여 게이트웨이 서비스 엔트리포인트가 현재 설치를 가리키도록 다시 씁니다.

## 항상 실행: `openclaw doctor`

Doctor 는 “안전 업데이트” 명령입니다. 의도적으로 단조롭게 설계되어 있습니다: 복구 + 마이그레이션 + 경고.

참고: **소스 설치**(git checkout)인 경우 `openclaw doctor` 는 먼저 `openclaw update` 를 실행할지 제안합니다.

일반적으로 수행하는 작업:

- 더 이상 사용되지 않는 설정 키 / 레거시 설정 파일 위치를 마이그레이션합니다.
- 다이렉트 메시지 정책을 감사하고 위험한 “open” 설정에 대해 경고합니다.
- Gateway(게이트웨이) 상태를 점검하고 재시작을 제안할 수 있습니다.
- 오래된 게이트웨이 서비스(launchd/systemd; 레거시 schtasks)를 감지하고 현재 OpenClaw 서비스로 마이그레이션합니다.
- Linux 에서 systemd 사용자 lingering 을 보장합니다(로그아웃 후에도 Gateway(게이트웨이)가 유지되도록).

자세한 내용은: [Doctor](/gateway/doctor)

## Gateway(게이트웨이) 시작 / 중지 / 재시작

CLI(OS 와 무관하게 동작):

```bash
openclaw gateway status
openclaw gateway stop
openclaw gateway restart
openclaw gateway --port 18789
openclaw logs --follow
```

감시되는 환경이라면:

- macOS launchd(앱 번들 LaunchAgent): `launchctl kickstart -k gui/$UID/bot.molt.gateway`(`bot.molt.<profile>` 사용; 레거시 `com.openclaw.*` 도 여전히 동작)
- Linux systemd 사용자 서비스: `systemctl --user restart openclaw-gateway[-<profile>].service`
- Windows(WSL2): `systemctl --user restart openclaw-gateway[-<profile>].service`
  - `launchctl`/`systemctl` 는 서비스가 설치된 경우에만 동작합니다. 그렇지 않으면 `openclaw gateway install` 을 실행하십시오.

런북 + 정확한 서비스 레이블: [Gateway runbook](/gateway)

## 롤백 / 고정(문제가 발생했을 때)

### 고정(전역 설치)

정상 동작하는 버전을 설치하십시오(`<version>` 를 마지막으로 동작했던 값으로 교체):

```bash
npm i -g openclaw@<version>
```

```bash
pnpm add -g openclaw@<version>
```

팁: 현재 배포된 버전을 확인하려면 `npm view openclaw version` 을 실행하십시오.

그다음 재시작 + doctor 재실행:

```bash
openclaw doctor
openclaw gateway restart
```

### 날짜 기준으로 고정(소스)

특정 날짜의 커밋을 선택하십시오(예: “2026-01-01 시점의 main 상태”):

```bash
git fetch origin
git checkout "$(git rev-list -n 1 --before=\"2026-01-01\" origin/main)"
```

그다음 의존성을 다시 설치하고 재시작하십시오:

```bash
pnpm install
pnpm build
openclaw gateway restart
```

나중에 최신으로 되돌리고 싶다면:

```bash
git checkout main
git pull
```

## 막혔다면

- `openclaw doctor` 를 다시 실행하고 출력을 주의 깊게 읽으십시오(대개 해결책이 안내됩니다).
- 확인: [문제 해결](/gateway/troubleshooting)
- Discord 에서 문의: https://discord.gg/clawd
