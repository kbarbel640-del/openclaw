---
title: CLI de Sandbox
summary: "Gestionar contenedores de sandbox e inspeccionar la política efectiva de sandbox"
read_when: "Usted está gestionando contenedores de sandbox o depurando el comportamiento de sandbox/política de herramientas."
status: active
x-i18n:
  source_path: cli/sandbox.md
  source_hash: 6e1186f26c77e188
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:21Z
---

# CLI de Sandbox

Gestione contenedores de sandbox basados en Docker para la ejecución aislada de agentes.

## Descripción general

OpenClaw puede ejecutar agentes en contenedores Docker aislados por seguridad. Los comandos `sandbox` le ayudan a gestionar estos contenedores, especialmente después de actualizaciones o cambios de configuración.

## Comandos

### `openclaw sandbox explain`

Inspeccione el modo/alcance/acceso al espacio de trabajo **efectivo** del sandbox, la política de herramientas del sandbox y las puertas elevadas (con rutas de claves de configuración para correcciones).

```bash
openclaw sandbox explain
openclaw sandbox explain --session agent:main:main
openclaw sandbox explain --agent work
openclaw sandbox explain --json
```

### `openclaw sandbox list`

Enumere todos los contenedores de sandbox con su estado y configuración.

```bash
openclaw sandbox list
openclaw sandbox list --browser  # List only browser containers
openclaw sandbox list --json     # JSON output
```

**La salida incluye:**

- Nombre y estado del contenedor (en ejecución/detenido)
- Imagen de Docker y si coincide con la configuración
- Antigüedad (tiempo desde la creación)
- Tiempo de inactividad (tiempo desde el último uso)
- Sesión/agente asociado

### `openclaw sandbox recreate`

Elimine contenedores de sandbox para forzar su recreación con imágenes/configuración actualizadas.

```bash
openclaw sandbox recreate --all                # Recreate all containers
openclaw sandbox recreate --session main       # Specific session
openclaw sandbox recreate --agent mybot        # Specific agent
openclaw sandbox recreate --browser            # Only browser containers
openclaw sandbox recreate --all --force        # Skip confirmation
```

**Opciones:**

- `--all`: Recrear todos los contenedores de sandbox
- `--session <key>`: Recrear el contenedor para una sesión específica
- `--agent <id>`: Recrear contenedores para un agente específico
- `--browser`: Solo recrear contenedores del navegador
- `--force`: Omitir el aviso de confirmación

**Importante:** Los contenedores se recrean automáticamente cuando el agente se utiliza por primera vez después.

## Casos de uso

### Después de actualizar imágenes de Docker

```bash
# Pull new image
docker pull openclaw-sandbox:latest
docker tag openclaw-sandbox:latest openclaw-sandbox:bookworm-slim

# Update config to use new image
# Edit config: agents.defaults.sandbox.docker.image (or agents.list[].sandbox.docker.image)

# Recreate containers
openclaw sandbox recreate --all
```

### Después de cambiar la configuración del sandbox

```bash
# Edit config: agents.defaults.sandbox.* (or agents.list[].sandbox.*)

# Recreate to apply new config
openclaw sandbox recreate --all
```

### Después de cambiar setupCommand

```bash
openclaw sandbox recreate --all
# or just one agent:
openclaw sandbox recreate --agent family
```

### Para un agente específico únicamente

```bash
# Update only one agent's containers
openclaw sandbox recreate --agent alfred
```

## ¿Por qué es necesario?

**Problema:** Cuando usted actualiza imágenes de Docker del sandbox o la configuración:

- Los contenedores existentes continúan ejecutándose con configuraciones antiguas
- Los contenedores solo se depuran después de 24 h de inactividad
- Los agentes de uso frecuente mantienen contenedores antiguos ejecutándose indefinidamente

**Solución:** Use `openclaw sandbox recreate` para forzar la eliminación de contenedores antiguos. Se recrearán automáticamente con la configuración actual cuando se necesiten nuevamente.

Consejo: prefiera `openclaw sandbox recreate` sobre `docker rm` manual. Utiliza el esquema de nombres de contenedores del Gateway y evita desajustes cuando cambian las claves de alcance/sesión.

## Configuración

La configuración del sandbox se encuentra en `~/.openclaw/openclaw.json` bajo `agents.defaults.sandbox` (las anulaciones por agente van en `agents.list[].sandbox`):

```jsonc
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all", // off, non-main, all
        "scope": "agent", // session, agent, shared
        "docker": {
          "image": "openclaw-sandbox:bookworm-slim",
          "containerPrefix": "openclaw-sbx-",
          // ... more Docker options
        },
        "prune": {
          "idleHours": 24, // Auto-prune after 24h idle
          "maxAgeDays": 7, // Auto-prune after 7 days
        },
      },
    },
  },
}
```

## Ver también

- [Documentación de Sandbox](/gateway/sandboxing)
- [Configuración del agente](/concepts/agent-workspace)
- [Comando Doctor](/gateway/doctor) - Verificar la configuración del sandbox
