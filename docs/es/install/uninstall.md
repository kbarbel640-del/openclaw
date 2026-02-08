---
summary: "Desinstale OpenClaw por completo (CLI, servicio, estado, espacio de trabajo)"
read_when:
  - Desea eliminar OpenClaw de una máquina
  - El servicio del Gateway sigue ejecutándose después de desinstalar
title: "Desinstalar"
x-i18n:
  source_path: install/uninstall.md
  source_hash: 6673a755c5e1f90a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:14Z
---

# Desinstalar

Dos rutas:

- **Ruta fácil** si `openclaw` aún está instalado.
- **Eliminación manual del servicio** si el CLI ya no está, pero el servicio sigue ejecutándose.

## Ruta fácil (CLI aún instalado)

Recomendado: use el desinstalador integrado:

```bash
openclaw uninstall
```

No interactivo (automatización / npx):

```bash
openclaw uninstall --all --yes --non-interactive
npx -y openclaw uninstall --all --yes --non-interactive
```

Pasos manuales (mismo resultado):

1. Detenga el servicio del Gateway:

```bash
openclaw gateway stop
```

2. Desinstale el servicio del Gateway (launchd/systemd/schtasks):

```bash
openclaw gateway uninstall
```

3. Elimine estado + configuración:

```bash
rm -rf "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
```

Si configuró `OPENCLAW_CONFIG_PATH` en una ubicación personalizada fuera del directorio de estado, elimine también ese archivo.

4. Elimine su espacio de trabajo (opcional, elimina archivos del agente):

```bash
rm -rf ~/.openclaw/workspace
```

5. Quite la instalación del CLI (elija la que utilizó):

```bash
npm rm -g openclaw
pnpm remove -g openclaw
bun remove -g openclaw
```

6. Si instaló la app de macOS:

```bash
rm -rf /Applications/OpenClaw.app
```

Notas:

- Si utilizó perfiles (`--profile` / `OPENCLAW_PROFILE`), repita el paso 3 para cada directorio de estado (los valores predeterminados son `~/.openclaw-<profile>`).
- En modo remoto, el directorio de estado vive en el **host del Gateway**, así que ejecute los pasos 1-4 también allí.

## Eliminación manual del servicio (CLI no instalado)

Use esto si el servicio del Gateway sigue ejecutándose pero falta `openclaw`.

### macOS (launchd)

La etiqueta predeterminada es `bot.molt.gateway` (o `bot.molt.<profile>`; el legado `com.openclaw.*` puede seguir existiendo):

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

Si utilizó un perfil, reemplace la etiqueta y el nombre del plist por `bot.molt.<profile>`. Elimine cualquier plist legado `com.openclaw.*` si existe.

### Linux (systemd user unit)

El nombre de la unidad predeterminada es `openclaw-gateway.service` (o `openclaw-gateway-<profile>.service`):

```bash
systemctl --user disable --now openclaw-gateway.service
rm -f ~/.config/systemd/user/openclaw-gateway.service
systemctl --user daemon-reload
```

### Windows (Tarea programada)

El nombre de la tarea predeterminada es `OpenClaw Gateway` (o `OpenClaw Gateway (<profile>)`).
El script de la tarea vive bajo su directorio de estado.

```powershell
schtasks /Delete /F /TN "OpenClaw Gateway"
Remove-Item -Force "$env:USERPROFILE\.openclaw\gateway.cmd"
```

Si utilizó un perfil, elimine el nombre de tarea correspondiente y `~\.openclaw-<profile>\gateway.cmd`.

## Instalación normal vs. checkout de código fuente

### Instalación normal (install.sh / npm / pnpm / bun)

Si utilizó `https://openclaw.ai/install.sh` o `install.ps1`, el CLI se instaló con `npm install -g openclaw@latest`.
Elimínelo con `npm rm -g openclaw` (o `pnpm remove -g` / `bun remove -g` si lo instaló de esa forma).

### Checkout de código fuente (git clone)

Si ejecuta desde un checkout del repositorio (`git clone` + `openclaw ...` / `bun run openclaw ...`):

1. Desinstale el servicio del Gateway **antes** de eliminar el repositorio (use la ruta fácil anterior o la eliminación manual del servicio).
2. Elimine el directorio del repositorio.
3. Elimine estado + espacio de trabajo como se muestra arriba.
