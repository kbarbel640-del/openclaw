---
title: 샌드박스 vs 도구 정책 vs Elevated
summary: "도구가 차단되는 이유: 샌드박스 런타임, 도구 허용/차단 정책, Elevated exec 게이트"
read_when: "'sandbox jail'에 걸렸거나 도구/Elevated 거부를 보고, 변경해야 할 정확한 설정 키를 알고 싶을 때."
status: active
x-i18n:
  source_path: gateway/sandbox-vs-tool-policy-vs-elevated.md
  source_hash: 863ea5e6d137dfb6
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:22Z
---

# 샌드박스 vs 도구 정책 vs Elevated

OpenClaw 에는 서로 관련은 있지만 (서로 다른) 제어가 3가지 있습니다:

1. **샌드박스** (`agents.defaults.sandbox.*` / `agents.list[].sandbox.*`)는 **도구가 어디에서 실행되는지** (Docker vs 호스트)를 결정합니다.
2. **도구 정책** (`tools.*`, `tools.sandbox.tools.*`, `agents.list[].tools.*`)는 **어떤 도구를 사용할 수 있는지/허용되는지**를 결정합니다.
3. **Elevated** (`tools.elevated.*`, `agents.list[].tools.elevated.*`)는 샌드박스 처리된 상태에서 호스트에서 실행하기 위한 **exec 전용 탈출구**입니다.

## 빠른 디버그

인스펙터를 사용해 OpenClaw 가 _실제로_ 무엇을 하고 있는지 확인합니다:

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

출력 내용:

- 유효한 샌드박스 모드/스코프/워크스페이스 접근
- 세션이 현재 샌드박스 처리되었는지 여부 (main vs non-main)
- 유효한 샌드박스 도구 허용/차단 (그리고 이것이 agent/global/default 중 어디에서 왔는지)
- Elevated 게이트와 수정용 키 경로

## 샌드박스: 도구가 실행되는 위치

샌드박스 처리는 `agents.defaults.sandbox.mode` 로 제어됩니다:

- `"off"`: 모든 것이 호스트에서 실행됩니다.
- `"non-main"`: non-main 세션만 샌드박스 처리됩니다 (그룹/채널에서 흔한 '예상 밖' 상황).
- `"all"`: 모든 것이 샌드박스 처리됩니다.

스코프, 워크스페이스 마운트, 이미지에 대한 전체 매트릭스는 [샌드박스 처리](/gateway/sandboxing)에서 자세한 내용은 확인합니다.

### 바인드 마운트 (보안 빠른 점검)

- `docker.binds` 는 샌드박스 파일시스템을 _관통_ 합니다: 마운트한 것은 무엇이든 설정한 모드 (`:ro` 또는 `:rw`)로 컨테이너 내부에서 보입니다.
- 모드를 생략하면 기본값은 읽기-쓰기입니다. 소스/시크릿에는 `:ro` 를 권장합니다.
- `scope: "shared"` 는 에이전트별 바인드를 무시합니다 (global 바인드만 적용됩니다).
- `/var/run/docker.sock` 를 바인딩하면 사실상 호스트 제어권을 샌드박스에 넘기는 것입니다. 의도적으로만 수행합니다.
- 워크스페이스 접근 (`workspaceAccess: "ro"`/`"rw"`)은 바인드 모드와 독립적입니다.

## 도구 정책: 어떤 도구가 존재/호출 가능한지

중요한 레이어는 두 가지입니다:

- **도구 프로필**: `tools.profile` 및 `agents.list[].tools.profile` (기본 허용 목록)
- **프로바이더 도구 프로필**: `tools.byProvider[provider].profile` 및 `agents.list[].tools.byProvider[provider].profile`
- **global/에이전트별 도구 정책**: `tools.allow`/`tools.deny` 및 `agents.list[].tools.allow`/`agents.list[].tools.deny`
- **프로바이더 도구 정책**: `tools.byProvider[provider].allow/deny` 및 `agents.list[].tools.byProvider[provider].allow/deny`
- **샌드박스 도구 정책** (샌드박스 처리된 경우에만 적용): `tools.sandbox.tools.allow`/`tools.sandbox.tools.deny` 및 `agents.list[].tools.sandbox.tools.*`

경험칙:

- `deny` 가 항상 우선합니다.
- `allow` 가 비어 있지 않으면, 그 외의 모든 것은 차단된 것으로 취급됩니다.
- 도구 정책이 최종 차단선입니다: `/exec` 는 거부된 `exec` 도구를 덮어쓸 수 없습니다.
- `/exec` 는 승인된 발신자에 대해 세션 기본값만 변경하며, 도구 접근 권한을 부여하지는 않습니다.
  프로바이더 도구 키는 `provider` (예: `google-antigravity`) 또는 `provider/model` (예: `openai/gpt-5.2`) 중 하나를 받을 수 있습니다.

### 도구 그룹 (축약형)

도구 정책 (global, agent, sandbox)은 여러 도구로 확장되는 `group:*` 항목을 지원합니다:

```json5
{
  tools: {
    sandbox: {
      tools: {
        allow: ["group:runtime", "group:fs", "group:sessions", "group:memory"],
      },
    },
  },
}
```

사용 가능한 그룹:

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: 모든 내장 OpenClaw 도구 (프로바이더 플러그인 제외)

## Elevated: exec 전용 "호스트에서 실행"

Elevated 는 추가 도구를 **부여하지** 않으며, `exec` 에만 영향을 줍니다.

- 샌드박스 처리된 경우, `/elevated on` (또는 `elevated: true` 를 사용하는 `exec`)는 호스트에서 실행됩니다 (승인이 여전히 적용될 수 있습니다).
- 세션에 대해 exec 승인을 건너뛰려면 `/elevated full` 를 사용합니다.
- 이미 direct 로 실행 중이라면, Elevated 는 사실상 no-op 입니다 (여전히 게이트가 적용됩니다).
- Elevated 는 스킬 스코프가 **아니며**, 도구 허용/차단을 **덮어쓰지 않습니다**.
- `/exec` 는 Elevated 와 별개입니다. 승인된 발신자에 대해 세션별 exec 기본값만 조정합니다.

게이트:

- 활성화: `tools.elevated.enabled` (및 선택적으로 `agents.list[].tools.elevated.enabled`)
- 발신자 허용 목록: `tools.elevated.allowFrom.<provider>` (및 선택적으로 `agents.list[].tools.elevated.allowFrom.<provider>`)

[Elevated Mode](/tools/elevated)를 참고합니다.

## 흔한 "sandbox jail" 수정

### "샌드박스 도구 정책에 의해 도구 X 가 차단됨"

수정용 키 (하나 선택):

- 샌드박스 비활성화: `agents.defaults.sandbox.mode=off` (또는 에이전트별 `agents.list[].sandbox.mode=off`)
- 샌드박스 내부에서 도구를 허용:
  - `tools.sandbox.tools.deny` (또는 에이전트별 `agents.list[].tools.sandbox.tools.deny`)에서 제거
  - 또는 `tools.sandbox.tools.allow` 에 추가 (또는 에이전트별 allow)

### "이게 main 이라고 생각했는데, 왜 샌드박스 처리되어 있나요?"

`"non-main"` 모드에서는 그룹/채널 키가 main 이 _아닙니다_. main 세션 키 (`sandbox explain` 로 표시됨)를 사용하거나 모드를 `"off"` 로 전환합니다.
