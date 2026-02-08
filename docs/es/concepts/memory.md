---
summary: "Cómo funciona la memoria de OpenClaw (archivos del espacio de trabajo + vaciado automático de memoria)"
read_when:
  - Desea el diseño de archivos de memoria y el flujo de trabajo
  - Desea ajustar el vaciado automático de memoria previo a la compactación
x-i18n:
  source_path: concepts/memory.md
  source_hash: 5fe705d89fb30998
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:05Z
---

# Memoria

La memoria de OpenClaw es **Markdown plano en el espacio de trabajo del agente**. Los archivos son la
fuente de verdad; el modelo solo “recuerda” lo que se escribe en el disco.

Las herramientas de búsqueda de memoria las proporciona el plugin de memoria activo (predeterminado:
`memory-core`). Desactive los plugins de memoria con `plugins.slots.memory = "none"`.

## Archivos de memoria (Markdown)

El diseño predeterminado del espacio de trabajo usa dos capas de memoria:

- `memory/YYYY-MM-DD.md`
  - Registro diario (solo anexar).
  - Se lee hoy + ayer al inicio de la sesión.
- `MEMORY.md` (opcional)
  - Memoria curada a largo plazo.
  - **Solo se carga en la sesión principal y privada** (nunca en contextos grupales).

Estos archivos viven bajo el espacio de trabajo (`agents.defaults.workspace`, predeterminado
`~/.openclaw/workspace`). Consulte [Espacio de trabajo del agente](/concepts/agent-workspace) para el diseño completo.

## Cuándo escribir memoria

- Las decisiones, preferencias y hechos duraderos van a `MEMORY.md`.
- Las notas del día a día y el contexto en curso van a `memory/YYYY-MM-DD.md`.
- Si alguien dice “recuerda esto”, escríbalo (no lo mantenga en RAM).
- Esta área aún está evolucionando. Ayuda recordarle al modelo que almacene memorias; sabrá qué hacer.
- Si quiere que algo perdure, **pídale al bot que lo escriba** en la memoria.

## Vaciado automático de memoria (ping previo a la compactación)

Cuando una sesión está **cerca de la auto-compactación**, OpenClaw activa un **turno silencioso y agéntico**
que recuerda al modelo escribir memoria duradera **antes** de que el contexto sea compactado. Los mensajes
predeterminados dicen explícitamente que el modelo _puede responder_, pero normalmente `NO_REPLY` es la
respuesta correcta para que el usuario nunca vea este turno.

Esto se controla con `agents.defaults.compaction.memoryFlush`:

```json5
{
  agents: {
    defaults: {
      compaction: {
        reserveTokensFloor: 20000,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000,
          systemPrompt: "Session nearing compaction. Store durable memories now.",
          prompt: "Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store.",
        },
      },
    },
  },
}
```

Detalles:

- **Umbral suave**: el vaciado se activa cuando la estimación de tokens de la sesión cruza
  `contextWindow - reserveTokensFloor - softThresholdTokens`.
- **Silencioso** por defecto: los mensajes incluyen `NO_REPLY` para que no se entregue nada.
- **Dos mensajes**: un mensaje de usuario más un mensaje del sistema agregan el recordatorio.
- **Un vaciado por ciclo de compactación** (seguido en `sessions.json`).
- **El espacio de trabajo debe ser escribible**: si la sesión se ejecuta en sandbox con
  `workspaceAccess: "ro"` o `"none"`, el vaciado se omite.

Para el ciclo completo de compactación, consulte
[Gestión de sesiones + compactación](/reference/session-management-compaction).

## Búsqueda de memoria vectorial

OpenClaw puede construir un pequeño índice vectorial sobre `MEMORY.md` y `memory/*.md` para que
las consultas semánticas encuentren notas relacionadas incluso cuando la redacción difiere.

Valores predeterminados:

- Habilitada por defecto.
- Observa cambios en los archivos de memoria (con debounce).
- Usa embeddings remotos por defecto. Si `memorySearch.provider` no está configurado, OpenClaw selecciona automáticamente:
  1. `local` si se configura un `memorySearch.local.modelPath` y el archivo existe.
  2. `openai` si se puede resolver una clave de OpenAI.
  3. `gemini` si se puede resolver una clave de Gemini.
  4. De lo contrario, la búsqueda de memoria permanece deshabilitada hasta que se configure.
- El modo local usa node-llama-cpp y puede requerir `pnpm approve-builds`.
- Usa sqlite-vec (cuando está disponible) para acelerar la búsqueda vectorial dentro de SQLite.

Los embeddings remotos **requieren** una clave de API para el proveedor de embeddings. OpenClaw
resuelve claves desde perfiles de autenticación, `models.providers.*.apiKey` o variables de entorno.
Codex OAuth solo cubre chat/completions y **no** satisface embeddings para la búsqueda de memoria.
Para Gemini, use `GEMINI_API_KEY` o `models.providers.google.apiKey`. Al usar un endpoint compatible con OpenAI personalizado,
configure `memorySearch.remote.apiKey` (y opcional `memorySearch.remote.headers`).

### Backend QMD (experimental)

Configure `memory.backend = "qmd"` para intercambiar el indexador SQLite integrado por
[QMD](https://github.com/tobi/qmd): un sidecar de búsqueda local-first que combina
BM25 + vectores + re-ranking. Markdown sigue siendo la fuente de verdad; OpenClaw
invoca QMD para la recuperación. Puntos clave:

**Requisitos previos**

- Deshabilitado por defecto. Opte por usarlo por configuración (`memory.backend = "qmd"`).
- Instale el CLI de QMD por separado (`bun install -g github.com/tobi/qmd` o descargue
  una versión) y asegúrese de que el binario `qmd` esté en el `PATH` del gateway.
- QMD necesita una compilación de SQLite que permita extensiones (`brew install sqlite` en
  macOS).
- QMD se ejecuta completamente en local vía Bun + `node-llama-cpp` y descarga automáticamente modelos GGUF
  desde HuggingFace en el primer uso (no se requiere un daemon Ollama separado).
- El gateway ejecuta QMD en un hogar XDG autocontenido bajo
  `~/.openclaw/agents/<agentId>/qmd/` configurando `XDG_CONFIG_HOME` y
  `XDG_CACHE_HOME`.
- Compatibilidad de SO: macOS y Linux funcionan de inmediato una vez que Bun + SQLite están
  instalados. Windows se admite mejor vía WSL2.

**Cómo se ejecuta el sidecar**

- El gateway escribe un hogar QMD autocontenido bajo
  `~/.openclaw/agents/<agentId>/qmd/` (configuración + caché + BD sqlite).
- Las colecciones se reescriben desde `memory.qmd.paths` (más los archivos de memoria
  predeterminados del espacio de trabajo) en `index.yml`, luego `qmd update` + `qmd embed` se ejecutan al iniciar y
  en un intervalo configurable (`memory.qmd.update.interval`, predeterminado 5 m).
- Las búsquedas se ejecutan vía `qmd query --json`. Si QMD falla o falta el binario,
  OpenClaw vuelve automáticamente al gestor SQLite integrado para que las herramientas de memoria
  sigan funcionando.
- **La primera búsqueda puede ser lenta**: QMD puede descargar modelos GGUF locales (re-ranking/expansión de consulta)
  en la primera ejecución de `qmd query`.
  - OpenClaw configura `XDG_CONFIG_HOME`/`XDG_CACHE_HOME` automáticamente cuando ejecuta QMD.
  - Si desea predescargar modelos manualmente (y calentar el mismo índice que usa OpenClaw),
    ejecute una consulta puntual con los directorios XDG del agente.

    El estado QMD de OpenClaw vive bajo su **directorio de estado** (predeterminado `~/.openclaw`).
    Puede apuntar `qmd` exactamente al mismo índice exportando las mismas variables XDG
    que usa OpenClaw:

    ```bash
    # Pick the same state dir OpenClaw uses
    STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
    if [ -d "$HOME/.moltbot" ] && [ ! -d "$HOME/.openclaw" ] \
      && [ -z "${OPENCLAW_STATE_DIR:-}" ]; then
      STATE_DIR="$HOME/.moltbot"
    fi

    export XDG_CONFIG_HOME="$STATE_DIR/agents/main/qmd/xdg-config"
    export XDG_CACHE_HOME="$STATE_DIR/agents/main/qmd/xdg-cache"

    # (Optional) force an index refresh + embeddings
    qmd update
    qmd embed

    # Warm up / trigger first-time model downloads
    qmd query "test" -c memory-root --json >/dev/null 2>&1
    ```

**Superficie de configuración (`memory.qmd.*`)**

- `command` (predeterminado `qmd`): sobrescribe la ruta del ejecutable.
- `includeDefaultMemory` (predeterminado `true`): auto-indexa `MEMORY.md` + `memory/**/*.md`.
- `paths[]`: agregue directorios/archivos extra (`path`, opcional `pattern`, opcional
  estable `name`).
- `sessions`: optar por el indexado de JSONL de sesión (`enabled`, `retentionDays`,
  `exportDir`).
- `update`: controla la cadencia de actualización (`interval`, `debounceMs`, `onBoot`, `embedInterval`).
- `limits`: limita la carga útil de recuerdo (`maxResults`, `maxSnippetChars`,
  `maxInjectedChars`, `timeoutMs`).
- `scope`: mismo esquema que [`session.sendPolicy`](/gateway/configuration#session).
  El valor predeterminado es solo DM (`deny` todo, `allow` chats directos); relájelo para mostrar resultados de QMD
  en grupos/canales.
- Los fragmentos obtenidos fuera del espacio de trabajo aparecen como
  `qmd/<collection>/<relative-path>` en los resultados de `memory_search`; `memory_get`
  entiende ese prefijo y lee desde la raíz de colección QMD configurada.
- Cuando `memory.qmd.sessions.enabled = true`, OpenClaw exporta transcripciones de sesión saneadas
  (turnos Usuario/Asistente) a una colección QMD dedicada bajo
  `~/.openclaw/agents/<id>/qmd/sessions/`, para que `memory_search` pueda recordar conversaciones recientes
  sin tocar el índice SQLite integrado.
- Los fragmentos `memory_search` ahora incluyen un pie `Source: <path#line>` cuando
  `memory.citations` es `auto`/`on`; configure `memory.citations = "off"` para mantener
  la metainformación de ruta interna (el agente aún recibe la ruta para
  `memory_get`, pero el texto del fragmento omite el pie y el mensaje del sistema
  advierte al agente que no lo cite).

**Ejemplo**

```json5
memory: {
  backend: "qmd",
  citations: "auto",
  qmd: {
    includeDefaultMemory: true,
    update: { interval: "5m", debounceMs: 15000 },
    limits: { maxResults: 6, timeoutMs: 4000 },
    scope: {
      default: "deny",
      rules: [{ action: "allow", match: { chatType: "direct" } }]
    },
    paths: [
      { name: "docs", path: "~/notes", pattern: "**/*.md" }
    ]
  }
}
```

**Citas y fallback**

- `memory.citations` aplica independientemente del backend (`auto`/`on`/`off`).
- Cuando se ejecuta `qmd`, etiquetamos `status().backend = "qmd"` para que los diagnósticos muestren qué
  motor sirvió los resultados. Si el subproceso de QMD sale o la salida JSON no puede
  analizarse, el gestor de búsqueda registra una advertencia y devuelve el proveedor integrado
  (embeddings Markdown existentes) hasta que QMD se recupere.

### Rutas de memoria adicionales

Si desea indexar archivos Markdown fuera del diseño predeterminado del espacio de trabajo, agregue
rutas explícitas:

```json5
agents: {
  defaults: {
    memorySearch: {
      extraPaths: ["../team-docs", "/srv/shared-notes/overview.md"]
    }
  }
}
```

Notas:

- Las rutas pueden ser absolutas o relativas al espacio de trabajo.
- Los directorios se escanean recursivamente para archivos `.md`.
- Solo se indexan archivos Markdown.
- Los enlaces simbólicos se ignoran (archivos o directorios).

### Embeddings de Gemini (nativos)

Configure el proveedor como `gemini` para usar directamente la API de embeddings de Gemini:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "gemini",
      model: "gemini-embedding-001",
      remote: {
        apiKey: "YOUR_GEMINI_API_KEY"
      }
    }
  }
}
```

Notas:

- `remote.baseUrl` es opcional (por defecto, la URL base de la API de Gemini).
- `remote.headers` le permite agregar encabezados extra si es necesario.
- Modelo predeterminado: `gemini-embedding-001`.

Si desea usar un **endpoint compatible con OpenAI personalizado** (OpenRouter, vLLM o un proxy),
puede usar la configuración `remote` con el proveedor OpenAI:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_OPENAI_COMPAT_API_KEY",
        headers: { "X-Custom-Header": "value" }
      }
    }
  }
}
```

Si no quiere configurar una clave de API, use `memorySearch.provider = "local"` o configure
`memorySearch.fallback = "none"`.

Fallbacks:

- `memorySearch.fallback` puede ser `openai`, `gemini`, `local` o `none`.
- El proveedor de respaldo solo se usa cuando falla el proveedor de embeddings primario.

Indexado por lotes (OpenAI + Gemini):

- Habilitado por defecto para embeddings de OpenAI y Gemini. Configure `agents.defaults.memorySearch.remote.batch.enabled = false` para deshabilitar.
- El comportamiento predeterminado espera a que el lote finalice; ajuste `remote.batch.wait`, `remote.batch.pollIntervalMs` y `remote.batch.timeoutMinutes` si es necesario.
- Configure `remote.batch.concurrency` para controlar cuántos trabajos por lotes enviamos en paralelo (predeterminado: 2).
- El modo por lotes aplica cuando `memorySearch.provider = "openai"` o `"gemini"` y usa la clave de API correspondiente.
- Los trabajos por lotes de Gemini usan el endpoint asíncrono de lotes de embeddings y requieren disponibilidad de la API Gemini Batch.

Por qué el batch de OpenAI es rápido y barato:

- Para grandes backfills, OpenAI suele ser la opción más rápida que soportamos porque podemos enviar muchas solicitudes de embeddings en un solo trabajo por lotes y dejar que OpenAI las procese de forma asíncrona.
- OpenAI ofrece precios con descuento para cargas de trabajo del Batch API, por lo que las ejecuciones de indexado grandes suelen ser más baratas que enviar las mismas solicitudes de forma sincrónica.
- Consulte la documentación y precios del OpenAI Batch API para más detalles:
  - https://platform.openai.com/docs/api-reference/batch
  - https://platform.openai.com/pricing

Ejemplo de configuración:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      fallback: "openai",
      remote: {
        batch: { enabled: true, concurrency: 2 }
      },
      sync: { watch: true }
    }
  }
}
```

Herramientas:

- `memory_search` — devuelve fragmentos con archivo + rangos de líneas.
- `memory_get` — lee el contenido de archivos de memoria por ruta.

Modo local:

- Configure `agents.defaults.memorySearch.provider = "local"`.
- Proporcione `agents.defaults.memorySearch.local.modelPath` (GGUF o URI `hf:`).
- Opcional: configure `agents.defaults.memorySearch.fallback = "none"` para evitar el fallback remoto.

### Cómo funcionan las herramientas de memoria

- `memory_search` busca semánticamente fragmentos de Markdown (~objetivo de 400 tokens, superposición de 80 tokens) desde `MEMORY.md` + `memory/**/*.md`. Devuelve texto del fragmento (limitado a ~700 caracteres), ruta del archivo, rango de líneas, puntuación, proveedor/modelo y si hicimos fallback de embeddings locales → remotos. No se devuelve la carga completa del archivo.
- `memory_get` lee un archivo Markdown de memoria específico (relativo al espacio de trabajo), opcionalmente desde una línea inicial y por N líneas. Las rutas fuera de `MEMORY.md` / `memory/` se rechazan.
- Ambas herramientas solo se habilitan cuando `memorySearch.enabled` se resuelve como verdadero para el agente.

### Qué se indexa (y cuándo)

- Tipo de archivo: solo Markdown (`MEMORY.md`, `memory/**/*.md`).
- Almacenamiento del índice: SQLite por agente en `~/.openclaw/memory/<agentId>.sqlite` (configurable vía `agents.defaults.memorySearch.store.path`, admite el token `{agentId}`).
- Actualidad: un watcher en `MEMORY.md` + `memory/` marca el índice como sucio (debounce 1.5s). La sincronización se programa al inicio de la sesión, en la búsqueda o en un intervalo y se ejecuta de forma asíncrona. Las transcripciones de sesión usan umbrales delta para activar la sincronización en segundo plano.
- Disparadores de reindexado: el índice almacena el **proveedor/modelo de embeddings + huella del endpoint + parámetros de fragmentación**. Si cualquiera de estos cambia, OpenClaw restablece y reindexa automáticamente todo el almacén.

### Búsqueda híbrida (BM25 + vector)

Cuando está habilitada, OpenClaw combina:

- **Similitud vectorial** (coincidencia semántica, la redacción puede diferir)
- **Relevancia de palabras clave BM25** (tokens exactos como IDs, variables de entorno, símbolos de código)

Si la búsqueda de texto completo no está disponible en su plataforma, OpenClaw vuelve a la búsqueda solo vectorial.

#### ¿Por qué híbrida?

La búsqueda vectorial es excelente para “esto significa lo mismo”:

- “Mac Studio gateway host” vs “la máquina que ejecuta el gateway”
- “debounce file updates” vs “evitar indexar en cada escritura”

Pero puede ser débil para tokens exactos de alta señal:

- IDs (`a828e60`, `b3b9895a…`)
- símbolos de código (`memorySearch.query.hybrid`)
- cadenas de error (“sqlite-vec unavailable”)

BM25 (texto completo) es lo opuesto: fuerte en tokens exactos, más débil en paráfrasis.
La búsqueda híbrida es el punto medio pragmático: **usar ambas señales de recuperación** para obtener
buenos resultados tanto para consultas de “lenguaje natural” como de “aguja en un pajar”.

#### Cómo combinamos resultados (diseño actual)

Bosquejo de implementación:

1. Recuperar un conjunto de candidatos de ambos lados:

- **Vector**: top `maxResults * candidateMultiplier` por similitud de coseno.
- **BM25**: top `maxResults * candidateMultiplier` por rango BM25 de FTS5 (más bajo es mejor).

2. Convertir el rango BM25 en una puntuación aproximada 0..1:

- `textScore = 1 / (1 + max(0, bm25Rank))`

3. Unir candidatos por id de fragmento y calcular una puntuación ponderada:

- `finalScore = vectorWeight * vectorScore + textWeight * textScore`

Notas:

- `vectorWeight` + `textWeight` se normaliza a 1.0 en la resolución de configuración, por lo que los pesos se comportan como porcentajes.
- Si los embeddings no están disponibles (o el proveedor devuelve un vector cero), aún ejecutamos BM25 y devolvemos coincidencias por palabras clave.
- Si FTS5 no puede crearse, mantenemos la búsqueda solo vectorial (sin fallo duro).

Esto no es “perfecto según la teoría IR”, pero es simple, rápido y tiende a mejorar recall/precision en notas reales.
Si luego queremos algo más sofisticado, los siguientes pasos comunes son Reciprocal Rank Fusion (RRF) o normalización de puntuaciones
(min/max o z-score) antes de mezclar.

Configuración:

```json5
agents: {
  defaults: {
    memorySearch: {
      query: {
        hybrid: {
          enabled: true,
          vectorWeight: 0.7,
          textWeight: 0.3,
          candidateMultiplier: 4
        }
      }
    }
  }
}
```

### Caché de embeddings

OpenClaw puede almacenar en caché **embeddings de fragmentos** en SQLite para que el reindexado y las actualizaciones frecuentes (especialmente transcripciones de sesión) no vuelvan a generar embeddings de texto sin cambios.

Configuración:

```json5
agents: {
  defaults: {
    memorySearch: {
      cache: {
        enabled: true,
        maxEntries: 50000
      }
    }
  }
}
```

### Búsqueda de memoria de sesión (experimental)

Opcionalmente puede indexar **transcripciones de sesión** y mostrarlas vía `memory_search`.
Esto está protegido por una bandera experimental.

```json5
agents: {
  defaults: {
    memorySearch: {
      experimental: { sessionMemory: true },
      sources: ["memory", "sessions"]
    }
  }
}
```

Notas:

- El indexado de sesiones es **opt-in** (apagado por defecto).
- Las actualizaciones de sesión usan debounce y se **indexan de forma asíncrona** una vez que cruzan umbrales delta (best-effort).
- `memory_search` nunca bloquea por indexado; los resultados pueden estar ligeramente desactualizados hasta que finalice la sincronización en segundo plano.
- Los resultados siguen incluyendo solo fragmentos; `memory_get` permanece limitado a archivos de memoria.
- El indexado de sesiones está aislado por agente (solo se indexan los registros de sesión de ese agente).
- Los registros de sesión viven en disco (`~/.openclaw/agents/<agentId>/sessions/*.jsonl`). Cualquier proceso/usuario con acceso al sistema de archivos puede leerlos, así que trate el acceso al disco como el límite de confianza. Para un aislamiento más estricto, ejecute agentes bajo usuarios del SO o hosts separados.

Umbrales delta (valores predeterminados mostrados):

```json5
agents: {
  defaults: {
    memorySearch: {
      sync: {
        sessions: {
          deltaBytes: 100000,   // ~100 KB
          deltaMessages: 50     // JSONL lines
        }
      }
    }
  }
}
```

### Aceleración vectorial de SQLite (sqlite-vec)

Cuando la extensión sqlite-vec está disponible, OpenClaw almacena embeddings en una
tabla virtual de SQLite (`vec0`) y realiza consultas de distancia vectorial en la
base de datos. Esto mantiene la búsqueda rápida sin cargar cada embedding en JS.

Configuración (opcional):

```json5
agents: {
  defaults: {
    memorySearch: {
      store: {
        vector: {
          enabled: true,
          extensionPath: "/path/to/sqlite-vec"
        }
      }
    }
  }
}
```

Notas:

- `enabled` es verdadero por defecto; cuando se deshabilita, la búsqueda vuelve a
  similitud de coseno en proceso sobre embeddings almacenados.
- Si la extensión sqlite-vec falta o falla al cargar, OpenClaw registra el
  error y continúa con el fallback en JS (sin tabla vectorial).
- `extensionPath` sobrescribe la ruta de sqlite-vec incluida (útil para compilaciones personalizadas
  o ubicaciones de instalación no estándar).

### Descarga automática de embeddings locales

- Modelo local de embeddings predeterminado: `hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf` (~0.6 GB).
- Cuando `memorySearch.provider = "local"`, `node-llama-cpp` resuelve `modelPath`; si falta el GGUF se **descarga automáticamente** a la caché (o `local.modelCacheDir` si está configurado), luego se carga. Las descargas se reanudan al reintentar.
- Requisito de compilación nativa: ejecute `pnpm approve-builds`, elija `node-llama-cpp`, luego `pnpm rebuild node-llama-cpp`.
- Fallback: si la configuración local falla y `memorySearch.fallback = "openai"`, cambiamos automáticamente a embeddings remotos (`openai/text-embedding-3-small` a menos que se sobrescriba) y registramos el motivo.

### Ejemplo de endpoint compatible con OpenAI personalizado

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_REMOTE_API_KEY",
        headers: {
          "X-Organization": "org-id",
          "X-Project": "project-id"
        }
      }
    }
  }
}
```

Notas:

- `remote.*` tiene prioridad sobre `models.providers.openai.*`.
- `remote.headers` se fusiona con los encabezados de OpenAI; el remoto gana en conflictos de claves. Omita `remote.headers` para usar los valores predeterminados de OpenAI.
