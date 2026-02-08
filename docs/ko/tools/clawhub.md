---
summary: "ClawHub 가이드: 공개 Skills 레지스트리 + CLI 워크플로"
read_when:
  - 신규 사용자에게 ClawHub 를 소개할 때
  - Skills 를 설치, 검색 또는 게시할 때
  - ClawHub CLI 플래그와 동기화 동작을 설명할 때
title: "ClawHub"
x-i18n:
  source_path: tools/clawhub.md
  source_hash: b572473a11246357
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:58Z
---

# ClawHub

ClawHub 는 **OpenClaw 를 위한 공개 Skills 레지스트리**입니다. 이는 무료 서비스이며, 모든 Skills 는 공개되어 있고 개방적이며 누구나 공유하고 재사용할 수 있습니다. Skill 은 `SKILL.md` 파일(및 보조 텍스트 파일들)을 포함한 하나의 폴더일 뿐입니다. 웹 앱에서 Skills 를 탐색하거나 CLI 를 사용하여 Skills 를 검색, 설치, 업데이트 및 게시할 수 있습니다.

사이트: [clawhub.ai](https://clawhub.ai)

## ClawHub 란 무엇인가

- OpenClaw Skills 를 위한 공개 레지스트리입니다.
- Skill 번들과 메타데이터를 버전 관리하여 저장합니다.
- 검색, 태그, 사용 신호를 위한 디바이스 검색 표면을 제공합니다.

## 동작 방식

1. 사용자가 Skill 번들(파일 + 메타데이터)을 게시합니다.
2. ClawHub 가 번들을 저장하고 메타데이터를 파싱한 뒤 버전을 할당합니다.
3. 레지스트리가 Skill 을 검색 및 디바이스 검색을 위해 인덱싱합니다.
4. 사용자는 OpenClaw 에서 Skills 를 탐색, 다운로드 및 설치합니다.

## 할 수 있는 작업

- 새로운 Skills 및 기존 Skills 의 새 버전을 게시합니다.
- 이름, 태그 또는 검색을 통해 Skills 를 발견합니다.
- Skill 번들을 다운로드하고 파일을 검토합니다.
- 악성 또는 안전하지 않은 Skills 를 신고합니다.
- 관리자인 경우 숨기기, 숨김 해제, 삭제 또는 차단을 수행할 수 있습니다.

## 대상 사용자 (초보자 친화적)

OpenClaw 에이전트에 새로운 기능을 추가하고 싶다면 ClawHub 는 Skills 를 찾고 설치하는 가장 쉬운 방법입니다. 백엔드가 어떻게 동작하는지 알 필요가 없습니다. 다음을 할 수 있습니다.

- 일반적인 언어로 Skills 를 검색합니다.
- 작업공간에 Skill 을 설치합니다.
- 하나의 명령으로 나중에 Skills 를 업데이트합니다.
- 자신의 Skills 를 게시하여 백업합니다.

## 빠른 시작 (비기술)

1. CLI 를 설치합니다(다음 섹션 참조).
2. 필요한 항목을 검색합니다:
   - `clawhub search "calendar"`
3. Skill 을 설치합니다:
   - `clawhub install <skill-slug>`
4. 새 Skill 이 반영되도록 새로운 OpenClaw 세션을 시작합니다.

## CLI 설치

다음 중 하나를 선택합니다:

```bash
npm i -g clawhub
```

```bash
pnpm add -g clawhub
```

## OpenClaw 에서의 위치

기본적으로 CLI 는 현재 작업 디렉토리 아래의 `./skills` 에 Skills 를 설치합니다. OpenClaw 작업공간이 설정되어 있다면, `clawhub` 는 `--workdir`(또는 `CLAWHUB_WORKDIR`)를 재정의하지 않는 한 해당 작업공간으로 폴백합니다. OpenClaw 는 `<workspace>/skills` 에서 작업공간 Skills 를 로드하며 **다음** 세션에서 이를 반영합니다. 이미 `~/.openclaw/skills` 또는 번들된 Skills 를 사용 중이라면, 작업공간 Skills 가 우선합니다.

Skills 가 어떻게 로드되고, 공유되며, 제한되는지에 대한 자세한 내용은
[Skills](/tools/skills)를 참고하십시오.

## Skill 시스템 개요

Skill 은 OpenClaw 에 특정 작업을 수행하는 방법을 가르치는 파일들의 버전 관리된 번들입니다. 게시할 때마다 새로운 버전이 생성되며, 레지스트리는 변경 사항을 감사할 수 있도록 버전 기록을 유지합니다.

일반적인 Skill 에는 다음이 포함됩니다.

- 주요 설명과 사용법이 포함된 `SKILL.md` 파일.
- Skill 에서 사용하는 선택적 설정, 스크립트 또는 보조 파일.
- 태그, 요약, 설치 요구 사항과 같은 메타데이터.

ClawHub 는 메타데이터를 사용하여 디바이스 검색을 강화하고 Skill 기능을 안전하게 노출합니다. 또한 레지스트리는 순위와 가시성을 개선하기 위해 별점 및 다운로드 수와 같은 사용 신호를 추적합니다.

## 서비스가 제공하는 것 (기능)

- Skills 및 해당 `SKILL.md` 콘텐츠의 **공개 탐색**.
- 키워드뿐 아니라 임베딩(벡터 검색) 기반의 **검색**.
- semver, 변경 로그, 태그(`latest` 포함)를 통한 **버전 관리**.
- 버전별 zip 형식의 **다운로드**.
- 커뮤니티 피드백을 위한 **별점 및 댓글**.
- 승인 및 감사를 위한 **모더레이션** 훅.
- 자동화 및 스크립팅을 위한 **CLI 친화적 API**.

## 보안 및 모더레이션

ClawHub 는 기본적으로 개방되어 있습니다. 누구나 Skills 를 업로드할 수 있지만, 게시하려면 GitHub 계정이 최소 1주 이상 경과되어야 합니다. 이는 정상적인 기여자를 차단하지 않으면서 남용을 늦추는 데 도움이 됩니다.

신고 및 모더레이션:

- 로그인한 사용자는 누구나 Skill 을 신고할 수 있습니다.
- 신고 사유는 필수이며 기록됩니다.
- 각 사용자는 동시에 최대 20개의 활성 신고를 가질 수 있습니다.
- 고유 신고가 3건을 초과한 Skills 는 기본적으로 자동 숨김 처리됩니다.
- 관리자는 숨겨진 Skills 를 보고, 숨김 해제, 삭제 또는 사용자 차단을 할 수 있습니다.
- 신고 기능을 남용할 경우 계정 차단으로 이어질 수 있습니다.

모더레이터가 되는 데 관심이 있습니까? OpenClaw Discord 에서 문의하고 모더레이터 또는 유지관리자에게 연락하십시오.

## CLI 명령 및 매개변수

전역 옵션(모든 명령에 적용):

- `--workdir <dir>`: 작업 디렉토리(기본값: 현재 디렉토리; OpenClaw 작업공간으로 폴백).
- `--dir <dir>`: 작업 디렉토리 기준 Skills 디렉토리(기본값: `skills`).
- `--site <url>`: 사이트 기본 URL(브라우저 로그인).
- `--registry <url>`: 레지스트리 API 기본 URL.
- `--no-input`: 프롬프트 비활성화(비대화형).
- `-V, --cli-version`: CLI 버전 출력.

인증:

- `clawhub login` (브라우저 플로) 또는 `clawhub login --token <token>`
- `clawhub logout`
- `clawhub whoami`

옵션:

- `--token <token>`: API 토큰을 붙여넣습니다.
- `--label <label>`: 브라우저 로그인 토큰에 저장되는 라벨(기본값: `CLI token`).
- `--no-browser`: 브라우저를 열지 않음(`--token` 필요).

검색:

- `clawhub search "query"`
- `--limit <n>`: 최대 결과 수.

설치:

- `clawhub install <slug>`
- `--version <version>`: 특정 버전을 설치합니다.
- `--force`: 폴더가 이미 존재하는 경우 덮어씁니다.

업데이트:

- `clawhub update <slug>`
- `clawhub update --all`
- `--version <version>`: 특정 버전으로 업데이트합니다(단일 슬러그만).
- `--force`: 로컬 파일이 게시된 어떤 버전과도 일치하지 않을 때 덮어씁니다.

목록:

- `clawhub list` (`.clawhub/lock.json` 을 읽음)

게시:

- `clawhub publish <path>`
- `--slug <slug>`: Skill 슬러그.
- `--name <name>`: 표시 이름.
- `--version <version>`: semver 버전.
- `--changelog <text>`: 변경 로그 텍스트(비워 둘 수 있음).
- `--tags <tags>`: 쉼표로 구분된 태그(기본값: `latest`).

삭제/복구(소유자/관리자 전용):

- `clawhub delete <slug> --yes`
- `clawhub undelete <slug> --yes`

동기화(로컬 Skills 스캔 + 신규/업데이트 게시):

- `clawhub sync`
- `--root <dir...>`: 추가 스캔 루트.
- `--all`: 프롬프트 없이 모두 업로드합니다.
- `--dry-run`: 업로드될 항목을 미리 표시합니다.
- `--bump <type>`: 업데이트 시 `patch|minor|major`(기본값: `patch`).
- `--changelog <text>`: 비대화형 업데이트를 위한 변경 로그.
- `--tags <tags>`: 쉼표로 구분된 태그(기본값: `latest`).
- `--concurrency <n>`: 레지스트리 검사(기본값: 4).

## 에이전트를 위한 일반적인 워크플로

### Skills 검색

```bash
clawhub search "postgres backups"
```

### 새로운 Skills 다운로드

```bash
clawhub install my-skill-pack
```

### 설치된 Skills 업데이트

```bash
clawhub update --all
```

### Skills 백업(게시 또는 동기화)

단일 Skill 폴더의 경우:

```bash
clawhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0 --tags latest
```

여러 Skills 를 한 번에 스캔하고 백업하려면:

```bash
clawhub sync --all
```

## 고급 세부 사항 (기술)

### 버전 관리 및 태그

- 각 게시마다 새로운 **semver** `SkillVersion` 이 생성됩니다.
- `latest` 와 같은 태그는 특정 버전을 가리키며, 태그를 이동하여 롤백할 수 있습니다.
- 변경 로그는 버전별로 연결되며, 동기화 또는 업데이트 게시 시 비워 둘 수 있습니다.

### 로컬 변경 사항과 레지스트리 버전

업데이트는 콘텐츠 해시를 사용하여 로컬 Skill 내용과 레지스트리 버전을 비교합니다. 로컬 파일이 게시된 어떤 버전과도 일치하지 않는 경우, CLI 는 덮어쓰기 전에 확인을 요청합니다(또는 비대화형 실행에서는 `--force` 가 필요합니다).

### 동기화 스캔 및 폴백 루트

`clawhub sync` 는 먼저 현재 작업 디렉토리를 스캔합니다. Skills 를 찾지 못하면 알려진 레거시 위치(예: `~/openclaw/skills` 및 `~/.openclaw/skills`)로 폴백합니다. 이는 추가 플래그 없이 이전 Skill 설치를 찾기 위해 설계되었습니다.

### 스토리지 및 락파일

- 설치된 Skills 는 작업 디렉토리 아래의 `.clawhub/lock.json` 에 기록됩니다.
- 인증 토큰은 ClawHub CLI 설정 파일에 저장됩니다(`CLAWHUB_CONFIG_PATH` 로 재정의 가능).

### 텔레메트리(설치 수)

로그인한 상태에서 `clawhub sync` 를 실행하면, CLI 는 설치 수 계산을 위해 최소한의 스냅샷을 전송합니다. 이를 완전히 비활성화할 수 있습니다:

```bash
export CLAWHUB_DISABLE_TELEMETRY=1
```

## 환경 변수

- `CLAWHUB_SITE`: 사이트 URL 을 재정의합니다.
- `CLAWHUB_REGISTRY`: 레지스트리 API URL 을 재정의합니다.
- `CLAWHUB_CONFIG_PATH`: CLI 가 토큰/설정을 저장하는 위치를 재정의합니다.
- `CLAWHUB_WORKDIR`: 기본 작업 디렉토리를 재정의합니다.
- `CLAWHUB_DISABLE_TELEMETRY=1`: `sync` 에서 텔레메트리를 비활성화합니다.
