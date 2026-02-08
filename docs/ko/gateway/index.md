---
summary: "Gateway(게이트웨이) 서비스, 라이프사이클 및 운영을 위한 런북"
read_when:
  - Gateway(게이트웨이) 프로세스를 실행하거나 디버깅할 때
title: "Gateway(게이트웨이) 런북"
x-i18n:
  source_path: gateway/index.md
  source_hash: 497d58090faaa6bd
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:18Z
---

# Gateway(게이트웨이) 서비스 런북

마지막 업데이트: 2025-12-09

## 이것이 무엇인가

- 단일 Baileys/Telegram 연결과 제어/이벤트 플레인을 소유하는 상시 실행 프로세스입니다.
- 레거시 `gateway` 명령을 대체합니다. CLI 진입점: `openclaw gateway`.
- 중지될 때까지 실행됩니다. 치명적 오류 시 0 이 아닌 값으로 종료하여 슈퍼바이저가 재시작하도록 합니다.

## 실행 방법(로컬)

```bash
openclaw gateway --port 18789
# for full debug/trace logs in stdio:
openclaw gateway --port 18789 --verbose
# if the port is busy, terminate listeners then start:
openclaw gateway --force
# dev loop (auto-reload on TS changes):
pnpm gateway:watch
```

- 설정 핫 리로드는 `~/.openclaw/openclaw.json` (또는 `OPENCLAW_CONFIG_PATH`)를 감시합니다.
  - 기본 모드: `gateway.reload.mode="hybrid"` (안전한 변경은 핫 적용, 중요 변경은 재시작).
  - 핫 리로드는 필요 시 **SIGUSR1** 를 통한 프로세스 내부 재시작을 사용합니다.
  - `gateway.reload.mode="off"` 로 비활성화합니다.
- WebSocket 제어 플레인을 `127.0.0.1:<port>` (기본 18789)에 바인딩합니다.
- 동일한 포트에서 HTTP(제어 UI, hooks, A2UI)도 제공합니다. 단일 포트 멀티플렉싱입니다.
  - OpenAI Chat Completions(HTTP): [`/v1/chat/completions`](/gateway/openai-http-api).
  - OpenResponses(HTTP): [`/v1/responses`](/gateway/openresponses-http-api).
  - Tools Invoke(HTTP): [`/tools/invoke`](/gateway/tools-invoke-http-api).
- 기본적으로 `canvasHost.port` (기본 `18793`)에서 Canvas 파일 서버를 시작하여 `~/.openclaw/workspace/canvas` 에서 `http://<gateway-host>:18793/__openclaw__/canvas/` 를 제공합니다. `canvasHost.enabled=false` 또는 `OPENCLAW_SKIP_CANVAS_HOST=1` 로 비활성화합니다.
- stdout 으로 로그를 출력합니다. launchd/systemd 를 사용해 프로세스를 유지하고 로그를 로테이션하십시오.
- 문제 해결 시 `--verbose` 를 전달하면 로그 파일의 디버그 로깅(핸드셰이크, 요청/응답, 이벤트)을 stdio 로 미러링합니다.
- `--force` 은 `lsof` 를 사용해 선택한 포트의 리스너를 찾고 SIGTERM 을 보낸 다음, 종료한 대상을 로그로 남기고 게이트웨이를 시작합니다(`lsof` 가 없으면 빠르게 실패합니다).
- 슈퍼바이저(launchd/systemd/mac 앱 자식 프로세스 모드) 하에서 실행하는 경우, 중지/재시작은 보통 **SIGTERM** 을 보냅니다. 이전 빌드는 이를 `pnpm` `ELIFECYCLE` 종료 코드 **143**(SIGTERM)으로 표시할 수 있는데, 이는 크래시가 아니라 정상 종료입니다.
- **SIGUSR1** 은 권한이 있는 경우(게이트웨이 도구/설정 적용/업데이트, 또는 수동 재시작을 위해 `commands.restart` 활성화) 프로세스 내부 재시작을 트리거합니다.
- 기본적으로 Gateway(게이트웨이) 인증이 필요합니다: `gateway.auth.token` (또는 `OPENCLAW_GATEWAY_TOKEN`) 또는 `gateway.auth.password` 를 설정하십시오. 클라이언트는 Tailscale Serve identity 를 사용하지 않는 한 `connect.params.auth.token/password` 를 보내야 합니다.
- 마법사는 이제 loopback 에서도 기본적으로 토큰을 생성합니다.
- 포트 우선순위: `--port` > `OPENCLAW_GATEWAY_PORT` > `gateway.port` > 기본 `18789`.

## 원격 액세스

- Tailscale/VPN 을 권장하며, 그렇지 않으면 SSH 터널을 사용하십시오:
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- 그런 다음 클라이언트는 터널을 통해 `ws://127.0.0.1:18789` 로 연결합니다.
- 토큰이 설정되어 있다면, 터널을 통해서도 클라이언트는 `connect.params.auth.token` 에 이를 포함해야 합니다.

## 여러 Gateway(게이트웨이)(동일 호스트)

대개 불필요합니다: 하나의 Gateway(게이트웨이)가 여러 메시징 채널과 에이전트를 제공할 수 있습니다. 중복성 또는 엄격한 격리(예: 복구 봇)를 위해서만 여러 Gateway(게이트웨이)를 사용하십시오.

상태 + 설정을 격리하고 고유 포트를 사용하면 지원됩니다. 전체 가이드: [Multiple gateways](/gateway/multiple-gateways).

서비스 이름은 프로필을 인식합니다:

- macOS: `bot.molt.<profile>` (레거시 `com.openclaw.*` 가 여전히 존재할 수 있음)
- Linux: `openclaw-gateway-<profile>.service`
- Windows: `OpenClaw Gateway (<profile>)`

설치 메타데이터는 서비스 설정에 내장됩니다:

- `OPENCLAW_SERVICE_MARKER=openclaw`
- `OPENCLAW_SERVICE_KIND=gateway`
- `OPENCLAW_SERVICE_VERSION=<version>`

Rescue-Bot 패턴: 두 번째 Gateway(게이트웨이)를 자체 프로필, 상태 디렉토리, 워크스페이스 및 기본 포트 간격으로 격리해 유지하십시오. 전체 가이드: [Rescue-bot guide](/gateway/multiple-gateways#rescue-bot-guide).

### Dev 프로필(`--dev`)

빠른 경로: 기본 설정을 건드리지 않고(설정/상태/워크스페이스) 완전히 격리된 dev 인스턴스를 실행합니다.

```bash
openclaw --dev setup
openclaw --dev gateway --allow-unconfigured
# then target the dev instance:
openclaw --dev status
openclaw --dev health
```

기본값(env/flags/config 로 재정의 가능):

- `OPENCLAW_STATE_DIR=~/.openclaw-dev`
- `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
- `OPENCLAW_GATEWAY_PORT=19001` (Gateway(게이트웨이) WS + HTTP)
- 브라우저 제어 서비스 포트 = `19003` (파생: `gateway.port+2`, loopback 전용)
- `canvasHost.port=19005` (파생: `gateway.port+4`)
- `agents.defaults.workspace` 기본값은 `--dev` 하에서 `setup`/`onboard` 를 실행하면 `~/.openclaw/workspace-dev` 가 됩니다.

파생 포트(경험칙):

- 기본 포트 = `gateway.port` (또는 `OPENCLAW_GATEWAY_PORT` / `--port`)
- 브라우저 제어 서비스 포트 = 기본 + 2(loopback 전용)
- `canvasHost.port = base + 4` (또는 `OPENCLAW_CANVAS_HOST_PORT` / 설정 재정의)
- 브라우저 프로필 CDP 포트는 `browser.controlPort + 9 .. + 108` 에서 자동 할당됩니다(프로필별로 지속 저장됨).

인스턴스별 체크리스트:

- 고유 `gateway.port`
- 고유 `OPENCLAW_CONFIG_PATH`
- 고유 `OPENCLAW_STATE_DIR`
- 고유 `agents.defaults.workspace`
- WhatsApp 을 사용하는 경우, 별도의 WhatsApp 번호

프로필별 서비스 설치:

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

예시:

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/a.json OPENCLAW_STATE_DIR=~/.openclaw-a openclaw gateway --port 19001
OPENCLAW_CONFIG_PATH=~/.openclaw/b.json OPENCLAW_STATE_DIR=~/.openclaw-b openclaw gateway --port 19002
```

## 프로토콜(운영자 관점)

- 전체 문서: [Gateway protocol](/gateway/protocol) 및 [Bridge protocol (legacy)](/gateway/bridge-protocol).
- 클라이언트의 필수 첫 프레임: `req {type:"req", id, method:"connect", params:{minProtocol,maxProtocol,client:{id,displayName?,version,platform,deviceFamily?,modelIdentifier?,mode,instanceId?}, caps, auth?, locale?, userAgent? } }`.
- Gateway(게이트웨이)는 `res {type:"res", id, ok:true, payload:hello-ok }` 로 응답합니다(또는 오류와 함께 `ok:false` 를 보낸 뒤 닫습니다).
- 핸드셰이크 이후:
  - 요청: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - 이벤트: `{type:"event", event, payload, seq?, stateVersion?}`
- 구조화된 presence 엔트리: `{host, ip, version, platform?, deviceFamily?, modelIdentifier?, mode, lastInputSeconds?, ts, reason?, tags?[], instanceId? }` (WS 클라이언트의 경우 `instanceId` 는 `connect.client.instanceId` 에서 옵니다).
- `agent` 응답은 2단계입니다: 먼저 `res` ack `{runId,status:"accepted"}`, 그 다음 실행이 끝난 후 최종 `res` `{runId,status:"ok"|"error",summary}`; 스트리밍 출력은 `event:"agent"` 로 도착합니다.

## 메서드(초기 세트)

- `health` — 전체 헬스 스냅샷(`openclaw health --json` 와 동일한 형태).
- `status` — 짧은 요약.
- `system-presence` — 현재 presence 목록.
- `system-event` — presence/시스템 노트(구조화됨) 게시.
- `send` — 활성 채널을 통해 메시지 전송.
- `agent` — 에이전트 턴 실행(동일한 연결에서 이벤트를 스트리밍하여 반환).
- `node.list` — 페어링된 + 현재 연결된 노드 목록(`caps`, `deviceFamily`, `modelIdentifier`, `paired`, `connected` 및 광고된 `commands` 포함).
- `node.describe` — 노드 설명(기능 + 지원되는 `node.invoke` 명령; 페어링된 노드와 현재 연결된 미페어링 노드 모두에서 동작).
- `node.invoke` — 노드에서 명령 호출(예: `canvas.*`, `camera.*`).
- `node.pair.*` — 페어링 라이프사이클(`request`, `list`, `approve`, `reject`, `verify`).

또한 참고: presence 가 어떻게 생성/중복 제거되는지와 안정적인 `client.instanceId` 가 왜 중요한지에 대해서는 [Presence](/concepts/presence) 를 참조하십시오.

## 이벤트

- `agent` — 에이전트 실행에서 스트리밍되는 도구/출력 이벤트(seq 태그됨).
- `presence` — presence 업데이트(stateVersion 을 포함한 델타)가 연결된 모든 클라이언트로 푸시됩니다.
- `tick` — 주기적인 keepalive/no-op 으로 생존을 확인합니다.
- `shutdown` — Gateway(게이트웨이)가 종료 중입니다; 페이로드에는 `reason` 및 선택적 `restartExpectedMs` 가 포함됩니다. 클라이언트는 재연결해야 합니다.

## WebChat 통합

- WebChat 은 히스토리, 전송, 중단, 이벤트를 위해 Gateway(게이트웨이) WebSocket 과 직접 통신하는 네이티브 SwiftUI UI 입니다.
- 원격 사용은 동일한 SSH/Tailscale 터널을 통과합니다. 게이트웨이 토큰이 설정되어 있다면, 클라이언트는 `connect` 동안 이를 포함합니다.
- macOS 앱은 단일 WS(공유 연결)로 연결합니다. 초기 스냅샷에서 presence 를 하이드레이트하고, UI 업데이트를 위해 `presence` 이벤트를 수신합니다.

## 타이핑 및 검증

- 서버는 들어오는 모든 프레임을 프로토콜 정의에서 생성된 JSON Schema 에 대해 AJV 로 검증합니다.
- 클라이언트(TS/Swift)는 생성된 타입을 사용합니다(TS 는 직접, Swift 는 저장소의 생성기를 통해).
- 프로토콜 정의가 단일 진실 소스입니다. 다음으로 스키마/모델을 재생성하십시오:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`

## 연결 스냅샷

- `hello-ok` 는 `presence`, `health`, `stateVersion`, `uptimeMs` 및 `policy {maxPayload,maxBufferedBytes,tickIntervalMs}` 를 포함하는 `snapshot` 를 포함하므로, 클라이언트는 추가 요청 없이 즉시 렌더링할 수 있습니다.
- `health`/`system-presence` 는 수동 새로고침을 위해 계속 제공되지만, 연결 시점에는 필요하지 않습니다.

## 오류 코드(res.error 형태)

- 오류는 `{ code, message, details?, retryable?, retryAfterMs? }` 를 사용합니다.
- 표준 코드:
  - `NOT_LINKED` — WhatsApp 인증되지 않음.
  - `AGENT_TIMEOUT` — 에이전트가 설정된 마감시간 내에 응답하지 않았습니다.
  - `INVALID_REQUEST` — 스키마/파라미터 검증에 실패했습니다.
  - `UNAVAILABLE` — Gateway(게이트웨이)가 종료 중이거나 의존성이 사용 불가능합니다.

## Keepalive 동작

- `tick` 이벤트(또는 WS ping/pong)가 주기적으로 발생하여, 트래픽이 없더라도 클라이언트가 Gateway(게이트웨이)가 살아 있음을 알 수 있습니다.
- 전송/에이전트 ack 는 별도의 응답으로 유지됩니다. 전송을 위해 tick 을 과도하게 사용하지 마십시오.

## 리플레이 / 공백

- 이벤트는 리플레이되지 않습니다. 클라이언트는 seq 공백을 감지하고, 계속하기 전에 새로고침(`health` + `system-presence`)해야 합니다. WebChat 및 macOS 클라이언트는 이제 공백 발생 시 자동으로 새로고침합니다.

## 슈퍼비전(macOS 예시)

- launchd 를 사용해 서비스를 살아 있게 유지하십시오:
  - Program: `openclaw` 의 경로
  - Arguments: `gateway`
  - KeepAlive: true
  - StandardOut/Err: 파일 경로 또는 `syslog`
- 실패 시 launchd 가 재시작합니다. 치명적인 설정 오류는 운영자가 알아차리도록 계속 종료되어야 합니다.
- LaunchAgents 는 사용자별이며 로그인된 세션이 필요합니다. 헤드리스 설정에서는 사용자 정의 LaunchDaemon(미제공)을 사용하십시오.
  - `openclaw gateway install` 는 `~/Library/LaunchAgents/bot.molt.gateway.plist` 를 작성합니다
    (또는 `bot.molt.<profile>.plist`; 레거시 `com.openclaw.*` 는 정리됩니다).
  - `openclaw doctor` 는 LaunchAgent 설정을 감사하고 현재 기본값으로 업데이트할 수 있습니다.

## Gateway(게이트웨이) 서비스 관리(CLI)

설치/시작/중지/재시작/상태를 위해 Gateway(게이트웨이) CLI 를 사용하십시오:

```bash
openclaw gateway status
openclaw gateway install
openclaw gateway stop
openclaw gateway restart
openclaw logs --follow
```

참고:

- `gateway status` 는 기본적으로 서비스의 해석된 포트/설정을 사용해 Gateway(게이트웨이) RPC 를 프로빙합니다(`--url` 로 재정의).
- `gateway status --deep` 는 시스템 수준 스캔(LaunchDaemons/system units)을 추가합니다.
- `gateway status --no-probe` 는 RPC 프로브를 건너뜁니다(네트워킹이 다운된 경우 유용).
- `gateway status --json` 는 스크립트용으로 안정적입니다.
- `gateway status` 는 **슈퍼바이저 런타임**(launchd/systemd 실행 중)과 **RPC 도달 가능성**(WS 연결 + status RPC)을 분리해 보고합니다.
- `gateway status` 는 “localhost vs LAN 바인드” 혼동과 프로필 불일치를 피하기 위해 설정 경로 + 프로브 대상을 출력합니다.
- `gateway status` 은 서비스가 실행 중으로 보이지만 포트가 닫혀 있을 때 마지막 게이트웨이 오류 라인을 포함합니다.
- `logs` 은 RPC 를 통해 Gateway(게이트웨이) 파일 로그를 tail 합니다(수동 `tail`/`grep` 불필요).
- 다른 게이트웨이 유사 서비스가 감지되면, OpenClaw 프로필 서비스가 아닌 한 CLI 가 경고합니다.
  대부분의 구성에서는 **머신당 하나의 게이트웨이**를 여전히 권장합니다. 중복성 또는 복구 봇을 위해 격리된 프로필/포트를 사용하십시오. [Multiple gateways](/gateway/multiple-gateways) 를 참조하십시오.
  - 정리: `openclaw gateway uninstall`(현재 서비스) 및 `openclaw doctor`(레거시 마이그레이션).
- `gateway install` 는 이미 설치된 경우 no-op 입니다. `openclaw gateway install --force` 로 재설치하십시오(프로필/env/path 변경).

번들된 mac 앱:

- OpenClaw.app 은 Node 기반 게이트웨이 릴레이를 번들할 수 있으며, 다음 라벨을 가진 사용자별 LaunchAgent 를 설치할 수 있습니다:
  `bot.molt.gateway` (또는 `bot.molt.<profile>`; 레거시 `com.openclaw.*` 라벨도 정상적으로 언로드됨).
- 깔끔하게 중지하려면 `openclaw gateway stop` (또는 `launchctl bootout gui/$UID/bot.molt.gateway`)을 사용하십시오.
- 재시작하려면 `openclaw gateway restart` (또는 `launchctl kickstart -k gui/$UID/bot.molt.gateway`)을 사용하십시오.
  - `launchctl` 은 LaunchAgent 가 설치된 경우에만 동작합니다. 그렇지 않으면 먼저 `openclaw gateway install` 를 사용하십시오.
  - 명명된 프로필을 실행할 때는 라벨을 `bot.molt.<profile>` 로 교체하십시오.

## 슈퍼비전(systemd 사용자 유닛)

OpenClaw 는 Linux/WSL2 에서 기본적으로 **systemd 사용자 서비스**를 설치합니다. 단일 사용자 머신에서는 사용자 서비스를 권장합니다(더 단순한 env, 사용자별 설정). 다중 사용자 또는 상시 실행 서버에는 **시스템 서비스**를 사용하십시오(lingering 불필요, 공유 슈퍼비전).

`openclaw gateway install` 는 사용자 유닛을 작성합니다. `openclaw doctor` 는 유닛을 감사하고 현재 권장 기본값과 일치하도록 업데이트할 수 있습니다.

`~/.config/systemd/user/openclaw-gateway[-<profile>].service` 생성:

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5
Environment=OPENCLAW_GATEWAY_TOKEN=
WorkingDirectory=/home/youruser

[Install]
WantedBy=default.target
```

lingering 활성화(로그아웃/유휴 상태에서도 사용자 서비스가 유지되려면 필요):

```
sudo loginctl enable-linger youruser
```

온보딩은 Linux/WSL2 에서 이를 실행합니다(sudo 를 요청할 수 있음; `/var/lib/systemd/linger` 를 작성함). 그런 다음 서비스를 활성화하십시오:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```

**대안(시스템 서비스)** - 상시 실행 또는 다중 사용자 서버의 경우, 사용자 유닛 대신 systemd **시스템** 유닛을 설치할 수 있습니다(lingering 불필요). `/etc/systemd/system/openclaw-gateway[-<profile>].service` 를 생성하십시오(위 유닛을 복사하고 `WantedBy=multi-user.target` 를 전환하고 `User=` + `WorkingDirectory=` 를 설정), 그 다음:

```
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway[-<profile>].service
```

## Windows(WSL2)

Windows 설치는 **WSL2** 를 사용하고 위의 Linux systemd 섹션을 따르십시오.

## 운영 체크

- 생존성: WS 를 열고 `req:connect` 를 전송 → `payload.type="hello-ok"`(스냅샷 포함)을 포함한 `res` 를 기대합니다.
- 준비성: `health` 를 호출 → `ok: true` 및(`linkChannel` 에) 링크된 채널(해당 시)을 기대합니다.
- 디버그: `tick` 및 `presence` 이벤트를 구독하십시오. `status` 가 링크/인증 경과 시간을 표시하는지 확인하십시오. presence 엔트리는 Gateway(게이트웨이) 호스트와 연결된 클라이언트를 표시해야 합니다.

## 안전 보장

- 기본적으로 호스트당 하나의 Gateway(게이트웨이)를 가정하십시오. 여러 프로필을 실행한다면 포트/상태를 격리하고 올바른 인스턴스를 대상으로 하십시오.
- 직접 Baileys 연결로의 폴백은 없습니다. Gateway(게이트웨이)가 다운되면 전송은 빠르게 실패합니다.
- 비연결 첫 프레임 또는 잘못된 JSON 은 거부되며 소켓은 닫힙니다.
- 정상 종료: 닫기 전에 `shutdown` 이벤트를 방출합니다. 클라이언트는 close + 재연결을 처리해야 합니다.

## CLI 헬퍼

- `openclaw gateway health|status` — Gateway(게이트웨이) WS 를 통해 헬스/상태를 요청합니다.
- `openclaw message send --target <num> --message "hi" [--media ...]` — Gateway(게이트웨이)를 통해 전송합니다(WhatsApp 에 대해 멱등).
- `openclaw agent --message "hi" --to <num>` — 에이전트 턴을 실행합니다(기본적으로 최종 응답을 기다림).
- `openclaw gateway call <method> --params '{"k":"v"}'` — 디버깅을 위한 로우 메서드 인보커.
- `openclaw gateway stop|restart` — 감독되는 게이트웨이 서비스를 중지/재시작합니다(launchd/systemd).
- Gateway(게이트웨이) 헬퍼 서브커맨드는 `--url` 에서 실행 중인 게이트웨이를 가정합니다. 더 이상 자동으로 스폰하지 않습니다.

## 마이그레이션 가이드

- `openclaw gateway` 및 레거시 TCP 제어 포트 사용을 폐기하십시오.
- 클라이언트를 업데이트하여 필수 connect 및 구조화된 presence 를 포함한 WS 프로토콜을 사용하도록 하십시오.
