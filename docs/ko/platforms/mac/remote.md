---
summary: "SSH 를 통해 원격 OpenClaw 게이트웨이를 제어하기 위한 macOS 앱 흐름"
read_when:
  - 원격 mac 제어 설정 또는 디버깅 시
title: "원격 제어"
x-i18n:
  source_path: platforms/mac/remote.md
  source_hash: 61b43707250d5515
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:11Z
---

# 원격 OpenClaw (macOS ⇄ 원격 호스트)

이 흐름을 사용하면 macOS 앱이 다른 호스트(데스크톱/서버)에서 실행 중인 OpenClaw 게이트웨이에 대한 완전한 원격 제어 역할을 수행합니다. 이는 앱의 **Remote over SSH**(원격 실행) 기능입니다. 상태 점검, Voice Wake 전달, Web Chat 등 모든 기능은 *설정 → 일반*에 있는 동일한 원격 SSH 설정을 재사용합니다.

## 모드

- **로컬(이 Mac)**: 모든 것이 노트북에서 실행됩니다. SSH 는 사용되지 않습니다.
- **Remote over SSH (기본값)**: OpenClaw 명령이 원격 호스트에서 실행됩니다. mac 앱은 `-o BatchMode` 와 선택한 아이덴티티/키, 그리고 로컬 포트 포워딩으로 SSH 연결을 엽니다.
- **Remote direct (ws/wss)**: SSH 터널을 사용하지 않습니다. mac 앱이 게이트웨이 URL 에 직접 연결합니다(예: Tailscale Serve 또는 공개 HTTPS 리버스 프록시).

## 원격 전송 방식

원격 모드는 두 가지 전송 방식을 지원합니다:

- **SSH 터널**(기본값): `ssh -N -L ...` 를 사용해 게이트웨이 포트를 localhost 로 포워딩합니다. 터널이 loopback 이므로 게이트웨이는 노드의 IP 를 `127.0.0.1` 으로 인식합니다.
- **직접 연결 (ws/wss)**: 게이트웨이 URL 에 바로 연결합니다. 게이트웨이는 실제 클라이언트 IP 를 인식합니다.

## 원격 호스트의 사전 요구 사항

1. Node + pnpm 을 설치하고 OpenClaw CLI 를 빌드/설치합니다(`pnpm install && pnpm build && pnpm link --global`).
2. 비대화형 셸에서 `openclaw` 가 PATH 에 포함되어 있는지 확인합니다(필요 시 `/usr/local/bin` 또는 `/opt/homebrew/bin` 에 심볼릭 링크).
3. 키 인증으로 SSH 를 엽니다. LAN 외부에서도 안정적인 접근을 위해 **Tailscale** IP 사용을 권장합니다.

## macOS 앱 설정

1. *설정 → 일반*을 엽니다.
2. **OpenClaw 실행 위치**에서 **Remote over SSH** 를 선택하고 다음을 설정합니다:
   - **전송 방식**: **SSH 터널** 또는 **직접 연결 (ws/wss)**.
   - **SSH 대상**: `user@host` (선택적으로 `:port`).
     - 게이트웨이가 동일한 LAN 에 있고 Bonjour 를 광고하는 경우, 검색된 목록에서 선택하면 이 필드가 자동으로 채워집니다.
   - **Gateway URL**(Direct 전용): `wss://gateway.example.ts.net` (또는 로컬/LAN 의 경우 `ws://...`).
   - **아이덴티티 파일**(고급): 키 파일 경로.
   - **프로젝트 루트**(고급): 명령에 사용되는 원격 체크아웃 경로.
   - **CLI 경로**(고급): 실행 가능한 `openclaw` 엔트리포인트/바이너리의 선택적 경로(광고된 경우 자동 입력).
3. **원격 테스트**를 클릭합니다. 성공하면 원격 `openclaw status --json` 가 정상적으로 실행되고 있음을 의미합니다. 실패는 보통 PATH/CLI 문제이며, 종료 코드 127 은 원격에서 CLI 를 찾지 못했음을 뜻합니다.
4. 이제 상태 점검과 Web Chat 이 이 SSH 터널을 통해 자동으로 실행됩니다.

## Web Chat

- **SSH 터널**: Web Chat 이 포워딩된 WebSocket 제어 포트(기본값 18789)를 통해 게이트웨이에 연결합니다.
- **직접 연결 (ws/wss)**: Web Chat 이 설정된 게이트웨이 URL 에 직접 연결합니다.
- 더 이상 별도의 WebChat HTTP 서버는 없습니다.

## 권한

- 원격 호스트에는 로컬과 동일한 TCC 승인(자동화, 접근성, 화면 기록, 마이크, 음성 인식, 알림)이 필요합니다. 해당 머신에서 온보딩을 실행해 한 번만 부여하세요.
- 노드는 `node.list` / `node.describe` 를 통해 권한 상태를 광고하므로 에이전트가 사용 가능 항목을 알 수 있습니다.

## 보안 참고 사항

- 원격 호스트에서는 loopback 바인딩을 선호하고 SSH 또는 Tailscale 로 연결하세요.
- Gateway 를 비 loopback 인터페이스에 바인딩하는 경우 토큰/비밀번호 인증을 요구하세요.
- [Security](/gateway/security) 및 [Tailscale](/gateway/tailscale) 를 참고하세요.

## WhatsApp 로그인 흐름(원격)

- `openclaw channels login --verbose` 를 **원격 호스트에서** 실행합니다. 휴대폰의 WhatsApp 으로 QR 을 스캔하세요.
- 인증이 만료되면 해당 호스트에서 로그인을 다시 실행하세요. 상태 점검에서 링크 문제를 표시합니다.

## 문제 해결

- **exit 127 / not found**: 비로그인 셸에서 `openclaw` 가 PATH 에 없습니다. `/etc/paths` 나 셸 rc 에 추가하거나 `/usr/local/bin`/`/opt/homebrew/bin` 에 심볼릭 링크를 만드세요.
- **Health probe failed**: SSH 연결 가능 여부, PATH, 그리고 Baileys 로그인 상태(`openclaw status --json`)를 확인하세요.
- **Web Chat 멈춤**: 원격 호스트에서 게이트웨이가 실행 중인지와 포워딩된 포트가 게이트웨이 WS 포트와 일치하는지 확인하세요. UI 는 정상적인 WS 연결이 필요합니다.
- **노드 IP 가 127.0.0.1 로 표시됨**: SSH 터널 사용 시 정상입니다. 게이트웨이가 실제 클라이언트 IP 를 보도록 하려면 **전송 방식**을 **직접 연결 (ws/wss)** 로 전환하세요.
- **Voice Wake**: 원격 모드에서는 트리거 문구가 자동으로 전달되며, 별도의 포워더는 필요하지 않습니다.

## 알림 사운드

`openclaw` 및 `node.invoke` 를 사용해 스크립트에서 알림별 사운드를 선택하세요. 예:

```bash
openclaw nodes notify --node <id> --title "Ping" --body "Remote gateway ready" --sound Glass
```

앱에는 더 이상 전역 “기본 사운드” 토글이 없으며, 호출자는 요청별로 사운드(또는 없음)를 선택합니다.
