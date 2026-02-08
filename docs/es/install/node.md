---
title: "Node.js + npm (sanidad de PATH)"
summary: "Sanidad de instalación de Node.js + npm: versiones, PATH e instalaciones globales"
read_when:
  - "Instaló OpenClaw pero `openclaw` aparece como “command not found”"
  - "Está configurando Node.js/npm en una máquina nueva"
  - "npm install -g ... falla por permisos o problemas de PATH"
x-i18n:
  source_path: install/node.md
  source_hash: 9f6d83be362e3e14
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:12Z
---

# Node.js + npm (sanidad de PATH)

La línea base de ejecución de OpenClaw es **Node 22+**.

Si puede ejecutar `npm install -g openclaw@latest` pero luego ve `openclaw: command not found`, casi siempre es un problema de **PATH**: el directorio donde npm coloca los binarios globales no está en el PATH de su shell.

## Diagnóstico rápido

Ejecute:

```bash
node -v
npm -v
npm prefix -g
echo "$PATH"
```

Si `$(npm prefix -g)/bin` (macOS/Linux) o `$(npm prefix -g)` (Windows) **no** está presente dentro de `echo "$PATH"`, su shell no puede encontrar binarios globales de npm (incluido `openclaw`).

## Solución: poner el directorio bin global de npm en el PATH

1. Encuentre su prefijo global de npm:

```bash
npm prefix -g
```

2. Agregue el directorio bin global de npm a su archivo de inicio del shell:

- zsh: `~/.zshrc`
- bash: `~/.bashrc`

Ejemplo (reemplace la ruta con la salida de `npm prefix -g`):

```bash
# macOS / Linux
export PATH="/path/from/npm/prefix/bin:$PATH"
```

Luego abra una **nueva terminal** (o ejecute `rehash` en zsh / `hash -r` en bash).

En Windows, agregue la salida de `npm prefix -g` a su PATH.

## Solución: evitar errores de `sudo npm install -g` / permisos (Linux)

Si `npm install -g ...` falla con `EACCES`, cambie el prefijo global de npm a un directorio con permisos de escritura para el usuario:

```bash
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"
```

Haga persistente la línea `export PATH=...` en su archivo de inicio del shell.

## Opciones recomendadas de instalación de Node

Tendrá menos sorpresas si Node/npm se instalan de una forma que:

- mantenga Node actualizado (22+)
- haga que el directorio bin global de npm sea estable y esté en el PATH en shells nuevos

Opciones comunes:

- macOS: Homebrew (`brew install node`) o un gestor de versiones
- Linux: su gestor de versiones preferido, o una instalación soportada por la distro que provea Node 22+
- Windows: instalador oficial de Node, `winget`, o un gestor de versiones de Node para Windows

Si usa un gestor de versiones (nvm/fnm/asdf/etc), asegúrese de que esté inicializado en el shell que usa a diario (zsh vs bash) para que el PATH que establece esté presente cuando ejecute instaladores.
