---
summary: "Ventana de contexto + compactación: cómo OpenClaw mantiene las sesiones dentro de los límites del modelo"
read_when:
  - Quiere comprender la auto-compactación y /compact
  - Está depurando sesiones largas que alcanzan los límites de contexto
title: "Compactación"
x-i18n:
  source_path: concepts/compaction.md
  source_hash: e1d6791f2902044b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:26Z
---

# Ventana de contexto y compactación

Cada modelo tiene una **ventana de contexto** (máximo de tokens que puede ver). Los chats de larga duración acumulan mensajes y resultados de herramientas; cuando la ventana se ajusta, OpenClaw **compacta** el historial antiguo para mantenerse dentro de los límites.

## Qué es la compactación

La compactación **resume conversaciones antiguas** en una entrada de resumen compacta y mantiene intactos los mensajes recientes. El resumen se almacena en el historial de la sesión, por lo que las solicitudes futuras usan:

- El resumen de compactación
- Los mensajes recientes posteriores al punto de compactación

La compactación **persiste** en el historial JSONL de la sesión.

## Configuración

Consulte [Configuración y modos de compactación](/concepts/compaction) para los ajustes `agents.defaults.compaction`.

## Auto-compactación (activada por defecto)

Cuando una sesión se acerca o supera la ventana de contexto del modelo, OpenClaw activa la auto-compactación y puede reintentar la solicitud original usando el contexto compactado.

Verá:

- `🧹 Auto-compaction complete` en modo detallado
- `/status` mostrando `🧹 Compactions: <count>`

Antes de la compactación, OpenClaw puede ejecutar un turno de **vaciado silencioso de memoria** para almacenar notas duraderas en disco. Consulte [Memoria](/concepts/memory) para detalles y configuración.

## Compactación manual

Use `/compact` (opcionalmente con instrucciones) para forzar una pasada de compactación:

```
/compact Focus on decisions and open questions
```

## Origen de la ventana de contexto

La ventana de contexto es específica del modelo. OpenClaw usa la definición del modelo del catálogo del proveedor configurado para determinar los límites.

## Compactación vs poda

- **Compactación**: resume y **persiste** en JSONL.
- **Poda de sesión**: recorta solo **resultados de herramientas**, **en memoria**, por solicitud.

Consulte [/concepts/session-pruning](/concepts/session-pruning) para detalles sobre la poda.

## Consejos

- Use `/compact` cuando las sesiones se sientan obsoletas o el contexto esté inflado.
- Las salidas grandes de herramientas ya se truncan; la poda puede reducir aún más la acumulación de resultados de herramientas.
- Si necesita empezar desde cero, `/new` o `/reset` inicia un nuevo id de sesión.
