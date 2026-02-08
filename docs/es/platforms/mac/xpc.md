---
summary: "Arquitectura IPC de macOS para la app OpenClaw, el transporte de nodos del Gateway y PeekabooBridge"
read_when:
  - Edicion de contratos IPC o IPC de la app de la barra de menu
title: "IPC de macOS"
x-i18n:
  source_path: platforms/mac/xpc.md
  source_hash: d0211c334a4a59b7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:34Z
---

# Arquitectura IPC de OpenClaw en macOS

**Modelo actual:** un socket Unix local conecta el **servicio host del nodo** con la **app de macOS** para aprobaciones de exec + `system.run`. Existe una CLI de depuracion `openclaw-mac` para verificaciones de descubrimiento/conexion; las acciones del agente aun fluyen a traves del WebSocket del Gateway y `node.invoke`. La automatizacion de la UI usa PeekabooBridge.

## Objetivos

- Una unica instancia de la app GUI que sea propietaria de todo el trabajo de cara a TCC (notificaciones, grabacion de pantalla, microfono, voz, AppleScript).
- Una superficie pequena para la automatizacion: Gateway + comandos del nodo, mas PeekabooBridge para automatizacion de la UI.
- Permisos predecibles: siempre el mismo ID de bundle firmado, lanzado por launchd, para que las concesiones de TCC persistan.

## Como funciona

### Gateway + transporte del nodo

- La app ejecuta el Gateway (modo local) y se conecta a el como un nodo.
- Las acciones del agente se realizan via `node.invoke` (p. ej., `system.run`, `system.notify`, `canvas.*`).

### Servicio del nodo + IPC de la app

- Un servicio host de nodo sin interfaz se conecta al WebSocket del Gateway.
- Las solicitudes `system.run` se reenvian a la app de macOS a traves de un socket Unix local.
- La app realiza el exec en el contexto de la UI, solicita confirmacion si es necesario y devuelve la salida.

Diagrama (SCI):

```
Agent -> Gateway -> Node Service (WS)
                      |  IPC (UDS + token + HMAC + TTL)
                      v
                  Mac App (UI + TCC + system.run)
```

### PeekabooBridge (automatizacion de la UI)

- La automatizacion de la UI usa un socket UNIX separado llamado `bridge.sock` y el protocolo JSON de PeekabooBridge.
- Orden de preferencia de host (lado del cliente): Peekaboo.app → Claude.app → OpenClaw.app → ejecucion local.
- Seguridad: los hosts del bridge requieren un TeamID permitido; el mecanismo de escape DEBUG-only con el mismo UID esta protegido por `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1` (convencion de Peekaboo).
- Ver: [Uso de PeekabooBridge](/platforms/mac/peekaboo) para mas detalles.

## Flujos operativos

- Reiniciar/reconstruir: `SIGN_IDENTITY="Apple Development: <Developer Name> (<TEAMID>)" scripts/restart-mac.sh`
  - Finaliza instancias existentes
  - Compilacion Swift + empaquetado
  - Escribe/arranca/kickstart el LaunchAgent
- Instancia unica: la app sale de forma temprana si otra instancia con el mismo ID de bundle esta en ejecucion.

## Notas de endurecimiento

- Prefiera exigir coincidencia de TeamID para todas las superficies privilegiadas.
- PeekabooBridge: `PEEKABOO_ALLOW_UNSIGNED_SOCKET_CLIENTS=1` (solo DEBUG) puede permitir llamadores con el mismo UID para desarrollo local.
- Toda la comunicacion permanece solo local; no se exponen sockets de red.
- Las solicitudes de TCC se originan unicamente desde el bundle de la app GUI; mantenga estable el ID de bundle firmado a traves de reconstrucciones.
- Endurecimiento de IPC: modo de socket `0600`, token, verificaciones de UID del par, desafio/respuesta HMAC, TTL corto.
