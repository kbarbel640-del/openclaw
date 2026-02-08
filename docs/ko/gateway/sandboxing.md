---
summary: "OpenClaw 샌드박스 처리가 어떻게 동작하는지: 모드, 범위, 워크스페이스 접근, 이미지"
title: 샌드박스 처리
read_when: "샌드박스 처리에 대한 전용 설명이 필요하거나 agents.defaults.sandbox 를 튜닝해야 할 때"
status: active
x-i18n:
  source_path: gateway/sandboxing.md
  source_hash: 184fc53001fc6b28
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:36Z
---

# 샌드박스 처리

OpenClaw 는 폭발 반경을 줄이기 위해 **Docker 컨테이너 안에서 도구를 실행**할 수 있습니다.
이는 **선택 사항**이며 설정 (`agents.defaults.sandbox` 또는
`agents.list[].sandbox`)으로 제어됩니다. 샌드박스 처리가 꺼져 있으면 도구는 호스트에서 실행됩니다.
Gateway(게이트웨이)는 호스트에 그대로 남아 있으며, 활성화된 경우 도구 실행은
격리된 샌드박스에서 수행됩니다.

이는 완벽한 보안 경계는 아니지만, 모델이 멍청한 일을 했을 때 파일 시스템과
프로세스 접근을 실질적으로 제한합니다.

## 무엇이 샌드박스 처리되는가

- 도구 실행 (`exec`, `read`, `write`, `edit`, `apply_patch`, `process` 등).
- 선택적 샌드박스 처리된 브라우저 (`agents.defaults.sandbox.browser`).
  - 기본적으로 샌드박스 브라우저는 브라우저 도구가 필요로 할 때 자동 시작됩니다 (CDP 가 도달 가능하도록 보장).
    `agents.defaults.sandbox.browser.autoStart` 및 `agents.defaults.sandbox.browser.autoStartTimeoutMs` 로 설정합니다.
  - `agents.defaults.sandbox.browser.allowHostControl` 는 샌드박스 처리된 세션이 호스트 브라우저를 명시적으로 대상으로 삼도록 합니다.
  - 선택적 allowlist 가 `target: "custom"` 을 게이트합니다: `allowedControlUrls`, `allowedControlHosts`, `allowedControlPorts`.

샌드박스 처리되지 않음:

- Gateway(게이트웨이) 프로세스 자체.
- 호스트에서 실행하도록 명시적으로 허용된 모든 도구 (예: `tools.elevated`).
  - **Elevated exec 는 호스트에서 실행되며 샌드박스 처리를 우회합니다.**
  - 샌드박스 처리가 꺼져 있으면, `tools.elevated` 는 실행을 변경하지 않습니다 (이미 호스트에서 실행 중). [Elevated Mode](/tools/elevated)를 참조하십시오.

## 모드

`agents.defaults.sandbox.mode` 는 샌드박스 처리가 **언제** 사용되는지 제어합니다:

- `"off"`: 샌드박스 처리 없음.
- `"non-main"`: **메인이 아닌** 세션만 샌드박스 처리 (호스트에서 일반 채팅을 원할 때의 기본값).
- `"all"`: 모든 세션이 샌드박스에서 실행됩니다.
  참고: `"non-main"` 는 에이전트 id 가 아니라 `session.mainKey` (기본값 `"main"`)를 기반으로 합니다.
  그룹/채널 세션은 자체 키를 사용하므로 메인이 아닌 것으로 계산되며 샌드박스 처리됩니다.

## 범위

`agents.defaults.sandbox.scope` 는 **몇 개의 컨테이너**가 생성되는지 제어합니다:

- `"session"` (기본값): 세션당 컨테이너 1개.
- `"agent"`: 에이전트당 컨테이너 1개.
- `"shared"`: 모든 샌드박스 처리된 세션이 공유하는 컨테이너 1개.

## 워크스페이스 접근

`agents.defaults.sandbox.workspaceAccess` 는 **샌드박스가 무엇을 볼 수 있는지** 제어합니다:

- `"none"` (기본값): 도구는 `~/.openclaw/sandboxes` 아래의 샌드박스 워크스페이스를 봅니다.
- `"ro"`: 에이전트 워크스페이스를 `/agent` 에 읽기 전용으로 마운트합니다 (`write`/`edit`/`apply_patch` 비활성화).
- `"rw"`: 에이전트 워크스페이스를 `/workspace` 에 읽기/쓰기으로 마운트합니다.

인바운드 미디어는 활성 샌드박스 워크스페이스 (`media/inbound/*`)로 복사됩니다.
Skills 참고: `read` 도구는 샌드박스 루트에 고정됩니다. `workspaceAccess: "none"` 를 사용하면,
OpenClaw 는 적격한 스킬을 샌드박스 워크스페이스 (`.../skills`)로 미러링하여
읽을 수 있게 합니다. `"rw"` 를 사용하면 워크스페이스 스킬을
`/workspace/skills` 에서 읽을 수 있습니다.

## 사용자 지정 바인드 마운트

`agents.defaults.sandbox.docker.binds` 는 추가 호스트 디렉토리를 컨테이너에 마운트합니다.
형식: `host:container:mode` (예: `"/home/user/source:/source:rw"`).

전역 및 에이전트별 바인드는 **병합**됩니다 (대체되지 않음). `scope: "shared"` 에서는 에이전트별 바인드가 무시됩니다.

예시 (읽기 전용 소스 + docker 소켓):

```json5
{
  agents: {
    defaults: {
      sandbox: {
        docker: {
          binds: ["/home/user/source:/source:ro", "/var/run/docker.sock:/var/run/docker.sock"],
        },
      },
    },
    list: [
      {
        id: "build",
        sandbox: {
          docker: {
            binds: ["/mnt/cache:/cache:rw"],
          },
        },
      },
    ],
  },
}
```

보안 참고 사항:

- 바인드는 샌드박스 파일 시스템을 우회합니다: 설정한 모드 (`:ro` 또는 `:rw`)로 호스트 경로를 노출합니다.
- 민감한 마운트 (예: `docker.sock`, 시크릿, SSH 키)는 반드시 필요하지 않다면 `:ro` 이어야 합니다.
- 워크스페이스에 대한 읽기 접근만 필요하다면 `workspaceAccess: "ro"` 와 결합하십시오. 바인드 모드는 서로 독립적으로 유지됩니다.
- 바인드가 도구 정책 및 elevated exec 와 어떻게 상호작용하는지에 대해서는 [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)를 참조하십시오.

## 이미지 + 설정

기본 이미지: `openclaw-sandbox:bookworm-slim`

한 번 빌드하십시오:

```bash
scripts/sandbox-setup.sh
```

참고: 기본 이미지는 Node 를 **포함하지 않습니다**. 스킬에 Node (또는
다른 런타임)가 필요하다면, 사용자 지정 이미지를 굽거나
`sandbox.docker.setupCommand` 를 통해 설치하십시오 (네트워크 egress + 쓰기 가능한 루트 +
root 사용자 필요).

샌드박스 처리된 브라우저 이미지:

```bash
scripts/sandbox-browser-setup.sh
```

기본적으로 샌드박스 컨테이너는 **네트워크 없이** 실행됩니다.
`agents.defaults.sandbox.docker.network` 로 재정의하십시오.

Docker 설치 및 컨테이너화된 게이트웨이는 여기 있습니다:
[Docker](/install/docker)

## setupCommand (일회성 컨테이너 설정)

`setupCommand` 는 샌드박스 컨테이너가 생성된 후 **한 번** 실행됩니다 (매 실행마다가 아님).
컨테이너 내부에서 `sh -lc` 를 통해 실행됩니다.

경로:

- 전역: `agents.defaults.sandbox.docker.setupCommand`
- 에이전트별: `agents.list[].sandbox.docker.setupCommand`

일반적인 함정:

- 기본 `docker.network` 는 `"none"` (egress 없음)이라서 패키지 설치가 실패합니다.
- `readOnlyRoot: true` 는 쓰기를 막습니다. `readOnlyRoot: false` 를 설정하거나 사용자 지정 이미지를 굽십시오.
- 패키지 설치를 위해서는 `user` 가 root 여야 합니다 (`user` 를 생략하거나 `user: "0:0"` 를 설정).
- 샌드박스 exec 는 호스트 `process.env` 를 **상속하지 않습니다**. 스킬 API 키를 위해
  `agents.defaults.sandbox.docker.env` (또는 사용자 지정 이미지)를 사용하십시오.

## 도구 정책 + 탈출 해치

도구 allow/deny 정책은 샌드박스 규칙보다 먼저 계속 적용됩니다. 도구가 전역 또는 에이전트별로
거부되어 있으면, 샌드박스 처리로 다시 사용할 수 있게 되지 않습니다.

`tools.elevated` 는 호스트에서 `exec` 를 실행하는 명시적 탈출 해치입니다.
`/exec` 지시문은 권한이 있는 발신자에게만 적용되며 세션별로 지속됩니다. `exec` 를 하드 비활성화하려면
도구 정책 deny 를 사용하십시오 ([Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) 참조).

디버깅:

- `openclaw sandbox explain` 를 사용하여 유효 샌드박스 모드, 도구 정책, 그리고 fix-it 설정 키를 확인하십시오.
- "왜 이것이 차단되나요?"에 대한 멘탈 모델은 [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)를 참조하십시오.
  엄격하게 잠가 두십시오.

## 멀티 에이전트 재정의

각 에이전트는 샌드박스 + 도구를 재정의할 수 있습니다:
`agents.list[].sandbox` 및 `agents.list[].tools` (샌드박스 도구 정책을 위한 `agents.list[].tools.sandbox.tools` 포함).
우선순위는 [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)를 참조하십시오.

## 최소 활성화 예시

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
      },
    },
  },
}
```

## 관련 문서

- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)
- [Security](/gateway/security)
