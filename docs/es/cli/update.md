---
summary: "Referencia de la CLI para `openclaw update` (actualización de código fuente relativamente segura + reinicio automático del Gateway)"
read_when:
  - Quiere actualizar un checkout de código fuente de forma segura
  - Necesita entender el comportamiento del atajo `--update`
title: "update"
x-i18n:
  source_path: cli/update.md
  source_hash: 3a08e8ac797612c4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:25Z
---

# `openclaw update`

Actualice OpenClaw de forma segura y cambie entre los canales stable/beta/dev.

Si instaló mediante **npm/pnpm** (instalación global, sin metadatos de git), las actualizaciones se realizan mediante el flujo del gestor de paquetes en [Updating](/install/updating).

## Uso

```bash
openclaw update
openclaw update status
openclaw update wizard
openclaw update --channel beta
openclaw update --channel dev
openclaw update --tag beta
openclaw update --no-restart
openclaw update --json
openclaw --update
```

## Opciones

- `--no-restart`: omite reiniciar el servicio del Gateway después de una actualización exitosa.
- `--channel <stable|beta|dev>`: establece el canal de actualización (git + npm; se persiste en la configuración).
- `--tag <dist-tag|version>`: sobrescribe el dist-tag o la versión de npm solo para esta actualización.
- `--json`: imprime JSON `UpdateRunResult` legible por máquinas.
- `--timeout <seconds>`: tiempo de espera por paso (el valor predeterminado es 1200 s).

Nota: las degradaciones requieren confirmación porque las versiones anteriores pueden romper la configuración.

## `update status`

Muestra el canal de actualización activo + la etiqueta/rama/SHA de git (para checkouts de código fuente), además de la disponibilidad de actualizaciones.

```bash
openclaw update status
openclaw update status --json
openclaw update status --timeout 10
```

Opciones:

- `--json`: imprime JSON de estado legible por máquinas.
- `--timeout <seconds>`: tiempo de espera para las comprobaciones (el valor predeterminado es 3 s).

## `update wizard`

Flujo interactivo para elegir un canal de actualización y confirmar si se debe reiniciar el Gateway
después de actualizar (el valor predeterminado es reiniciar). Si selecciona `dev` sin un checkout de git, ofrece crear uno.

## Qué hace

Cuando cambia de canal explícitamente (`--channel ...`), OpenClaw también mantiene alineado el
método de instalación:

- `dev` → garantiza un checkout de git (predeterminado: `~/openclaw`, se puede sobrescribir con `OPENCLAW_GIT_DIR`),
  lo actualiza e instala la CLI global desde ese checkout.
- `stable`/`beta` → instala desde npm usando el dist-tag correspondiente.

## Flujo de checkout de git

Canales:

- `stable`: hace checkout de la etiqueta más reciente que no sea beta, luego build + doctor.
- `beta`: hace checkout de la etiqueta `-beta` más reciente, luego build + doctor.
- `dev`: hace checkout de `main`, luego fetch + rebase.

Alto nivel:

1. Requiere un árbol de trabajo limpio (sin cambios sin confirmar).
2. Cambia al canal seleccionado (etiqueta o rama).
3. Obtiene los cambios upstream (solo dev).
4. Solo dev: lint de preflight + build de TypeScript en un árbol de trabajo temporal; si el tip falla, retrocede hasta 10 commits para encontrar el build limpio más reciente.
5. Rebase sobre el commit seleccionado (solo dev).
6. Instala dependencias (pnpm preferido; npm como alternativa).
7. Compila + compila la UI de Control.
8. Ejecuta `openclaw doctor` como la verificación final de “actualización segura”.
9. Sincroniza los plugins con el canal activo (dev usa extensiones incluidas; stable/beta usa npm) y actualiza los plugins instalados vía npm.

## Atajo `--update`

`openclaw --update` se reescribe como `openclaw update` (útil para shells y scripts de lanzamiento).

## Ver también

- `openclaw doctor` (ofrece ejecutar la actualización primero en checkouts de git)
- [Development channels](/install/development-channels)
- [Updating](/install/updating)
- [CLI reference](/cli)
