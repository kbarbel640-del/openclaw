---
summary: "Referencia de CLI para `openclaw memory` (estado/indexar/buscar)"
read_when:
  - Quiere indexar o buscar memoria semántica
  - Está depurando la disponibilidad de memoria o la indexación
title: "memory"
x-i18n:
  source_path: cli/memory.md
  source_hash: 95a9e94306f95be2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:16Z
---

# `openclaw memory`

Gestiona la indexación y búsqueda de memoria semántica.
Proporcionado por el plugin de memoria activo (predeterminado: `memory-core`; configure `plugins.slots.memory = "none"` para deshabilitarlo).

Relacionado:

- Concepto de memoria: [Memory](/concepts/memory)
- Plugins: [Plugins](/plugins)

## Ejemplos

```bash
openclaw memory status
openclaw memory status --deep
openclaw memory status --deep --index
openclaw memory status --deep --index --verbose
openclaw memory index
openclaw memory index --verbose
openclaw memory search "release checklist"
openclaw memory status --agent main
openclaw memory index --agent main --verbose
```

## Opciones

Comunes:

- `--agent <id>`: delimita el alcance a un solo agente (predeterminado: todos los agentes configurados).
- `--verbose`: emite registros detallados durante las comprobaciones y la indexación.

Notas:

- `memory status --deep` verifica la disponibilidad de vectores + embeddings.
- `memory status --deep --index` ejecuta una reindexación si el almacén está sucio.
- `memory index --verbose` imprime detalles por fase (proveedor, modelo, fuentes, actividad por lotes).
- `memory status` incluye cualquier ruta adicional configurada mediante `memorySearch.extraPaths`.
