---
summary: "리포지토리 스크립트: 목적, 범위 및 안전 유의 사항"
read_when:
  - "리포지토리에서 스크립트를 실행할 때"
  - "./scripts 아래에서 스크립트를 추가하거나 변경할 때"
title: "스크립트"
x-i18n:
  source_path: help/scripts.md
  source_hash: efd220df28f20b33
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:42Z
---

# 스크립트

`scripts/` 디렉토리에는 로컬 워크플로와 운영 작업을 위한 헬퍼 스크립트가 포함되어 있습니다.
작업이 명확히 스크립트와 연관된 경우에만 사용하고, 그렇지 않으면 CLI 를 우선 사용합니다.

## 규칙

- 문서나 릴리스 체크리스트에서 참조되지 않는 한 스크립트는 **선택 사항**입니다.
- 가능하다면 CLI 표면을 우선 사용합니다 (예: 인증 모니터링은 `openclaw models status --check` 사용).
- 스크립트는 호스트별일 수 있다고 가정하고, 새 머신에서 실행하기 전에 내용을 읽어보십시오.

## 인증 모니터링 스크립트

인증 모니터링 스크립트는 여기에서 문서화되어 있습니다:
[/automation/auth-monitoring](/automation/auth-monitoring)

## 스크립트를 추가할 때

- 스크립트는 목적을 명확히 유지하고 문서화하십시오.
- 관련 문서에 간단한 항목을 추가하거나, 없다면 새로 만드십시오.
