---
summary: "Interfaz de configuracion de Skills en macOS y estado respaldado por el Gateway"
read_when:
  - Actualizacion de la interfaz de configuracion de Skills en macOS
  - Cambio del control de acceso o del comportamiento de instalacion de Skills
title: "Skills"
x-i18n:
  source_path: platforms/mac/skills.md
  source_hash: ecd5286bbe49eed8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:31Z
---

# Skills (macOS)

La app de macOS expone las Skills de OpenClaw a traves del Gateway; no analiza las Skills localmente.

## Fuente de datos

- `skills.status` (Gateway) devuelve todas las Skills, ademas de la elegibilidad y los requisitos faltantes
  (incluidos los bloqueos por allowlist para las Skills integradas).
- Los requisitos se derivan de `metadata.openclaw.requires` en cada `SKILL.md`.

## Acciones de instalacion

- `metadata.openclaw.install` define las opciones de instalacion (brew/node/go/uv).
- La app llama a `skills.install` para ejecutar los instaladores en el host del Gateway.
- El Gateway expone solo un instalador preferido cuando se proporcionan multiples
  (brew cuando esta disponible; de lo contrario, el gestor de node de `skills.install`, npm por defecto).

## Claves de entorno/API

- La app almacena las claves en `~/.openclaw/openclaw.json` bajo `skills.entries.<skillKey>`.
- `skills.update` aplica parches a `enabled`, `apiKey` y `env`.

## Modo remoto

- La instalacion y las actualizaciones de configuracion ocurren en el host del Gateway (no en el Mac local).
