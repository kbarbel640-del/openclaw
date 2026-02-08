---
summary: "`openclaw skills` (list/info/check) 및 스킬 적합성에 대한 CLI 참조"
read_when:
  - 사용 가능한 스킬과 실행 준비가 된 스킬을 확인하고 싶을 때
  - 스킬에 대해 누락된 바이너리 / 환경 변수 / 설정을 디버그하고 싶을 때
title: "Skills"
x-i18n:
  source_path: cli/skills.md
  source_hash: 7878442c88a27ec8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:39Z
---

# `openclaw skills`

Skills (번들 + 워크스페이스 + 관리형 오버라이드)를 점검하고, 요구 사항을 충족하는 항목과 누락된 요구 사항을 확인합니다.

관련 항목:

- Skills 시스템: [Skills](/tools/skills)
- Skills 설정: [Skills config](/tools/skills-config)
- ClawHub 설치: [ClawHub](/tools/clawhub)

## 명령어

```bash
openclaw skills list
openclaw skills list --eligible
openclaw skills info <name>
openclaw skills check
```
