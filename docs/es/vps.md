---
summary: "Centro de hosting VPS para OpenClaw (Oracle/Fly/Hetzner/GCP/exe.dev)"
read_when:
  - Desea ejecutar el Gateway en la nube
  - Necesita un mapa rapido de guias de VPS/hosting
title: "Hosting VPS"
x-i18n:
  source_path: vps.md
  source_hash: 38e3e254853e5839
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:14Z
---

# Hosting VPS

Este centro enlaza a las guias compatibles de VPS/hosting y explica a alto nivel
como funcionan los despliegues en la nube.

## Elija un proveedor

- **Railway** (un clic + configuracion en el navegador): [Railway](/install/railway)
- **Northflank** (un clic + configuracion en el navegador): [Northflank](/install/northflank)
- **Oracle Cloud (Always Free)**: [Oracle](/platforms/oracle) — $0/mes (Always Free, ARM; la capacidad/registro puede ser delicada)
- **Fly.io**: [Fly.io](/install/fly)
- **Hetzner (Docker)**: [Hetzner](/install/hetzner)
- **GCP (Compute Engine)**: [GCP](/install/gcp)
- **exe.dev** (VM + proxy HTTPS): [exe.dev](/install/exe-dev)
- **AWS (EC2/Lightsail/free tier)**: tambien funciona bien. Guia en video:
  https://x.com/techfrenAJ/status/2014934471095812547

## Como funcionan las configuraciones en la nube

- El **Gateway se ejecuta en el VPS** y es propietario del estado + espacio de trabajo.
- Usted se conecta desde su laptop/telefono mediante la **UI de Control** o **Tailscale/SSH**.
- Trate el VPS como la fuente de la verdad y **haga copias de seguridad** del estado + espacio de trabajo.
- Seguridad por defecto: mantenga el Gateway en local loopback y acceda mediante un tunel SSH o Tailscale Serve.
  Si enlaza a `lan`/`tailnet`, requiera `gateway.auth.token` o `gateway.auth.password`.

Acceso remoto: [Gateway remote](/gateway/remote)  
Centro de plataformas: [Platforms](/platforms)

## Uso de nodes con un VPS

Puede mantener el Gateway en la nube y emparejar **nodes** en sus dispositivos locales
(Mac/iOS/Android/headless). Los nodes proporcionan pantalla/camara/canvas locales y capacidades de `system.run`
mientras el Gateway permanece en la nube.

Docs: [Nodes](/nodes), [Nodes CLI](/cli/nodes)
