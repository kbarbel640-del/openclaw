---
title: Sandbox vs Politica de herramientas vs Elevado
summary: "Por que una herramienta esta bloqueada: runtime de sandbox, politica de permitir/denegar herramientas y compuertas de ejecucion elevada"
read_when: "Usted se encuentra con una 'carcel de sandbox' o ve un rechazo de herramienta/elevado y quiere la clave de configuracion exacta que debe cambiar."
status: active
x-i18n:
  source_path: gateway/sandbox-vs-tool-policy-vs-elevated.md
  source_hash: 863ea5e6d137dfb6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:07Z
---

# Sandbox vs Politica de herramientas vs Elevado

OpenClaw tiene tres controles relacionados (pero diferentes):

1. **Sandbox** (`agents.defaults.sandbox.*` / `agents.list[].sandbox.*`) decide **donde se ejecutan las herramientas** (Docker vs host).
2. **Politica de herramientas** (`tools.*`, `tools.sandbox.tools.*`, `agents.list[].tools.*`) decide **que herramientas estan disponibles/permitidas**.
3. **Elevado** (`tools.elevated.*`, `agents.list[].tools.elevated.*`) es una **via de escape solo para exec** para ejecutarse en el host cuando usted esta en sandbox.

## Depuracion rapida

Use el inspector para ver lo que OpenClaw esta _realmente_ haciendo:

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

Imprime:

- modo/alcance/acceso al workspace efectivos del sandbox
- si la sesion esta actualmente en sandbox (principal vs no principal)
- permitir/denegar efectivo de herramientas en sandbox (y si provino de agente/global/por defecto)
- compuertas elevadas y rutas de claves de correccion

## Sandbox: donde se ejecutan las herramientas

El sandboxing esta controlado por `agents.defaults.sandbox.mode`:

- `"off"`: todo se ejecuta en el host.
- `"non-main"`: solo las sesiones no principales estan en sandbox (sorpresa comun para grupos/canales).
- `"all"`: todo esta en sandbox.

Vea [Sandboxing](/gateway/sandboxing) para la matriz completa (alcance, montajes de workspace, imagenes).

### Bind mounts (verificacion rapida de seguridad)

- `docker.binds` _perfora_ el sistema de archivos del sandbox: lo que usted monte es visible dentro del contenedor con el modo que configure (`:ro` o `:rw`).
- El valor por defecto es lectura-escritura si omite el modo; prefiera `:ro` para codigo fuente/secretos.
- `scope: "shared"` ignora los binds por agente (solo aplican los binds globales).
- Vincular `/var/run/docker.sock` efectivamente entrega el control del host al sandbox; hagalo solo de forma intencional.
- El acceso al workspace (`workspaceAccess: "ro"`/`"rw"`) es independiente de los modos de bind.

## Politica de herramientas: que herramientas existen/son invocables

Dos capas importan:

- **Perfil de herramientas**: `tools.profile` y `agents.list[].tools.profile` (lista base de permitidas)
- **Perfil de herramientas del proveedor**: `tools.byProvider[provider].profile` y `agents.list[].tools.byProvider[provider].profile`
- **Politica de herramientas global/por agente**: `tools.allow`/`tools.deny` y `agents.list[].tools.allow`/`agents.list[].tools.deny`
- **Politica de herramientas del proveedor**: `tools.byProvider[provider].allow/deny` y `agents.list[].tools.byProvider[provider].allow/deny`
- **Politica de herramientas del sandbox** (solo aplica cuando esta en sandbox): `tools.sandbox.tools.allow`/`tools.sandbox.tools.deny` y `agents.list[].tools.sandbox.tools.*`

Reglas practicas:

- `deny` siempre gana.
- Si `allow` no esta vacio, todo lo demas se trata como bloqueado.
- La politica de herramientas es el corte definitivo: `/exec` no puede anular una herramienta `exec` denegada.
- `/exec` solo cambia los valores por defecto de la sesion para remitentes autorizados; no otorga acceso a herramientas.
  Las claves de herramientas del proveedor aceptan ya sea `provider` (por ejemplo `google-antigravity`) o `provider/model` (por ejemplo `openai/gpt-5.2`).

### Grupos de herramientas (atajos)

Las politicas de herramientas (global, agente, sandbox) admiten entradas `group:*` que se expanden a multiples herramientas:

```json5
{
  tools: {
    sandbox: {
      tools: {
        allow: ["group:runtime", "group:fs", "group:sessions", "group:memory"],
      },
    },
  },
}
```

Grupos disponibles:

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: todas las herramientas integradas de OpenClaw (excluye plugins de proveedores)

## Elevado: exec-only “ejecutar en el host”

Elevado **no** concede herramientas adicionales; solo afecta a `exec`.

- Si usted esta en sandbox, `/elevated on` (o `exec` con `elevated: true`) se ejecuta en el host (las aprobaciones aun pueden aplicar).
- Use `/elevated full` para omitir aprobaciones de exec para la sesion.
- Si ya se esta ejecutando directo, elevado es efectivamente un no-op (sigue estando controlado).
- Elevado **no** tiene alcance por Skill y **no** anula permitir/denegar de herramientas.
- `/exec` es separado de elevado. Solo ajusta los valores por defecto de exec por sesion para remitentes autorizados.

Compuertas:

- Habilitacion: `tools.elevated.enabled` (y opcionalmente `agents.list[].tools.elevated.enabled`)
- Listas de permitidos de remitentes: `tools.elevated.allowFrom.<provider>` (y opcionalmente `agents.list[].tools.elevated.allowFrom.<provider>`)

Vea [Elevated Mode](/tools/elevated).

## Correcciones comunes de “carcel de sandbox”

### “Herramienta X bloqueada por la politica de herramientas del sandbox”

Claves de correccion (elija una):

- Deshabilitar sandbox: `agents.defaults.sandbox.mode=off` (o por agente `agents.list[].sandbox.mode=off`)
- Permitir la herramienta dentro del sandbox:
  - eliminarla de `tools.sandbox.tools.deny` (o por agente `agents.list[].tools.sandbox.tools.deny`)
  - o agregarla a `tools.sandbox.tools.allow` (o permitir por agente)

### “Pense que esto era principal, ¿por que esta en sandbox?”

En el modo `"non-main"`, las claves de grupo/canal _no_ son principales. Use la clave de sesion principal (mostrada por `sandbox explain`) o cambie el modo a `"off"`.
