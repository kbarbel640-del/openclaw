---
summary: "Notas del protocolo RPC para el asistente de incorporacion y el esquema de configuracion"
read_when: "Al cambiar los pasos del asistente de incorporacion o los endpoints del esquema de configuracion"
title: "Protocolo de Incorporacion y Configuracion"
x-i18n:
  source_path: experiments/onboarding-config-protocol.md
  source_hash: 55163b3ee029c024
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:46Z
---

# Protocolo de Incorporacion + Configuracion

Proposito: superficies compartidas de incorporacion + configuracion en CLI, app de macOS y la Interfaz web.

## Componentes

- Motor del asistente (sesion compartida + indicaciones + estado de incorporacion).
- La incorporacion en CLI usa el mismo flujo del asistente que los clientes de UI.
- El Gateway RPC expone endpoints del asistente + del esquema de configuracion.
- La incorporacion en macOS usa el modelo de pasos del asistente.
- La Interfaz web renderiza formularios de configuracion a partir de JSON Schema + pistas de UI.

## Gateway RPC

- `wizard.start` parametros: `{ mode?: "local"|"remote", workspace?: string }`
- `wizard.next` parametros: `{ sessionId, answer?: { stepId, value? } }`
- `wizard.cancel` parametros: `{ sessionId }`
- `wizard.status` parametros: `{ sessionId }`
- `config.schema` parametros: `{}`

Respuestas (estructura)

- Asistente: `{ sessionId, done, step?, status?, error? }`
- Esquema de configuracion: `{ schema, uiHints, version, generatedAt }`

## Pistas de UI

- `uiHints` con clave por ruta; metadatos opcionales (label/help/group/order/advanced/sensitive/placeholder).
- Los campos sensibles se renderizan como entradas de contrasena; no hay capa de redaccion.
- Los nodos de esquema no compatibles recurren al editor JSON sin procesar.

## Notas

- Este documento es el unico lugar para dar seguimiento a refactorizaciones del protocolo de incorporacion/configuracion.
