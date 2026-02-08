---
summary: "한 머신에서 다른 머신으로 OpenClaw 설치를 이동(마이그레이션)합니다"
read_when:
  - 새 노트북/서버로 OpenClaw 를 옮기고 있습니다
  - 세션, 인증, 채널 로그인(WhatsApp 등)을 보존하고 싶습니다
title: "마이그레이션 가이드"
x-i18n:
  source_path: install/migrating.md
  source_hash: 604d862c4bf86e79
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:28Z
---

# 새 머신으로 OpenClaw 마이그레이션하기

이 가이드는 **온보딩을 다시 하지 않고** 한 머신에서 다른 머신으로 OpenClaw Gateway(게이트웨이)를 마이그레이션합니다.

마이그레이션은 개념적으로는 간단합니다:

- **상태 디렉토리**(`$OPENCLAW_STATE_DIR`, 기본값: `~/.openclaw/`)를 복사합니다 — 여기에는 설정, 인증, 세션, 채널 상태가 포함됩니다.
- **워크스페이스**(기본값: `~/.openclaw/workspace/`)를 복사합니다 — 여기에는 에이전트 파일(메모리, 프롬프트 등)이 포함됩니다.

하지만 **프로필**, **권한**, **부분 복사**와 관련된 흔한 함정이 있습니다.

## 시작하기 전에(무엇을 마이그레이션하는지)

### 1) 상태 디렉토리 식별하기

대부분의 설치는 기본값을 사용합니다:

- **상태 디렉토리:** `~/.openclaw/`

하지만 다음을 사용하는 경우 다를 수 있습니다:

- `--profile <name>` (종종 `~/.openclaw-<profile>/`로 바뀜)
- `OPENCLAW_STATE_DIR=/some/path`

확실하지 않다면 **기존** 머신에서 다음을 실행합니다:

```bash
openclaw status
```

출력에서 `OPENCLAW_STATE_DIR` / 프로필에 대한 언급을 찾으십시오. 여러 게이트웨이를 실행한다면 각 프로필에 대해 반복하십시오.

### 2) 워크스페이스 식별하기

일반적인 기본값:

- `~/.openclaw/workspace/` (권장 워크스페이스)
- 사용자가 만든 커스텀 폴더

워크스페이스는 `MEMORY.md`, `USER.md`, `memory/*.md` 같은 파일이 위치하는 곳입니다.

### 3) 무엇이 보존되는지 이해하기

상태 디렉토리와 워크스페이스를 **둘 다** 복사하면 다음이 유지됩니다:

- Gateway(게이트웨이) 설정(`openclaw.json`)
- 인증 프로필 / API 키 / OAuth 토큰
- 세션 히스토리 + 에이전트 상태
- 채널 상태(예: WhatsApp 로그인/세션)
- 워크스페이스 파일(메모리, Skills 노트 등)

워크스페이스만 **단독으로**(예: Git 으로) 복사하면 다음은 보존되지 **않습니다**:

- 세션
- 자격 증명
- 채널 로그인

이들은 `$OPENCLAW_STATE_DIR` 아래에 있습니다.

## 마이그레이션 단계(권장)

### Step 0 — 백업 만들기(기존 머신)

**기존** 머신에서, 복사 중 파일이 변경되지 않도록 먼저 게이트웨이를 중지합니다:

```bash
openclaw gateway stop
```

(선택 사항이지만 권장) 상태 디렉토리와 워크스페이스를 아카이브합니다:

```bash
# Adjust paths if you use a profile or custom locations
cd ~
tar -czf openclaw-state.tgz .openclaw

tar -czf openclaw-workspace.tgz .openclaw/workspace
```

여러 프로필/상태 디렉토리(예: `~/.openclaw-main`, `~/.openclaw-work`)가 있다면 각각 아카이브하십시오.

### Step 1 — 새 머신에 OpenClaw 설치하기

**새** 머신에서 CLI(필요 시 Node 포함)를 설치합니다:

- 참고: [Install](/install)

이 단계에서는 온보딩이 새 `~/.openclaw/`를 만들어도 괜찮습니다 — 다음 단계에서 덮어쓸 것입니다.

### Step 2 — 상태 디렉토리 + 워크스페이스를 새 머신으로 복사하기

다음을 **둘 다** 복사합니다:

- `$OPENCLAW_STATE_DIR`(기본값 `~/.openclaw/`)
- 워크스페이스(기본값 `~/.openclaw/workspace/`)

일반적인 방법:

- `scp` tarball 을 옮긴 뒤 추출
- `rsync -a` 로 SSH 를 통해 복사
- 외장 드라이브

복사 후 다음을 확인하십시오:

- 숨김 디렉토리가 포함되었는지(예: `.openclaw/`)
- 게이트웨이를 실행하는 사용자 기준으로 파일 소유권이 올바른지

### Step 3 — Doctor 실행(마이그레이션 + 서비스 복구)

**새** 머신에서:

```bash
openclaw doctor
```

Doctor 는 "안전하고 무난한" 명령입니다. 서비스 복구, 설정 마이그레이션 적용, 불일치 경고를 수행합니다.

그다음:

```bash
openclaw gateway restart
openclaw status
```

## 흔한 함정(그리고 피하는 방법)

### 함정: 프로필 / 상태 디렉토리 불일치

기존 게이트웨이를 프로필(또는 `OPENCLAW_STATE_DIR`)로 실행했고, 새 게이트웨이가 다른 것을 사용하면 다음과 같은 증상이 나타납니다:

- 설정 변경이 적용되지 않음
- 채널이 누락됨 / 로그아웃됨
- 세션 히스토리가 비어 있음

해결: 마이그레이션한 것과 **동일한** 프로필/상태 디렉토리를 사용하여 게이트웨이/서비스를 실행한 뒤, 다음을 다시 실행하십시오:

```bash
openclaw doctor
```

### 함정: `openclaw.json` 만 복사하기

`openclaw.json` 만으로는 충분하지 않습니다. 많은 프로바이더는 다음 아래에 상태를 저장합니다:

- `$OPENCLAW_STATE_DIR/credentials/`
- `$OPENCLAW_STATE_DIR/agents/<agentId>/...`

항상 전체 `$OPENCLAW_STATE_DIR` 폴더를 마이그레이션하십시오.

### 함정: 권한 / 소유권

root 로 복사했거나 사용자를 변경했다면, 게이트웨이가 자격 증명/세션을 읽지 못할 수 있습니다.

해결: 상태 디렉토리 + 워크스페이스가 게이트웨이를 실행하는 사용자가 소유하고 있는지 확인하십시오.

### 함정: 원격/로컬 모드 간 마이그레이션

- UI(WebUI/TUI)가 **원격** 게이트웨이를 가리키는 경우, 세션 저장소 + 워크스페이스는 원격 호스트가 소유합니다.
- 노트북을 마이그레이션해도 원격 게이트웨이의 상태는 이동되지 않습니다.

원격 모드라면 **게이트웨이 호스트**를 마이그레이션하십시오.

### 함정: 백업에 포함된 시크릿

`$OPENCLAW_STATE_DIR` 에는 시크릿(API 키, OAuth 토큰, WhatsApp 자격 증명)이 포함됩니다. 백업은 운영 환경의 시크릿처럼 취급하십시오:

- 암호화하여 보관
- 안전하지 않은 채널로 공유하지 않기
- 노출이 의심되면 키를 로테이션하기

## 검증 체크리스트

새 머신에서 다음을 확인하십시오:

- `openclaw status` 에서 게이트웨이가 실행 중으로 표시됨
- 채널이 여전히 연결되어 있음(예: WhatsApp 에서 재페어링을 요구하지 않음)
- 대시보드가 열리고 기존 세션이 표시됨
- 워크스페이스 파일(메모리, 설정)이 존재함

## 관련

- [Doctor](/gateway/doctor)
- [Gateway troubleshooting](/gateway/troubleshooting)
- [Where does OpenClaw store its data?](/help/faq#where-does-openclaw-store-its-data)
