---
summary: "모델 프로바이더의 OAuth 만료를 모니터링합니다"
read_when:
  - 인증 만료 모니터링 또는 알림을 설정할 때
  - Claude Code / Codex OAuth 갱신 확인을 자동화할 때
title: "인증 모니터링"
x-i18n:
  source_path: automation/auth-monitoring.md
  source_hash: eef179af9545ed7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:56Z
---

# 인증 모니터링

OpenClaw 는 `openclaw models status` 를 통해 OAuth 만료 상태를 제공합니다. 이를 자동화와 알림에 사용합니다. 스크립트는 전화 워크플로를 위한 선택적 추가 사항입니다.

## 권장: CLI 확인 (이식 가능)

```bash
openclaw models status --check
```

종료 코드:

- `0`: 정상
- `1`: 자격 증명이 만료되었거나 없음
- `2`: 곧 만료됨 (24시간 이내)

이 방식은 cron/systemd 에서 동작하며 추가 스크립트가 필요하지 않습니다.

## 선택적 스크립트 (운영 / 전화 워크플로)

이들은 `scripts/` 아래에 있으며 **선택 사항**입니다. 게이트웨이 호스트에 대한 SSH 접근을 가정하며 systemd + Termux 에 맞게 조정되어 있습니다.

- `scripts/claude-auth-status.sh` 는 이제 `openclaw models status --json` 를 단일 기준 소스로 사용합니다 (CLI 를 사용할 수 없는 경우 직접 파일 읽기로 폴백). 따라서 타이머를 위해 `PATH` 에서 `openclaw` 를 유지하십시오.
- `scripts/auth-monitor.sh`: cron/systemd 타이머 대상; 알림을 전송합니다 (ntfy 또는 전화).
- `scripts/systemd/openclaw-auth-monitor.{service,timer}`: systemd 사용자 타이머.
- `scripts/claude-auth-status.sh`: Claude Code + OpenClaw 인증 확인기 (full/json/simple).
- `scripts/mobile-reauth.sh`: SSH 를 통한 단계별 재인증 플로.
- `scripts/termux-quick-auth.sh`: 원탭 위젯 상태 + 인증 URL 열기.
- `scripts/termux-auth-widget.sh`: 전체 단계별 위젯 플로.
- `scripts/termux-sync-widget.sh`: Claude Code 자격 증명 → OpenClaw 동기화.

전화 자동화나 systemd 타이머가 필요 없다면 이 스크립트들은 건너뛰십시오.
