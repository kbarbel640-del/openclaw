---
summary: "대상 디버그 로그를 위한 진단 플래그"
read_when:
  - 전역 로깅 레벨을 올리지 않고 대상 디버그 로그가 필요합니다
  - 지원을 위해 하위 시스템별 로그를 캡처해야 합니다
title: "진단 플래그"
x-i18n:
  source_path: diagnostics/flags.md
  source_hash: daf0eca0e6bd1cbc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:19Z
---

# 진단 플래그

진단 플래그를 사용하면 어디에서나 장황한 로깅을 켜지 않고도 대상 디버그 로그를 활성화할 수 있습니다. 플래그는 옵트인이며, 하위 시스템이 이를 확인하지 않는 한 아무 영향도 없습니다.

## 작동 방식

- 플래그는 문자열입니다(대소문자 구분 없음).
- 설정에서 또는 환경 변수 오버라이드를 통해 플래그를 활성화할 수 있습니다.
- 와일드카드가 지원됩니다:
  - `telegram.*` 는 `telegram.http` 와 일치합니다
  - `*` 는 모든 플래그를 활성화합니다

## 설정을 통해 활성화

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

여러 플래그:

```json
{
  "diagnostics": {
    "flags": ["telegram.http", "gateway.*"]
  }
}
```

플래그를 변경한 후 Gateway(게이트웨이)를 재시작합니다.

## 환경 변수 오버라이드(일회성)

```bash
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

모든 플래그 비활성화:

```bash
OPENCLAW_DIAGNOSTICS=0
```

## 로그가 저장되는 위치

플래그는 표준 진단 로그 파일로 로그를 출력합니다. 기본값:

```
/tmp/openclaw/openclaw-YYYY-MM-DD.log
```

`logging.file` 를 설정했다면, 대신 해당 경로를 사용합니다. 로그는 JSONL(한 줄당 JSON 객체 1개)입니다. 마스킹은 `logging.redactSensitive` 에 따라 계속 적용됩니다.

## 로그 추출

가장 최신 로그 파일을 선택합니다:

```bash
ls -t /tmp/openclaw/openclaw-*.log | head -n 1
```

Telegram HTTP 진단 로그로 필터링합니다:

```bash
rg "telegram http error" /tmp/openclaw/openclaw-*.log
```

또는 재현하는 동안 tail 로 확인합니다:

```bash
tail -f /tmp/openclaw/openclaw-$(date +%F).log | rg "telegram http error"
```

원격 Gateway(게이트웨이)의 경우 `openclaw logs --follow` 도 사용할 수 있습니다([/cli/logs](/cli/logs) 참고).

## 참고

- `logging.level` 가 `warn` 보다 높게 설정되어 있으면, 이러한 로그가 억제될 수 있습니다. 기본값 `info` 는 괜찮습니다.
- 플래그는 활성화된 상태로 두어도 안전합니다. 특정 하위 시스템의 로그 볼륨에만 영향을 줍니다.
- 로그 목적지, 레벨, 마스킹을 변경하려면 [/logging](/logging)을 사용합니다.
