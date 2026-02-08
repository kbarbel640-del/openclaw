---
summary: "Cómo ejecutar pruebas localmente (vitest) y cuándo usar los modos force/coverage"
read_when:
  - Al ejecutar o corregir pruebas
title: "Pruebas"
x-i18n:
  source_path: reference/test.md
  source_hash: be7b751fb81c8c94
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:54Z
---

# Pruebas

- Kit completo de pruebas (suites, live, Docker): [Testing](/testing)

- `pnpm test:force`: Finaliza cualquier proceso persistente del gateway que esté ocupando el puerto de control predeterminado, luego ejecuta la suite completa de Vitest con un puerto de gateway aislado para que las pruebas de servidor no colisionen con una instancia en ejecución. Úselo cuando una ejecución previa del gateway dejó ocupado el puerto 18789.
- `pnpm test:coverage`: Ejecuta Vitest con cobertura V8. Los umbrales globales son 70% para líneas/ramas/funciones/declaraciones. La cobertura excluye entrypoints con alta integración (conexión del CLI, puentes gateway/telegram, servidor estático de webchat) para mantener el objetivo enfocado en la lógica comprobable con pruebas unitarias.
- `pnpm test:e2e`: Ejecuta pruebas smoke end-to-end del gateway (emparejamiento WS/HTTP/nodo multi‑instancia).
- `pnpm test:live`: Ejecuta pruebas live del proveedor (minimax/zai). Requiere claves de API y `LIVE=1` (o `*_LIVE_TEST=1` específico del proveedor) para desomitir.

## Bench de latencia del modelo (claves locales)

Script: [`scripts/bench-model.ts`](https://github.com/openclaw/openclaw/blob/main/scripts/bench-model.ts)

Uso:

- `source ~/.profile && pnpm tsx scripts/bench-model.ts --runs 10`
- Variables de entorno opcionales: `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, `ANTHROPIC_API_KEY`
- Prompt predeterminado: “Responda con una sola palabra: ok. Sin puntuación ni texto adicional.”

Última ejecución (2025-12-31, 20 ejecuciones):

- minimax mediana 1279ms (mín 1114, máx 2431)
- opus mediana 2454ms (mín 1224, máx 3170)

## Onboarding E2E (Docker)

Docker es opcional; esto solo es necesario para pruebas smoke de onboarding en contenedores.

Flujo completo de arranque en frío en un contenedor Linux limpio:

```bash
scripts/e2e/onboard-docker.sh
```

Este script conduce el asistente interactivo mediante una pseudo‑tty, verifica los archivos de configuración/espacio de trabajo/sesión, luego inicia el gateway y ejecuta `openclaw health`.

## Smoke de importación QR (Docker)

Asegura que `qrcode-terminal` cargue bajo Node 22+ en Docker:

```bash
pnpm test:docker:qr
```
