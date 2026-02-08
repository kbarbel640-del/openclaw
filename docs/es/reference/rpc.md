---
summary: "Adaptadores RPC para CLIs externos (signal-cli, imsg heredado) y patrones de gateway"
read_when:
  - Agregar o cambiar integraciones de CLI externas
  - Depurar adaptadores RPC (signal-cli, imsg)
title: "Adaptadores RPC"
x-i18n:
  source_path: reference/rpc.md
  source_hash: 06dc6b97184cc704
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:46Z
---

# Adaptadores RPC

OpenClaw integra CLIs externos mediante JSON-RPC. Hoy se utilizan dos patrones.

## Patrón A: daemon HTTP (signal-cli)

- `signal-cli` se ejecuta como un daemon con JSON-RPC sobre HTTP.
- El flujo de eventos es SSE (`/api/v1/events`).
- Sonda de estado: `/api/v1/check`.
- OpenClaw es propietario del ciclo de vida cuando `channels.signal.autoStart=true`.

Consulte [Signal](/channels/signal) para la configuración y los endpoints.

## Patrón B: proceso hijo por stdio (legado: imsg)

> **Nota:** Para nuevas configuraciones de iMessage, utilice [BlueBubbles](/channels/bluebubbles) en su lugar.

- OpenClaw inicia `imsg rpc` como un proceso hijo (integración heredada de iMessage).
- JSON-RPC está delimitado por líneas sobre stdin/stdout (un objeto JSON por línea).
- Sin puerto TCP; no se requiere daemon.

Métodos principales utilizados:

- `watch.subscribe` → notificaciones (`method: "message"`)
- `watch.unsubscribe`
- `send`
- `chats.list` (sondeo/diagnósticos)

Consulte [iMessage](/channels/imessage) para la configuración heredada y el direccionamiento (`chat_id` preferido).

## Directrices del adaptador

- El Gateway es propietario del proceso (inicio/detención vinculados al ciclo de vida del proveedor).
- Mantenga los clientes RPC resilientes: tiempos de espera, reinicio al salir.
- Prefiera IDs estables (p. ej., `chat_id`) sobre cadenas de visualización.
