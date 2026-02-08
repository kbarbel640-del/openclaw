---
summary: "에이전트 런타임 (임베디드 pi-mono), 워크스페이스 계약, 그리고 세션 부트스트랩"
read_when:
  - 에이전트 런타임, 워크스페이스 부트스트랩, 또는 세션 동작을 변경할 때
title: "에이전트 런타임"
x-i18n:
  source_path: concepts/agent.md
  source_hash: 04b4e0bc6345d2af
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:43Z
---

# 에이전트 런타임 🤖

OpenClaw 는 **pi-mono** 에서 파생된 단일 임베디드 에이전트 런타임을 실행합니다.

## 워크스페이스 (필수)

OpenClaw 는 단일 에이전트 워크스페이스 디렉토리 (`agents.defaults.workspace`) 를 에이전트의 **유일한** 작업 디렉토리 (`cwd`) 로 사용하여 도구와 컨텍스트를 처리합니다.

권장 사항: 누락된 경우 `openclaw setup` 를 사용해 `~/.openclaw/openclaw.json` 를 생성하고 워크스페이스 파일을 초기화합니다.

전체 워크스페이스 레이아웃 + 백업 가이드: [Agent workspace](/concepts/agent-workspace)

`agents.defaults.sandbox` 가 활성화된 경우, 메인 세션이 아닌 세션은
`agents.defaults.sandbox.workspaceRoot` 아래의 세션별 워크스페이스로 이를 재정의할 수 있습니다
([Gateway configuration](/gateway/configuration) 참고).

## 부트스트랩 파일 (주입됨)

`agents.defaults.workspace` 내부에서 OpenClaw 는 다음과 같은 사용자 편집 가능 파일을 기대합니다:

- `AGENTS.md` — 운영 지침 + '메모리'
- `SOUL.md` — 페르소나, 경계, 톤
- `TOOLS.md` — 사용자가 유지 관리하는 도구 노트 (예: `imsg`, `sag`, 규칙)
- `BOOTSTRAP.md` — 최초 실행 시 한 번만 수행하는 의식 (완료 후 삭제됨)
- `IDENTITY.md` — 에이전트 이름 / 분위기 / 이모지
- `USER.md` — 사용자 프로필 + 선호 호칭

새 세션의 첫 턴에서 OpenClaw 는 이 파일들의 내용을 에이전트 컨텍스트에 직접 주입합니다.

빈 파일은 건너뜁니다. 큰 파일은 프롬프트를 간결하게 유지하기 위해 마커와 함께 잘려서 트렁케이트됩니다 (전체 내용은 파일을 직접 읽으십시오).

파일이 누락된 경우, OpenClaw 는 단일 'missing file' 마커 라인을 주입합니다 (그리고 `openclaw setup` 이 안전한 기본 템플릿을 생성합니다).

`BOOTSTRAP.md` 은 **완전히 새로운 워크스페이스** (다른 부트스트랩 파일이 전혀 없는 경우) 에서만 생성됩니다. 의식을 완료한 후 이를 삭제하면, 이후 재시작 시 다시 생성되지 않아야 합니다.

부트스트랩 파일 생성을 완전히 비활성화하려면 (사전 시드된 워크스페이스의 경우) 다음을 설정하십시오:

```json5
{ agent: { skipBootstrap: true } }
```

## 내장 도구

핵심 도구 (읽기 / 실행 / 편집 / 쓰기 및 관련 시스템 도구) 는 도구 정책의 적용을 받으며 항상 사용 가능합니다.
`apply_patch` 은 선택 사항이며 `tools.exec.applyPatch` 에 의해 게이트됩니다.
`TOOLS.md` 은 어떤 도구가 존재하는지를 제어하지 않으며, 도구를 _어떻게_ 사용하길 원하는지에 대한 가이드입니다.

## Skills

OpenClaw 는 세 위치에서 Skills 를 로드합니다 (이름 충돌 시 워크스페이스가 우선합니다):

- 번들됨 (설치와 함께 제공)
- 관리됨 / 로컬: `~/.openclaw/skills`
- 워크스페이스: `<workspace>/skills`

Skills 는 설정 / 환경 변수에 의해 제한될 수 있습니다 ([Gateway configuration](/gateway/configuration) 의 `skills` 참고).

## pi-mono 통합

OpenClaw 는 pi-mono 코드베이스의 일부 (모델 / 도구) 를 재사용하지만,
**세션 관리, 디바이스 검색, 도구 연결은 OpenClaw 소유입니다**.

- pi-coding 에이전트 런타임 없음.
- `~/.pi/agent` 또는 `<workspace>/.pi` 설정을 참조하지 않습니다.

## 세션

세션 트랜스크립트는 다음 위치에 JSONL 형식으로 저장됩니다:

- `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

세션 ID 는 안정적이며 OpenClaw 가 선택합니다.
레거시 Pi / Tau 세션 폴더는 **읽지 않습니다**.

## 스트리밍 중 스티어링

큐 모드가 `steer` 인 경우, 수신 메시지는 현재 실행 중인 런에 주입됩니다.
큐는 **각 도구 호출 이후** 검사됩니다; 큐에 메시지가 있으면,
현재 어시스턴트 메시지에서 남아 있는 도구 호출은 건너뜁니다
('Skipped due to queued user message.' 오류 도구 결과),
그런 다음 다음 어시스턴트 응답 전에 대기 중인 사용자 메시지가 주입됩니다.

큐 모드가 `followup` 또는 `collect` 인 경우, 수신 메시지는
현재 턴이 끝날 때까지 보류되며, 이후 대기 중인 페이로드로 새 에이전트 턴이 시작됩니다.
모드 + 디바운스 / 캡 동작에 대해서는 [Queue](/concepts/queue) 를 참조하십시오.

블록 스트리밍은 완료된 어시스턴트 블록을 즉시 전송하며,
기본값은 **비활성화** 입니다 (`agents.defaults.blockStreamingDefault: "off"`).
경계는 `agents.defaults.blockStreamingBreak` (`text_end` vs `message_end`; 기본값은 text_end) 로 조정합니다.
소프트 블록 청킹은 `agents.defaults.blockStreamingChunk` 로 제어합니다 (기본값
800–1200 자; 단락 구분을 우선, 다음으로 줄바꿈, 문장은 마지막).
스트리밍된 청크는 `agents.defaults.blockStreamingCoalesce` 로 병합하여
단일 라인 스팸을 줄일 수 있습니다 (전송 전 유휴 기반 병합).
Telegram 이 아닌 채널은 블록 답장을 활성화하려면
명시적인 `*.blockStreaming: true` 이 필요합니다.
상세한 도구 요약은 도구 시작 시 출력됩니다 (디바운스 없음);
Control UI 는 가능한 경우 에이전트 이벤트를 통해 도구 출력을 스트리밍합니다.
자세한 내용은: [Streaming + chunking](/concepts/streaming).

## 모델 참조

설정에서의 모델 참조 (예: `agents.defaults.model` 및 `agents.defaults.models`) 는
**첫 번째** `/` 를 기준으로 분리하여 파싱됩니다.

- 모델을 설정할 때는 `provider/model` 을 사용하십시오.
- 모델 ID 자체에 `/` 이 포함된 경우 (OpenRouter 스타일),
  프로바이더 접두사를 포함해야 합니다 (예: `openrouter/moonshotai/kimi-k2`).
- 프로바이더를 생략하면, OpenClaw 는 입력을 별칭 또는
  **기본 프로바이더** 용 모델로 처리합니다
  (모델 ID 에 `/` 이 없는 경우에만 동작).

## 설정 (최소)

최소한 다음을 설정하십시오:

- `agents.defaults.workspace`
- `channels.whatsapp.allowFrom` (강력히 권장)

---

_다음: [Group Chats](/concepts/group-messages)_ 🦞
