---
summary: "Protocolo de Bridge (nodos heredados): TCP JSONL, emparejamiento, RPC con alcance"
read_when:
  - Creación o depuración de clientes de nodo (modo nodo iOS/Android/macOS)
  - Investigación de fallos de emparejamiento o autenticación del bridge
  - Auditoría de la superficie de nodo expuesta por el gateway
title: "Protocolo de Bridge"
x-i18n:
  source_path: gateway/bridge-protocol.md
  source_hash: 789bcf3cbc6841fc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:51Z
---

# Protocolo de Bridge (transporte de nodo heredado)

El protocolo de Bridge es un transporte de nodo **heredado** (TCP JSONL). Los nuevos clientes de nodo
deben usar el protocolo unificado de Gateway sobre WebSocket en su lugar.

Si está creando un operador o un cliente de nodo, use el
[protocolo de Gateway](/gateway/protocol).

**Nota:** Las compilaciones actuales de OpenClaw ya no incluyen el listener TCP del bridge; este documento se mantiene como referencia histórica.
Las claves de configuración heredadas `bridge.*` ya no forman parte del esquema de configuración.

## Por qué tenemos ambos

- **Límite de seguridad**: el bridge expone una pequeña allowlist en lugar de
  toda la superficie de la API del gateway.
- **Emparejamiento + identidad del nodo**: la admisión de nodos es propiedad del gateway y está vinculada
  a un token por nodo.
- **UX de descubrimiento**: los nodos pueden descubrir gateways vía Bonjour en la LAN, o conectarse
  directamente a través de una tailnet.
- **WS de loopback**: el plano de control WS completo permanece local a menos que se tunelice vía SSH.

## Transporte

- TCP, un objeto JSON por línea (JSONL).
- TLS opcional (cuando `bridge.tls.enabled` es true).
- El puerto de escucha predeterminado heredado era `18790` (las compilaciones actuales no inician un bridge TCP).

Cuando TLS está habilitado, los registros TXT de descubrimiento incluyen `bridgeTls=1` más
`bridgeTlsSha256` para que los nodos puedan fijar el certificado.

## Handshake + emparejamiento

1. El cliente envía `hello` con metadatos del nodo + token (si ya está emparejado).
2. Si no está emparejado, el gateway responde `error` (`NOT_PAIRED`/`UNAUTHORIZED`).
3. El cliente envía `pair-request`.
4. El gateway espera la aprobación y luego envía `pair-ok` y `hello-ok`.

`hello-ok` devuelve `serverName` y puede incluir `canvasHostUrl`.

## Tramas

Cliente → Gateway:

- `req` / `res`: RPC del gateway con alcance (chat, sessions, config, health, voicewake, skills.bins)
- `event`: señales del nodo (transcripción de voz, solicitud del agente, suscripción a chat, ciclo de vida de exec)

Gateway → Cliente:

- `invoke` / `invoke-res`: comandos del nodo (`canvas.*`, `camera.*`, `screen.record`,
  `location.get`, `sms.send`)
- `event`: actualizaciones de chat para sesiones suscritas
- `ping` / `pong`: keepalive

La aplicación de la allowlist heredada residía en `src/gateway/server-bridge.ts` (eliminado).

## Eventos del ciclo de vida de Exec

Los nodos pueden emitir eventos `exec.finished` o `exec.denied` para exponer la actividad de system.run.
Estos se asignan a eventos del sistema en el gateway. (Los nodos heredados aún pueden emitir `exec.started`).

Campos del payload (todos opcionales a menos que se indique lo contrario):

- `sessionKey` (obligatorio): sesión del agente para recibir el evento del sistema.
- `runId`: id único de exec para agrupar.
- `command`: cadena de comando en bruto o formateada.
- `exitCode`, `timedOut`, `success`, `output`: detalles de finalización (solo finalizado).
- `reason`: motivo de denegación (solo denegado).

## Uso de tailnet

- Vincule el bridge a una IP de tailnet: `bridge.bind: "tailnet"` en
  `~/.openclaw/openclaw.json`.
- Los clientes se conectan mediante el nombre MagicDNS o la IP de tailnet.
- Bonjour **no** cruza redes; use host/puerto manual o DNS‑SD de área amplia
  cuando sea necesario.

## Versionado

El Bridge es actualmente **v1 implícito** (sin negociación min/máx). Se espera compatibilidad hacia atrás; agregue un campo de versión del protocolo de bridge antes de cualquier cambio incompatible.
