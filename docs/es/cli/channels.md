---
summary: "Referencia de la CLI para `openclaw channels` (cuentas, estado, inicio/cierre de sesion, registros)"
read_when:
  - Quiere agregar o eliminar cuentas de canal (WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (plugin)/Signal/iMessage)
  - Quiere verificar el estado del canal o seguir los registros del canal
title: "canales"
x-i18n:
  source_path: cli/channels.md
  source_hash: 16ab1642f247bfa9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:09Z
---

# `openclaw channels`

Administre las cuentas de canales de chat y su estado de ejecucion en el Gateway.

Documentos relacionados:

- Guias de canales: [Channels](/channels/index)
- Configuracion del Gateway: [Configuration](/gateway/configuration)

## Comandos comunes

```bash
openclaw channels list
openclaw channels status
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels logs --channel all
```

## Agregar / eliminar cuentas

```bash
openclaw channels add --channel telegram --token <bot-token>
openclaw channels remove --channel telegram --delete
```

Consejo: `openclaw channels add --help` muestra las opciones por canal (token, app token, rutas de signal-cli, etc).

## Inicio / cierre de sesion (interactivo)

```bash
openclaw channels login --channel whatsapp
openclaw channels logout --channel whatsapp
```

## Solucion de problemas

- Ejecute `openclaw status --deep` para una verificacion amplia.
- Use `openclaw doctor` para correcciones guiadas.
- `openclaw channels list` imprime `Claude: HTTP 403 ... user:profile` → la instantanea de uso requiere el alcance `user:profile`. Use `--no-usage`, o proporcione una clave de sesion de claude.ai (`CLAUDE_WEB_SESSION_KEY` / `CLAUDE_WEB_COOKIE`), o vuelva a autenticarse mediante Claude Code CLI.

## Sonda de capacidades

Obtenga sugerencias de capacidades del proveedor (intents/alcances cuando esten disponibles) mas compatibilidad estatica de funciones:

```bash
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
```

Notas:

- `--channel` es opcional; omitelo para listar todos los canales (incluidas las extensiones).
- `--target` acepta `channel:<id>` o un id numerico de canal sin procesar y solo aplica a Discord.
- Las sondas son especificas del proveedor: intents de Discord + permisos opcionales del canal; alcances de bot + usuario de Slack; banderas de bot de Telegram + webhook; version del demonio de Signal; token de app de MS Teams + roles/alcances de Graph (anotados cuando se conocen). Los canales sin sondas informan `Probe: unavailable`.

## Resolver nombres a IDs

Resuelva nombres de canales/usuarios a IDs usando el directorio del proveedor:

```bash
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels resolve --channel discord "My Server/#support" "@someone"
openclaw channels resolve --channel matrix "Project Room"
```

Notas:

- Use `--kind user|group|auto` para forzar el tipo de destino.
- La resolucion prioriza coincidencias activas cuando varias entradas comparten el mismo nombre.
