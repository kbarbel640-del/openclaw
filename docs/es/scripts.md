---
summary: "Scripts del repositorio: proposito, alcance y notas de seguridad"
read_when:
  - Al ejecutar scripts desde el repositorio
  - Al agregar o cambiar scripts en ./scripts
title: "Scripts"
x-i18n:
  source_path: scripts.md
  source_hash: efd220df28f20b33
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:57Z
---

# Scripts

El directorio `scripts/` contiene scripts auxiliares para flujos de trabajo locales y tareas operativas.
Utilice estos cuando una tarea este claramente vinculada a un script; de lo contrario, prefiera la CLI.

## Convenciones

- Los scripts son **opcionales** a menos que se referencien en la documentacion o en listas de verificacion de lanzamiento.
- Prefiera las superficies de la CLI cuando existan (ejemplo: el monitoreo de autenticacion usa `openclaw models status --check`).
- Asuma que los scripts son especificos del host; lealos antes de ejecutarlos en una maquina nueva.

## Scripts de monitoreo de autenticacion

Los scripts de monitoreo de autenticacion se documentan aqui:
[/automation/auth-monitoring](/automation/auth-monitoring)

## Al agregar scripts

- Mantenga los scripts enfocados y documentados.
- Agregue una entrada corta en el documento relevante (o cree uno si falta).
