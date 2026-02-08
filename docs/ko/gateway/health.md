---
summary: "채널 연결성을 위한 상태 점검 단계"
read_when:
  - WhatsApp 채널 상태를 진단할 때
title: "상태 점검"
x-i18n:
  source_path: gateway/health.md
  source_hash: 74f242e98244c135
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:14Z
---

# 상태 점검 (CLI)

추측 없이 채널 연결성을 확인하기 위한 짧은 가이드입니다.

## 빠른 점검

- `openclaw status` — 로컬 요약: 게이트웨이 도달 가능 여부/모드, 업데이트 힌트, 연결된 채널 인증 경과 시간, 세션 + 최근 활동.
- `openclaw status --all` — 전체 로컬 진단(읽기 전용, 컬러, 디버깅을 위해 붙여넣기 안전).
- `openclaw status --deep` — 실행 중인 Gateway(게이트웨이)도 프로브합니다(지원되는 경우 채널별 프로브).
- `openclaw health --json` — 실행 중인 Gateway(게이트웨이)에 전체 상태 스냅샷을 요청합니다(WS 전용; Baileys 소켓 직접 연결 없음).
- WhatsApp/WebChat 에서 에이전트를 호출하지 않고 상태 응답을 받으려면 `/status` 를 단독 메시지로 전송합니다.
- 로그: `/tmp/openclaw/openclaw-*.log` 를 tail 하고 `web-heartbeat`, `web-reconnect`, `web-auto-reply`, `web-inbound` 로 필터링합니다.

## 심층 진단

- 디스크의 크리덴셜: `ls -l ~/.openclaw/credentials/whatsapp/<accountId>/creds.json` (mtime 이 최근이어야 합니다).
- 세션 스토어: `ls -l ~/.openclaw/agents/<agentId>/sessions/sessions.json` (경로는 설정에서 재정의할 수 있습니다). 개수와 최근 수신자는 `status` 를 통해 표시됩니다.
- 재연결 플로우: 상태 코드 409–515 또는 로그에 `loggedOut` 가 나타날 때 `openclaw channels logout && openclaw channels login --verbose` 를 실행합니다. (참고: QR 로그인 플로우는 페어링 후 상태 515 에 대해 한 번 자동 재시작합니다.)

## 문제가 발생했을 때

- `logged out` 또는 상태 409–515 → `openclaw channels logout` 로 재연결한 다음 `openclaw channels login` 를 실행합니다.
- Gateway(게이트웨이) 도달 불가 → 시작: `openclaw gateway --port 18789` (포트가 사용 중이면 `--force` 사용).
- 인바운드 메시지 없음 → 연결된 휴대폰이 온라인인지, 발신자가 허용되는지(`channels.whatsapp.allowFrom`) 확인합니다. 그룹 채팅의 경우 허용 목록 + 멘션 규칙이 일치하는지(`channels.whatsapp.groups`, `agents.list[].groupChat.mentionPatterns`) 확인합니다.

## 전용 "health" 명령

`openclaw health --json` 는 실행 중인 Gateway(게이트웨이)에 상태 스냅샷을 요청합니다(CLI 에서 직접 채널 소켓 연결 없음). 가능한 경우 연결된 크리덴셜/인증 경과 시간, 채널별 프로브 요약, 세션 스토어 요약, 프로브 소요 시간을 보고합니다. Gateway(게이트웨이)에 도달할 수 없거나 프로브가 실패/타임아웃되면 0 이 아닌 코드로 종료합니다. 기본 10초를 재정의하려면 `--timeout <ms>` 를 사용합니다.
