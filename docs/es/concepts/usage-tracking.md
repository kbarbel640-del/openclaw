---
summary: "Superficies de seguimiento de uso y requisitos de credenciales"
read_when:
  - Está conectando superficies de uso/cuota del proveedor
  - Necesita explicar el comportamiento del seguimiento de uso o los requisitos de autenticación
title: "Seguimiento de uso"
x-i18n:
  source_path: concepts/usage-tracking.md
  source_hash: 6f6ed2a70329b2a6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:44Z
---

# Seguimiento de uso

## Qué es

- Obtiene el uso/cuota del proveedor directamente desde sus endpoints de uso.
- Sin costos estimados; solo las ventanas reportadas por el proveedor.

## Dónde aparece

- `/status` en chats: tarjeta de estado rica en emojis con tokens de la sesión + costo estimado (solo API key). El uso del proveedor se muestra para el **proveedor del modelo actual** cuando está disponible.
- `/usage off|tokens|full` en chats: pie de uso por respuesta (OAuth muestra solo tokens).
- `/usage cost` en chats: resumen de costos local agregado a partir de los registros de sesión de OpenClaw.
- CLI: `openclaw status --usage` imprime un desglose completo por proveedor.
- CLI: `openclaw channels list` imprime la misma instantánea de uso junto con la configuración del proveedor (use `--no-usage` para omitir).
- Barra de menú de macOS: sección “Uso” bajo Context (solo si está disponible).

## Proveedores + credenciales

- **Anthropic (Claude)**: tokens OAuth en perfiles de autenticación.
- **GitHub Copilot**: tokens OAuth en perfiles de autenticación.
- **Gemini CLI**: tokens OAuth en perfiles de autenticación.
- **Antigravity**: tokens OAuth en perfiles de autenticación.
- **OpenAI Codex**: tokens OAuth en perfiles de autenticación (se usa accountId cuando está presente).
- **MiniMax**: API key (clave del plan de programación; `MINIMAX_CODE_PLAN_KEY` o `MINIMAX_API_KEY`); usa la ventana del plan de programación de 5 horas.
- **z.ai**: API key vía env/config/almacén de autenticación.

El uso se oculta si no existen credenciales OAuth/API coincidentes.
