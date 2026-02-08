---
summary: Notas y soluciones alternativas para fallos de Node + tsx "__name is not a function"
read_when:
  - Depuración de scripts de desarrollo solo de Node o fallos en modo watch
  - Investigación de fallos del cargador tsx/esbuild en OpenClaw
title: "Fallo de Node + tsx"
x-i18n:
  source_path: debug/node-issue.md
  source_hash: f9e9bd2281508337
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:44Z
---

# Fallo de Node + tsx "\_\_name is not a function"

## Resumen

Ejecutar OpenClaw vía Node con `tsx` falla al inicio con:

```
[openclaw] Failed to start CLI: TypeError: __name is not a function
    at createSubsystemLogger (.../src/logging/subsystem.ts:203:25)
    at .../src/agents/auth-profiles/constants.ts:25:20
```

Esto comenzó después de cambiar los scripts de desarrollo de Bun a `tsx` (commit `2871657e`, 2026-01-06). La misma ruta de ejecución funcionaba con Bun.

## Entorno

- Node: v25.x (observado en v25.3.0)
- tsx: 4.21.0
- SO: macOS (la reproducción también es probable en otras plataformas que ejecutan Node 25)

## Reproducción (solo Node)

```bash
# in repo root
node --version
pnpm install
node --import tsx src/entry.ts status
```

## Reproducción mínima en el repo

```bash
node --import tsx scripts/repro/tsx-name-repro.ts
```

## Verificación de versión de Node

- Node 25.3.0: falla
- Node 22.22.0 (Homebrew `node@22`): falla
- Node 24: aún no instalado aquí; requiere verificación

## Notas / hipótesis

- `tsx` usa esbuild para transformar TS/ESM. El `keepNames` de esbuild emite un helper `__name` y envuelve definiciones de funciones con `__name(...)`.
- El fallo indica que `__name` existe pero no es una función en tiempo de ejecución, lo que implica que el helper falta o fue sobrescrito para este módulo en la ruta del cargador de Node 25.
- Se han reportado problemas similares del helper `__name` en otros consumidores de esbuild cuando el helper falta o se reescribe.

## Historial de regresión

- `2871657e` (2026-01-06): los scripts cambiaron de Bun a tsx para hacer opcional a Bun.
- Antes de eso (ruta con Bun), `openclaw status` y `gateway:watch` funcionaban.

## Soluciones alternativas

- Usar Bun para los scripts de desarrollo (reversión temporal actual).
- Usar Node + watch de tsc, y luego ejecutar la salida compilada:
  ```bash
  pnpm exec tsc --watch --preserveWatchOutput
  node --watch openclaw.mjs status
  ```
- Confirmado localmente: `pnpm exec tsc -p tsconfig.json` + `node openclaw.mjs status` funciona en Node 25.
- Deshabilitar keepNames de esbuild en el cargador de TS si es posible (evita la inserción del helper `__name`); tsx actualmente no expone esto.
- Probar Node LTS (22/24) con `tsx` para ver si el problema es específico de Node 25.

## Referencias

- https://opennext.js.org/cloudflare/howtos/keep_names
- https://esbuild.github.io/api/#keep-names
- https://github.com/evanw/esbuild/issues/1031

## Próximos pasos

- Reproducir en Node 22/24 para confirmar una regresión de Node 25.
- Probar `tsx` nightly o fijar a una versión anterior si existe una regresión conocida.
- Si se reproduce en Node LTS, presentar una reproducción mínima upstream con el stack trace `__name`.
