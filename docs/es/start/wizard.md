---
summary: "Asistente de incorporacion del CLI: configuracion guiada para Gateway, espacio de trabajo, canales y Skills"
read_when:
  - Ejecutando o configurando el asistente de incorporacion
  - Configurando una nueva maquina
title: "Asistente de Incorporacion (CLI)"
sidebarTitle: "Onboarding: CLI"
x-i18n:
  source_path: start/wizard.md
  source_hash: 5495d951a2d78ffb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:06Z
---

# Asistente de Incorporacion (CLI)

El asistente de incorporacion es la forma **recomendada** de configurar OpenClaw en macOS,
Linux o Windows (via WSL2; muy recomendado).
Configura un Gateway local o una conexion a un Gateway remoto, ademas de canales, Skills
y valores predeterminados del espacio de trabajo en un solo flujo guiado.

```bash
openclaw onboard
```

<Info>
Chat mas rapido: abra la UI de Control (no se requiere configuracion de canales). Ejecute
`openclaw dashboard` y chatee en el navegador. Documentacion: [Dashboard](/web/dashboard).
</Info>

Para reconfigurar mas adelante:

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` no implica modo no interactivo. Para scripts, use `--non-interactive`.
</Note>

<Tip>
Recomendado: configure una clave de API de Brave Search para que el agente pueda usar `web_search`
(`web_fetch` funciona sin clave). La ruta mas sencilla: `openclaw configure --section web`
que almacena `tools.web.search.apiKey`. Documentacion: [Web tools](/tools/web).
</Tip>

## Inicio Rapido vs Avanzado

El asistente comienza con **Inicio Rapido** (predeterminados) vs **Avanzado** (control total).

<Tabs>
  <Tab title="Inicio Rapido (predeterminados)">
    - Gateway local (loopback)
    - Espacio de trabajo predeterminado (o espacio de trabajo existente)
    - Puerto del Gateway **18789**
    - Autenticacion del Gateway **Token** (generado automaticamente, incluso en loopback)
    - Exposicion por Tailscale **Desactivada**
    - Los Mensajes directos de Telegram + WhatsApp se configuran por defecto en **allowlist** (se le pedira su numero de telefono)
  </Tab>
  <Tab title="Avanzado (control total)">
    - Expone cada paso (modo, espacio de trabajo, gateway, canales, daemon, Skills).
  </Tab>
</Tabs>

## Lo que configura el asistente

**Modo local (predeterminado)** lo guia a traves de estos pasos:

1. **Modelo/Auth** — Clave de API de Anthropic (recomendada), OAuth, OpenAI u otros proveedores. Elija un modelo predeterminado.
2. **Espacio de trabajo** — Ubicacion para los archivos del agente (predeterminado `~/.openclaw/workspace`). Inicializa archivos de arranque.
3. **Gateway** — Puerto, direccion de enlace, modo de autenticacion, exposicion por Tailscale.
4. **Canales** — WhatsApp, Telegram, Discord, Google Chat, Mattermost, Signal, BlueBubbles o iMessage.
5. **Daemon** — Instala un LaunchAgent (macOS) o una unidad de usuario systemd (Linux/WSL2).
6. **Verificacion de salud** — Inicia el Gateway y verifica que este en ejecucion.
7. **Skills** — Instala Skills recomendadas y dependencias opcionales.

<Note>
Volver a ejecutar el asistente **no** borra nada a menos que usted elija explicitamente **Reset** (o pase `--reset`).
Si la configuracion no es valida o contiene claves heredadas, el asistente le pedira ejecutar `openclaw doctor` primero.
</Note>

**Modo remoto** solo configura el cliente local para conectarse a un Gateway en otro lugar.
**No** instala ni cambia nada en el host remoto.

## Agregar otro agente

Use `openclaw agents add <name>` para crear un agente separado con su propio espacio de trabajo,
sesiones y perfiles de autenticacion. Ejecutarlo sin `--workspace` inicia el asistente.

Lo que configura:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

Notas:

- Los espacios de trabajo predeterminados siguen `~/.openclaw/workspace-<agentId>`.
- Agregue `bindings` para enrutar mensajes entrantes (el asistente puede hacerlo).
- Banderas no interactivas: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## Referencia completa

Para desgloses detallados paso a paso, scripting no interactivo, configuracion de Signal,
API RPC y una lista completa de los campos de configuracion que escribe el asistente, vea la
[Referencia del Asistente](/reference/wizard).

## Documentos relacionados

- Referencia de comandos del CLI: [`openclaw onboard`](/cli/onboard)
- Incorporacion de la app de macOS: [Onboarding](/start/onboarding)
- Ritual de primera ejecucion del agente: [Agent Bootstrapping](/start/bootstrapping)
