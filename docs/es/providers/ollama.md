---
summary: "Ejecute OpenClaw con Ollama (entorno de ejecucion local de LLM)"
read_when:
  - Quiere ejecutar OpenClaw con modelos locales mediante Ollama
  - Necesita orientacion sobre la configuracion y puesta en marcha de Ollama
title: "Ollama"
x-i18n:
  source_path: providers/ollama.md
  source_hash: 2992dd0a456d19c3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:49Z
---

# Ollama

Ollama es un entorno de ejecucion local de LLM que facilita ejecutar modelos de codigo abierto en su maquina. OpenClaw se integra con la API compatible con OpenAI de Ollama y puede **descubrir automaticamente modelos con capacidad de herramientas** cuando usted opta por ello con `OLLAMA_API_KEY` (o un perfil de autenticacion) y no define una entrada `models.providers.ollama` explicita.

## Inicio rapido

1. Instale Ollama: https://ollama.ai

2. Descargue un modelo:

```bash
ollama pull gpt-oss:20b
# or
ollama pull llama3.3
# or
ollama pull qwen2.5-coder:32b
# or
ollama pull deepseek-r1:32b
```

3. Habilite Ollama para OpenClaw (cualquier valor funciona; Ollama no requiere una clave real):

```bash
# Set environment variable
export OLLAMA_API_KEY="ollama-local"

# Or configure in your config file
openclaw config set models.providers.ollama.apiKey "ollama-local"
```

4. Use modelos de Ollama:

```json5
{
  agents: {
    defaults: {
      model: { primary: "ollama/gpt-oss:20b" },
    },
  },
}
```

## Descubrimiento de modelos (proveedor implicito)

Cuando establece `OLLAMA_API_KEY` (o un perfil de autenticacion) y **no** define `models.providers.ollama`, OpenClaw descubre modelos desde la instancia local de Ollama en `http://127.0.0.1:11434`:

- Consulta `/api/tags` y `/api/show`
- Conserva solo los modelos que reportan la capacidad `tools`
- Marca `reasoning` cuando el modelo reporta `thinking`
- Lee `contextWindow` desde `model_info["<arch>.context_length"]` cuando esta disponible
- Establece `maxTokens` en 10× la ventana de contexto
- Establece todos los costos en `0`

Esto evita entradas manuales de modelos mientras mantiene el catalogo alineado con las capacidades de Ollama.

Para ver que modelos estan disponibles:

```bash
ollama list
openclaw models list
```

Para agregar un nuevo modelo, simplemente descarguelo con Ollama:

```bash
ollama pull mistral
```

El nuevo modelo se descubrira automaticamente y estara disponible para usar.

Si establece `models.providers.ollama` explicitamente, se omite el descubrimiento automatico y debe definir los modelos manualmente (vea abajo).

## Configuracion

### Configuracion basica (descubrimiento implicito)

La forma mas sencilla de habilitar Ollama es mediante una variable de entorno:

```bash
export OLLAMA_API_KEY="ollama-local"
```

### Configuracion explicita (modelos manuales)

Use configuracion explicita cuando:

- Ollama se ejecuta en otro host/puerto.
- Quiere forzar ventanas de contexto especificas o listas de modelos.
- Quiere incluir modelos que no reportan soporte de herramientas.

```json5
{
  models: {
    providers: {
      ollama: {
        // Use a host that includes /v1 for OpenAI-compatible APIs
        baseUrl: "http://ollama-host:11434/v1",
        apiKey: "ollama-local",
        api: "openai-completions",
        models: [
          {
            id: "gpt-oss:20b",
            name: "GPT-OSS 20B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 8192 * 10
          }
        ]
      }
    }
  }
}
```

Si `OLLAMA_API_KEY` esta establecido, puede omitir `apiKey` en la entrada del proveedor y OpenClaw lo completara para las comprobaciones de disponibilidad.

### URL base personalizada (configuracion explicita)

Si Ollama se ejecuta en un host o puerto diferente (la configuracion explicita deshabilita el descubrimiento automatico, por lo que debe definir los modelos manualmente):

```json5
{
  models: {
    providers: {
      ollama: {
        apiKey: "ollama-local",
        baseUrl: "http://ollama-host:11434/v1",
      },
    },
  },
}
```

### Seleccion de modelos

Una vez configurado, todos sus modelos de Ollama estan disponibles:

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/gpt-oss:20b",
        fallbacks: ["ollama/llama3.3", "ollama/qwen2.5-coder:32b"],
      },
    },
  },
}
```

## Avanzado

### Modelos de razonamiento

OpenClaw marca los modelos como capaces de razonamiento cuando Ollama reporta `thinking` en `/api/show`:

```bash
ollama pull deepseek-r1:32b
```

### Costos de modelos

Ollama es gratuito y se ejecuta localmente, por lo que todos los costos de modelos se establecen en $0.

### Configuracion de streaming

Debido a un [problema conocido](https://github.com/badlogic/pi-mono/issues/1205) en el SDK subyacente con el formato de respuesta de Ollama, **el streaming esta deshabilitado de forma predeterminada** para los modelos de Ollama. Esto evita respuestas corruptas al usar modelos con capacidad de herramientas.

Cuando el streaming esta deshabilitado, las respuestas se entregan todas a la vez (modo sin streaming), lo que evita el problema en el que los deltas de contenido/razonamiento intercalados causan salida ilegible.

#### Rehabilitar streaming (avanzado)

Si desea volver a habilitar el streaming para Ollama (puede causar problemas con modelos con capacidad de herramientas):

```json5
{
  agents: {
    defaults: {
      models: {
        "ollama/gpt-oss:20b": {
          streaming: true,
        },
      },
    },
  },
}
```

#### Deshabilitar streaming para otros proveedores

Tambien puede deshabilitar el streaming para cualquier proveedor si es necesario:

```json5
{
  agents: {
    defaults: {
      models: {
        "openai/gpt-4": {
          streaming: false,
        },
      },
    },
  },
}
```

### Ventanas de contexto

Para los modelos descubiertos automaticamente, OpenClaw utiliza la ventana de contexto reportada por Ollama cuando esta disponible; de lo contrario, usa el valor predeterminado `8192`. Puede sobrescribir `contextWindow` y `maxTokens` en la configuracion explicita del proveedor.

## Solucion de problemas

### Ollama no detectado

Asegurese de que Ollama este en ejecucion y de que haya establecido `OLLAMA_API_KEY` (o un perfil de autenticacion), y de que **no** haya definido una entrada `models.providers.ollama` explicita:

```bash
ollama serve
```

Y que la API sea accesible:

```bash
curl http://localhost:11434/api/tags
```

### No hay modelos disponibles

OpenClaw solo descubre automaticamente modelos que reportan soporte de herramientas. Si su modelo no aparece en la lista, haga una de las siguientes acciones:

- Descargue un modelo con capacidad de herramientas, o
- Defina el modelo explicitamente en `models.providers.ollama`.

Para agregar modelos:

```bash
ollama list  # See what's installed
ollama pull gpt-oss:20b  # Pull a tool-capable model
ollama pull llama3.3     # Or another model
```

### Conexion rechazada

Verifique que Ollama se este ejecutando en el puerto correcto:

```bash
# Check if Ollama is running
ps aux | grep ollama

# Or restart Ollama
ollama serve
```

### Respuestas corruptas o nombres de herramientas en la salida

Si ve respuestas ilegibles que contienen nombres de herramientas (como `sessions_send`, `memory_get`) o texto fragmentado al usar modelos de Ollama, esto se debe a un problema del SDK aguas arriba con las respuestas en streaming. **Esto se corrige de forma predeterminada** en la version mas reciente de OpenClaw al deshabilitar el streaming para los modelos de Ollama.

Si habilito manualmente el streaming y experimenta este problema:

1. Elimine la configuracion `streaming: true` de las entradas de su modelo de Ollama, o
2. Establezca explicitamente `streaming: false` para los modelos de Ollama (vea [Configuracion de streaming](#configuracion-de-streaming))

## Ver tambien

- [Proveedores de modelos](/concepts/model-providers) - Descripcion general de todos los proveedores
- [Seleccion de modelos](/concepts/models) - Como elegir modelos
- [Configuracion](/gateway/configuration) - Referencia completa de configuracion
