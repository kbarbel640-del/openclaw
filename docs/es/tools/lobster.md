---
title: Lobster
summary: "Runtime de flujos de trabajo tipado para OpenClaw con compuertas de aprobacion reanudables."
description: Runtime de flujos de trabajo tipado para OpenClaw — pipelines componibles con compuertas de aprobacion.
read_when:
  - Quiere flujos de trabajo deterministas de varios pasos con aprobaciones explicitas
  - Necesita reanudar un flujo de trabajo sin volver a ejecutar pasos anteriores
x-i18n:
  source_path: tools/lobster.md
  source_hash: ff84e65f4be162ad
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:27Z
---

# Lobster

Lobster es un shell de flujos de trabajo que permite a OpenClaw ejecutar secuencias de herramientas de varios pasos como una sola operacion determinista con puntos de control de aprobacion explicitos.

## Hook

Su asistente puede crear las herramientas que se gestionan a si mismas. Pida un flujo de trabajo y, 30 minutos despues, tendra una CLI mas pipelines que se ejecutan como una sola llamada. Lobster es la pieza que faltaba: pipelines deterministas, aprobaciones explicitas y estado reanudable.

## Por que

Hoy, los flujos de trabajo complejos requieren muchas llamadas de herramientas de ida y vuelta. Cada llamada cuesta tokens, y el LLM tiene que orquestar cada paso. Lobster mueve esa orquestacion a un runtime tipado:

- **Una llamada en lugar de muchas**: OpenClaw ejecuta una llamada de herramienta de Lobster y obtiene un resultado estructurado.
- **Aprobaciones integradas**: Los efectos secundarios (enviar correo, publicar comentario) detienen el flujo de trabajo hasta que se aprueban explicitamente.
- **Reanudable**: Los flujos de trabajo detenidos devuelven un token; apruebe y reanude sin volver a ejecutar todo.

## ¿Por que un DSL en lugar de programas simples?

Lobster es intencionalmente pequeno. El objetivo no es “un nuevo lenguaje”, sino una especificacion de pipeline predecible y amigable para la IA, con aprobaciones de primera clase y tokens de reanudacion.

- **Aprobar/reanudar esta integrado**: Un programa normal puede pedir a un humano, pero no puede _pausar y reanudar_ con un token duradero sin que usted invente ese runtime por su cuenta.
- **Determinismo + auditabilidad**: Los pipelines son datos, por lo que son faciles de registrar, comparar, reproducir y revisar.
- **Superficie restringida para IA**: Una gramatica pequena + canalizacion JSON reduce rutas de codigo “creativas” y hace viable la validacion.
- **Politica de seguridad incorporada**: Tiempos de espera, limites de salida, comprobaciones de sandbox y allowlists se aplican por el runtime, no por cada script.
- **Sigue siendo programable**: Cada paso puede llamar a cualquier CLI o script. Si quiere JS/TS, genere archivos `.lobster` desde codigo.

## Como funciona

OpenClaw inicia la CLI local `lobster` en **modo herramienta** y analiza un sobre JSON desde stdout.
Si el pipeline se pausa para aprobacion, la herramienta devuelve un `resumeToken` para que pueda continuar mas tarde.

## Patron: CLI pequena + pipes JSON + aprobaciones

Construya comandos pequenos que hablen JSON y luego encadenelos en una sola llamada de Lobster. (Nombres de comandos de ejemplo abajo — sustituyalos por los suyos.)

```bash
inbox list --json
inbox categorize --json
inbox apply --json
```

```json
{
  "action": "run",
  "pipeline": "exec --json --shell 'inbox list --json' | exec --stdin json --shell 'inbox categorize --json' | exec --stdin json --shell 'inbox apply --json' | approve --preview-from-stdin --limit 5 --prompt 'Apply changes?'",
  "timeoutMs": 30000
}
```

Si el pipeline solicita aprobacion, reanude con el token:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

La IA activa el flujo de trabajo; Lobster ejecuta los pasos. Las compuertas de aprobacion mantienen los efectos secundarios explicitos y auditables.

Ejemplo: mapear elementos de entrada en llamadas de herramientas:

```bash
gog.gmail.search --query 'newer_than:1d' \
  | openclaw.invoke --tool message --action send --each --item-key message --args-json '{"provider":"telegram","to":"..."}'
```

## Pasos LLM solo-JSON (llm-task)

Para flujos de trabajo que necesitan un **paso LLM estructurado**, habilite la herramienta plugin opcional
`llm-task` y llamela desde Lobster. Esto mantiene el flujo de trabajo
determinista mientras le permite clasificar/resumir/redactar con un modelo.

Habilite la herramienta:

```json
{
  "plugins": {
    "entries": {
      "llm-task": { "enabled": true }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": { "allow": ["llm-task"] }
      }
    ]
  }
}
```

Use la herramienta en un pipeline:

```lobster
openclaw.invoke --tool llm-task --action json --args-json '{
  "prompt": "Given the input email, return intent and draft.",
  "input": { "subject": "Hello", "body": "Can you help?" },
  "schema": {
    "type": "object",
    "properties": {
      "intent": { "type": "string" },
      "draft": { "type": "string" }
    },
    "required": ["intent", "draft"],
    "additionalProperties": false
  }
}'
```

Vea [LLM Task](/tools/llm-task) para detalles y opciones de configuracion.

## Archivos de flujo de trabajo (.lobster)

Lobster puede ejecutar archivos de flujo de trabajo YAML/JSON con los campos `name`, `args`, `steps`, `env`, `condition` y `approval`. En llamadas de herramienta de OpenClaw, establezca `pipeline` en la ruta del archivo.

```yaml
name: inbox-triage
args:
  tag:
    default: "family"
steps:
  - id: collect
    command: inbox list --json
  - id: categorize
    command: inbox categorize --json
    stdin: $collect.stdout
  - id: approve
    command: inbox apply --approve
    stdin: $categorize.stdout
    approval: required
  - id: execute
    command: inbox apply --execute
    stdin: $categorize.stdout
    condition: $approve.approved
```

Notas:

- `stdin: $step.stdout` y `stdin: $step.json` pasan la salida de un paso previo.
- `condition` (o `when`) puede bloquear pasos segun `$step.approved`.

## Instalar Lobster

Instale la CLI de Lobster en el **mismo host** que ejecuta el Gateway de OpenClaw (vea el [repositorio de Lobster](https://github.com/openclaw/lobster)) y asegurese de que `lobster` este en `PATH`.
Si desea usar una ubicacion personalizada del binario, pase un `lobsterPath` **absoluto** en la llamada de herramienta.

## Habilitar la herramienta

Lobster es una herramienta plugin **opcional** (no habilitada por defecto).

Recomendado (aditivo, seguro):

```json
{
  "tools": {
    "alsoAllow": ["lobster"]
  }
}
```

O por agente:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "alsoAllow": ["lobster"]
        }
      }
    ]
  }
}
```

Evite usar `tools.allow: ["lobster"]` a menos que pretenda ejecutar en modo de allowlist restrictivo.

Nota: las allowlists son opt-in para plugins opcionales. Si su allowlist solo nombra
herramientas plugin (como `lobster`), OpenClaw mantiene habilitadas las herramientas principales. Para restringir herramientas principales,
incluya tambien las herramientas o grupos principales que desee en la allowlist.

## Ejemplo: clasificacion de correos

Sin Lobster:

```
User: "Check my email and draft replies"
→ openclaw calls gmail.list
→ LLM summarizes
→ User: "draft replies to #2 and #5"
→ LLM drafts
→ User: "send #2"
→ openclaw calls gmail.send
(repeat daily, no memory of what was triaged)
```

Con Lobster:

```json
{
  "action": "run",
  "pipeline": "email.triage --limit 20",
  "timeoutMs": 30000
}
```

Devuelve un sobre JSON (truncado):

```json
{
  "ok": true,
  "status": "needs_approval",
  "output": [{ "summary": "5 need replies, 2 need action" }],
  "requiresApproval": {
    "type": "approval_request",
    "prompt": "Send 2 draft replies?",
    "items": [],
    "resumeToken": "..."
  }
}
```

El usuario aprueba → reanudar:

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

Un flujo de trabajo. Determinista. Seguro.

## Parametros de la herramienta

### `run`

Ejecutar un pipeline en modo herramienta.

```json
{
  "action": "run",
  "pipeline": "gog.gmail.search --query 'newer_than:1d' | email.triage",
  "cwd": "/path/to/workspace",
  "timeoutMs": 30000,
  "maxStdoutBytes": 512000
}
```

Ejecutar un archivo de flujo de trabajo con argumentos:

```json
{
  "action": "run",
  "pipeline": "/path/to/inbox-triage.lobster",
  "argsJson": "{\"tag\":\"family\"}"
}
```

### `resume`

Continuar un flujo de trabajo detenido despues de la aprobacion.

```json
{
  "action": "resume",
  "token": "<resumeToken>",
  "approve": true
}
```

### Entradas opcionales

- `lobsterPath`: Ruta absoluta al binario de Lobster (omitir para usar `PATH`).
- `cwd`: Directorio de trabajo para el pipeline (por defecto, el directorio de trabajo del proceso actual).
- `timeoutMs`: Mata el subproceso si excede esta duracion (por defecto: 20000).
- `maxStdoutBytes`: Mata el subproceso si stdout excede este tamano (por defecto: 512000).
- `argsJson`: Cadena JSON pasada a `lobster run --args-json` (solo archivos de flujo de trabajo).

## Sobre de salida

Lobster devuelve un sobre JSON con uno de tres estados:

- `ok` → finalizado con exito
- `needs_approval` → en pausa; se requiere `requiresApproval.resumeToken` para reanudar
- `cancelled` → denegado o cancelado explicitamente

La herramienta muestra el sobre tanto en `content` (JSON con formato) como en `details` (objeto sin procesar).

## Aprobaciones

Si `requiresApproval` esta presente, inspeccione el prompt y decida:

- `approve: true` → reanudar y continuar los efectos secundarios
- `approve: false` → cancelar y finalizar el flujo de trabajo

Use `approve --preview-from-stdin --limit N` para adjuntar una vista previa JSON a las solicitudes de aprobacion sin pegamento personalizado de jq/heredoc. Los tokens de reanudacion ahora son compactos: Lobster almacena el estado de reanudacion del flujo de trabajo bajo su directorio de estado y devuelve una pequena clave de token.

## OpenProse

OpenProse se combina bien con Lobster: use `/prose` para orquestar preparacion multiagente y luego ejecute un pipeline de Lobster para aprobaciones deterministas. Si un programa Prose necesita Lobster, permita la herramienta `lobster` para subagentes mediante `tools.subagents.tools`. Vea [OpenProse](/prose).

## Seguridad

- **Solo subprocesos locales** — sin llamadas de red desde el propio plugin.
- **Sin secretos** — Lobster no gestiona OAuth; llama a herramientas de OpenClaw que si lo hacen.
- **Consciente del sandbox** — deshabilitado cuando el contexto de la herramienta esta en sandbox.
- **Endurecido** — `lobsterPath` debe ser absoluto si se especifica; se aplican tiempos de espera y limites de salida.

## Solucion de problemas

- **`lobster subprocess timed out`** → aumente `timeoutMs` o divida un pipeline largo.
- **`lobster output exceeded maxStdoutBytes`** → eleve `maxStdoutBytes` o reduzca el tamano de la salida.
- **`lobster returned invalid JSON`** → asegurese de que el pipeline se ejecute en modo herramienta e imprima solo JSON.
- **`lobster failed (code …)`** → ejecute el mismo pipeline en una terminal para inspeccionar stderr.

## Aprender mas

- [Plugins](/plugin)
- [Creacion de herramientas plugin](/plugins/agent-tools)

## Estudio de caso: flujos de trabajo comunitarios

Un ejemplo publico: una CLI de “segundo cerebro” + pipelines de Lobster que gestionan tres almacenes Markdown (personal, socio, compartido). La CLI emite JSON para estadisticas, listados de bandeja de entrada y escaneos de obsolescencia; Lobster encadena esos comandos en flujos de trabajo como `weekly-review`, `inbox-triage`, `memory-consolidation` y `shared-task-sync`, cada uno con compuertas de aprobacion. La IA maneja el juicio (categorizacion) cuando esta disponible y recurre a reglas deterministas cuando no.

- Hilo: https://x.com/plattenschieber/status/2014508656335770033
- Repo: https://github.com/bloomedai/brain-cli
