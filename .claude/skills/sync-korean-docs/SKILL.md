---
name: sync-korean-docs
description: Sync main branch changes and translate new/updated documentation to Korean (ko-KR). Use when asked to sync fork, translate docs, or update Korean documentation from main branch.
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Sync & Translate Korean Docs

이 스킬은 main 브랜치의 최신 변경사항을 Korean 브랜치에 동기화하고, 새로 추가되거나 변경된 문서를 한국어(ko-KR)로 번역합니다.

## 워크플로우

### 1단계: 현재 sync 상태 확인

`docs/.i18n/sync-state.ko-KR.json`을 읽어 마지막 sync SHA를 확인합니다.

```bash
cat docs/.i18n/sync-state.ko-KR.json
```

### 2단계: main 브랜치와 동기화

```bash
git fetch origin main
git merge origin/main
```

병합 충돌이 있으면 해결한 후 계속 진행합니다.

### 3단계: 변경된 영어 문서 파악

마지막 sync SHA부터 현재까지 변경된 docs/ 파일을 찾습니다:

```bash
git diff <LAST_SYNC_SHA>..origin/main --name-only -- docs/ | grep -v "ko-KR" | grep -v ".i18n"
```

### 4단계: 각 파일 번역

변경된 영어 문서마다 다음을 수행합니다:

1. **영어 원본 파일 읽기** (`docs/<path>.md`)
2. **영어 diff 확인** 어떤 부분이 변경됐는지 파악:
   ```bash
   git diff <LAST_SYNC_SHA>..origin/main -- docs/<path>.md
   ```
3. **한국어 파일 읽기** (`docs/ko-KR/<path>.md`)
4. **변경사항 반영**: 새 섹션은 번역 추가, 수정된 섹션은 업데이트

#### 번역 지침

- 기술 용어, CLI 명령어, 코드 블록, JSON 키는 **영어 그대로 유지**
- 자연스러운 한국어 사용 (직역보다 의역)
- frontmatter의 `summary`, `title`, `sidebarTitle`, `read_when` 필드도 한국어로
- 기존 ko-KR 파일의 번역 스타일과 일관성 유지
- URL 경로는 `/ko-KR/` 접두어 사용 (이미 ko-KR 파일에 있는 경우)

#### 새 파일 처리

영어 파일에 대응하는 ko-KR 파일이 없으면 새로 생성합니다:

- `docs/foo/bar.md` → `docs/ko-KR/foo/bar.md` 생성

### 5단계: sync-state 업데이트

모든 번역 완료 후 `docs/.i18n/sync-state.ko-KR.json`을 업데이트합니다:

- `last_sync_sha`: 새 main 브랜치의 최신 커밋 SHA (전체 SHA)
- `last_sync_date`: 현재 날짜/시간 (ISO 8601 형식)

```bash
git rev-parse origin/main  # 새 SHA 확인
```

### 6단계: 변경사항 커밋

`scripts/committer`를 사용해 변경된 파일만 스코프를 맞춰 커밋합니다:

```bash
scripts/committer "chore(i18n): translate ko-KR docs synced from main (<SHORT_SHA>)" \
  docs/.i18n/sync-state.ko-KR.json \
  docs/ko-KR/<변경된 파일들...>
```

SHORT_SHA는 새 sync SHA의 앞 7자리입니다.

### 7단계: Push

```bash
git push origin korean
```

## 중요 규칙

- **파일을 순차적으로 처리** (병렬 처리 금지) — 각 파일을 읽고, diff 확인하고, 번역 후 다음으로 이동
- **편집 전 반드시 파일 읽기** — Edit 도구 사용 전 Read 도구로 파일 내용 확인 필수
- **내용 삭제 금지** — 기존 한국어 내용을 실수로 삭제하지 않도록 주의
- **코드 블록 내용 번역 금지** — 코드, CLI 명령, JSON, YAML은 그대로 유지
- **링크 경로 유지** — 내부 링크는 `/ko-KR/` 경로 패턴 확인 후 적절히 처리

## sync-state.ko-KR.json 형식

```json
{
  "last_sync_sha": "전체 커밋 SHA",
  "last_sync_date": "2026-02-25T08:00:00.000Z",
  "...": "기타 기존 필드 유지"
}
```
