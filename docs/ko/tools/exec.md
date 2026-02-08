---
summary: "Exec 도구 사용법, stdin 모드 및 TTY 지원"
read_when:
  - Exec 도구를 사용하거나 수정할 때
  - stdin 또는 TTY 동작을 디버깅할 때
title: "Exec 도구"
x-i18n:
  source_path: tools/exec.md
  source_hash: 3b32238dd8dce93d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:38:03Z
---

# Exec 도구

워크스페이스에서 셸 명령을 실행합니다. `process`를 통해 포그라운드 + 백그라운드 실행을 지원합니다.
`process`가 허용되지 않으면, `exec`는 동기적으로 실행되며 `yieldMs`/`background`를 무시합니다.
백그라운드 세션은 에이전트별로 범위가 지정되며, `process`는 동일한 에이전트의 세션만 확인합니다.

## Parameters

- `command` (필수)
- `workdir` (기본값: cwd)
- `env` (키/값 재정의)
- `yieldMs` (기본값 10000): 지연 후 자동 백그라운드
- `background` (bool): 즉시 백그라운드
- `timeout` (초, 기본값 1800): 만료 시 종료
- `pty` (bool): 사용 가능할 때 의사 터미널에서 실행 (TTY 전용 CLI, 코딩 에이전트, 터미널 UI)
- `host` (`sandbox | gateway | node`): 실행 위치
- `security` (`deny | allowlist | full`): `gateway`/`node`에 대한 강제 모드
- `ask` (`off | on-miss | always`): `gateway`/`node`에 대한 승인 프롬프트
- `node` (string): `host=node`의 노드 id/이름
- `elevated` (bool): 승격 모드 요청 (게이트웨이 호스트); `security=full`는 승격이 `full`으로 해석될 때만 강제됩니다.

Notes:

- `host`의 기본값은 `sandbox`입니다.
- 샌드박스 처리가 꺼져 있으면 `elevated`는 무시됩니다 (exec 는 이미 호스트에서 실행됩니다).
- `gateway`/`node` 승인 제어는 `~/.openclaw/exec-approvals.json`에 의해 관리됩니다.
- `node`에는 페어링된 노드(컴패니언 앱 또는 헤드리스 노드 호스트)가 필요합니다.
- 여러 노드를 사용할 수 있는 경우, `exec.node` 또는 `tools.exec.node`를 설정하여 하나를 선택합니다.
- Windows 가 아닌 호스트에서는, 설정되어 있으면 exec 가 `SHELL`를 사용합니다. `SHELL`가 `fish`이면,
  fish 와 호환되지 않는 스크립트를 피하기 위해 `PATH`에서 `bash` (또는 `sh`)를 우선하며,
  둘 다 없으면 `SHELL`로 폴백합니다.
- 호스트 실행(`gateway`/`node`)은 바이너리 하이재킹 또는 주입된 코드를 방지하기 위해
  `env.PATH` 및 로더 재정의(`LD_*`/`DYLD_*`)를 거부합니다.
- 중요: 샌드박스 처리는 **기본적으로 꺼져 있습니다**. 샌드박스 처리가 꺼져 있으면, `host=sandbox`는
  Gateway(게이트웨이) 호스트에서 직접 실행되며(컨테이너 없음) **승인이 필요하지 않습니다**.
  승인을 요구하려면 `host=gateway`로 실행하고 exec 승인 설정을 구성하십시오(또는 샌드박스 처리를 활성화하십시오).

## Config

- `tools.exec.notifyOnExit` (기본값: true): true 인 경우, 백그라운드로 실행된 exec 세션은 시스템 이벤트를 큐에 넣고 종료 시 하트비트를 요청합니다.
- `tools.exec.approvalRunningNoticeMs` (기본값: 10000): 승인으로 게이트된 exec 가 이 시간보다 오래 실행되면 단일 “running” 알림을 발행합니다(0 은 비활성화).
- `tools.exec.host` (기본값: `sandbox`)
- `tools.exec.security` (기본값: 샌드박스의 경우 `deny`, 미설정 시 게이트웨이 + 노드의 경우 `allowlist`)
- `tools.exec.ask` (기본값: `on-miss`)
- `tools.exec.node` (기본값: 미설정)
- `tools.exec.pathPrepend`: exec 실행 시 `PATH` 앞에 추가할 디렉토리 목록.
- `tools.exec.safeBins`: 명시적 allowlist 항목 없이 실행할 수 있는 stdin 전용 안전 바이너리.

Example:

```json5
{
  tools: {
    exec: {
      pathPrepend: ["~/bin", "/opt/oss/bin"],
    },
  },
}
```

### PATH 처리

- `host=gateway`: 로그인 셸의 `PATH`를 exec 환경으로 병합합니다. `env.PATH` 재정의는
  호스트 실행에서 거부됩니다. 데몬 자체는 여전히 최소한의 `PATH`로 실행됩니다:
  - macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
  - Linux: `/usr/local/bin`, `/usr/bin`, `/bin`
- `host=sandbox`: 컨테이너 내부에서 `sh -lc`(로그인 셸)을 실행하므로, `/etc/profile`가 `PATH`를 재설정할 수 있습니다.
  OpenClaw 는 내부 환경 변수를 통해 프로파일 소싱 이후 `env.PATH`을 앞에 추가합니다(셸 보간 없음).
  `tools.exec.pathPrepend`도 여기에서 적용됩니다.
- `host=node`: 전달한 차단되지 않은 환경 변수 재정의만 노드로 전송됩니다. `env.PATH` 재정의는
  호스트 실행에서 거부됩니다. 헤드리스 노드 호스트는 노드 호스트 PATH 를 앞에 추가하는 경우에만
  `PATH`를 허용합니다(대체 없음). macOS 노드는 `PATH` 재정의를 완전히 삭제합니다.

에이전트별 노드 바인딩(설정에서 에이전트 목록 인덱스 사용):

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

Control UI: Nodes 탭에는 동일한 설정을 위한 작은 “Exec node binding” 패널이 포함되어 있습니다.

## 세션 재정의(`/exec`)

`/exec`를 사용하여 `host`, `security`, `ask`, `node`의 **세션별** 기본값을 설정합니다.
인자 없이 `/exec`을 보내 현재 값을 표시하십시오.

Example:

```
/exec host=gateway security=allowlist ask=on-miss node=mac-1
```

## Authorization 모델

`/exec`은 **권한이 있는 발신자**에 대해서만 존중됩니다(채널 allowlist/페어링 + `commands.useAccessGroups`).
이는 **세션 상태만** 업데이트하며 설정을 기록하지 않습니다. exec 를 강제로 비활성화하려면,
도구 정책(`tools.deny: ["exec"]` 또는 에이전트별)에서 거부하십시오. `security=full` 및 `ask=off`를
명시적으로 설정하지 않는 한, 호스트 승인은 여전히 적용됩니다.

## Exec 승인(컴패니언 앱 / 노드 호스트)

샌드박스 처리된 에이전트는 `exec`가 게이트웨이 또는 노드 호스트에서 실행되기 전에 요청별 승인을 요구할 수 있습니다.
정책, allowlist 및 UI 흐름은 [Exec approvals](/tools/exec-approvals)를 참조하십시오.

승인이 필요한 경우, exec 도구는 즉시 `status: "approval-pending"`와 승인 id 를 반환합니다. 승인(또는 거부/타임아웃)되면,
Gateway(게이트웨이)는 시스템 이벤트(`Exec finished` / `Exec denied`)를 발행합니다. 명령이
`tools.exec.approvalRunningNoticeMs` 이후에도 여전히 실행 중이면, 단일 `Exec running` 알림이 발행됩니다.

## Allowlist + 안전 바이너리

Allowlist 강제는 **해결된 바이너리 경로만** 일치시킵니다(베이스네임 일치는 없음). `security=allowlist`일 때,
셸 명령은 파이프라인의 모든 세그먼트가 allowlist 에 있거나 안전 바이너리인 경우에만 자동 허용됩니다.
연결(`;`, `&&`, `||`) 및 리다이렉션은 allowlist 모드에서 거부됩니다.

## Examples

Foreground:

```json
{ "tool": "exec", "command": "ls -la" }
```

Background + poll:

```json
{"tool":"exec","command":"npm run build","yieldMs":1000}
{"tool":"process","action":"poll","sessionId":"<id>"}
```

키 전송(tmux 스타일):

```json
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Enter"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["C-c"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Up","Up","Enter"]}
```

제출(CR 만 전송):

```json
{ "tool": "process", "action": "submit", "sessionId": "<id>" }
```

붙여넣기(기본적으로 브래킷 처리):

```json
{ "tool": "process", "action": "paste", "sessionId": "<id>", "text": "line1\nline2\n" }
```

## apply_patch (experimental)

`apply_patch`은 구조화된 다중 파일 편집을 위한 `exec`의 서브도구입니다.
명시적으로 활성화하십시오:

```json5
{
  tools: {
    exec: {
      applyPatch: { enabled: true, allowModels: ["gpt-5.2"] },
    },
  },
}
```

Notes:

- OpenAI/OpenAI Codex 모델에서만 사용 가능합니다.
- 도구 정책은 여전히 적용되며, `allow: ["exec"]`은 암묵적으로 `apply_patch`를 허용합니다.
- 설정은 `tools.exec.applyPatch` 아래에 위치합니다.
