---
summary: "OpenClaw 설치(권장 설치 프로그램, 전역 설치 또는 소스에서 설치)"
read_when:
  - OpenClaw 설치
  - GitHub 에서 설치하려는 경우
title: "설치 개요"
x-i18n:
  source_path: install/index.md
  source_hash: 228056bb0a2176b8
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:30Z
---

# 설치 개요

특별한 이유가 없다면 설치 프로그램을 사용합니다. 설치 프로그램은 CLI 를 설정하고 온보딩을 실행합니다.

## 빠른 설치(권장)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Windows(PowerShell):

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

다음 단계(온보딩을 건너뛰었다면):

```bash
openclaw onboard --install-daemon
```

## 시스템 요구 사항

- **Node >=22**
- macOS, Linux 또는 WSL2 를 통한 Windows
- 소스에서 빌드하는 경우에만 `pnpm`

## 설치 경로 선택

### 1) 설치 프로그램 스크립트(권장)

npm 을 통해 `openclaw` 를 전역으로 설치하고 온보딩을 실행합니다.

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

설치 프로그램 플래그:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

자세한 내용은 [Installer internals](/install/installer) 를 참고합니다.

비대화형(온보딩 건너뛰기):

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

### 2) 전역 설치(수동)

이미 Node 가 있다면:

```bash
npm install -g openclaw@latest
```

전역으로 libvips 가 설치되어 있고(macOS 에서는 Homebrew 로 흔함) `sharp` 설치에 실패한다면, 프리빌트 바이너리를 강제합니다:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
```

`sharp: Please add node-gyp to your dependencies` 가 보이면, 빌드 도구(macOS: Xcode CLT + `npm install -g node-gyp`)를 설치하거나 위의 `SHARP_IGNORE_GLOBAL_LIBVIPS=1` 우회 방법을 사용해 네이티브 빌드를 건너뜁니다.

또는 pnpm 사용:

```bash
pnpm add -g openclaw@latest
pnpm approve-builds -g                # approve openclaw, node-llama-cpp, sharp, etc.
```

pnpm 은 빌드 스크립트가 있는 패키지에 대해 명시적 승인이 필요합니다. 첫 설치에서 "Ignored build scripts" 경고가 표시되면, `pnpm approve-builds -g` 를 실행하고 목록에 있는 패키지를 선택합니다.

그다음:

```bash
openclaw onboard --install-daemon
```

### 3) 소스에서 설치(기여자/개발자)

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard --install-daemon
```

팁: 아직 전역 설치가 없다면, `pnpm openclaw ...` 를 통해 저장소 명령을 실행합니다.

더 심화된 개발 워크플로는 [Setup](/start/setup) 를 참고합니다.

### 4) 기타 설치 옵션

- Docker: [Docker](/install/docker)
- Nix: [Nix](/install/nix)
- Ansible: [Ansible](/install/ansible)
- Bun(CLI 전용): [Bun](/install/bun)

## 설치 후

- 온보딩 실행: `openclaw onboard --install-daemon`
- 빠른 확인: `openclaw doctor`
- Gateway(게이트웨이) 상태 확인: `openclaw status` + `openclaw health`
- 대시보드 열기: `openclaw dashboard`

## 설치 방법: npm vs git(설치 프로그램)

설치 프로그램은 두 가지 방법을 지원합니다:

- `npm`(기본값): `npm install -g openclaw@latest`
- `git`: GitHub 에서 클론/빌드하고 소스 체크아웃에서 실행

### CLI 플래그

```bash
# Explicit npm
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm

# Install from GitHub (source checkout)
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

일반적인 플래그:

- `--install-method npm|git`
- `--git-dir <path>`(기본값: `~/openclaw`)
- `--no-git-update`(기존 체크아웃을 사용할 때 `git pull` 건너뛰기)
- `--no-prompt`(프롬프트 비활성화; CI/자동화에서 필요)
- `--dry-run`(무슨 일이 일어날지 출력; 변경 없음)
- `--no-onboard`(온보딩 건너뛰기)

### 환경 변수

동등한 환경 변수(자동화에 유용):

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`
- `OPENCLAW_GIT_UPDATE=0|1`
- `OPENCLAW_NO_PROMPT=1`
- `OPENCLAW_DRY_RUN=1`
- `OPENCLAW_NO_ONBOARD=1`
- `SHARP_IGNORE_GLOBAL_LIBVIPS=0|1`(기본값: `1`; 시스템 libvips 에 대해 `sharp` 가 빌드되는 것을 방지)

## 문제 해결: `openclaw` 를 찾을 수 없음(PATH)

빠른 진단:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

`echo "$PATH"` 안에 `$(npm prefix -g)/bin`(macOS/Linux) 또는 `$(npm prefix -g)`(Windows)가 **없다면**, 셸이 전역 npm 바이너리(`openclaw` 포함)를 찾을 수 없습니다.

해결: 셸 시작 파일(zsh: `~/.zshrc`, bash: `~/.bashrc`)에 추가합니다:

```bash
# macOS / Linux
export PATH="$(npm prefix -g)/bin:$PATH"
```

Windows 에서는 `npm prefix -g` 출력 값을 PATH 에 추가합니다.

그다음 새 터미널을 열거나(zsh 에서는 `rehash` / bash 에서는 `hash -r`)를 실행합니다.

## 업데이트 / 제거

- 업데이트: [Updating](/install/updating)
- 새 머신으로 마이그레이션: [Migrating](/install/migrating)
- 제거: [Uninstall](/install/uninstall)
