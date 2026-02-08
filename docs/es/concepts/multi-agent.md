---
summary: "Enrutamiento multiagente: agentes aislados, cuentas de canal y vinculaciones"
title: Enrutamiento Multiagente
read_when: "Quiere múltiples agentes aislados (espacios de trabajo + autenticación) en un solo proceso de Gateway."
status: active
x-i18n:
  source_path: concepts/multi-agent.md
  source_hash: 49b3ba55d8a7f0b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:42Z
---

# Enrutamiento Multiagente

Objetivo: múltiples agentes _aislados_ (espacio de trabajo separado + `agentDir` + sesiones), además de múltiples cuentas de canal (p. ej., dos WhatsApps) en un Gateway en ejecución. El tráfico entrante se enruta a un agente mediante vinculaciones.

## ¿Qué es “un agente”?

Un **agente** es un cerebro completamente delimitado con su propio:

- **Espacio de trabajo** (archivos, AGENTS.md/SOUL.md/USER.md, notas locales, reglas de persona).
- **Directorio de estado** (`agentDir`) para perfiles de autenticación, registro de modelos y configuración por agente.
- **Almacén de sesiones** (historial de chat + estado de enrutamiento) bajo `~/.openclaw/agents/<agentId>/sessions`.

Los perfiles de autenticación son **por agente**. Cada agente lee desde su propio:

```
~/.openclaw/agents/<agentId>/agent/auth-profiles.json
```

Las credenciales del agente principal **no** se comparten automáticamente. Nunca reutilice `agentDir`
entre agentes (provoca colisiones de autenticación/sesión). Si desea compartir credenciales,
copie `auth-profiles.json` en el `agentDir` del otro agente.

Las Skills son por agente mediante la carpeta `skills/` de cada espacio de trabajo, con Skills compartidas
disponibles desde `~/.openclaw/skills`. Consulte [Skills: per-agent vs shared](/tools/skills#per-agent-vs-shared-skills).

El Gateway puede alojar **un agente** (predeterminado) o **muchos agentes** lado a lado.

**Nota del espacio de trabajo:** el espacio de trabajo de cada agente es el **cwd predeterminado**, no un
sandbox estricto. Las rutas relativas se resuelven dentro del espacio de trabajo, pero las rutas absolutas pueden
alcanzar otras ubicaciones del host a menos que el sandboxing esté habilitado. Consulte
[Sandboxing](/gateway/sandboxing).

## Rutas (mapa rápido)

- Configuración: `~/.openclaw/openclaw.json` (o `OPENCLAW_CONFIG_PATH`)
- Directorio de estado: `~/.openclaw` (o `OPENCLAW_STATE_DIR`)
- Espacio de trabajo: `~/.openclaw/workspace` (o `~/.openclaw/workspace-<agentId>`)
- Directorio del agente: `~/.openclaw/agents/<agentId>/agent` (o `agents.list[].agentDir`)
- Sesiones: `~/.openclaw/agents/<agentId>/sessions`

### Modo de un solo agente (predeterminado)

Si no hace nada, OpenClaw ejecuta un solo agente:

- `agentId` tiene como valor predeterminado **`main`**.
- Las sesiones se indexan como `agent:main:<mainKey>`.
- El espacio de trabajo predeterminado es `~/.openclaw/workspace` (o `~/.openclaw/workspace-<profile>` cuando se establece `OPENCLAW_PROFILE`).
- El estado predeterminado es `~/.openclaw/agents/main/agent`.

## Asistente de agentes

Use el asistente de agentes para agregar un nuevo agente aislado:

```bash
openclaw agents add work
```

Luego agregue `bindings` (o deje que el asistente lo haga) para enrutar los mensajes entrantes.

Verifique con:

```bash
openclaw agents list --bindings
```

## Múltiples agentes = múltiples personas, múltiples personalidades

Con **múltiples agentes**, cada `agentId` se convierte en una **persona completamente aislada**:

- **Diferentes números de teléfono/cuentas** (por `accountId` de canal).
- **Diferentes personalidades** (archivos del espacio de trabajo por agente como `AGENTS.md` y `SOUL.md`).
- **Autenticación + sesiones separadas** (sin interferencias a menos que se habilite explícitamente).

Esto permite que **múltiples personas** compartan un servidor de Gateway manteniendo aislados sus “cerebros” de IA y datos.

## Un número de WhatsApp, múltiples personas (división de Mensajes directos)

Puede enrutar **diferentes Mensajes directos de WhatsApp** a distintos agentes manteniéndose en **una sola cuenta de WhatsApp**. Haga la coincidencia por E.164 del remitente (como `+15551234567`) con `peer.kind: "dm"`. Las respuestas siguen saliendo del mismo número de WhatsApp (sin identidad de remitente por agente).

Detalle importante: los chats directos colapsan en la **clave de sesión principal** del agente, por lo que el aislamiento real requiere **un agente por persona**.

Ejemplo:

```json5
{
  agents: {
    list: [
      { id: "alex", workspace: "~/.openclaw/workspace-alex" },
      { id: "mia", workspace: "~/.openclaw/workspace-mia" },
    ],
  },
  bindings: [
    { agentId: "alex", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230001" } } },
    { agentId: "mia", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551230002" } } },
  ],
  channels: {
    whatsapp: {
      dmPolicy: "allowlist",
      allowFrom: ["+15551230001", "+15551230002"],
    },
  },
}
```

Notas:

- El control de acceso de Mensajes directos es **global por cuenta de WhatsApp** (emparejamiento/lista de permitidos), no por agente.
- Para grupos compartidos, vincule el grupo a un agente o use [Broadcast groups](/broadcast-groups).

## Reglas de enrutamiento (cómo los mensajes eligen un agente)

Las vinculaciones son **determinísticas** y **la más específica gana**:

1. Coincidencia de `peer` (ID exacto de Mensaje directo/grupo/canal)
2. `guildId` (Discord)
3. `teamId` (Slack)
4. Coincidencia de `accountId` para un canal
5. Coincidencia a nivel de canal (`accountId: "*"`)
6. Repliegue al agente predeterminado (`agents.list[].default`, de lo contrario la primera entrada de la lista; predeterminado: `main`)

## Múltiples cuentas / números de teléfono

Los canales que admiten **múltiples cuentas** (p. ej., WhatsApp) usan `accountId` para identificar
cada inicio de sesión. Cada `accountId` puede enrutarse a un agente diferente, de modo que un servidor puede alojar
múltiples números de teléfono sin mezclar sesiones.

## Conceptos

- `agentId`: un “cerebro” (espacio de trabajo, autenticación por agente, almacén de sesiones por agente).
- `accountId`: una instancia de cuenta de canal (p. ej., cuenta de WhatsApp `"personal"` vs `"biz"`).
- `binding`: enruta mensajes entrantes a un `agentId` por `(channel, accountId, peer)` y, opcionalmente, IDs de guild/equipo.
- Los chats directos colapsan en `agent:<agentId>:<mainKey>` (principal por agente; `session.mainKey`).

## Ejemplo: dos WhatsApps → dos agentes

`~/.openclaw/openclaw.json` (JSON5):

```js
{
  agents: {
    list: [
      {
        id: "home",
        default: true,
        name: "Home",
        workspace: "~/.openclaw/workspace-home",
        agentDir: "~/.openclaw/agents/home/agent",
      },
      {
        id: "work",
        name: "Work",
        workspace: "~/.openclaw/workspace-work",
        agentDir: "~/.openclaw/agents/work/agent",
      },
    ],
  },

  // Deterministic routing: first match wins (most-specific first).
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } },

    // Optional per-peer override (example: send a specific group to work agent).
    {
      agentId: "work",
      match: {
        channel: "whatsapp",
        accountId: "personal",
        peer: { kind: "group", id: "1203630...@g.us" },
      },
    },
  ],

  // Off by default: agent-to-agent messaging must be explicitly enabled + allowlisted.
  tools: {
    agentToAgent: {
      enabled: false,
      allow: ["home", "work"],
    },
  },

  channels: {
    whatsapp: {
      accounts: {
        personal: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/personal
          // authDir: "~/.openclaw/credentials/whatsapp/personal",
        },
        biz: {
          // Optional override. Default: ~/.openclaw/credentials/whatsapp/biz
          // authDir: "~/.openclaw/credentials/whatsapp/biz",
        },
      },
    },
  },
}
```

## Ejemplo: chat diario de WhatsApp + trabajo profundo en Telegram

Divida por canal: enrute WhatsApp a un agente rápido para el día a día y Telegram a un agente Opus.

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },
    { agentId: "opus", match: { channel: "telegram" } },
  ],
}
```

Notas:

- Si tiene múltiples cuentas para un canal, agregue `accountId` a la vinculación (por ejemplo `{ channel: "whatsapp", accountId: "personal" }`).
- Para enrutar un solo Mensaje directo/grupo a Opus manteniendo el resto en chat, agregue una vinculación de `match.peer` para ese par; las coincidencias por par siempre ganan sobre las reglas a nivel de canal.

## Ejemplo: mismo canal, un par a Opus

Mantenga WhatsApp en el agente rápido, pero enrute un Mensaje directo a Opus:

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-6",
      },
    ],
  },
  bindings: [
    { agentId: "opus", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551234567" } } },
    { agentId: "chat", match: { channel: "whatsapp" } },
  ],
}
```

Las vinculaciones por par siempre ganan, así que manténgalas por encima de la regla a nivel de canal.

## Agente familiar vinculado a un grupo de WhatsApp

Vincule un agente familiar dedicado a un solo grupo de WhatsApp, con control por menciones
y una política de herramientas más estricta:

```json5
{
  agents: {
    list: [
      {
        id: "family",
        name: "Family",
        workspace: "~/.openclaw/workspace-family",
        identity: { name: "Family Bot" },
        groupChat: {
          mentionPatterns: ["@family", "@familybot", "@Family Bot"],
        },
        sandbox: {
          mode: "all",
          scope: "agent",
        },
        tools: {
          allow: [
            "exec",
            "read",
            "sessions_list",
            "sessions_history",
            "sessions_send",
            "sessions_spawn",
            "session_status",
          ],
          deny: ["write", "edit", "apply_patch", "browser", "canvas", "nodes", "cron"],
        },
      },
    ],
  },
  bindings: [
    {
      agentId: "family",
      match: {
        channel: "whatsapp",
        peer: { kind: "group", id: "120363999999999999@g.us" },
      },
    },
  ],
}
```

Notas:

- Las listas de permitir/denegar de herramientas son **tools**, no Skills. Si una Skill necesita ejecutar un
  binario, asegúrese de que `exec` esté permitido y de que el binario exista en el sandbox.
- Para un control más estricto, establezca `agents.list[].groupChat.mentionPatterns` y mantenga
  habilitadas las listas de permitidos de grupo para el canal.

## Sandbox y configuración de herramientas por agente

A partir de v2026.1.6, cada agente puede tener su propio sandbox y restricciones de herramientas:

```js
{
  agents: {
    list: [
      {
        id: "personal",
        workspace: "~/.openclaw/workspace-personal",
        sandbox: {
          mode: "off",  // No sandbox for personal agent
        },
        // No tool restrictions - all tools available
      },
      {
        id: "family",
        workspace: "~/.openclaw/workspace-family",
        sandbox: {
          mode: "all",     // Always sandboxed
          scope: "agent",  // One container per agent
          docker: {
            // Optional one-time setup after container creation
            setupCommand: "apt-get update && apt-get install -y git curl",
          },
        },
        tools: {
          allow: ["read"],                    // Only read tool
          deny: ["exec", "write", "edit", "apply_patch"],    // Deny others
        },
      },
    ],
  },
}
```

Nota: `setupCommand` vive bajo `sandbox.docker` y se ejecuta una vez al crear el contenedor.
Las anulaciones `sandbox.docker.*` por agente se ignoran cuando el alcance resuelto es `"shared"`.

**Beneficios:**

- **Aislamiento de seguridad**: restrinja herramientas para agentes no confiables
- **Control de recursos**: ponga en sandbox agentes específicos mientras mantiene otros en el host
- **Políticas flexibles**: permisos diferentes por agente

Nota: `tools.elevated` es **global** y se basa en el remitente; no es configurable por agente.
Si necesita límites por agente, use `agents.list[].tools` para denegar `exec`.
Para segmentación por grupos, use `agents.list[].groupChat.mentionPatterns` para que las @menciones se asignen limpiamente al agente previsto.

Consulte [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) para ver ejemplos detallados.
