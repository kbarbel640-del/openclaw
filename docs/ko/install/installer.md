---
summary: "설치 프로그램 스크립트(install.sh + install-cli.sh)가 동작하는 방식, 플래그, 자동화"
read_when:
  - "`openclaw.ai/install.sh`를 이해하고 싶습니다"
  - "설치를 자동화(CI / 헤드리스)하고 싶습니다"
  - "GitHub 체크아웃에서 설치하고 싶습니다"
title: "설치 프로그램 내부"
x-i18n:
  source_path: install/installer.md
  source_hash: 9e0a19ecb5da0a39
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:42Z
---

# 설치 프로그램 내부

OpenClaw 는 두 개의 설치 프로그램 스크립트(`openclaw.ai`에서 제공됨)를 제공합니다:

- `https://openclaw.ai/install.sh` — "권장" 설치 프로그램(기본값은 전역 npm 설치; GitHub 체크아웃에서 설치할 수도 있습니다)
- `https://openclaw.ai/install-cli.sh` — 루트 권한 없이 사용하기 좋은 CLI 설치 프로그램(자체 Node 를 포함한 prefix 에 설치)
- `https://openclaw.ai/install.ps1` — Windows PowerShell 설치 프로그램(기본값은 npm; 선택적으로 git 설치)

현재 플래그/동작을 확인하려면 다음을 실행합니다:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Windows (PowerShell) 도움말:

```powershell
& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -?
```

설치 프로그램이 완료되었지만 새 터미널에서 `openclaw` 을(를) 찾지 못한다면, 보통 Node/npm PATH 문제입니다. 참고: [Install](/install#nodejs--npm-path-sanity).

## install.sh (권장)

수행하는 작업(상위 수준):

- OS 감지(macOS / Linux / WSL).
- Node.js **22+** 보장(macOS 는 Homebrew, Linux 는 NodeSource).
- 설치 방법 선택:
  - `npm` (기본값): `npm install -g openclaw@latest`
  - `git`: 소스 체크아웃을 clone/build 하고 래퍼 스크립트를 설치
- Linux 에서: 필요 시 npm prefix 를 `~/.npm-global` 로 전환하여 전역 npm 권한 오류를 방지합니다.
- 기존 설치를 업그레이드하는 경우: `openclaw doctor --non-interactive` 을 실행합니다(최선의 노력).
- git 설치의 경우: 설치/업데이트 후 `openclaw doctor --non-interactive` 을 실행합니다(최선의 노력).
- 기본값을 `SHARP_IGNORE_GLOBAL_LIBVIPS=1` 로 하여 `sharp` 네이티브 설치의 함정을 완화합니다(시스템 libvips 에 대해 빌드하는 것을 피함).

`sharp` 이(가) 전역으로 설치된 libvips 에 링크되도록 하려면(또는 디버깅 중이라면), 다음을 설정합니다:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=0 curl -fsSL https://openclaw.ai/install.sh | bash
```

### 검색 가능성 / "git 설치" 프롬프트

설치 프로그램을 **이미 OpenClaw 소스 체크아웃 내부에서 실행**하면(`package.json` + `pnpm-workspace.yaml` 로 감지), 다음을 프롬프트로 묻습니다:

- 이 체크아웃을 업데이트하고 사용(`git`)
- 또는 전역 npm 설치로 마이그레이션(`npm`)

비대화형 컨텍스트(TTY 없음 / `--no-prompt`)에서는 `--install-method git|npm` 을 전달(또는 `OPENCLAW_INSTALL_METHOD` 설정)해야 하며, 그렇지 않으면 스크립트가 코드 `2` 로 종료됩니다.

### Git 이 필요한 이유

Git 은 `--install-method git` 경로(clone / pull)에 필요합니다.

`npm` 설치의 경우 Git 이 _대개_ 필요하지 않지만, 일부 환경에서는 결국 필요해질 수 있습니다(예: 패키지 또는 의존성이 git URL 로 가져와지는 경우). 설치 프로그램은 현재 Git 이 존재하도록 보장하여, 새로운 배포판에서 `spawn git ENOENT` 같은 예기치 못한 상황을 피합니다.

### 신선한 Linux 에서 npm 이 `EACCES` 를 건드리는 이유

일부 Linux 설정(특히 시스템 패키지 매니저 또는 NodeSource 로 Node 를 설치한 뒤)에서는 npm 의 전역 prefix 가 루트 소유 위치를 가리킵니다. 그러면 `npm install -g ...` 이(가) `EACCES` / `mkdir` 권한 오류로 실패합니다.

`install.sh` 은(는) prefix 를 다음으로 전환하여 이를 완화합니다:

- `~/.npm-global` (그리고 존재하는 경우 `~/.bashrc` / `~/.zshrc` 의 `PATH` 에 추가)

## install-cli.sh (루트 권한 없는 CLI 설치 프로그램)

이 스크립트는 `openclaw` 을(를) prefix(기본값: `~/.openclaw`)에 설치하고, 해당 prefix 아래에 전용 Node 런타임도 설치하므로, 시스템 Node/npm 을 건드리고 싶지 않은 머신에서도 동작할 수 있습니다.

도움말:

```bash
curl -fsSL https://openclaw.ai/install-cli.sh | bash -s -- --help
```

## install.ps1 (Windows PowerShell)

수행하는 작업(상위 수준):

- Node.js **22+** 보장(winget/Chocolatey/Scoop 또는 수동).
- 설치 방법 선택:
  - `npm` (기본값): `npm install -g openclaw@latest`
  - `git`: 소스 체크아웃을 clone/build 하고 래퍼 스크립트를 설치
- 업그레이드 및 git 설치에서 `openclaw doctor --non-interactive` 을 실행합니다(최선의 노력).

예시:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git -GitDir "C:\\openclaw"
```

환경 변수:

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`

Git 요구 사항:

`-InstallMethod git` 을(를) 선택했는데 Git 이 없다면, 설치 프로그램은
Git for Windows 링크(`https://git-scm.com/download/win`)를 출력하고 종료합니다.

일반적인 Windows 문제:

- **npm error spawn git / ENOENT**: Git for Windows 를 설치하고 PowerShell 을 다시 연 다음, 설치 프로그램을 다시 실행합니다.
- **"openclaw" is not recognized**: npm 전역 bin 폴더가 PATH 에 없습니다. 대부분의 시스템은
  `%AppData%\\npm` 을 사용합니다. 또한 `npm config get prefix` 을 실행하고 `\\bin` 을 PATH 에 추가한 뒤 PowerShell 을 다시 열 수 있습니다.
