---
summary: "Referencia del CLI para `openclaw node` (host de nodo sin interfaz)"
read_when:
  - Ejecutar el host de nodo sin interfaz
  - Emparejar un nodo que no sea macOS para system.run
title: "node"
x-i18n:
  source_path: cli/node.md
  source_hash: a8b1a57712663e22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:19Z
---

# `openclaw node`

Ejecute un **host de nodo sin interfaz** que se conecta al WebSocket del Gateway y expone
`system.run` / `system.which` en esta máquina.

## ¿Por qué usar un host de nodo?

Use un host de nodo cuando quiera que los agentes **ejecuten comandos en otras máquinas** de su
red sin instalar una aplicación complementaria completa de macOS allí.

Casos de uso comunes:

- Ejecutar comandos en equipos Linux/Windows remotos (servidores de compilación, máquinas de laboratorio, NAS).
- Mantener la ejecución **en sandbox** en el gateway, pero delegar ejecuciones aprobadas a otros hosts.
- Proporcionar un objetivo de ejecución ligero y sin interfaz para automatización o nodos de CI.

La ejecución sigue protegida por **aprobaciones de exec** y listas de permitidos por agente en el
host de nodo, para que pueda mantener el acceso a comandos acotado y explícito.

## Proxy de navegador (cero configuración)

Los hosts de nodo anuncian automáticamente un proxy de navegador si `browser.enabled` no está
deshabilitado en el nodo. Esto permite que el agente use automatización del navegador en ese nodo
sin configuración adicional.

Desactívelo en el nodo si es necesario:

```json5
{
  nodeHost: {
    browserProxy: {
      enabled: false,
    },
  },
}
```

## Ejecutar (primer plano)

```bash
openclaw node run --host <gateway-host> --port 18789
```

Opciones:

- `--host <host>`: Host del WebSocket del Gateway (predeterminado: `127.0.0.1`)
- `--port <port>`: Puerto del WebSocket del Gateway (predeterminado: `18789`)
- `--tls`: Usar TLS para la conexión al gateway
- `--tls-fingerprint <sha256>`: Huella digital esperada del certificado TLS (sha256)
- `--node-id <id>`: Sobrescribir el id del nodo (borra el token de emparejamiento)
- `--display-name <name>`: Sobrescribir el nombre para mostrar del nodo

## Servicio (segundo plano)

Instale un host de nodo sin interfaz como servicio de usuario.

```bash
openclaw node install --host <gateway-host> --port 18789
```

Opciones:

- `--host <host>`: Host del WebSocket del Gateway (predeterminado: `127.0.0.1`)
- `--port <port>`: Puerto del WebSocket del Gateway (predeterminado: `18789`)
- `--tls`: Usar TLS para la conexión al gateway
- `--tls-fingerprint <sha256>`: Huella digital esperada del certificado TLS (sha256)
- `--node-id <id>`: Sobrescribir el id del nodo (borra el token de emparejamiento)
- `--display-name <name>`: Sobrescribir el nombre para mostrar del nodo
- `--runtime <runtime>`: Entorno de ejecución del servicio (`node` o `bun`)
- `--force`: Reinstalar/sobrescribir si ya está instalado

Administrar el servicio:

```bash
openclaw node status
openclaw node stop
openclaw node restart
openclaw node uninstall
```

Use `openclaw node run` para un host de nodo en primer plano (sin servicio).

Los comandos del servicio aceptan `--json` para salida legible por máquina.

## Emparejamiento

La primera conexión crea una solicitud de emparejamiento de nodo pendiente en el Gateway.
Apruébela mediante:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

El host de nodo almacena su id de nodo, token, nombre para mostrar y la información de conexión al gateway en
`~/.openclaw/node.json`.

## Aprobaciones de exec

`system.run` está controlado por aprobaciones locales de exec:

- `~/.openclaw/exec-approvals.json`
- [Aprobaciones de exec](/tools/exec-approvals)
- `openclaw approvals --node <id|name|ip>` (editar desde el Gateway)
