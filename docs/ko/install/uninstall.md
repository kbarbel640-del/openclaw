---
summary: "OpenClaw 를 완전히 제거하기 (CLI, 서비스, 상태, 워크스페이스)"
read_when:
  - 머신에서 OpenClaw 를 제거하려는 경우
  - 제거 후에도 Gateway(게이트웨이) 서비스가 계속 실행되는 경우
title: "제거"
x-i18n:
  source_path: install/uninstall.md
  source_hash: 6673a755c5e1f90a
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:10Z
---

# 제거

두 가지 경로가 있습니다:

- `openclaw` 이(가) 아직 설치되어 있다면 **쉬운 경로**를 사용합니다.
- CLI 는 없지만 서비스가 계속 실행 중이라면 **수동 서비스 제거**를 사용합니다.

## 쉬운 경로 (CLI 가 아직 설치되어 있음)

권장: 내장 제거 프로그램을 사용합니다:

```bash
openclaw uninstall
```

비대화형 (자동화 / npx):

```bash
openclaw uninstall --all --yes --non-interactive
npx -y openclaw uninstall --all --yes --non-interactive
```

수동 단계 (동일한 결과):

1. Gateway(게이트웨이) 서비스를 중지합니다:

```bash
openclaw gateway stop
```

2. Gateway(게이트웨이) 서비스를 제거합니다 (launchd/systemd/schtasks):

```bash
openclaw gateway uninstall
```

3. 상태 + 설정을 삭제합니다:

```bash
rm -rf "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
```

`OPENCLAW_CONFIG_PATH` 을(를) 상태 디렉토리 바깥의 사용자 지정 위치로 설정했다면, 해당 파일도 삭제합니다.

4. 워크스페이스를 삭제합니다 (선택 사항, 에이전트 파일 제거):

```bash
rm -rf ~/.openclaw/workspace
```

5. CLI 설치를 제거합니다 (사용한 방법을 선택합니다):

```bash
npm rm -g openclaw
pnpm remove -g openclaw
bun remove -g openclaw
```

6. macOS 앱을 설치했다면:

```bash
rm -rf /Applications/OpenClaw.app
```

참고:

- 프로필(`--profile` / `OPENCLAW_PROFILE`)을 사용했다면, 각 상태 디렉토리에 대해 3단계를 반복합니다(기본값은 `~/.openclaw-<profile>`).
- 원격 모드에서는 상태 디렉토리가 **Gateway(게이트웨이) 호스트**에 있으므로, 그곳에서도 1-4단계를 실행합니다.

## 수동 서비스 제거 (CLI 가 설치되지 않음)

Gateway(게이트웨이) 서비스가 계속 실행되지만 `openclaw` 이(가) 없는 경우에 사용합니다.

### macOS (launchd)

기본 라벨은 `bot.molt.gateway` (또는 `bot.molt.<profile>`; 레거시 `com.openclaw.*` 이(가) 여전히 존재할 수 있음)입니다:

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

프로필을 사용했다면, 라벨과 plist 이름을 `bot.molt.<profile>` 으로 바꿉니다. 존재한다면 레거시 `com.openclaw.*` plist 도 모두 제거합니다.

### Linux (systemd 사용자 유닛)

기본 유닛 이름은 `openclaw-gateway.service` (또는 `openclaw-gateway-<profile>.service`)입니다:

```bash
systemctl --user disable --now openclaw-gateway.service
rm -f ~/.config/systemd/user/openclaw-gateway.service
systemctl --user daemon-reload
```

### Windows (예약된 작업)

기본 작업 이름은 `OpenClaw Gateway` (또는 `OpenClaw Gateway (<profile>)`)입니다.
작업 스크립트는 상태 디렉토리 아래에 있습니다.

```powershell
schtasks /Delete /F /TN "OpenClaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.openclaw\gateway.cmd"
```

프로필을 사용했다면, 일치하는 작업 이름과 `~\.openclaw-<profile>\gateway.cmd` 을(를) 삭제합니다.

## 일반 설치 vs 소스 체크아웃

### 일반 설치 (install.sh / npm / pnpm / bun)

`https://openclaw.ai/install.sh` 또는 `install.ps1` 을(를) 사용했다면, CLI 는 `npm install -g openclaw@latest` 로 설치되었습니다.
`npm rm -g openclaw` 로 제거합니다(또는 해당 방식으로 설치했다면 `pnpm remove -g` / `bun remove -g`).

### 소스 체크아웃 (git clone)

리포지토리 체크아웃(`git clone` + `openclaw ...` / `bun run openclaw ...`)에서 실행한다면:

1. 리포지토리를 삭제하기 **전에** Gateway(게이트웨이) 서비스를 제거합니다(위의 쉬운 경로 또는 수동 서비스 제거 사용).
2. 리포지토리 디렉토리를 삭제합니다.
3. 위에 표시된 대로 상태 + 워크스페이스를 제거합니다.
