---
summary: "Hub de hospedagem VPS para OpenClaw (Oracle/Fly/Hetzner/GCP/exe.dev)"
read_when:
  - Voce quer executar o Gateway na nuvem
  - Voce precisa de um mapa rapido de guias de VPS/hospedagem
title: "Hospedagem VPS"
x-i18n:
  source_path: vps.md
  source_hash: 38e3e254853e5839
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:39Z
---

# Hospedagem VPS

Este hub aponta para os guias de VPS/hospedagem suportados e explica como as
implantacoes em nuvem funcionam em alto nivel.

## Escolha um provedor

- **Railway** (um clique + configuracao no navegador): [Railway](/install/railway)
- **Northflank** (um clique + configuracao no navegador): [Northflank](/install/northflank)
- **Oracle Cloud (Always Free)**: [Oracle](/platforms/oracle) — US$ 0/mes (Always Free, ARM; capacidade/inscricao podem ser instaveis)
- **Fly.io**: [Fly.io](/install/fly)
- **Hetzner (Docker)**: [Hetzner](/install/hetzner)
- **GCP (Compute Engine)**: [GCP](/install/gcp)
- **exe.dev** (VM + proxy HTTPS): [exe.dev](/install/exe-dev)
- **AWS (EC2/Lightsail/free tier)**: tambem funciona bem. Guia em video:
  https://x.com/techfrenAJ/status/2014934471095812547

## Como funcionam as configuracoes em nuvem

- O **Gateway roda no VPS** e controla o estado + workspace.
- Voce se conecta do seu laptop/telefone via **Control UI** ou **Tailscale/SSH**.
- Trate o VPS como a fonte da verdade e **faça backup** do estado + workspace.
- Padrao seguro: mantenha o Gateway em loopback e acesse via tunel SSH ou Tailscale Serve.
  Se voce fizer bind em `lan`/`tailnet`, exija `gateway.auth.token` ou `gateway.auth.password`.

Acesso remoto: [Gateway remote](/gateway/remote)  
Hub de plataformas: [Platforms](/platforms)

## Usando nodes com um VPS

Voce pode manter o Gateway na nuvem e parear **nodes** nos seus dispositivos locais
(Mac/iOS/Android/headless). Nodes fornecem tela/camera/canvas locais e capacidades `system.run`
enquanto o Gateway permanece na nuvem.

Docs: [Nodes](/nodes), [Nodes CLI](/cli/nodes)
