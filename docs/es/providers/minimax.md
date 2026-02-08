---
summary: "Use MiniMax M2.1 en OpenClaw"
read_when:
  - Quiere modelos MiniMax en OpenClaw
  - Necesita orientacion de configuracion de MiniMax
title: "MiniMax"
x-i18n:
  source_path: providers/minimax.md
  source_hash: 5bbd47fa3327e40c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:48Z
---

# MiniMax

MiniMax es una empresa de IA que crea la familia de modelos **M2/M2.1**. La version
actual enfocada en programacion es **MiniMax M2.1** (23 de diciembre de 2025), creada para
tareas complejas del mundo real.

Fuente: [Nota de lanzamiento de MiniMax M2.1](https://www.minimax.io/news/minimax-m21)

## Descripcion general del modelo (M2.1)

MiniMax destaca estas mejoras en M2.1:

- **Programacion multilenguaje** mas solida (Rust, Java, Go, C++, Kotlin, Objective-C, TS/JS).
- Mejor **desarrollo web/app** y calidad estetica de las salidas (incluida movilidad nativa).
- Manejo mejorado de **instrucciones compuestas** para flujos de trabajo de oficina, basado en
  razonamiento intercalado y ejecucion integrada de restricciones.
- **Respuestas mas concisas** con menor uso de tokens y ciclos de iteracion mas rapidos.
- Mayor compatibilidad con **frameworks de herramientas/agentes** y gestion de contexto (Claude Code,
  Droid/Factory AI, Cline, Kilo Code, Roo Code, BlackBox).
- Salidas de **dialogo y redaccion tecnica** de mayor calidad.

## MiniMax M2.1 vs MiniMax M2.1 Lightning

- **Velocidad:** Lightning es la variante “rapida” en la documentacion de precios de MiniMax.
- **Costo:** Los precios muestran el mismo costo de entrada, pero Lightning tiene mayor costo de salida.
- **Enrutamiento del plan de programacion:** El back-end Lightning no esta disponible directamente en el plan de programacion de MiniMax.
  MiniMax enruta automaticamente la mayoria de las solicitudes a Lightning, pero vuelve al back-end
  M2.1 regular durante picos de trafico.

## Elija una configuracion

### MiniMax OAuth (Plan de Programacion) — recomendado

**Ideal para:** configuracion rapida con el Plan de Programacion de MiniMax via OAuth, no se requiere clave de API.

Habilite el complemento OAuth incluido y autentiquese:

```bash
openclaw plugins enable minimax-portal-auth  # skip if already loaded.
openclaw gateway restart  # restart if gateway is already running
openclaw onboard --auth-choice minimax-portal
```

Se le pedira seleccionar un endpoint:

- **Global** - Usuarios internacionales (`api.minimax.io`)
- **CN** - Usuarios en China (`api.minimaxi.com`)

Consulte el [README del complemento OAuth de MiniMax](https://github.com/openclaw/openclaw/tree/main/extensions/minimax-portal-auth) para mas detalles.

### MiniMax M2.1 (clave de API)

**Ideal para:** MiniMax alojado con API compatible con Anthropic.

Configure via CLI:

- Ejecute `openclaw configure`
- Seleccione **Model/auth**
- Elija **MiniMax M2.1**

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "minimax/MiniMax-M2.1" } } },
  models: {
    mode: "merge",
    providers: {
      minimax: {
        baseUrl: "https://api.minimax.io/anthropic",
        apiKey: "${MINIMAX_API_KEY}",
        api: "anthropic-messages",
        models: [
          {
            id: "MiniMax-M2.1",
            name: "MiniMax M2.1",
            reasoning: false,
            input: ["text"],
            cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### MiniMax M2.1 como respaldo (Opus primario)

**Ideal para:** mantener Opus 4.6 como primario y conmutar por error a MiniMax M2.1.

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": { alias: "opus" },
        "minimax/MiniMax-M2.1": { alias: "minimax" },
      },
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["minimax/MiniMax-M2.1"],
      },
    },
  },
}
```

### Opcional: Local via LM Studio (manual)

**Ideal para:** inferencia local con LM Studio.
Hemos visto resultados solidos con MiniMax M2.1 en hardware potente (p. ej.,
una computadora de escritorio/servidor) usando el servidor local de LM Studio.

Configure manualmente via `openclaw.json`:

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: { "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" } },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Configurar via `openclaw configure`

Use el asistente de configuracion interactivo para configurar MiniMax sin editar JSON:

1. Ejecute `openclaw configure`.
2. Seleccione **Model/auth**.
3. Elija **MiniMax M2.1**.
4. Elija su modelo predeterminado cuando se le solicite.

## Opciones de configuracion

- `models.providers.minimax.baseUrl`: prefiera `https://api.minimax.io/anthropic` (compatible con Anthropic); `https://api.minimax.io/v1` es opcional para cargas compatibles con OpenAI.
- `models.providers.minimax.api`: prefiera `anthropic-messages`; `openai-completions` es opcional para cargas compatibles con OpenAI.
- `models.providers.minimax.apiKey`: clave de API de MiniMax (`MINIMAX_API_KEY`).
- `models.providers.minimax.models`: defina `id`, `name`, `reasoning`, `contextWindow`, `maxTokens`, `cost`.
- `agents.defaults.models`: asigne alias a los modelos que quiera en la allowlist.
- `models.mode`: mantenga `merge` si quiere agregar MiniMax junto a los integrados.

## Notas

- Las referencias de modelos son `minimax/<model>`.
- API de uso del Plan de Programacion: `https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains` (requiere una clave del plan de programacion).
- Actualice los valores de precios en `models.json` si necesita seguimiento exacto de costos.
- Enlace de referido para el Plan de Programacion de MiniMax (10% de descuento): https://platform.minimax.io/subscribe/coding-plan?code=DbXJTRClnb&source=link
- Consulte [/concepts/model-providers](/concepts/model-providers) para las reglas de proveedores.
- Use `openclaw models list` y `openclaw models set minimax/MiniMax-M2.1` para cambiar.

## Solucion de problemas

### “Unknown model: minimax/MiniMax-M2.1”

Esto generalmente significa que **el proveedor MiniMax no esta configurado** (no hay una entrada de proveedor
y no se encontro un perfil de autenticacion MiniMax/clave de entorno). Una correccion para esta deteccion esta en
**2026.1.12** (no publicado al momento de escribir). Corrija mediante:

- Actualizar a **2026.1.12** (o ejecutar desde el codigo fuente `main`), luego reiniciar el Gateway.
- Ejecutar `openclaw configure` y seleccionar **MiniMax M2.1**, o
- Agregar manualmente el bloque `models.providers.minimax`, o
- Configurar `MINIMAX_API_KEY` (o un perfil de autenticacion MiniMax) para que se pueda inyectar el proveedor.

Asegurese de que el id del modelo sea **sensible a mayusculas y minusculas**:

- `minimax/MiniMax-M2.1`
- `minimax/MiniMax-M2.1-lightning`

Luego vuelva a comprobar con:

```bash
openclaw models list
```
