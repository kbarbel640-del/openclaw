---
summary: "Uso de la herramienta Exec, modos de stdin y compatibilidad con TTY"
read_when:
  - Al usar o modificar la herramienta exec
  - Al depurar el comportamiento de stdin o TTY
title: "Herramienta Exec"
x-i18n:
  source_path: tools/exec.md
  source_hash: 3b32238dd8dce93d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:22Z
---

# Herramienta Exec

Ejecute comandos de shell en el espacio de trabajo. Admite ejecución en primer plano y en segundo plano mediante `process`.
Si `process` no está permitido, `exec` se ejecuta de forma sincrónica e ignora `yieldMs`/`background`.
Las sesiones en segundo plano tienen alcance por agente; `process` solo ve sesiones del mismo agente.

## Parámetros

- `command` (obligatorio)
- `workdir` (por defecto: cwd)
- `env` (sobrescrituras clave/valor)
- `yieldMs` (por defecto 10000): pasa automáticamente a segundo plano tras el retraso
- `background` (bool): segundo plano inmediato
- `timeout` (segundos, por defecto 1800): finalizar al expirar
- `pty` (bool): ejecutar en un pseudo-terminal cuando esté disponible (CLIs solo TTY, agentes de codificación, UIs de terminal)
- `host` (`sandbox | gateway | node`): dónde ejecutar
- `security` (`deny | allowlist | full`): modo de aplicación para `gateway`/`node`
- `ask` (`off | on-miss | always`): avisos de aprobación para `gateway`/`node`
- `node` (string): id/nombre de nodo para `host=node`
- `elevated` (bool): solicitar modo elevado (host del Gateway); `security=full` solo se fuerza cuando lo elevado se resuelve a `full`

Notas:

- `host` usa por defecto `sandbox`.
- `elevated` se ignora cuando sandboxing está desactivado (exec ya se ejecuta en el host).
- Las aprobaciones de `gateway`/`node` están controladas por `~/.openclaw/exec-approvals.json`.
- `node` requiere un nodo emparejado (aplicación complementaria o host de nodo sin interfaz).
- Si hay varios nodos disponibles, configure `exec.node` o `tools.exec.node` para seleccionar uno.
- En hosts que no son Windows, exec usa `SHELL` cuando está configurado; si `SHELL` es `fish`, prefiere `bash` (o `sh`)
  de `PATH` para evitar scripts incompatibles con fish, y luego recurre a `SHELL` si ninguno existe.
- La ejecución en el host (`gateway`/`node`) rechaza `env.PATH` y las sobrescrituras del cargador (`LD_*`/`DYLD_*`) para
  evitar el secuestro de binarios o la inyección de código.
- Importante: sandboxing está **desactivado por defecto**. Si sandboxing está desactivado, `host=sandbox` se ejecuta directamente en
  el host del Gateway (sin contenedor) y **no requiere aprobaciones**. Para exigir aprobaciones, ejecute con
  `host=gateway` y configure las aprobaciones de exec (o habilite sandboxing).

## Configuración

- `tools.exec.notifyOnExit` (por defecto: true): cuando es true, las sesiones de exec en segundo plano ponen en cola un evento del sistema y solicitan un latido al salir.
- `tools.exec.approvalRunningNoticeMs` (por defecto: 10000): emite un único aviso de “en ejecución” cuando un exec con aprobación tarda más que esto (0 lo desactiva).
- `tools.exec.host` (por defecto: `sandbox`)
- `tools.exec.security` (por defecto: `deny` para sandbox, `allowlist` para gateway + nodo cuando no está configurado)
- `tools.exec.ask` (por defecto: `on-miss`)
- `tools.exec.node` (por defecto: sin configurar)
- `tools.exec.pathPrepend`: lista de directorios para anteponer a `PATH` para ejecuciones de exec.
- `tools.exec.safeBins`: binarios seguros solo-stdin que pueden ejecutarse sin entradas explícitas en la allowlist.

Ejemplo:

```json5
{
  tools: {
    exec: {
      pathPrepend: ["~/bin", "/opt/oss/bin"],
    },
  },
}
```

### Manejo de PATH

- `host=gateway`: combina su `PATH` del shell de inicio de sesión en el entorno de exec. Las sobrescrituras de `env.PATH` son
  rechazadas para la ejecución en el host. El daemon en sí aún se ejecuta con un `PATH` mínimo:
  - macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
  - Linux: `/usr/local/bin`, `/usr/bin`, `/bin`
- `host=sandbox`: ejecuta `sh -lc` (shell de inicio de sesión) dentro del contenedor, por lo que `/etc/profile` puede restablecer `PATH`.
  OpenClaw antepone `env.PATH` después de cargar el perfil mediante una variable de entorno interna (sin interpolación del shell);
  `tools.exec.pathPrepend` también aplica aquí.
- `host=node`: solo las sobrescrituras de entorno no bloqueadas que usted pase se envían al nodo. Las sobrescrituras de `env.PATH` son
  rechazadas para la ejecución en el host. Los hosts de nodo sin interfaz aceptan `PATH` solo cuando antepone el PATH del host del nodo
  (sin reemplazo). Los nodos macOS descartan por completo las sobrescrituras de `PATH`.

Vinculación de nodo por agente (use el índice de la lista de agentes en la configuración):

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

UI de control: la pestaña Nodes incluye un pequeño panel “Exec node binding” para los mismos ajustes.

## Sobrescrituras de sesión (`/exec`)

Use `/exec` para establecer valores predeterminados **por sesión** para `host`, `security`, `ask` y `node`.
Envíe `/exec` sin argumentos para mostrar los valores actuales.

Ejemplo:

```
/exec host=gateway security=allowlist ask=on-miss node=mac-1
```

## Modelo de autorización

`/exec` solo se respeta para **remitentes autorizados** (allowlists de canal/emparejamiento más `commands.useAccessGroups`).
Actualiza **solo el estado de la sesión** y no escribe configuración. Para deshabilitar exec de forma definitiva, deniéguelo mediante la política
de herramientas (`tools.deny: ["exec"]` o por agente). Las aprobaciones del host siguen aplicando a menos que usted configure explícitamente
`security=full` y `ask=off`.

## Aprobaciones de exec (aplicación complementaria / host de nodo)

Los agentes en sandbox pueden requerir aprobación por solicitud antes de que `exec` se ejecute en el host del Gateway o del nodo.
Consulte [Exec approvals](/tools/exec-approvals) para conocer la política, la allowlist y el flujo de la UI.

Cuando se requieren aprobaciones, la herramienta exec devuelve de inmediato
`status: "approval-pending"` y un id de aprobación. Una vez aprobado (o denegado / con tiempo agotado),
el Gateway emite eventos del sistema (`Exec finished` / `Exec denied`). Si el comando sigue
ejecutándose después de `tools.exec.approvalRunningNoticeMs`, se emite un único aviso `Exec running`.

## Allowlist + binarios seguros

La aplicación de la allowlist coincide **solo con rutas de binarios resueltas** (no coincide por nombre base). Cuando
`security=allowlist`, los comandos de shell se permiten automáticamente solo si cada segmento del pipeline está
en la allowlist o es un binario seguro. El encadenamiento (`;`, `&&`, `||`) y las redirecciones se rechazan en
modo allowlist.

## Ejemplos

Primer plano:

```json
{ "tool": "exec", "command": "ls -la" }
```

Segundo plano + sondeo:

```json
{"tool":"exec","command":"npm run build","yieldMs":1000}
{"tool":"process","action":"poll","sessionId":"<id>"}
```

Enviar teclas (estilo tmux):

```json
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Enter"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["C-c"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Up","Up","Enter"]}
```

Enviar (solo CR):

```json
{ "tool": "process", "action": "submit", "sessionId": "<id>" }
```

Pegar (entre corchetes por defecto):

```json
{ "tool": "process", "action": "paste", "sessionId": "<id>", "text": "line1\nline2\n" }
```

## apply_patch (experimental)

`apply_patch` es una subherramienta de `exec` para ediciones estructuradas de múltiples archivos.
Habilítela explícitamente:

```json5
{
  tools: {
    exec: {
      applyPatch: { enabled: true, allowModels: ["gpt-5.2"] },
    },
  },
}
```

Notas:

- Solo disponible para modelos OpenAI/OpenAI Codex.
- La política de herramientas aún aplica; `allow: ["exec"]` permite implícitamente `apply_patch`.
- La configuración se encuentra bajo `tools.exec.applyPatch`.
