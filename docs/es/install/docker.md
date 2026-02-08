---
summary: "Configuración y incorporación opcionales basadas en Docker para OpenClaw"
read_when:
  - Desea un Gateway en contenedores en lugar de instalaciones locales
  - Está validando el flujo de Docker
title: "Docker"
x-i18n:
  source_path: install/docker.md
  source_hash: 021ec5aa78e1a6eb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:35Z
---

# Docker (opcional)

Docker es **opcional**. Úselo solo si desea un Gateway en contenedores o validar el flujo de Docker.

## ¿Docker es adecuado para mí?

- **Sí**: desea un entorno de Gateway aislado y desechable, o ejecutar OpenClaw en un host sin instalaciones locales.
- **No**: está ejecutándose en su propia máquina y solo quiere el ciclo de desarrollo más rápido. Use el flujo de instalación normal en su lugar.
- **Nota sobre sandboxing**: el sandboxing de agentes también usa Docker, pero **no** requiere que el Gateway completo se ejecute en Docker. Vea [Sandboxing](/gateway/sandboxing).

Esta guía cubre:

- Gateway en contenedores (OpenClaw completo en Docker)
- Sandbox de agente por sesión (Gateway en el host + herramientas de agente aisladas con Docker)

Detalles de sandboxing: [Sandboxing](/gateway/sandboxing)

## Requisitos

- Docker Desktop (o Docker Engine) + Docker Compose v2
- Espacio en disco suficiente para imágenes + logs

## Gateway en contenedores (Docker Compose)

### Inicio rapido (recomendado)

Desde la raíz del repositorio:

```bash
./docker-setup.sh
```

Este script:

- construye la imagen del Gateway
- ejecuta el asistente de incorporación
- imprime sugerencias opcionales de configuración de proveedores
- inicia el Gateway mediante Docker Compose
- genera un token del Gateway y lo escribe en `.env`

Variables de entorno opcionales:

- `OPENCLAW_DOCKER_APT_PACKAGES` — instalar paquetes apt adicionales durante la compilación
- `OPENCLAW_EXTRA_MOUNTS` — agregar montajes bind adicionales del host
- `OPENCLAW_HOME_VOLUME` — persistir `/home/node` en un volumen con nombre

Después de que finalice:

- Abra `http://127.0.0.1:18789/` en su navegador.
- Pegue el token en la UI de Control (Settings → token).
- ¿Necesita la URL de nuevo? Ejecute `docker compose run --rm openclaw-cli dashboard --no-open`.

Escribe la configuración/espacio de trabajo en el host:

- `~/.openclaw/`
- `~/.openclaw/workspace`

¿Ejecutando en un VPS? Vea [Hetzner (Docker VPS)](/install/hetzner).

### Flujo manual (compose)

```bash
docker build -t openclaw:local -f Dockerfile .
docker compose run --rm openclaw-cli onboard
docker compose up -d openclaw-gateway
```

Nota: ejecute `docker compose ...` desde la raíz del repositorio. Si habilitó
`OPENCLAW_EXTRA_MOUNTS` o `OPENCLAW_HOME_VOLUME`, el script de configuración escribe
`docker-compose.extra.yml`; inclúyalo al ejecutar Compose en otro lugar:

```bash
docker compose -f docker-compose.yml -f docker-compose.extra.yml <command>
```

### Token de la UI de Control + emparejamiento (Docker)

Si ve “unauthorized” o “disconnected (1008): pairing required”, obtenga un
enlace nuevo del panel y apruebe el dispositivo del navegador:

```bash
docker compose run --rm openclaw-cli dashboard --no-open
docker compose run --rm openclaw-cli devices list
docker compose run --rm openclaw-cli devices approve <requestId>
```

Más detalles: [Dashboard](/web/dashboard), [Devices](/cli/devices).

### Montajes adicionales (opcional)

Si desea montar directorios adicionales del host en los contenedores, establezca
`OPENCLAW_EXTRA_MOUNTS` antes de ejecutar `docker-setup.sh`. Esto acepta una
lista separada por comas de montajes bind de Docker y los aplica tanto a
`openclaw-gateway` como a `openclaw-cli` generando `docker-compose.extra.yml`.

Ejemplo:

```bash
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

Notas:

- Las rutas deben compartirse con Docker Desktop en macOS/Windows.
- Si edita `OPENCLAW_EXTRA_MOUNTS`, vuelva a ejecutar `docker-setup.sh` para regenerar el
  archivo compose adicional.
- `docker-compose.extra.yml` se genera automáticamente. No lo edite a mano.

### Persistir todo el home del contenedor (opcional)

Si desea que `/home/node` persista entre recreaciones del contenedor, establezca un
volumen con nombre mediante `OPENCLAW_HOME_VOLUME`. Esto crea un volumen de Docker y lo monta en
`/home/node`, manteniendo los montajes bind estándar de configuración/espacio de trabajo. Use un
volumen con nombre aquí (no una ruta bind); para montajes bind, use
`OPENCLAW_EXTRA_MOUNTS`.

Ejemplo:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

Puede combinar esto con montajes adicionales:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

Notas:

- Si cambia `OPENCLAW_HOME_VOLUME`, vuelva a ejecutar `docker-setup.sh` para regenerar el
  archivo compose adicional.
- El volumen con nombre persiste hasta que se elimine con `docker volume rm <name>`.

### Instalar paquetes apt adicionales (opcional)

Si necesita paquetes del sistema dentro de la imagen (por ejemplo, herramientas de compilación o bibliotecas multimedia), establezca `OPENCLAW_DOCKER_APT_PACKAGES` antes de ejecutar `docker-setup.sh`.
Esto instala los paquetes durante la compilación de la imagen, por lo que persisten incluso si el
contenedor se elimina.

Ejemplo:

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="ffmpeg build-essential"
./docker-setup.sh
```

Notas:

- Esto acepta una lista separada por espacios de nombres de paquetes apt.
- Si cambia `OPENCLAW_DOCKER_APT_PACKAGES`, vuelva a ejecutar `docker-setup.sh` para reconstruir
  la imagen.

### Contenedor avanzado / con todas las funciones (opt-in)

La imagen de Docker predeterminada es **security-first** y se ejecuta como el usuario no root `node`.
Esto mantiene pequeña la superficie de ataque, pero significa:

- sin instalaciones de paquetes del sistema en tiempo de ejecución
- sin Homebrew por defecto
- sin navegadores Chromium/Playwright incluidos

Si desea un contenedor con más funciones, use estos ajustes opt-in:

1. **Persistir `/home/node`** para que las descargas de navegadores y cachés de herramientas sobrevivan:

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

2. **Incorporar dependencias del sistema en la imagen** (repetible + persistente):

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="git curl jq"
./docker-setup.sh
```

3. **Instalar navegadores Playwright sin `npx`** (evita conflictos de override de npm):

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

Si necesita que Playwright instale dependencias del sistema, reconstruya la imagen con
`OPENCLAW_DOCKER_APT_PACKAGES` en lugar de usar `--with-deps` en tiempo de ejecución.

4. **Persistir descargas de navegadores de Playwright**:

- Establezca `PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright` en
  `docker-compose.yml`.
- Asegúrese de que `/home/node` persista mediante `OPENCLAW_HOME_VOLUME`, o monte
  `/home/node/.cache/ms-playwright` mediante `OPENCLAW_EXTRA_MOUNTS`.

### Permisos + EACCES

La imagen se ejecuta como `node` (uid 1000). Si ve errores de permisos en
`/home/node/.openclaw`, asegúrese de que sus montajes bind del host pertenezcan al uid 1000.

Ejemplo (host Linux):

```bash
sudo chown -R 1000:1000 /path/to/openclaw-config /path/to/openclaw-workspace
```

Si elige ejecutar como root por conveniencia, acepta el compromiso de seguridad.

### Reconstrucciones más rápidas (recomendado)

Para acelerar las reconstrucciones, ordene su Dockerfile de modo que las capas de dependencias se almacenen en caché.
Esto evita volver a ejecutar `pnpm install` a menos que cambien los lockfiles:

```dockerfile
FROM node:22-bookworm

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

# Cache dependencies unless package metadata changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

### Configuración de canales (opcional)

Use el contenedor CLI para configurar canales, luego reinicie el Gateway si es necesario.

WhatsApp (QR):

```bash
docker compose run --rm openclaw-cli channels login
```

Telegram (token de bot):

```bash
docker compose run --rm openclaw-cli channels add --channel telegram --token "<token>"
```

Discord (token de bot):

```bash
docker compose run --rm openclaw-cli channels add --channel discord --token "<token>"
```

Docs: [WhatsApp](/channels/whatsapp), [Telegram](/channels/telegram), [Discord](/channels/discord)

### OpenAI Codex OAuth (Docker sin interfaz)

Si elige OpenAI Codex OAuth en el asistente, se abre una URL del navegador e intenta
capturar un callback en `http://127.0.0.1:1455/auth/callback`. En Docker o
configuraciones sin interfaz, ese callback puede mostrar un error del navegador. Copie la URL completa de redirección
a la que llega y péguela de nuevo en el asistente para finalizar la autenticación.

### Health check

```bash
docker compose exec openclaw-gateway node dist/index.js health --token "$OPENCLAW_GATEWAY_TOKEN"
```

### Prueba smoke E2E (Docker)

```bash
scripts/e2e/onboard-docker.sh
```

### Prueba smoke de importación de QR (Docker)

```bash
pnpm test:docker:qr
```

### Notas

- El bind del Gateway usa por defecto `lan` para uso en contenedores.
- El CMD del Dockerfile usa `--allow-unconfigured`; la configuración montada con `gateway.mode` y no `local` seguirá iniciando. Anule el CMD para forzar la protección.
- El contenedor del Gateway es la fuente de verdad para las sesiones (`~/.openclaw/agents/<agentId>/sessions/`).

## Sandbox de agente (Gateway en el host + herramientas Docker)

Análisis en profundidad: [Sandboxing](/gateway/sandboxing)

### Qué hace

Cuando `agents.defaults.sandbox` está habilitado, las **sesiones no principales** ejecutan herramientas dentro de un
contenedor Docker. El Gateway permanece en su host, pero la ejecución de herramientas está aislada:

- alcance: `"agent"` por defecto (un contenedor + espacio de trabajo por agente)
- alcance: `"session"` para aislamiento por sesión
- carpeta de espacio de trabajo por alcance montada en `/workspace`
- acceso opcional al espacio de trabajo del agente (`agents.defaults.sandbox.workspaceAccess`)
- política de herramientas permitir/denegar (denegar prevalece)
- los medios entrantes se copian en el espacio de trabajo activo del sandbox (`media/inbound/*`) para que las herramientas puedan leerlos (con `workspaceAccess: "rw"`, esto llega al espacio de trabajo del agente)

Advertencia: `scope: "shared"` deshabilita el aislamiento entre sesiones. Todas las sesiones comparten
un contenedor y un espacio de trabajo.

### Perfiles de sandbox por agente (multiagente)

Si usa enrutamiento multiagente, cada agente puede sobrescribir la configuración de sandbox + herramientas:
`agents.list[].sandbox` y `agents.list[].tools` (además de `agents.list[].tools.sandbox.tools`). Esto le permite ejecutar
niveles de acceso mixtos en un solo Gateway:

- Acceso completo (agente personal)
- Herramientas de solo lectura + espacio de trabajo de solo lectura (agente familiar/laboral)
- Sin herramientas de sistema de archivos/shell (agente público)

Vea [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) para ejemplos,
precedencia y solucion de problemas.

### Comportamiento predeterminado

- Imagen: `openclaw-sandbox:bookworm-slim`
- Un contenedor por agente
- Acceso al espacio de trabajo del agente: `workspaceAccess: "none"` (predeterminado) usa `~/.openclaw/sandboxes`
  - `"ro"` mantiene el espacio de trabajo del sandbox en `/workspace` y monta el espacio de trabajo del agente en solo lectura en `/agent` (deshabilita `write`/`edit`/`apply_patch`)
  - `"rw"` monta el espacio de trabajo del agente en lectura/escritura en `/workspace`
- Auto-poda: inactivo > 24 h O antigüedad > 7 d
- Red: `none` por defecto (opte explícitamente si necesita salida)
- Permitir por defecto: `exec`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- Denegar por defecto: `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`

### Habilitar sandboxing

Si planea instalar paquetes en `setupCommand`, tenga en cuenta:

- El `docker.network` predeterminado es `"none"` (sin salida).
- `readOnlyRoot: true` bloquea la instalación de paquetes.
- `user` debe ser root para `apt-get` (omita `user` o establezca `user: "0:0"`).
  OpenClaw recrea automáticamente los contenedores cuando `setupCommand` (o la configuración de docker) cambia
  a menos que el contenedor haya sido **usado recientemente** (en ~5 minutos). Los contenedores activos
  registran una advertencia con el comando exacto `openclaw sandbox recreate ...`.

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // off | non-main | all
        scope: "agent", // session | agent | shared (agent is default)
        workspaceAccess: "none", // none | ro | rw
        workspaceRoot: "~/.openclaw/sandboxes",
        docker: {
          image: "openclaw-sandbox:bookworm-slim",
          workdir: "/workspace",
          readOnlyRoot: true,
          tmpfs: ["/tmp", "/var/tmp", "/run"],
          network: "none",
          user: "1000:1000",
          capDrop: ["ALL"],
          env: { LANG: "C.UTF-8" },
          setupCommand: "apt-get update && apt-get install -y git curl jq",
          pidsLimit: 256,
          memory: "1g",
          memorySwap: "2g",
          cpus: 1,
          ulimits: {
            nofile: { soft: 1024, hard: 2048 },
            nproc: 256,
          },
          seccompProfile: "/path/to/seccomp.json",
          apparmorProfile: "openclaw-sandbox",
          dns: ["1.1.1.1", "8.8.8.8"],
          extraHosts: ["internal.service:10.0.0.5"],
        },
        prune: {
          idleHours: 24, // 0 disables idle pruning
          maxAgeDays: 7, // 0 disables max-age pruning
        },
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        allow: [
          "exec",
          "process",
          "read",
          "write",
          "edit",
          "sessions_list",
          "sessions_history",
          "sessions_send",
          "sessions_spawn",
          "session_status",
        ],
        deny: ["browser", "canvas", "nodes", "cron", "discord", "gateway"],
      },
    },
  },
}
```

Los ajustes de endurecimiento viven bajo `agents.defaults.sandbox.docker`:
`network`, `user`, `pidsLimit`, `memory`, `memorySwap`, `cpus`, `ulimits`,
`seccompProfile`, `apparmorProfile`, `dns`, `extraHosts`.

Multiagente: sobrescriba `agents.defaults.sandbox.{docker,browser,prune}.*` por agente mediante `agents.list[].sandbox.{docker,browser,prune}.*`
(se ignora cuando `agents.defaults.sandbox.scope` / `agents.list[].sandbox.scope` es `"shared"`).

### Construir la imagen de sandbox predeterminada

```bash
scripts/sandbox-setup.sh
```

Esto construye `openclaw-sandbox:bookworm-slim` usando `Dockerfile.sandbox`.

### Imagen común de sandbox (opcional)

Si desea una imagen de sandbox con herramientas comunes de compilación (Node, Go, Rust, etc.), construya la imagen común:

```bash
scripts/sandbox-common-setup.sh
```

Esto construye `openclaw-sandbox-common:bookworm-slim`. Para usarla:

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "openclaw-sandbox-common:bookworm-slim" } },
    },
  },
}
```

### Imagen de navegador del sandbox

Para ejecutar la herramienta de navegador dentro del sandbox, construya la imagen del navegador:

```bash
scripts/sandbox-browser-setup.sh
```

Esto construye `openclaw-sandbox-browser:bookworm-slim` usando
`Dockerfile.sandbox-browser`. El contenedor ejecuta Chromium con CDP habilitado y
un observador noVNC opcional (con interfaz mediante Xvfb).

Notas:

- Con interfaz (Xvfb) reduce el bloqueo de bots frente a headless.
- Headless aún puede usarse estableciendo `agents.defaults.sandbox.browser.headless=true`.
- No se necesita un entorno de escritorio completo (GNOME); Xvfb proporciona la pantalla.

Use la configuración:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: { enabled: true },
      },
    },
  },
}
```

Imagen de navegador personalizada:

```json5
{
  agents: {
    defaults: {
      sandbox: { browser: { image: "my-openclaw-browser" } },
    },
  },
}
```

Cuando está habilitado, el agente recibe:

- una URL de control del navegador del sandbox (para la herramienta `browser`)
- una URL noVNC (si está habilitado y headless=false)

Recuerde: si usa una allowlist para herramientas, agregue `browser` (y elimínelo de
deny) o la herramienta permanecerá bloqueada.
Las reglas de poda (`agents.defaults.sandbox.prune`) también se aplican a los contenedores del navegador.

### Imagen de sandbox personalizada

Construya su propia imagen y apunte la configuración a ella:

```bash
docker build -t my-openclaw-sbx -f Dockerfile.sandbox .
```

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "my-openclaw-sbx" } },
    },
  },
}
```

### Política de herramientas (permitir/denegar)

- `deny` prevalece sobre `allow`.
- Si `allow` está vacío: todas las herramientas (excepto las denegadas) están disponibles.
- Si `allow` no está vacío: solo las herramientas en `allow` están disponibles (menos las denegadas).

### Estrategia de poda

Dos ajustes:

- `prune.idleHours`: eliminar contenedores no usados en X horas (0 = deshabilitar)
- `prune.maxAgeDays`: eliminar contenedores con más de X días (0 = deshabilitar)

Ejemplo:

- Mantener sesiones activas pero limitar la vida útil:
  `idleHours: 24`, `maxAgeDays: 7`
- Nunca podar:
  `idleHours: 0`, `maxAgeDays: 0`

### Notas de seguridad

- El muro duro solo aplica a **herramientas** (exec/read/write/edit/apply_patch).
- Las herramientas solo del host como browser/camera/canvas están bloqueadas por defecto.
- Permitir `browser` en sandbox **rompe el aislamiento** (el navegador se ejecuta en el host).

## Solucion de problemas

- Imagen faltante: construya con [`scripts/sandbox-setup.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/sandbox-setup.sh) o establezca `agents.defaults.sandbox.docker.image`.
- Contenedor no en ejecución: se creará automáticamente por sesión bajo demanda.
- Errores de permisos en el sandbox: establezca `docker.user` en un UID:GID que coincida con la
  propiedad de su espacio de trabajo montado (o haga chown de la carpeta del espacio de trabajo).
- Herramientas personalizadas no encontradas: OpenClaw ejecuta comandos con `sh -lc` (shell de inicio de sesión), que
  carga `/etc/profile` y puede restablecer PATH. Establezca `docker.env.PATH` para anteponer las
  rutas de sus herramientas personalizadas (p. ej., `/custom/bin:/usr/local/share/npm-global/bin`), o agregue
  un script bajo `/etc/profile.d/` en su Dockerfile.
