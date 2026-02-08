---
summary: "Plugins/extensiones de OpenClaw: descubrimiento, configuracion y seguridad"
read_when:
  - Al agregar o modificar plugins/extensiones
  - Al documentar reglas de instalacion o carga de plugins
title: "Plugins"
x-i18n:
  source_path: tools/plugin.md
  source_hash: b36ca6b90ca03eaa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:03Z
---

# Plugins (Extensiones)

## Inicio rapido (¿nuevo en plugins?)

Un plugin es simplemente un **pequeño modulo de codigo** que extiende OpenClaw con
funcionalidades adicionales (comandos, herramientas y Gateway RPC).

La mayoria del tiempo, usara plugins cuando quiera una funcion que aun no esta
integrada en el nucleo de OpenClaw (o cuando quiera mantener funciones opcionales
fuera de su instalacion principal).

Ruta rapida:

1. Vea que ya esta cargado:

```bash
openclaw plugins list
```

2. Instale un plugin oficial (ejemplo: Voice Call):

```bash
openclaw plugins install @openclaw/voice-call
```

3. Reinicie el Gateway, luego configure en `plugins.entries.<id>.config`.

Vea [Voice Call](/plugins/voice-call) para un ejemplo concreto de plugin.

## Plugins disponibles (oficiales)

- Microsoft Teams es solo mediante plugin a partir de 2026.1.15; instale `@openclaw/msteams` si usa Teams.
- Memory (Core) — plugin de busqueda de memoria incluido (habilitado por defecto via `plugins.slots.memory`)
- Memory (LanceDB) — plugin de memoria a largo plazo incluido (auto‑recall/capture; configure `plugins.slots.memory = "memory-lancedb"`)
- [Voice Call](/plugins/voice-call) — `@openclaw/voice-call`
- [Zalo Personal](/plugins/zalouser) — `@openclaw/zalouser`
- [Matrix](/channels/matrix) — `@openclaw/matrix`
- [Nostr](/channels/nostr) — `@openclaw/nostr`
- [Zalo](/channels/zalo) — `@openclaw/zalo`
- [Microsoft Teams](/channels/msteams) — `@openclaw/msteams`
- Google Antigravity OAuth (auth de proveedor) — incluido como `google-antigravity-auth` (deshabilitado por defecto)
- Gemini CLI OAuth (auth de proveedor) — incluido como `google-gemini-cli-auth` (deshabilitado por defecto)
- Qwen OAuth (auth de proveedor) — incluido como `qwen-portal-auth` (deshabilitado por defecto)
- Copilot Proxy (auth de proveedor) — puente local de VS Code Copilot Proxy; distinto del inicio de sesion del dispositivo integrado `github-copilot` (incluido, deshabilitado por defecto)

Los plugins de OpenClaw son **modulos TypeScript** cargados en tiempo de ejecucion via jiti. **La validacion de configuracion no ejecuta codigo del plugin**; utiliza el manifiesto del plugin y JSON Schema. Vea [Plugin manifest](/plugins/manifest).

Los plugins pueden registrar:

- Metodos Gateway RPC
- Manejadores HTTP del Gateway
- Herramientas del agente
- Comandos CLI
- Servicios en segundo plano
- Validacion de configuracion opcional
- **Skills** (listando directorios `skills` en el manifiesto del plugin)
- **Comandos de respuesta automatica** (se ejecutan sin invocar al agente de IA)

Los plugins se ejecutan **en el mismo proceso** que el Gateway, asi que tratelos como codigo de confianza.
Guia de creacion de herramientas: [Plugin agent tools](/plugins/agent-tools).

## Ayudantes en tiempo de ejecucion

Los plugins pueden acceder a ayudantes centrales seleccionados via `api.runtime`. Para TTS de telefonia:

```ts
const result = await api.runtime.tts.textToSpeechTelephony({
  text: "Hello from OpenClaw",
  cfg: api.config,
});
```

Notas:

- Usa la configuracion central `messages.tts` (OpenAI o ElevenLabs).
- Devuelve un buffer de audio PCM + frecuencia de muestreo. Los plugins deben re-muestrear/codificar para los proveedores.
- Edge TTS no es compatible con telefonia.

## Descubrimiento y precedencia

OpenClaw escanea, en orden:

1. Rutas de configuracion

- `plugins.load.paths` (archivo o directorio)

2. Extensiones del workspace

- `<workspace>/.openclaw/extensions/*.ts`
- `<workspace>/.openclaw/extensions/*/index.ts`

3. Extensiones globales

- `~/.openclaw/extensions/*.ts`
- `~/.openclaw/extensions/*/index.ts`

4. Extensiones incluidas (enviadas con OpenClaw, **deshabilitadas por defecto**)

- `<openclaw>/extensions/*`

Los plugins incluidos deben habilitarse explicitamente via `plugins.entries.<id>.enabled`
o `openclaw plugins enable <id>`. Los plugins instalados se habilitan por defecto,
pero pueden deshabilitarse de la misma manera.

Cada plugin debe incluir un archivo `openclaw.plugin.json` en su raiz. Si una ruta
apunta a un archivo, la raiz del plugin es el directorio del archivo y debe contener el
manifiesto.

Si varios plugins se resuelven al mismo id, la primera coincidencia en el orden
anterior gana y las copias de menor precedencia se ignoran.

### Paquetes de paquetes

Un directorio de plugins puede incluir un `package.json` con `openclaw.extensions`:

```json
{
  "name": "my-pack",
  "openclaw": {
    "extensions": ["./src/safety.ts", "./src/tools.ts"]
  }
}
```

Cada entrada se convierte en un plugin. Si el paquete enumera multiples extensiones, el id del plugin
se convierte en `name/<fileBase>`.

Si su plugin importa dependencias npm, instalelas en ese directorio para que
`node_modules` este disponible (`npm install` / `pnpm install`).

### Metadatos del catalogo de canales

Los plugins de canal pueden anunciar metadatos de incorporacion via `openclaw.channel` y
pistas de instalacion via `openclaw.install`. Esto mantiene el catalogo central sin datos.

Ejemplo:

```json
{
  "name": "@openclaw/nextcloud-talk",
  "openclaw": {
    "extensions": ["./index.ts"],
    "channel": {
      "id": "nextcloud-talk",
      "label": "Nextcloud Talk",
      "selectionLabel": "Nextcloud Talk (self-hosted)",
      "docsPath": "/channels/nextcloud-talk",
      "docsLabel": "nextcloud-talk",
      "blurb": "Self-hosted chat via Nextcloud Talk webhook bots.",
      "order": 65,
      "aliases": ["nc-talk", "nc"]
    },
    "install": {
      "npmSpec": "@openclaw/nextcloud-talk",
      "localPath": "extensions/nextcloud-talk",
      "defaultChoice": "npm"
    }
  }
}
```

OpenClaw tambien puede fusionar **catalogos de canales externos** (por ejemplo, una exportacion de registro MPM). Coloque un archivo JSON en uno de:

- `~/.openclaw/mpm/plugins.json`
- `~/.openclaw/mpm/catalog.json`
- `~/.openclaw/plugins/catalog.json`

O apunte `OPENCLAW_PLUGIN_CATALOG_PATHS` (o `OPENCLAW_MPM_CATALOG_PATHS`) a
uno o mas archivos JSON (delimitados por coma/punto y coma/`PATH`). Cada archivo debe
contener `{ "entries": [ { "name": "@scope/pkg", "openclaw": { "channel": {...}, "install": {...} } } ] }`.

## IDs de plugins

IDs de plugin por defecto:

- Paquetes de paquetes: `package.json` `name`
- Archivo independiente: nombre base del archivo (`~/.../voice-call.ts` → `voice-call`)

Si un plugin exporta `id`, OpenClaw lo usa pero advierte cuando no coincide con el
id configurado.

## Configuracion

```json5
{
  plugins: {
    enabled: true,
    allow: ["voice-call"],
    deny: ["untrusted-plugin"],
    load: { paths: ["~/Projects/oss/voice-call-extension"] },
    entries: {
      "voice-call": { enabled: true, config: { provider: "twilio" } },
    },
  },
}
```

Campos:

- `enabled`: interruptor maestro (por defecto: true)
- `allow`: lista de permitidos (opcional)
- `deny`: lista de denegados (opcional; la denegacion gana)
- `load.paths`: archivos/directorios extra de plugins
- `entries.<id>`: interruptores por plugin + configuracion

Los cambios de configuracion **requieren reiniciar el gateway**.

Reglas de validacion (estrictas):

- IDs de plugin desconocidos en `entries`, `allow`, `deny` o `slots` son **errores**.
- Claves `channels.<id>` desconocidas son **errores** a menos que el manifiesto del plugin declare
  el id del canal.
- La configuracion del plugin se valida usando el JSON Schema incrustado en
  `openclaw.plugin.json` (`configSchema`).
- Si un plugin esta deshabilitado, su configuracion se preserva y se emite una **advertencia**.

## Ranuras de plugins (categorias exclusivas)

Algunas categorias de plugins son **exclusivas** (solo una activa a la vez). Use
`plugins.slots` para seleccionar que plugin posee la ranura:

```json5
{
  plugins: {
    slots: {
      memory: "memory-core", // or "none" to disable memory plugins
    },
  },
}
```

Si varios plugins declaran `kind: "memory"`, solo se carga el seleccionado. Los demas
se deshabilitan con diagnosticos.

## UI de Control (schema + etiquetas)

La UI de Control usa `config.schema` (JSON Schema + `uiHints`) para renderizar mejores formularios.

OpenClaw amplía `uiHints` en tiempo de ejecucion segun los plugins descubiertos:

- Agrega etiquetas por plugin para `plugins.entries.<id>` / `.enabled` / `.config`
- Fusiona pistas opcionales de campos de configuracion proporcionadas por el plugin bajo:
  `plugins.entries.<id>.config.<field>`

Si quiere que los campos de configuracion de su plugin muestren buenas etiquetas/placeholders (y marquen secretos como sensibles),
proporcione `uiHints` junto a su JSON Schema en el manifiesto del plugin.

Ejemplo:

```json
{
  "id": "my-plugin",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "apiKey": { "type": "string" },
      "region": { "type": "string" }
    }
  },
  "uiHints": {
    "apiKey": { "label": "API Key", "sensitive": true },
    "region": { "label": "Region", "placeholder": "us-east-1" }
  }
}
```

## CLI

```bash
openclaw plugins list
openclaw plugins info <id>
openclaw plugins install <path>                 # copy a local file/dir into ~/.openclaw/extensions/<id>
openclaw plugins install ./extensions/voice-call # relative path ok
openclaw plugins install ./plugin.tgz           # install from a local tarball
openclaw plugins install ./plugin.zip           # install from a local zip
openclaw plugins install -l ./extensions/voice-call # link (no copy) for dev
openclaw plugins install @openclaw/voice-call # install from npm
openclaw plugins update <id>
openclaw plugins update --all
openclaw plugins enable <id>
openclaw plugins disable <id>
openclaw plugins doctor
```

`plugins update` solo funciona para instalaciones npm rastreadas bajo `plugins.installs`.

Los plugins tambien pueden registrar sus propios comandos de nivel superior (ejemplo: `openclaw voicecall`).

## API de plugins (resumen)

Los plugins exportan uno de:

- Una funcion: `(api) => { ... }`
- Un objeto: `{ id, name, configSchema, register(api) { ... } }`

## Hooks de plugins

Los plugins pueden incluir hooks y registrarlos en tiempo de ejecucion. Esto permite que un plugin incluya
automatizacion basada en eventos sin una instalacion separada de paquetes de hooks.

### Ejemplo

```
import { registerPluginHooksFromDir } from "openclaw/plugin-sdk";

export default function register(api) {
  registerPluginHooksFromDir(api, "./hooks");
}
```

Notas:

- Los directorios de hooks siguen la estructura normal de hooks (`HOOK.md` + `handler.ts`).
- Las reglas de elegibilidad de hooks aun aplican (SO/bins/variables de entorno/requisitos de configuracion).
- Los hooks gestionados por plugins aparecen en `openclaw hooks list` con `plugin:<id>`.
- No puede habilitar/deshabilitar hooks gestionados por plugins via `openclaw hooks`; habilite/deshabilite el plugin en su lugar.

## Plugins de proveedor (auth de modelos)

Los plugins pueden registrar flujos de **auth de proveedor de modelos** para que los usuarios ejecuten OAuth o
configuracion de API key dentro de OpenClaw (no se necesitan scripts externos).

Registre un proveedor via `api.registerProvider(...)`. Cada proveedor expone uno
o mas metodos de auth (OAuth, API key, codigo de dispositivo, etc.). Estos metodos impulsan:

- `openclaw models auth login --provider <id> [--method <id>]`

Ejemplo:

```ts
api.registerProvider({
  id: "acme",
  label: "AcmeAI",
  auth: [
    {
      id: "oauth",
      label: "OAuth",
      kind: "oauth",
      run: async (ctx) => {
        // Run OAuth flow and return auth profiles.
        return {
          profiles: [
            {
              profileId: "acme:default",
              credential: {
                type: "oauth",
                provider: "acme",
                access: "...",
                refresh: "...",
                expires: Date.now() + 3600 * 1000,
              },
            },
          ],
          defaultModel: "acme/opus-1",
        };
      },
    },
  ],
});
```

Notas:

- `run` recibe un `ProviderAuthContext` con ayudantes `prompter`, `runtime`,
  `openUrl` y `oauth.createVpsAwareHandlers`.
- Devuelva `configPatch` cuando necesite agregar modelos por defecto o configuracion del proveedor.
- Devuelva `defaultModel` para que `--set-default` pueda actualizar los valores por defecto del agente.

### Registrar un canal de mensajeria

Los plugins pueden registrar **plugins de canal** que se comportan como canales integrados
(WhatsApp, Telegram, etc.). La configuracion del canal vive bajo `channels.<id>` y es
validada por el codigo de su plugin de canal.

```ts
const myChannel = {
  id: "acmechat",
  meta: {
    id: "acmechat",
    label: "AcmeChat",
    selectionLabel: "AcmeChat (API)",
    docsPath: "/channels/acmechat",
    blurb: "demo channel plugin.",
    aliases: ["acme"],
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.acmechat?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.acmechat?.accounts?.[accountId ?? "default"] ?? {
        accountId,
      },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async () => ({ ok: true }),
  },
};

export default function (api) {
  api.registerChannel({ plugin: myChannel });
}
```

Notas:

- Coloque la configuracion bajo `channels.<id>` (no `plugins.entries`).
- `meta.label` se usa para etiquetas en listas de CLI/UI.
- `meta.aliases` agrega ids alternativos para normalizacion y entradas de CLI.
- `meta.preferOver` enumera ids de canales para omitir la auto-habilitacion cuando ambos estan configurados.
- `meta.detailLabel` y `meta.systemImage` permiten a las UIs mostrar etiquetas/iconos de canal mas ricos.

### Escribir un nuevo canal de mensajeria (paso a paso)

Use esto cuando quiera una **nueva superficie de chat** (un “canal de mensajeria”), no un proveedor de modelos.
La documentacion de proveedores de modelos vive bajo `/providers/*`.

1. Elija un id + forma de configuracion

- Toda la configuracion del canal vive bajo `channels.<id>`.
- Prefiera `channels.<id>.accounts.<accountId>` para configuraciones multi‑cuenta.

2. Defina los metadatos del canal

- `meta.label`, `meta.selectionLabel`, `meta.docsPath`, `meta.blurb` controlan las listas de CLI/UI.
- `meta.docsPath` debe apuntar a una pagina de documentacion como `/channels/<id>`.
- `meta.preferOver` permite que un plugin reemplace otro canal (la auto-habilitacion lo prefiere).
- `meta.detailLabel` y `meta.systemImage` son usados por las UIs para texto/iconos de detalle.

3. Implemente los adaptadores requeridos

- `config.listAccountIds` + `config.resolveAccount`
- `capabilities` (tipos de chat, medios, hilos, etc.)
- `outbound.deliveryMode` + `outbound.sendText` (para envio basico)

4. Agregue adaptadores opcionales segun sea necesario

- `setup` (asistente), `security` (politica de Mensajes directos), `status` (salud/diagnosticos)
- `gateway` (inicio/detencion/login), `mentions`, `threading`, `streaming`
- `actions` (acciones de mensajes), `commands` (comportamiento de comandos nativos)

5. Registre el canal en su plugin

- `api.registerChannel({ plugin })`

Ejemplo minimo de configuracion:

```json5
{
  channels: {
    acmechat: {
      accounts: {
        default: { token: "ACME_TOKEN", enabled: true },
      },
    },
  },
}
```

Plugin de canal minimo (solo salida):

```ts
const plugin = {
  id: "acmechat",
  meta: {
    id: "acmechat",
    label: "AcmeChat",
    selectionLabel: "AcmeChat (API)",
    docsPath: "/channels/acmechat",
    blurb: "AcmeChat messaging channel.",
    aliases: ["acme"],
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.acmechat?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.acmechat?.accounts?.[accountId ?? "default"] ?? {
        accountId,
      },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ text }) => {
      // deliver `text` to your channel here
      return { ok: true };
    },
  },
};

export default function (api) {
  api.registerChannel({ plugin });
}
```

Cargue el plugin (directorio de extensiones o `plugins.load.paths`), reinicie el gateway,
luego configure `channels.<id>` en su configuracion.

### Herramientas del agente

Vea la guia dedicada: [Plugin agent tools](/plugins/agent-tools).

### Registrar un metodo Gateway RPC

```ts
export default function (api) {
  api.registerGatewayMethod("myplugin.status", ({ respond }) => {
    respond(true, { ok: true });
  });
}
```

### Registrar comandos CLI

```ts
export default function (api) {
  api.registerCli(
    ({ program }) => {
      program.command("mycmd").action(() => {
        console.log("Hello");
      });
    },
    { commands: ["mycmd"] },
  );
}
```

### Registrar comandos de respuesta automatica

Los plugins pueden registrar comandos personalizados con barra que se ejecutan **sin invocar al
agente de IA**. Esto es util para comandos de alternancia, verificaciones de estado o acciones rapidas
que no necesitan procesamiento de LLM.

```ts
export default function (api) {
  api.registerCommand({
    name: "mystatus",
    description: "Show plugin status",
    handler: (ctx) => ({
      text: `Plugin is running! Channel: ${ctx.channel}`,
    }),
  });
}
```

Contexto del manejador de comandos:

- `senderId`: El ID del remitente (si esta disponible)
- `channel`: El canal donde se envio el comando
- `isAuthorizedSender`: Si el remitente es un usuario autorizado
- `args`: Argumentos pasados despues del comando (si `acceptsArgs: true`)
- `commandBody`: El texto completo del comando
- `config`: La configuracion actual de OpenClaw

Opciones del comando:

- `name`: Nombre del comando (sin el `/` inicial)
- `description`: Texto de ayuda mostrado en listas de comandos
- `acceptsArgs`: Si el comando acepta argumentos (por defecto: false). Si es false y se proporcionan argumentos, el comando no coincidira y el mensaje pasara a otros manejadores
- `requireAuth`: Si requiere remitente autorizado (por defecto: true)
- `handler`: Funcion que devuelve `{ text: string }` (puede ser async)

Ejemplo con autorizacion y argumentos:

```ts
api.registerCommand({
  name: "setmode",
  description: "Set plugin mode",
  acceptsArgs: true,
  requireAuth: true,
  handler: async (ctx) => {
    const mode = ctx.args?.trim() || "default";
    await saveMode(mode);
    return { text: `Mode set to: ${mode}` };
  },
});
```

Notas:

- Los comandos de plugins se procesan **antes** de los comandos integrados y del agente de IA
- Los comandos se registran globalmente y funcionan en todos los canales
- Los nombres de comandos no distinguen mayusculas/minusculas (`/MyStatus` coincide con `/mystatus`)
- Los nombres de comandos deben comenzar con una letra y contener solo letras, numeros, guiones y guiones bajos
- Los nombres de comandos reservados (como `help`, `status`, `reset`, etc.) no pueden ser sobrescritos por plugins
- El registro duplicado de comandos entre plugins fallara con un error de diagnostico

### Registrar servicios en segundo plano

```ts
export default function (api) {
  api.registerService({
    id: "my-service",
    start: () => api.logger.info("ready"),
    stop: () => api.logger.info("bye"),
  });
}
```

## Convenciones de nombres

- Metodos del Gateway: `pluginId.action` (ejemplo: `voicecall.status`)
- Herramientas: `snake_case` (ejemplo: `voice_call`)
- Comandos CLI: kebab o camel, pero evite colisiones con comandos centrales

## Skills

Los plugins pueden incluir una skill en el repositorio (`skills/<name>/SKILL.md`).
Habilitela con `plugins.entries.<id>.enabled` (u otras compuertas de configuracion) y asegurese de que
este presente en las ubicaciones de skills del workspace/gestionadas.

## Distribucion (npm)

Empaquetado recomendado:

- Paquete principal: `openclaw` (este repositorio)
- Plugins: paquetes npm separados bajo `@openclaw/*` (ejemplo: `@openclaw/voice-call`)

Contrato de publicacion:

- El `package.json` del plugin debe incluir `openclaw.extensions` con uno o mas archivos de entrada.
- Los archivos de entrada pueden ser `.js` o `.ts` (jiti carga TS en tiempo de ejecucion).
- `openclaw plugins install <npm-spec>` usa `npm pack`, extrae en `~/.openclaw/extensions/<id>/` y lo habilita en la configuracion.
- Estabilidad de claves de configuracion: los paquetes con alcance se normalizan al id **sin alcance** para `plugins.entries.*`.

## Plugin de ejemplo: Voice Call

Este repositorio incluye un plugin de llamadas de voz (Twilio o fallback de registro):

- Fuente: `extensions/voice-call`
- Skill: `skills/voice-call`
- CLI: `openclaw voicecall start|status`
- Herramienta: `voice_call`
- RPC: `voicecall.start`, `voicecall.status`
- Configuracion (twilio): `provider: "twilio"` + `twilio.accountSid/authToken/from` (`statusCallbackUrl`, `twimlUrl` opcionales)
- Configuracion (dev): `provider: "log"` (sin red)

Vea [Voice Call](/plugins/voice-call) y `extensions/voice-call/README.md` para configuracion y uso.

## Notas de seguridad

Los plugins se ejecutan en el mismo proceso que el Gateway. Tratarlos como codigo de confianza:

- Instale solo plugins en los que confie.
- Prefiera listas de permitidos `plugins.allow`.
- Reinicie el Gateway despues de cambios.

## Pruebas de plugins

Los plugins pueden (y deben) incluir pruebas:

- Los plugins en el repositorio pueden mantener pruebas Vitest bajo `src/**` (ejemplo: `src/plugins/voice-call.plugin.test.ts`).
- Los plugins publicados por separado deben ejecutar su propio CI (lint/build/test) y validar que `openclaw.extensions` apunte al punto de entrada construido (`dist/index.js`).
