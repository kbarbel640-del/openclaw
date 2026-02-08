---
title: "Node.js + npm (PATH 정상 상태 점검)"
summary: "Node.js + npm 설치 정상 상태 점검: 버전, PATH, 전역 설치"
read_when:
  - "OpenClaw 를 설치했지만 `openclaw` 가 “command not found” 로 나옵니다"
  - "새 머신에서 Node.js/npm 을 설정하고 있습니다"
  - "npm install -g ... 가 권한 또는 PATH 문제로 실패합니다"
x-i18n:
  source_path: install/node.md
  source_hash: 9f6d83be362e3e14
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:44Z
---

# Node.js + npm (PATH 정상 상태 점검)

OpenClaw 의 런타임 기준선은 **Node 22+** 입니다.

`npm install -g openclaw@latest` 는 실행할 수 있지만 나중에 `openclaw: command not found` 를 보게 된다면, 거의 항상 **PATH** 문제입니다. 즉, npm 이 전역 바이너리를 두는 디렉토리가 셸의 PATH 에 포함되어 있지 않습니다.

## 빠른 진단

다음을 실행합니다:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

`$(npm prefix -g)/bin` (macOS/Linux) 또는 `$(npm prefix -g)` (Windows) 가 `echo "$PATH"` 안에 **없다면**, 셸이 전역 npm 바이너리( `openclaw` 포함)를 찾을 수 없습니다.

## 해결: npm 전역 bin 디렉토리를 PATH 에 추가

1. npm 전역 prefix 를 찾습니다:

```bash
npm prefix -g
```

2. 전역 npm bin 디렉토리를 셸 시작 파일에 추가합니다:

- zsh: `~/.zshrc`
- bash: `~/.bashrc`

예시(경로는 `npm prefix -g` 출력으로 바꾸십시오):

```bash
# macOS / Linux
export PATH="/path/from/npm/prefix/bin:$PATH"
```

그런 다음 **새 터미널**을 여십시오(또는 zsh 에서는 `rehash`, bash 에서는 `hash -r` 를 실행하십시오).

Windows 에서는 `npm prefix -g` 출력 값을 PATH 에 추가하십시오.

## 해결: `sudo npm install -g` / 권한 오류 피하기(Linux)

`npm install -g ...` 가 `EACCES` 와 함께 실패한다면, npm 전역 prefix 를 사용자 쓰기 가능한 디렉토리로 변경하십시오:

```bash
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

셸 시작 파일에 `export PATH=...` 줄을 영구적으로 유지하십시오.

## 권장 Node 설치 옵션

Node/npm 을 다음과 같은 방식으로 설치하면 예상치 못한 문제가 가장 적습니다:

- Node 를 최신 상태(22+)로 유지
- 전역 npm bin 디렉토리가 안정적이며 새 셸에서도 PATH 에 포함되도록 함

일반적인 선택지는 다음과 같습니다:

- macOS: Homebrew (`brew install node`) 또는 버전 관리자
- Linux: 선호하는 버전 관리자, 또는 Node 22+ 를 제공하는 배포판 지원 설치
- Windows: 공식 Node 설치 프로그램, `winget`, 또는 Windows 용 Node 버전 관리자

버전 관리자(nvm/fnm/asdf 등)를 사용하는 경우, 일상적으로 사용하는 셸(zsh vs bash)에서 초기화되도록 설정하여, 설치 프로그램을 실행할 때 설정되는 PATH 가 존재하도록 하십시오.
