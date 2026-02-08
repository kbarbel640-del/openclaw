---
summary: "Use los modelos de Venice AI enfocados en la privacidad en OpenClaw"
read_when:
  - Quiere inferencia enfocada en la privacidad en OpenClaw
  - Quiere orientacion de configuracion de Venice AI
title: "Venice AI"
x-i18n:
  source_path: providers/venice.md
  source_hash: 2453a6ec3a715c24
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:57Z
---

# Venice AI (destacado de Venice)

**Venice** es nuestra configuracion destacada de Venice para inferencia con prioridad en la privacidad y acceso anonimizado opcional a modelos propietarios.

Venice AI proporciona inferencia de IA enfocada en la privacidad con soporte para modelos sin censura y acceso a los principales modelos propietarios a traves de su proxy anonimizado. Toda la inferencia es privada por defecto: no hay entrenamiento con sus datos ni registro.

## Por que Venice en OpenClaw

- **Inferencia privada** para modelos de codigo abierto (sin registros).
- **Modelos sin censura** cuando los necesita.
- **Acceso anonimizado** a modelos propietarios (Opus/GPT/Gemini) cuando la calidad es importante.
- Endpoints compatibles con OpenAI `/v1`.

## Modos de Privacidad

Venice ofrece dos niveles de privacidad; entender esto es clave para elegir su modelo:

| Modo            | Descripcion                                                                                                                      | Modelos                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Privado**     | Totalmente privado. Los prompts/respuestas **nunca se almacenan ni se registran**. Efimero.                                      | Llama, Qwen, DeepSeek, Venice Uncensored, etc. |
| **Anonimizado** | Canalizado a traves de Venice con metadatos eliminados. El proveedor subyacente (OpenAI, Anthropic) ve solicitudes anonimizadas. | Claude, GPT, Gemini, Grok, Kimi, MiniMax       |

## Caracteristicas

- **Enfocado en la privacidad**: Elija entre modos "privado" (totalmente privado) y "anonimizado" (con proxy)
- **Modelos sin censura**: Acceso a modelos sin restricciones de contenido
- **Acceso a modelos principales**: Use Claude, GPT-5.2, Gemini, Grok a traves del proxy anonimizado de Venice
- **API compatible con OpenAI**: Endpoints estandar `/v1` para una integracion sencilla
- **Streaming**: ✅ Compatible en todos los modelos
- **Llamada de funciones**: ✅ Compatible en modelos seleccionados (revise las capacidades del modelo)
- **Vision**: ✅ Compatible en modelos con capacidad de vision
- **Sin limites estrictos de tasa**: Puede aplicarse limitacion de uso justo para usos extremos

## Configuracion

### 1. Obtener clave de API

1. Registrese en [venice.ai](https://venice.ai)
2. Vaya a **Settings → API Keys → Create new key**
3. Copie su clave de API (formato: `vapi_xxxxxxxxxxxx`)

### 2. Configurar OpenClaw

**Opcion A: Variable de entorno**

```bash
export VENICE_API_KEY="vapi_xxxxxxxxxxxx"
```

**Opcion B: Configuracion interactiva (Recomendada)**

```bash
openclaw onboard --auth-choice venice-api-key
```

Esto hara lo siguiente:

1. Solicitar su clave de API (o usar la existente `VENICE_API_KEY`)
2. Mostrar todos los modelos disponibles de Venice
3. Permitirle elegir su modelo predeterminado
4. Configurar el proveedor automaticamente

**Opcion C: No interactiva**

```bash
openclaw onboard --non-interactive \
  --auth-choice venice-api-key \
  --venice-api-key "vapi_xxxxxxxxxxxx"
```

### 3. Verificar configuracion

```bash
openclaw chat --model venice/llama-3.3-70b "Hello, are you working?"
```

## Seleccion de Modelos

Despues de la configuracion, OpenClaw muestra todos los modelos disponibles de Venice. Elija segun sus necesidades:

- **Predeterminado (nuestra eleccion)**: `venice/llama-3.3-70b` para privacidad y rendimiento equilibrado.
- **Mejor calidad general**: `venice/claude-opus-45` para trabajos exigentes (Opus sigue siendo el mas fuerte).
- **Privacidad**: Elija modelos "privados" para inferencia totalmente privada.
- **Capacidad**: Elija modelos "anonimizados" para acceder a Claude, GPT, Gemini a traves del proxy de Venice.

Cambie su modelo predeterminado en cualquier momento:

```bash
openclaw models set venice/claude-opus-45
openclaw models set venice/llama-3.3-70b
```

Listar todos los modelos disponibles:

```bash
openclaw models list | grep venice
```

## Configurar via `openclaw configure`

1. Ejecute `openclaw configure`
2. Seleccione **Model/auth**
3. Elija **Venice AI**

## ¿Que modelo deberia usar?

| Caso de uso                     | Modelo recomendado               | Por que                                               |
| ------------------------------- | -------------------------------- | ----------------------------------------------------- |
| **Chat general**                | `llama-3.3-70b`                  | Bueno en general, totalmente privado                  |
| **Mejor calidad general**       | `claude-opus-45`                 | Opus sigue siendo el mas fuerte para tareas dificiles |
| **Privacidad + calidad Claude** | `claude-opus-45`                 | Mejor razonamiento via proxy anonimizado              |
| **Programacion**                | `qwen3-coder-480b-a35b-instruct` | Optimizado para codigo, contexto de 262k              |
| **Tareas de vision**            | `qwen3-vl-235b-a22b`             | Mejor modelo privado de vision                        |
| **Sin censura**                 | `venice-uncensored`              | Sin restricciones de contenido                        |
| **Rapido y barato**             | `qwen3-4b`                       | Ligero, aun capaz                                     |
| **Razonamiento complejo**       | `deepseek-v3.2`                  | Razonamiento fuerte, privado                          |

## Modelos Disponibles (25 en total)

### Modelos Privados (15) — Totalmente Privados, Sin Registro

| ID del modelo                    | Nombre                  | Contexto (tokens) | Caracteristicas           |
| -------------------------------- | ----------------------- | ----------------- | ------------------------- |
| `llama-3.3-70b`                  | Llama 3.3 70B           | 131k              | General                   |
| `llama-3.2-3b`                   | Llama 3.2 3B            | 131k              | Rapido, ligero            |
| `hermes-3-llama-3.1-405b`        | Hermes 3 Llama 3.1 405B | 131k              | Tareas complejas          |
| `qwen3-235b-a22b-thinking-2507`  | Qwen3 235B Thinking     | 131k              | Razonamiento              |
| `qwen3-235b-a22b-instruct-2507`  | Qwen3 235B Instruct     | 131k              | General                   |
| `qwen3-coder-480b-a35b-instruct` | Qwen3 Coder 480B        | 262k              | Codigo                    |
| `qwen3-next-80b`                 | Qwen3 Next 80B          | 262k              | General                   |
| `qwen3-vl-235b-a22b`             | Qwen3 VL 235B           | 262k              | Vision                    |
| `qwen3-4b`                       | Venice Small (Qwen3 4B) | 32k               | Rapido, razonamiento      |
| `deepseek-v3.2`                  | DeepSeek V3.2           | 163k              | Razonamiento              |
| `venice-uncensored`              | Venice Uncensored       | 32k               | Sin censura               |
| `mistral-31-24b`                 | Venice Medium (Mistral) | 131k              | Vision                    |
| `google-gemma-3-27b-it`          | Gemma 3 27B Instruct    | 202k              | Vision                    |
| `openai-gpt-oss-120b`            | OpenAI GPT OSS 120B     | 131k              | General                   |
| `zai-org-glm-4.7`                | GLM 4.7                 | 202k              | Razonamiento, multilingüe |

### Modelos Anonimizados (10) — Via Proxy de Venice

| ID del modelo            | Original          | Contexto (tokens) | Caracteristicas      |
| ------------------------ | ----------------- | ----------------- | -------------------- |
| `claude-opus-45`         | Claude Opus 4.5   | 202k              | Razonamiento, vision |
| `claude-sonnet-45`       | Claude Sonnet 4.5 | 202k              | Razonamiento, vision |
| `openai-gpt-52`          | GPT-5.2           | 262k              | Razonamiento         |
| `openai-gpt-52-codex`    | GPT-5.2 Codex     | 262k              | Razonamiento, vision |
| `gemini-3-pro-preview`   | Gemini 3 Pro      | 202k              | Razonamiento, vision |
| `gemini-3-flash-preview` | Gemini 3 Flash    | 262k              | Razonamiento, vision |
| `grok-41-fast`           | Grok 4.1 Fast     | 262k              | Razonamiento, vision |
| `grok-code-fast-1`       | Grok Code Fast 1  | 262k              | Razonamiento, codigo |
| `kimi-k2-thinking`       | Kimi K2 Thinking  | 262k              | Razonamiento         |
| `minimax-m21`            | MiniMax M2.1      | 202k              | Razonamiento         |

## Descubrimiento de Modelos

OpenClaw descubre automaticamente los modelos desde la API de Venice cuando `VENICE_API_KEY` esta configurado. Si la API no es accesible, recurre a un catalogo estatico.

El endpoint `/models` es publico (no requiere autenticacion para listar), pero la inferencia requiere una clave de API valida.

## Streaming y Soporte de Herramientas

| Caracteristica           | Soporte                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| **Streaming**            | ✅ Todos los modelos                                                      |
| **Llamada de funciones** | ✅ La mayoria de los modelos (revise `supportsFunctionCalling` en la API) |
| **Vision/Imagenes**      | ✅ Modelos marcados con la caracteristica "Vision"                        |
| **Modo JSON**            | ✅ Compatible via `response_format`                                       |

## Precios

Venice utiliza un sistema basado en creditos. Revise [venice.ai/pricing](https://venice.ai/pricing) para las tarifas actuales:

- **Modelos privados**: Generalmente de menor costo
- **Modelos anonimizados**: Similares al precio directo de la API + una pequena tarifa de Venice

## Comparacion: Venice vs API Directa

| Aspecto         | Venice (Anonimizado)                    | API Directa               |
| --------------- | --------------------------------------- | ------------------------- |
| **Privacidad**  | Metadatos eliminados, anonimizado       | Su cuenta vinculada       |
| **Latencia**    | +10-50ms (proxy)                        | Directa                   |
| **Funciones**   | La mayoria de las funciones compatibles | Funciones completas       |
| **Facturacion** | Creditos de Venice                      | Facturacion del proveedor |

## Ejemplos de Uso

```bash
# Use default private model
openclaw chat --model venice/llama-3.3-70b

# Use Claude via Venice (anonymized)
openclaw chat --model venice/claude-opus-45

# Use uncensored model
openclaw chat --model venice/venice-uncensored

# Use vision model with image
openclaw chat --model venice/qwen3-vl-235b-a22b

# Use coding model
openclaw chat --model venice/qwen3-coder-480b-a35b-instruct
```

## Solucion de problemas

### La clave de API no es reconocida

```bash
echo $VENICE_API_KEY
openclaw models list | grep venice
```

Asegurese de que la clave comience con `vapi_`.

### Modelo no disponible

El catalogo de modelos de Venice se actualiza dinamicamente. Ejecute `openclaw models list` para ver los modelos disponibles actualmente. Algunos modelos pueden estar temporalmente fuera de linea.

### Problemas de conexion

La API de Venice esta en `https://api.venice.ai/api/v1`. Asegurese de que su red permita conexiones HTTPS.

## Ejemplo de archivo de configuracion

```json5
{
  env: { VENICE_API_KEY: "vapi_..." },
  agents: { defaults: { model: { primary: "venice/llama-3.3-70b" } } },
  models: {
    mode: "merge",
    providers: {
      venice: {
        baseUrl: "https://api.venice.ai/api/v1",
        apiKey: "${VENICE_API_KEY}",
        api: "openai-completions",
        models: [
          {
            id: "llama-3.3-70b",
            name: "Llama 3.3 70B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 131072,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Enlaces

- [Venice AI](https://venice.ai)
- [Documentacion de la API](https://docs.venice.ai)
- [Precios](https://venice.ai/pricing)
- [Estado](https://status.venice.ai)
