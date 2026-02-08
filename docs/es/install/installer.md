---
summary: "Cómo funcionan los scripts del instalador (install.sh + install-cli.sh), las flags y la automatización"
read_when:
  - Quiere entender `openclaw.ai/install.sh`
  - Quiere automatizar instalaciones (CI / sin interfaz)
  - Quiere instalar desde un checkout de GitHub
title: "Internos del instalador"
x-i18n:
  source_path: install/installer.md
  source_hash: 9e0a19ecb5da0a39
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:14Z
---

# Internos del instalador

OpenClaw incluye dos scripts de instalación (servidos desde `openclaw.ai`):

- `https://openclaw.ai/install.sh` — instalador “recomendado” (instalación global con npm por defecto; también puede instalar desde un checkout de GitHub)
- `https://openclaw.ai/install-cli.sh` — instalador de CLI amigable sin root (instala en un prefijo con su propio Node)
- `https://openclaw.ai/install.ps1` — instalador de Windows PowerShell (npm por defecto; instalación opcional vía git)

Para ver las flags y el comportamiento actuales, ejecute:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --help
```

Ayuda en Windows (PowerShell):

```powershell
& ([scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1))) -?
```

Si el instalador se completa pero `openclaw` no se encuentra en una nueva terminal, normalmente es un problema del PATH de Node/npm. Consulte: [Install](/install#nodejs--npm-path-sanity).

## install.sh (recomendado)

Qué hace (a alto nivel):

- Detecta el SO (macOS / Linux / WSL).
- Garantiza Node.js **22+** (macOS vía Homebrew; Linux vía NodeSource).
- Elige el método de instalación:
  - `npm` (predeterminado): `npm install -g openclaw@latest`
  - `git`: clona/compila un checkout del código fuente e instala un script envoltorio
- En Linux: evita errores de permisos de npm global cambiando el prefijo de npm a `~/.npm-global` cuando es necesario.
- Si actualiza una instalación existente: ejecuta `openclaw doctor --non-interactive` (mejor esfuerzo).
- Para instalaciones vía git: ejecuta `openclaw doctor --non-interactive` después de instalar/actualizar (mejor esfuerzo).
- Mitiga problemas de instalación nativa de `sharp` usando por defecto `SHARP_IGNORE_GLOBAL_LIBVIPS=1` (evita compilar contra libvips del sistema).

Si _quiere_ que `sharp` enlace contra un libvips instalado globalmente (o si está depurando), establezca:

```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=0 curl -fsSL https://openclaw.ai/install.sh | bash
```

### Descubribilidad / aviso de “git install”

Si ejecuta el instalador **ya dentro de un checkout del código fuente de OpenClaw** (detectado vía `package.json` + `pnpm-workspace.yaml`), se le solicita:

- actualizar y usar este checkout (`git`)
- o migrar a la instalación global con npm (`npm`)

En contextos no interactivos (sin TTY / `--no-prompt`), debe pasar `--install-method git|npm` (o establecer `OPENCLAW_INSTALL_METHOD`), de lo contrario el script sale con el código `2`.

### Por qué se necesita Git

Git es necesario para la ruta `--install-method git` (clonar / hacer pull).

Para instalaciones `npm`, Git _normalmente_ no es necesario, pero algunos entornos aún terminan necesitándolo (por ejemplo, cuando un paquete o dependencia se obtiene mediante una URL git). Actualmente el instalador garantiza que Git esté presente para evitar sorpresas de `spawn git ENOENT` en distribuciones nuevas.

### Por qué npm llega a `EACCES` en Linux recién instalado

En algunas configuraciones de Linux (especialmente después de instalar Node mediante el gestor de paquetes del sistema o NodeSource), el prefijo global de npm apunta a una ubicación propiedad de root. Entonces `npm install -g ...` falla con errores de permisos `EACCES` / `mkdir`.

`install.sh` mitiga esto cambiando el prefijo a:

- `~/.npm-global` (y agregándolo a `PATH` en `~/.bashrc` / `~/.zshrc` cuando existe)

## install-cli.sh (instalador de CLI sin root)

Este script instala `openclaw` en un prefijo (predeterminado: `~/.openclaw`) y también instala un runtime dedicado de Node bajo ese prefijo, para que pueda funcionar en máquinas donde no desea tocar el Node/npm del sistema.

Ayuda:

```bash
curl -fsSL https://openclaw.ai/install-cli.sh | bash -s -- --help
```

## install.ps1 (Windows PowerShell)

Qué hace (a alto nivel):

- Garantiza Node.js **22+** (winget/Chocolatey/Scoop o manual).
- Elige el método de instalación:
  - `npm` (predeterminado): `npm install -g openclaw@latest`
  - `git`: clona/compila un checkout del código fuente e instala un script envoltorio
- Ejecuta `openclaw doctor --non-interactive` en actualizaciones e instalaciones vía git (mejor esfuerzo).

Ejemplos:

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git
```

```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex -InstallMethod git -GitDir "C:\\openclaw"
```

Variables de entorno:

- `OPENCLAW_INSTALL_METHOD=git|npm`
- `OPENCLAW_GIT_DIR=...`

Requisito de Git:

Si elige `-InstallMethod git` y falta Git, el instalador imprimirá el
enlace de Git para Windows (`https://git-scm.com/download/win`) y saldrá.

Problemas comunes en Windows:

- **npm error spawn git / ENOENT**: instale Git para Windows y vuelva a abrir PowerShell, luego ejecute nuevamente el instalador.
- **"openclaw" no se reconoce**: la carpeta bin global de npm no está en el PATH. La mayoría de los sistemas usan
  `%AppData%\\npm`. También puede ejecutar `npm config get prefix` y agregar `\\bin` al PATH, luego vuelva a abrir PowerShell.
