---
summary: "멀티 에이전트 라우팅: 격리된 에이전트, 채널 계정, 바인딩"
title: 멀티 에이전트 라우팅
read_when: "하나의 Gateway 프로세스에서 여러 개의 격리된 에이전트(워크스페이스 + 인증)를 사용하려는 경우."
status: active
x-i18n:
  source_path: concepts/multi-agent.md
  source_hash: 49b3ba55d8a7f0b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:50Z
---

# 멀티 에이전트 라우팅

목표: 하나의 실행 중인 Gateway에서 여러 개의 _격리된_ 에이전트(각각 분리된 워크스페이스 + `agentDir` + 세션), 그리고 여러 개의 채널 계정(예: WhatsApp 두 개)을 함께 운용합니다. 인바운드 메시지는 바인딩을 통해 특정 에이전트로 라우팅됩니다.

## “하나의 에이전트”란?

**에이전트**는 다음을 각각 독립적으로 갖는 완전하게 스코프된 하나의 두뇌입니다:

- **워크스페이스** (파일, AGENTS.md/SOUL.md/USER.md, 로컬 노트, 페르소나 규칙).
- **상태 디렉토리** (`agentDir`) — 인증 프로필, 모델 레지스트리, 에이전트별 설정을 포함합니다.
- **세션 저장소** (채팅 기록 + 라우팅 상태) — `~/.openclaw/agents/<agentId>/sessions` 하위에 위치합니다.

인증 프로필은 **에이전트별**입니다. 각 에이전트는 다음 위치에서 자신의 설정을 읽습니다:

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

메인 에이전트의 자격 증명은 자동으로 공유되지 않습니다. 에이전트 간에 `agentDir`를 재사용하지 마십시오
(인증/세션 충돌을 유발합니다). 자격 증명을 공유하려면,
`auth-profiles.json`을 다른 에이전트의 `agentDir`로 복사하십시오.

Skills 는 각 워크스페이스의 `skills/` 폴더를 통해 **에이전트별**로 관리되며,
공용 Skills 는 `~/.openclaw/skills`에서 사용할 수 있습니다.
[Skills: 에이전트별 vs 공유](/tools/skills#per-agent-vs-shared-skills)를 참고하십시오.

Gateway 는 **하나의 에이전트**(기본값) 또는 **여러 에이전트**를 나란히 호스팅할 수 있습니다.

**워크스페이스 참고:** 각 에이전트의 워크스페이스는 **기본 cwd**이며, 강제 샌드박스는 아닙니다.
상대 경로는 워크스페이스 내부에서 해석되지만, 샌드박스 처리가 활성화되지 않은 경우
절대 경로는 다른 호스트 위치에 접근할 수 있습니다.
자세한 내용은 [샌드박스 처리](/gateway/sandboxing)를 참고하십시오.

## 경로 (빠른 맵)

- 설정: `~/.openclaw/openclaw.json` (또는 `OPENCLAW_CONFIG_PATH`)
- 상태 디렉토리: `~/.openclaw` (또는 `OPENCLAW_STATE_DIR`)
- 워크스페이스: `~/.openclaw/workspace` (또는 `~/.openclaw/workspace-<agentId>`)
- 에이전트 디렉토리: `~/.openclaw/agents/<agentId>/agent` (또는 `agents.list[].agentDir`)
- 세션: `~/.openclaw/agents/<agentId>/sessions`

### 단일 에이전트 모드 (기본값)

아무 설정도 하지 않으면 OpenClaw 는 단일 에이전트로 실행됩니다:

- `agentId` 기본값은 **`main`**입니다.
- 세션은 `agent:main:<mainKey>`로 키가 지정됩니다.
- 워크스페이스 기본값은 `~/.openclaw/workspace`입니다
  (`OPENCLAW_PROFILE`가 설정된 경우 `~/.openclaw/workspace-<profile>`).
- 상태 기본값은 `~/.openclaw/agents/main/agent`입니다.

## 에이전트 도우미

에이전트 마법사를 사용하여 새로운 격리된 에이전트를 추가합니다:

```bash
openclaw agents add work
```

그런 다음 인바운드 메시지를 라우팅하기 위해 `bindings`을 추가합니다
(또는 마법사에서 자동으로 추가하도록 합니다).

다음으로 확인하십시오:

```bash
openclaw agents list --bindings
```

## 여러 에이전트 = 여러 사람, 여러 페르소나

**여러 에이전트**를 사용하는 경우, 각 `agentId`는 **완전히 격리된 페르소나**가 됩니다:

- **서로 다른 전화번호/계정** (채널별 `accountId`).
- **서로 다른 성격** (에이전트별 워크스페이스 파일, 예: `AGENTS.md`, `SOUL.md`).
- **분리된 인증 + 세션** (명시적으로 활성화하지 않는 한 상호 간섭 없음).

이를 통해 **여러 사람이** 하나의 Gateway 서버를 공유하면서도,
각자의 AI “두뇌”와 데이터를 격리된 상태로 유지할 수 있습니다.

## 하나의 WhatsApp 번호, 여러 사람 (DM 분기)

**하나의 WhatsApp 계정**을 유지하면서 **서로 다른 WhatsApp 다이렉트 메시지**를
서로 다른 에이전트로 라우팅할 수 있습니다.
발신자 E.164 (예: `+15551234567`)를 기준으로 `peer.kind: "dm"`에서 매칭합니다.
응답은 여전히 동일한 WhatsApp 번호에서 전송됩니다
(에이전트별 발신자 아이덴티티는 제공되지 않음).

중요한 세부 사항: 다이렉트 채팅은 에이전트의 **메인 세션 키**로 병합되므로,
진정한 격리를 위해서는 **사람마다 하나의 에이전트**가 필요합니다.

예시:

```json5
{
  agents: {
    list: [
      { id: "alex", workspace: "~/.openclaw/workspace-alex" },
      { id: "mia", workspace: "~/.openclaw/workspace-mia" },
    ],
  },
  bindings: [
    { agentId: "alex", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230001" } } },
    { agentId: "mia", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230002" } } },
  ],
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551230001", "+15551230002"],
    },
  },
}
```

참고:

- DM 접근 제어는 **WhatsApp 계정 전체에 대해 전역적**입니다
  (페어링/허용 목록). 에이전트별로 분리되지 않습니다.
- 공유 그룹의 경우, 해당 그룹을 하나의 에이전트에 바인딩하거나
  [브로드캐스트 그룹](/broadcast-groups)을 사용하십시오.

## 라우팅 규칙 (메시지가 에이전트를 선택하는 방식)

바인딩은 **결정적**이며 **가장 구체적인 규칙이 우선**합니다:

1. `peer` 매치 (정확한 DM/그룹/채널 ID)
2. `guildId` (Discord)
3. `teamId` (Slack)
4. 특정 채널에 대한 `accountId` 매치
5. 채널 수준 매치 (`accountId: "*"`)
6. 기본 에이전트로 폴백 (`agents.list[].default`, 없으면 첫 번째 목록 항목, 기본값: `main`)

## 여러 계정 / 전화번호

**여러 계정**을 지원하는 채널(예: WhatsApp)은
각 로그인을 식별하기 위해 `accountId`을 사용합니다.
각 `accountId`는 서로 다른 에이전트로 라우팅될 수 있으므로,
하나의 서버에서 여러 전화번호를 세션 혼합 없이 호스팅할 수 있습니다.

## 개념

- `agentId`: 하나의 “두뇌” (워크스페이스, 에이전트별 인증, 에이전트별 세션 저장소).
- `accountId`: 하나의 채널 계정 인스턴스 (예: WhatsApp 계정 `"personal"` vs `"biz"`).
- `binding`: `(channel, accountId, peer)` 및 선택적으로 길드/팀 ID로 인바운드 메시지를 `agentId`로 라우팅합니다.
- 다이렉트 채팅은 `agent:<agentId>:<mainKey>`로 병합됩니다
  (에이전트별 “메인”; `session.mainKey`).

## 예시: WhatsApp 두 개 → 에이전트 두 개

`~/.openclaw/openclaw.json` (JSON5):

```js
{
  agents: {
    list: [
      {
        id: "home",
        default: true,
        name: "Home",
        workspace: "~/.openclaw/workspace-home",
        agentDir: "~/.openclaw/agents/home/agent",
      },
      {
        id: "work",
        name: "Work",
        workspace: "~/.openclaw/workspace-work",
        agentDir: "~/.openclaw/agents/work/agent",
      },
    ],
  },

  // Deterministic routing: first match wins (most-specific first).
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } },

    // Optional per-peer override (example: send a specific group to work agent).
    {
      agentId: "work",
      match: {
        channel: "whatsapp",
        accountId: "personal",
        peer: { kind: "group", id: "1203630...@g.us" },
      },
    },
  ],

  // Off by default: agent-to-agent messaging must be explicitly enabled + allowlisted.
  tools: {
    agentToAgent: {
      enabled: false,
      allow: ["home", "work"],
    },
  },

  channels: {
    whatsapp: {
      accounts: {
        personal: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/personal
          // authDir: "~/.openclaw/credentials/whatsapp/personal",
        },
        biz: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/biz
          // authDir: "~/.openclaw/credentials/whatsapp/biz",
        },
      },
    },
  },
}
```

## 예시: WhatsApp 일상 대화 + Telegram 집중 작업

채널별로 분리합니다: WhatsApp 은 빠른 일상용 에이전트로,
Telegram 은 Opus 에이전트로 라우팅합니다.

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },
    { agentId: "opus", match: { channel: "telegram" } },
  ],
}
```

참고:

- 하나의 채널에 여러 계정이 있는 경우, 바인딩에 `accountId`를 추가하십시오
  (예: `{ channel: "whatsapp", accountId: "personal" }`).
- 단일 DM/그룹만 Opus 로 라우팅하고 나머지는 채팅 에이전트에 유지하려면,
  해당 피어에 대해 `match.peer` 바인딩을 추가하십시오.
  피어 매치는 항상 채널 전체 규칙보다 우선합니다.

## 예시: 동일한 채널에서 하나의 피어만 Opus 로

WhatsApp 은 빠른 에이전트에 유지하되,
하나의 DM 만 Opus 로 라우팅합니다:

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "opus", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551234567" } } },
    { agentId: "chat", match: { channel: "whatsapp" } },
  ],
}
```

피어 바인딩이 항상 우선하므로,
채널 전체 규칙보다 위에 배치하십시오.

## WhatsApp 그룹에 바인딩된 패밀리 에이전트

멘션 게이팅과 더 엄격한 도구 정책을 적용하여,
하나의 WhatsApp 그룹에 전용 패밀리 에이전트를 바인딩합니다:

```json5
{
  agents: {
    list: [
      {
        id: "family",
        name: "Family",
        workspace: "~/.openclaw/workspace-family",
        identity: { name: "Family Bot" },
        groupChat: {
          mentionPatterns: ["@family", "@familybot", "@Family Bot"],
        },
        sandbox: {
          mode: "all",
          scope: "agent",
        },
        tools: {
          allow: [
            "exec",
            "read",
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "session_status",
          ],
          deny: ["write", "edit", "apply_patch", "browser", "canvas", "nodes", "cron"],
        },
      },
    ],
  },
  bindings: [
    {
      agentId: "family",
      match: {
        channel: "whatsapp",
        peer: { kind: "group", id: "120363999999999999@g.us" },
      },
    },
  ],
}
```

참고:

- 도구 허용/차단 목록은 **tools** 기준이며, Skills 기준이 아닙니다.
  어떤 Skill 이 바이너리를 실행해야 한다면,
  `exec`가 허용되어 있고 해당 바이너리가 샌드박스에 존재하는지 확인하십시오.
- 더 엄격한 게이팅을 위해 `agents.list[].groupChat.mentionPatterns`을 설정하고,
  채널에 대해 그룹 허용 목록을 활성화된 상태로 유지하십시오.

## 에이전트별 샌드박스 및 도구 설정

v2026.1.6 부터 각 에이전트는 자체 샌드박스와 도구 제한을 가질 수 있습니다:

```js
{
  agents: {
    list: [
      {
        id: "personal",
        workspace: "~/.openclaw/workspace-personal",
        sandbox: {
          mode: "off",  // No sandbox for personal agent
        },
        // No tool restrictions - all tools available
      },
      {
        id: "family",
        workspace: "~/.openclaw/workspace-family",
        sandbox: {
          mode: "all",     // Always sandboxed
          scope: "agent",  // One container per agent
          docker: {
            // Optional one-time setup after container creation
            setupCommand: "apt-get update && apt-get install -y git curl",
          },
        },
        tools: {
          allow: ["read"],                    // Only read tool
          deny: ["exec", "write", "edit", "apply_patch"],    // Deny others
        },
      },
    ],
  },
}
```

참고: `setupCommand`는 `sandbox.docker` 하위에 있으며,
컨테이너 생성 시 한 번만 실행됩니다.
해결된 스코프가 `"shared"`인 경우,
에이전트별 `sandbox.docker.*` 오버라이드는 무시됩니다.

**장점:**

- **보안 격리**: 신뢰할 수 없는 에이전트에 대해 도구를 제한
- **리소스 제어**: 일부 에이전트만 샌드박스 처리하고 다른 에이전트는 호스트 사용
- **유연한 정책**: 에이전트별로 다른 권한 적용

참고: `tools.elevated`은 **전역**이며 발신자 기반입니다.
에이전트별로 설정할 수 없습니다.
에이전트별 경계를 원한다면,
`agents.list[].tools`을 사용하여 `exec`을 차단하십시오.
그룹 타겟팅의 경우,
@멘션이 의도한 에이전트로 명확하게 매핑되도록
`agents.list[].groupChat.mentionPatterns`을 사용하십시오.

자세한 예시는 [멀티 에이전트 샌드박스 & 도구](/multi-agent-sandbox-tools)를 참고하십시오.
