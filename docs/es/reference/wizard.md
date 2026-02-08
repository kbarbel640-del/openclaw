---
summary: "Referencia completa del asistente de incorporacion del CLI: cada paso, bandera y campo de configuracion"
read_when:
  - Buscar un paso o bandera especificos del asistente
  - Automatizar la incorporacion con modo no interactivo
  - Depurar el comportamiento del asistente
title: "Referencia del Asistente de Incorporacion"
sidebarTitle: "Wizard Reference"
x-i18n:
  source_path: reference/wizard.md
  source_hash: 1dd46ad12c53668c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:15Z
---

# Referencia del Asistente de Incorporacion

Esta es la referencia completa del asistente CLI `openclaw onboard`.
Para una vision general de alto nivel, vea [Onboarding Wizard](/start/wizard).

## Detalles del flujo (modo local)

<Steps>
  <Step title="Deteccion de configuracion existente">
    - Si existe `~/.openclaw/openclaw.json`, elija **Conservar / Modificar / Restablecer**.
    - Volver a ejecutar el asistente **no** borra nada a menos que usted elija explicitamente **Restablecer**
      (o pase `--reset`).
    - Si la configuracion es invalida o contiene claves heredadas, el asistente se detiene y le pide
      que ejecute `openclaw doctor` antes de continuar.
    - El restablecimiento usa `trash` (nunca `rm`) y ofrece alcances:
      - Solo configuracion
      - Configuracion + credenciales + sesiones
      - Restablecimiento completo (tambien elimina el espacio de trabajo)
  </Step>
  <Step title="Modelo/Auth">
    - **Clave de API de Anthropic (recomendada)**: usa `ANTHROPIC_API_KEY` si esta presente o solicita una clave, luego la guarda para uso del daemon.
    - **OAuth de Anthropic (Claude Code CLI)**: en macOS el asistente verifica el elemento del Llavero "Claude Code-credentials" (elija "Permitir siempre" para que los inicios de launchd no se bloqueen); en Linux/Windows reutiliza `~/.claude/.credentials.json` si esta presente.
    - **Token de Anthropic (pegar setup-token)**: ejecute `claude setup-token` en cualquier maquina y luego pegue el token (puede nombrarlo; en blanco = predeterminado).
    - **Suscripcion OpenAI Code (Codex) (Codex CLI)**: si existe `~/.codex/auth.json`, el asistente puede reutilizarla.
    - **Suscripcion OpenAI Code (Codex) (OAuth)**: flujo en el navegador; pegue `code#state`.
      - Establece `agents.defaults.model` en `openai-codex/gpt-5.2` cuando el modelo no esta establecido o es `openai/*`.
    - **Clave de API de OpenAI**: usa `OPENAI_API_KEY` si esta presente o solicita una clave, luego la guarda en `~/.openclaw/.env` para que launchd pueda leerla.
    - **OpenCode Zen (proxy multi‑modelo)**: solicita `OPENCODE_API_KEY` (o `OPENCODE_ZEN_API_KEY`, obtengalo en https://opencode.ai/auth).
    - **Clave de API**: almacena la clave por usted.
    - **Vercel AI Gateway (proxy multi‑modelo)**: solicita `AI_GATEWAY_API_KEY`.
    - Mas detalle: [Vercel AI Gateway](/providers/vercel-ai-gateway)
    - **Cloudflare AI Gateway**: solicita ID de cuenta, ID del Gateway y `CLOUDFLARE_AI_GATEWAY_API_KEY`.
    - Mas detalle: [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
    - **MiniMax M2.1**: la configuracion se escribe automaticamente.
    - Mas detalle: [MiniMax](/providers/minimax)
    - **Synthetic (compatible con Anthropic)**: solicita `SYNTHETIC_API_KEY`.
    - Mas detalle: [Synthetic](/providers/synthetic)
    - **Moonshot (Kimi K2)**: la configuracion se escribe automaticamente.
    - **Kimi Coding**: la configuracion se escribe automaticamente.
    - Mas detalle: [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
    - **Omitir**: aun no se configura autenticacion.
    - Elija un modelo predeterminado entre las opciones detectadas (o ingrese proveedor/modelo manualmente).
    - El asistente ejecuta una verificacion del modelo y advierte si el modelo configurado es desconocido o falta autenticacion.
    - Las credenciales OAuth viven en `~/.openclaw/credentials/oauth.json`; los perfiles de autenticacion viven en `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` (claves de API + OAuth).
    - Mas detalle: [/concepts/oauth](/concepts/oauth)
    <Note>
    Consejo para headless/servidor: complete OAuth en una maquina con navegador y luego copie
    `~/.openclaw/credentials/oauth.json` (o `$OPENCLAW_STATE_DIR/credentials/oauth.json`) al
    host del Gateway.
    </Note>
  </Step>
  <Step title="Espacio de trabajo">
    - `~/.openclaw/workspace` predeterminado (configurable).
    - Inicializa los archivos del espacio de trabajo necesarios para el ritual de arranque del agente.
    - Diseno completo del espacio de trabajo + guia de respaldos: [Agent workspace](/concepts/agent-workspace)
  </Step>
  <Step title="Gateway">
    - Puerto, enlace, modo de autenticacion, exposicion por Tailscale.
    - Recomendacion de autenticacion: mantenga **Token** incluso para loopback para que los clientes WS locales deban autenticarse.
    - Deshabilite la autenticacion solo si confia plenamente en cada proceso local.
    - Los enlaces no loopback aun requieren autenticacion.
  </Step>
  <Step title="Canales">
    - [WhatsApp](/channels/whatsapp): inicio de sesion por QR opcional.
    - [Telegram](/channels/telegram): token del bot.
    - [Discord](/channels/discord): token del bot.
    - [Google Chat](/channels/googlechat): JSON de cuenta de servicio + audiencia del webhook.
    - [Mattermost](/channels/mattermost) (plugin): token del bot + URL base.
    - [Signal](/channels/signal): instalacion opcional de `signal-cli` + configuracion de la cuenta.
    - [BlueBubbles](/channels/bluebubbles): **recomendado para iMessage**; URL del servidor + contrasena + webhook.
    - [iMessage](/channels/imessage): ruta heredada del CLI `imsg` + acceso a la BD.
    - Seguridad de Mensajes directos: el valor predeterminado es el emparejamiento. El primer Mensaje directo envia un codigo; apruebelo via `openclaw pairing approve <channel> <code>` o use listas de permitidos.
  </Step>
  <Step title="Instalacion del daemon">
    - macOS: LaunchAgent
      - Requiere una sesion de usuario iniciada; para headless, use un LaunchDaemon personalizado (no incluido).
    - Linux (y Windows via WSL2): unidad de usuario systemd
      - El asistente intenta habilitar lingering via `loginctl enable-linger <user>` para que el Gateway permanezca activo tras cerrar sesion.
      - Puede solicitar sudo (escribe `/var/lib/systemd/linger`); primero lo intenta sin sudo.
    - **Seleccion de runtime:** Node (recomendado; requerido para WhatsApp/Telegram). Bun **no es recomendado**.
  </Step>
  <Step title="Chequeo de salud">
    - Inicia el Gateway (si es necesario) y ejecuta `openclaw health`.
    - Consejo: `openclaw status --deep` agrega sondas de salud del gateway a la salida de estado (requiere un gateway accesible).
  </Step>
  <Step title="Skills (recomendado)">
    - Lee las Skills disponibles y verifica requisitos.
    - Le permite elegir un gestor de nodos: **npm / pnpm** (bun no es recomendado).
    - Instala dependencias opcionales (algunas usan Homebrew en macOS).
  </Step>
  <Step title="Finalizar">
    - Resumen + siguientes pasos, incluyendo apps de iOS/Android/macOS para funciones adicionales.
  </Step>
</Steps>

<Note>
Si no se detecta una GUI, el asistente imprime instrucciones de reenvio de puertos SSH para la UI de Control en lugar de abrir un navegador.
Si faltan los recursos de la UI de Control, el asistente intenta construirlos; la alternativa es `pnpm ui:build` (instala automaticamente las dependencias de la UI).
</Note>

## Modo no interactivo

Use `--non-interactive` para automatizar o scriptar la incorporacion:

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice apiKey \
  --anthropic-api-key "$ANTHROPIC_API_KEY" \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --install-daemon \
  --daemon-runtime node \
  --skip-skills
```

Agregue `--json` para un resumen legible por maquinas.

<Note>
`--json` **no** implica modo no interactivo. Use `--non-interactive` (y `--workspace`) para scripts.
</Note>

<AccordionGroup>
  <Accordion title="Ejemplo de Gemini">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice gemini-api-key \
      --gemini-api-key "$GEMINI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ejemplo de Z.AI">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice zai-api-key \
      --zai-api-key "$ZAI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ejemplo de Vercel AI Gateway">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice ai-gateway-api-key \
      --ai-gateway-api-key "$AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ejemplo de Cloudflare AI Gateway">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice cloudflare-ai-gateway-api-key \
      --cloudflare-ai-gateway-account-id "your-account-id" \
      --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
      --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ejemplo de Moonshot">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice moonshot-api-key \
      --moonshot-api-key "$MOONSHOT_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ejemplo de Synthetic">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice synthetic-api-key \
      --synthetic-api-key "$SYNTHETIC_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Ejemplo de OpenCode Zen">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice opencode-zen \
      --opencode-zen-api-key "$OPENCODE_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
</AccordionGroup>

### Agregar agente (no interactivo)

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.2 \
  --bind whatsapp:biz \
  --non-interactive \
  --json
```

## RPC del asistente del Gateway

El Gateway expone el flujo del asistente via RPC (`wizard.start`, `wizard.next`, `wizard.cancel`, `wizard.status`).
Los clientes (app de macOS, UI de Control) pueden renderizar los pasos sin reimplementar la logica de incorporacion.

## Configuracion de Signal (signal-cli)

El asistente puede instalar `signal-cli` desde los releases de GitHub:

- Descarga el recurso de la version apropiada.
- Lo almacena en `~/.openclaw/tools/signal-cli/<version>/`.
- Escribe `channels.signal.cliPath` en su configuracion.

Notas:

- Las compilaciones JVM requieren **Java 21**.
- Se usan compilaciones nativas cuando estan disponibles.
- Windows usa WSL2; la instalacion de signal-cli sigue el flujo de Linux dentro de WSL.

## Que escribe el asistente

Campos tipicos en `~/.openclaw/openclaw.json`:

- `agents.defaults.workspace`
- `agents.defaults.model` / `models.providers` (si se elige Minimax)
- `gateway.*` (modo, enlace, autenticacion, Tailscale)
- `channels.telegram.botToken`, `channels.discord.token`, `channels.signal.*`, `channels.imessage.*`
- Listas de permitidos de canales (Slack/Discord/Matrix/Microsoft Teams) cuando usted opta por ellas durante los avisos (los nombres se resuelven a IDs cuando es posible).
- `skills.install.nodeManager`
- `wizard.lastRunAt`
- `wizard.lastRunVersion`
- `wizard.lastRunCommit`
- `wizard.lastRunCommand`
- `wizard.lastRunMode`

`openclaw agents add` escribe `agents.list[]` y `bindings` opcional.

Las credenciales de WhatsApp van bajo `~/.openclaw/credentials/whatsapp/<accountId>/`.
Las sesiones se almacenan bajo `~/.openclaw/agents/<agentId>/sessions/`.

Algunos canales se entregan como plugins. Cuando usted elige uno durante la incorporacion, el asistente
le solicitara instalarlo (npm o una ruta local) antes de que pueda configurarse.

## Documentos relacionados

- Vision general del asistente: [Onboarding Wizard](/start/wizard)
- Incorporacion de la app de macOS: [Onboarding](/start/onboarding)
- Referencia de configuracion: [Gateway configuration](/gateway/configuration)
- Proveedores: [WhatsApp](/channels/whatsapp), [Telegram](/channels/telegram), [Discord](/channels/discord), [Google Chat](/channels/googlechat), [Signal](/channels/signal), [BlueBubbles](/channels/bluebubbles) (iMessage), [iMessage](/channels/imessage) (legacy)
- Skills: [Skills](/tools/skills), [Skills config](/tools/skills-config)
