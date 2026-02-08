---
summary: "Ho tro Linux + trang thai ung dung dong hanh"
read_when:
  - Tim hieu trang thai ung dung dong hanh tren Linux
  - Lap ke hoach pham vi nen tang hoac dong gop
title: "Ung dung Linux"
x-i18n:
  source_path: platforms/linux.md
  source_hash: 93b8250cd1267004
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:49Z
---

# Ung dung Linux

Gateway duoc ho tro day du tren Linux. **Node la runtime duoc khuyen dung**.
Bun khong duoc khuyen dung cho Gateway (loi WhatsApp/Telegram).

Cac ung dung dong hanh Linux native dang duoc len ke hoach. Chung toi hoan nghenh dong gop neu ban muon tham gia xay dung.

## Lo trinh nhanh cho nguoi moi (VPS)

1. Cai dat Node 22+
2. `npm i -g openclaw@latest`
3. `openclaw onboard --install-daemon`
4. Tu laptop cua ban: `ssh -N -L 18789:127.0.0.1:18789 <user>@<host>`
5. Mo `http://127.0.0.1:18789/` va dan token cua ban

Huong dan VPS tung buoc: [exe.dev](/install/exe-dev)

## Cai dat

- [Bat Dau](/start/getting-started)
- [Cai dat & cap nhat](/install/updating)
- Luong tuy chon: [Bun (thu nghiem)](/install/bun), [Nix](/install/nix), [Docker](/install/docker)

## Gateway

- [Gateway runbook](/gateway)
- [Cau hinh](/gateway/configuration)

## Cai dat dich vu Gateway (CLI)

Su dung mot trong nhung lua chon sau:

```
openclaw onboard --install-daemon
```

Hoac:

```
openclaw gateway install
```

Hoac:

```
openclaw configure
```

Chon **Gateway service** khi duoc hoi.

Sua chua/di chuyen:

```
openclaw doctor
```

## Dieu khien he thong (systemd user unit)

OpenClaw mac dinh cai dat mot dich vu systemd **user**. Hay su dung dich vu **system**
cho cac may chu dung chung hoac luon hoat dong. Vi du unit day du va huong dan
nam trong [Gateway runbook](/gateway).

Thiet lap toi thieu:

Tao `~/.config/systemd/user/openclaw-gateway[-<profile>].service`:

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Kich hoat no:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```
