---
summary: "Linux 에서 OpenClaw 브라우저 제어를 위한 Chrome/Brave/Edge/Chromium CDP 시작 문제 해결"
read_when: "Linux 에서 브라우저 제어가 실패할 때, 특히 snap Chromium 사용 시"
title: "브라우저 문제 해결"
x-i18n:
  source_path: tools/browser-linux-troubleshooting.md
  source_hash: bac2301022511a0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:42Z
---

# 브라우저 문제 해결 (Linux)

## 문제: "포트 18800 에서 Chrome CDP 를 시작하지 못했습니다"

OpenClaw 의 브라우저 제어 서버가 다음 오류와 함께 Chrome/Brave/Edge/Chromium 실행에 실패합니다:

```
{"error":"Error: Failed to start Chrome CDP on port 18800 for profile \"openclaw\"."}
```

### 근본 원인

Ubuntu (및 많은 Linux 배포판)에서는 기본 Chromium 설치가 **snap 패키지**입니다. Snap 의 AppArmor 제한이 OpenClaw 가 브라우저 프로세스를 생성하고 모니터링하는 방식과 충돌합니다.

`apt install chromium` 명령은 snap 으로 리디렉션하는 스텁 패키지를 설치합니다:

```
Note, selecting 'chromium-browser' instead of 'chromium'
chromium-browser is already the newest version (2:1snap1-0ubuntu2).
```

이는 실제 브라우저가 아니며, 단순한 래퍼입니다.

### 해결 방법 1: Google Chrome 설치 (권장)

snap 으로 샌드박스 처리되지 않은 공식 Google Chrome `.deb` 패키지를 설치합니다:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt --fix-broken install -y  # if there are dependency errors
```

그런 다음 OpenClaw 설정 (`~/.openclaw/openclaw.json`)을 업데이트합니다:

```json
{
  "browser": {
    "enabled": true,
    "executablePath": "/usr/bin/google-chrome-stable",
    "headless": true,
    "noSandbox": true
  }
}
```

### 해결 방법 2: Snap Chromium 을 Attach-Only 모드로 사용

snap Chromium 을 반드시 사용해야 하는 경우, 수동으로 시작한 브라우저에 연결하도록 OpenClaw 를 구성합니다:

1. 설정 업데이트:

```json
{
  "browser": {
    "enabled": true,
    "attachOnly": true,
    "headless": true,
    "noSandbox": true
  }
}
```

2. Chromium 을 수동으로 시작:

```bash
chromium-browser --headless --no-sandbox --disable-gpu \
  --remote-debugging-port=18800 \
  --user-data-dir=$HOME/.openclaw/browser/openclaw/user-data \
  about:blank &
```

3. 선택 사항으로 Chrome 을 자동 시작하는 systemd 사용자 서비스를 생성:

```ini
# ~/.config/systemd/user/openclaw-browser.service
[Unit]
Description=OpenClaw Browser (Chrome CDP)
After=network.target

[Service]
ExecStart=/snap/bin/chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=18800 --user-data-dir=%h/.openclaw/browser/openclaw/user-data about:blank
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

다음으로 활성화합니다: `systemctl --user enable --now openclaw-browser.service`

### 브라우저 동작 확인

상태 확인:

```bash
curl -s http://127.0.0.1:18791/ | jq '{running, pid, chosenBrowser}'
```

브라우징 테스트:

```bash
curl -s -X POST http://127.0.0.1:18791/start
curl -s http://127.0.0.1:18791/tabs
```

### 설정 참조

| 옵션                     | 설명                                                              | 기본값                                              |
| ------------------------ | ----------------------------------------------------------------- | --------------------------------------------------- |
| `browser.enabled`        | 브라우저 제어 활성화                                              | `true`                                              |
| `browser.executablePath` | Chromium 기반 브라우저 바이너리 경로 (Chrome/Brave/Edge/Chromium) | 자동 감지 (Chromium 기반인 경우 기본 브라우저 선호) |
| `browser.headless`       | GUI 없이 실행                                                     | `false`                                             |
| `browser.noSandbox`      | `--no-sandbox` 플래그 추가 (일부 Linux 설정에 필요)               | `false`                                             |
| `browser.attachOnly`     | 브라우저를 실행하지 않고 기존 인스턴스에만 연결                   | `false`                                             |
| `browser.cdpPort`        | Chrome DevTools Protocol 포트                                     | `18800`                                             |

### 문제: "Chrome 확장 릴레이가 실행 중이지만 연결된 탭이 없습니다"

`chrome` 프로필 (확장 릴레이)을 사용 중입니다. 이 프로필은 OpenClaw
브라우저 확장이 활성 탭에 연결되기를 기대합니다.

해결 방법:

1. **관리형 브라우저 사용:** `openclaw browser start --browser-profile openclaw`
   (또는 `browser.defaultProfile: "openclaw"` 설정).
2. **확장 릴레이 사용:** 확장을 설치하고 탭을 연 다음,
   OpenClaw 확장 아이콘을 클릭하여 연결합니다.

참고:

- `chrome` 프로필은 가능하면 **시스템 기본 Chromium 브라우저**를 사용합니다.
- 로컬 `openclaw` 프로필은 `cdpPort`/`cdpUrl`를 자동 할당합니다; 원격 CDP 에서만 해당 항목을 설정하십시오.
