---
summary: "VPS-Hosting-Hub fuer OpenClaw (Oracle/Fly/Hetzner/GCP/exe.dev)"
read_when:
  - Sie moechten den Gateway in der Cloud betreiben
  - Sie benoetigen eine schnelle Uebersicht zu VPS-/Hosting-Anleitungen
title: "VPS-Hosting"
x-i18n:
  source_path: vps.md
  source_hash: 38e3e254853e5839
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:50Z
---

# VPS-Hosting

Dieser Hub verlinkt auf die unterstuetzten VPS-/Hosting-Anleitungen und erklaert,
wie Cloud-Bereitstellungen auf hoher Ebene funktionieren.

## Anbieter auswaehlen

- **Railway** (Ein-Klick + Browser-Setup): [Railway](/install/railway)
- **Northflank** (Ein-Klick + Browser-Setup): [Northflank](/install/northflank)
- **Oracle Cloud (Always Free)**: [Oracle](/platforms/oracle) — 0 $/Monat (Always Free, ARM; Kapazitaet/Registrierung kann heikel sein)
- **Fly.io**: [Fly.io](/install/fly)
- **Hetzner (Docker)**: [Hetzner](/install/hetzner)
- **GCP (Compute Engine)**: [GCP](/install/gcp)
- **exe.dev** (VM + HTTPS-Proxy): [exe.dev](/install/exe-dev)
- **AWS (EC2/Lightsail/free tier)**: funktioniert ebenfalls gut. Videoanleitung:
  https://x.com/techfrenAJ/status/2014934471095812547

## Wie Cloud-Setups funktionieren

- Der **Gateway laeuft auf dem VPS** und verwaltet Zustand + Workspace.
- Sie verbinden sich von Laptop/Telefon ueber die **Control UI** oder **Tailscale/SSH**.
- Behandeln Sie den VPS als Quelle der Wahrheit und **sichern** Sie Zustand + Workspace.
- Sichere Voreinstellung: Gateway auf loopback belassen und ueber SSH-Tunnel oder Tailscale Serve zugreifen.
  Wenn Sie an `lan`/`tailnet` binden, verlangen Sie `gateway.auth.token` oder `gateway.auth.password`.

Remote-Zugriff: [Gateway remote](/gateway/remote)  
Plattformen-Hub: [Platforms](/platforms)

## Verwendung von Nodes mit einem VPS

Sie koennen den Gateway in der Cloud belassen und **Nodes** auf Ihren lokalen Geraeten
(Mac/iOS/Android/headless) koppeln. Nodes stellen lokale Bildschirm-/Kamera-/Canvas-
und `system.run`-Funktionen bereit, waehrend der Gateway in der Cloud bleibt.

Doku: [Nodes](/nodes), [Nodes CLI](/cli/nodes)
