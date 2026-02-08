---
summary: "Tong quan ho tro nen tang (Gateway + ung dung dong hanh)"
read_when:
  - Dang tim ho tro he dieu hanh hoac duong dan cai dat
  - Dang quyet dinh noi chay Gateway
title: "Nen tang"
x-i18n:
  source_path: platforms/index.md
  source_hash: 959479995f9ecca3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:07:47Z
---

# Nen tang

OpenClaw core duoc viet bang TypeScript. **Node la runtime duoc khuyen nghi**.
Bun khong duoc khuyen nghi cho Gateway (loi WhatsApp/Telegram).

Ung dung dong hanh ton tai tren macOS (ung dung thanh menu) va cac node di dong (iOS/Android). Windows va
Linux se co ung dung dong hanh trong tuong lai, nhung Gateway da duoc ho tro day du ngay hom nay.
Ung dung dong hanh native cho Windows cung dang duoc len ke hoach; khuyen nghi chay Gateway qua WSL2.

## Chon he dieu hanh

- macOS: [macOS](/platforms/macos)
- iOS: [iOS](/platforms/ios)
- Android: [Android](/platforms/android)
- Windows: [Windows](/platforms/windows)
- Linux: [Linux](/platforms/linux)

## VPS & hosting

- VPS hub: [VPS hosting](/vps)
- Fly.io: [Fly.io](/install/fly)
- Hetzner (Docker): [Hetzner](/install/hetzner)
- GCP (Compute Engine): [GCP](/install/gcp)
- exe.dev (VM + HTTPS proxy): [exe.dev](/install/exe-dev)

## Lien ket pho bien

- Huong dan cai dat: [Bat Dau](/start/getting-started)
- So tay van hanh Gateway: [Gateway](/gateway)
- Cau hinh Gateway: [Configuration](/gateway/configuration)
- Trang thai dich vu: `openclaw gateway status`

## Cai dat dich vu Gateway (CLI)

Su dung mot trong cac cach sau (tat ca deu duoc ho tro):

- Trinh huong dan (khuyen nghi): `openclaw onboard --install-daemon`
- Truc tiep: `openclaw gateway install`
- Cau hinh luong: `openclaw configure` → chon **Gateway service**
- Sua chua/di chuyen: `openclaw doctor` (de xuat cai dat hoac sua dich vu)

Dich vu dich phu thuoc vao he dieu hanh:

- macOS: LaunchAgent (`bot.molt.gateway` hoac `bot.molt.<profile>`; cu `com.openclaw.*`)
- Linux/WSL2: systemd user service (`openclaw-gateway[-<profile>].service`)
