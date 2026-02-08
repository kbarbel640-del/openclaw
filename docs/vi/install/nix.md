---
summary: "Cai dat OpenClaw theo kieu khai bao voi Nix"
read_when:
  - Ban muon cai dat co the tai lap va hoan tac
  - Ban da dung Nix/NixOS/Home Manager
  - Ban muon moi thu duoc gan phien ban va quan ly theo kieu khai bao
title: "Nix"
x-i18n:
  source_path: install/nix.md
  source_hash: f1452194cfdd7461
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:39Z
---

# Cai dat Nix

Cach duoc khuyen nghi de chay OpenClaw voi Nix la thong qua **[nix-openclaw](https://github.com/openclaw/nix-openclaw)** — mot module Home Manager day du pin.

## Khoi Dong Nhanh

Dan doan nay vao tac tu AI cua ban (Claude, Cursor, v.v.):

```text
I want to set up nix-openclaw on my Mac.
Repository: github:openclaw/nix-openclaw

What I need you to do:
1. Check if Determinate Nix is installed (if not, install it)
2. Create a local flake at ~/code/openclaw-local using templates/agent-first/flake.nix
3. Help me create a Telegram bot (@BotFather) and get my chat ID (@userinfobot)
4. Set up secrets (bot token, Anthropic key) - plain files at ~/.secrets/ is fine
5. Fill in the template placeholders and run home-manager switch
6. Verify: launchd running, bot responds to messages

Reference the nix-openclaw README for module options.
```

> **📦 Huong dan day du: [github.com/openclaw/nix-openclaw](https://github.com/openclaw/nix-openclaw)**
>
> Repo nix-openclaw la nguon chinh xac nhat cho viec cai dat Nix. Trang nay chi la tong quan nhanh.

## Ban nhan duoc gi

- Gateway + ung dung macOS + cong cu (whisper, spotify, cameras) — tat ca deu duoc gan phien ban
- Dich vu Launchd ton tai qua cac lan khoi dong lai
- He thong plugin voi cau hinh khai bao
- Hoan tac tuc thi: `home-manager switch --rollback`

---

## Hanh vi thoi gian chay trong che do Nix

Khi `OPENCLAW_NIX_MODE=1` duoc thiet lap (tu dong voi nix-openclaw):

OpenClaw ho tro **che do Nix** giup cau hinh xac dinh va tat cac luong tu dong cai dat.
Bat che do nay bang cach xuat:

```bash
OPENCLAW_NIX_MODE=1
```

Tren macOS, ung dung GUI khong tu dong ke thua bien moi truong cua shell. Ban cung
co the bat che do Nix thong qua defaults:

```bash
defaults write bot.molt.mac openclaw.nixMode -bool true
```

### Duong dan cau hinh + trang thai

OpenClaw doc cau hinh JSON5 tu `OPENCLAW_CONFIG_PATH` va luu du lieu co the thay doi trong `OPENCLAW_STATE_DIR`.

- `OPENCLAW_STATE_DIR` (mac dinh: `~/.openclaw`)
- `OPENCLAW_CONFIG_PATH` (mac dinh: `$OPENCLAW_STATE_DIR/openclaw.json`)

Khi chay duoi Nix, hay thiet lap ro rang cac gia tri nay toi cac vi tri do Nix quan ly de trang thai thoi gian chay va cau hinh
khong nam trong kho bat bien.

### Hanh vi thoi gian chay trong che do Nix

- Tat cac luong tu dong cai dat va tu bien doi
- Phu thuoc thieu se hien thi thong bao khac phuc rieng cho Nix
- UI hien thi bang thong bao che do Nix chi doc khi co

## Ghi chu dong goi (macOS)

Quy trinh dong goi macOS mong doi mot mau Info.plist on dinh tai:

```
apps/macos/Sources/OpenClaw/Resources/Info.plist
```

[`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) sao chep mau nay vao goi ung dung va vá cac truong dong
(bundle ID, phien ban/build, Git SHA, khoa Sparkle). Dieu nay giu plist co tinh xac dinh cho
dong goi SwiftPM va cac ban dung Nix (khong phu thuoc vao bo cong cu Xcode day du).

## Lien quan

- [nix-openclaw](https://github.com/openclaw/nix-openclaw) — huong dan thiet lap day du
- [Wizard](/start/wizard) — thiet lap CLI khong dung Nix
- [Docker](/install/docker) — thiet lap dang container
