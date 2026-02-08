---
summary: "Cómo se conectan el Gateway, los nodos y el host de canvas."
read_when:
  - Desea una vista concisa del modelo de red del Gateway
title: "Modelo de red"
x-i18n:
  source_path: gateway/network-model.md
  source_hash: e3508b884757ef19
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:56Z
---

La mayoría de las operaciones fluyen a través del Gateway (`openclaw gateway`), un único
proceso de larga duración que posee las conexiones de canales y el plano de control WebSocket.

## Reglas principales

- Se recomienda un Gateway por host. Es el único proceso autorizado para poseer la sesión de WhatsApp Web. Para bots de rescate o aislamiento estricto, ejecute múltiples gateways con perfiles y puertos aislados. Consulte [Multiple gateways](/gateway/multiple-gateways).
- Primero local loopback: el WS del Gateway usa por defecto `ws://127.0.0.1:18789`. El asistente genera un token del gateway de forma predeterminada, incluso para loopback. Para acceso por tailnet, ejecute `openclaw gateway --bind tailnet --token ...` porque los tokens son obligatorios para enlaces que no sean loopback.
- Los nodos se conectan al WS del Gateway a través de LAN, tailnet o SSH según sea necesario. El puente TCP heredado está obsoleto.
- El host de canvas es un servidor de archivos HTTP en `canvasHost.port` (predeterminado `18793`) que sirve `/__openclaw__/canvas/` para las WebViews de los nodos. Consulte [Gateway configuration](/gateway/configuration) (`canvasHost`).
- El uso remoto suele ser mediante túnel SSH o VPN tailnet. Consulte [Remote access](/gateway/remote) y [Discovery](/gateway/discovery).
