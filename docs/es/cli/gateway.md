---
summary: "OpenClaw Gateway CLI (`openclaw gateway`) — ejecutar, consultar y descubrir gateways"
read_when:
  - Ejecutar el Gateway desde la CLI (dev o servidores)
  - Depurar autenticación del Gateway, modos de enlace y conectividad
  - Descubrir gateways vía Bonjour (LAN + tailnet)
title: "gateway"
x-i18n:
  source_path: cli/gateway.md
  source_hash: cbc1690e6be84073
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:25Z
---

# Gateway CLI

El Gateway es el servidor WebSocket de OpenClaw (canales, nodos, sesiones, hooks).

Los subcomandos de esta página viven bajo `openclaw gateway …`.

Documentos relacionados:

- [/gateway/bonjour](/gateway/bonjour)
- [/gateway/discovery](/gateway/discovery)
- [/gateway/configuration](/gateway/configuration)

## Ejecutar el Gateway

Ejecute un proceso local del Gateway:

```bash
openclaw gateway
```

Alias en primer plano:

```bash
openclaw gateway run
```

Notas:

- De forma predeterminada, el Gateway se niega a iniciar a menos que `gateway.mode=local` esté configurado en `~/.openclaw/openclaw.json`. Use `--allow-unconfigured` para ejecuciones ad-hoc/dev.
- El enlace más allá del loopback sin autenticación está bloqueado (barandilla de seguridad).
- `SIGUSR1` activa un reinicio en proceso cuando está autorizado (habilite `commands.restart` o use la herramienta/configuración del gateway apply/update).
- Los manejadores `SIGINT`/`SIGTERM` detienen el proceso del gateway, pero no restauran ningún estado personalizado del terminal. Si envuelve la CLI con una TUI o entrada en modo raw, restaure el terminal antes de salir.

### Opciones

- `--port <port>`: puerto WebSocket (el valor predeterminado proviene de la configuración/variables de entorno; usualmente `18789`).
- `--bind <loopback|lan|tailnet|auto|custom>`: modo de enlace del listener.
- `--auth <token|password>`: anulación del modo de autenticación.
- `--token <token>`: anulación de token (también establece `OPENCLAW_GATEWAY_TOKEN` para el proceso).
- `--password <password>`: anulación de contraseña (también establece `OPENCLAW_GATEWAY_PASSWORD` para el proceso).
- `--tailscale <off|serve|funnel>`: exponer el Gateway vía Tailscale.
- `--tailscale-reset-on-exit`: restablecer la configuración de Tailscale serve/funnel al apagar.
- `--allow-unconfigured`: permitir iniciar el gateway sin `gateway.mode=local` en la configuración.
- `--dev`: crear una configuración + workspace de desarrollo si faltan (omite BOOTSTRAP.md).
- `--reset`: restablecer configuración de desarrollo + credenciales + sesiones + workspace (requiere `--dev`).
- `--force`: finalizar cualquier listener existente en el puerto seleccionado antes de iniciar.
- `--verbose`: registros detallados.
- `--claude-cli-logs`: mostrar solo los registros de claude-cli en la consola (y habilitar su stdout/stderr).
- `--ws-log <auto|full|compact>`: estilo de registro de websocket (predeterminado `auto`).
- `--compact`: alias de `--ws-log compact`.
- `--raw-stream`: registrar eventos crudos del stream del modelo en jsonl.
- `--raw-stream-path <path>`: ruta del jsonl de stream crudo.

## Consultar un Gateway en ejecución

Todos los comandos de consulta usan RPC sobre WebSocket.

Modos de salida:

- Predeterminado: legible para humanos (con color en TTY).
- `--json`: JSON legible por máquina (sin estilos/spinner).
- `--no-color` (o `NO_COLOR=1`): deshabilitar ANSI manteniendo el diseño humano.

Opciones compartidas (donde se admiten):

- `--url <url>`: URL del WebSocket del Gateway.
- `--token <token>`: token del Gateway.
- `--password <password>`: contraseña del Gateway.
- `--timeout <ms>`: tiempo de espera/presupuesto (varía por comando).
- `--expect-final`: esperar una respuesta “final” (llamadas de agentes).

Nota: cuando establece `--url`, la CLI no recurre a credenciales de configuración o de variables de entorno.
Pase `--token` o `--password` explícitamente. La falta de credenciales explícitas es un error.

### `gateway health`

```bash
openclaw gateway health --url ws://127.0.0.1:18789
```

### `gateway status`

`gateway status` muestra el servicio del Gateway (launchd/systemd/schtasks) más una sonda RPC opcional.

```bash
openclaw gateway status
openclaw gateway status --json
```

Opciones:

- `--url <url>`: anular la URL de la sonda.
- `--token <token>`: autenticación por token para la sonda.
- `--password <password>`: autenticación por contraseña para la sonda.
- `--timeout <ms>`: tiempo de espera de la sonda (predeterminado `10000`).
- `--no-probe`: omitir la sonda RPC (vista solo del servicio).
- `--deep`: escanear también servicios a nivel de sistema.

### `gateway probe`

`gateway probe` es el comando de “depurar todo”. Siempre sondea:

- su gateway remoto configurado (si está configurado), y
- localhost (loopback) **incluso si hay un remoto configurado**.

Si hay múltiples gateways accesibles, los imprime todos. Se admiten múltiples gateways cuando se usan perfiles/puertos aislados (p. ej., un bot de rescate), pero la mayoría de las instalaciones aún ejecutan un solo gateway.

```bash
openclaw gateway probe
openclaw gateway probe --json
```

#### Remoto sobre SSH (paridad con la app de Mac)

El modo “Remoto sobre SSH” de la app de macOS usa un reenvío de puerto local para que el gateway remoto (que puede estar enlazado solo a loopback) sea accesible en `ws://127.0.0.1:<port>`.

Equivalente en la CLI:

```bash
openclaw gateway probe --ssh user@gateway-host
```

Opciones:

- `--ssh <target>`: `user@host` o `user@host:port` (el puerto predeterminado es `22`).
- `--ssh-identity <path>`: archivo de identidad.
- `--ssh-auto`: elegir el primer host de gateway descubierto como destino SSH (solo LAN/WAB).

Configuración (opcional, usada como valores predeterminados):

- `gateway.remote.sshTarget`
- `gateway.remote.sshIdentity`

### `gateway call <method>`

Ayudante RPC de bajo nivel.

```bash
openclaw gateway call status
openclaw gateway call logs.tail --params '{"sinceMs": 60000}'
```

## Administrar el servicio del Gateway

```bash
openclaw gateway install
openclaw gateway start
openclaw gateway stop
openclaw gateway restart
openclaw gateway uninstall
```

Notas:

- `gateway install` admite `--port`, `--runtime`, `--token`, `--force`, `--json`.
- Los comandos de ciclo de vida aceptan `--json` para scripting.

## Descubrir gateways (Bonjour)

`gateway discover` escanea en busca de balizas del Gateway (`_openclaw-gw._tcp`).

- Multicast DNS-SD: `local.`
- Unicast DNS-SD (Wide-Area Bonjour): elija un dominio (ejemplo: `openclaw.internal.`) y configure split DNS + un servidor DNS; vea [/gateway/bonjour](/gateway/bonjour)

Solo los gateways con descubrimiento Bonjour habilitado (predeterminado) anuncian la baliza.

Los registros de descubrimiento Wide-Area incluyen (TXT):

- `role` (pista del rol del gateway)
- `transport` (pista de transporte, p. ej., `gateway`)
- `gatewayPort` (puerto WebSocket, usualmente `18789`)
- `sshPort` (puerto SSH; predetermina a `22` si no está presente)
- `tailnetDns` (hostname MagicDNS, cuando está disponible)
- `gatewayTls` / `gatewayTlsSha256` (TLS habilitado + huella del certificado)
- `cliPath` (pista opcional para instalaciones remotas)

### `gateway discover`

```bash
openclaw gateway discover
```

Opciones:

- `--timeout <ms>`: tiempo de espera por comando (browse/resolve); predeterminado `2000`.
- `--json`: salida legible por máquina (también deshabilita estilos/spinner).

Ejemplos:

```bash
openclaw gateway discover --timeout 4000
openclaw gateway discover --json | jq '.beacons[].wsUrl'
```
