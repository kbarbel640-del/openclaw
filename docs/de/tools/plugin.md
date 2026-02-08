---
summary: "OpenClaw-Plugins/Erweiterungen: Erkennung, Konfiguration und Sicherheit"
read_when:
  - Hinzufuegen oder Aendern von Plugins/Erweiterungen
  - Dokumentation von Plugin-Installations- oder Lade-Regeln
title: "Plugins"
x-i18n:
  source_path: tools/plugin.md
  source_hash: b36ca6b90ca03eaa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:16:30Z
---

# Plugins (Erweiterungen)

## Schnellstart (neu bei Plugins?)

Ein Plugin ist einfach ein **kleines Code-Modul**, das OpenClaw um zusaetzliche
Funktionen erweitert (Befehle, Werkzeuge und Gateway-RPC).

Meistens verwenden Sie Plugins, wenn Sie eine Funktion benoetigen, die noch
nicht im Kern von OpenClaw enthalten ist (oder wenn Sie optionale Funktionen aus
Ihrer Hauptinstallation heraushalten moechten).

Schneller Einstieg:

1. Sehen Sie nach, was bereits geladen ist:

```bash
openclaw plugins list
```

2. Installieren Sie ein offizielles Plugin (Beispiel: Voice Call):

```bash
openclaw plugins install @openclaw/voice-call
```

3. Starten Sie das Gateway neu und konfigurieren Sie es anschliessend unter `plugins.entries.<id>.config`.

Siehe [Voice Call](/plugins/voice-call) fuer ein konkretes Beispiel-Plugin.

## Verfuegbare Plugins (offiziell)

- Microsoft Teams ist seit 2026.1.15 nur noch als Plugin verfuegbar; installieren Sie `@openclaw/msteams`, wenn Sie Teams verwenden.
- Memory (Core) — gebuendeltes Memory-Such-Plugin (standardmaessig aktiviert ueber `plugins.slots.memory`)
- Memory (LanceDB) — gebuendeltes Langzeit-Memory-Plugin (Auto-Recall/-Capture; setzen Sie `plugins.slots.memory = "memory-lancedb"`)
- [Voice Call](/plugins/voice-call) — `@openclaw/voice-call`
- [Zalo Personal](/plugins/zalouser) — `@openclaw/zalouser`
- [Matrix](/channels/matrix) — `@openclaw/matrix`
- [Nostr](/channels/nostr) — `@openclaw/nostr`
- [Zalo](/channels/zalo) — `@openclaw/zalo`
- [Microsoft Teams](/channels/msteams) — `@openclaw/msteams`
- Google Antigravity OAuth (Anbieter-Auth) — gebuendelt als `google-antigravity-auth` (standardmaessig deaktiviert)
- Gemini CLI OAuth (Anbieter-Auth) — gebuendelt als `google-gemini-cli-auth` (standardmaessig deaktiviert)
- Qwen OAuth (Anbieter-Auth) — gebuendelt als `qwen-portal-auth` (standardmaessig deaktiviert)
- Copilot Proxy (Anbieter-Auth) — lokale VS Code Copilot Proxy-Bridge; getrennt vom integrierten `github-copilot`-Device-Login (gebuendelt, standardmaessig deaktiviert)

OpenClaw-Plugins sind **TypeScript-Module**, die zur Laufzeit ueber jiti geladen
werden. **Die Konfigurationsvalidierung fuehrt keinen Plugin-Code aus**; sie
verwendet stattdessen das Plugin-Manifest und JSON Schema. Siehe
[Plugin manifest](/plugins/manifest).

Plugins koennen registrieren:

- Gateway-RPC-Methoden
- Gateway-HTTP-Handler
- Agent-Werkzeuge
- CLI-Befehle
- Hintergrunddienste
- Optionale Konfigurationsvalidierung
- **Skills** (durch Auflisten von `skills`-Verzeichnissen im Plugin-Manifest)
- **Auto-Reply-Befehle** (Ausfuehrung ohne Aufruf des AI-Agents)

Plugins laufen **im selben Prozess** wie das Gateway; behandeln Sie sie daher als
vertrauenswuerdigen Code.
Leitfaden zur Tool-Erstellung: [Plugin agent tools](/plugins/agent-tools).

## Laufzeit-Helfer

Plugins koennen ueber `api.runtime` auf ausgewaehlte Core-Helfer zugreifen.
Fuer Telephonie-TTS:

```ts
const result = await api.runtime.tts.textToSpeechTelephony({
  text: "Hello from OpenClaw",
  cfg: api.config,
});
```

Hinweise:

- Verwendet die Core-`messages.tts`-Konfiguration (OpenAI oder ElevenLabs).
- Gibt PCM-Audiopuffer + Sample-Rate zurueck. Plugins muessen fuer Anbieter
  selbst resamplen/encodieren.
- Edge TTS wird fuer Telephonie nicht unterstuetzt.

## Erkennung & Prioritaet

OpenClaw durchsucht in folgender Reihenfolge:

1. Konfigurationspfade

- `plugins.load.paths` (Datei oder Verzeichnis)

2. Workspace-Erweiterungen

- `<workspace>/.openclaw/extensions/*.ts`
- `<workspace>/.openclaw/extensions/*/index.ts`

3. Globale Erweiterungen

- `~/.openclaw/extensions/*.ts`
- `~/.openclaw/extensions/*/index.ts`

4. Gebuendelte Erweiterungen (mit OpenClaw ausgeliefert, **standardmaessig deaktiviert**)

- `<openclaw>/extensions/*`

Gebuendelte Plugins muessen explizit ueber `plugins.entries.<id>.enabled`
oder `openclaw plugins enable <id>` aktiviert werden. Installierte Plugins sind
standardmaessig aktiviert, koennen aber auf die gleiche Weise deaktiviert werden.

Jedes Plugin muss eine `openclaw.plugin.json`-Datei in seinem Root enthalten. Wenn ein
Pfad auf eine Datei zeigt, ist das Plugin-Root das Verzeichnis der Datei und
muss das Manifest enthalten.

Wenn mehrere Plugins zur selben ID aufgeloest werden, gewinnt der erste Treffer
in der obigen Reihenfolge, und Kopien mit niedrigerer Prioritaet werden ignoriert.

### Package Packs

Ein Plugin-Verzeichnis kann eine `package.json` mit `openclaw.extensions` enthalten:

```json
{
  "name": "my-pack",
  "openclaw": {
    "extensions": ["./src/safety.ts", "./src/tools.ts"]
  }
}
```

Jeder Eintrag wird zu einem Plugin. Wenn das Pack mehrere Erweiterungen auflistet,
wird die Plugin-ID zu `name/<fileBase>`.

Wenn Ihr Plugin npm-Abhaengigkeiten importiert, installieren Sie diese in diesem
Verzeichnis, sodass `node_modules` verfuegbar ist
(`npm install` / `pnpm install`).

### Channel-Katalog-Metadaten

Channel-Plugins koennen Onboarding-Metadaten ueber `openclaw.channel` und
Installationshinweise ueber `openclaw.install` bekannt geben. Dadurch bleibt der
Kernkatalog datenfrei.

Beispiel:

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

OpenClaw kann ausserdem **externe Channel-Kataloge** zusammenfuehren (zum
Beispiel einen MPM-Registry-Export). Legen Sie eine JSON-Datei an einem der
folgenden Orte ab:

- `~/.openclaw/mpm/plugins.json`
- `~/.openclaw/mpm/catalog.json`
- `~/.openclaw/plugins/catalog.json`

Oder verweisen Sie `OPENCLAW_PLUGIN_CATALOG_PATHS` (oder `OPENCLAW_MPM_CATALOG_PATHS`) auf
eine oder mehrere JSON-Dateien (durch Komma/Semikolon/`PATH` getrennt).
Jede Datei sollte `{ "entries": [ { "name": "@scope/pkg", "openclaw": { "channel": {...}, "install": {...} } } ] }` enthalten.

## Plugin-IDs

Standard-Plugin-IDs:

- Package Packs: `package.json` `name`
- Einzeldatei: Dateibasisname (`~/.../voice-call.ts` → `voice-call`)

Wenn ein Plugin `id` exportiert, verwendet OpenClaw diesen Wert, warnt
jedoch, wenn er nicht mit der konfigurierten ID uebereinstimmt.

## Konfiguration

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

Felder:

- `enabled`: Hauptschalter (Standard: true)
- `allow`: Allowlist (optional)
- `deny`: Denylist (optional; Deny hat Vorrang)
- `load.paths`: zusaetzliche Plugin-Dateien/-Verzeichnisse
- `entries.<id>`: Plugin-spezifische Schalter + Konfiguration

Konfigurationsaenderungen **erfordern einen Neustart des Gateways**.

Validierungsregeln (streng):

- Unbekannte Plugin-IDs in `entries`, `allow`, `deny` oder `slots` sind **Fehler**.
- Unbekannte `channels.<id>`-Keys sind **Fehler**, es sei denn, ein Plugin-Manifest
  deklariert die Channel-ID.
- Die Plugin-Konfiguration wird anhand des im `openclaw.plugin.json` eingebetteten
  JSON Schemas validiert (`configSchema`).
- Wenn ein Plugin deaktiviert ist, bleibt seine Konfiguration erhalten und es
  wird eine **Warnung** ausgegeben.

## Plugin-Slots (exklusive Kategorien)

Einige Plugin-Kategorien sind **exklusiv** (nur eines kann gleichzeitig aktiv
sein). Verwenden Sie `plugins.slots`, um auszuwählen, welches Plugin den Slot
besitzt:

```json5
{
  plugins: {
    slots: {
      memory: "memory-core", // or "none" to disable memory plugins
    },
  },
}
```

Wenn mehrere Plugins `kind: "memory"` deklarieren, wird nur das ausgewaehlte
geladen. Die anderen werden mit Diagnosehinweisen deaktiviert.

## Control UI (Schema + Labels)

Das Control UI verwendet `config.schema` (JSON Schema + `uiHints`), um
bessere Formulare zu rendern.

OpenClaw erweitert `uiHints` zur Laufzeit basierend auf erkannten Plugins:

- Fuegt Plugin-spezifische Labels fuer `plugins.entries.<id>` / `.enabled` / `.config` hinzu
- Fuehrt optionale, von Plugins bereitgestellte Hinweise zu Konfigurationsfeldern
  zusammen unter:
  `plugins.entries.<id>.config.<field>`

Wenn Sie moechten, dass die Konfigurationsfelder Ihres Plugins gute Labels/
Platzhalter anzeigen (und Geheimnisse als sensibel markieren), stellen Sie
`uiHints` zusammen mit Ihrem JSON Schema im Plugin-Manifest bereit.

Beispiel:

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

`plugins update` funktioniert nur fuer npm-Installationen, die unter
`plugins.installs` verfolgt werden.

Plugins koennen auch eigene Top-Level-Befehle registrieren (Beispiel:
`openclaw voicecall`).

## Plugin-API (Ueberblick)

Plugins exportieren entweder:

- Eine Funktion: `(api) => { ... }`
- Ein Objekt: `{ id, name, configSchema, register(api) { ... } }`

## Plugin-Hooks

Plugins koennen Hooks mitliefern und diese zur Laufzeit registrieren. Dadurch
kann ein Plugin ereignisgesteuerte Automatisierung ohne separate Hook-Pack-
Installation buendeln.

### Beispiel

```
import { registerPluginHooksFromDir } from "openclaw/plugin-sdk";

export default function register(api) {
  registerPluginHooksFromDir(api, "./hooks");
}
```

Hinweise:

- Hook-Verzeichnisse folgen der normalen Hook-Struktur (`HOOK.md` + `handler.ts`).
- Die Hook-Zulaessigkeitsregeln gelten weiterhin (OS/Binaries/Env/Config-Anforderungen).
- Von Plugins verwaltete Hooks erscheinen in `openclaw hooks list` mit `plugin:<id>`.
- Sie koennen von Plugins verwaltete Hooks nicht ueber `openclaw hooks`
  aktivieren/deaktivieren; aktivieren/deaktivieren Sie stattdessen das Plugin.

## Anbieter-Plugins (Modell-Auth)

Plugins koennen **Modellanbieter-Auth**-Flows registrieren, damit Benutzer OAuth
oder API-Key-Setups direkt in OpenClaw durchfuehren koennen (keine externen
Skripte erforderlich).

Registrieren Sie einen Anbieter ueber `api.registerProvider(...)`. Jeder Anbieter stellt eine
oder mehrere Auth-Methoden bereit (OAuth, API-Key, Device Code usw.). Diese
Methoden speisen:

- `openclaw models auth login --provider <id> [--method <id>]`

Beispiel:

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

Hinweise:

- `run` erhaelt ein `ProviderAuthContext` mit `prompter`, `runtime`,
  `openUrl` und `oauth.createVpsAwareHandlers`-Helfern.
- Geben Sie `configPatch` zurueck, wenn Sie Standardmodelle oder
  Anbieter-Konfiguration hinzufuegen muessen.
- Geben Sie `defaultModel` zurueck, damit `--set-default` die Agent-Defaults
  aktualisieren kann.

### Einen Messaging-Channel registrieren

Plugins koennen **Channel-Plugins** registrieren, die sich wie integrierte
Channels verhalten (WhatsApp, Telegram usw.). Die Channel-Konfiguration liegt
unter `channels.<id>` und wird durch den Code Ihres Channel-Plugins validiert.

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

Hinweise:

- Legen Sie die Konfiguration unter `channels.<id>` ab (nicht unter `plugins.entries`).
- `meta.label` wird fuer Labels in CLI/UI-Listen verwendet.
- `meta.aliases` fuegt alternative IDs fuer Normalisierung und CLI-Eingaben hinzu.
- `meta.preferOver` listet Channel-IDs auf, die bei gleichzeitiger Konfiguration
  nicht automatisch aktiviert werden sollen.
- `meta.detailLabel` und `meta.systemImage` ermoeglichen UIs reichhaltigere Channel-
  Labels/Icons.

### Einen neuen Messaging-Channel schreiben (Schritt-fuer-Schritt)

Verwenden Sie dies, wenn Sie eine **neue Chat-Oberflaeche** (einen
„Messaging-Channel“) erstellen moechten, nicht einen Modellanbieter.
Dokumentation zu Modellanbietern finden Sie unter `/providers/*`.

1. ID + Konfigurationsform waehlen

- Die gesamte Channel-Konfiguration liegt unter `channels.<id>`.
- Bevorzugen Sie `channels.<id>.accounts.<accountId>` fuer Multi-Account-Setups.

2. Channel-Metadaten definieren

- `meta.label`, `meta.selectionLabel`, `meta.docsPath`, `meta.blurb` steuern
  CLI/UI-Listen.
- `meta.docsPath` sollte auf eine Doku-Seite wie `/channels/<id>` verweisen.
- `meta.preferOver` erlaubt es einem Plugin, einen anderen Channel zu ersetzen
  (Auto-Aktivierung bevorzugt ihn).
- `meta.detailLabel` und `meta.systemImage` werden von UIs fuer Detailtexte/Icons
  verwendet.

3. Erforderliche Adapter implementieren

- `config.listAccountIds` + `config.resolveAccount`
- `capabilities` (Chat-Typen, Medien, Threads usw.)
- `outbound.deliveryMode` + `outbound.sendText` (fuer einfaches Senden)

4. Optionale Adapter nach Bedarf hinzufuegen

- `setup` (Assistent), `security` (DM-Richtlinie),
  `status` (Health/Diagnostik)
- `gateway` (Start/Stop/Login), `mentions`, `threading`,
  `streaming`
- `actions` (Nachrichtenaktionen), `commands` (natives
  Befehlsverhalten)

5. Channel im Plugin registrieren

- `api.registerChannel({ plugin })`

Minimales Konfigurationsbeispiel:

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

Minimaler Channel-Plugin (nur ausgehend):

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

Laden Sie das Plugin (Extensions-Verzeichnis oder `plugins.load.paths`), starten Sie
das Gateway neu und konfigurieren Sie anschliessend `channels.<id>` in Ihrer
Konfiguration.

### Agent-Werkzeuge

Siehe den separaten Leitfaden: [Plugin agent tools](/plugins/agent-tools).

### Eine Gateway-RPC-Methode registrieren

```ts
export default function (api) {
  api.registerGatewayMethod("myplugin.status", ({ respond }) => {
    respond(true, { ok: true });
  });
}
```

### CLI-Befehle registrieren

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

### Auto-Reply-Befehle registrieren

Plugins koennen benutzerdefinierte Slash-Befehle registrieren, die **ohne Aufruf
des AI-Agents** ausgefuehrt werden. Dies ist nuetzlich fuer Umschaltbefehle,
Statusabfragen oder schnelle Aktionen, die keine LLM-Verarbeitung benoetigen.

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

Kontext des Befehls-Handlers:

- `senderId`: Die ID des Absenders (falls verfuegbar)
- `channel`: Der Channel, in dem der Befehl gesendet wurde
- `isAuthorizedSender`: Ob der Absender autorisiert ist
- `args`: Argumente nach dem Befehl (falls `acceptsArgs: true`)
- `commandBody`: Der vollstaendige Befehlstext
- `config`: Die aktuelle OpenClaw-Konfiguration

Befehlsoptionen:

- `name`: Befehlsname (ohne fuehrendes `/`)
- `description`: Hilfetext, der in Befehlslisten angezeigt wird
- `acceptsArgs`: Ob der Befehl Argumente akzeptiert (Standard: false). Wenn
  false und Argumente bereitgestellt werden, passt der Befehl nicht und die
  Nachricht faellt an andere Handler durch
- `requireAuth`: Ob ein autorisierter Absender erforderlich ist (Standard: true)
- `handler`: Funktion, die `{ text: string }` zurueckgibt (kann async sein)

Beispiel mit Autorisierung und Argumenten:

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

Hinweise:

- Plugin-Befehle werden **vor** integrierten Befehlen und dem AI-Agent verarbeitet
- Befehle werden global registriert und funktionieren ueber alle Channels hinweg
- Befehlsnamen sind nicht case-sensitiv (`/MyStatus` entspricht `/mystatus`)
- Befehlsnamen muessen mit einem Buchstaben beginnen und duerfen nur Buchstaben,
  Zahlen, Bindestriche und Unterstriche enthalten
- Reservierte Befehlsnamen (wie `help`, `status`, `reset`
  usw.) koennen nicht von Plugins ueberschrieben werden
- Doppelte Befehlsregistrierungen ueber mehrere Plugins hinweg schlagen mit einem
  Diagnosefehler fehl

### Hintergrunddienste registrieren

```ts
export default function (api) {
  api.registerService({
    id: "my-service",
    start: () => api.logger.info("ready"),
    stop: () => api.logger.info("bye"),
  });
}
```

## Benennungskonventionen

- Gateway-Methoden: `pluginId.action` (Beispiel: `voicecall.status`)
- Werkzeuge: `snake_case` (Beispiel: `voice_call`)
- CLI-Befehle: Kebab- oder Camel-Case, aber vermeiden Sie Kollisionen mit
  Core-Befehlen

## Skills

Plugins koennen eine Skill im Repository mitliefern (`skills/<name>/SKILL.md`).
Aktivieren Sie sie mit `plugins.entries.<id>.enabled` (oder anderen Konfigurations-Gates) und
stellen Sie sicher, dass sie in Ihren Workspace-/verwalteten Skills-Standorten
vorhanden ist.

## Distribution (npm)

Empfohlene Paketierung:

- Hauptpaket: `openclaw` (dieses Repository)
- Plugins: separate npm-Pakete unter `@openclaw/*` (Beispiel: `@openclaw/voice-call`)

Publishing-Vertrag:

- Plugin-`package.json` muss `openclaw.extensions` mit einer oder mehreren Entry-Dateien
  enthalten.
- Entry-Dateien koennen `.js` oder `.ts` sein (jiti laedt TS
  zur Laufzeit).
- `openclaw plugins install <npm-spec>` verwendet `npm pack`, extrahiert nach `~/.openclaw/extensions/<id>/` und
  aktiviert es in der Konfiguration.
- Stabilitaet von Konfigurationsschluesseln: Scoped Packages werden fuer
  `plugins.entries.*` auf die **unscoped** ID normalisiert.

## Beispiel-Plugin: Voice Call

Dieses Repository enthaelt ein Voice-Call-Plugin (Twilio oder Log-Fallback):

- Source: `extensions/voice-call`
- Skill: `skills/voice-call`
- CLI: `openclaw voicecall start|status`
- Tool: `voice_call`
- RPC: `voicecall.start`, `voicecall.status`
- Konfiguration (twilio): `provider: "twilio"` + `twilio.accountSid/authToken/from` (optional
  `statusCallbackUrl`, `twimlUrl`)
- Konfiguration (dev): `provider: "log"` (kein Netzwerk)

Siehe [Voice Call](/plugins/voice-call) und `extensions/voice-call/README.md` fuer Einrichtung und
Nutzung.

## Sicherheitshinweise

Plugins laufen im selben Prozess wie das Gateway. Behandeln Sie sie als
vertrauenswuerdigen Code:

- Installieren Sie nur Plugins, denen Sie vertrauen.
- Bevorzugen Sie `plugins.allow`-Allowlists.
- Starten Sie das Gateway nach Aenderungen neu.

## Plugins testen

Plugins koennen (und sollten) Tests mitliefern:

- In-Repo-Plugins koennen Vitest-Tests unter `src/**` ablegen (Beispiel:
  `src/plugins/voice-call.plugin.test.ts`).
- Separat veroeffentlichte Plugins sollten ihre eigene CI ausfuehren
  (Lint/Build/Test) und validieren, dass `openclaw.extensions` auf den gebauten
  Entry-Point (`dist/index.js`) zeigt.
