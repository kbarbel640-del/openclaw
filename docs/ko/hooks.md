---
summary: "훅: 명령 및 라이프사이클 이벤트를 위한 이벤트 기반 자동화"
read_when:
  - /new, /reset, /stop 및 에이전트 라이프사이클 이벤트를 위한 이벤트 기반 자동화가 필요합니다
  - 훅을 빌드, 설치 또는 디버그하고자 합니다
title: "훅"
x-i18n:
  source_path: hooks.md
  source_hash: 853227a0f1abd207
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:03Z
---

# 훅

훅은 에이전트 명령과 이벤트에 대한 응답으로 작업을 자동화하기 위한 확장 가능한 이벤트 기반 시스템을 제공합니다. 훅은 디렉토리에서 자동으로 디스커버리되며, OpenClaw 에서 skills 가 작동하는 방식과 유사하게 CLI 명령을 통해 관리할 수 있습니다.

## 개요 파악하기

훅은 어떤 일이 발생했을 때 실행되는 작은 스크립트입니다. 두 가지 종류가 있습니다:

- **훅** (이 페이지): `/new`, `/reset`, `/stop` 또는 라이프사이클 이벤트처럼 에이전트 이벤트가 발생할 때 Gateway(게이트웨이) 내부에서 실행됩니다.
- **웹훅**: 다른 시스템이 OpenClaw 에서 작업을 트리거할 수 있도록 하는 외부 HTTP 웹훅입니다. [Webhook Hooks](/automation/webhook)를 참고하거나 Gmail 헬퍼 명령에는 `openclaw webhooks` 를 사용합니다.

훅은 플러그인 안에 번들로 포함될 수도 있습니다. [Plugins](/plugin#plugin-hooks)를 참고하십시오.

일반적인 사용 사례:

- 세션을 리셋할 때 메모리 스냅샷 저장
- 문제 해결 또는 컴플라이언스를 위해 명령의 감사 추적 유지
- 세션 시작 또는 종료 시 후속 자동화 트리거
- 이벤트가 발생할 때 에이전트 워크스페이스에 파일을 작성하거나 외부 API 호출

작은 TypeScript 함수를 작성할 수 있다면 훅을 작성할 수 있습니다. 훅은 자동으로 디스커버리되며, CLI 를 통해 활성화 또는 비활성화합니다.

## 개요

훅 시스템을 통해 다음을 할 수 있습니다:

- `/new` 가 실행될 때 세션 컨텍스트를 메모리에 저장
- 감사 목적을 위해 모든 명령을 로깅
- 에이전트 라이프사이클 이벤트에서 사용자 정의 자동화 트리거
- 코어 코드를 수정하지 않고 OpenClaw 의 동작 확장

## 시작하기

### 번들 훅

OpenClaw 에는 자동으로 디스커버리되는 네 가지 번들 훅이 포함되어 있습니다:

- **💾 session-memory**: `/new` 을 실행하면 세션 컨텍스트를 에이전트 워크스페이스(기본 `~/.openclaw/workspace/memory/`)에 저장합니다
- **📝 command-logger**: 모든 명령 이벤트를 `~/.openclaw/logs/commands.log` 에 로깅합니다
- **🚀 boot-md**: 게이트웨이가 시작될 때 `BOOT.md` 를 실행합니다(내부 훅 활성화 필요)
- **😈 soul-evil**: 퍼지 윈도우 동안 또는 무작위 확률로 주입된 `SOUL.md` 콘텐츠를 `SOUL_EVIL.md` 로 교체합니다

사용 가능한 훅 나열:

```bash
openclaw hooks list
```

훅 활성화:

```bash
openclaw hooks enable session-memory
```

훅 상태 확인:

```bash
openclaw hooks check
```

상세 정보 가져오기:

```bash
openclaw hooks info session-memory
```

### 온보딩

온보딩(`openclaw onboard`) 중에는 권장 훅을 활성화하라는 안내가 표시됩니다. 마법사는 적격 훅을 자동으로 디스커버리하고 선택할 수 있도록 제시합니다.

## 훅 디스커버리

훅은 세 개의 디렉토리에서(우선순위 순) 자동으로 디스커버리됩니다:

1. **워크스페이스 훅**: `<workspace>/hooks/` (에이전트별, 최우선)
2. **관리형 훅**: `~/.openclaw/hooks/` (사용자 설치, 워크스페이스 간 공유)
3. **번들 훅**: `<openclaw>/dist/hooks/bundled/` (OpenClaw 와 함께 제공)

관리형 훅 디렉토리는 **단일 훅** 또는 **훅 팩**(패키지 디렉토리)일 수 있습니다.

각 훅은 다음을 포함하는 디렉토리입니다:

```
my-hook/
├── HOOK.md          # Metadata + documentation
└── handler.ts       # Handler implementation
```

## 훅 팩 (npm/아카이브)

훅 팩은 `package.json` 에서
`openclaw.hooks` 를 통해 하나 이상의 훅을 내보내는 표준 npm 패키지입니다. 다음으로 설치합니다:

```bash
openclaw hooks install <path-or-spec>
```

`package.json` 예시:

```json
{
  "name": "@acme/my-hooks",
  "version": "0.1.0",
  "openclaw": {
    "hooks": ["./hooks/my-hook", "./hooks/other-hook"]
  }
}
```

각 항목은 `HOOK.md` 및 `handler.ts`(또는 `index.ts`)를 포함하는 훅 디렉토리를 가리킵니다.
훅 팩은 의존성을 포함할 수 있으며, 의존성은 `~/.openclaw/hooks/<id>` 아래에 설치됩니다.

## 훅 구조

### HOOK.md 형식

`HOOK.md` 파일에는 YAML frontmatter 의 메타데이터와 Markdown 문서가 포함됩니다:

```markdown
---
name: my-hook
description: "Short description of what this hook does"
homepage: https://docs.openclaw.ai/hooks#my-hook
metadata:
  { "openclaw": { "emoji": "🔗", "events": ["command:new"], "requires": { "bins": ["node"] } } }
---

# My Hook

Detailed documentation goes here...

## What It Does

- Listens for `/new` commands
- Performs some action
- Logs the result

## Requirements

- Node.js must be installed

## Configuration

No configuration needed.
```

### 메타데이터 필드

`metadata.openclaw` 객체는 다음을 지원합니다:

- **`emoji`**: CLI 를 위한 표시 이모지(예: `"💾"`)
- **`events`**: 리슨할 이벤트 배열(예: `["command:new", "command:reset"]`)
- **`export`**: 사용할 named export(기본값은 `"default"`)
- **`homepage`**: 문서 URL
- **`requires`**: 선택 요구 사항
  - **`bins`**: PATH 에 있어야 하는 필수 바이너리(예: `["git", "node"]`)
  - **`anyBins`**: 이 바이너리 중 최소 하나는 존재해야 합니다
  - **`env`**: 필수 환경 변수
  - **`config`**: 필수 설정 경로(예: `["workspace.dir"]`)
  - **`os`**: 필수 플랫폼(예: `["darwin", "linux"]`)
- **`always`**: 적격성 검사 우회(boolean)
- **`install`**: 설치 방법(번들 훅의 경우: `[{"id":"bundled","kind":"bundled"}]`)

### 핸들러 구현

`handler.ts` 파일은 `HookHandler` 함수를 내보냅니다:

```typescript
import type { HookHandler } from "../../src/hooks/hooks.js";

const myHandler: HookHandler = async (event) => {
  // Only trigger on 'new' command
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  console.log(`[my-hook] New command triggered`);
  console.log(`  Session: ${event.sessionKey}`);
  console.log(`  Timestamp: ${event.timestamp.toISOString()}`);

  // Your custom logic here

  // Optionally send message to user
  event.messages.push("✨ My hook executed!");
};

export default myHandler;
```

#### 이벤트 컨텍스트

각 이벤트에는 다음이 포함됩니다:

```typescript
{
  type: 'command' | 'session' | 'agent' | 'gateway',
  action: string,              // e.g., 'new', 'reset', 'stop'
  sessionKey: string,          // Session identifier
  timestamp: Date,             // When the event occurred
  messages: string[],          // Push messages here to send to user
  context: {
    sessionEntry?: SessionEntry,
    sessionId?: string,
    sessionFile?: string,
    commandSource?: string,    // e.g., 'whatsapp', 'telegram'
    senderId?: string,
    workspaceDir?: string,
    bootstrapFiles?: WorkspaceBootstrapFile[],
    cfg?: OpenClawConfig
  }
}
```

## 이벤트 유형

### 명령 이벤트

에이전트 명령이 실행될 때 트리거됩니다:

- **`command`**: 모든 명령 이벤트(일반 리스너)
- **`command:new`**: `/new` 명령이 실행될 때
- **`command:reset`**: `/reset` 명령이 실행될 때
- **`command:stop`**: `/stop` 명령이 실행될 때

### 에이전트 이벤트

- **`agent:bootstrap`**: 워크스페이스 부트스트랩 파일이 주입되기 전(훅은 `context.bootstrapFiles` 을 변경할 수 있음)

### Gateway(게이트웨이) 이벤트

게이트웨이가 시작될 때 트리거됩니다:

- **`gateway:startup`**: 채널이 시작되고 훅이 로드된 이후

### 도구 결과 훅 (플러그인 API)

이 훅들은 이벤트 스트림 리스너가 아닙니다. 플러그인이 OpenClaw 가 도구 결과를 저장하기 전에 동기적으로 결과를 조정할 수 있게 합니다.

- **`tool_result_persist`**: 세션 트랜스크립트에 기록되기 전에 도구 결과를 변환합니다. 반드시 동기식이어야 하며, 업데이트된 도구 결과 페이로드를 반환하거나 그대로 유지하려면 `undefined` 를 반환합니다. [Agent Loop](/concepts/agent-loop)를 참고하십시오.

### 향후 이벤트

계획된 이벤트 유형:

- **`session:start`**: 새 세션이 시작될 때
- **`session:end`**: 세션이 종료될 때
- **`agent:error`**: 에이전트가 오류를 만날 때
- **`message:sent`**: 메시지가 전송될 때
- **`message:received`**: 메시지가 수신될 때

## 사용자 정의 훅 만들기

### 1. 위치 선택

- **워크스페이스 훅** (`<workspace>/hooks/`): 에이전트별, 최우선
- **관리형 훅** (`~/.openclaw/hooks/`): 워크스페이스 간 공유

### 2. 디렉토리 구조 생성

```bash
mkdir -p ~/.openclaw/hooks/my-hook
cd ~/.openclaw/hooks/my-hook
```

### 3. HOOK.md 생성

```markdown
---
name: my-hook
description: "Does something useful"
metadata: { "openclaw": { "emoji": "🎯", "events": ["command:new"] } }
---

# My Custom Hook

This hook does something useful when you issue `/new`.
```

### 4. handler.ts 생성

```typescript
import type { HookHandler } from "../../src/hooks/hooks.js";

const handler: HookHandler = async (event) => {
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  console.log("[my-hook] Running!");
  // Your logic here
};

export default handler;
```

### 5. 활성화 및 테스트

```bash
# Verify hook is discovered
openclaw hooks list

# Enable it
openclaw hooks enable my-hook

# Restart your gateway process (menu bar app restart on macOS, or restart your dev process)

# Trigger the event
# Send /new via your messaging channel
```

## 설정

### 새 설정 형식(권장)

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "session-memory": { "enabled": true },
        "command-logger": { "enabled": false }
      }
    }
  }
}
```

### 훅별 설정

훅은 사용자 정의 설정을 가질 수 있습니다:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "my-hook": {
          "enabled": true,
          "env": {
            "MY_CUSTOM_VAR": "value"
          }
        }
      }
    }
  }
}
```

### 추가 디렉토리

추가 디렉토리에서 훅을 로드합니다:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "load": {
        "extraDirs": ["/path/to/more/hooks"]
      }
    }
  }
}
```

### 레거시 설정 형식(여전히 지원됨)

이전 설정 형식은 하위 호환성을 위해 여전히 작동합니다:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "handlers": [
        {
          "event": "command:new",
          "module": "./hooks/handlers/my-handler.ts",
          "export": "default"
        }
      ]
    }
  }
}
```

**마이그레이션**: 새 훅에는 새로운 디스커버리 기반 시스템을 사용하십시오. 레거시 핸들러는 디렉토리 기반 훅 이후에 로드됩니다.

## CLI 명령

### 훅 나열

```bash
# List all hooks
openclaw hooks list

# Show only eligible hooks
openclaw hooks list --eligible

# Verbose output (show missing requirements)
openclaw hooks list --verbose

# JSON output
openclaw hooks list --json
```

### 훅 정보

```bash
# Show detailed info about a hook
openclaw hooks info session-memory

# JSON output
openclaw hooks info session-memory --json
```

### 적격성 확인

```bash
# Show eligibility summary
openclaw hooks check

# JSON output
openclaw hooks check --json
```

### 활성화/비활성화

```bash
# Enable a hook
openclaw hooks enable session-memory

# Disable a hook
openclaw hooks disable command-logger
```

## 번들 훅

### session-memory

`/new` 를 실행할 때 세션 컨텍스트를 메모리에 저장합니다.

**이벤트**: `command:new`

**요구 사항**: `workspace.dir` 이(가) 설정되어 있어야 합니다

**출력**: `<workspace>/memory/YYYY-MM-DD-slug.md` (기본값은 `~/.openclaw/workspace`)

**동작**:

1. 리셋 이전 세션 엔트리를 사용해 올바른 트랜스크립트를 찾습니다
2. 대화의 마지막 15줄을 추출합니다
3. LLM 을 사용해 설명적인 파일명 슬러그를 생성합니다
4. 세션 메타데이터를 날짜가 포함된 메모리 파일에 저장합니다

**출력 예시**:

```markdown
# Session: 2026-01-16 14:30:00 UTC

- **Session Key**: agent:main:main
- **Session ID**: abc123def456
- **Source**: telegram
```

**파일명 예시**:

- `2026-01-16-vendor-pitch.md`
- `2026-01-16-api-design.md`
- `2026-01-16-1430.md` (슬러그 생성에 실패할 경우의 폴백 타임스탬프)

**활성화**:

```bash
openclaw hooks enable session-memory
```

### command-logger

모든 명령 이벤트를 중앙 감사 파일에 로깅합니다.

**이벤트**: `command`

**요구 사항**: 없음

**출력**: `~/.openclaw/logs/commands.log`

**동작**:

1. 이벤트 세부 정보(명령 액션, 타임스탬프, 세션 키, 발신자 ID, 소스)를 캡처합니다
2. JSONL 형식으로 로그 파일에 추가합니다
3. 백그라운드에서 조용히 실행됩니다

**로그 엔트리 예시**:

```jsonl
{"timestamp":"2026-01-16T14:30:00.000Z","action":"new","sessionKey":"agent:main:main","senderId":"+1234567890","source":"telegram"}
{"timestamp":"2026-01-16T15:45:22.000Z","action":"stop","sessionKey":"agent:main:main","senderId":"user@example.com","source":"whatsapp"}
```

**로그 보기**:

```bash
# View recent commands
tail -n 20 ~/.openclaw/logs/commands.log

# Pretty-print with jq
cat ~/.openclaw/logs/commands.log | jq .

# Filter by action
grep '"action":"new"' ~/.openclaw/logs/commands.log | jq .
```

**활성화**:

```bash
openclaw hooks enable command-logger
```

### soul-evil

퍼지 윈도우 동안 또는 무작위 확률로 주입된 `SOUL.md` 콘텐츠를 `SOUL_EVIL.md` 로 교체합니다.

**이벤트**: `agent:bootstrap`

**문서**: [SOUL Evil Hook](/hooks/soul-evil)

**출력**: 파일은 작성되지 않으며, 교체는 메모리 내에서만 발생합니다.

**활성화**:

```bash
openclaw hooks enable soul-evil
```

**설정**:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "soul-evil": {
          "enabled": true,
          "file": "SOUL_EVIL.md",
          "chance": 0.1,
          "purge": { "at": "21:00", "duration": "15m" }
        }
      }
    }
  }
}
```

### boot-md

게이트웨이가 시작될 때(채널 시작 이후) `BOOT.md` 를 실행합니다.
이를 실행하려면 내부 훅이 활성화되어 있어야 합니다.

**이벤트**: `gateway:startup`

**요구 사항**: `workspace.dir` 이(가) 설정되어 있어야 합니다

**동작**:

1. 워크스페이스에서 `BOOT.md` 를 읽습니다
2. 에이전트 러너를 통해 지시사항을 실행합니다
3. 메시지 도구를 통해 요청된 모든 아웃바운드 메시지를 전송합니다

**활성화**:

```bash
openclaw hooks enable boot-md
```

## 모범 사례

### 핸들러를 빠르게 유지하기

훅은 명령 처리 중에 실행됩니다. 가볍게 유지하십시오:

```typescript
// ✓ Good - async work, returns immediately
const handler: HookHandler = async (event) => {
  void processInBackground(event); // Fire and forget
};

// ✗ Bad - blocks command processing
const handler: HookHandler = async (event) => {
  await slowDatabaseQuery(event);
  await evenSlowerAPICall(event);
};
```

### 오류를 우아하게 처리하기

항상 위험한 작업을 래핑하십시오:

```typescript
const handler: HookHandler = async (event) => {
  try {
    await riskyOperation(event);
  } catch (err) {
    console.error("[my-handler] Failed:", err instanceof Error ? err.message : String(err));
    // Don't throw - let other handlers run
  }
};
```

### 이벤트를 조기에 필터링하기

이벤트가 관련이 없다면 조기에 반환하십시오:

```typescript
const handler: HookHandler = async (event) => {
  // Only handle 'new' commands
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  // Your logic here
};
```

### 구체적인 이벤트 키 사용하기

가능하면 메타데이터에서 정확한 이벤트를 지정하십시오:

```yaml
metadata: { "openclaw": { "events": ["command:new"] } } # Specific
```

다음 대신:

```yaml
metadata: { "openclaw": { "events": ["command"] } } # General - more overhead
```

## 디버깅

### 훅 로깅 활성화

게이트웨이는 시작 시 훅 로딩을 로깅합니다:

```
Registered hook: session-memory -> command:new
Registered hook: command-logger -> command
Registered hook: boot-md -> gateway:startup
```

### 디스커버리 확인

디스커버리된 모든 훅을 나열합니다:

```bash
openclaw hooks list --verbose
```

### 등록 확인

핸들러에서 호출될 때 로깅합니다:

```typescript
const handler: HookHandler = async (event) => {
  console.log("[my-handler] Triggered:", event.type, event.action);
  // Your logic
};
```

### 적격성 검증

훅이 적격하지 않은 이유를 확인합니다:

```bash
openclaw hooks info my-hook
```

출력에서 누락된 요구 사항을 확인하십시오.

## 테스트

### Gateway(게이트웨이) 로그

훅 실행을 확인하기 위해 게이트웨이 로그를 모니터링합니다:

```bash
# macOS
./scripts/clawlog.sh -f

# Other platforms
tail -f ~/.openclaw/gateway.log
```

### 훅 직접 테스트

핸들러를 격리된 상태로 테스트합니다:

```typescript
import { test } from "vitest";
import { createHookEvent } from "./src/hooks/hooks.js";
import myHandler from "./hooks/my-hook/handler.js";

test("my handler works", async () => {
  const event = createHookEvent("command", "new", "test-session", {
    foo: "bar",
  });

  await myHandler(event);

  // Assert side effects
});
```

## 아키텍처

### 핵심 구성 요소

- **`src/hooks/types.ts`**: 타입 정의
- **`src/hooks/workspace.ts`**: 디렉토리 스캐닝 및 로딩
- **`src/hooks/frontmatter.ts`**: HOOK.md 메타데이터 파싱
- **`src/hooks/config.ts`**: 적격성 검사
- **`src/hooks/hooks-status.ts`**: 상태 보고
- **`src/hooks/loader.ts`**: 동적 모듈 로더
- **`src/cli/hooks-cli.ts`**: CLI 명령
- **`src/gateway/server-startup.ts`**: 게이트웨이 시작 시 훅 로드
- **`src/auto-reply/reply/commands-core.ts`**: 명령 이벤트 트리거

### 디스커버리 흐름

```
Gateway startup
    ↓
Scan directories (workspace → managed → bundled)
    ↓
Parse HOOK.md files
    ↓
Check eligibility (bins, env, config, os)
    ↓
Load handlers from eligible hooks
    ↓
Register handlers for events
```

### 이벤트 흐름

```
User sends /new
    ↓
Command validation
    ↓
Create hook event
    ↓
Trigger hook (all registered handlers)
    ↓
Command processing continues
    ↓
Session reset
```

## 문제 해결

### 훅이 디스커버리되지 않음

1. 디렉토리 구조 확인:

   ```bash
   ls -la ~/.openclaw/hooks/my-hook/
   # Should show: HOOK.md, handler.ts
   ```

2. HOOK.md 형식 검증:

   ```bash
   cat ~/.openclaw/hooks/my-hook/HOOK.md
   # Should have YAML frontmatter with name and metadata
   ```

3. 디스커버리된 모든 훅 나열:
   ```bash
   openclaw hooks list
   ```

### 훅이 적격하지 않음

요구 사항을 확인하십시오:

```bash
openclaw hooks info my-hook
```

누락 여부를 확인할 항목:

- 바이너리(PATH 확인)
- 환경 변수
- 설정 값
- OS 호환성

### 훅이 실행되지 않음

1. 훅이 활성화되어 있는지 확인:

   ```bash
   openclaw hooks list
   # Should show ✓ next to enabled hooks
   ```

2. 훅이 다시 로드되도록 게이트웨이 프로세스를 재시작하십시오.

3. 오류가 있는지 게이트웨이 로그를 확인:
   ```bash
   ./scripts/clawlog.sh | grep hook
   ```

### 핸들러 오류

TypeScript/import 오류를 확인하십시오:

```bash
# Test import directly
node -e "import('./path/to/handler.ts').then(console.log)"
```

## 마이그레이션 가이드

### 레거시 설정에서 디스커버리로

**이전**:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "handlers": [
        {
          "event": "command:new",
          "module": "./hooks/handlers/my-handler.ts"
        }
      ]
    }
  }
}
```

**이후**:

1. 훅 디렉토리 생성:

   ```bash
   mkdir -p ~/.openclaw/hooks/my-hook
   mv ./hooks/handlers/my-handler.ts ~/.openclaw/hooks/my-hook/handler.ts
   ```

2. HOOK.md 생성:

   ```markdown
   ---
   name: my-hook
   description: "My custom hook"
   metadata: { "openclaw": { "emoji": "🎯", "events": ["command:new"] } }
   ---

   # My Hook

   Does something useful.
   ```

3. 설정 업데이트:

   ```json
   {
     "hooks": {
       "internal": {
         "enabled": true,
         "entries": {
           "my-hook": { "enabled": true }
         }
       }
     }
   }
   ```

4. 게이트웨이 프로세스를 검증하고 재시작하십시오:
   ```bash
   openclaw hooks list
   # Should show: 🎯 my-hook ✓
   ```

**마이그레이션의 이점**:

- 자동 디스커버리
- CLI 관리
- 적격성 검사
- 더 나은 문서화
- 일관된 구조

## 함께 보기

- [CLI Reference: hooks](/cli/hooks)
- [Bundled Hooks README](https://github.com/openclaw/openclaw/tree/main/src/hooks/bundled)
- [Webhook Hooks](/automation/webhook)
- [Configuration](/gateway/configuration#hooks)
