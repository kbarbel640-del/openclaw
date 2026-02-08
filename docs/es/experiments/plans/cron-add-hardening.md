---
summary: "Endurecer el manejo de entradas de cron.add, alinear esquemas y mejorar las herramientas de UI/agente de cron"
owner: "openclaw"
status: "complete"
last_updated: "2026-01-05"
title: "Endurecimiento de Cron Add"
x-i18n:
  source_path: experiments/plans/cron-add-hardening.md
  source_hash: d7e469674bd9435b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:50Z
---

# Endurecimiento de Cron Add y Alineacion de Esquemas

## Contexto

Los registros recientes del Gateway muestran fallas repetidas de `cron.add` con parametros invalidos (faltan `sessionTarget`, `wakeMode`, `payload` y `schedule` malformado). Esto indica que al menos un cliente (probablemente la ruta de llamada de la herramienta del agente) esta enviando cargas de trabajo envueltas o parcialmente especificadas. Por separado, hay divergencia entre los enums del proveedor de cron en TypeScript, el esquema del Gateway, las banderas del CLI y los tipos de formularios de la UI, ademas de una discrepancia en la UI para `cron.status` (espera `jobCount` mientras que el Gateway devuelve `jobs`).

## Objetivos

- Detener el spam de `cron.add` INVALID_REQUEST normalizando cargas envueltas comunes e infiriendo campos `kind` faltantes.
- Alinear las listas de proveedores de cron en el esquema del Gateway, tipos de cron, documentacion del CLI y formularios de la UI.
- Hacer explicito el esquema de la herramienta de cron del agente para que el LLM produzca cargas de trabajo correctas.
- Corregir la visualizacion del conteo de trabajos del estado de cron en la UI de Control.
- Agregar pruebas para cubrir la normalizacion y el comportamiento de la herramienta.

## No objetivos

- Cambiar la semantica de programacion de cron o el comportamiento de ejecucion de trabajos.
- Agregar nuevos tipos de programacion o analisis de expresiones cron.
- Renovar la UI/UX de cron mas alla de las correcciones de campos necesarias.

## Hallazgos (brechas actuales)

- `CronPayloadSchema` en el Gateway excluye `signal` + `imessage`, mientras que los tipos de TS los incluyen.
- CronStatus de la UI de Control espera `jobCount`, pero el Gateway devuelve `jobs`.
- El esquema de la herramienta de cron del agente permite objetos `job` arbitrarios, lo que habilita entradas malformadas.
- El Gateway valida estrictamente `cron.add` sin normalizacion, por lo que las cargas envueltas fallan.

## Que cambio

- `cron.add` y `cron.update` ahora normalizan formas de envoltura comunes e infieren campos `kind` faltantes.
- El esquema de la herramienta de cron del agente coincide con el esquema del Gateway, lo que reduce las cargas invalidas.
- Los enums de proveedores estan alineados entre el Gateway, el CLI, la UI y el selector de macOS.
- La UI de Control usa el campo de conteo `jobs` del Gateway para el estado.

## Comportamiento actual

- **Normalizacion:** las cargas envueltas `data`/`job` se desempaquetan; `schedule.kind` y `payload.kind` se infieren cuando es seguro.
- **Valores predeterminados:** se aplican valores predeterminados seguros para `wakeMode` y `sessionTarget` cuando faltan.
- **Proveedores:** Discord/Slack/Signal/iMessage ahora se muestran de forma consistente en CLI/UI.

Consulte [Cron jobs](/automation/cron-jobs) para la forma normalizada y ejemplos.

## Verificacion

- Observe los registros del Gateway para una reduccion de errores `cron.add` INVALID_REQUEST.
- Confirme que el estado de cron en la UI de Control muestre el conteo de trabajos despues de refrescar.

## Seguimientos opcionales

- Prueba manual de la UI de Control: agregue un trabajo de cron por proveedor + verifique el conteo de trabajos de estado.

## Preguntas abiertas

- ¿Deberia `cron.add` aceptar `state` explicito de los clientes (actualmente no permitido por el esquema)?
- ¿Deberíamos permitir `webchat` como proveedor de entrega explicito (actualmente filtrado en la resolucion de entrega)?
