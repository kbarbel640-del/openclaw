---
summary: "Referencia completa del flujo de incorporacion por CLI, configuracion de autenticacion/modelo, salidas e internos"
read_when:
  - Necesita comportamiento detallado para openclaw onboard
  - Esta depurando resultados de incorporacion o integrando clientes de incorporacion
title: "Referencia de Incorporacion por CLI"
sidebarTitle: "CLI reference"
x-i18n:
  source_path: start/wizard-cli-reference.md
  source_hash: 0ef6f01c3e29187b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:19Z
---

# Referencia de Incorporacion por CLI

Esta pagina es la referencia completa para `openclaw onboard`.
Para la guia corta, vea [Asistente de Incorporacion (CLI)](/start/wizard).

## Que hace el asistente

El modo local (predeterminado) lo guia a traves de:

- Configuracion de modelo y autenticacion (OAuth de suscripcion OpenAI Code, clave API de Anthropic o token de configuracion, ademas de opciones de MiniMax, GLM, Moonshot y AI Gateway)
- Ubicacion del workspace y archivos de arranque
- Ajustes del Gateway (puerto, bind, autenticacion, tailscale)
- Canales y proveedores (Telegram, WhatsApp, Discord, Google Chat, plugin de Mattermost, Signal)
- Instalacion del daemon (LaunchAgent o unidad de usuario systemd)
- Verificacion de estado
- Configuracion de Skills

El modo remoto configura esta maquina para conectarse a un gateway en otro lugar.
No instala ni modifica nada en el host remoto.

## Detalles del flujo local

<Steps>
  <Step title="Deteccion de configuracion existente">
    - Si existe `~/.openclaw/openclaw.json`, elija Mantener, Modificar o Restablecer.
    - Volver a ejecutar el asistente no borra nada a menos que usted elija explicitamente Restablecer (o pase `--reset`).
    - Si la configuracion no es valida o contiene claves heredadas, el asistente se detiene y le pide ejecutar `openclaw doctor` antes de continuar.
    - El restablecimiento usa `trash` y ofrece alcances:
      - Solo configuracion
      - Configuracion + credenciales + sesiones
      - Restablecimiento completo (tambien elimina el workspace)
  </Step>
  <Step title="Modelo y autenticacion">
    - La matriz completa de opciones esta en [Opciones de autenticacion y modelo](#auth-and-model-options).
  </Step>
  <Step title="Workspace">
    - Predeterminado `~/.openclaw/workspace` (configurable).
    - Inicializa archivos del workspace necesarios para el ritual de arranque de primera ejecucion.
    - Diseno del workspace: [Workspace del agente](/concepts/agent-workspace).
  </Step>
  <Step title="Gateway">
    - Solicita puerto, bind, modo de autenticacion y exposicion por tailscale.
    - Recomendado: mantener la autenticacion por token habilitada incluso para loopback para que los clientes WS locales deban autenticarse.
    - Desactive la autenticacion solo si confia plenamente en todos los procesos locales.
    - Los binds que no son loopback siguen requiriendo autenticacion.
  </Step>
  <Step title="Canales">
    - [WhatsApp](/channels/whatsapp): inicio de sesion por QR opcional
    - [Telegram](/channels/telegram): token de bot
    - [Discord](/channels/discord): token de bot
    - [Google Chat](/channels/googlechat): JSON de cuenta de servicio + audiencia del webhook
    - Plugin de [Mattermost](/channels/mattermost): token de bot + URL base
    - [Signal](/channels/signal): instalacion opcional de `signal-cli` + configuracion de cuenta
    - [BlueBubbles](/channels/bluebubbles): recomendado para iMessage; URL del servidor + contrasena + webhook
    - [iMessage](/channels/imessage): ruta CLI heredada `imsg` + acceso a BD
    - Seguridad de Mensajes directos: el valor predeterminado es el emparejamiento. El primer Mensaje directo envia un codigo; apruebelo via
      `openclaw pairing approve <channel> <code>` o use listas de permitidos.
  </Step>
  <Step title="Instalacion del daemon">
    - macOS: LaunchAgent
      - Requiere una sesion de usuario iniciada; para entornos sin interfaz, use un LaunchDaemon personalizado (no incluido).
    - Linux y Windows via WSL2: unidad de usuario systemd
      - El asistente intenta `loginctl enable-linger <user>` para que el gateway permanezca activo despues del cierre de sesion.
      - Puede solicitar sudo (escribe `/var/lib/systemd/linger`); primero intenta sin sudo.
    - Seleccion de runtime: Node (recomendado; requerido para WhatsApp y Telegram). Bun no es recomendado.
  </Step>
  <Step title="Verificacion de estado">
    - Inicia el gateway (si es necesario) y ejecuta `openclaw health`.
    - `openclaw status --deep` agrega sondas de estado del gateway a la salida de estado.
  </Step>
  <Step title="Skills">
    - Lee las Skills disponibles y verifica requisitos.
    - Le permite elegir el gestor de Node: npm o pnpm (bun no es recomendado).
    - Instala dependencias opcionales (algunas usan Homebrew en macOS).
  </Step>
  <Step title="Finalizar">
    - Resumen y siguientes pasos, incluidas opciones de aplicaciones para iOS, Android y macOS.
  </Step>
</Steps>

<Note>
Si no se detecta una GUI, el asistente imprime instrucciones de reenvio de puertos SSH para la UI de Control en lugar de abrir un navegador.
Si faltan los recursos de la UI de Control, el asistente intenta compilarlos; la alternativa es `pnpm ui:build` (instala automaticamente dependencias de la UI).
</Note>

## Detalles del modo remoto

El modo remoto configura esta maquina para conectarse a un gateway en otro lugar.

<Info>
El modo remoto no instala ni modifica nada en el host remoto.
</Info>

Lo que usted configura:

- URL del gateway remoto (`ws://...`)
- Token si la autenticacion del gateway remoto es requerida (recomendado)

<Note>
- Si el gateway es solo loopback, use tunel SSH o un tailnet.
- Pistas de descubrimiento:
  - macOS: Bonjour (`dns-sd`)
  - Linux: Avahi (`avahi-browse`)
</Note>

## Opciones de autenticacion y modelo

<AccordionGroup>
  <Accordion title="Clave API de Anthropic (recomendado)">
    Usa `ANTHROPIC_API_KEY` si esta presente o solicita una clave, y luego la guarda para uso del daemon.
  </Accordion>
  <Accordion title="OAuth de Anthropic (Claude Code CLI)">
    - macOS: verifica el elemento del Llavero "Claude Code-credentials"
    - Linux y Windows: reutiliza `~/.claude/.credentials.json` si existe

    En macOS, elija "Permitir siempre" para que los inicios de launchd no se bloqueen.

  </Accordion>
  <Accordion title="Token de Anthropic (pegado de token de configuracion)">
    Ejecute `claude setup-token` en cualquier maquina y luego pegue el token.
    Puede asignarle un nombre; en blanco usa el predeterminado.
  </Accordion>
  <Accordion title="Suscripcion OpenAI Code (reutilizacion de Codex CLI)">
    Si existe `~/.codex/auth.json`, el asistente puede reutilizarla.
  </Accordion>
  <Accordion title="Suscripcion OpenAI Code (OAuth)">
    Flujo en el navegador; pegue `code#state`.

    Establece `agents.defaults.model` en `openai-codex/gpt-5.3-codex` cuando el modelo no esta configurado o es `openai/*`.

  </Accordion>
  <Accordion title="Clave API de OpenAI">
    Usa `OPENAI_API_KEY` si esta presente o solicita una clave, y luego la guarda en
    `~/.openclaw/.env` para que launchd pueda leerla.

    Establece `agents.defaults.model` en `openai/gpt-5.1-codex` cuando el modelo no esta configurado, es `openai/*` o `openai-codex/*`.

  </Accordion>
  <Accordion title="OpenCode Zen">
    Solicita `OPENCODE_API_KEY` (o `OPENCODE_ZEN_API_KEY`).
    URL de configuracion: [opencode.ai/auth](https://opencode.ai/auth).
  </Accordion>
  <Accordion title="Clave API (generica)">
    Almacena la clave por usted.
  </Accordion>
  <Accordion title="Vercel AI Gateway">
    Solicita `AI_GATEWAY_API_KEY`.
    Mas detalle: [Vercel AI Gateway](/providers/vercel-ai-gateway).
  </Accordion>
  <Accordion title="Cloudflare AI Gateway">
    Solicita ID de cuenta, ID de gateway y `CLOUDFLARE_AI_GATEWAY_API_KEY`.
    Mas detalle: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway).
  </Accordion>
  <Accordion title="MiniMax M2.1">
    La configuracion se escribe automaticamente.
    Mas detalle: [MiniMax](/providers/minimax).
  </Accordion>
  <Accordion title="Synthetic (compatible con Anthropic)">
    Solicita `SYNTHETIC_API_KEY`.
    Mas detalle: [Synthetic](/providers/synthetic).
  </Accordion>
  <Accordion title="Moonshot y Kimi Coding">
    Las configuraciones de Moonshot (Kimi K2) y Kimi Coding se escriben automaticamente.
    Mas detalle: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot).
  </Accordion>
  <Accordion title="Omitir">
    Deja la autenticacion sin configurar.
  </Accordion>
</AccordionGroup>

Comportamiento del modelo:

- Elija el modelo predeterminado de las opciones detectadas, o ingrese proveedor y modelo manualmente.
- El asistente ejecuta una verificacion del modelo y advierte si el modelo configurado es desconocido o falta autenticacion.

Rutas de credenciales y perfiles:

- Credenciales OAuth: `~/.openclaw/credentials/oauth.json`
- Perfiles de autenticacion (claves API + OAuth): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

<Note>
Consejo para entornos sin interfaz y servidores: complete OAuth en una maquina con navegador y luego copie
`~/.openclaw/credentials/oauth.json` (o `$OPENCLAW_STATE_DIR/credentials/oauth.json`)
al host del gateway.
</Note>

## Salidas e internos

Campos tipicos en `~/.openclaw/openclaw.json`:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers` (si se elige Minimax)
- `gateway.*` (modo, bind, autenticacion, tailscale)
- `channels.telegram.botToken`, `channels.discord.token`, `channels.signal.*`, `channels.imessage.*`
- Listas de permitidos de canales (Slack, Discord, Matrix, Microsoft Teams) cuando usted opta por ellas durante los prompts (los nombres se resuelven a IDs cuando es posible)
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` escribe `agents.list[]` y `bindings` opcional.

Las credenciales de WhatsApp van bajo `~/.openclaw/credentials/whatsapp/<accountId>/`.
Las sesiones se almacenan bajo `~/.openclaw/agents/<agentId>/sessions/`.

<Note>
Algunos canales se entregan como plugins. Cuando se seleccionan durante la incorporacion, el asistente
solicita instalar el plugin (npm o ruta local) antes de la configuracion del canal.
</Note>

RPC del asistente del Gateway:

- `wizard.start`
- `wizard.next`
- `wizard.cancel`
- `wizard.status`

Los clientes (app de macOS y UI de Control) pueden renderizar los pasos sin reimplementar la logica de incorporacion.

Comportamiento de configuracion de Signal:

- Descarga el recurso de lanzamiento apropiado
- Lo almacena bajo `~/.openclaw/tools/signal-cli/<version>/`
- Escribe `channels.signal.cliPath` en la configuracion
- Las compilaciones JVM requieren Java 21
- Se usan compilaciones nativas cuando estan disponibles
- Windows usa WSL2 y sigue el flujo de signal-cli de Linux dentro de WSL

## Documentos relacionados

- Hub de incorporacion: [Asistente de Incorporacion (CLI)](/start/wizard)
- Automatizacion y scripts: [Automatizacion de CLI](/start/wizard-cli-automation)
- Referencia de comandos: [`openclaw onboard`](/cli/onboard)
