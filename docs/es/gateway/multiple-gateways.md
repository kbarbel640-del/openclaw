---
summary: "Ejecute multiples Gateways de OpenClaw en un solo host (aislamiento, puertos y perfiles)"
read_when:
  - Ejecuta mas de un Gateway en la misma maquina
  - Necesita configuracion/estado/puertos aislados por Gateway
title: "Multiples Gateways"
x-i18n:
  source_path: gateway/multiple-gateways.md
  source_hash: 09b5035d4e5fb97c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:56Z
---

# Multiples Gateways (mismo host)

La mayoria de las configuraciones deberian usar un solo Gateway porque un unico Gateway puede manejar multiples conexiones de mensajeria y agentes. Si necesita un aislamiento mas fuerte o redundancia (por ejemplo, un bot de rescate), ejecute Gateways separados con perfiles/puertos aislados.

## Lista de verificacion de aislamiento (obligatoria)

- `OPENCLAW_CONFIG_PATH` — archivo de configuracion por instancia
- `OPENCLAW_STATE_DIR` — sesiones, credenciales y caches por instancia
- `agents.defaults.workspace` — raiz del espacio de trabajo por instancia
- `gateway.port` (o `--port`) — unico por instancia
- Los puertos derivados (navegador/canvas) no deben superponerse

Si estos se comparten, encontrara condiciones de carrera de configuracion y conflictos de puertos.

## Recomendado: perfiles (`--profile`)

Los perfiles delimitan automaticamente `OPENCLAW_STATE_DIR` + `OPENCLAW_CONFIG_PATH` y agregan un sufijo a los nombres de los servicios.

```bash
# main
openclaw --profile main setup
openclaw --profile main gateway --port 18789

# rescue
openclaw --profile rescue setup
openclaw --profile rescue gateway --port 19001
```

Servicios por perfil:

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

## Guia de bot de rescate

Ejecute un segundo Gateway en el mismo host con su propio:

- perfil/configuracion
- directorio de estado
- espacio de trabajo
- puerto base (mas puertos derivados)

Esto mantiene al bot de rescate aislado del bot principal para que pueda depurar o aplicar cambios de configuracion si el bot primario esta inactivo.

Espaciado de puertos: deje al menos 20 puertos entre los puertos base para que los puertos derivados de navegador/canvas/CDP nunca colisionen.

### Como instalar (bot de rescate)

```bash
# Main bot (existing or fresh, without --profile param)
# Runs on port 18789 + Chrome CDC/Canvas/... Ports
openclaw onboard
openclaw gateway install

# Rescue bot (isolated profile + ports)
openclaw --profile rescue onboard
# Notes:
# - workspace name will be postfixed with -rescue per default
# - Port should be at least 18789 + 20 Ports,
#   better choose completely different base port, like 19789,
# - rest of the onboarding is the same as normal

# To install the service (if not happened automatically during onboarding)
openclaw --profile rescue gateway install
```

## Mapeo de puertos (derivados)

Puerto base = `gateway.port` (o `OPENCLAW_GATEWAY_PORT` / `--port`).

- puerto del servicio de control del navegador = base + 2 (solo loopback)
- `canvasHost.port = base + 4`
- Los puertos CDP del perfil del navegador se asignan automaticamente desde `browser.controlPort + 9 .. + 108`

Si sobrescribe cualquiera de estos en la configuracion o variables de entorno, debe mantenerlos unicos por instancia.

## Notas de navegador/CDP (trampa comun)

- **No** fije `browser.cdpUrl` a los mismos valores en multiples instancias.
- Cada instancia necesita su propio puerto de control del navegador y rango CDP (derivado de su puerto del gateway).
- Si necesita puertos CDP explicitos, configure `browser.profiles.<name>.cdpPort` por instancia.
- Chrome remoto: use `browser.profiles.<name>.cdpUrl` (por perfil, por instancia).

## Ejemplo manual de variables de entorno

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/main.json \
OPENCLAW_STATE_DIR=~/.openclaw-main \
openclaw gateway --port 18789

OPENCLAW_CONFIG_PATH=~/.openclaw/rescue.json \
OPENCLAW_STATE_DIR=~/.openclaw-rescue \
openclaw gateway --port 19001
```

## Comprobaciones rapidas

```bash
openclaw --profile main status
openclaw --profile rescue status
openclaw --profile rescue browser status
```
