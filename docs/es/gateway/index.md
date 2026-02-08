---
summary: "Manual operativo del servicio Gateway, su ciclo de vida y operaciones"
read_when:
  - Al ejecutar o depurar el proceso del gateway
title: "Manual operativo del Gateway"
x-i18n:
  source_path: gateway/index.md
  source_hash: 497d58090faaa6bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:22Z
---

# Manual operativo del servicio Gateway

Última actualización: 2025-12-09

## Qué es

- El proceso siempre activo que posee la única conexión Baileys/Telegram y el plano de control/eventos.
- Reemplaza el comando heredado `gateway`. Punto de entrada del CLI: `openclaw gateway`.
- Se ejecuta hasta que se detiene; sale con código distinto de cero ante errores fatales para que el supervisor lo reinicie.

## Cómo ejecutar (local)

```bash
openclaw gateway --port 18789
# for full debug/trace logs in stdio:
openclaw gateway --port 18789 --verbose
# if the port is busy, terminate listeners then start:
openclaw gateway --force
# dev loop (auto-reload on TS changes):
pnpm gateway:watch
```

- La recarga en caliente de la configuración observa `~/.openclaw/openclaw.json` (o `OPENCLAW_CONFIG_PATH`).
  - Modo predeterminado: `gateway.reload.mode="hybrid"` (aplica en caliente cambios seguros, reinicia en críticos).
  - La recarga en caliente usa reinicio en proceso vía **SIGUSR1** cuando es necesario.
  - Deshabilitar con `gateway.reload.mode="off"`.
- Vincula el plano de control WebSocket a `127.0.0.1:<port>` (predeterminado 18789).
- El mismo puerto también sirve HTTP (UI de control, hooks, A2UI). Multiplexación de un solo puerto.
  - OpenAI Chat Completions (HTTP): [`/v1/chat/completions`](/gateway/openai-http-api).
  - OpenResponses (HTTP): [`/v1/responses`](/gateway/openresponses-http-api).
  - Tools Invoke (HTTP): [`/tools/invoke`](/gateway/tools-invoke-http-api).
- Inicia un servidor de archivos Canvas por defecto en `canvasHost.port` (predeterminado `18793`), sirviendo `http://<gateway-host>:18793/__openclaw__/canvas/` desde `~/.openclaw/workspace/canvas`. Deshabilitar con `canvasHost.enabled=false` o `OPENCLAW_SKIP_CANVAS_HOST=1`.
- Registra a stdout; use launchd/systemd para mantenerlo activo y rotar logs.
- Pase `--verbose` para reflejar el registro de depuración (handshakes, req/res, eventos) del archivo de logs a stdio durante la solucion de problemas.
- `--force` usa `lsof` para encontrar oyentes en el puerto elegido, envía SIGTERM, registra lo que finalizó y luego inicia el gateway (falla rápido si falta `lsof`).
- Si se ejecuta bajo un supervisor (launchd/systemd/modo proceso-hijo de app mac), un detener/reiniciar normalmente envía **SIGTERM**; compilaciones antiguas pueden mostrarlo como `pnpm` `ELIFECYCLE` con código de salida **143** (SIGTERM), lo cual es un apagado normal, no un fallo.
- **SIGUSR1** activa un reinicio en proceso cuando está autorizado (aplicar herramienta/configuración/actualización del gateway, o habilitar `commands.restart` para reinicios manuales).
- La autenticación del Gateway es requerida por defecto: configure `gateway.auth.token` (o `OPENCLAW_GATEWAY_TOKEN`) o `gateway.auth.password`. Los clientes deben enviar `connect.params.auth.token/password` salvo que usen la identidad de Tailscale Serve.
- El asistente ahora genera un token por defecto, incluso en loopback.
- Precedencia de puertos: `--port` > `OPENCLAW_GATEWAY_PORT` > `gateway.port` > predeterminado `18789`.

## Acceso remoto

- Se prefiere Tailscale/VPN; de lo contrario, túnel SSH:
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- Luego los clientes se conectan a `ws://127.0.0.1:18789` a través del túnel.
- Si hay un token configurado, los clientes deben incluirlo en `connect.params.auth.token` incluso sobre el túnel.

## Múltiples gateways (mismo host)

Por lo general es innecesario: un Gateway puede servir múltiples canales de mensajería y agentes. Use múltiples Gateways solo para redundancia o aislamiento estricto (ej.: bot de rescate).

Es compatible si aísla estado + configuración y usa puertos únicos. Guía completa: [Multiple gateways](/gateway/multiple-gateways).

Los nombres de servicio reconocen perfiles:

- macOS: `bot.molt.<profile>` (el heredado `com.openclaw.*` aún puede existir)
- Linux: `openclaw-gateway-<profile>.service`
- Windows: `OpenClaw Gateway (<profile>)`

Los metadatos de instalación están integrados en la configuración del servicio:

- `OPENCLAW_SERVICE_MARKER=openclaw`
- `OPENCLAW_SERVICE_KIND=gateway`
- `OPENCLAW_SERVICE_VERSION=<version>`

Patrón de Bot de Rescate: mantenga un segundo Gateway aislado con su propio perfil, directorio de estado, workspace y espaciado de puertos base. Guía completa: [Rescue-bot guide](/gateway/multiple-gateways#rescue-bot-guide).

### Perfil de desarrollo (`--dev`)

Ruta rápida: ejecute una instancia de desarrollo totalmente aislada (configuración/estado/workspace) sin tocar su configuración principal.

```bash
openclaw --dev setup
openclaw --dev gateway --allow-unconfigured
# then target the dev instance:
openclaw --dev status
openclaw --dev health
```

Valores predeterminados (se pueden sobrescribir vía env/flags/config):

- `OPENCLAW_STATE_DIR=~/.openclaw-dev`
- `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
- `OPENCLAW_GATEWAY_PORT=19001` (Gateway WS + HTTP)
- puerto del servicio de control del navegador = `19003` (derivado: `gateway.port+2`, solo loopback)
- `canvasHost.port=19005` (derivado: `gateway.port+4`)
- `agents.defaults.workspace` pasa a ser `~/.openclaw/workspace-dev` cuando ejecuta `setup`/`onboard` bajo `--dev`.

Puertos derivados (reglas generales):

- Puerto base = `gateway.port` (o `OPENCLAW_GATEWAY_PORT` / `--port`)
- puerto del servicio de control del navegador = base + 2 (solo loopback)
- `canvasHost.port = base + 4` (o `OPENCLAW_CANVAS_HOST_PORT` / sobrescritura por configuración)
- Los puertos CDP del perfil del navegador se asignan automáticamente desde `browser.controlPort + 9 .. + 108` (persisten por perfil).

Lista de verificación por instancia:

- `gateway.port` único
- `OPENCLAW_CONFIG_PATH` único
- `OPENCLAW_STATE_DIR` único
- `agents.defaults.workspace` único
- números de WhatsApp separados (si usa WA)

Instalación del servicio por perfil:

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

Ejemplo:

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/a.json OPENCLAW_STATE_DIR=~/.openclaw-a openclaw gateway --port 19001
OPENCLAW_CONFIG_PATH=~/.openclaw/b.json OPENCLAW_STATE_DIR=~/.openclaw-b openclaw gateway --port 19002
```

## Protocolo (vista del operador)

- Documentación completa: [Gateway protocol](/gateway/protocol) y [Bridge protocol (legacy)](/gateway/bridge-protocol).
- Primer frame obligatorio del cliente: `req {type:"req", id, method:"connect", params:{minProtocol,maxProtocol,client:{id,displayName?,version,platform,deviceFamily?,modelIdentifier?,mode,instanceId?}, caps, auth?, locale?, userAgent? } }`.
- El Gateway responde `res {type:"res", id, ok:true, payload:hello-ok }` (o `ok:false` con un error y luego cierra).
- Después del handshake:
  - Solicitudes: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - Eventos: `{type:"event", event, payload, seq?, stateVersion?}`
- Entradas de presencia estructuradas: `{host, ip, version, platform?, deviceFamily?, modelIdentifier?, mode, lastInputSeconds?, ts, reason?, tags?[], instanceId? }` (para clientes WS, `instanceId` proviene de `connect.client.instanceId`).
- Las respuestas `agent` son de dos etapas: primero `res` con acuse `{runId,status:"accepted"}`, luego un `res` `{runId,status:"ok"|"error",summary}` final cuando termina la ejecución; la salida en streaming llega como `event:"agent"`.

## Métodos (conjunto inicial)

- `health` — instantánea completa de salud (misma forma que `openclaw health --json`).
- `status` — resumen corto.
- `system-presence` — lista de presencia actual.
- `system-event` — publicar una nota de presencia/sistema (estructurada).
- `send` — enviar un mensaje vía los canales activos.
- `agent` — ejecutar un turno de agente (transmite eventos de vuelta por la misma conexión).
- `node.list` — listar nodos emparejados + actualmente conectados (incluye `caps`, `deviceFamily`, `modelIdentifier`, `paired`, `connected` y `commands` anunciados).
- `node.describe` — describir un nodo (capacidades + comandos `node.invoke` soportados; funciona para nodos emparejados y para nodos no emparejados actualmente conectados).
- `node.invoke` — invocar un comando en un nodo (p. ej., `canvas.*`, `camera.*`).
- `node.pair.*` — ciclo de vida de emparejamiento (`request`, `list`, `approve`, `reject`, `verify`).

Vea también: [Presence](/concepts/presence) para cómo se produce/depura la presencia y por qué importa un `client.instanceId` estable.

## Eventos

- `agent` — eventos de herramienta/salida transmitidos desde la ejecución del agente (etiquetados por secuencia).
- `presence` — actualizaciones de presencia (deltas con stateVersion) enviadas a todos los clientes conectados.
- `tick` — keepalive/no-op periódico para confirmar vitalidad.
- `shutdown` — el Gateway está saliendo; la carga útil incluye `reason` y `restartExpectedMs` opcional. Los clientes deben reconectar.

## Integración de WebChat

- WebChat es una UI nativa SwiftUI que se comunica directamente con el WebSocket del Gateway para historial, envíos, abortar y eventos.
- El uso remoto pasa por el mismo túnel SSH/Tailscale; si hay un token del gateway configurado, el cliente lo incluye durante `connect`.
- La app de macOS se conecta vía un único WS (conexión compartida); hidrata la presencia desde la instantánea inicial y escucha eventos `presence` para actualizar la UI.

## Tipado y validación

- El servidor valida cada frame entrante con AJV contra JSON Schema emitido desde las definiciones del protocolo.
- Los clientes (TS/Swift) consumen tipos generados (TS directamente; Swift vía el generador del repositorio).
- Las definiciones del protocolo son la fuente de verdad; regenere esquemas/modelos con:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`

## Instantánea de conexión

- `hello-ok` incluye un `snapshot` con `presence`, `health`, `stateVersion` y `uptimeMs` además de `policy {maxPayload,maxBufferedBytes,tickIntervalMs}` para que los clientes puedan renderizar de inmediato sin solicitudes adicionales.
- `health`/`system-presence` siguen disponibles para actualización manual, pero no son requeridos al momento de conectar.

## Códigos de error (forma res.error)

- Los errores usan `{ code, message, details?, retryable?, retryAfterMs? }`.
- Códigos estándar:
  - `NOT_LINKED` — WhatsApp no autenticado.
  - `AGENT_TIMEOUT` — el agente no respondió dentro del plazo configurado.
  - `INVALID_REQUEST` — falló la validación de esquema/parámetros.
  - `UNAVAILABLE` — el Gateway se está cerrando o una dependencia no está disponible.

## Comportamiento de keepalive

- Los eventos `tick` (o WS ping/pong) se emiten periódicamente para que los clientes sepan que el Gateway está vivo incluso cuando no hay tráfico.
- Los acuses de envío/agente siguen siendo respuestas separadas; no sobrecargue los ticks para envíos.

## Reproducción / brechas

- Los eventos no se reproducen. Los clientes detectan brechas de secuencia y deben refrescar (`health` + `system-presence`) antes de continuar. WebChat y los clientes de macOS ahora se auto-actualizan ante una brecha.

## Supervisión (ejemplo macOS)

- Use launchd para mantener el servicio activo:
  - Programa: ruta a `openclaw`
  - Argumentos: `gateway`
  - KeepAlive: true
  - StandardOut/Err: rutas de archivo o `syslog`
- Ante fallas, launchd reinicia; una mala configuración fatal debe seguir saliendo para que el operador lo note.
- Los LaunchAgents son por usuario y requieren una sesión iniciada; para configuraciones headless use un LaunchDaemon personalizado (no incluido).
  - `openclaw gateway install` escribe `~/Library/LaunchAgents/bot.molt.gateway.plist`
    (o `bot.molt.<profile>.plist`; el heredado `com.openclaw.*` se limpia).
  - `openclaw doctor` audita la configuración del LaunchAgent y puede actualizarla a los valores predeterminados actuales.

## Gestión del servicio Gateway (CLI)

Use el CLI del Gateway para instalar/iniciar/detener/reiniciar/estado:

```bash
openclaw gateway status
openclaw gateway install
openclaw gateway stop
openclaw gateway restart
openclaw logs --follow
```

Notas:

- `gateway status` sondea el RPC del Gateway por defecto usando el puerto/configuración resueltos del servicio (anule con `--url`).
- `gateway status --deep` agrega escaneos a nivel del sistema (LaunchDaemons/unidades system).
- `gateway status --no-probe` omite el sondeo RPC (útil cuando la red está caída).
- `gateway status --json` es estable para scripts.
- `gateway status` informa el **runtime del supervisor** (launchd/systemd ejecutándose) por separado de la **alcanzabilidad RPC** (conexión WS + RPC de estado).
- `gateway status` imprime la ruta de configuración + destino de sondeo para evitar confusión de “localhost vs enlace LAN” y desajustes de perfil.
- `gateway status` incluye la última línea de error del gateway cuando el servicio parece ejecutarse pero el puerto está cerrado.
- `logs` sigue el log de archivo del Gateway vía RPC (no se requiere `tail`/`grep` manual).
- Si se detectan otros servicios tipo gateway, el CLI advierte a menos que sean servicios de perfil OpenClaw.
  Aun así recomendamos **un gateway por máquina** para la mayoría de configuraciones; use perfiles/puertos aislados para redundancia o un bot de rescate. Ver [Multiple gateways](/gateway/multiple-gateways).
  - Limpieza: `openclaw gateway uninstall` (servicio actual) y `openclaw doctor` (migraciones heredadas).
- `gateway install` no hace nada cuando ya está instalado; use `openclaw gateway install --force` para reinstalar (cambios de perfil/env/ruta).

App mac incluida:

- OpenClaw.app puede incluir un relay de gateway basado en Node e instalar un LaunchAgent por usuario con la etiqueta
  `bot.molt.gateway` (o `bot.molt.<profile>`; las etiquetas heredadas `com.openclaw.*` aún se descargan limpiamente).
- Para detenerlo limpiamente, use `openclaw gateway stop` (o `launchctl bootout gui/$UID/bot.molt.gateway`).
- Para reiniciar, use `openclaw gateway restart` (o `launchctl kickstart -k gui/$UID/bot.molt.gateway`).
  - `launchctl` solo funciona si el LaunchAgent está instalado; de lo contrario use `openclaw gateway install` primero.
  - Reemplace la etiqueta con `bot.molt.<profile>` cuando ejecute un perfil con nombre.

## Supervisión (unidad de usuario systemd)

OpenClaw instala por defecto un **servicio de usuario systemd** en Linux/WSL2. Recomendamos servicios de usuario para máquinas de un solo usuario (entorno más simple, configuración por usuario). Use un **servicio del sistema** para servidores multiusuario o siempre activos (no se requiere lingering, supervisión compartida).

`openclaw gateway install` escribe la unidad de usuario. `openclaw doctor` audita la
unidad y puede actualizarla para que coincida con los valores recomendados actuales.

Cree `~/.config/systemd/user/openclaw-gateway[-<profile>].service`:

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5
Environment=OPENCLAW_GATEWAY_TOKEN=
WorkingDirectory=/home/youruser

[Install]
WantedBy=default.target
```

Habilite lingering (requerido para que el servicio de usuario sobreviva a cierre de sesión/inactividad):

```
sudo loginctl enable-linger youruser
```

La incorporación ejecuta esto en Linux/WSL2 (puede pedir sudo; escribe `/var/lib/systemd/linger`).
Luego habilite el servicio:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```

**Alternativa (servicio del sistema)**: para servidores siempre activos o multiusuario, puede instalar una unidad **system** de systemd en lugar de una unidad de usuario (no se requiere lingering). Cree `/etc/systemd/system/openclaw-gateway[-<profile>].service` (copie la unidad de arriba, cambie `WantedBy=multi-user.target`, configure `User=` + `WorkingDirectory=`), luego:

```
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway[-<profile>].service
```

## Windows (WSL2)

Las instalaciones en Windows deben usar **WSL2** y seguir la sección de systemd en Linux anterior.

## Comprobaciones operativas

- Vitalidad: abra WS y envíe `req:connect` → espere `res` con `payload.type="hello-ok"` (con instantánea).
- Preparación: llame `health` → espere `ok: true` y un canal vinculado en `linkChannel` (cuando aplique).
- Depuración: suscríbase a eventos `tick` y `presence`; asegúrese de que `status` muestre edad de vínculo/autenticación; las entradas de presencia muestran el host del Gateway y los clientes conectados.

## Garantías de seguridad

- Asuma un Gateway por host por defecto; si ejecuta múltiples perfiles, aísle puertos/estado y apunte a la instancia correcta.
- Sin fallback a conexiones directas de Baileys; si el Gateway está caído, los envíos fallan de inmediato.
- Los primeros frames no connect o JSON malformado se rechazan y el socket se cierra.
- Apagado ordenado: emita el evento `shutdown` antes de cerrar; los clientes deben manejar cierre + reconexión.

## Ayudantes de CLI

- `openclaw gateway health|status` — solicitar salud/estado sobre el WS del Gateway.
- `openclaw message send --target <num> --message "hi" [--media ...]` — enviar vía Gateway (idempotente para WhatsApp).
- `openclaw agent --message "hi" --to <num>` — ejecutar un turno de agente (espera el final por defecto).
- `openclaw gateway call <method> --params '{"k":"v"}'` — invocador de método en bruto para depuración.
- `openclaw gateway stop|restart` — detener/reiniciar el servicio de gateway supervisado (launchd/systemd).
- Los subcomandos auxiliares del Gateway asumen un gateway en ejecución en `--url`; ya no generan uno automáticamente.

## Guía de migración

- Retire los usos de `openclaw gateway` y el puerto de control TCP heredado.
- Actualice los clientes para hablar el protocolo WS con connect obligatorio y presencia estructurada.
