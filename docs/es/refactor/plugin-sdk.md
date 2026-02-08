---
summary: "Plan: un SDK de plugins limpio + runtime para todos los conectores de mensajeria"
read_when:
  - Definiendo o refactorizando la arquitectura de plugins
  - Migrando conectores de canales al SDK/runtime de plugins
title: "Refactorizacion del SDK de Plugins"
x-i18n:
  source_path: refactor/plugin-sdk.md
  source_hash: d1964e2e47a19ee1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:51Z
---

# Plan de Refactorizacion del SDK + Runtime de Plugins

Objetivo: cada conector de mensajeria es un plugin (incluido o externo) que usa una API estable unica.
Ningun plugin importa directamente desde `src/**`. Todas las dependencias pasan por el SDK o el runtime.

## Por que ahora

- Los conectores actuales mezclan patrones: importaciones directas del core, puentes solo de dist y helpers personalizados.
- Esto hace que las actualizaciones sean fragiles y bloquea una superficie limpia para plugins externos.

## Arquitectura objetivo (dos capas)

### 1) SDK de Plugins (tiempo de compilacion, estable, publicable)

Alcance: tipos, helpers y utilidades de configuracion. Sin estado en runtime ni efectos secundarios.

Contenido (ejemplos):

- Tipos: `ChannelPlugin`, adaptadores, `ChannelMeta`, `ChannelCapabilities`, `ChannelDirectoryEntry`.
- Helpers de configuracion: `buildChannelConfigSchema`, `setAccountEnabledInConfigSection`, `deleteAccountFromConfigSection`,
  `applyAccountNameToChannelSection`.
- Helpers de emparejamiento: `PAIRING_APPROVED_MESSAGE`, `formatPairingApproveHint`.
- Helpers de incorporacion: `promptChannelAccessConfig`, `addWildcardAllowFrom`, tipos de incorporacion.
- Helpers de parametros de herramientas: `createActionGate`, `readStringParam`, `readNumberParam`, `readReactionParams`, `jsonResult`.
- Helper de enlace a documentacion: `formatDocsLink`.

Entrega:

- Publicar como `openclaw/plugin-sdk` (o exportar desde el core bajo `openclaw/plugin-sdk`).
- Semver con garantias explicitas de estabilidad.

### 2) Runtime de Plugins (superficie de ejecucion, inyectado)

Alcance: todo lo que toca el comportamiento del runtime del core.
Accedido via `OpenClawPluginApi.runtime` para que los plugins nunca importen `src/**`.

Superficie propuesta (minima pero completa):

```ts
export type PluginRuntime = {
  channel: {
    text: {
      chunkMarkdownText(text: string, limit: number): string[];
      resolveTextChunkLimit(cfg: OpenClawConfig, channel: string, accountId?: string): number;
      hasControlCommand(text: string, cfg: OpenClawConfig): boolean;
    };
    reply: {
      dispatchReplyWithBufferedBlockDispatcher(params: {
        ctx: unknown;
        cfg: unknown;
        dispatcherOptions: {
          deliver: (payload: {
            text?: string;
            mediaUrls?: string[];
            mediaUrl?: string;
          }) => void | Promise<void>;
          onError?: (err: unknown, info: { kind: string }) => void;
        };
      }): Promise<void>;
      createReplyDispatcherWithTyping?: unknown; // adapter for Teams-style flows
    };
    routing: {
      resolveAgentRoute(params: {
        cfg: unknown;
        channel: string;
        accountId: string;
        peer: { kind: "dm" | "group" | "channel"; id: string };
      }): { sessionKey: string; accountId: string };
    };
    pairing: {
      buildPairingReply(params: { channel: string; idLine: string; code: string }): string;
      readAllowFromStore(channel: string): Promise<string[]>;
      upsertPairingRequest(params: {
        channel: string;
        id: string;
        meta?: { name?: string };
      }): Promise<{ code: string; created: boolean }>;
    };
    media: {
      fetchRemoteMedia(params: { url: string }): Promise<{ buffer: Buffer; contentType?: string }>;
      saveMediaBuffer(
        buffer: Uint8Array,
        contentType: string | undefined,
        direction: "inbound" | "outbound",
        maxBytes: number,
      ): Promise<{ path: string; contentType?: string }>;
    };
    mentions: {
      buildMentionRegexes(cfg: OpenClawConfig, agentId?: string): RegExp[];
      matchesMentionPatterns(text: string, regexes: RegExp[]): boolean;
    };
    groups: {
      resolveGroupPolicy(
        cfg: OpenClawConfig,
        channel: string,
        accountId: string,
        groupId: string,
      ): {
        allowlistEnabled: boolean;
        allowed: boolean;
        groupConfig?: unknown;
        defaultConfig?: unknown;
      };
      resolveRequireMention(
        cfg: OpenClawConfig,
        channel: string,
        accountId: string,
        groupId: string,
        override?: boolean,
      ): boolean;
    };
    debounce: {
      createInboundDebouncer<T>(opts: {
        debounceMs: number;
        buildKey: (v: T) => string | null;
        shouldDebounce: (v: T) => boolean;
        onFlush: (entries: T[]) => Promise<void>;
        onError?: (err: unknown) => void;
      }): { push: (v: T) => void; flush: () => Promise<void> };
      resolveInboundDebounceMs(cfg: OpenClawConfig, channel: string): number;
    };
    commands: {
      resolveCommandAuthorizedFromAuthorizers(params: {
        useAccessGroups: boolean;
        authorizers: Array<{ configured: boolean; allowed: boolean }>;
      }): boolean;
    };
  };
  logging: {
    shouldLogVerbose(): boolean;
    getChildLogger(name: string): PluginLogger;
  };
  state: {
    resolveStateDir(cfg: OpenClawConfig): string;
  };
};
```

Notas:

- El runtime es la unica forma de acceder al comportamiento del core.
- El SDK es intencionalmente pequeno y estable.
- Cada metodo del runtime mapea a una implementacion existente del core (sin duplicacion).

## Plan de migracion (por fases, seguro)

### Fase 0: andamiaje

- Introducir `openclaw/plugin-sdk`.
- Agregar `api.runtime` a `OpenClawPluginApi` con la superficie anterior.
- Mantener las importaciones existentes durante una ventana de transicion (advertencias de deprecacion).

### Fase 1: limpieza de puentes (bajo riesgo)

- Reemplazar `core-bridge.ts` por extension con `api.runtime`.
- Migrar BlueBubbles, Zalo, Zalo Personal primero (ya estan cerca).
- Eliminar codigo de puente duplicado.

### Fase 2: plugins con importaciones directas ligeras

- Migrar Matrix al SDK + runtime.
- Validar la incorporacion, el directorio y la logica de menciones de grupo.

### Fase 3: plugins con importaciones directas pesadas

- Migrar MS Teams (el conjunto mas grande de helpers de runtime).
- Asegurar que la semantica de respuestas/escritura coincida con el comportamiento actual.

### Fase 4: pluginizacion de iMessage

- Mover iMessage a `extensions/imessage`.
- Reemplazar llamadas directas al core con `api.runtime`.
- Mantener intactas las claves de configuracion, el comportamiento del CLI y la documentacion.

### Fase 5: cumplimiento

- Agregar regla de lint / verificacion de CI: no `extensions/**` imports desde `src/**`.
- Agregar verificaciones de compatibilidad de versiones del SDK de plugins (runtime + semver del SDK).

## Compatibilidad y versionado

- SDK: semver, cambios publicados y documentados.
- Runtime: versionado por lanzamiento del core. Agregar `api.runtime.version`.
- Los plugins declaran un rango de runtime requerido (por ejemplo, `openclawRuntime: ">=2026.2.0"`).

## Estrategia de pruebas

- Pruebas unitarias a nivel de adaptador (funciones del runtime ejercitadas con la implementacion real del core).
- Pruebas golden por plugin: asegurar que no haya deriva de comportamiento (enrutamiento, emparejamiento, allowlist, control de menciones).
- Un unico ejemplo de plugin de extremo a extremo usado en CI (instalar + ejecutar + smoke).

## Preguntas abiertas

- Donde alojar los tipos del SDK: paquete separado o exportacion del core?
- Distribucion de tipos del runtime: en el SDK (solo tipos) o en el core?
- Como exponer enlaces de documentacion para plugins incluidos vs externos?
- Permitimos importaciones directas limitadas del core para plugins en el repositorio durante la transicion?

## Criterios de exito

- Todos los conectores de canales son plugins que usan SDK + runtime.
- Ningun `extensions/**` imports desde `src/**`.
- Las nuevas plantillas de conectores dependen solo del SDK + runtime.
- Los plugins externos pueden desarrollarse y actualizarse sin acceso al codigo fuente del core.

Documentos relacionados: [Plugins](/plugin), [Channels](/channels/index), [Configuration](/gateway/configuration).
