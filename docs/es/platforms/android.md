---
summary: "Aplicación Android (nodo): runbook de conexión + Canvas/Chat/Cámara"
read_when:
  - Emparejar o reconectar el nodo Android
  - Depurar el descubrimiento o la autenticación del Gateway en Android
  - Verificar la paridad del historial de chat entre clientes
title: "Aplicación Android"
x-i18n:
  source_path: platforms/android.md
  source_hash: 9cd02f12065ce2bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:26Z
---

# Aplicación Android (Nodo)

## Instantánea de soporte

- Rol: aplicación de nodo complementario (Android no aloja el Gateway).
- Gateway requerido: sí (ejecútelo en macOS, Linux o Windows vía WSL2).
- Instalación: [Primeros Pasos](/start/getting-started) + [Emparejamiento](/gateway/pairing).
- Gateway: [Runbook](/gateway) + [Configuración](/gateway/configuration).
  - Protocolos: [Protocolo del Gateway](/gateway/protocol) (nodos + plano de control).

## Control del sistema

El control del sistema (launchd/systemd) vive en el host del Gateway. Vea [Gateway](/gateway).

## Runbook de conexión

Aplicación de nodo Android ⇄ (mDNS/NSD + WebSocket) ⇄ **Gateway**

Android se conecta directamente al WebSocket del Gateway (predeterminado `ws://<host>:18789`) y utiliza el emparejamiento propiedad del Gateway.

### Prerrequisitos

- Puede ejecutar el Gateway en la máquina “maestra”.
- El dispositivo/emulador Android puede alcanzar el WebSocket del gateway:
  - Misma LAN con mDNS/NSD, **o**
  - Mismo tailnet de Tailscale usando Wide-Area Bonjour / DNS-SD unicast (ver abajo), **o**
  - Host/puerto del gateway manual (alternativa)
- Puede ejecutar la CLI (`openclaw`) en la máquina del gateway (o vía SSH).

### 1) Iniciar el Gateway

```bash
openclaw gateway --port 18789 --verbose
```

Confirme en los registros que ve algo como:

- `listening on ws://0.0.0.0:18789`

Para configuraciones solo de tailnet (recomendado para Viena ⇄ Londres), vincule el gateway a la IP del tailnet:

- Establezca `gateway.bind: "tailnet"` en `~/.openclaw/openclaw.json` en el host del gateway.
- Reinicie el Gateway / la app de la barra de menús de macOS.

### 2) Verificar el descubrimiento (opcional)

Desde la máquina del gateway:

```bash
dns-sd -B _openclaw-gw._tcp local.
```

Más notas de depuración: [Bonjour](/gateway/bonjour).

#### Descubrimiento en tailnet (Viena ⇄ Londres) vía DNS-SD unicast

El descubrimiento NSD/mDNS de Android no cruza redes. Si su nodo Android y el gateway están en redes diferentes pero conectados vía Tailscale, use Wide-Area Bonjour / DNS-SD unicast en su lugar:

1. Configure una zona DNS-SD (ejemplo `openclaw.internal.`) en el host del gateway y publique registros `_openclaw-gw._tcp`.
2. Configure split DNS de Tailscale para su dominio elegido apuntando a ese servidor DNS.

Detalles y ejemplo de configuración de CoreDNS: [Bonjour](/gateway/bonjour).

### 3) Conectar desde Android

En la app de Android:

- La app mantiene viva su conexión al gateway mediante un **servicio en primer plano** (notificación persistente).
- Abra **Settings**.
- En **Discovered Gateways**, seleccione su gateway y toque **Connect**.
- Si mDNS está bloqueado, use **Advanced → Manual Gateway** (host + puerto) y **Connect (Manual)**.

Después del primer emparejamiento exitoso, Android se reconecta automáticamente al iniciar:

- Endpoint manual (si está habilitado); de lo contrario,
- El último gateway descubierto (mejor esfuerzo).

### 4) Aprobar el emparejamiento (CLI)

En la máquina del gateway:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

Detalles de emparejamiento: [Emparejamiento del Gateway](/gateway/pairing).

### 5) Verificar que el nodo esté conectado

- Vía estado de nodos:
  ```bash
  openclaw nodes status
  ```
- Vía Gateway:
  ```bash
  openclaw gateway call node.list --params "{}"
  ```

### 6) Chat + historial

La hoja de Chat del nodo Android usa la **clave de sesión primaria** del gateway (`main`), por lo que el historial y las respuestas se comparten con WebChat y otros clientes:

- Historial: `chat.history`
- Enviar: `chat.send`
- Actualizaciones push (mejor esfuerzo): `chat.subscribe` → `event:"chat"`

### 7) Canvas + cámara

#### Host de Canvas del Gateway (recomendado para contenido web)

Si desea que el nodo muestre HTML/CSS/JS real que el agente pueda editar en disco, apunte el nodo al host de canvas del Gateway.

Nota: los nodos usan el host de canvas independiente en `canvasHost.port` (predeterminado `18793`).

1. Cree `~/.openclaw/workspace/canvas/index.html` en el host del gateway.

2. Navegue el nodo hacia él (LAN):

```bash
openclaw nodes invoke --node "<Android Node>" --command canvas.navigate --params '{"url":"http://<gateway-hostname>.local:18793/__openclaw__/canvas/"}'
```

Tailnet (opcional): si ambos dispositivos están en Tailscale, use un nombre MagicDNS o una IP del tailnet en lugar de `.local`, por ejemplo `http://<gateway-magicdns>:18793/__openclaw__/canvas/`.

Este servidor inyecta un cliente de recarga en vivo en HTML y recarga ante cambios de archivos.
El host A2UI vive en `http://<gateway-host>:18793/__openclaw__/a2ui/`.

Comandos de Canvas (solo en primer plano):

- `canvas.eval`, `canvas.snapshot`, `canvas.navigate` (use `{"url":""}` o `{"url":"/"}` para volver al andamiaje predeterminado). `canvas.snapshot` devuelve `{ format, base64 }` (predeterminado `format="jpeg"`).
- A2UI: `canvas.a2ui.push`, `canvas.a2ui.reset` (`canvas.a2ui.pushJSONL` alias heredado)

Comandos de cámara (solo en primer plano; con permisos):

- `camera.snap` (jpg)
- `camera.clip` (mp4)

Vea [Nodo de cámara](/nodes/camera) para parámetros y ayudas de la CLI.
