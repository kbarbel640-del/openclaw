---
summary: "CLI 백엔드: 로컬 AI CLI 를 통한 텍스트 전용 폴백"
read_when:
  - API 프로바이더가 실패할 때 신뢰할 수 있는 폴백을 원합니다
  - Claude Code CLI 또는 기타 로컬 AI CLI 를 실행 중이며 이를 재사용하고 싶습니다
  - 세션과 이미지를 지원하면서도 텍스트 전용, 도구 없는 경로가 필요합니다
title: "CLI 백엔드"
x-i18n:
  source_path: gateway/cli-backends.md
  source_hash: 8285f4829900bc81
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:32Z
---

# CLI 백엔드(폴백 런타임)

OpenClaw 는 API 프로바이더가 다운되었거나, 속도 제한에 걸렸거나, 일시적으로 오동작할 때 **로컬 AI CLI** 를 **텍스트 전용 폴백** 으로 실행할 수 있습니다. 이는 의도적으로 보수적으로 설계되었습니다:

- **도구가 비활성화됩니다**(도구 호출 없음).
- **텍스트 입력 → 텍스트 출력**(신뢰성).
- **세션이 지원됩니다**(후속 턴이 일관되게 유지됨).
- CLI 가 이미지 경로를 받아들인다면 **이미지를 전달**할 수 있습니다.

이는 주 경로라기보다 **안전망**으로 설계되었습니다. 외부 API 에 의존하지 않고 "항상 동작하는" 텍스트 응답을 원할 때 사용하십시오.

## 초보자 친화적인 빠른 시작

Claude Code CLI 는 **어떤 설정 없이도** 사용할 수 있습니다(OpenClaw 는 내장 기본값을 함께 제공합니다):

```bash
openclaw agent --message "hi" --model claude-cli/opus-4.6
```

Codex CLI 도 기본 설정만으로 동작합니다:

```bash
openclaw agent --message "hi" --model codex-cli/gpt-5.3-codex
```

Gateway(게이트웨이) 가 launchd/systemd 하에서 실행되어 PATH 가 최소로 설정되어 있다면, 명령 경로만 추가하십시오:

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
      },
    },
  },
}
```

이것으로 끝입니다. 키도 필요 없고, CLI 자체를 제외하면 추가 인증 설정도 필요 없습니다.

## 폴백으로 사용하기

기본 모델이 실패할 때만 실행되도록, 폴백 목록에 CLI 백엔드를 추가하십시오:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["claude-cli/opus-4.6", "claude-cli/opus-4.5"],
      },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "claude-cli/opus-4.6": {},
        "claude-cli/opus-4.5": {},
      },
    },
  },
}
```

참고:

- `agents.defaults.models`(allowlist) 를 사용한다면, `claude-cli/...` 를 포함해야 합니다.
- 기본 프로바이더가 실패(인증, 속도 제한, 타임아웃)하면 OpenClaw 는 다음으로 CLI 백엔드를 시도합니다.

## 설정 개요

모든 CLI 백엔드는 다음 아래에 있습니다:

```
agents.defaults.cliBackends
```

각 항목은 **provider id**(예: `claude-cli`, `my-cli`) 로 키가 지정됩니다.
provider id 는 모델 참조의 왼쪽 부분이 됩니다:

```
<provider>/<model>
```

### 설정 예시

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
        "my-cli": {
          command: "my-cli",
          args: ["--json"],
          output: "json",
          input: "arg",
          modelArg: "--model",
          modelAliases: {
            "claude-opus-4-6": "opus",
            "claude-opus-4-5": "opus",
            "claude-sonnet-4-5": "sonnet",
          },
          sessionArg: "--session",
          sessionMode: "existing",
          sessionIdFields: ["session_id", "conversation_id"],
          systemPromptArg: "--system",
          systemPromptWhen: "first",
          imageArg: "--image",
          imageMode: "repeat",
          serialize: true,
        },
      },
    },
  },
}
```

## 동작 방식

1. provider prefix(`claude-cli/...`) 를 기반으로 **백엔드를 선택**합니다.
2. 동일한 OpenClaw 프롬프트 + 워크스페이스 컨텍스트를 사용하여 **시스템 프롬프트를 구성**합니다.
3. 히스토리가 일관되게 유지되도록(지원되는 경우) 세션 id 와 함께 **CLI 를 실행**합니다.
4. 출력(JSON 또는 일반 텍스트)을 **파싱**하고 최종 텍스트를 반환합니다.
5. 백엔드별로 **세션 id 를 저장**하여, 후속 요청이 동일한 CLI 세션을 재사용하도록 합니다.

## 세션

- CLI 가 세션을 지원한다면, `sessionArg`(예: `--session-id`) 또는 ID 를 여러 플래그에 삽입해야 할 때 `sessionArgs`(플레이스홀더 `{sessionId}`) 를 설정하십시오.
- CLI 가 서로 다른 플래그를 사용하는 **resume 서브커맨드**를 사용한다면, `resumeArgs`(재개 시 `args` 를 대체) 및 선택적으로 `resumeOutput`(JSON 이 아닌 resume 용) 를 설정하십시오.
- `sessionMode`:
  - `always`: 항상 세션 id 를 전송합니다(저장된 것이 없으면 새 UUID).
  - `existing`: 이전에 저장된 세션 id 가 있을 때만 전송합니다.
  - `none`: 세션 id 를 절대 전송하지 않습니다.

## 이미지(패스스루)

CLI 가 이미지 경로를 받아들인다면, `imageArg` 를 설정하십시오:

```json5
imageArg: "--image",
imageMode: "repeat"
```

OpenClaw 는 base64 이미지를 임시 파일로 씁니다. `imageArg` 가 설정되어 있으면, 그 경로들이 CLI 인자로 전달됩니다. `imageArg` 가 없으면, OpenClaw 는 파일 경로를 프롬프트에 추가합니다(경로 인젝션). 이는 일반 경로 문자열로부터 로컬 파일을 자동 로드하는 CLI(Claude Code CLI 동작) 에는 충분합니다.

## 입력 / 출력

- `output: "json"`(기본값) 는 JSON 을 파싱하여 텍스트 + 세션 id 를 추출하려고 시도합니다.
- `output: "jsonl"` 는 JSONL 스트림(Codex CLI `--json`) 을 파싱하고, 마지막 에이전트 메시지와 존재할 경우 `thread_id` 를 추출합니다.
- `output: "text"` 는 stdout 를 최종 응답으로 취급합니다.

입력 모드:

- `input: "arg"`(기본값) 는 프롬프트를 마지막 CLI 인자로 전달합니다.
- `input: "stdin"` 는 프롬프트를 stdin 으로 전송합니다.
- 프롬프트가 매우 길고 `maxPromptArgChars` 가 설정되어 있으면 stdin 이 사용됩니다.

## 기본값(내장)

OpenClaw 는 `claude-cli` 의 기본값을 제공합니다:

- `command: "claude"`
- `args: ["-p", "--output-format", "json", "--dangerously-skip-permissions"]`
- `resumeArgs: ["-p", "--output-format", "json", "--dangerously-skip-permissions", "--resume", "{sessionId}"]`
- `modelArg: "--model"`
- `systemPromptArg: "--append-system-prompt"`
- `sessionArg: "--session-id"`
- `systemPromptWhen: "first"`
- `sessionMode: "always"`

OpenClaw 는 또한 `codex-cli` 의 기본값을 제공합니다:

- `command: "codex"`
- `args: ["exec","--json","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `resumeArgs: ["exec","resume","{sessionId}","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `output: "jsonl"`
- `resumeOutput: "text"`
- `modelArg: "--model"`
- `imageArg: "--image"`
- `sessionMode: "existing"`

필요한 경우에만 오버라이드하십시오(일반적으로: 절대 `command` 경로).

## 제한 사항

- **OpenClaw 도구 없음**(CLI 백엔드는 도구 호출을 절대 받지 않습니다). 일부 CLI 는 자체 에이전트 도구를 실행할 수는 있습니다.
- **스트리밍 없음**(CLI 출력은 수집된 뒤 반환됩니다).
- **구조화된 출력**은 CLI 의 JSON 형식에 의존합니다.
- **Codex CLI 세션**은 텍스트 출력( JSONL 없음)으로 재개되며, 초기 `--json` 실행보다 덜 구조화되어 있습니다. OpenClaw 세션은 여전히 정상적으로 동작합니다.

## 문제 해결

- **CLI 를 찾을 수 없음**: `command` 를 전체 경로로 설정하십시오.
- **잘못된 모델 이름**: `modelAliases` 를 사용하여 `provider/model` → CLI 모델로 매핑하십시오.
- **세션 연속성 없음**: `sessionArg` 가 설정되어 있고 `sessionMode` 가 `none` 이 아닌지 확인하십시오(Codex CLI 는 현재 JSON 출력으로 재개할 수 없습니다).
- **이미지가 무시됨**: `imageArg` 를 설정하십시오(그리고 CLI 가 파일 경로를 지원하는지 확인하십시오).
