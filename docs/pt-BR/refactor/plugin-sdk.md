---
summary: "Plano: um SDK de plugin limpo + runtime para todos os conectores de mensagens"
read_when:
  - Definindo ou refatorando a arquitetura de plugins
  - Migrando conectores de canal para o SDK/runtime de plugins
title: "Refatoracao do SDK de Plugin"
x-i18n:
  source_path: refactor/plugin-sdk.md
  source_hash: d1964e2e47a19ee1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:16Z
---

# Plano de Refatoracao do SDK + Runtime de Plugin

Objetivo: todo conector de mensagens e um plugin (embutido ou externo) usando uma API estavel.
Nenhum plugin importa `src/**` diretamente. Todas as dependencias passam pelo SDK ou runtime.

## Por que agora

- Os conectores atuais misturam padroes: imports diretos do core, bridges apenas de dist e helpers customizados.
- Isso torna as atualizacoes fragis e bloqueia uma superficie limpa para plugins externos.

## Arquitetura alvo (duas camadas)

### 1) SDK de Plugin (tempo de compilacao, estavel, publicavel)

Escopo: tipos, helpers e utilitarios de configuracao. Sem estado de runtime, sem efeitos colaterais.

Conteudo (exemplos):

- Tipos: `ChannelPlugin`, adapters, `ChannelMeta`, `ChannelCapabilities`, `ChannelDirectoryEntry`.
- Helpers de configuracao: `buildChannelConfigSchema`, `setAccountEnabledInConfigSection`, `deleteAccountFromConfigSection`,
  `applyAccountNameToChannelSection`.
- Helpers de pareamento: `PAIRING_APPROVED_MESSAGE`, `formatPairingApproveHint`.
- Helpers de integracao inicial: `promptChannelAccessConfig`, `addWildcardAllowFrom`, tipos de onboarding.
- Helpers de parametros de ferramentas: `createActionGate`, `readStringParam`, `readNumberParam`, `readReactionParams`, `jsonResult`.
- Helper de link de docs: `formatDocsLink`.

Entrega:

- Publicar como `openclaw/plugin-sdk` (ou exportar do core sob `openclaw/plugin-sdk`).
- Semver com garantias explicitas de estabilidade.

### 2) Runtime de Plugin (superficie de execucao, injetado)

Escopo: tudo que toca o comportamento de runtime do core.
Acessado via `OpenClawPluginApi.runtime` para que plugins nunca importem `src/**`.

Superficie proposta (minima, mas completa):

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

Observacoes:

- O runtime e a unica forma de acessar o comportamento do core.
- O SDK e intencionalmente pequeno e estavel.
- Cada metodo do runtime mapeia para uma implementacao existente do core (sem duplicacao).

## Plano de migracao (em fases, seguro)

### Fase 0: scaffolding

- Introduzir `openclaw/plugin-sdk`.
- Adicionar `api.runtime` a `OpenClawPluginApi` com a superficie acima.
- Manter imports existentes durante uma janela de transicao (avisos de descontinuacao).

### Fase 1: limpeza de bridges (baixo risco)

- Substituir `core-bridge.ts` por extensao por `api.runtime`.
- Migrar BlueBubbles, Zalo, Zalo Personal primeiro (ja estao proximos).
- Remover codigo de bridge duplicado.

### Fase 2: plugins com imports diretos leves

- Migrar Matrix para SDK + runtime.
- Validar integracao inicial, diretorio e logica de mencao em grupo.

### Fase 3: plugins com muitos imports diretos

- Migrar MS Teams (maior conjunto de helpers de runtime).
- Garantir que a semantica de resposta/digitacao corresponda ao comportamento atual.

### Fase 4: pluginizacao do iMessage

- Mover iMessage para `extensions/imessage`.
- Substituir chamadas diretas ao core por `api.runtime`.
- Manter chaves de configuracao, comportamento de CLI e docs intactos.

### Fase 5: enforcement

- Adicionar regra de lint / checagem de CI: sem imports de `extensions/**` a partir de `src/**`.
- Adicionar checagens de compatibilidade de versao do SDK de plugin (runtime + semver do SDK).

## Compatibilidade e versionamento

- SDK: semver, publicado, mudancas documentadas.
- Runtime: versionado por release do core. Adicionar `api.runtime.version`.
- Plugins declaram um intervalo de runtime requerido (por exemplo, `openclawRuntime: ">=2026.2.0"`).

## Estrategia de testes

- Testes unitarios em nivel de adapter (funcoes do runtime exercitadas com implementacao real do core).
- Testes golden por plugin: garantir ausencia de drift de comportamento (roteamento, pareamento, allowlist, gating de mencoes).
- Um unico plugin de exemplo end-to-end usado no CI (instalar + executar + smoke).

## Questoes em aberto

- Onde hospedar os tipos do SDK: pacote separado ou export do core?
- Distribuicao de tipos do runtime: no SDK (apenas tipos) ou no core?
- Como expor links de docs para plugins embutidos vs externos?
- Permitimos imports diretos limitados do core para plugins in-repo durante a transicao?

## Criterios de sucesso

- Todos os conectores de canal sao plugins usando SDK + runtime.
- Nenhum import de `extensions/**` a partir de `src/**`.
- Novos templates de conectores dependem apenas de SDK + runtime.
- Plugins externos podem ser desenvolvidos e atualizados sem acesso ao codigo-fonte do core.

Docs relacionadas: [Plugins](/plugin), [Channels](/channels/index), [Configuration](/gateway/configuration).
