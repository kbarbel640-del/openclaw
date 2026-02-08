---
summary: "Flujo de trabajo con Bun (experimental): instalación y advertencias frente a pnpm"
read_when:
  - Quiere el ciclo de desarrollo local más rápido (bun + watch)
  - Encuentra problemas de instalación/parcheo/scripts de ciclo de vida en Bun
title: "Bun (Experimental)"
x-i18n:
  source_path: install/bun.md
  source_hash: eb3f4c222b6bae49
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:02Z
---

# Bun (experimental)

Objetivo: ejecutar este repositorio con **Bun** (opcional, no recomendado para WhatsApp/Telegram)
sin divergir de los flujos de trabajo con pnpm.

⚠️ **No recomendado para el runtime del Gateway** (errores en WhatsApp/Telegram). Use Node para producción.

## Estado

- Bun es un runtime local opcional para ejecutar TypeScript directamente (`bun run …`, `bun --watch …`).
- `pnpm` es el valor predeterminado para los builds y permanece totalmente soportado (y usado por algunas herramientas de documentación).
- Bun no puede usar `pnpm-lock.yaml` y lo ignorará.

## Instalación

Predeterminado:

```sh
bun install
```

Nota: `bun.lock`/`bun.lockb` están ignorados por git, así que no hay cambios en el repo de cualquier forma. Si quiere _no escribir lockfiles_:

```sh
bun install --no-save
```

## Build / Test (Bun)

```sh
bun run build
bun run vitest run
```

## Scripts de ciclo de vida de Bun (bloqueados por defecto)

Bun puede bloquear scripts de ciclo de vida de dependencias a menos que se confíe explícitamente en ellos (`bun pm untrusted` / `bun pm trust`).
Para este repo, los scripts que se bloquean comúnmente no son necesarios:

- `@whiskeysockets/baileys` `preinstall`: verifica Node mayor >= 20 (ejecutamos Node 22+).
- `protobufjs` `postinstall`: emite advertencias sobre esquemas de versiones incompatibles (sin artefactos de build).

Si encuentra un problema real de runtime que requiera estos scripts, confíe en ellos explícitamente:

```sh
bun pm trust @whiskeysockets/baileys protobufjs
```

## Advertencias

- Algunos scripts aún tienen pnpm codificado de forma rígida (por ejemplo, `docs:build`, `ui:*`, `protocol:check`). Ejecútelos con pnpm por ahora.
