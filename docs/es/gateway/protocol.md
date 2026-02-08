---
summary: "Protocolo WebSocket del Gateway: handshake, tramas, versionado"
read_when:
  - Implementando o actualizando clientes WS del gateway
  - Depurando desajustes de protocolo o fallas de conexion
  - Regenerando esquemas/modelos del protocolo
title: "Protocolo del Gateway"
x-i18n:
  source_path: gateway/protocol.md
  source_hash: bdafac40d5356590
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:02Z
---

# Protocolo del Gateway (WebSocket)

El protocolo WS del Gateway es el **plano de control unico + transporte de nodos** para
OpenClaw. Todos los clientes (CLI, UI web, app de macOS, nodos iOS/Android, nodos
headless) se conectan por WebSocket y declaran su **rol** + **alcance** en el
momento del handshake.

## Transporte

- WebSocket, tramas de texto con cargas JSON.
- La primera trama **debe** ser una solicitud `connect`.

## Handshake (conexion)

Gateway → Cliente (desafio previo a la conexion):

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": { "nonce": "…", "ts": 1737264000000 }
}
```

Cliente → Gateway:

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "cli",
      "version": "1.2.3",
      "platform": "macos",
      "mode": "operator"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "caps": [],
    "commands": [],
    "permissions": {},
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-cli/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

Gateway → Cliente:

```json
{
  "type": "res",
  "id": "…",
  "ok": true,
  "payload": { "type": "hello-ok", "protocol": 3, "policy": { "tickIntervalMs": 15000 } }
}
```

Cuando se emite un token de dispositivo, `hello-ok` tambien incluye:

```json
{
  "auth": {
    "deviceToken": "…",
    "role": "operator",
    "scopes": ["operator.read", "operator.write"]
  }
}
```

### Ejemplo de nodo

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "ios-node",
      "version": "1.2.3",
      "platform": "ios",
      "mode": "node"
    },
    "role": "node",
    "scopes": [],
    "caps": ["camera", "canvas", "screen", "location", "voice"],
    "commands": ["camera.snap", "canvas.navigate", "screen.record", "location.get"],
    "permissions": { "camera.capture": true, "screen.record": false },
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-ios/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

## Enmarcado

- **Solicitud**: `{type:"req", id, method, params}`
- **Respuesta**: `{type:"res", id, ok, payload|error}`
- **Evento**: `{type:"event", event, payload, seq?, stateVersion?}`

Los metodos con efectos secundarios requieren **claves de idempotencia** (ver esquema).

## Roles + alcances

### Roles

- `operator` = cliente del plano de control (CLI/UI/automatizacion).
- `node` = host de capacidades (camara/pantalla/lienzo/system.run).

### Alcances (operador)

Alcances comunes:

- `operator.read`
- `operator.write`
- `operator.admin`
- `operator.approvals`
- `operator.pairing`

### Capacidades/comandos/permisos (nodo)

Los nodos declaran reclamaciones de capacidad al conectarse:

- `caps`: categorias de capacidades de alto nivel.
- `commands`: lista blanca de comandos para invocacion.
- `permissions`: conmutadores granulares (p. ej., `screen.record`, `camera.capture`).

El Gateway trata estos como **claims** y aplica listas blancas del lado del servidor.

## Presencia

- `system-presence` devuelve entradas indexadas por identidad del dispositivo.
- Las entradas de presencia incluyen `deviceId`, `roles` y `scopes` para que las UI puedan mostrar una sola fila por dispositivo
  incluso cuando se conecta como **operador** y **nodo**.

### Metodos auxiliares del nodo

- Los nodos pueden llamar a `skills.bins` para obtener la lista actual de ejecutables de Skills
  para comprobaciones de auto-permiso.

## Aprobaciones de ejecucion

- Cuando una solicitud de ejecucion necesita aprobacion, el gateway difunde `exec.approval.requested`.
- Los clientes operadores resuelven llamando a `exec.approval.resolve` (requiere el alcance `operator.approvals`).

## Versionado

- `PROTOCOL_VERSION` vive en `src/gateway/protocol/schema.ts`.
- Los clientes envian `minProtocol` + `maxProtocol`; el servidor rechaza desajustes.
- Los esquemas + modelos se generan a partir de definiciones TypeBox:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`
  - `pnpm protocol:check`

## Autenticacion

- Si `OPENCLAW_GATEWAY_TOKEN` (o `--token`) esta configurado, `connect.params.auth.token`
  debe coincidir o el socket se cierra.
- Despues del emparejamiento, el Gateway emite un **token de dispositivo** con alcance al
  rol + alcances de la conexion. Se devuelve en `hello-ok.auth.deviceToken` y debe ser
  persistido por el cliente para futuras conexiones.
- Los tokens de dispositivo pueden rotarse/revocarse mediante `device.token.rotate` y
  `device.token.revoke` (requiere el alcance `operator.pairing`).

## Identidad del dispositivo + emparejamiento

- Los nodos deben incluir una identidad de dispositivo estable (`device.id`) derivada de la
  huella digital de un par de claves.
- Los Gateways emiten tokens por dispositivo + rol.
- Se requieren aprobaciones de emparejamiento para nuevos IDs de dispositivo a menos que
  la autoaprobacion local este habilitada.
- Las conexiones **locales** incluyen loopback y la direccion tailnet propia del host del gateway
  (para que los enlaces tailnet en el mismo host aun puedan autoaprobarse).
- Todos los clientes WS deben incluir la identidad `device` durante `connect` (operador + nodo).
  La UI de control puede omitirla **solo** cuando `gateway.controlUi.allowInsecureAuth` esta habilitado
  (o `gateway.controlUi.dangerouslyDisableDeviceAuth` para uso de emergencia).
- Las conexiones no locales deben firmar el nonce `connect.challenge` proporcionado por el servidor.

## TLS + fijacion

- TLS es compatible con conexiones WS.
- Los clientes pueden opcionalmente fijar la huella digital del certificado del gateway (ver la configuracion `gateway.tls`
  mas `gateway.remote.tlsFingerprint` o el CLI `--tls-fingerprint`).

## Alcance

Este protocolo expone la **API completa del gateway** (estado, canales, modelos, chat,
agente, sesiones, nodos, aprobaciones, etc.). La superficie exacta esta definida por los
esquemas TypeBox en `src/gateway/protocol/schema.ts`.
