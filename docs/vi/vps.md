---
summary: "Trung tâm hosting VPS cho OpenClaw (Oracle/Fly/Hetzner/GCP/exe.dev)"
read_when:
  - Ban muon chay Gateway tren dam may
  - Ban can ban do nhanh ve cac huong dan VPS/hosting
title: "Hosting VPS"
x-i18n:
  source_path: vps.md
  source_hash: 38e3e254853e5839
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:08:47Z
---

# Hosting VPS

Trung tâm nay lien ket den cac huong dan VPS/hosting duoc ho tro va giai thich cach
cac trien khai dam may hoat dong o muc cao.

## Chon nha cung cap

- **Railway** (one‑click + thiet lap tren trinh duyet): [Railway](/install/railway)
- **Northflank** (one‑click + thiet lap tren trinh duyet): [Northflank](/install/northflank)
- **Oracle Cloud (Always Free)**: [Oracle](/platforms/oracle) — $0/thang (Always Free, ARM; dung luong/dang ky co the hoi kho)
- **Fly.io**: [Fly.io](/install/fly)
- **Hetzner (Docker)**: [Hetzner](/install/hetzner)
- **GCP (Compute Engine)**: [GCP](/install/gcp)
- **exe.dev** (VM + HTTPS proxy): [exe.dev](/install/exe-dev)
- **AWS (EC2/Lightsail/free tier)**: cung hoat dong rat tot. Huong dan video:
  https://x.com/techfrenAJ/status/2014934471095812547

## Cach thiet lap tren dam may hoat dong

- **Gateway chay tren VPS** va quan ly trang thai + workspace.
- Ban ket noi tu laptop/dien thoai qua **Control UI** hoac **Tailscale/SSH**.
- Hay coi VPS la nguon su that va **sao luu** trang thai + workspace.
- Bao mat mac dinh: giu Gateway tren local loopback va truy cap qua SSH tunnel hoac Tailscale Serve.
  Neu ban bind vao `lan`/`tailnet`, hay yeu cau `gateway.auth.token` hoac `gateway.auth.password`.

Truy cap tu xa: [Gateway remote](/gateway/remote)  
Trung tam nen tang: [Platforms](/platforms)

## Su dung nodes voi VPS

Ban co the giu Gateway tren dam may va ghep cap **nodes** tren cac thiet bi cuc bo
(Mac/iOS/Android/headless). Nodes cung cap man hinh/camera/canvas cuc bo va cac kha nang `system.run`
trong khi Gateway van o tren dam may.

Tai lieu: [Nodes](/nodes), [Nodes CLI](/cli/nodes)
