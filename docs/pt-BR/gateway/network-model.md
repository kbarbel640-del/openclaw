---
summary: "Como o Gateway, os nos e o host do canvas se conectam."
read_when:
  - Voce quer uma visao concisa do modelo de rede do Gateway
title: "Modelo de rede"
x-i18n:
  source_path: gateway/network-model.md
  source_hash: e3508b884757ef19
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:20Z
---

A maioria das operacoes flui pelo Gateway (`openclaw gateway`), um unico processo de longa duracao
que possui as conexoes de canal e o plano de controle WebSocket.

## Regras principais

- Recomenda-se um Gateway por host. Ele e o unico processo autorizado a possuir a sessao do WhatsApp Web. Para bots de resgate ou isolamento rigoroso, execute varios gateways com perfis e portas isolados. Veja [Varios gateways](/gateway/multiple-gateways).
- Loopback primeiro: o WS do Gateway padrao e `ws://127.0.0.1:18789`. O assistente gera um token de gateway por padrao, mesmo para loopback. Para acesso via tailnet, execute `openclaw gateway --bind tailnet --token ...`, pois tokens sao obrigatorios para binds nao-loopback.
- Os nos se conectam ao WS do Gateway via LAN, tailnet ou SSH conforme necessario. A ponte TCP legada esta obsoleta.
- O host do canvas e um servidor de arquivos HTTP em `canvasHost.port` (padrao `18793`) servindo `/__openclaw__/canvas/` para WebViews dos nos. Veja [Configuracao do Gateway](/gateway/configuration) (`canvasHost`).
- O uso remoto normalmente e via tunel SSH ou VPN de tailnet. Veja [Acesso remoto](/gateway/remote) e [Descoberta](/gateway/discovery).
