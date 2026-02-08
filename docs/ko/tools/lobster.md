---
title: Lobster
summary: "OpenClaw 를 위한 재개 가능한 승인 게이트를 갖춘 타입드 워크플로 런타임."
description: Typed workflow runtime for OpenClaw — composable pipelines with approval gates.
read_when:
  - 명시적 승인을 갖춘 결정론적 다단계 워크플로가 필요할 때
  - 이전 단계를 다시 실행하지 않고 워크플로를 재개해야 할 때
x-i18n:
  source_path: tools/lobster.md
  source_hash: ff84e65f4be162ad
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:38:08Z
---

# Lobster

Lobster 는 OpenClaw 가 다단계 도구 시퀀스를 명시적 승인 체크포인트를 갖춘 단일의 결정론적 작업으로 실행할 수 있게 해주는 워크플로 셸입니다.

## Hook

어시스턴트는 스스로를 관리하는 도구를 만들 수 있습니다. 워크플로를 요청하면 30 분 후에 하나의 호출로 실행되는 CLI 와 파이프라인을 얻게 됩니다. Lobster 는 빠져 있던 조각입니다: 결정론적 파이프라인, 명시적 승인, 그리고 재개 가능한 상태.

## Why

오늘날 복잡한 워크플로는 많은 왕복 도구 호출을 필요로 합니다. 각 호출은 토큰 비용이 들고, LLM 이 모든 단계를 오케스트레이션해야 합니다. Lobster 는 그 오케스트레이션을 타입드 런타임으로 이동합니다:

- **여러 번 대신 한 번의 호출**: OpenClaw 는 하나의 Lobster 도구 호출을 실행하고 구조화된 결과를 얻습니다.
- **승인 내장**: 부작용(이메일 전송, 댓글 게시)은 명시적으로 승인될 때까지 워크플로를 중단합니다.
- **재개 가능**: 중단된 워크플로는 토큰을 반환하며, 승인 후 전체를 다시 실행하지 않고 재개할 수 있습니다.

## Why a DSL instead of plain programs?

Lobster 는 의도적으로 작게 설계되었습니다. 목표는 "새 언어"가 아니라, 일급 승인과 재개 토큰을 갖춘 예측 가능하고 AI 친화적인 파이프라인 명세입니다.

- **승인/재개 내장**: 일반 프로그램은 사람에게 프롬프트를 표시할 수는 있지만, 지속 가능한 토큰으로 _중단 및 재개_ 를 스스로 구현하지 않고서는 할 수 없습니다.
- **결정론 + 감사 가능성**: 파이프라인은 데이터이므로 로그, diff, 재생, 리뷰가 쉽습니다.
- **AI 를 위한 제한된 표면**: 작은 문법 + JSON 파이핑은 “창의적인” 코드 경로를 줄이고 검증을 현실적으로 만듭니다.
- **안전 정책 내장**: 타임아웃, 출력 제한, 샌드박스 검사, 허용 목록이 각 스크립트가 아니라 런타임에서 강제됩니다.
- **여전히 프로그래밍 가능**: 각 단계는 어떤 CLI 나 스크립트든 호출할 수 있습니다. JS/TS 가 필요하다면 코드에서 `.lobster` 파일을 생성하세요.

## How it works

OpenClaw 는 로컬 `lobster` CLI 를 **tool mode** 로 실행하고 stdout 에서 JSON 엔벨로프를 파싱합니다.
파이프라인이 승인을 위해 일시 중지되면, 도구는 나중에 계속할 수 있도록 `resumeToken` 를 반환합니다.

## Pattern: small CLI + JSON pipes + approvals

JSON 을 말하는 작은 명령을 만들고, 이를 하나의 Lobster 호출로 체인하세요. (아래의 예시 명령 이름은 참고용이므로, 여러분의 것으로 교체하세요.)

```bash
inbox list --json
inbox categorize --json
inbox apply --json
```

```json
{
  "action": "run",
  "pipeline": "exec --json --shell 'inbox list --json' | exec --stdin json --shell 'inbox categorize --json' | exec --stdin json --shell 'inbox apply --json' | approve --preview-from-stdin --limit 5 --prompt 'Apply changes?'",
  "timeoutMs": 30000
}
```

파이프라인이 승인을 요청하면 토큰으로 재개합니다:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

AI 가 워크플로를 트리거하고, Lobster 가 단계를 실행합니다. 승인 게이트는 부작용을 명시적이고 감사 가능하게 유지합니다.

예시: 입력 항목을 도구 호출로 매핑:

```bash
gog.gmail.search --query 'newer_than:1d' \
  | openclaw.invoke --tool message --action send --each --item-key message --args-json '{"provider":"telegram","to":"..."}'
```

## JSON-only LLM steps (llm-task)

**구조화된 LLM 단계** 가 필요한 워크플로의 경우, 선택 사항인
`llm-task` 플러그인 도구를 활성화하고 Lobster 에서 호출하세요. 이는 모델로 분류/요약/초안을 작성하면서도 워크플로를 결정론적으로 유지합니다.

도구 활성화:

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

파이프라인에서 사용:

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": { "subject": "Hello", "body": "Can you help?" },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

자세한 내용과 구성 옵션은 [LLM Task](/tools/llm-task) 를 참조하세요.

## Workflow files (.lobster)

Lobster 는 `name`, `args`, `steps`, `env`, `condition`, `approval` 필드를 갖는 YAML/JSON 워크플로 파일을 실행할 수 있습니다. OpenClaw 도구 호출에서는 파일 경로로 `pipeline` 를 설정하세요.

```yaml
name: inbox-triage
args:
  tag:
    default: "family"
steps:
  - id: collect
    command: inbox list --json
  - id: categorize
    command: inbox categorize --json
    stdin: $collect.stdout
  - id: approve
    command: inbox apply --approve
    stdin: $categorize.stdout
    approval: required
  - id: execute
    command: inbox apply --execute
    stdin: $categorize.stdout
    condition: $approve.approved
```

Notes:

- `stdin: $step.stdout` 와 `stdin: $step.json` 는 이전 단계의 출력을 전달합니다.
- `condition` (또는 `when`) 는 `$step.approved` 를 기준으로 단계를 게이트할 수 있습니다.

## Install Lobster

OpenClaw Gateway(게이트웨이) 가 실행되는 **같은 호스트** 에 Lobster CLI 를 설치하고([Lobster repo](https://github.com/openclaw/lobster) 참고), `lobster` 가 `PATH` 에 포함되어 있는지 확인하세요.
커스텀 바이너리 위치를 사용하려면 도구 호출에서 **절대 경로** 인 `lobsterPath` 를 전달하세요.

## Enable the tool

Lobster 는 **선택 사항** 인 플러그인 도구입니다(기본 비활성).

권장(추가적이며 안전):

```json
{
  "tools": {
    "alsoAllow": ["lobster"]
  }
}
```

또는 에이전트별:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "alsoAllow": ["lobster"]
        }
      }
    ]
  }
}
```

제한적인 허용 목록 모드로 실행할 의도가 없다면 `tools.allow: ["lobster"]` 사용을 피하세요.

참고: 허용 목록은 선택 사항 플러그인에 대해 옵트인입니다. 허용 목록에
`lobster` 와 같은 플러그인 도구만 명시되어 있다면, OpenClaw 는 코어 도구를 활성화된 상태로 유지합니다. 코어 도구를 제한하려면 허용 목록에 원하는 코어 도구나 그룹도 포함하세요.

## Example: Email triage

Lobster 없이:

```
User: "Check my email and draft replies"
→ openclaw calls gmail.list
→ LLM summarizes
→ User: "draft replies to #2 and #5"
→ LLM drafts
→ User: "send #2"
→ openclaw calls gmail.send
(repeat daily, no memory of what was triaged)
```

Lobster 사용:

```json
{
  "action": "run",
  "pipeline": "email.triage --limit 20",
  "timeoutMs": 30000
}
```

JSON 엔벨로프 반환(일부 생략):

```json
{
  "ok": true,
  "status": "needs_approval",
  "output": [{ "summary": "5 need replies, 2 need action" }],
  "requiresApproval": {
    "type": "approval_request",
    "prompt": "Send 2 draft replies?",
    "items": [],
    "resumeToken": "..."
  }
}
```

사용자 승인 → 재개:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

하나의 워크플로. 결정론적. 안전함.

## Tool parameters

### `run`

tool mode 로 파이프라인을 실행합니다.

```json
{
  "action": "run",
  "pipeline": "gog.gmail.search --query 'newer_than:1d' | email.triage",
  "cwd": "/path/to/workspace",
  "timeoutMs": 30000,
  "maxStdoutBytes": 512000
}
```

인자와 함께 워크플로 파일 실행:

```json
{
  "action": "run",
  "pipeline": "/path/to/inbox-triage.lobster",
  "argsJson": "{\"tag\":\"family\"}"
}
```

### `resume`

승인 후 중단된 워크플로를 계속합니다.

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

### Optional inputs

- `lobsterPath`: Lobster 바이너리의 절대 경로(`PATH` 사용 시 생략).
- `cwd`: 파이프라인의 작업 디렉토리(기본값: 현재 프로세스의 작업 디렉토리).
- `timeoutMs`: 이 기간을 초과하면 하위 프로세스를 종료합니다(기본값: 20000).
- `maxStdoutBytes`: stdout 이 이 크기를 초과하면 하위 프로세스를 종료합니다(기본값: 512000).
- `argsJson`: `lobster run --args-json` 에 전달되는 JSON 문자열(워크플로 파일 전용).

## Output envelope

Lobster 는 다음 세 가지 상태 중 하나를 갖는 JSON 엔벨로프를 반환합니다:

- `ok` → 성공적으로 완료
- `needs_approval` → 일시 중지; 재개하려면 `requiresApproval.resumeToken` 가 필요
- `cancelled` → 명시적으로 거부되었거나 취소됨

도구는 `content` (예쁜 JSON) 과 `details` (원시 객체) 모두로 엔벨로프를 노출합니다.

## Approvals

`requiresApproval` 가 존재하면 프롬프트를 검토하고 다음을 결정하세요:

- `approve: true` → 재개하여 부작용을 계속
- `approve: false` → 취소하고 워크플로를 종료

`approve --preview-from-stdin --limit N` 를 사용하면 커스텀 jq/heredoc 글루 없이 승인 요청에 JSON 미리보기를 첨부할 수 있습니다. 재개 토큰은 이제 더 간결합니다: Lobster 는 워크플로 재개 상태를 자체 상태 디렉토리에 저장하고 작은 토큰 키를 반환합니다.

## OpenProse

OpenProse 는 Lobster 와 잘 어울립니다: `/prose` 를 사용해 다중 에이전트 준비를 오케스트레이션한 다음, 결정론적 승인을 위해 Lobster 파이프라인을 실행하세요. Prose 프로그램에 Lobster 가 필요하다면, `tools.subagents.tools` 를 통해 하위 에이전트에 `lobster` 도구를 허용하세요. [OpenProse](/prose) 를 참조하세요.

## Safety

- **로컬 하위 프로세스만** — 플러그인 자체에서는 네트워크 호출을 하지 않습니다.
- **비밀 정보 없음** — Lobster 는 OAuth 를 관리하지 않으며, 이를 수행하는 OpenClaw 도구를 호출합니다.
- **샌드박스 인지** — 도구 컨텍스트가 샌드박스 처리된 경우 비활성화됩니다.
- **강화됨** — 지정된 경우 `lobsterPath` 는 절대 경로여야 하며, 타임아웃과 출력 제한이 강제됩니다.

## Troubleshooting

- **`lobster subprocess timed out`** → `timeoutMs` 를 늘리거나 긴 파이프라인을 분할하세요.
- **`lobster output exceeded maxStdoutBytes`** → `maxStdoutBytes` 를 늘리거나 출력 크기를 줄이세요.
- **`lobster returned invalid JSON`** → 파이프라인이 tool mode 로 실행되고 JSON 만 출력하는지 확인하세요.
- **`lobster failed (code …)`** → 동일한 파이프라인을 터미널에서 실행하여 stderr 를 확인하세요.

## Learn more

- [Plugins](/plugin)
- [Plugin tool authoring](/plugins/agent-tools)

## Case study: community workflows

공개 사례 하나: 세 개의 Markdown 볼트(개인, 파트너, 공유)를 관리하는 “second brain” CLI + Lobster 파이프라인. 이 CLI 는 통계, 인박스 목록, 오래된 항목 스캔에 대한 JSON 을 출력하고, Lobster 는 이러한 명령을 `weekly-review`, `inbox-triage`, `memory-consolidation`, `shared-task-sync` 와 같은 워크플로로 체인하며 각각 승인 게이트를 포함합니다. AI 는 가능할 때 판단(분류)을 처리하고, 그렇지 않을 때는 결정론적 규칙으로 폴백합니다.

- Thread: https://x.com/plattenschieber/status/2014508656335770033
- Repo: https://github.com/bloomedai/brain-cli
