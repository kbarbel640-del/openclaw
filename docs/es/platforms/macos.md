---
summary: "Aplicación complementaria de OpenClaw para macOS (barra de menú + intermediario del Gateway)"
read_when:
  - Implementando funciones de la aplicación macOS
  - Cambiando el ciclo de vida del Gateway o el puenteo de nodos en macOS
title: "Aplicación macOS"
x-i18n:
  source_path: platforms/macos.md
  source_hash: a5b1c02e5905e4cb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:42Z
---

# OpenClaw macOS Companion (barra de menú + intermediario del Gateway)

La aplicación macOS es el **complemento de barra de menú** para OpenClaw. Es responsable de los permisos,
administra/se conecta al Gateway localmente (launchd o manual), y expone las
capacidades de macOS al agente como un nodo.

## Qué hace

- Muestra notificaciones nativas y estado en la barra de menú.
- Gestiona los avisos TCC (Notificaciones, Accesibilidad, Grabación de Pantalla, Micrófono,
  Reconocimiento de Voz, Automatización/AppleScript).
- Ejecuta o se conecta al Gateway (local o remoto).
- Expone herramientas exclusivas de macOS (Canvas, Cámara, Grabación de Pantalla, `system.run`).
- Inicia el servicio local de host de nodos en modo **remoto** (launchd) y lo detiene en modo **local**.
- Opcionalmente aloja **PeekabooBridge** para automatización de UI.
- Instala el CLI global (`openclaw`) vía npm/pnpm bajo demanda (bun no es recomendado para el runtime del Gateway).

## Modo local vs remoto

- **Local** (predeterminado): la aplicación se conecta a un Gateway local en ejecución si existe;
  de lo contrario, habilita el servicio launchd mediante `openclaw gateway install`.
- **Remoto**: la aplicación se conecta a un Gateway vía SSH/Tailscale y nunca inicia
  un proceso local.
  La aplicación inicia el **servicio de host de nodos** local para que el Gateway remoto pueda acceder a este Mac.
  La aplicación no ejecuta el Gateway como proceso hijo.

## Control con Launchd

La aplicación administra un LaunchAgent por usuario con la etiqueta `bot.molt.gateway`
(o `bot.molt.<profile>` cuando se usa `--profile`/`OPENCLAW_PROFILE`; el legado `com.openclaw.*` aún se descarga).

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

Reemplace la etiqueta con `bot.molt.<profile>` al ejecutar un perfil con nombre.

Si el LaunchAgent no está instalado, habilítelo desde la aplicación o ejecute
`openclaw gateway install`.

## Capacidades del nodo (mac)

La aplicación macOS se presenta como un nodo. Comandos comunes:

- Canvas: `canvas.present`, `canvas.navigate`, `canvas.eval`, `canvas.snapshot`, `canvas.a2ui.*`
- Cámara: `camera.snap`, `camera.clip`
- Pantalla: `screen.record`
- Sistema: `system.run`, `system.notify`

El nodo informa un mapa `permissions` para que los agentes puedan decidir qué está permitido.

Servicio de nodo + IPC de la aplicación:

- Cuando el servicio de host de nodos sin interfaz está en ejecución (modo remoto), se conecta al WS del Gateway como un nodo.
- `system.run` se ejecuta en la aplicación macOS (contexto UI/TCC) a través de un socket Unix local; los avisos y la salida permanecen dentro de la aplicación.

Diagrama (SCI):

```
Gateway -> Node Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             Mac App (UI + TCC + system.run)
```

## Aprobaciones de ejecución (system.run)

`system.run` se controla mediante **Aprobaciones de ejecución** en la aplicación macOS (Configuración → Aprobaciones de ejecución).
La seguridad + solicitud + lista de permitidos se almacenan localmente en el Mac en:

```
~/.openclaw/exec-approvals.json
```

Ejemplo:

```json
{
  "version": 1,
  "defaults": {
    "security": "deny",
    "ask": "on-miss"
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [{ "pattern": "/opt/homebrew/bin/rg" }]
    }
  }
}
```

Notas:

- Las entradas `allowlist` son patrones glob para rutas de binarios resueltas.
- Elegir “Permitir siempre” en el aviso agrega ese comando a la lista de permitidos.
- Las anulaciones de entorno `system.run` se filtran (elimina `PATH`, `DYLD_*`, `LD_*`, `NODE_OPTIONS`, `PYTHON*`, `PERL*`, `RUBYOPT`) y luego se fusionan con el entorno de la aplicación.

## Enlaces profundos

La aplicación registra el esquema de URL `openclaw://` para acciones locales.

### `openclaw://agent`

Dispara una solicitud `agent` del Gateway.

```bash
open 'openclaw://agent?message=Hello%20from%20deep%20link'
```

Parámetros de consulta:

- `message` (requerido)
- `sessionKey` (opcional)
- `thinking` (opcional)
- `deliver` / `to` / `channel` (opcional)
- `timeoutSeconds` (opcional)
- `key` (clave opcional de modo no supervisado)

Seguridad:

- Sin `key`, la aplicación solicita confirmación.
- Con un `key` válido, la ejecución es no supervisada (pensada para automatizaciones personales).

## Flujo de incorporación (típico)

1. Instale y ejecute **OpenClaw.app**.
2. Complete la lista de verificación de permisos (avisos TCC).
3. Asegúrese de que el modo **Local** esté activo y que el Gateway esté en ejecución.
4. Instale el CLI si desea acceso desde la terminal.

## Flujo de compilación y desarrollo (nativo)

- `cd apps/macos && swift build`
- `swift run OpenClaw` (o Xcode)
- Empaquetar la aplicación: `scripts/package-mac-app.sh`

## Depurar conectividad del Gateway (CLI de macOS)

Use el CLI de depuración para ejercitar el mismo protocolo de enlace WebSocket del Gateway y la lógica de descubrimiento
que utiliza la aplicación macOS, sin iniciar la aplicación.

```bash
cd apps/macos
swift run openclaw-mac connect --json
swift run openclaw-mac discover --timeout 3000 --json
```

Opciones de conexión:

- `--url <ws://host:port>`: sobrescribir configuración
- `--mode <local|remote>`: resolver desde la configuración (predeterminado: configuración o local)
- `--probe`: forzar una nueva sonda de estado
- `--timeout <ms>`: tiempo de espera de solicitud (predeterminado: `15000`)
- `--json`: salida estructurada para comparación

Opciones de descubrimiento:

- `--include-local`: incluir gateways que serían filtrados como “locales”
- `--timeout <ms>`: ventana general de descubrimiento (predeterminado: `2000`)
- `--json`: salida estructurada para comparación

Consejo: compare con `openclaw gateway discover --json` para ver si la
canalización de descubrimiento de la aplicación macOS (NWBrowser + respaldo DNS‑SD de tailnet) difiere del descubrimiento basado en `dns-sd` del CLI de Node.

## Infraestructura de conexión remota (túneles SSH)

Cuando la aplicación macOS se ejecuta en modo **Remoto**, abre un túnel SSH para que los componentes locales de UI
puedan comunicarse con un Gateway remoto como si estuviera en localhost.

### Túnel de control (puerto WebSocket del Gateway)

- **Propósito:** verificaciones de estado, estado, Web Chat, configuración y otras llamadas del plano de control.
- **Puerto local:** el puerto del Gateway (predeterminado `18789`), siempre estable.
- **Puerto remoto:** el mismo puerto del Gateway en el host remoto.
- **Comportamiento:** no hay puerto local aleatorio; la aplicación reutiliza un túnel existente y saludable
  o lo reinicia si es necesario.
- **Forma SSH:** `ssh -N -L <local>:127.0.0.1:<remote>` con BatchMode +
  ExitOnForwardFailure + opciones de keepalive.
- **Reporte de IP:** el túnel SSH usa loopback, por lo que el gateway verá la IP del nodo como `127.0.0.1`. Use el transporte **Direct (ws/wss)** si desea que aparezca la IP real del cliente (consulte [acceso remoto macOS](/platforms/mac/remote)).

Para los pasos de configuración, consulte [acceso remoto macOS](/platforms/mac/remote). Para detalles del protocolo, consulte [protocolo del Gateway](/gateway/protocol).

## Documentos relacionados

- [Runbook del Gateway](/gateway)
- [Gateway (macOS)](/platforms/mac/bundled-gateway)
- [Permisos de macOS](/platforms/mac/permissions)
- [Canvas](/platforms/mac/canvas)
