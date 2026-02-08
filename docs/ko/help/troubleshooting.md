---
summary: "문제 해결 허브: 증상 → 점검 → 해결"
read_when:
  - 오류가 보이고 해결 경로를 찾고자 할 때
  - 설치 프로그램이 '성공'이라고 표시하지만 CLI 가 동작하지 않을 때
title: "문제 해결"
x-i18n:
  source_path: help/troubleshooting.md
  source_hash: 00ba2a20732fa22c
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:05Z
---

# 문제 해결

## 처음 60초

다음을 순서대로 실행합니다:

```bash
openclaw status
openclaw status --all
openclaw gateway probe
openclaw logs --follow
openclaw doctor
```

Gateway(게이트웨이)에 연결할 수 있으면, 심화 프로브를 실행합니다:

```bash
openclaw status --deep
```

## 흔한 '망가졌다' 사례

### `openclaw: command not found`

대부분 Node/npm PATH 문제입니다. 여기서 시작합니다:

- [설치 (Node/npm PATH 점검)](/install#nodejs--npm-path-sanity)

### 설치 프로그램이 실패함(또는 전체 로그가 필요함)

전체 트레이스와 npm 출력을 보려면 자세한(Verbose) 모드로 설치 프로그램을 다시 실행합니다:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --verbose
```

베타 설치의 경우:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --beta --verbose
```

플래그 대신 `OPENCLAW_VERBOSE=1` 를 설정할 수도 있습니다.

### Gateway(게이트웨이) 'unauthorized', 연결할 수 없음, 또는 재연결을 반복함

- [Gateway(게이트웨이) 문제 해결](/gateway/troubleshooting)
- [Gateway(게이트웨이) 인증](/gateway/authentication)

### Control UI 가 HTTP 에서 실패함(디바이스 ID 필요)

- [Gateway(게이트웨이) 문제 해결](/gateway/troubleshooting)
- [Control UI](/web/control-ui#insecure-http)

### `docs.openclaw.ai` 에서 SSL 오류가 표시됨(Comcast/Xfinity)

일부 Comcast/Xfinity 연결은 Xfinity Advanced Security 를 통해 `docs.openclaw.ai` 를 차단합니다.
Advanced Security 를 비활성화하거나 `docs.openclaw.ai` 를 허용 목록에 추가한 다음 다시 시도하십시오.

- Xfinity Advanced Security 도움말: https://www.xfinity.com/support/articles/using-xfinity-xfi-advanced-security
- 빠른 점검: 모바일 핫스팟 또는 VPN 을 사용해 ISP 수준 필터링인지 확인해 보십시오

### 서비스는 실행 중이라고 나오지만 RPC 프로브가 실패함

- [Gateway(게이트웨이) 문제 해결](/gateway/troubleshooting)
- [백그라운드 프로세스 / 서비스](/gateway/background-process)

### 모델/인증 실패(요율 제한, 결제, 'all models failed')

- [모델](/cli/models)
- [OAuth / 인증 개념](/concepts/oauth)

### `/model` 에서 `model not allowed` 라고 표시됨

이는 보통 `agents.defaults.models` 가 허용 목록으로 설정되어 있음을 의미합니다. 비어 있지 않으면,
해당 프로바이더/모델 키만 선택할 수 있습니다.

- 허용 목록 확인: `openclaw config get agents.defaults.models`
- 원하는 모델을 추가(또는 허용 목록을 비움)한 뒤 `/model` 를 다시 시도하십시오
- `/models` 를 사용해 허용된 프로바이더/모델을 탐색하십시오

### 이슈를 제출할 때

안전한 리포트를 붙여 넣으십시오:

```bash
openclaw status --all
```

가능하다면 `openclaw logs --follow` 에서 관련 로그의 끝부분(tail)도 포함해 주십시오.
