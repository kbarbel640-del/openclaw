---
summary: "Cómo funciona el sandboxing de OpenClaw: modos, alcances, acceso al espacio de trabajo e imágenes"
title: Sandboxing
read_when: "Quiere una explicación dedicada del sandboxing o necesita ajustar agents.defaults.sandbox."
status: active
x-i18n:
  source_path: gateway/sandboxing.md
  source_hash: 184fc53001fc6b28
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:11Z
---

# Sandboxing

OpenClaw puede ejecutar **herramientas dentro de contenedores Docker** para reducir el radio de impacto.
Esto es **opcional** y está controlado por la configuración (`agents.defaults.sandbox` o
`agents.list[].sandbox`). Si el sandboxing está desactivado, las herramientas se ejecutan en el host.
El Gateway permanece en el host; la ejecución de herramientas se realiza en un sandbox aislado
cuando está habilitado.

Esto no es un límite de seguridad perfecto, pero limita materialmente el acceso al sistema de archivos
y a los procesos cuando el modelo hace algo incorrecto.

## Qué se ejecuta en sandbox

- Ejecución de herramientas (`exec`, `read`, `write`, `edit`, `apply_patch`, `process`, etc.).
- Navegador en sandbox opcional (`agents.defaults.sandbox.browser`).
  - De forma predeterminada, el navegador en sandbox se inicia automáticamente (asegura que CDP sea accesible) cuando la herramienta de navegador lo necesita.
    Configure mediante `agents.defaults.sandbox.browser.autoStart` y `agents.defaults.sandbox.browser.autoStartTimeoutMs`.
  - `agents.defaults.sandbox.browser.allowHostControl` permite que las sesiones en sandbox apunten explícitamente al navegador del host.
  - Las allowlists opcionales controlan `target: "custom"`: `allowedControlUrls`, `allowedControlHosts`, `allowedControlPorts`.

No se ejecuta en sandbox:

- El propio proceso del Gateway.
- Cualquier herramienta permitida explícitamente para ejecutarse en el host (p. ej., `tools.elevated`).
  - **La ejecución elevada se ejecuta en el host y omite el sandboxing.**
  - Si el sandboxing está desactivado, `tools.elevated` no cambia la ejecución (ya está en el host). Consulte [Elevated Mode](/tools/elevated).

## Modos

`agents.defaults.sandbox.mode` controla **cuándo** se usa el sandboxing:

- `"off"`: sin sandboxing.
- `"non-main"`: sandbox solo para sesiones **no principales** (predeterminado si desea chats normales en el host).
- `"all"`: cada sesión se ejecuta en un sandbox.
  Nota: `"non-main"` se basa en `session.mainKey` (predeterminado `"main"`), no en el id del agente.
  Las sesiones de grupo/canal usan sus propias claves, por lo que cuentan como no principales y se ejecutarán en sandbox.

## Alcance

`agents.defaults.sandbox.scope` controla **cuántos contenedores** se crean:

- `"session"` (predeterminado): un contenedor por sesión.
- `"agent"`: un contenedor por agente.
- `"shared"`: un contenedor compartido por todas las sesiones en sandbox.

## Acceso al espacio de trabajo

`agents.defaults.sandbox.workspaceAccess` controla **qué puede ver el sandbox**:

- `"none"` (predeterminado): las herramientas ven un espacio de trabajo en sandbox bajo `~/.openclaw/sandboxes`.
- `"ro"`: monta el espacio de trabajo del agente en solo lectura en `/agent` (deshabilita `write`/`edit`/`apply_patch`).
- `"rw"`: monta el espacio de trabajo del agente en lectura/escritura en `/workspace`.

Los medios entrantes se copian en el espacio de trabajo activo del sandbox (`media/inbound/*`).
Nota de Skills: la herramienta `read` está enraizada en el sandbox. Con `workspaceAccess: "none"`,
OpenClaw refleja las skills elegibles en el espacio de trabajo del sandbox (`.../skills`) para
que puedan leerse. Con `"rw"`, las skills del espacio de trabajo se pueden leer desde
`/workspace/skills`.

## Montajes bind personalizados

`agents.defaults.sandbox.docker.binds` monta directorios adicionales del host dentro del contenedor.
Formato: `host:container:mode` (p. ej., `"/home/user/source:/source:rw"`).

Los binds globales y por agente se **combinan** (no se reemplazan). Bajo `scope: "shared"`, los binds por agente se ignoran.

Ejemplo (origen de solo lectura + socket de docker):

```json5
{
  agents: {
    defaults: {
      sandbox: {
        docker: {
          binds: ["/home/user/source:/source:ro", "/var/run/docker.sock:/var/run/docker.sock"],
        },
      },
    },
    list: [
      {
        id: "build",
        sandbox: {
          docker: {
            binds: ["/mnt/cache:/cache:rw"],
          },
        },
      },
    ],
  },
}
```

Notas de seguridad:

- Los binds omiten el sistema de archivos del sandbox: exponen rutas del host con el modo que establezca (`:ro` o `:rw`).
- Los montajes sensibles (p. ej., `docker.sock`, secretos, claves SSH) deberían ser `:ro` salvo que sea absolutamente necesario.
- Combine con `workspaceAccess: "ro"` si solo necesita acceso de lectura al espacio de trabajo; los modos de bind permanecen independientes.
- Consulte [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) para ver cómo los binds interactúan con la política de herramientas y la ejecución elevada.

## Imágenes + configuración

Imagen predeterminada: `openclaw-sandbox:bookworm-slim`

Constrúyala una vez:

```bash
scripts/sandbox-setup.sh
```

Nota: la imagen predeterminada **no** incluye Node. Si una skill necesita Node (u
otros runtimes), cree una imagen personalizada o instale mediante
`sandbox.docker.setupCommand` (requiere salida de red + raíz escribible +
usuario root).

Imagen del navegador en sandbox:

```bash
scripts/sandbox-browser-setup.sh
```

De forma predeterminada, los contenedores en sandbox se ejecutan **sin red**.
Anule esto con `agents.defaults.sandbox.docker.network`.

Las instalaciones de Docker y el Gateway en contenedores viven aquí:
[Docker](/install/docker)

## setupCommand (configuración única del contenedor)

`setupCommand` se ejecuta **una sola vez** después de que se crea el contenedor del sandbox (no en cada ejecución).
Se ejecuta dentro del contenedor mediante `sh -lc`.

Rutas:

- Global: `agents.defaults.sandbox.docker.setupCommand`
- Por agente: `agents.list[].sandbox.docker.setupCommand`

Errores comunes:

- El `docker.network` predeterminado es `"none"` (sin salida), por lo que las instalaciones de paquetes fallarán.
- `readOnlyRoot: true` impide escrituras; establezca `readOnlyRoot: false` o cree una imagen personalizada.
- `user` debe ser root para instalaciones de paquetes (omita `user` o establezca `user: "0:0"`).
- La ejecución en sandbox **no** hereda las `process.env` del host. Use
  `agents.defaults.sandbox.docker.env` (o una imagen personalizada) para las claves de API de skills.

## Política de herramientas + vías de escape

Las políticas de permitir/denegar herramientas aún se aplican antes de las reglas de sandbox. Si una herramienta está denegada
globalmente o por agente, el sandboxing no la restaura.

`tools.elevated` es una vía de escape explícita que ejecuta `exec` en el host.
Las directivas `/exec` solo se aplican a remitentes autorizados y persisten por sesión; para deshabilitar
`exec` de forma estricta, use la denegación en la política de herramientas (consulte [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)).

Depuración:

- Use `openclaw sandbox explain` para inspeccionar el modo efectivo de sandbox, la política de herramientas y las claves de configuración de corrección.
- Consulte [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) para el modelo mental de “¿por qué está bloqueado?”.
  Manténgalo bloqueado.

## Anulaciones multiagente

Cada agente puede anular sandbox + herramientas:
`agents.list[].sandbox` y `agents.list[].tools` (además de `agents.list[].tools.sandbox.tools` para la política de herramientas del sandbox).
Consulte [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) para la precedencia.

## Ejemplo mínimo de habilitación

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
      },
    },
  },
}
```

## Documentos relacionados

- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)
- [Security](/gateway/security)
