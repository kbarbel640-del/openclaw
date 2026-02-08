---
summary: "Referencia de CLI para `openclaw directory` (self, peers, groups)"
read_when:
  - Quiere buscar IDs de contactos/grupos/self para un canal
  - Está desarrollando un adaptador de directorio de canal
title: "directory"
x-i18n:
  source_path: cli/directory.md
  source_hash: 7c878d9013aeaa22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:11Z
---

# `openclaw directory`

Búsquedas de directorio para canales que lo admiten (contactos/peers, grupos y “yo”).

## Flags comunes

- `--channel <name>`: id/alias del canal (requerido cuando hay varios canales configurados; automático cuando solo hay uno configurado)
- `--account <id>`: id de la cuenta (predeterminado: el predeterminado del canal)
- `--json`: salida JSON

## Notas

- `directory` está pensado para ayudarle a encontrar IDs que pueda pegar en otros comandos (especialmente `openclaw message send --target ...`).
- Para muchos canales, los resultados se respaldan en la configuracion (listas de permitidos / grupos configurados) en lugar de un directorio del proveedor en tiempo real.
- La salida predeterminada es `id` (y a veces `name`) separados por una tabulación; use `--json` para scripting.

## Uso de resultados con `message send`

```bash
openclaw directory peers list --channel slack --query "U0"
openclaw message send --channel slack --target user:U012ABCDEF --message "hello"
```

## Formatos de ID (por canal)

- WhatsApp: `+15551234567` (Mensaje directo), `1234567890-1234567890@g.us` (grupo)
- Telegram: `@username` o id de chat numérico; los grupos usan ids numéricos
- Slack: `user:U…` y `channel:C…`
- Discord: `user:<id>` y `channel:<id>`
- Matrix (plugin): `user:@user:server`, `room:!roomId:server` o `#alias:server`
- Microsoft Teams (plugin): `user:<id>` y `conversation:<id>`
- Zalo (plugin): id de usuario (Bot API)
- Zalo Personal / `zalouser` (plugin): id de hilo (Mensaje directo/grupo) de `zca` (`me`, `friend list`, `group list`)

## Self (“me”)

```bash
openclaw directory self --channel zalouser
```

## Peers (contactos/usuarios)

```bash
openclaw directory peers list --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory peers list --channel zalouser --limit 50
```

## Grupos

```bash
openclaw directory groups list --channel zalouser
openclaw directory groups list --channel zalouser --query "work"
openclaw directory groups members --channel zalouser --group-id <id>
```
