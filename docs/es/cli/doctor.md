---
summary: "Referencia de la CLI para `openclaw doctor` (comprobaciones de estado + reparaciones guiadas)"
read_when:
  - Tiene problemas de conectividad/autenticación y desea correcciones guiadas
  - Actualizó y quiere una comprobación de coherencia
title: "doctor"
x-i18n:
  source_path: cli/doctor.md
  source_hash: 92310aa3f3d111e9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:17Z
---

# `openclaw doctor`

Comprobaciones de estado + correcciones rápidas para el Gateway y los canales.

Relacionado:

- Solución de problemas: [Troubleshooting](/gateway/troubleshooting)
- Auditoría de seguridad: [Security](/gateway/security)

## Ejemplos

```bash
openclaw doctor
openclaw doctor --repair
openclaw doctor --deep
```

Notas:

- Las indicaciones interactivas (como correcciones del llavero/OAuth) solo se ejecutan cuando stdin es un TTY y `--non-interactive` **no** está configurado. Las ejecuciones sin interfaz (cron, Telegram, sin terminal) omitirán las indicaciones.
- `--fix` (alias de `--repair`) escribe una copia de seguridad en `~/.openclaw/openclaw.json.bak` y elimina claves de configuración desconocidas, enumerando cada eliminación.

## macOS: sobrescrituras de variables de entorno `launchctl`

Si anteriormente ejecutó `launchctl setenv OPENCLAW_GATEWAY_TOKEN ...` (o `...PASSWORD`), ese valor sobrescribe su archivo de configuración y puede causar errores persistentes de “no autorizado”.

```bash
launchctl getenv OPENCLAW_GATEWAY_TOKEN
launchctl getenv OPENCLAW_GATEWAY_PASSWORD

launchctl unsetenv OPENCLAW_GATEWAY_TOKEN
launchctl unsetenv OPENCLAW_GATEWAY_PASSWORD
```
