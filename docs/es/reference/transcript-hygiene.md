---
summary: "Referencia: reglas de saneamiento y reparacion de transcripciones especificas del proveedor"
read_when:
  - Usted esta depurando rechazos de solicitudes del proveedor vinculados a la forma de la transcripcion
  - Usted esta cambiando la logica de saneamiento de transcripciones o de reparacion de llamadas a herramientas
  - Usted esta investigando desajustes de id de llamadas a herramientas entre proveedores
title: "Higiene de Transcripciones"
x-i18n:
  source_path: reference/transcript-hygiene.md
  source_hash: 43ed460827d514a8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:03Z
---

# Higiene de Transcripciones (Correcciones por Proveedor)

Este documento describe **correcciones especificas del proveedor** aplicadas a las transcripciones antes de una ejecucion
(construccion del contexto del modelo). Estos son ajustes **en memoria** usados para cumplir requisitos estrictos
del proveedor. Estos pasos de higiene **no** reescriben la transcripcion JSONL almacenada en disco; sin embargo,
un pase separado de reparacion de archivos de sesion puede reescribir archivos JSONL malformados eliminando
lineas invalidas antes de que se cargue la sesion. Cuando ocurre una reparacion, el archivo original se respalda
junto al archivo de sesion.

El alcance incluye:

- Saneamiento de id de llamadas a herramientas
- Validacion de entradas de llamadas a herramientas
- Reparacion del emparejamiento de resultados de herramientas
- Validacion/ordenamiento de turnos
- Limpieza de firmas de pensamiento
- Saneamiento de cargas de imagen

Si necesita detalles sobre el almacenamiento de transcripciones, consulte:

- [/reference/session-management-compaction](/reference/session-management-compaction)

---

## Donde se ejecuta

Toda la higiene de transcripciones esta centralizada en el runner integrado:

- Seleccion de politica: `src/agents/transcript-policy.ts`
- Aplicacion de saneamiento/reparacion: `sanitizeSessionHistory` en `src/agents/pi-embedded-runner/google.ts`

La politica usa `provider`, `modelApi` y `modelId` para decidir que aplicar.

Separado de la higiene de transcripciones, los archivos de sesion se reparan (si es necesario) antes de la carga:

- `repairSessionFileIfNeeded` en `src/agents/session-file-repair.ts`
- Llamado desde `run/attempt.ts` y `compact.ts` (runner integrado)

---

## Regla global: saneamiento de imagenes

Las cargas de imagen siempre se saneean para prevenir rechazos del lado del proveedor debido a limites
de tamano (reducir escala/recomprimir imagenes base64 sobredimensionadas).

Implementacion:

- `sanitizeSessionMessagesImages` en `src/agents/pi-embedded-helpers/images.ts`
- `sanitizeContentBlocksImages` en `src/agents/tool-images.ts`

---

## Regla global: llamadas a herramientas malformadas

Los bloques de llamadas a herramientas del asistente que carecen de ambos `input` y `arguments` se eliminan
antes de que se construya el contexto del modelo. Esto previene rechazos del proveedor por llamadas a herramientas
parcialmente persistidas (por ejemplo, despues de una falla por limite de tasa).

Implementacion:

- `sanitizeToolCallInputs` en `src/agents/session-transcript-repair.ts`
- Aplicado en `sanitizeSessionHistory` en `src/agents/pi-embedded-runner/google.ts`

---

## Matriz de proveedores (comportamiento actual)

**OpenAI / OpenAI Codex**

- Solo saneamiento de imagenes.
- Al cambiar el modelo a OpenAI Responses/Codex, eliminar firmas de razonamiento huerfanas (elementos de razonamiento independientes sin un bloque de contenido posterior).
- Sin saneamiento de id de llamadas a herramientas.
- Sin reparacion del emparejamiento de resultados de herramientas.
- Sin validacion ni reordenamiento de turnos.
- Sin resultados de herramientas sinteticos.
- Sin eliminacion de firmas de pensamiento.

**Google (Generative AI / Gemini CLI / Antigravity)**

- Saneamiento de id de llamadas a herramientas: alfanumerico estricto.
- Reparacion del emparejamiento de resultados de herramientas y resultados de herramientas sinteticos.
- Validacion de turnos (alternancia de turnos al estilo Gemini).
- Correccion del orden de turnos de Google (anteponer un pequeno bootstrap de usuario si el historial comienza con el asistente).
- Antigravity Claude: normalizar firmas de pensamiento; eliminar bloques de pensamiento sin firma.

**Anthropic / Minimax (compatible con Anthropic)**

- Reparacion del emparejamiento de resultados de herramientas y resultados de herramientas sinteticos.
- Validacion de turnos (fusionar turnos consecutivos de usuario para cumplir la alternancia estricta).

**Mistral (incluida la deteccion basada en id de modelo)**

- Saneamiento de id de llamadas a herramientas: strict9 (alfanumerico de longitud 9).

**OpenRouter Gemini**

- Limpieza de firmas de pensamiento: eliminar valores `thought_signature` que no sean base64 (conservar base64).

**Todo lo demas**

- Solo saneamiento de imagenes.

---

## Comportamiento historico (pre-2026.1.22)

Antes de la version 2026.1.22, OpenClaw aplicaba multiples capas de higiene de transcripciones:

- Una **extension de saneamiento de transcripciones** se ejecutaba en cada construccion de contexto y podia:
  - Reparar el emparejamiento de uso/resultado de herramientas.
  - Sanear id de llamadas a herramientas (incluido un modo no estricto que preservaba `_`/`-`).
- El runner tambien realizaba saneamiento especifico del proveedor, lo que duplicaba trabajo.
- Ocurrían mutaciones adicionales fuera de la politica del proveedor, incluidas:
  - Eliminar etiquetas `<final>` del texto del asistente antes de la persistencia.
  - Eliminar turnos de error vacios del asistente.
  - Recortar el contenido del asistente despues de llamadas a herramientas.

Esta complejidad causo regresiones entre proveedores (notablemente el emparejamiento `openai-responses`
`call_id|fc_id`). La limpieza de 2026.1.22 elimino la extension, centralizo
la logica en el runner y dejo a OpenAI como **sin intervencion** mas alla del saneamiento de imagenes.
