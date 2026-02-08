---
summary: "`openclaw config`에 대한 CLI 참조(설정 값 가져오기/설정/해제)"
read_when:
  - 설정을 비대화식으로 읽거나 편집하려는 경우
title: "config"
x-i18n:
  source_path: cli/config.md
  source_hash: d60a35f5330f22bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:22Z
---

# `openclaw config`

설정 도우미: 경로로 값을 가져오기/설정/해제합니다. 하위 명령 없이 실행하면
구성 마법사를 엽니다(`openclaw configure`와 동일).

## 예제

```bash
openclaw config get browser.executablePath
openclaw config set browser.executablePath "/usr/bin/google-chrome"
openclaw config set agents.defaults.heartbeat.every "2h"
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
openclaw config unset tools.web.search.apiKey
```

## 경로

경로는 점 또는 대괄호 표기법을 사용합니다:

```bash
openclaw config get agents.defaults.workspace
openclaw config get agents.list[0].id
```

특정 에이전트를 대상으로 지정하려면 에이전트 목록 인덱스를 사용합니다:

```bash
openclaw config get agents.list
openclaw config set agents.list[1].tools.exec.node "node-id-or-name"
```

## 값

값은 가능하면 JSON5로 파싱되며, 그렇지 않으면 문자열로 처리됩니다.
JSON5 파싱을 강제하려면 `--json`을 사용합니다.

```bash
openclaw config set agents.defaults.heartbeat.every "0m"
openclaw config set gateway.port 19001 --json
openclaw config set channels.whatsapp.groups '["*"]' --json
```

편집 후 Gateway(게이트웨이)를 재시작하십시오.
