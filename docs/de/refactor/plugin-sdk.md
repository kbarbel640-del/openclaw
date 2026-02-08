---
summary: "Plan: ein sauberes Plugin-SDK + Runtime für alle Messaging-Connectoren"
read_when:
  - Definieren oder Refaktorieren der Plugin-Architektur
  - Migrieren von Kanal-Connectoren auf das Plugin-SDK/die Runtime
title: "Plugin-SDK-Refaktor"
x-i18n:
  source_path: refactor/plugin-sdk.md
  source_hash: d1964e2e47a19ee1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:24Z
---

# Plugin-SDK + Runtime-Refaktor-Plan

Ziel: Jeder Messaging-Connector ist ein Plugin (gebündelt oder extern), das eine stabile API verwendet.
Kein Plugin importiert direkt aus `src/**`. Alle Abhängigkeiten laufen über das SDK oder die Runtime.

## Warum jetzt

- Aktuelle Connectoren mischen Muster: direkte Core-Imports, reine Dist-Bridges und benutzerdefinierte Helper.
- Das macht Upgrades fragil und verhindert eine saubere externe Plugin-Oberfläche.

## Zielarchitektur (zwei Ebenen)

### 1) Plugin-SDK (Compile-Time, stabil, veröffentlichbar)

Umfang: Typen, Helper und Konfigurations-Utilities. Kein Runtime-State, keine Side Effects.

Inhalte (Beispiele):

- Typen: `ChannelPlugin`, Adapter, `ChannelMeta`, `ChannelCapabilities`, `ChannelDirectoryEntry`.
- Konfigurations-Helper: `buildChannelConfigSchema`, `setAccountEnabledInConfigSection`, `deleteAccountFromConfigSection`,
  `applyAccountNameToChannelSection`.
- Pairing-Helper: `PAIRING_APPROVED_MESSAGE`, `formatPairingApproveHint`.
- Onboarding-Helper: `promptChannelAccessConfig`, `addWildcardAllowFrom`, Onboarding-Typen.
- Tool-Parameter-Helper: `createActionGate`, `readStringParam`, `readNumberParam`, `readReactionParams`, `jsonResult`.
- Docs-Link-Helper: `formatDocsLink`.

Bereitstellung:

- Veröffentlichung als `openclaw/plugin-sdk` (oder Export aus dem Core unter `openclaw/plugin-sdk`).
- Semver mit expliziten Stabilitätsgarantien.

### 2) Plugin-Runtime (Ausführungsoberfläche, injiziert)

Umfang: Alles, was das Core-Runtime-Verhalten berührt.
Zugriff über `OpenClawPluginApi.runtime`, sodass Plugins niemals `src/**` importieren.

Vorgeschlagene Oberfläche (minimal, aber vollständig):

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

Hinweise:

- Die Runtime ist der einzige Weg, auf Core-Verhalten zuzugreifen.
- Das SDK ist bewusst klein und stabil.
- Jede Runtime-Methode bildet eine bestehende Core-Implementierung ab (keine Duplikation).

## Migrationsplan (phasenweise, sicher)

### Phase 0: Gerüst

- Einführung von `openclaw/plugin-sdk`.
- Hinzufügen von `api.runtime` zu `OpenClawPluginApi` mit der obigen Oberfläche.
- Beibehaltung bestehender Imports während eines Übergangsfensters (Deprecation-Warnungen).

### Phase 1: Bridge-Bereinigung (geringes Risiko)

- Ersetzen von `core-bridge.ts` pro Erweiterung durch `api.runtime`.
- Zuerst BlueBubbles, Zalo, Zalo Personal migrieren (bereits nah dran).
- Entfernen duplizierten Bridge-Codes.

### Phase 2: Plugins mit leichten Direkt-Imports

- Matrix auf SDK + Runtime migrieren.
- Onboarding-, Verzeichnis- und Gruppen-Erwähnungslogik validieren.

### Phase 3: Plugins mit umfangreichen Direkt-Imports

- MS Teams migrieren (größter Satz an Runtime-Helpern).
- Sicherstellen, dass Antwort-/Tippen-Semantik dem aktuellen Verhalten entspricht.

### Phase 4: iMessage-Pluginisierung

- iMessage nach `extensions/imessage` verschieben.
- Direkte Core-Aufrufe durch `api.runtime` ersetzen.
- Konfigurationsschlüssel, CLI-Verhalten und Dokumentation unverändert beibehalten.

### Phase 5: Durchsetzung

- Lint-Regel / CI-Check hinzufügen: keine `extensions/**`-Imports aus `src/**`.
- Kompatibilitätsprüfungen für Plugin-SDK/Version hinzufügen (Runtime + SDK-Semver).

## Kompatibilität und Versionierung

- SDK: Semver, veröffentlicht, dokumentierte Änderungen.
- Runtime: Versioniert pro Core-Release. `api.runtime.version` hinzufügen.
- Plugins deklarieren einen erforderlichen Runtime-Bereich (z. B. `openclawRuntime: ">=2026.2.0"`).

## Teststrategie

- Unit-Tests auf Adapter-Ebene (Runtime-Funktionen mit realer Core-Implementierung ausgeführt).
- Golden-Tests pro Plugin: Sicherstellen, dass es keine Verhaltensabweichungen gibt (Routing, Pairing, Allowlist, Mention-Gating).
- Ein einzelnes End-to-End-Plugin-Beispiel in der CI (Installieren + Ausführen + Smoke-Test).

## Offene Fragen

- Wo sollen SDK-Typen gehostet werden: separates Paket oder Core-Export?
- Verteilung der Runtime-Typen: im SDK (nur Typen) oder im Core?
- Wie werden Docs-Links für gebündelte vs. externe Plugins bereitgestellt?
- Erlauben wir während der Übergangsphase begrenzte direkte Core-Imports für In-Repo-Plugins?

## Erfolgskriterien

- Alle Kanal-Connectoren sind Plugins, die SDK + Runtime verwenden.
- Keine `extensions/**`-Imports aus `src/**`.
- Neue Connector-Templates hängen nur von SDK + Runtime ab.
- Externe Plugins können ohne Zugriff auf den Core-Quellcode entwickelt und aktualisiert werden.

Zugehörige Dokumente: [Plugins](/plugin), [Channels](/channels/index), [Configuration](/gateway/configuration).
