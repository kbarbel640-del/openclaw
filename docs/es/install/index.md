---
summary: "Instalar OpenClaw (instalador recomendado, instalación global o desde el código fuente)"
read_when:
  - Instalando OpenClaw
  - Quiere instalar desde GitHub
title: "Resumen de instalación"
x-i18n:
  source_path: install/index.md
  source_hash: 228056bb0a2176b8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:12Z
---

# Resumen de instalación

Use el instalador a menos que tenga una razón para no hacerlo. Configura la CLI y ejecuta la incorporación.

## Instalación rápida (recomendada)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Windows (PowerShell):

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

Siguiente paso (si omitió la incorporación):

```bash
openclaw onboard --install-daemon
```

## Requisitos del sistema

- **Node >=22**
- macOS, Linux o Windows mediante WSL2
- `pnpm` solo si compila desde el código fuente

## Elija su ruta de instalación

### 1) Script de instalación (recomendado)

Instala `openclaw` globalmente mediante npm y ejecuta la incorporación.

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Opciones del instalador:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Detalles: [Internos del instalador](/install/installer).

No interactivo (omitir incorporación):

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

### 2) Instalación global (manual)

Si ya tiene Node:

```bash
npm install -g openclaw@latest
```

Si tiene libvips instalado globalmente (común en macOS vía Homebrew) y `sharp` no se instala, fuerce binarios precompilados:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install -g openclaw@latest
```

Si ve `sharp: Please add node-gyp to your dependencies`, instale las herramientas de compilación (macOS: Xcode CLT + `npm install -g node-gyp`) o use la solución alternativa `SHARP_IGNORE_GLOBAL_LIBVIPS=1` anterior para omitir la compilación nativa.

O con pnpm:

```bash
pnpm add -g openclaw@latest
pnpm approve-builds -g                # approve openclaw, node-llama-cpp, sharp, etc.
```

pnpm requiere aprobación explícita para paquetes con scripts de compilación. Después de que la primera instalación muestre la advertencia "Ignored build scripts", ejecute `pnpm approve-builds -g` y seleccione los paquetes listados.

Luego:

```bash
openclaw onboard --install-daemon
```

### 3) Desde el código fuente (colaboradores/dev)

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pnpm install
pnpm ui:build # auto-installs UI deps on first run
pnpm build
openclaw onboard --install-daemon
```

Consejo: si aún no tiene una instalación global, ejecute los comandos del repositorio mediante `pnpm openclaw ...`.

Para flujos de trabajo de desarrollo más profundos, consulte [Configuración](/start/setup).

### 4) Otras opciones de instalación

- Docker: [Docker](/install/docker)
- Nix: [Nix](/install/nix)
- Ansible: [Ansible](/install/ansible)
- Bun (solo CLI): [Bun](/install/bun)

## Después de la instalación

- Ejecutar la incorporación: `openclaw onboard --install-daemon`
- Comprobación rápida: `openclaw doctor`
- Comprobar el estado del Gateway: `openclaw status` + `openclaw health`
- Abrir el panel: `openclaw dashboard`

## Método de instalación: npm vs git (instalador)

El instalador admite dos métodos:

- `npm` (predeterminado): `npm install -g openclaw@latest`
- `git`: clonar/compilar desde GitHub y ejecutar desde un checkout del código fuente

### Opciones de la CLI

```bash
# Explicit npm
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method npm

# Install from GitHub (source checkout)
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git
```

Opciones comunes:

- `--install-method npm|git`
- `--git-dir <path>` (predeterminado: `~/openclaw`)
- `--no-git-update` (omitir `git pull` cuando se usa un checkout existente)
- `--no-prompt` (deshabilitar indicaciones; requerido en CI/automatización)
- `--dry-run` (imprimir lo que sucedería; no realizar cambios)
- `--no-onboard` (omitir incorporación)

### Variables de entorno

Variables de entorno equivalentes (útiles para automatización):

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`
- `OPENCLAW_GIT_UPDATE=0|1`
- `OPENCLAW_NO_PROMPT=1`
- `OPENCLAW_DRY_RUN=1`
- `OPENCLAW_NO_ONBOARD=1`
- `SHARP_IGNORE_GLOBAL_LIBVIPS=0|1` (predeterminado: `1`; evita que `sharp` compile contra libvips del sistema)

## Solución de problemas: `openclaw` no encontrado (PATH)

Diagnóstico rápido:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

Si `$(npm prefix -g)/bin` (macOS/Linux) o `$(npm prefix -g)` (Windows) **no** está presente dentro de `echo "$PATH"`, su shell no puede encontrar los binarios globales de npm (incluido `openclaw`).

Solución: agréguelo a su archivo de inicio del shell (zsh: `~/.zshrc`, bash: `~/.bashrc`):

```bash
# macOS / Linux
export PATH="$(npm prefix -g)/bin:$PATH"
```

En Windows, agregue la salida de `npm prefix -g` a su PATH.

Luego abra una nueva terminal (o `rehash` en zsh / `hash -r` en bash).

## Actualizar / desinstalar

- Actualizaciones: [Actualización](/install/updating)
- Migrar a una nueva máquina: [Migración](/install/migrating)
- Desinstalar: [Desinstalar](/install/uninstall)
