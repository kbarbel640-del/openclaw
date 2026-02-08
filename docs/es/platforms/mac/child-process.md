---
summary: "Ciclo de vida del Gateway en macOS (launchd)"
read_when:
  - Integración de la app de macOS con el ciclo de vida del Gateway
title: "Ciclo de vida del Gateway"
x-i18n:
  source_path: platforms/mac/child-process.md
  source_hash: 9b910f574b723bc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:25Z
---

# Ciclo de vida del Gateway en macOS

La app de macOS **administra el Gateway mediante launchd** de forma predeterminada y no inicia el Gateway como un proceso hijo. Primero intenta conectarse a un Gateway que ya esté en ejecución en el puerto configurado; si no hay ninguno accesible, habilita el servicio de launchd mediante el CLI externo `openclaw` (sin runtime integrado). Esto le ofrece un inicio automático confiable al iniciar sesión y reinicio ante fallos.

El modo de proceso hijo (Gateway iniciado directamente por la app) **no se usa** actualmente. Si necesita un acoplamiento más estrecho con la UI, ejecute el Gateway manualmente en una terminal.

## Comportamiento predeterminado (launchd)

- La app instala un LaunchAgent por usuario con la etiqueta `bot.molt.gateway`
  (o `bot.molt.<profile>` cuando se usan `--profile`/`OPENCLAW_PROFILE`; se admite el legado `com.openclaw.*`).
- Cuando el modo Local está habilitado, la app se asegura de que el LaunchAgent esté cargado y
  inicia el Gateway si es necesario.
- Los registros se escriben en la ruta de logs del Gateway de launchd (visible en Debug Settings).

Comandos comunes:

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

Reemplace la etiqueta por `bot.molt.<profile>` cuando ejecute un perfil con nombre.

## Builds de desarrollo sin firmar

`scripts/restart-mac.sh --no-sign` es para builds locales rápidos cuando no tiene
claves de firma. Para evitar que launchd apunte a un binario de relay sin firmar, hace lo siguiente:

- Escribe `~/.openclaw/disable-launchagent`.

Las ejecuciones firmadas de `scripts/restart-mac.sh` eliminan esta anulación si el marcador está
presente. Para restablecer manualmente:

```bash
rm ~/.openclaw/disable-launchagent
```

## Modo solo adjuntar

Para forzar que la app de macOS **nunca instale ni administre launchd**, ejecútela con
`--attach-only` (o `--no-launchd`). Esto establece `~/.openclaw/disable-launchagent`,
por lo que la app solo se adjunta a un Gateway que ya esté en ejecución. Puede alternar el mismo
comportamiento en Debug Settings.

## Modo remoto

El modo remoto nunca inicia un Gateway local. La app usa un túnel SSH hacia el
host remoto y se conecta a través de ese túnel.

## Por qué preferimos launchd

- Inicio automático al iniciar sesión.
- Semántica integrada de reinicio/KeepAlive.
- Registros y supervisión predecibles.

Si alguna vez se necesita nuevamente un modo de proceso hijo real, debería documentarse como un modo de desarrollo separado y explícito.
