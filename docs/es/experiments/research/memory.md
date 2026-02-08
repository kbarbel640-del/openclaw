---
summary: "Notas de investigación: sistema de memoria offline para espacios de trabajo de Clawd (Markdown como fuente de verdad + índice derivado)"
read_when:
  - Diseño de la memoria del espacio de trabajo (~/.openclaw/workspace) más allá de los registros diarios en Markdown
  - Decidir: CLI independiente vs integración profunda con OpenClaw
  - Agregar recuperación y reflexión offline (retener/recordar/reflexionar)
title: "Investigación de Memoria del Espacio de Trabajo"
x-i18n:
  source_path: experiments/research/memory.md
  source_hash: 1753c8ee6284999f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:01Z
---

# Memoria del Espacio de Trabajo v2 (offline): notas de investigación

Objetivo: espacio de trabajo estilo Clawd (`agents.defaults.workspace`, por defecto `~/.openclaw/workspace`) donde la “memoria” se almacena como un archivo Markdown por día (`memory/YYYY-MM-DD.md`) más un pequeño conjunto de archivos estables (p. ej., `memory.md`, `SOUL.md`).

Este documento propone una arquitectura de memoria **offline-first** que mantiene Markdown como la fuente de verdad canónica y revisable por humanos, pero agrega **recuperación estructurada** (búsqueda, resúmenes de entidades, actualizaciones de confianza) mediante un índice derivado.

## ¿Por qué cambiar?

La configuración actual (un archivo por día) es excelente para:

- journaling de “solo anexar”
- edición humana
- durabilidad y auditabilidad respaldadas por git
- captura de baja fricción (“solo escríbalo”)

Es débil para:

- recuperación de alta recordación (“¿qué decidimos sobre X?”, “¿la última vez que intentamos Y?”)
- respuestas centradas en entidades (“cuéntame sobre Alice / The Castle / warelay”) sin releer muchos archivos
- estabilidad de opiniones/preferencias (y evidencia cuando cambia)
- restricciones temporales (“¿qué era cierto durante nov 2025?”) y resolución de conflictos

## Objetivos de diseño

- **Offline**: funciona sin red; puede ejecutarse en laptop/Castle; sin dependencia de la nube.
- **Explicable**: los elementos recuperados deben ser atribuibles (archivo + ubicación) y separables de la inferencia.
- **Baja ceremonia**: el registro diario sigue siendo Markdown, sin esquemas pesados.
- **Incremental**: v1 es útil solo con FTS; lo semántico/vectorial y grafos son mejoras opcionales.
- **Amigable para agentes**: facilita la “recuperación dentro de presupuestos de tokens” (devolver pequeños paquetes de hechos).

## Modelo norte (Hindsight × Letta)

Dos piezas a combinar:

1. **Bucle de control estilo Letta/MemGPT**

- mantener un “núcleo” pequeño siempre en contexto (persona + hechos clave del usuario)
- todo lo demás está fuera de contexto y se recupera mediante herramientas
- las escrituras de memoria son llamadas explícitas a herramientas (anexar/reemplazar/insertar), se persisten y luego se reinyectan en el siguiente turno

2. **Sustrato de memoria estilo Hindsight**

- separar lo observado vs lo creído vs lo resumido
- soportar retener/recordar/reflexionar
- opiniones con confianza que pueden evolucionar con evidencia
- recuperación consciente de entidades + consultas temporales (incluso sin grafos de conocimiento completos)

## Arquitectura propuesta (Markdown como fuente de verdad + índice derivado)

### Almacén canónico (amigable con git)

Mantener `~/.openclaw/workspace` como memoria canónica legible por humanos.

Diseño sugerido del espacio de trabajo:

```
~/.openclaw/workspace/
  memory.md                    # small: durable facts + preferences (core-ish)
  memory/
    YYYY-MM-DD.md              # daily log (append; narrative)
  bank/                        # “typed” memory pages (stable, reviewable)
    world.md                   # objective facts about the world
    experience.md              # what the agent did (first-person)
    opinions.md                # subjective prefs/judgments + confidence + evidence pointers
    entities/
      Peter.md
      The-Castle.md
      warelay.md
      ...
```

Notas:

- **El registro diario sigue siendo registro diario**. No es necesario convertirlo a JSON.
- Los archivos `bank/` son **curados**, producidos por trabajos de reflexión, y aún pueden editarse a mano.
- `memory.md` permanece “pequeño + tipo núcleo”: las cosas que quiere que Clawd vea en cada sesión.

### Almacén derivado (recuperación por máquina)

Agregar un índice derivado bajo el espacio de trabajo (no necesariamente seguido por git):

```
~/.openclaw/workspace/.memory/index.sqlite
```

Respaldarlo con:

- Esquema SQLite para hechos + enlaces de entidades + metadatos de opiniones
- SQLite **FTS5** para recuperación léxica (rápida, pequeña, offline)
- tabla opcional de embeddings para recuperación semántica (aún offline)

El índice siempre es **reconstruible a partir de Markdown**.

## Retener / Recordar / Reflexionar (bucle operativo)

### Retener: normalizar registros diarios en “hechos”

La idea clave de Hindsight que importa aquí: almacenar **hechos narrativos y autocontenidos**, no fragmentos diminutos.

Regla práctica para `memory/YYYY-MM-DD.md`:

- al final del día (o durante), agregue una sección `## Retain` con 2–5 viñetas que sean:
  - narrativas (se preserva el contexto entre turnos)
  - autocontenidas (tienen sentido por sí solas más adelante)
  - etiquetadas con tipo + menciones de entidades

Ejemplo:

```
## Retain
- W @Peter: Currently in Marrakech (Nov 27–Dec 1, 2025) for Andy’s birthday.
- B @warelay: I fixed the Baileys WS crash by wrapping connection.update handlers in try/catch (see memory/2025-11-27.md).
- O(c=0.95) @Peter: Prefers concise replies (&lt;1500 chars) on WhatsApp; long content goes into files.
```

Análisis mínimo:

- Prefijo de tipo: `W` (mundo), `B` (experiencia/biográfico), `O` (opinión), `S` (observación/resumen; generalmente generado)
- Entidades: `@Peter`, `@warelay`, etc. (los slugs mapean a `bank/entities/*.md`)
- Confianza de opinión: `O(c=0.0..1.0)` opcional

Si no quiere que los autores piensen en esto: el trabajo de reflexión puede inferir estas viñetas a partir del resto del registro, pero tener una sección explícita `## Retain` es la “palanca de calidad” más fácil.

### Recordar: consultas sobre el índice derivado

La recuperación debe soportar:

- **léxica**: “encontrar términos/nombres/comandos exactos” (FTS5)
- **por entidad**: “cuéntame sobre X” (páginas de entidades + hechos enlazados a entidades)
- **temporal**: “qué pasó alrededor del 27 de nov” / “desde la semana pasada”
- **opinión**: “¿qué prefiere Peter?” (con confianza + evidencia)

El formato de retorno debe ser amigable para agentes y citar fuentes:

- `kind` (`world|experience|opinion|observation`)
- `timestamp` (día de origen, o rango de tiempo extraído si está presente)
- `entities` (`["Peter","warelay"]`)
- `content` (el hecho narrativo)
- `source` (`memory/2025-11-27.md#L12` etc.)

### Reflexionar: producir páginas estables + actualizar creencias

La reflexión es un trabajo programado (diario o latido `ultrathink`) que:

- actualiza `bank/entities/*.md` a partir de hechos recientes (resúmenes de entidades)
- actualiza la confianza de `bank/opinions.md` según refuerzo/contradicción
- opcionalmente propone ediciones a `memory.md` (hechos durables “tipo núcleo”)

Evolución de opiniones (simple, explicable):

- cada opinión tiene:
  - enunciado
  - confianza `c ∈ [0,1]`
  - last_updated
  - enlaces de evidencia (IDs de hechos que apoyan + contradicen)
- cuando llegan nuevos hechos:
  - encontrar opiniones candidatas por solapamiento de entidades + similitud (FTS primero, embeddings después)
  - actualizar la confianza con pequeños deltas; los saltos grandes requieren contradicción fuerte + evidencia repetida

## Integración CLI: independiente vs integración profunda

Recomendación: **integración profunda en OpenClaw**, pero mantener una biblioteca central separable.

### ¿Por qué integrar en OpenClaw?

- OpenClaw ya conoce:
  - la ruta del espacio de trabajo (`agents.defaults.workspace`)
  - el modelo de sesión + latidos
  - patrones de logging + solucion de problemas
- Quiere que el propio agente llame a las herramientas:
  - `openclaw memory recall "…" --k 25 --since 30d`
  - `openclaw memory reflect --since 7d`

### ¿Por qué aun así separar una biblioteca?

- mantener la lógica de memoria testeable sin gateway/runtime
- reutilizar desde otros contextos (scripts locales, futura app de escritorio, etc.)

Forma:
La herramienta de memoria pretende ser una pequeña CLI + capa de biblioteca, pero esto es solo exploratorio.

## “S-Collide” / SuCo: cuándo usarlo (investigación)

Si “S-Collide” se refiere a **SuCo (Subspace Collision)**: es un enfoque de recuperación ANN que apunta a fuertes compromisos de recordación/latencia usando colisiones aprendidas/estructuradas en subespacios (artículo: arXiv 2411.14754, 2024).

Enfoque pragmático para `~/.openclaw/workspace`:

- **no empezar** con SuCo.
- empezar con SQLite FTS + (opcional) embeddings simples; obtendrá la mayoría de las mejoras de UX de inmediato.
- considerar soluciones tipo SuCo/HNSW/ScaNN solo cuando:
  - el corpus sea grande (decenas/cientos de miles de fragmentos)
  - la búsqueda de embeddings por fuerza bruta se vuelva demasiado lenta
  - la calidad de recuperación esté significativamente limitada por la búsqueda léxica

Alternativas amigables con offline (en complejidad creciente):

- SQLite FTS5 + filtros de metadatos (cero ML)
- Embeddings + fuerza bruta (funciona sorprendentemente lejos si el conteo de fragmentos es bajo)
- Índice HNSW (común, robusto; requiere un binding de biblioteca)
- SuCo (nivel investigación; atractivo si hay una implementación sólida que pueda integrar)

Pregunta abierta:

- ¿cuál es el **mejor** modelo de embeddings offline para “memoria de asistente personal” en sus máquinas (laptop + desktop)?
  - si ya tiene Ollama: embeba con un modelo local; de lo contrario, incluya un pequeño modelo de embeddings en la cadena de herramientas.

## Piloto útil más pequeño

Si quiere una versión mínima, aún útil:

- Agregar páginas de entidad `bank/` y una sección `## Retain` en los registros diarios.
- Usar SQLite FTS para recuperación con citas (ruta + números de línea).
- Agregar embeddings solo si la calidad de recuperación o la escala lo exigen.

## Referencias

- Conceptos de Letta / MemGPT: “bloques de memoria núcleo” + “memoria archivada” + memoria autoeditable impulsada por herramientas.
- Informe Técnico de Hindsight: “retener / recordar / reflexionar”, memoria de cuatro redes, extracción de hechos narrativos, evolución de la confianza de opiniones.
- SuCo: arXiv 2411.14754 (2024): recuperación aproximada de vecinos más cercanos “Subspace Collision”.
