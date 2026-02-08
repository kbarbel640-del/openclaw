---
summary: "Configuración avanzada y flujos de trabajo de desarrollo para OpenClaw"
read_when:
  - Configurando una nueva máquina
  - Quiere “lo último y lo mejor” sin romper su configuración personal
title: "Configuración"
x-i18n:
  source_path: start/setup.md
  source_hash: 6620daddff099dc0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:07Z
---

# Configuración

<Note>
Si se está configurando por primera vez, comience con [Primeros Pasos](/start/getting-started).
Para detalles del asistente, consulte [Asistente de Incorporacion](/start/wizard).
</Note>

Última actualización: 2026-01-01

## TL;DR

- **La personalización vive fuera del repo:** `~/.openclaw/workspace` (workspace) + `~/.openclaw/openclaw.json` (config).
- **Flujo de trabajo estable:** instale la app de macOS; deje que ejecute el Gateway incluido.
- **Flujo de trabajo bleeding edge:** ejecute el Gateway usted mismo vía `pnpm gateway:watch`, luego deje que la app de macOS se conecte en modo Local.

## Prerrequisitos (desde el código fuente)

- Node `>=22`
- `pnpm`
- Docker (opcional; solo para configuración en contenedores/e2e — vea [Docker](/install/docker))

## Estrategia de personalización (para que las actualizaciones no duelan)

Si quiere “100% a mi medida” _y_ actualizaciones sencillas, mantenga su personalización en:

- **Config:** `~/.openclaw/openclaw.json` (JSON/JSON5-ish)
- **Workspace:** `~/.openclaw/workspace` (skills, prompts, memorias; conviértalo en un repo git privado)

Inicialice una vez:

```bash
openclaw setup
```

Desde dentro de este repo, use la entrada local del CLI:

```bash
openclaw setup
```

Si aún no tiene una instalación global, ejecútelo vía `pnpm openclaw setup`.

## Ejecutar el Gateway desde este repo

Después de `pnpm build`, puede ejecutar el CLI empaquetado directamente:

```bash
node openclaw.mjs gateway --port 18789 --verbose
```

## Flujo de trabajo estable (app de macOS primero)

1. Instale y ejecute **OpenClaw.app** (barra de menú).
2. Complete la lista de incorporación/permisos (prompts de TCC).
3. Asegúrese de que el Gateway esté **Local** y en ejecución (la app lo gestiona).
4. Vincule superficies (ejemplo: WhatsApp):

```bash
openclaw channels login
```

5. Verificación rápida:

```bash
openclaw health
```

Si la incorporación no está disponible en su build:

- Ejecute `openclaw setup`, luego `openclaw channels login`, y después inicie el Gateway manualmente (`openclaw gateway`).

## Flujo de trabajo bleeding edge (Gateway en una terminal)

Objetivo: trabajar en el Gateway en TypeScript, obtener hot reload y mantener la UI de la app de macOS conectada.

### 0) (Opcional) Ejecutar también la app de macOS desde el código fuente

Si también quiere la app de macOS en bleeding edge:

```bash
./scripts/restart-mac.sh
```

### 1) Iniciar el Gateway de desarrollo

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` ejecuta el gateway en modo watch y recarga ante cambios en TypeScript.

### 2) Apuntar la app de macOS a su Gateway en ejecución

En **OpenClaw.app**:

- Modo de conexión: **Local**
  La app se conectará al gateway en ejecución en el puerto configurado.

### 3) Verificar

- El estado del Gateway en la app debería mostrar **“Using existing gateway …”**
- O vía CLI:

```bash
openclaw health
```

### Errores comunes

- **Puerto incorrecto:** el WS del Gateway tiene como valor predeterminado `ws://127.0.0.1:18789`; mantenga app + CLI en el mismo puerto.
- **Dónde vive el estado:**
  - Credenciales: `~/.openclaw/credentials/`
  - Sesiones: `~/.openclaw/agents/<agentId>/sessions/`
  - Logs: `/tmp/openclaw/`

## Mapa de almacenamiento de credenciales

Use esto al depurar autenticación o decidir qué respaldar:

- **WhatsApp**: `~/.openclaw/credentials/whatsapp/<accountId>/creds.json`
- **Token de bot de Telegram**: config/env o `channels.telegram.tokenFile`
- **Token de bot de Discord**: config/env (el archivo de token aún no es compatible)
- **Tokens de Slack**: config/env (`channels.slack.*`)
- **Listas de permitidos de emparejamiento**: `~/.openclaw/credentials/<channel>-allowFrom.json`
- **Perfiles de autenticación de modelos**: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- **Importación OAuth heredada**: `~/.openclaw/credentials/oauth.json`
  Más detalles: [Security](/gateway/security#credential-storage-map).

## Actualización (sin arruinar su configuración)

- Mantenga `~/.openclaw/workspace` y `~/.openclaw/` como “sus cosas”; no ponga prompts/config personales en el repo `openclaw`.
- Actualizar el código fuente: `git pull` + `pnpm install` (cuando cambie el lockfile) + siga usando `pnpm gateway:watch`.

## Linux (servicio de usuario systemd)

Las instalaciones en Linux usan un servicio **user** de systemd. De forma predeterminada, systemd detiene los
servicios de usuario al cerrar sesión/inactividad, lo que mata el Gateway. La incorporación intenta habilitar
el lingering por usted (puede pedir sudo). Si aún está desactivado, ejecute:

```bash
sudo loginctl enable-linger $USER
```

Para servidores siempre activos o multiusuario, considere un servicio **system** en lugar de un
servicio de usuario (no se requiere lingering). Vea el [Gateway runbook](/gateway) para las notas de systemd.

## Documentos relacionados

- [Gateway runbook](/gateway) (flags, supervisión, puertos)
- [Configuración del Gateway](/gateway/configuration) (esquema de config + ejemplos)
- [Discord](/channels/discord) y [Telegram](/channels/telegram) (etiquetas de respuesta + configuraciones de replyToMode)
- [Configuración del asistente OpenClaw](/start/openclaw)
- [App de macOS](/platforms/macos) (ciclo de vida del gateway)
