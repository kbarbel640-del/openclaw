---
summary: "`openclaw memory`에 대한 CLI 참조 (상태/인덱스/검색)"
read_when:
  - 시맨틱 메모리를 인덱싱하거나 검색하려는 경우
  - 메모리 가용성 또는 인덱싱을 디버깅하는 경우
title: "메모리"
x-i18n:
  source_path: cli/memory.md
  source_hash: 95a9e94306f95be2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:29Z
---

# `openclaw memory`

시맨틱 메모리 인덱싱과 검색을 관리합니다.
활성 메모리 플러그인이 제공합니다 (기본값: `memory-core`; 비활성화하려면 `plugins.slots.memory = "none"` 설정).

관련 항목:

- 메모리 개념: [Memory](/concepts/memory)
- 플러그인: [Plugins](/plugins)

## 예제

```bash
openclaw memory status
openclaw memory status --deep
openclaw memory status --deep --index
openclaw memory status --deep --index --verbose
openclaw memory index
openclaw memory index --verbose
openclaw memory search "release checklist"
openclaw memory status --agent main
openclaw memory index --agent main --verbose
```

## 옵션

공통:

- `--agent <id>`: 단일 에이전트로 범위를 제한합니다 (기본값: 구성된 모든 에이전트).
- `--verbose`: 프로브와 인덱싱 중에 상세 로그를 출력합니다.

참고:

- `memory status --deep` 는 벡터 + 임베딩 가용성을 프로브합니다.
- `memory status --deep --index` 는 스토어가 더러운 경우 재인덱싱을 실행합니다.
- `memory index --verbose` 는 단계별 상세 정보 (프로바이더, 모델, 소스, 배치 활동)를 출력합니다.
- `memory status` 는 `memorySearch.extraPaths` 를 통해 구성된 모든 추가 경로를 포함합니다.
