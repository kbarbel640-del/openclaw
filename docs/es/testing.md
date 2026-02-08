---
summary: "Kit de pruebas: suites unitarias/e2e/en vivo, runners Docker y qué cubre cada prueba"
read_when:
  - Ejecutar pruebas localmente o en CI
  - Agregar regresiones para errores de modelos/proveedores
  - Depurar el comportamiento del gateway + agente
title: "Pruebas"
x-i18n:
  source_path: testing.md
  source_hash: 7a23ced0e6e3be5e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:37Z
---

# Pruebas

OpenClaw tiene tres suites de Vitest (unitarias/integración, e2e, en vivo) y un pequeño conjunto de runners Docker.

Este documento es una guía de “cómo probamos”:

- Qué cubre cada suite (y qué deliberadamente _no_ cubre)
- Qué comandos ejecutar para flujos de trabajo comunes (local, pre-push, depuración)
- Cómo las pruebas en vivo descubren credenciales y seleccionan modelos/proveedores
- Cómo agregar regresiones para problemas reales de modelos/proveedores

## Inicio rapido

La mayoría de los días:

- Puerta completa (esperada antes de hacer push): `pnpm build && pnpm check && pnpm test`

Cuando toca pruebas o quiere mayor confianza:

- Puerta de cobertura: `pnpm test:coverage`
- Suite E2E: `pnpm test:e2e`

Al depurar proveedores/modelos reales (requiere credenciales reales):

- Suite en vivo (modelos + sondas de herramientas/imágenes del gateway): `pnpm test:live`

Consejo: cuando solo necesita un caso fallido, prefiera acotar las pruebas en vivo mediante las variables de entorno de allowlist descritas abajo.

## Suites de prueba (qué corre dónde)

Piense en las suites como “realismo creciente” (y mayor inestabilidad/costo):

### Unitarias / integración (predeterminada)

- Comando: `pnpm test`
- Configuración: `vitest.config.ts`
- Archivos: `src/**/*.test.ts`
- Alcance:
  - Pruebas unitarias puras
  - Pruebas de integración en proceso (auth del gateway, enrutamiento, herramientas, parsing, configuración)
  - Regresiones deterministas para errores conocidos
- Expectativas:
  - Corre en CI
  - No requiere claves reales
  - Debe ser rápida y estable

### E2E (smoke del gateway)

- Comando: `pnpm test:e2e`
- Configuración: `vitest.e2e.config.ts`
- Archivos: `src/**/*.e2e.test.ts`
- Alcance:
  - Comportamiento end-to-end del gateway con múltiples instancias
  - Superficies WebSocket/HTTP, emparejamiento de nodos y redes más pesadas
- Expectativas:
  - Corre en CI (cuando está habilitada en el pipeline)
  - No requiere claves reales
  - Más piezas móviles que las unitarias (puede ser más lenta)

### En vivo (proveedores reales + modelos reales)

- Comando: `pnpm test:live`
- Configuración: `vitest.live.config.ts`
- Archivos: `src/**/*.live.test.ts`
- Predeterminado: **habilitada** por `pnpm test:live` (establece `OPENCLAW_LIVE_TEST=1`)
- Alcance:
  - “¿Este proveedor/modelo funciona realmente _hoy_ con credenciales reales?”
  - Detecta cambios de formato del proveedor, peculiaridades de tool-calling, problemas de auth y comportamiento de rate limits
- Expectativas:
  - No es estable para CI por diseño (redes reales, políticas reales de proveedores, cuotas, caídas)
  - Cuesta dinero / consume límites
  - Prefiera ejecutar subconjuntos acotados en lugar de “todo”
  - Las ejecuciones en vivo obtendrán `~/.profile` para recoger claves API faltantes
  - Rotación de claves de Anthropic: configure `OPENCLAW_LIVE_ANTHROPIC_KEYS="sk-...,sk-..."` (o `OPENCLAW_LIVE_ANTHROPIC_KEY=sk-...`) o múltiples variables `ANTHROPIC_API_KEY*`; las pruebas reintentarán ante rate limits

## ¿Qué suite debería ejecutar?

Use esta tabla de decisión:

- Editando lógica/pruebas: ejecute `pnpm test` (y `pnpm test:coverage` si cambió mucho)
- Tocando redes del gateway / protocolo WS / emparejamiento: agregue `pnpm test:e2e`
- Depurando “mi bot está caído” / fallas específicas de proveedor / tool calling: ejecute un `pnpm test:live` acotado

## En vivo: smoke de modelos (claves de perfil)

Las pruebas en vivo se dividen en dos capas para aislar fallas:

- “Modelo directo” nos dice si el proveedor/modelo responde con la clave dada.
- “Smoke del gateway” nos dice si el pipeline completo gateway+agente funciona para ese modelo (sesiones, historial, herramientas, política de sandbox, etc.).

### Capa 1: finalización directa del modelo (sin gateway)

- Prueba: `src/agents/models.profiles.live.test.ts`
- Objetivo:
  - Enumerar modelos descubiertos
  - Usar `getApiKeyForModel` para seleccionar modelos para los que tiene credenciales
  - Ejecutar una pequeña finalización por modelo (y regresiones dirigidas cuando sea necesario)
- Cómo habilitar:
  - `pnpm test:live` (o `OPENCLAW_LIVE_TEST=1` si invoca Vitest directamente)
- Configure `OPENCLAW_LIVE_MODELS=modern` (o `all`, alias moderno) para ejecutar realmente esta suite; de lo contrario se omite para mantener `pnpm test:live` enfocada en el smoke del gateway
- Cómo seleccionar modelos:
  - `OPENCLAW_LIVE_MODELS=modern` para ejecutar la allowlist moderna (Opus/Sonnet/Haiku 4.5, GPT-5.x + Codex, Gemini 3, GLM 4.7, MiniMax M2.1, Grok 4)
  - `OPENCLAW_LIVE_MODELS=all` es un alias de la allowlist moderna
  - o `OPENCLAW_LIVE_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,..."` (allowlist separada por comas)
- Cómo seleccionar proveedores:
  - `OPENCLAW_LIVE_PROVIDERS="google,google-antigravity,google-gemini-cli"` (allowlist separada por comas)
- De dónde vienen las claves:
  - Por defecto: almacén de perfiles y fallbacks de entorno
  - Configure `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` para forzar **solo** el almacén de perfiles
- Por qué existe:
  - Separa “la API del proveedor está rota / la clave es inválida” de “el pipeline del agente del gateway está roto”
  - Contiene regresiones pequeñas y aisladas (ejemplo: replay de razonamiento de OpenAI Responses/Codex Responses + flujos de tool-call)

### Capa 2: Gateway + smoke del agente de desarrollo (lo que “@openclaw” realmente hace)

- Prueba: `src/gateway/gateway-models.profiles.live.test.ts`
- Objetivo:
  - Levantar un gateway en proceso
  - Crear/parchar una sesión `agent:dev:*` (override de modelo por ejecución)
  - Iterar modelos-con-claves y verificar:
    - respuesta “significativa” (sin herramientas)
    - que una invocación real de herramienta funcione (sonda de lectura)
    - sondas opcionales adicionales de herramientas (sonda exec+read)
    - que las rutas de regresión de OpenAI (solo tool-call → seguimiento) sigan funcionando
- Detalles de las sondas (para explicar fallas rápidamente):
  - Sonda `read`: la prueba escribe un archivo nonce en el workspace y le pide al agente que `read` y devuelva el nonce.
  - Sonda `exec+read`: la prueba le pide al agente que `exec`-escriba un nonce en un archivo temporal y luego lo `read`.
  - Sonda de imagen: la prueba adjunta un PNG generado (gato + código aleatorio) y espera que el modelo devuelva `cat <CODE>`.
  - Referencias de implementación: `src/gateway/gateway-models.profiles.live.test.ts` y `src/gateway/live-image-probe.ts`.
- Cómo habilitar:
  - `pnpm test:live` (o `OPENCLAW_LIVE_TEST=1` si invoca Vitest directamente)
- Cómo seleccionar modelos:
  - Predeterminado: allowlist moderna (Opus/Sonnet/Haiku 4.5, GPT-5.x + Codex, Gemini 3, GLM 4.7, MiniMax M2.1, Grok 4)
  - `OPENCLAW_LIVE_GATEWAY_MODELS=all` es un alias de la allowlist moderna
  - O configure `OPENCLAW_LIVE_GATEWAY_MODELS="provider/model"` (o lista separada por comas) para acotar
- Cómo seleccionar proveedores (evite “OpenRouter todo”):
  - `OPENCLAW_LIVE_GATEWAY_PROVIDERS="google,google-antigravity,google-gemini-cli,openai,anthropic,zai,minimax"` (allowlist separada por comas)
- Las sondas de herramientas + imagen siempre están activas en esta prueba en vivo:
  - Sonda `read` + sonda `exec+read` (estrés de herramientas)
  - La sonda de imagen corre cuando el modelo anuncia soporte de entrada de imágenes
  - Flujo (alto nivel):
    - La prueba genera un PNG pequeño con “CAT” + código aleatorio (`src/gateway/live-image-probe.ts`)
    - Lo envía vía `agent` `attachments: [{ mimeType: "image/png", content: "<base64>" }]`
    - El gateway parsea adjuntos en `images[]` (`src/gateway/server-methods/agent.ts` + `src/gateway/chat-attachments.ts`)
    - El agente embebido reenvía un mensaje de usuario multimodal al modelo
    - Aserción: la respuesta contiene `cat` + el código (tolerancia OCR: se permiten errores menores)

Consejo: para ver qué puede probar en su máquina (y los ids exactos de `provider/model`), ejecute:

```bash
openclaw models list
openclaw models list --json
```

## En vivo: smoke de setup-token de Anthropic

- Prueba: `src/agents/anthropic.setup-token.live.test.ts`
- Objetivo: verificar que el setup-token de Claude Code CLI (o un perfil con setup-token pegado) pueda completar un prompt de Anthropic.
- Habilitar:
  - `pnpm test:live` (o `OPENCLAW_LIVE_TEST=1` si invoca Vitest directamente)
  - `OPENCLAW_LIVE_SETUP_TOKEN=1`
- Fuentes del token (elija una):
  - Perfil: `OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test`
  - Token crudo: `OPENCLAW_LIVE_SETUP_TOKEN_VALUE=sk-ant-oat01-...`
- Override de modelo (opcional):
  - `OPENCLAW_LIVE_SETUP_TOKEN_MODEL=anthropic/claude-opus-4-6`

Ejemplo de configuración:

```bash
openclaw models auth paste-token --provider anthropic --profile-id anthropic:setup-token-test
OPENCLAW_LIVE_SETUP_TOKEN=1 OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test pnpm test:live src/agents/anthropic.setup-token.live.test.ts
```

## En vivo: smoke del backend CLI (Claude Code CLI u otros CLIs locales)

- Prueba: `src/gateway/gateway-cli-backend.live.test.ts`
- Objetivo: validar el pipeline Gateway + agente usando un backend CLI local, sin tocar su configuración predeterminada.
- Habilitar:
  - `pnpm test:live` (o `OPENCLAW_LIVE_TEST=1` si invoca Vitest directamente)
  - `OPENCLAW_LIVE_CLI_BACKEND=1`
- Predeterminados:
  - Modelo: `claude-cli/claude-sonnet-4-5`
  - Comando: `claude`
  - Args: `["-p","--output-format","json","--dangerously-skip-permissions"]`
- Overrides (opcionales):
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-opus-4-6"`
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="codex-cli/gpt-5.3-codex"`
  - `OPENCLAW_LIVE_CLI_BACKEND_COMMAND="/full/path/to/claude"`
  - `OPENCLAW_LIVE_CLI_BACKEND_ARGS='["-p","--output-format","json","--permission-mode","bypassPermissions"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_CLEAR_ENV='["ANTHROPIC_API_KEY","ANTHROPIC_API_KEY_OLD"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_PROBE=1` para enviar un adjunto de imagen real (las rutas se inyectan en el prompt).
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_ARG="--image"` para pasar rutas de archivos de imagen como args de CLI en lugar de inyección en el prompt.
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_MODE="repeat"` (o `"list"`) para controlar cómo se pasan los args de imagen cuando se establece `IMAGE_ARG`.
  - `OPENCLAW_LIVE_CLI_BACKEND_RESUME_PROBE=1` para enviar un segundo turno y validar el flujo de reanudación.
- `OPENCLAW_LIVE_CLI_BACKEND_DISABLE_MCP_CONFIG=0` para mantener habilitada la configuración MCP de Claude Code CLI (por defecto deshabilita MCP con un archivo vacío temporal).

Ejemplo:

```bash
OPENCLAW_LIVE_CLI_BACKEND=1 \
  OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-sonnet-4-5" \
  pnpm test:live src/gateway/gateway-cli-backend.live.test.ts
```

### Recetas en vivo recomendadas

Allowlists estrechas y explícitas son más rápidas y menos inestables:

- Un solo modelo, directo (sin gateway):
  - `OPENCLAW_LIVE_MODELS="openai/gpt-5.2" pnpm test:live src/agents/models.profiles.live.test.ts`

- Un solo modelo, smoke del gateway:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Tool calling en varios proveedores:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,google/gemini-3-flash-preview,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Enfoque Google (clave de API de Gemini + Antigravity):
  - Gemini (clave API): `OPENCLAW_LIVE_GATEWAY_MODELS="google/gemini-3-flash-preview" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`
  - Antigravity (OAuth): `OPENCLAW_LIVE_GATEWAY_MODELS="google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-pro-high" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

Notas:

- `google/...` usa la API de Gemini (clave API).
- `google-antigravity/...` usa el puente OAuth de Antigravity (endpoint de agente estilo Cloud Code Assist).
- `google-gemini-cli/...` usa el CLI local de Gemini en su máquina (auth separada + peculiaridades de herramientas).
- API de Gemini vs CLI de Gemini:
  - API: OpenClaw llama a la API hospedada de Gemini de Google vía HTTP (clave API / auth de perfil); esto es lo que la mayoría de usuarios entiende por “Gemini”.
  - CLI: OpenClaw ejecuta un binario local `gemini`; tiene su propia auth y puede comportarse distinto (streaming/soporte de herramientas/desfase de versiones).

## En vivo: matriz de modelos (qué cubrimos)

No hay una “lista fija de modelos de CI” (en vivo es opt-in), pero estos son los modelos **recomendados** para cubrir regularmente en una máquina de desarrollo con claves.

### Conjunto moderno de smoke (tool calling + imagen)

Este es el conjunto de “modelos comunes” que esperamos que siga funcionando:

- OpenAI (no Codex): `openai/gpt-5.2` (opcional: `openai/gpt-5.1`)
- OpenAI Codex: `openai-codex/gpt-5.3-codex` (opcional: `openai-codex/gpt-5.3-codex-codex`)
- Anthropic: `anthropic/claude-opus-4-6` (o `anthropic/claude-sonnet-4-5`)
- Google (API de Gemini): `google/gemini-3-pro-preview` y `google/gemini-3-flash-preview` (evite modelos Gemini 2.x antiguos)
- Google (Antigravity): `google-antigravity/claude-opus-4-5-thinking` y `google-antigravity/gemini-3-flash`
- Z.AI (GLM): `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

Ejecute el smoke del gateway con herramientas + imagen:
`OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,openai-codex/gpt-5.3-codex,anthropic/claude-opus-4-6,google/gemini-3-pro-preview,google/gemini-3-flash-preview,google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-flash,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

### Base: tool calling (Read + Exec opcional)

Elija al menos uno por familia de proveedor:

- OpenAI: `openai/gpt-5.2` (o `openai/gpt-5-mini`)
- Anthropic: `anthropic/claude-opus-4-6` (o `anthropic/claude-sonnet-4-5`)
- Google: `google/gemini-3-flash-preview` (o `google/gemini-3-pro-preview`)
- Z.AI (GLM): `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

Cobertura adicional opcional (deseable):

- xAI: `xai/grok-4` (o el último disponible)
- Mistral: `mistral/`… (elija un modelo con “tools” habilitado)
- Cerebras: `cerebras/`… (si tiene acceso)
- LM Studio: `lmstudio/`… (local; el tool calling depende del modo API)

### Visión: envío de imagen (adjunto → mensaje multimodal)

Incluya al menos un modelo con capacidad de imagen en `OPENCLAW_LIVE_GATEWAY_MODELS` (variantes de Claude/Gemini/OpenAI con visión, etc.) para ejercitar la sonda de imagen.

### Agregadores / gateways alternativos

Si tiene claves habilitadas, también soportamos pruebas vía:

- OpenRouter: `openrouter/...` (cientos de modelos; use `openclaw models scan` para encontrar candidatos con herramientas+imagen)
- OpenCode Zen: `opencode/...` (auth vía `OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY`)

Más proveedores que puede incluir en la matriz en vivo (si tiene credenciales/config):

- Integrados: `openai`, `openai-codex`, `anthropic`, `google`, `google-vertex`, `google-antigravity`, `google-gemini-cli`, `zai`, `openrouter`, `opencode`, `xai`, `groq`, `cerebras`, `mistral`, `github-copilot`
- Vía `models.providers` (endpoints personalizados): `minimax` (cloud/API), además de cualquier proxy compatible con OpenAI/Anthropic (LM Studio, vLLM, LiteLLM, etc.)

Consejo: no intente codificar “todos los modelos” en los docs. La lista autoritativa es lo que `discoverModels(...)` devuelve en su máquina + las claves disponibles.

## Credenciales (nunca commit)

Las pruebas en vivo descubren credenciales de la misma forma que el CLI. Implicaciones prácticas:

- Si el CLI funciona, las pruebas en vivo deberían encontrar las mismas claves.
- Si una prueba en vivo dice “sin credenciales”, depure igual que lo haría para `openclaw models list` / selección de modelos.

- Almacén de perfiles: `~/.openclaw/credentials/` (preferido; lo que significa “claves de perfil” en las pruebas)
- Configuración: `~/.openclaw/openclaw.json` (o `OPENCLAW_CONFIG_PATH`)

Si quiere depender de claves de entorno (p. ej., exportadas en su `~/.profile`), ejecute pruebas locales después de `source ~/.profile`, o use los runners Docker de abajo (pueden montar `~/.profile` dentro del contenedor).

## Deepgram en vivo (transcripción de audio)

- Prueba: `src/media-understanding/providers/deepgram/audio.live.test.ts`
- Habilitar: `DEEPGRAM_API_KEY=... DEEPGRAM_LIVE_TEST=1 pnpm test:live src/media-understanding/providers/deepgram/audio.live.test.ts`

## Runners Docker (opcional “funciona en Linux”)

Estos ejecutan `pnpm test:live` dentro de la imagen Docker del repo, montando su directorio de configuración local y el workspace (y obteniendo `~/.profile` si está montado):

- Modelos directos: `pnpm test:docker:live-models` (script: `scripts/test-live-models-docker.sh`)
- Gateway + agente de desarrollo: `pnpm test:docker:live-gateway` (script: `scripts/test-live-gateway-models-docker.sh`)
- Asistente de onboarding (TTY, scaffolding completo): `pnpm test:docker:onboard` (script: `scripts/e2e/onboard-docker.sh`)
- Redes del gateway (dos contenedores, auth WS + salud): `pnpm test:docker:gateway-network` (script: `scripts/e2e/gateway-network-docker.sh`)
- Plugins (carga de extensión personalizada + smoke del registro): `pnpm test:docker:plugins` (script: `scripts/e2e/plugins-docker.sh`)

Variables de entorno útiles:

- `OPENCLAW_CONFIG_DIR=...` (predeterminado: `~/.openclaw`) montado en `/home/node/.openclaw`
- `OPENCLAW_WORKSPACE_DIR=...` (predeterminado: `~/.openclaw/workspace`) montado en `/home/node/.openclaw/workspace`
- `OPENCLAW_PROFILE_FILE=...` (predeterminado: `~/.profile`) montado en `/home/node/.profile` y obtenido antes de ejecutar pruebas
- `OPENCLAW_LIVE_GATEWAY_MODELS=...` / `OPENCLAW_LIVE_MODELS=...` para acotar la ejecución
- `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1` para asegurar que las credenciales provengan del almacén de perfiles (no del entorno)

## Cordura de documentación

Ejecute las comprobaciones de docs después de ediciones: `pnpm docs:list`.

## Regresión offline (segura para CI)

Estas son regresiones de “pipeline real” sin proveedores reales:

- Tool calling del gateway (OpenAI simulado, gateway + loop de agente reales): `src/gateway/gateway.tool-calling.mock-openai.test.ts`
- Asistente del gateway (WS `wizard.start`/`wizard.next`, escribe config + auth forzada): `src/gateway/gateway.wizard.e2e.test.ts`

## Evaluaciones de confiabilidad del agente (skills)

Ya tenemos algunas pruebas seguras para CI que se comportan como “evals de confiabilidad del agente”:

- Tool-calling simulado a través del gateway + loop del agente reales (`src/gateway/gateway.tool-calling.mock-openai.test.ts`).
- Flujos end-to-end del asistente que validan el cableado de sesión y los efectos de configuración (`src/gateway/gateway.wizard.e2e.test.ts`).

Lo que aún falta para skills (ver [Skills](/tools/skills)):

- **Toma de decisiones:** cuando las skills se listan en el prompt, ¿el agente elige la skill correcta (o evita las irrelevantes)?
- **Cumplimiento:** ¿el agente lee `SKILL.md` antes de usarla y sigue los pasos/args requeridos?
- **Contratos de flujo:** escenarios multi-turn que afirman el orden de herramientas, el arrastre del historial de sesión y los límites de sandbox.

Las evaluaciones futuras deberían ser deterministas primero:

- Un runner de escenarios usando proveedores simulados para afirmar llamadas a herramientas + orden, lecturas de archivos de skills y cableado de sesión.
- Un pequeño conjunto de escenarios enfocados en skills (usar vs evitar, gating, inyección de prompt).
- Evals en vivo opcionales (opt-in, controladas por env) solo después de que exista la suite segura para CI.

## Agregar regresiones (guía)

Cuando corrige un problema de proveedor/modelo descubierto en vivo:

- Agregue una regresión segura para CI si es posible (simule/encapsule el proveedor, o capture exactamente la transformación de la forma de la solicitud)
- Si es inherentemente solo en vivo (rate limits, políticas de auth), mantenga la prueba en vivo acotada y opt-in vía variables de entorno
- Prefiera apuntar a la capa más pequeña que capture el bug:
  - error de conversión/replay de solicitud del proveedor → prueba de modelos directos
  - error del pipeline de sesión/historial/herramientas del gateway → smoke en vivo del gateway o prueba simulada del gateway segura para CI
