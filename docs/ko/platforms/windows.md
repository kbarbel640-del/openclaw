---
summary: "Windows (WSL2) 지원 + 컴패니언 앱 상태"
read_when:
  - Windows 에 OpenClaw 를 설치할 때
  - Windows 컴패니언 앱 상태를 찾을 때
title: "Windows (WSL2)"
x-i18n:
  source_path: platforms/windows.md
  source_hash: c93d2263b4e5b60c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:12Z
---

# Windows (WSL2)

Windows 에서의 OpenClaw 는 **WSL2 를 통해** 사용하는 것을 권장합니다( Ubuntu 권장).  
CLI + Gateway(게이트웨이) 는 Linux 내부에서 실행되며, 이는 런타임을 일관되게 유지하고
도구 호환성(Node/Bun/pnpm, Linux 바이너리, Skills) 을 크게 향상시킵니다.  
네이티브 Windows 환경은 더 까다로울 수 있습니다. WSL2 는 완전한 Linux 경험을 제공하며 —
설치는 한 가지 명령이면 충분합니다: `wsl --install`.

네이티브 Windows 컴패니언 앱은 계획 중입니다.

## 설치 (WSL2)

- [시작하기](/start/getting-started) (WSL 내부에서 사용)
- [설치 및 업데이트](/install/updating)
- 공식 WSL2 가이드(Microsoft): https://learn.microsoft.com/windows/wsl/install

## Gateway(게이트웨이)

- [Gateway(게이트웨이) 런북](/gateway)
- [구성](/gateway/configuration)

## Gateway(게이트웨이) 서비스 설치 (CLI)

WSL2 내부에서:

```
openclaw onboard --install-daemon
```

또는:

```
openclaw gateway install
```

또는:

```
openclaw configure
```

프롬프트가 나타나면 **Gateway service** 를 선택합니다.

복구/마이그레이션:

```
openclaw doctor
```

## 고급: WSL 서비스를 LAN 에 노출하기 (portproxy)

WSL 은 자체 가상 네트워크를 사용합니다. 다른 머신에서 **WSL 내부에서**
실행 중인 서비스( SSH, 로컬 TTS 서버, 또는 Gateway(게이트웨이) ) 에 접근해야 하는 경우,
Windows 포트를 현재 WSL IP 로 포워딩해야 합니다. WSL IP 는 재시작 후 변경되므로,
포워딩 규칙을 새로 고쳐야 할 수 있습니다.

예시( PowerShell **관리자 권한** ):

```powershell
$Distro = "Ubuntu-24.04"
$ListenPort = 2222
$TargetPort = 22

$WslIp = (wsl -d $Distro -- hostname -I).Trim().Split(" ")[0]
if (-not $WslIp) { throw "WSL IP not found." }

netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$ListenPort `
  connectaddress=$WslIp connectport=$TargetPort
```

Windows 방화벽에서 포트 허용( 1 회 ):

```powershell
New-NetFirewallRule -DisplayName "WSL SSH $ListenPort" -Direction Inbound `
  -Protocol TCP -LocalPort $ListenPort -Action Allow
```

WSL 재시작 후 portproxy 새로 고침:

```powershell
netsh interface portproxy delete v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 | Out-Null
netsh interface portproxy add v4tov4 listenport=$ListenPort listenaddress=0.0.0.0 `
  connectaddress=$WslIp connectport=$TargetPort | Out-Null
```

참고 사항:

- 다른 머신에서의 SSH 는 **Windows 호스트 IP** 를 대상으로 합니다( 예: `ssh user@windows-host -p 2222` ).
- 원격 노드는 **접근 가능한** Gateway(게이트웨이) URL( `127.0.0.1` 아님 ) 을 가리켜야 하며,
  확인을 위해 `openclaw status --all` 를 사용합니다.
- LAN 접근에는 `listenaddress=0.0.0.0` 를 사용하고, `127.0.0.1` 는 로컬 전용으로 유지합니다.
- 이를 자동화하려면, 로그인 시 새로 고침 단계를 실행하도록 예약 작업을 등록하십시오.

## 단계별 WSL2 설치

### 1) WSL2 + Ubuntu 설치

PowerShell( 관리자 ) 열기:

```powershell
wsl --install
# Or pick a distro explicitly:
wsl --list --online
wsl --install -d Ubuntu-24.04
```

Windows 에서 재부팅을 요청하면 재부팅합니다.

### 2) systemd 활성화( Gateway(게이트웨이) 설치에 필요 )

WSL 터미널에서:

```bash
sudo tee /etc/wsl.conf >/dev/null <<'EOF'
[boot]
systemd=true
EOF
```

그다음 PowerShell 에서:

```powershell
wsl --shutdown
```

Ubuntu 를 다시 열고, 다음을 확인합니다:

```bash
systemctl --user status
```

### 3) OpenClaw 설치( WSL 내부 )

WSL 내부에서 Linux 시작하기 흐름을 따르십시오:

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard
```

전체 가이드: [시작하기](/start/getting-started)

## Windows 컴패니언 앱

현재 Windows 컴패니언 앱은 없습니다. 이를 실현하고자 하는 기여는 언제든지 환영합니다.
