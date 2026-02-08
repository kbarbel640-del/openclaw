---
title: "Flujo de Desarrollo de Pi"
x-i18n:
  source_path: pi-dev.md
  source_hash: 65bd0580dd03df05
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:21Z
---

# Flujo de Desarrollo de Pi

Esta guia resume un flujo de trabajo sensato para trabajar en la integracion de Pi en OpenClaw.

## Verificacion de Tipos y Linting

- Verificar tipos y compilar: `pnpm build`
- Lint: `pnpm lint`
- Verificacion de formato: `pnpm format`
- Puerta completa antes de enviar: `pnpm lint && pnpm build && pnpm test`

## Ejecucion de Pruebas de Pi

Use el script dedicado para el conjunto de pruebas de integracion de Pi:

```bash
scripts/pi/run-tests.sh
```

Para incluir la prueba en vivo que ejercita el comportamiento real del proveedor:

```bash
scripts/pi/run-tests.sh --live
```

El script ejecuta todas las pruebas unitarias relacionadas con Pi mediante estos globs:

- `src/agents/pi-*.test.ts`
- `src/agents/pi-embedded-*.test.ts`
- `src/agents/pi-tools*.test.ts`
- `src/agents/pi-settings.test.ts`
- `src/agents/pi-tool-definition-adapter.test.ts`
- `src/agents/pi-extensions/*.test.ts`

## Pruebas Manuales

Flujo recomendado:

- Ejecute el Gateway en modo dev:
  - `pnpm gateway:dev`
- Dispare el agente directamente:
  - `pnpm openclaw agent --message "Hello" --thinking low`
- Use el TUI para depuracion interactiva:
  - `pnpm tui`

Para el comportamiento de llamadas a herramientas, solicite una accion de `read` o `exec` para que pueda ver el streaming de herramientas y el manejo de payloads.

## Reinicio a Estado Limpio

El estado vive bajo el directorio de estado de OpenClaw. El valor predeterminado es `~/.openclaw`. Si se establece `OPENCLAW_STATE_DIR`, use ese directorio en su lugar.

Para restablecer todo:

- `openclaw.json` para la configuracion
- `credentials/` para perfiles de autenticacion y tokens
- `agents/<agentId>/sessions/` para el historial de sesiones del agente
- `agents/<agentId>/sessions.json` para el indice de sesiones
- `sessions/` si existen rutas heredadas
- `workspace/` si desea un espacio de trabajo en blanco

Si solo desea restablecer las sesiones, elimine `agents/<agentId>/sessions/` y `agents/<agentId>/sessions.json` para ese agente. Mantenga `credentials/` si no desea volver a autenticarse.

## Referencias

- https://docs.openclaw.ai/testing
- https://docs.openclaw.ai/start/getting-started
