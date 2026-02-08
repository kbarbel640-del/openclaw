---
summary: "Mover (migrar) una instalación de OpenClaw de una máquina a otra"
read_when:
  - Está moviendo OpenClaw a una nueva laptop/servidor
  - Quiere conservar sesiones, autenticación e inicios de sesión de canales (WhatsApp, etc.)
title: "Guía de Migración"
x-i18n:
  source_path: install/migrating.md
  source_hash: 604d862c4bf86e79
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:17Z
---

# Migrar OpenClaw a una nueva máquina

Esta guía migra un Gateway de OpenClaw de una máquina a otra **sin rehacer la incorporación**.

La migración es conceptualmente simple:

- Copiar el **directorio de estado** (`$OPENCLAW_STATE_DIR`, predeterminado: `~/.openclaw/`) — esto incluye configuración, autenticación, sesiones y estado de canales.
- Copiar su **workspace** (`~/.openclaw/workspace/` de forma predeterminada) — esto incluye sus archivos de agente (memoria, prompts, etc.).

Pero hay errores comunes relacionados con **perfiles**, **permisos** y **copias parciales**.

## Antes de empezar (qué está migrando)

### 1) Identifique su directorio de estado

La mayoría de las instalaciones usan el valor predeterminado:

- **Directorio de estado:** `~/.openclaw/`

Pero puede ser diferente si usa:

- `--profile <name>` (a menudo se convierte en `~/.openclaw-<profile>/`)
- `OPENCLAW_STATE_DIR=/some/path`

Si no está seguro, ejecute en la máquina **antigua**:

```bash
openclaw status
```

Busque menciones de `OPENCLAW_STATE_DIR` / perfil en la salida. Si ejecuta múltiples gateways, repita para cada perfil.

### 2) Identifique su workspace

Valores predeterminados comunes:

- `~/.openclaw/workspace/` (workspace recomendado)
- una carpeta personalizada que usted creó

Su workspace es donde viven archivos como `MEMORY.md`, `USER.md` y `memory/*.md`.

### 3) Comprenda qué se conservará

Si copia **tanto** el directorio de estado como el workspace, conserva:

- Configuración del Gateway (`openclaw.json`)
- Perfiles de autenticación / claves de API / tokens OAuth
- Historial de sesiones + estado del agente
- Estado de canales (p. ej., inicio de sesión/sesión de WhatsApp)
- Sus archivos del workspace (memoria, notas de Skills, etc.)

Si copia **solo** el workspace (p. ej., vía Git), **no** conserva:

- sesiones
- credenciales
- inicios de sesión de canales

Estos viven bajo `$OPENCLAW_STATE_DIR`.

## Pasos de migración (recomendado)

### Paso 0 — Hacer un respaldo (máquina antigua)

En la máquina **antigua**, detenga primero el gateway para que los archivos no cambien a mitad de la copia:

```bash
openclaw gateway stop
```

(Opcional pero recomendado) archive el directorio de estado y el workspace:

```bash
# Adjust paths if you use a profile or custom locations
cd ~
tar -czf openclaw-state.tgz .openclaw

tar -czf openclaw-workspace.tgz .openclaw/workspace
```

Si tiene múltiples perfiles/directorios de estado (p. ej., `~/.openclaw-main`, `~/.openclaw-work`), archive cada uno.

### Paso 1 — Instalar OpenClaw en la nueva máquina

En la máquina **nueva**, instale la CLI (y Node si es necesario):

- Ver: [Install](/install)

En esta etapa, está bien si la incorporación crea un `~/.openclaw/` nuevo — lo sobrescribirá en el siguiente paso.

### Paso 2 — Copiar el directorio de estado + workspace a la nueva máquina

Copie **ambos**:

- `$OPENCLAW_STATE_DIR` (predeterminado `~/.openclaw/`)
- su workspace (predeterminado `~/.openclaw/workspace/`)

Enfoques comunes:

- `scp` los tarballs y extraer
- `rsync -a` por SSH
- unidad externa

Después de copiar, asegúrese de que:

- Se incluyeron los directorios ocultos (p. ej., `.openclaw/`)
- La propiedad de archivos sea correcta para el usuario que ejecuta el gateway

### Paso 3 — Ejecutar Doctor (migraciones + reparación de servicios)

En la máquina **nueva**:

```bash
openclaw doctor
```

Doctor es el comando “seguro y aburrido”. Repara servicios, aplica migraciones de configuración y advierte sobre incompatibilidades.

Luego:

```bash
openclaw gateway restart
openclaw status
```

## Errores comunes (y cómo evitarlos)

### Error común: discrepancia de perfil / directorio de estado

Si ejecutó el gateway antiguo con un perfil (o `OPENCLAW_STATE_DIR`), y el gateway nuevo usa uno diferente, verá síntomas como:

- cambios de configuración que no surten efecto
- canales ausentes / cerrados
- historial de sesiones vacío

Solución: ejecute el gateway/servicio usando el **mismo** perfil/directorio de estado que migró y luego vuelva a ejecutar:

```bash
openclaw doctor
```

### Error común: copiar solo `openclaw.json`

`openclaw.json` no es suficiente. Muchos proveedores almacenan estado bajo:

- `$OPENCLAW_STATE_DIR/credentials/`
- `$OPENCLAW_STATE_DIR/agents/<agentId>/...`

Siempre migre la carpeta `$OPENCLAW_STATE_DIR` completa.

### Error común: permisos / propiedad

Si copió como root o cambió de usuario, el gateway puede no poder leer credenciales/sesiones.

Solución: asegúrese de que el directorio de estado y el workspace pertenezcan al usuario que ejecuta el gateway.

### Error común: migrar entre modos remoto/local

- Si su UI (WebUI/TUI) apunta a un gateway **remoto**, el host remoto es el propietario del almacén de sesiones y del workspace.
- Migrar su laptop no moverá el estado del gateway remoto.

Si está en modo remoto, migre el **host del gateway**.

### Error común: secretos en respaldos

`$OPENCLAW_STATE_DIR` contiene secretos (claves de API, tokens OAuth, credenciales de WhatsApp). Trate los respaldos como secretos de producción:

- almacénelos cifrados
- evite compartirlos por canales inseguros
- rote las claves si sospecha exposición

## Lista de verificación de validación

En la máquina nueva, confirme:

- `openclaw status` muestra el gateway en ejecución
- Sus canales siguen conectados (p. ej., WhatsApp no requiere volver a emparejar)
- El panel se abre y muestra sesiones existentes
- Sus archivos del workspace (memoria, configuraciones) están presentes

## Relacionado

- [Doctor](/gateway/doctor)
- [Solucion de problemas del Gateway](/gateway/troubleshooting)
- [¿Dónde almacena OpenClaw sus datos?](/help/faq#where-does-openclaw-store-its-data)
