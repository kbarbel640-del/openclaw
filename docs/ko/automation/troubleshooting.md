---
summary: "cron 및 하트비트 스케줄링과 전달 문제를 해결합니다"
read_when:
  - Cron 이 실행되지 않았을 때
  - Cron 은 실행되었지만 메시지가 전달되지 않았을 때
  - 하트비트가 조용하거나 건너뛴 것처럼 보일 때
title: "자동화 문제 해결"
x-i18n:
  source_path: automation/troubleshooting.md
  source_hash: 10eca4a59119910f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:50Z
---

# 자동화 문제 해결

스케줄러 및 전달 문제(`cron` + `heartbeat`)에 이 페이지를 사용합니다.

## 명령 단계

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

그런 다음 자동화 검사를 실행합니다:

```bash
openclaw cron status
openclaw cron list
openclaw system heartbeat last
```

## Cron 이 실행되지 않음

```bash
openclaw cron status
openclaw cron list
openclaw cron runs --id <jobId> --limit 20
openclaw logs --follow
```

정상 출력은 다음과 같습니다:

- `cron status` 에서 활성화됨과 향후 `nextWakeAtMs` 가 보고됩니다.
- 작업이 활성화되어 있으며 유효한 스케줄/타임존을 가지고 있습니다.
- `cron runs` 에서 `ok` 또는 명시적인 건너뜀 사유가 표시됩니다.

일반적인 시그니처:

- `cron: scheduler disabled; jobs will not run automatically` → 설정/환경 변수에서 cron 이 비활성화됨.
- `cron: timer tick failed` → 스케줄러 틱이 충돌함; 주변 스택/로그 컨텍스트를 확인하십시오.
- 실행 출력에 `reason: not-due` → `--force` 없이 수동 실행이 호출되었고 작업이 아직 실행 시점이 아님.

## Cron 은 실행되었지만 전달 없음

```bash
openclaw cron runs --id <jobId> --limit 20
openclaw cron list
openclaw channels status --probe
openclaw logs --follow
```

정상 출력은 다음과 같습니다:

- 실행 상태가 `ok` 입니다.
- 격리된 작업에 대해 전달 모드/대상이 설정되어 있습니다.
- 채널 프로브에서 대상 채널이 연결되었음을 보고합니다.

일반적인 시그니처:

- 실행은 성공했지만 전달 모드가 `none` → 외부 메시지는 예상되지 않습니다.
- 전달 대상 누락/무효(`channel`/`to`) → 내부적으로는 실행이 성공할 수 있으나 아웃바운드는 건너뜁니다.
- 채널 인증 오류(`unauthorized`, `missing_scope`, `Forbidden`) → 채널 자격 증명/권한으로 인해 전달이 차단됩니다.

## 하트비트가 억제되거나 건너뜀

```bash
openclaw system heartbeat last
openclaw logs --follow
openclaw config get agents.defaults.heartbeat
openclaw channels status --probe
```

정상 출력은 다음과 같습니다:

- 하트비트가 0 이 아닌 간격으로 활성화되어 있습니다.
- 마지막 하트비트 결과가 `ran` 입니다(또는 건너뜀 사유가 이해 가능합니다).

일반적인 시그니처:

- `heartbeat skipped` 와 `reason=quiet-hours` → `activeHours` 범위 밖.
- `requests-in-flight` → 메인 레인이 바쁨; 하트비트가 지연됨.
- `empty-heartbeat-file` → `HEARTBEAT.md` 가 존재하지만 실행 가능한 콘텐츠가 없음.
- `alerts-disabled` → 가시성 설정이 아웃바운드 하트비트 메시지를 억제함.

## 타임존 및 activeHours 주의사항

```bash
openclaw config get agents.defaults.heartbeat.activeHours
openclaw config get agents.defaults.heartbeat.activeHours.timezone
openclaw config get agents.defaults.userTimezone || echo "agents.defaults.userTimezone not set"
openclaw cron list
openclaw logs --follow
```

빠른 규칙:

- `Config path not found: agents.defaults.userTimezone` 는 키가 설정되지 않았음을 의미합니다; 하트비트는 호스트 타임존으로 폴백합니다(설정된 경우 `activeHours.timezone`).
- `--tz` 이 없는 Cron 은 게이트웨이 호스트 타임존을 사용합니다.
- 하트비트 `activeHours` 는 구성된 타임존 해석(`user`, `local`, 또는 명시적 IANA tz)을 사용합니다.
- 타임존이 없는 ISO 타임스탬프는 cron `at` 스케줄에 대해 UTC 로 처리됩니다.

일반적인 시그니처:

- 호스트 타임존 변경 후 작업이 잘못된 실제 시각에 실행됨.
- `activeHours.timezone` 가 잘못되어 낮 시간 동안 하트비트가 항상 건너뜀.

관련 항목:

- [/automation/cron-jobs](/automation/cron-jobs)
- [/gateway/heartbeat](/gateway/heartbeat)
- [/automation/cron-vs-heartbeat](/automation/cron-vs-heartbeat)
- [/concepts/timezone](/concepts/timezone)
