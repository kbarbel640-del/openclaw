---
summary: "~/.openclaw/openclaw.json 에 대한 모든 설정 옵션과 예제"
read_when:
  - 설정 필드 추가 또는 수정 시
title: "구성"
x-i18n:
  source_path: gateway/configuration.md
  source_hash: 53b6b8a615c4ce02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:13Z
---

# 구성 🔧

OpenClaw 는 `~/.openclaw/openclaw.json` 에서 선택적 **JSON5** 설정을 읽습니다 (주석 + 후행 콤마 허용).

파일이 없으면 OpenClaw 는 안전한 기본값(내장 Pi 에이전트 + 발신자별 세션 + 워크스페이스 `~/.openclaw/workspace`)을 사용합니다. 일반적으로 설정이 필요한 경우는 다음과 같습니다:

- 봇을 트리거할 수 있는 사용자를 제한(`channels.whatsapp.allowFrom`, `channels.telegram.allowFrom` 등)
- 그룹 허용 목록 및 멘션 동작 제어(`channels.whatsapp.groups`, `channels.telegram.groups`, `channels.discord.guilds`, `agents.list[].groupChat`)
- 메시지 접두사 사용자 지정(`messages`)
- 에이전트의 워크스페이스 설정(`agents.defaults.workspace` 또는 `agents.list[].workspace`)
- 내장 에이전트 기본값(`agents.defaults`) 및 세션 동작(`session`) 튜닝
- 에이전트별 아이덴티티 설정(`agents.list[].identity`)

> **설정이 처음이신가요?** 자세한 설명이 포함된 전체 예제는 [Configuration Examples](/gateway/configuration-examples) 가이드를 확인하세요!

## 엄격한 설정 검증

OpenClaw 는 스키마와 완전히 일치하는 설정만 허용합니다.
알 수 없는 키, 잘못된 타입, 유효하지 않은 값이 있으면 안전을 위해 Gateway(게이트웨이)가 **시작을 거부**합니다.

검증에 실패하면:

- Gateway(게이트웨이)가 부팅되지 않습니다.
- 진단 명령만 허용됩니다(예: `openclaw doctor`, `openclaw logs`, `openclaw health`, `openclaw status`, `openclaw service`, `openclaw help`).
- 정확한 문제를 확인하려면 `openclaw doctor` 를 실행하세요.
- 마이그레이션/복구를 적용하려면 `openclaw doctor --fix` (또는 `--yes`)를 실행하세요.

Doctor 는 `--fix`/`--yes` 에 명시적으로 동의하지 않는 한 변경 사항을 작성하지 않습니다.

## 스키마 + UI 힌트

Gateway(게이트웨이)는 UI 편집기를 위해 `config.schema` 를 통해 설정의 JSON Schema 표현을 노출합니다.
Control UI 는 이 스키마로부터 폼을 렌더링하며, 탈출구로 **Raw JSON** 편집기를 제공합니다.

채널 플러그인과 확장은 설정에 대한 스키마 + UI 힌트를 등록할 수 있으므로,
하드코딩된 폼 없이도 앱 전반에서 스키마 기반 설정을 유지할 수 있습니다.

힌트(라벨, 그룹화, 민감 필드)는 스키마와 함께 제공되어,
클라이언트가 설정 지식의 하드코딩 없이 더 나은 폼을 렌더링할 수 있습니다.

## 적용 + 재시작 (RPC)

`config.apply` 을 사용하면 전체 설정을 검증 + 작성하고 한 번에 Gateway(게이트웨이)를 재시작할 수 있습니다.
재시작 센티넬을 기록하고 Gateway(게이트웨이)가 다시 올라온 후 마지막 활성 세션에 핑을 보냅니다.

경고: `config.apply` 는 **전체 설정을 대체**합니다. 몇 개의 키만 변경하려면
`config.patch` 또는 `openclaw config set` 를 사용하세요. `~/.openclaw/openclaw.json` 의 백업을 유지하세요.

매개변수:

- `raw` (string) — 전체 설정에 대한 JSON5 페이로드
- `baseHash` (선택) — `config.get` 의 설정 해시(이미 설정이 존재할 경우 필수)
- `sessionKey` (선택) — 웨이크업 핑을 위한 마지막 활성 세션 키
- `note` (선택) — 재시작 센티넬에 포함할 노트
- `restartDelayMs` (선택) — 재시작 전 지연 시간(기본값 2000)

예제(`gateway call` 통해):

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.apply --params '{
  "raw": "{\\n  agents: { defaults: { workspace: \\"~/.openclaw/workspace\\" } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## 부분 업데이트 (RPC)

`config.patch` 을 사용하면 관련 없는 키를 덮어쓰지 않고
기존 설정에 부분 업데이트를 병합할 수 있습니다. JSON 병합 패치 의미론을 적용합니다:

- 객체는 재귀적으로 병합
- `null` 는 키 삭제
- 배열은 교체
  `config.apply` 와 마찬가지로 검증 후 설정을 작성하고 재시작 센티넬을 저장한 뒤
  Gateway(게이트웨이) 재시작을 예약합니다(`sessionKey` 이 제공되면 선택적 웨이크업 포함).

매개변수:

- `raw` (string) — 변경할 키만 포함한 JSON5 페이로드
- `baseHash` (필수) — `config.get` 의 설정 해시
- `sessionKey` (선택) — 웨이크업 핑을 위한 마지막 활성 세션 키
- `note` (선택) — 재시작 센티넬에 포함할 노트
- `restartDelayMs` (선택) — 재시작 전 지연 시간(기본값 2000)

예제:

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.patch --params '{
  "raw": "{\\n  channels: { telegram: { groups: { \\"*\\": { requireMention: false } } } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## 최소 설정(권장 시작점)

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

다음으로 기본 이미지를 한 번 빌드합니다:

```bash
scripts/sandbox-setup.sh
```

## 셀프 채팅 모드(그룹 제어에 권장)

그룹에서 WhatsApp @-멘션에 봇이 응답하지 않도록 하고(특정 텍스트 트리거에만 응답):

```json5
{
  agents: {
    defaults: { workspace: "~/.openclaw/workspace" },
    list: [
      {
        id: "main",
        groupChat: { mentionPatterns: ["@openclaw", "reisponde"] },
      },
    ],
  },
  channels: {
    whatsapp: {
      // Allowlist is DMs only; including your own number enables self-chat mode.
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## 설정 포함(`$include`)

`$include` 지시어를 사용해 설정을 여러 파일로 분할할 수 있습니다. 다음과 같은 경우에 유용합니다:

- 대규모 설정 정리(예: 클라이언트별 에이전트 정의)
- 환경 간 공통 설정 공유
- 민감한 설정 분리

### 기본 사용법

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789 },

  // Include a single file (replaces the key's value)
  agents: { $include: "./agents.json5" },

  // Include multiple files (deep-merged in order)
  broadcast: {
    $include: ["./clients/mueller.json5", "./clients/schmidt.json5"],
  },
}
```

```json5
// ~/.openclaw/agents.json5
{
  defaults: { sandbox: { mode: "all", scope: "session" } },
  list: [{ id: "main", workspace: "~/.openclaw/workspace" }],
}
```

### 병합 동작

- **단일 파일**: `$include` 를 포함한 객체를 대체
- **파일 배열**: 순서대로 딥 병합(뒤의 파일이 앞의 파일을 덮어씀)
- **형제 키와 함께**: 포함 후 형제 키 병합(포함된 값 덮어씀)
- **형제 키 + 배열/프리미티브**: 지원되지 않음(포함된 콘텐츠는 객체여야 함)

```json5
// Sibling keys override included values
{
  $include: "./base.json5", // { a: 1, b: 2 }
  b: 99, // Result: { a: 1, b: 99 }
}
```

### 중첩 포함

포함된 파일은 최대 10 단계까지 `$include` 지시어를 포함할 수 있습니다:

```json5
// clients/mueller.json5
{
  agents: { $include: "./mueller/agents.json5" },
  broadcast: { $include: "./mueller/broadcast.json5" },
}
```

### 경로 해석

- **상대 경로**: 포함하는 파일 기준으로 해석
- **절대 경로**: 그대로 사용
- **상위 디렉토리**: `../` 참조는 정상 동작

```json5
{ "$include": "./sub/config.json5" }      // relative
{ "$include": "/etc/openclaw/base.json5" } // absolute
{ "$include": "../shared/common.json5" }   // parent dir
```

### 오류 처리

- **파일 누락**: 해석된 경로와 함께 명확한 오류
- **파싱 오류**: 실패한 포함 파일 표시
- **순환 포함**: 포함 체인과 함께 감지 및 보고

### 예제: 다중 클라이언트 법적 설정

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789, auth: { token: "secret" } },

  // Common agent defaults
  agents: {
    defaults: {
      sandbox: { mode: "all", scope: "session" },
    },
    // Merge agent lists from all clients
    list: { $include: ["./clients/mueller/agents.json5", "./clients/schmidt/agents.json5"] },
  },

  // Merge broadcast configs
  broadcast: {
    $include: ["./clients/mueller/broadcast.json5", "./clients/schmidt/broadcast.json5"],
  },

  channels: { whatsapp: { groupPolicy: "allowlist" } },
}
```

```json5
// ~/.openclaw/clients/mueller/agents.json5
[
  { id: "mueller-transcribe", workspace: "~/clients/mueller/transcribe" },
  { id: "mueller-docs", workspace: "~/clients/mueller/docs" },
]
```

```json5
// ~/.openclaw/clients/mueller/broadcast.json5
{
  "120363403215116621@g.us": ["mueller-transcribe", "mueller-docs"],
}
```

## 공통 옵션

### 환경 변수 + `.env`

OpenClaw 는 부모 프로세스(셸, launchd/systemd, CI 등)의 환경 변수를 읽습니다.

추가로 다음을 로드합니다:

- 현재 작업 디렉토리의 `.env`(존재 시)
- `~/.openclaw/.env` 의 전역 대체 `.env`(별칭: `$OPENCLAW_STATE_DIR/.env`)

`.env` 파일은 기존 환경 변수를 덮어쓰지 않습니다.

설정에서 인라인 환경 변수를 제공할 수도 있습니다. 이는
프로세스 환경에 키가 없을 때만 적용됩니다(동일한 비덮어쓰기 규칙):

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

우선순위와 소스의 전체 내용은 [/environment](/environment)를 참고하세요.

### `env.shellEnv` (선택)

편의 기능(옵트인): 활성화되고 아직 예상 키가 설정되지 않았으면,
OpenClaw 는 로그인 셸을 실행하여 누락된 예상 키만 가져옵니다(절대 덮어쓰지 않음).
이는 셸 프로필을 소싱하는 것과 동일합니다.

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

환경 변수 대응:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

### 설정에서의 환경 변수 치환

`${VAR_NAME}` 구문을 사용해 모든 설정 문자열 값에서 환경 변수를 직접 참조할 수 있습니다.
변수는 검증 전에 설정 로드 시점에 치환됩니다.

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
  gateway: {
    auth: {
      token: "${OPENCLAW_GATEWAY_TOKEN}",
    },
  },
}
```

**규칙:**

- 대문자 환경 변수 이름만 매칭: `[A-Z_][A-Z0-9_]*`
- 누락되거나 비어 있는 환경 변수는 설정 로드 시 오류
- 리터럴 `${VAR}` 를 출력하려면 `$${VAR}` 로 이스케이프
- `$include` 와 함께 동작(포함 파일도 치환 적용)

**인라인 치환:**

```json5
{
  models: {
    providers: {
      custom: {
        baseUrl: "${CUSTOM_API_BASE}/v1", // → "https://api.example.com/v1"
      },
    },
  },
}
```

### 인증 저장소(OAuth + API 키)

OpenClaw 는 **에이전트별** 인증 프로필(OAuth + API 키)을 다음에 저장합니다:

- `<agentDir>/auth-profiles.json`(기본값: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`)

참고: [/concepts/oauth](/concepts/oauth)

레거시 OAuth 가져오기:

- `~/.openclaw/credentials/oauth.json`(또는 `$OPENCLAW_STATE_DIR/credentials/oauth.json`)

내장 Pi 에이전트는 다음 위치에 런타임 캐시를 유지합니다:

- `<agentDir>/auth.json`(자동 관리; 수동 편집 금지)

레거시 에이전트 디렉토리(멀티 에이전트 이전):

- `~/.openclaw/agent/*`(`openclaw doctor` 가 `~/.openclaw/agents/<defaultAgentId>/agent/*` 로 마이그레이션)

재정의:

- OAuth 디렉토리(레거시 가져오기 전용): `OPENCLAW_OAUTH_DIR`
- 에이전트 디렉토리(기본 에이전트 루트 재정의): `OPENCLAW_AGENT_DIR`(권장), `PI_CODING_AGENT_DIR`(레거시)

첫 사용 시 OpenClaw 는 `oauth.json` 항목을 `auth-profiles.json` 로 가져옵니다.

### `auth`

인증 프로필을 위한 선택적 메타데이터입니다. 비밀은 저장하지 않으며,
프로필 ID 를 프로바이더 + 모드(및 선택적 이메일)에 매핑하고
페일오버에 사용되는 프로바이더 회전 순서를 정의합니다.

```json5
{
  auth: {
    profiles: {
      "anthropic:me@example.com": { provider: "anthropic", mode: "oauth", email: "me@example.com" },
      "anthropic:work": { provider: "anthropic", mode: "api_key" },
    },
    order: {
      anthropic: ["anthropic:me@example.com", "anthropic:work"],
    },
  },
}
```

### `agents.list[].identity`

기본값과 UX 에 사용되는 선택적 에이전트 아이덴티티입니다. macOS 온보딩 어시스턴트가 기록합니다.

설정 시(명시적으로 설정하지 않은 경우에만) OpenClaw 는 기본값을 파생합니다:

- **활성 에이전트**의 `identity.emoji` 로부터 `messages.ackReaction` (기본값 👀)
- 에이전트의 `identity.name`/`identity.emoji` 로부터 `agents.list[].groupChat.mentionPatterns`
  (Telegram/Slack/Discord/Google Chat/iMessage/WhatsApp 그룹에서 “@Samantha” 사용 가능)
- `identity.avatar` 는 워크스페이스 상대 이미지 경로 또는 원격 URL/data URL 을 허용합니다. 로컬 파일은 에이전트 워크스페이스 내부에 있어야 합니다.

`identity.avatar` 는 다음을 허용합니다:

- 워크스페이스 상대 경로(에이전트 워크스페이스 내부 유지)
- `http(s)` URL
- `data:` URI

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Samantha",
          theme: "helpful sloth",
          emoji: "🦥",
          avatar: "avatars/samantha.png",
        },
      },
    ],
  },
}
```

### `wizard`

CLI 마법사(`onboard`, `configure`, `doctor`)가 기록하는 메타데이터입니다.

```json5
{
  wizard: {
    lastRunAt: "2026-01-01T00:00:00.000Z",
    lastRunVersion: "2026.1.4",
    lastRunCommit: "abc1234",
    lastRunCommand: "configure",
    lastRunMode: "local",
  },
}
```

### `logging`

- 기본 로그 파일: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- 안정적인 경로가 필요하면 `logging.file` 를 `/tmp/openclaw/openclaw.log` 로 설정하세요.
- 콘솔 출력은 다음으로 별도 조정할 수 있습니다:
  - `logging.consoleLevel`(기본값 `info`, `--verbose` 시 `debug` 로 상향)
  - `logging.consoleStyle`(`pretty` | `compact` | `json`)
- 도구 요약은 비밀 유출 방지를 위해 마스킹할 수 있습니다:
  - `logging.redactSensitive`(`off` | `tools`, 기본값: `tools`)
  - `logging.redactPatterns`(정규식 문자열 배열; 기본값 재정의)

```json5
{
  logging: {
    level: "info",
    file: "/tmp/openclaw/openclaw.log",
    consoleLevel: "info",
    consoleStyle: "pretty",
    redactSensitive: "tools",
    redactPatterns: [
      // Example: override defaults with your own rules.
      "\\bTOKEN\\b\\s*[=:]\\s*([\"']?)([^\\s\"']+)\\1",
      "/\\bsk-[A-Za-z0-9_-]{8,}\\b/gi",
    ],
  },
}
```

_다음: [Agent Runtime](/concepts/agent)_ 🦞
