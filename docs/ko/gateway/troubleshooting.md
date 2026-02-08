---
summary: "일반적인 OpenClaw 실패에 대한 빠른 문제 해결 가이드"
read_when:
  - 런타임 문제 또는 실패를 조사할 때
title: "문제 해결"
x-i18n:
  source_path: gateway/troubleshooting.md
  source_hash: a07bb06f0b5ef568
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:41:29Z
---

# 문제 해결 🔧

OpenClaw 가 오작동할 때, 다음 방법으로 해결할 수 있습니다.

빠른 트리아지 레시피만 원한다면 FAQ 의 [처음 60초](/help/faq#first-60-seconds-if-somethings-broken)부터 시작하십시오. 이 페이지는 런타임 실패와 진단을 더 깊게 다룹니다.

프로바이더별 바로가기: [/channels/troubleshooting](/channels/troubleshooting)

## 상태 및 진단

빠른 트리아지 명령(순서대로):

| Command                            | 무엇을 알려주나요                                                                                     | 언제 사용하나요                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `openclaw status`                  | 로컬 요약: OS + 업데이트, 게이트웨이 도달 가능 여부/모드, 서비스, 에이전트/세션, 프로바이더 설정 상태 | 첫 확인, 빠른 개요                                        |
| `openclaw status --all`            | 전체 로컬 진단(읽기 전용, 붙여넣기 가능, 비교적 안전) 로그 tail 포함                                  | 디버그 리포트를 공유해야 할 때                            |
| `openclaw status --deep`           | 게이트웨이 상태 검사 실행(프로바이더 프로브 포함; 도달 가능한 게이트웨이 필요)                        | '구성됨'이 '작동함'을 의미하지 않을 때                    |
| `openclaw gateway probe`           | 게이트웨이 디바이스 검색 + 도달 가능 여부(로컬 + 원격 대상)                                           | 잘못된 게이트웨이를 프로브하고 있다고 의심될 때           |
| `openclaw channels status --probe` | 실행 중인 게이트웨이에 채널 상태를 요청(그리고 선택적으로 프로브)                                     | 게이트웨이는 도달 가능하지만 채널이 오작동할 때           |
| `openclaw gateway status`          | Supervisor 상태(launchd/systemd/schtasks), 런타임 PID/종료, 마지막 게이트웨이 오류                    | 서비스가 '로드됨'처럼 보이지만 아무 것도 실행되지 않을 때 |
| `openclaw logs --follow`           | 라이브 로그(런타임 문제에 대한 최고의 신호)                                                           | 실제 실패 이유가 필요할 때                                |

**출력 공유:** 토큰을 마스킹하므로 `openclaw status --all`를 선호합니다. `openclaw status`를 붙여넣는 경우, (토큰 미리보기 때문에) 먼저 `OPENCLAW_SHOW_SECRETS=0` 설정을 고려하십시오.

또한 참고: [상태 검사](/gateway/health) 및 [로깅](/logging).

## 일반적인 이슈

### 프로바이더 "anthropic"에 대한 API 키를 찾을 수 없음

이는 **에이전트의 인증 저장소가 비어 있거나** Anthropic 자격 증명이 누락되었음을 의미합니다.
인증은 **에이전트별**이므로, 새 에이전트는 메인 에이전트의 키를 상속하지 않습니다.

해결 옵션:

- 온보딩을 다시 실행하고 해당 에이전트에 대해 **Anthropic**을 선택합니다.
- 또는 **게이트웨이 호스트**에 setup-token 을 붙여넣습니다:
  ```bash
  openclaw models auth setup-token --provider anthropic
  ```
- 또는 메인 에이전트 디렉토리에서 새 에이전트 디렉토리로 `auth-profiles.json`를 복사합니다.

검증:

```bash
openclaw models status
```

### OAuth 토큰 갱신 실패(Anthropic Claude 구독)

저장된 Anthropic OAuth 토큰이 만료되었고 갱신에 실패했음을 의미합니다.
Claude 구독(API 키 없음)을 사용 중이라면, 가장 신뢰할 수 있는 해결책은
**Claude Code setup-token**으로 전환하여 **게이트웨이 호스트**에 붙여넣는 것입니다.

**권장(setup-token):**

```bash
# Run on the gateway host (paste the setup-token)
openclaw models auth setup-token --provider anthropic
openclaw models status
```

토큰을 다른 곳에서 생성했다면:

```bash
openclaw models auth paste-token --provider anthropic
openclaw models status
```

자세한 내용: [Anthropic](/providers/anthropic) 및 [OAuth](/concepts/oauth).

### Control UI 가 HTTP 에서 실패("device identity required" / "connect failed")

대시보드를 일반 HTTP (예: `http://<lan-ip>:18789/` 또는
`http://<tailscale-ip>:18789/`)로 열면, 브라우저가 **비보안 컨텍스트**에서 실행되어
WebCrypto 를 차단하므로 디바이스 ID 를 생성할 수 없습니다.

**해결:**

- [Tailscale Serve](/gateway/tailscale)를 통해 HTTPS 를 사용하는 것을 권장합니다.
- 또는 게이트웨이 호스트에서 로컬로 엽니다: `http://127.0.0.1:18789/`.
- HTTP 를 유지해야 한다면, `gateway.controlUi.allowInsecureAuth: true`을 활성화하고
  게이트웨이 토큰을 사용하십시오(토큰 전용; 디바이스 ID/페어링 없음). 다음을 참고하십시오:
  [Control UI](/web/control-ui#insecure-http).

### CI Secrets Scan Failed

이는 `detect-secrets`가 베이스라인에 아직 반영되지 않은 새 후보를 찾았음을 의미합니다.
[Secret scanning](/gateway/security#secret-scanning-detect-secrets)을 따르십시오.

### 서비스는 설치되었지만 아무 것도 실행되지 않음

게이트웨이 서비스가 설치되어 있지만 프로세스가 즉시 종료되면, 서비스가 '로드됨'처럼
보이지만 아무 것도 실행되지 않을 수 있습니다.

**확인:**

```bash
openclaw gateway status
openclaw doctor
```

Doctor/service 는 런타임 상태(PID/마지막 종료)와 로그 힌트를 표시합니다.

**로그:**

- 권장: `openclaw logs --follow`
- 파일 로그(항상): `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (또는 설정된 `logging.file`)
- macOS LaunchAgent (설치된 경우): `$OPENCLAW_STATE_DIR/logs/gateway.log` 및 `gateway.err.log`
- Linux systemd (설치된 경우): `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`
- Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST`

**로깅 더 활성화:**

- 파일 로그 상세도 증가(영속 JSONL):
  ```json
  { "logging": { "level": "debug" } }
  ```
- 콘솔 상세도 증가(TTY 출력만):
  ```json
  { "logging": { "consoleLevel": "debug", "consoleStyle": "pretty" } }
  ```
- 빠른 팁: `--verbose`는 **콘솔** 출력에만 영향을 줍니다. 파일 로그는 `logging.level`로 계속 제어됩니다.

형식, 설정, 접근에 대한 전체 개요는 [/logging](/logging)을 참고하십시오.

### "Gateway start blocked: set gateway.mode=local"

설정이 존재하지만 `gateway.mode`가 설정되지 않았거나(또는 `local`가 아니어서) Gateway(게이트웨이)가 시작을 거부한다는 의미입니다.

**해결(권장):**

- 마법사를 실행하여 Gateway 실행 모드를 **Local**로 설정합니다:
  ```bash
  openclaw configure
  ```
- 또는 직접 설정합니다:
  ```bash
  openclaw config set gateway.mode local
  ```

**대신 원격 Gateway(게이트웨이)를 실행하려던 경우:**

- 원격 URL 을 설정하고 `gateway.mode=remote`를 유지합니다:
  ```bash
  openclaw config set gateway.mode remote
  openclaw config set gateway.remote.url "wss://gateway.example.com"
  ```

**임시/개발 전용:** `--allow-unconfigured`을 전달하여
`gateway.mode=local` 없이 게이트웨이를 시작합니다.

**아직 설정 파일이 없나요?** `openclaw setup`를 실행하여 스타터 설정을 만든 다음,
게이트웨이를 다시 실행하십시오.

### 서비스 환경(PATH + runtime)

게이트웨이 서비스는 셸/매니저 찌꺼기를 피하기 위해 **최소 PATH**로 실행됩니다:

- macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
- Linux: `/usr/local/bin`, `/usr/bin`, `/bin`

이는 의도적으로 버전 매니저(nvm/fnm/volta/asdf)와 패키지
매니저(pnpm/npm)를 제외합니다. 서비스는 셸 init 을 로드하지 않기 때문입니다. `DISPLAY` 같은 런타임
변수는 `~/.openclaw/.env`에 있어야 합니다(게이트웨이가 초기에 로드).
Exec 는 `host=gateway`에서 실행되며 로그인 셸의 `PATH`을 exec 환경으로 병합하므로,
도구가 누락되는 경우는 보통 셸 init 이 이를 export 하지 않기 때문입니다(또는
`tools.exec.pathPrepend`를 설정하십시오). [/tools/exec](/tools/exec)을 참고하십시오.

WhatsApp + Telegram 채널은 **Node**가 필요하며 Bun 은 지원되지 않습니다. 서비스가 Bun 이나 버전 매니저로 설치된 Node 경로로 설치되었다면, `openclaw doctor`를 실행하여
시스템 Node 설치로 마이그레이션하십시오.

### 샌드박스에서 Skill 에 API 키가 누락됨

**증상:** 호스트에서는 Skill 이 작동하지만 샌드박스에서는 API 키 누락으로 실패합니다.

**원인:** 샌드박스 처리된 exec 는 Docker 내부에서 실행되며 호스트 `process.env`을 상속하지 **않습니다**.

**해결:**

- `agents.defaults.sandbox.docker.env` 설정(또는 에이전트별 `agents.list[].sandbox.docker.env`)
- 또는 커스텀 샌드박스 이미지에 키를 포함
- 그런 다음 `openclaw sandbox recreate --agent <id>` 실행(또는 `--all`)

### 서비스는 실행 중이지만 포트가 리스닝하지 않음

서비스가 **실행 중**으로 보고되지만 게이트웨이 포트에서 아무 것도 리스닝하지 않는다면,
Gateway(게이트웨이)가 바인딩을 거부했을 가능성이 큽니다.

**여기서 "running"의 의미**

- `Runtime: running`는 supervisor(launchd/systemd/schtasks)가 프로세스가 살아 있다고 생각한다는 뜻입니다.
- `RPC probe`는 CLI 가 실제로 게이트웨이 WebSocket 에 연결하여 `status`을 호출할 수 있었다는 뜻입니다.
- `Probe target:` + `Config (service):`를 '실제로 무엇을 시도했는가?'에 대한 라인으로 항상 신뢰하십시오.

**확인:**

- `gateway.mode`은 `openclaw gateway` 및 서비스에 대해 `local`이어야 합니다.
- `gateway.mode=remote`를 설정하면, **CLI 기본값**이 원격 URL 이 됩니다. 서비스는 로컬에서 계속 실행 중일 수 있지만, CLI 는 잘못된 위치를 프로브하고 있을 수 있습니다. `openclaw gateway status`를 사용하여 서비스가 해석한 포트 + 프로브 대상을 확인하십시오(또는 `--url` 전달).
- `openclaw gateway status` 및 `openclaw doctor`은 서비스가 실행 중으로 보이지만 포트가 닫혀 있을 때 로그에서 **마지막 게이트웨이 오류**를 표시합니다.
- non-loopback 바인딩(`lan`/`tailnet`/`custom`, 또는 loopback 을 사용할 수 없을 때 `auto`)은 인증이 필요합니다:
  `gateway.auth.token` (또는 `OPENCLAW_GATEWAY_TOKEN`).
- `gateway.remote.token`은 원격 CLI 호출 전용이며 로컬 인증을 **활성화하지 않습니다**.
- `gateway.token`은 무시됩니다. `gateway.auth.token`를 사용하십시오.

**`openclaw gateway status`가 설정 불일치를 표시하는 경우**

- `Config (cli): ...` 및 `Config (service): ...`는 보통 일치해야 합니다.
- 일치하지 않으면, 거의 확실하게 서비스가 실행 중인 설정과 다른 설정을 편집하고 있는 것입니다.
- 해결: 서비스가 사용하길 원하는 동일한 `--profile` / `OPENCLAW_STATE_DIR`에서 `openclaw gateway install --force`를 다시 실행하십시오.

**`openclaw gateway status`가 서비스 설정 문제를 보고하는 경우**

- supervisor 설정(launchd/systemd/schtasks)에 최신 기본값이 누락되었습니다.
- 해결: `openclaw doctor`를 실행하여 업데이트하십시오(또는 전체 재작성은 `openclaw gateway install --force`).

**`Last gateway error:`가 'refusing to bind … without auth'를 언급하는 경우**

- `gateway.bind`을 non-loopback 모드(`lan`/`tailnet`/`custom`, 또는 loopback 을 사용할 수 없을 때 `auto`)로 설정했지만 인증을 구성하지 않았습니다.
- 해결: `gateway.auth.mode` + `gateway.auth.token`를 설정(또는 `OPENCLAW_GATEWAY_TOKEN` export)하고 서비스를 재시작하십시오.

**`openclaw gateway status`가 `bind=tailnet`라고 말하지만 tailnet 인터페이스를 찾지 못한 경우**

- 게이트웨이가 Tailscale IP (100.64.0.0/10)에 바인딩하려고 했지만 호스트에서 아무 것도 감지되지 않았습니다.
- 해결: 해당 머신에서 Tailscale 을 올리거나(또는 `gateway.bind`을 `loopback`/`lan`로 변경).

**`Probe note:`가 프로브가 loopback 을 사용한다고 말하는 경우**

- `bind=lan`에서는 정상입니다. 게이트웨이는 `0.0.0.0` (모든 인터페이스)에서 리스닝하며, 로컬에서는 loopback 으로도 연결되어야 합니다.
- 원격 클라이언트의 경우 실제 LAN IP(`0.0.0.0`가 아닌) + 포트를 사용하고, 인증이 구성되어 있는지 확인하십시오.

### 주소가 이미 사용 중임(포트 18789)

이미 누군가가 게이트웨이 포트에서 리스닝 중임을 의미합니다.

**확인:**

```bash
openclaw gateway status
```

리스너와 가능성이 높은 원인(게이트웨이가 이미 실행 중, SSH 터널)을 표시합니다.
필요하다면 서비스를 중지하거나 다른 포트를 선택하십시오.

### 추가 워크스페이스 폴더가 감지됨

이전 설치에서 업그레이드했다면 디스크에 여전히 `~/openclaw`이 남아 있을 수 있습니다.
여러 워크스페이스 디렉토리는 혼란스러운 인증 또는 상태 드리프트를 유발할 수 있는데,
활성 워크스페이스는 하나뿐이기 때문입니다.

**해결:** 단일 활성 워크스페이스만 유지하고 나머지는 보관/제거하십시오. 다음을 참고하십시오:
[에이전트 워크스페이스](/concepts/agent-workspace#extra-workspace-folders).

### 메인 채팅이 샌드박스 워크스페이스에서 실행 중임

증상: `pwd` 또는 파일 도구가,
호스트 워크스페이스를 예상했는데도 `~/.openclaw/sandboxes/...`를 표시합니다.

**원인:** `agents.defaults.sandbox.mode: "non-main"`은 `session.mainKey`(기본값 `"main"`)를 기준으로 동작합니다.
그룹/채널 세션은 자체 키를 사용하므로 메인이 아닌 것으로 처리되어
샌드박스 워크스페이스를 받습니다.

**해결 옵션:**

- 에이전트에 대해 호스트 워크스페이스를 원한다면: `agents.list[].sandbox.mode: "off"`을 설정합니다.
- 샌드박스 내부에서 호스트 워크스페이스 접근을 원한다면: 해당 에이전트에 대해 `workspaceAccess: "rw"`을 설정합니다.

### "Agent was aborted"

에이전트가 응답 중간에 중단되었습니다.

**원인:**

- 사용자가 `stop`, `abort`, `esc`, `wait`, 또는 `exit`를 보냄
- 타임아웃 초과
- 프로세스 크래시

**해결:** 메시지를 하나 더 보내기만 하면 됩니다. 세션은 계속됩니다.

### "Agent failed before reply: Unknown model: anthropic/claude-haiku-3-5"

OpenClaw 는 의도적으로 **오래되었거나 안전하지 않은 모델**(특히 프롬프트 인젝션에 더 취약한 모델)을 거부합니다. 이 오류가 보이면, 해당 모델 이름은 더 이상 지원되지 않습니다.

**해결:**

- 프로바이더에 대해 **최신** 모델을 선택하고 설정 또는 모델 alias 를 업데이트하십시오.
- 사용 가능한 모델이 확실하지 않다면, `openclaw models list` 또는
  `openclaw models scan`를 실행하고 지원되는 것을 선택하십시오.
- 자세한 실패 이유는 게이트웨이 로그를 확인하십시오.

또한 참고: [Models CLI](/cli/models) 및 [Model providers](/concepts/model-providers).

### 메시지가 트리거되지 않음

**확인 1:** 발신자가 allowlist 에 있나요?

```bash
openclaw status
```

출력에서 `AllowFrom: ...`를 찾으십시오.

**확인 2:** 그룹 채팅의 경우, 멘션이 필요하나요?

```bash
# The message must match mentionPatterns or explicit mentions; defaults live in channel groups/guilds.
# Multi-agent: `agents.list[].groupChat.mentionPatterns` overrides global patterns.
grep -n "agents\\|groupChat\\|mentionPatterns\\|channels\\.whatsapp\\.groups\\|channels\\.telegram\\.groups\\|channels\\.imessage\\.groups\\|channels\\.discord\\.guilds" \
  "${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
```

**확인 3:** 로그 확인

```bash
openclaw logs --follow
# or if you want quick filters:
tail -f "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | grep "blocked\\|skip\\|unauthorized"
```

### 페어링 코드가 도착하지 않음

`dmPolicy`이 `pairing`이면, 알 수 없는 발신자는 코드를 받아야 하고 승인될 때까지 메시지는 무시됩니다.

**확인 1:** 이미 대기 중인 요청이 있나요?

```bash
openclaw pairing list <channel>
```

대기 중인 DM 페어링 요청은 기본적으로 **채널당 3개**로 제한됩니다. 목록이 가득 차 있으면, 하나가 승인되거나 만료될 때까지 새 요청은 코드를 생성하지 않습니다.

**확인 2:** 요청은 생성되었지만 회신이 전송되지 않았나요?

```bash
openclaw logs --follow | grep "pairing request"
```

**확인 3:** 해당 채널에 대해 `dmPolicy`이 `open`/`allowlist`이 아닌지 확인하십시오.

### 이미지 + 멘션이 작동하지 않음

알려진 이슈: WhatsApp 에서 이미지에 멘션만(다른 텍스트 없이) 보낼 때, WhatsApp 이 멘션 메타데이터를 포함하지 않는 경우가 있습니다.

**우회 방법:** 멘션과 함께 텍스트를 추가하십시오:

- ❌ `@openclaw` + 이미지
- ✅ `@openclaw check this` + 이미지

### 세션이 재개되지 않음

**확인 1:** 세션 파일이 있나요?

```bash
ls -la ~/.openclaw/agents/<agentId>/sessions/
```

**확인 2:** 리셋 윈도우가 너무 짧나요?

```json
{
  "session": {
    "reset": {
      "mode": "daily",
      "atHour": 4,
      "idleMinutes": 10080 // 7 days
    }
  }
}
```

**확인 3:** 누군가 `/new`, `/reset`, 또는 리셋 트리거를 보냈나요?

### 에이전트 타임아웃

기본 타임아웃은 30분입니다. 긴 작업의 경우:

```json
{
  "reply": {
    "timeoutSeconds": 3600 // 1 hour
  }
}
```

또는 `process` 도구를 사용하여 긴 명령을 백그라운드로 실행하십시오.

### WhatsApp 연결 끊김

```bash
# Check local status (creds, sessions, queued events)
openclaw status
# Probe the running gateway + channels (WA connect + Telegram + Discord APIs)
openclaw status --deep

# View recent connection events
openclaw logs --limit 200 | grep "connection\\|disconnect\\|logout"
```

**해결:** 보통 Gateway(게이트웨이)가 실행되면 자동으로 재연결됩니다. 계속 문제가 있으면, Gateway(게이트웨이) 프로세스(어떤 방식으로든 supervisor 하는 방식으로)를 재시작하거나, verbose 출력으로 수동 실행하십시오:

```bash
openclaw gateway --verbose
```

로그아웃되었거나 연결이 해제된 경우:

```bash
openclaw channels logout
trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/credentials" # if logout can't cleanly remove everything
openclaw channels login --verbose       # re-scan QR
```

### 미디어 전송 실패

**확인 1:** 파일 경로가 유효한가요?

```bash
ls -la /path/to/your/image.jpg
```

**확인 2:** 크기가 너무 큰가요?

- 이미지: 최대 6MB
- 오디오/비디오: 최대 16MB
- 문서: 최대 100MB

**확인 3:** 미디어 로그 확인

```bash
grep "media\\|fetch\\|download" "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | tail -20
```

### 메모리 사용량이 높음

OpenClaw 는 대화 기록을 메모리에 유지합니다.

**해결:** 주기적으로 재시작하거나 세션 제한을 설정하십시오:

```json
{
  "session": {
    "historyLimit": 100 // Max messages to keep
  }
}
```

## 일반 문제 해결

### "Gateway(게이트웨이)가 시작되지 않음 — 설정이 유효하지 않음"

OpenClaw 는 이제 설정에 알 수 없는 키, 잘못된 값, 또는 유효하지 않은 타입이 포함되어 있으면 시작을 거부합니다.
이는 안전을 위해 의도된 동작입니다.

Doctor 로 해결하십시오:

```bash
openclaw doctor
openclaw doctor --fix
```

참고:

- `openclaw doctor`는 유효하지 않은 모든 항목을 보고합니다.
- `openclaw doctor --fix`은 마이그레이션/수정을 적용하고 설정을 다시 작성합니다.
- `openclaw logs`, `openclaw health`, `openclaw status`, `openclaw gateway status`, 및 `openclaw gateway probe` 같은 진단 명령은 설정이 유효하지 않더라도 계속 실행됩니다.

### "All models failed" — 먼저 무엇을 확인해야 하나요?

- 시도 중인 프로바이더에 대한 **자격 증명**이 존재하는지(인증 프로파일 + 환경 변수).
- **모델 라우팅**: `agents.defaults.model.primary` 및 fallback 이 접근 가능한 모델인지 확인하십시오.
- 정확한 프로바이더 오류를 위해 `/tmp/openclaw/…`의 **게이트웨이 로그**.
- **모델 상태**: `/model status`(채팅) 또는 `openclaw models status`(CLI)를 사용하십시오.

### 개인 WhatsApp 번호로 실행 중인데, 왜 self-chat 이 이상한가요?

self-chat 모드를 활성화하고 본인 번호를 allowlist 에 추가하십시오:

```json5
{
  channels: {
    whatsapp: {
      selfChatMode: true,
      dmPolicy: "allowlist",
      allowFrom: ["+15555550123"],
    },
  },
}
```

[WhatsApp 설정](/channels/whatsapp)을 참고하십시오.

### WhatsApp 이 로그아웃시켰습니다. 어떻게 다시 인증하나요?

로그인 명령을 다시 실행하고 QR 코드를 스캔하십시오:

```bash
openclaw channels login
```

### `main`에서 빌드 오류가 납니다 — 표준 해결 경로는 무엇인가요?

1. `git pull origin main && pnpm install`
2. `openclaw doctor`
3. GitHub 이슈 또는 Discord 확인
4. 임시 우회: 이전 커밋을 체크아웃

### npm install 이 실패합니다(allow-build-scripts / tar 또는 yargs 누락). 이제 어떻게 하나요?

소스에서 실행 중이라면, 리포지토리의 패키지 매니저인 **pnpm**(권장)을 사용하십시오.
리포지토리는 `packageManager: "pnpm@…"`을 선언합니다.

일반적인 복구:

```bash
git status   # ensure you’re in the repo root
pnpm install
pnpm build
openclaw doctor
openclaw gateway restart
```

이유: pnpm 은 이 리포지토리에 대해 설정된 패키지 매니저입니다.

### git 설치와 npm 설치를 어떻게 전환하나요?

**웹사이트 설치 프로그램**을 사용하고 플래그로 설치 방법을 선택하십시오. 이는
제자리에서 업그레이드하고 게이트웨이 서비스가 새 설치를 가리키도록 다시 작성합니다.

**git 설치로 전환**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
```

**npm global 로 전환**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

참고:

- git 플로우는 리포지토리가 깨끗할 때만 rebase 합니다. 먼저 변경 사항을 커밋하거나 stash 하십시오.
- 전환 후 다음을 실행하십시오:
  ```bash
  openclaw doctor
  openclaw gateway restart
  ```

### Telegram 블록 스트리밍이 도구 호출 사이에서 텍스트를 분할하지 않습니다. 왜인가요?

블록 스트리밍은 **완료된 텍스트 블록**만 전송합니다. 단일 메시지가 보이는 일반적인 이유:

- `agents.defaults.blockStreamingDefault`이 여전히 `"off"`입니다.
- `channels.telegram.blockStreaming`이 `false`로 설정되어 있습니다.
- `channels.telegram.streamMode`이 `partial` 또는 `block` **그리고 draft streaming 이 활성화됨**
  (개인 채팅 + topics). 이 경우 draft streaming 이 블록 스트리밍을 비활성화합니다.
- `minChars` / coalesce 설정이 너무 높아 청크가 병합됩니다.
- 모델이 큰 텍스트 블록 하나를 방출합니다(응답 중간 flush 지점 없음).

해결 체크리스트:

1. 블록 스트리밍 설정은 루트가 아니라 `agents.defaults` 아래에 두십시오.
2. 실제 다중 메시지 블록 응답을 원한다면 `channels.telegram.streamMode: "off"`을 설정하십시오.
3. 디버깅 중에는 더 작은 chunk/coalesce 임계값을 사용하십시오.

[스트리밍](/concepts/streaming)을 참고하십시오.

### Discord 는 `requireMention: false`이 있어도 서버에서 답장하지 않습니다. 왜인가요?

`requireMention`는 채널이 allowlist 를 통과한 **이후에**의 멘션 게이팅만 제어합니다.
기본적으로 `channels.discord.groupPolicy`은 **allowlist**이므로, 길드가 명시적으로 활성화되어야 합니다.
`channels.discord.guilds.<guildId>.channels`를 설정하면 목록에 있는 채널만 허용됩니다. 길드의 모든 채널을 허용하려면 이를 생략하십시오.

해결 체크리스트:

1. `channels.discord.groupPolicy: "open"`을 설정 **하거나** 길드 allowlist 항목(그리고 선택적으로 채널 allowlist)을 추가하십시오.
2. `channels.discord.guilds.<guildId>.channels`에는 **숫자 채널 ID**를 사용하십시오.
3. `requireMention: false`은 `channels.discord.guilds` **아래에** 두십시오(전역 또는 채널별).
   최상위 `channels.discord.requireMention`는 지원되는 키가 아닙니다.
4. 봇에 **Message Content Intent**와 채널 권한이 있는지 확인하십시오.
5. 감사 힌트를 위해 `openclaw channels status --probe`을 실행하십시오.

문서: [Discord](/channels/discord), [채널 문제 해결](/channels/troubleshooting).

### Cloud Code Assist API 오류: invalid tool schema (400). 이제 어떻게 하나요?

이는 거의 항상 **도구 스키마 호환성** 문제입니다. Cloud Code Assist
엔드포인트는 JSON Schema 의 엄격한 부분집합만 허용합니다. OpenClaw 는 현재 `main`에서 도구
스키마를 스크럽/정규화하지만, 해당 수정은 아직 마지막 릴리스에는 포함되지 않았습니다(2026년 1월 13일 기준).

해결 체크리스트:

1. **OpenClaw 업데이트**:
   - 소스에서 실행할 수 있다면 `main`를 pull 하고 게이트웨이를 재시작하십시오.
   - 그렇지 않다면, 스키마 스크러버가 포함된 다음 릴리스를 기다리십시오.
2. `anyOf/oneOf/allOf`, `patternProperties`,
   `additionalProperties`, `minLength`, `maxLength`, `format` 등과 같은 지원되지 않는 키워드를 피하십시오.
3. 커스텀 도구를 정의한다면, 최상위 스키마를 `type: "object"`로 두고
   `properties` 및 단순 enum 을 유지하십시오.

[도구](/tools) 및 [TypeBox 스키마](/concepts/typebox)을 참고하십시오.

## macOS 전용 이슈

### 권한 부여 시 앱이 크래시됨(음성/마이크)

개인정보 프롬프트에서 "Allow"를 클릭할 때 앱이 사라지거나 "Abort trap 6"을 표시하는 경우:

**해결 1: TCC 캐시 초기화**

```bash
tccutil reset All bot.molt.mac.debug
```

**해결 2: 새 Bundle ID 강제**
초기화가 작동하지 않으면, [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh)에서 `BUNDLE_ID`을 변경(예: `.test` 접미사를 추가)하고 다시 빌드하십시오. 이는 macOS 가 이를 새 앱으로 취급하도록 강제합니다.

### "Starting..."에서 Gateway(게이트웨이)가 멈춤

앱은 포트 `18789`에서 로컬 게이트웨이에 연결합니다. 계속 멈춰 있다면:

**해결 1: supervisor 중지(권장)**
게이트웨이가 launchd 로 supervisor 되고 있다면, PID 를 kill 해도 재스폰됩니다. 먼저 supervisor 를 중지하십시오:

```bash
openclaw gateway status
openclaw gateway stop
# Or: launchctl bootout gui/$UID/bot.molt.gateway (replace with bot.molt.<profile>; legacy com.openclaw.* still works)
```

**해결 2: 포트가 사용 중임(리스너 찾기)**

```bash
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

supervisor 되지 않는 프로세스라면, 먼저 정상 종료를 시도한 다음 필요 시 강화하십시오:

```bash
kill -TERM <PID>
sleep 1
kill -9 <PID> # last resort
```

**해결 3: CLI 설치 확인**
전역 `openclaw` CLI 가 설치되어 있고 앱 버전과 일치하는지 확인하십시오:

```bash
openclaw --version
npm install -g openclaw@<version>
```

## 디버그 모드

자세한 로깅을 활성화합니다:

```bash
# Turn on trace logging in config:
#   ${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json} -> { logging: { level: "trace" } }
#
# Then run verbose commands to mirror debug output to stdout:
openclaw gateway --verbose
openclaw channels login --verbose
```

## 로그 위치

| Log                                | Location                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 게이트웨이 파일 로그(구조화됨)     | `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (또는 `logging.file`)                                                                                                                                                                                                                                                                 |
| 게이트웨이 서비스 로그(supervisor) | macOS: `$OPENCLAW_STATE_DIR/logs/gateway.log` + `gateway.err.log` (기본값: `~/.openclaw/logs/...`; 프로파일은 `~/.openclaw-<profile>/logs/...` 사용)<br />Linux: `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`<br />Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST` |
| 세션 파일                          | `$OPENCLAW_STATE_DIR/agents/<agentId>/sessions/`                                                                                                                                                                                                                                                                              |
| 미디어 캐시                        | `$OPENCLAW_STATE_DIR/media/`                                                                                                                                                                                                                                                                                                  |
| 자격 증명                          | `$OPENCLAW_STATE_DIR/credentials/`                                                                                                                                                                                                                                                                                            |

## 상태 검사

```bash
# Supervisor + probe target + config paths
openclaw gateway status
# Include system-level scans (legacy/extra services, port listeners)
openclaw gateway status --deep

# Is the gateway reachable?
openclaw health --json
# If it fails, rerun with connection details:
openclaw health --verbose

# Is something listening on the default port?
lsof -nP -iTCP:18789 -sTCP:LISTEN

# Recent activity (RPC log tail)
openclaw logs --follow
# Fallback if RPC is down
tail -20 /tmp/openclaw/openclaw-*.log
```

## 모두 초기화

극단적인 옵션:

```bash
openclaw gateway stop
# If you installed a service and want a clean install:
# openclaw gateway uninstall

trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
openclaw channels login         # re-pair WhatsApp
openclaw gateway restart           # or: openclaw gateway
```

⚠️ 이는 모든 세션을 잃게 하며 WhatsApp 재페어링이 필요합니다.

## 도움 받기

1. 먼저 로그를 확인하십시오: `/tmp/openclaw/` (기본값: `openclaw-YYYY-MM-DD.log`, 또는 설정된 `logging.file`)
2. GitHub 에서 기존 이슈 검색
3. 새 이슈를 다음과 함께 열기:
   - OpenClaw 버전
   - 관련 로그 스니펫
   - 재현 단계
   - 설정(시크릿 마스킹!)

---

_"꺼졌다 켜보셨나요?"_ — 모든 IT 담당자들의 영원한 명언

🦞🔧

### 브라우저가 시작되지 않음(Linux)

`"Failed to start Chrome CDP on port 18800"`가 보이면:

**가장 가능성 높은 원인:** Ubuntu 에서 Snap 패키지로 설치된 Chromium.

**빠른 해결:** 대신 Google Chrome 을 설치하십시오:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
```

그런 다음 설정에서 다음을 지정하십시오:

```json
{
  "browser": {
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

**전체 가이드:** [browser-linux-troubleshooting](/tools/browser-linux-troubleshooting)을 참고하십시오.
