---
summary: "Validación estricta de configuracion + migraciones solo con doctor"
read_when:
  - Diseño o implementacion del comportamiento de validacion de configuracion
  - Trabajo en migraciones de configuracion o flujos de doctor
  - Manejo de esquemas de configuracion de plugins o control de carga de plugins
title: "Validacion estricta de configuracion"
x-i18n:
  source_path: refactor/strict-config.md
  source_hash: 5bc7174a67d2234e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:50Z
---

# Validacion estricta de configuracion (migraciones solo con doctor)

## Objetivos

- **Rechazar claves de configuracion desconocidas en todas partes** (raíz + anidadas).
- **Rechazar configuracion de plugins sin un esquema**; no cargar ese plugin.
- **Eliminar la auto-migracion heredada al cargar**; las migraciones se ejecutan solo mediante doctor.
- **Ejecutar doctor automaticamente (dry-run) al inicio**; si es invalida, bloquear comandos no diagnosticos.

## No objetivos

- Compatibilidad hacia atras al cargar (las claves heredadas no se auto-migran).
- Eliminacion silenciosa de claves no reconocidas.

## Reglas de validacion estricta

- La configuracion debe coincidir exactamente con el esquema en todos los niveles.
- Las claves desconocidas son errores de validacion (sin passthrough en raiz ni anidadas).
- `plugins.entries.<id>.config` debe validarse mediante el esquema del plugin.
  - Si un plugin carece de un esquema, **rechazar la carga del plugin** y mostrar un error claro.
- Las claves `channels.<id>` desconocidas son errores a menos que un manifiesto de plugin declare el id del canal.
- Los manifiestos de plugin (`openclaw.plugin.json`) son obligatorios para todos los plugins.

## Aplicacion de esquemas de plugins

- Cada plugin proporciona un Esquema JSON estricto para su configuracion (en linea en el manifiesto).
- Flujo de carga del plugin:
  1. Resolver manifiesto del plugin + esquema (`openclaw.plugin.json`).
  2. Validar la configuracion contra el esquema.
  3. Si falta el esquema o la configuracion es invalida: bloquear la carga del plugin y registrar el error.
- El mensaje de error incluye:
  - Id del plugin
  - Motivo (esquema faltante / configuracion invalida)
  - Ruta(s) que fallaron la validacion
- Los plugins deshabilitados conservan su configuracion, pero Doctor + los logs muestran una advertencia.

## Flujo de Doctor

- Doctor se ejecuta **cada vez** que se carga la configuracion (dry-run por defecto).
- Si la configuracion es invalida:
  - Imprimir un resumen + errores accionables.
  - Instruir: `openclaw doctor --fix`.
- `openclaw doctor --fix`:
  - Aplica migraciones.
  - Elimina claves desconocidas.
  - Escribe la configuracion actualizada.

## Control de comandos (cuando la configuracion es invalida)

Permitidos (solo diagnostico):

- `openclaw doctor`
- `openclaw logs`
- `openclaw health`
- `openclaw help`
- `openclaw status`
- `openclaw gateway status`

Todo lo demas debe fallar de forma estricta con: “Configuracion invalida. Ejecute `openclaw doctor --fix`.”

## Formato de UX de errores

- Un solo encabezado de resumen.
- Secciones agrupadas:
  - Claves desconocidas (rutas completas)
  - Claves heredadas / migraciones necesarias
  - Fallas de carga de plugins (id del plugin + motivo + ruta)

## Puntos de contacto de implementacion

- `src/config/zod-schema.ts`: eliminar passthrough en la raiz; objetos estrictos en todas partes.
- `src/config/zod-schema.providers.ts`: asegurar esquemas estrictos de canales.
- `src/config/validation.ts`: fallar ante claves desconocidas; no aplicar migraciones heredadas.
- `src/config/io.ts`: eliminar auto-migraciones heredadas; ejecutar siempre doctor en dry-run.
- `src/config/legacy*.ts`: mover el uso solo a doctor.
- `src/plugins/*`: agregar registro de esquemas + control.
- Control de comandos de la CLI en `src/cli`.

## Pruebas

- Rechazo de claves desconocidas (raiz + anidadas).
- Plugin sin esquema → carga del plugin bloqueada con error claro.
- Configuracion invalida → inicio del Gateway bloqueado excepto comandos de diagnostico.
- Doctor en dry-run automatico; `doctor --fix` escribe la configuracion corregida.
