---
summary: "Integración de PeekabooBridge para la automatización de UI en macOS"
read_when:
  - Alojando PeekabooBridge en OpenClaw.app
  - Integrando Peekaboo mediante Swift Package Manager
  - Cambiando el protocolo/rutas de PeekabooBridge
title: "Peekaboo Bridge"
x-i18n:
  source_path: platforms/mac/peekaboo.md
  source_hash: b5b9ddb9a7c59e15
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:30Z
---

# Peekaboo Bridge (automatización de UI en macOS)

OpenClaw puede alojar **PeekabooBridge** como un intermediario local de automatización de UI con reconocimiento de permisos. Esto permite que el CLI `peekaboo` controle la automatización de UI reutilizando los permisos TCC de la app de macOS.

## Qué es (y qué no es)

- **Host**: OpenClaw.app puede actuar como host de PeekabooBridge.
- **Cliente**: use el CLI `peekaboo` (sin una superficie `openclaw ui ...` separada).
- **UI**: las superposiciones visuales permanecen en Peekaboo.app; OpenClaw es un host intermediario ligero.

## Habilitar el bridge

En la app de macOS:

- Settings → **Enable Peekaboo Bridge**

Cuando está habilitado, OpenClaw inicia un servidor de socket UNIX local. Si está deshabilitado, el host se detiene y `peekaboo` recurrirá a otros hosts disponibles.

## Orden de descubrimiento del cliente

Los clientes de Peekaboo normalmente prueban los hosts en este orden:

1. Peekaboo.app (UX completa)
2. Claude.app (si está instalado)
3. OpenClaw.app (intermediario ligero)

Use `peekaboo bridge status --verbose` para ver qué host está activo y qué ruta de socket se está usando. Puede anularlo con:

```bash
export PEEKABOO_BRIDGE_SOCKET=/path/to/bridge.sock
```

## Seguridad y permisos

- El bridge valida **las firmas de código del llamador**; se aplica una lista de permitidos de TeamIDs (TeamID del host de Peekaboo + TeamID de la app OpenClaw).
- Las solicitudes expiran después de ~10 segundos.
- Si faltan permisos requeridos, el bridge devuelve un mensaje de error claro en lugar de abrir System Settings.

## Comportamiento de snapshots (automatización)

Las snapshots se almacenan en memoria y expiran automáticamente después de una ventana corta. Si necesita una retención más prolongada, vuelva a capturar desde el cliente.

## Solución de problemas

- Si `peekaboo` informa “bridge client is not authorized”, asegúrese de que el cliente esté firmado correctamente o ejecute el host con `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1` solo en modo **debug**.
- Si no se encuentran hosts, abra una de las apps host (Peekaboo.app u OpenClaw.app) y confirme que los permisos estén concedidos.
