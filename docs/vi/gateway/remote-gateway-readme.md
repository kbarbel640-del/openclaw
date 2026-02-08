---
summary: "Thiet lap duong ham SSH cho OpenClaw.app ket noi toi mot Gateway tu xa"
read_when: "Ket noi ung dung macOS toi mot Gateway tu xa qua SSH"
title: "Thiet Lap Gateway Tu Xa"
x-i18n:
  source_path: gateway/remote-gateway-readme.md
  source_hash: b1ae266a7cb4911b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:20Z
---

# Chay OpenClaw.app voi Gateway Tu Xa

OpenClaw.app su dung duong ham SSH de ket noi toi mot gateway tu xa. Huong dan nay cho ban biet cach thiet lap.

## Tong quan

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Machine                          │
│                                                              │
│  OpenClaw.app ──► ws://127.0.0.1:18789 (local port)           │
│                     │                                        │
│                     ▼                                        │
│  SSH Tunnel ────────────────────────────────────────────────│
│                     │                                        │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                         Remote Machine                        │
│                                                              │
│  Gateway WebSocket ──► ws://127.0.0.1:18789 ──►              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Khoi dong nhanh

### Buoc 1: Them cau hinh SSH

Chinh sua `~/.ssh/config` va them:

```ssh
Host remote-gateway
    HostName <REMOTE_IP>          # e.g., 172.27.187.184
    User <REMOTE_USER>            # e.g., jefferson
    LocalForward 18789 127.0.0.1:18789
    IdentityFile ~/.ssh/id_rsa
```

Thay the `<REMOTE_IP>` va `<REMOTE_USER>` bang gia tri cua ban.

### Buoc 2: Sao chep khoa SSH

Sao chep khoa cong khai cua ban len may tu xa (chi nhap mat khau mot lan):

```bash
ssh-copy-id -i ~/.ssh/id_rsa <REMOTE_USER>@<REMOTE_IP>
```

### Buoc 3: Dat Gateway Token

```bash
launchctl setenv OPENCLAW_GATEWAY_TOKEN "<your-token>"
```

### Buoc 4: Bat duong ham SSH

```bash
ssh -N remote-gateway &
```

### Buoc 5: Khoi dong lai OpenClaw.app

```bash
# Quit OpenClaw.app (⌘Q), then reopen:
open /path/to/OpenClaw.app
```

Ung dung bay gio se ket noi toi Gateway tu xa thong qua duong ham SSH.

---

## Tu dong bat duong ham khi dang nhap

De duong ham SSH tu dong khoi dong khi ban dang nhap, hay tao mot Launch Agent.

### Tao tep PLIST

Luu tep nay thanh `~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>bot.molt.ssh-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-N</string>
        <string>remote-gateway</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

### Tai Launch Agent

```bash
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/bot.molt.ssh-tunnel.plist
```

Duong ham se:

- Tu dong khoi dong khi ban dang nhap
- Tu khoi dong lai neu bi su co
- Tiep tuc chay trong nen

Ghi chu ke thua: xoa bat ky LaunchAgent `com.openclaw.ssh-tunnel` con sot lai neu co.

---

## Xu ly su co

**Kiem tra xem duong ham co dang chay hay khong:**

```bash
ps aux | grep "ssh -N remote-gateway" | grep -v grep
lsof -i :18789
```

**Khoi dong lai duong ham:**

```bash
launchctl kickstart -k gui/$UID/bot.molt.ssh-tunnel
```

**Dung duong ham:**

```bash
launchctl bootout gui/$UID/bot.molt.ssh-tunnel
```

---

## Cach hoat dong

| Thanh phan                           | Chuc nang                                            |
| ------------------------------------ | ---------------------------------------------------- |
| `LocalForward 18789 127.0.0.1:18789` | Chuyen tiep cong local 18789 toi cong tu xa 18789    |
| `ssh -N`                             | SSH khong thuc thi lenh tu xa (chi chuyen tiep cong) |
| `KeepAlive`                          | Tu dong khoi dong lai duong ham neu bi su co         |
| `RunAtLoad`                          | Bat duong ham khi agent duoc tai                     |

OpenClaw.app ket noi toi `ws://127.0.0.1:18789` tren may khach cua ban. Duong ham SSH chuyen tiep ket noi do toi cong 18789 tren may tu xa noi Gateway dang chay.
