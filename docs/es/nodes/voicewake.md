---
summary: "Palabras de activación por voz globales (propiedad del Gateway) y cómo se sincronizan entre nodos"
read_when:
  - Cambiar el comportamiento o los valores predeterminados de las palabras de activación por voz
  - Agregar nuevas plataformas de nodos que necesiten sincronización de palabras de activación
title: "Activación por Voz"
x-i18n:
  source_path: nodes/voicewake.md
  source_hash: eb34f52dfcdc3fc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:19Z
---

# Activación por Voz (Palabras de Activación Globales)

OpenClaw trata las **palabras de activación como una única lista global** propiedad del **Gateway**.

- **No existen palabras de activación personalizadas por nodo**.
- **Cualquier UI de nodo/app puede editar** la lista; los cambios son persistidos por el Gateway y difundidos a todos.
- Cada dispositivo aún mantiene su propio interruptor de **Activación por Voz habilitada/deshabilitada** (la UX local + los permisos difieren).

## Almacenamiento (host del Gateway)

Las palabras de activación se almacenan en la máquina del gateway en:

- `~/.openclaw/settings/voicewake.json`

Estructura:

```json
{ "triggers": ["openclaw", "claude", "computer"], "updatedAtMs": 1730000000000 }
```

## Protocolo

### Métodos

- `voicewake.get` → `{ triggers: string[] }`
- `voicewake.set` con parámetros `{ triggers: string[] }` → `{ triggers: string[] }`

Notas:

- Los disparadores se normalizan (se recortan, se eliminan los vacíos). Las listas vacías vuelven a los valores predeterminados.
- Se aplican límites por seguridad (topes de cantidad/longitud).

### Eventos

- `voicewake.changed` carga útil `{ triggers: string[] }`

Quién lo recibe:

- Todos los clientes WebSocket (app de macOS, WebChat, etc.).
- Todos los nodos conectados (iOS/Android), y también al conectar un nodo como un envío inicial del “estado actual”.

## Comportamiento del cliente

### App de macOS

- Usa la lista global para filtrar los disparadores `VoiceWakeRuntime`.
- Editar “Palabras de activación” en los ajustes de Activación por Voz llama a `voicewake.set` y luego confía en la difusión para mantener a otros clientes sincronizados.

### Nodo iOS

- Usa la lista global para la detección de disparadores `VoiceWakeManager`.
- Editar Palabras de Activación en Ajustes llama a `voicewake.set` (sobre el WS del Gateway) y también mantiene reactiva la detección local de palabras de activación.

### Nodo Android

- Expone un editor de Palabras de Activación en Ajustes.
- Llama a `voicewake.set` sobre el WS del Gateway para que las ediciones se sincronicen en todas partes.
