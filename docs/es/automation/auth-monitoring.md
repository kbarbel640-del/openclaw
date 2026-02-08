---
summary: "Supervise la expiración de OAuth para proveedores de modelos"
read_when:
  - Configurar la supervisión o alertas de expiración de autenticación
  - Automatizar verificaciones de renovación de OAuth de Claude Code / Codex
title: "Supervision de autenticacion"
x-i18n:
  source_path: automation/auth-monitoring.md
  source_hash: eef179af9545ed7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:43Z
---

# Supervision de autenticacion

OpenClaw expone el estado de salud de expiración de OAuth mediante `openclaw models status`. Use eso para
automatizacion y alertas; los scripts son extras opcionales para flujos de trabajo en el telefono.

## Preferido: verificacion por CLI (portable)

```bash
openclaw models status --check
```

Codigos de salida:

- `0`: OK
- `1`: credenciales expiradas o ausentes
- `2`: expira pronto (dentro de 24 h)

Esto funciona en cron/systemd y no requiere scripts adicionales.

## Scripts opcionales (operaciones / flujos de trabajo en telefono)

Estos se encuentran bajo `scripts/` y son **opcionales**. Asumen acceso SSH al
host del Gateway y estan ajustados para systemd + Termux.

- `scripts/claude-auth-status.sh` ahora usa `openclaw models status --json` como la
  fuente de verdad (con respaldo a lecturas directas de archivos si el CLI no esta disponible),
  por lo que mantenga `openclaw` en `PATH` para los temporizadores.
- `scripts/auth-monitor.sh`: objetivo de temporizador cron/systemd; envia alertas (ntfy o telefono).
- `scripts/systemd/openclaw-auth-monitor.{service,timer}`: temporizador de usuario systemd.
- `scripts/claude-auth-status.sh`: verificador de autenticacion de Claude Code + OpenClaw (completo/json/simple).
- `scripts/mobile-reauth.sh`: flujo guiado de reautenticacion por SSH.
- `scripts/termux-quick-auth.sh`: estado de widget de un toque + abrir URL de autenticacion.
- `scripts/termux-auth-widget.sh`: flujo guiado completo de widget.
- `scripts/termux-sync-widget.sh`: sincronizar credenciales de Claude Code → OpenClaw.

Si no necesita automatizacion en el telefono ni temporizadores systemd, omita estos scripts.
