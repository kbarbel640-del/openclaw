---
summary: "Alle Konfigurationsoptionen für ~/.openclaw/openclaw.json mit Beispielen"
read_when:
  - Hinzufügen oder Ändern von Konfigurationsfeldern
title: "Konfiguration"
x-i18n:
  source_path: gateway/configuration.md
  source_hash: 53b6b8a615c4ce02
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:58Z
---

# Konfiguration 🔧

OpenClaw liest eine optionale **JSON5**-Konfiguration aus `~/.openclaw/openclaw.json` (Kommentare + nachgestellte Kommata erlaubt).

Wenn die Datei fehlt, verwendet OpenClaw sichere Standardwerte (eingebetteter Pi-Agent + Sitzungen pro Absender + Workspace `~/.openclaw/workspace`). In der Regel benötigen Sie eine Konfiguration nur, um:

- einzuschränken, wer den Bot auslösen darf (`channels.whatsapp.allowFrom`, `channels.telegram.allowFrom` usw.)
- Gruppen-Allowlisten und Mention-Verhalten zu steuern (`channels.whatsapp.groups`, `channels.telegram.groups`, `channels.discord.guilds`, `agents.list[].groupChat`)
- Nachrichtenpräfixe anzupassen (`messages`)
- den Workspace des Agenten festzulegen (`agents.defaults.workspace` oder `agents.list[].workspace`)
- die Standardwerte des eingebetteten Agenten (`agents.defaults`) und das Sitzungsverhalten (`session`) feinzujustieren
- eine agentenspezifische Identität festzulegen (`agents.list[].identity`)

> **Neu bei der Konfiguration?** Sehen Sie sich den Leitfaden [Configuration Examples](/gateway/configuration-examples) mit vollständigen Beispielen und detaillierten Erklärungen an!

## Strikte Konfigurationsvalidierung

OpenClaw akzeptiert nur Konfigurationen, die vollständig dem Schema entsprechen.
Unbekannte Schlüssel, fehlerhafte Typen oder ungültige Werte führen aus Sicherheitsgründen dazu, dass das Gateway **den Start verweigert**.

Wenn die Validierung fehlschlägt:

- Das Gateway startet nicht.
- Es sind nur Diagnosebefehle erlaubt (z. B. `openclaw doctor`, `openclaw logs`, `openclaw health`, `openclaw status`, `openclaw service`, `openclaw help`).
- Führen Sie `openclaw doctor` aus, um die genauen Probleme zu sehen.
- Führen Sie `openclaw doctor --fix` (oder `--yes`) aus, um Migrationen/Reparaturen anzuwenden.

Doctor schreibt niemals Änderungen, es sei denn, Sie entscheiden sich ausdrücklich für `--fix`/`--yes`.

## Schema + UI-Hinweise

Das Gateway stellt eine JSON-Schema-Darstellung der Konfiguration über `config.schema` für UI-Editoren bereit.
Die Control UI rendert daraus ein Formular mit einem **Raw JSON**-Editor als Notausgang.

Kanal-Plugins und Erweiterungen können Schema- und UI-Hinweise für ihre Konfiguration registrieren, sodass Kanaleinstellungen appübergreifend schema-getrieben bleiben, ohne fest codierte Formulare.

Hinweise (Labels, Gruppierung, sensible Felder) werden zusammen mit dem Schema ausgeliefert, damit Clients bessere Formulare rendern können, ohne Konfigurationswissen fest zu verdrahten.

## Anwenden + Neustart (RPC)

Verwenden Sie `config.apply`, um die vollständige Konfiguration in einem Schritt zu validieren, zu schreiben und das Gateway neu zu starten.
Dabei wird ein Neustart-Sentinel geschrieben und nach dem Wiederhochfahren des Gateways die zuletzt aktive Sitzung angepingt.

Warnung: `config.apply` ersetzt die **gesamte Konfiguration**. Wenn Sie nur wenige Schlüssel ändern möchten,
verwenden Sie `config.patch` oder `openclaw config set`. Bewahren Sie eine Sicherung von `~/.openclaw/openclaw.json` auf.

Parameter:

- `raw` (string) — JSON5-Payload für die gesamte Konfiguration
- `baseHash` (optional) — Konfigurations-Hash aus `config.get` (erforderlich, wenn bereits eine Konfiguration existiert)
- `sessionKey` (optional) — Schlüssel der zuletzt aktiven Sitzung für den Wake-up-Ping
- `note` (optional) — Notiz für das Neustart-Sentinel
- `restartDelayMs` (optional) — Verzögerung vor dem Neustart (Standard 2000)

Beispiel (über `gateway call`):

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.apply --params '{
  "raw": "{\\n  agents: { defaults: { workspace: \\"~/.openclaw/workspace\\" } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## Teilaktualisierungen (RPC)

Verwenden Sie `config.patch`, um eine Teilaktualisierung in die bestehende Konfiguration zu mergen, ohne
unverwandte Schlüssel zu überschreiben. Es gelten die Semantiken von JSON Merge Patch:

- Objekte werden rekursiv zusammengeführt
- `null` löscht einen Schlüssel
- Arrays werden ersetzt  
  Wie bei `config.apply` wird die Konfiguration validiert, geschrieben, ein Neustart-Sentinel gespeichert
  und der Gateway-Neustart geplant (mit optionalem Wake-up, wenn `sessionKey` angegeben ist).

Parameter:

- `raw` (string) — JSON5-Payload mit nur den zu ändernden Schlüsseln
- `baseHash` (erforderlich) — Konfigurations-Hash aus `config.get`
- `sessionKey` (optional) — Schlüssel der zuletzt aktiven Sitzung für den Wake-up-Ping
- `note` (optional) — Notiz für das Neustart-Sentinel
- `restartDelayMs` (optional) — Verzögerung vor dem Neustart (Standard 2000)

Beispiel:

```bash
openclaw gateway call config.get --params '{}' # capture payload.hash
openclaw gateway call config.patch --params '{
  "raw": "{\\n  channels: { telegram: { groups: { \\"*\\": { requireMention: false } } } }\\n}\\n",
  "baseHash": "<hash-from-config.get>",
  "sessionKey": "agent:main:whatsapp:dm:+15555550123",
  "restartDelayMs": 1000
}'
```

## Minimale Konfiguration (empfohlener Einstieg)

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

Erstellen Sie das Standard-Image einmalig mit:

```bash
scripts/sandbox-setup.sh
```

## Self-Chat-Modus (empfohlen für Gruppenkontrolle)

Um zu verhindern, dass der Bot in Gruppen auf WhatsApp-@-Mentions reagiert (nur auf spezifische Text-Trigger reagieren):

```json5
{
  agents: {
    defaults: { workspace: "~/.openclaw/workspace" },
    list: [
      {
        id: "main",
        groupChat: { mentionPatterns: ["@openclaw", "reisponde"] },
      },
    ],
  },
  channels: {
    whatsapp: {
      // Allowlist is DMs only; including your own number enables self-chat mode.
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## Konfigurations-Includes (`$include`)

Teilen Sie Ihre Konfiguration mithilfe der Direktive `$include` in mehrere Dateien auf. Das ist nützlich für:

- Organisation großer Konfigurationen (z. B. agentenspezifische Definitionen pro Client)
- Gemeinsame Nutzung von Einstellungen über Umgebungen hinweg
- Getrennte Ablage sensibler Konfigurationen

### Grundlegende Verwendung

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789 },

  // Include a single file (replaces the key's value)
  agents: { $include: "./agents.json5" },

  // Include multiple files (deep-merged in order)
  broadcast: {
    $include: ["./clients/mueller.json5", "./clients/schmidt.json5"],
  },
}
```

```json5
// ~/.openclaw/agents.json5
{
  defaults: { sandbox: { mode: "all", scope: "session" } },
  list: [{ id: "main", workspace: "~/.openclaw/workspace" }],
}
```

### Merge-Verhalten

- **Einzeldatei**: Ersetzt das Objekt, das `$include` enthält
- **Array von Dateien**: Führt Dateien der Reihe nach tief zusammen (spätere Dateien überschreiben frühere)
- **Mit Geschwisterschlüsseln**: Geschwisterschlüssel werden nach den Includes gemerged (überschreiben inkludierte Werte)
- **Geschwisterschlüssel + Arrays/Primitive**: Nicht unterstützt (inkludierter Inhalt muss ein Objekt sein)

```json5
// Sibling keys override included values
{
  $include: "./base.json5", // { a: 1, b: 2 }
  b: 99, // Result: { a: 1, b: 99 }
}
```

### Verschachtelte Includes

Inkludierte Dateien können selbst `$include`-Direktiven enthalten (bis zu 10 Ebenen tief):

```json5
// clients/mueller.json5
{
  agents: { $include: "./mueller/agents.json5" },
  broadcast: { $include: "./mueller/broadcast.json5" },
}
```

### Pfadauflösung

- **Relative Pfade**: Relativ zur inkludierenden Datei aufgelöst
- **Absolute Pfade**: Unverändert verwendet
- **Übergeordnete Verzeichnisse**: `../`-Referenzen funktionieren wie erwartet

```json5
{ "$include": "./sub/config.json5" }      // relative
{ "$include": "/etc/openclaw/base.json5" } // absolute
{ "$include": "../shared/common.json5" }   // parent dir
```

### Fehlerbehandlung

- **Fehlende Datei**: Klarer Fehler mit aufgelöstem Pfad
- **Parse-Fehler**: Zeigt, welche inkludierte Datei fehlgeschlagen ist
- **Zirkuläre Includes**: Erkannt und mit Include-Kette gemeldet

### Beispiel: Multi-Client-Rechtskonfiguration

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789, auth: { token: "secret" } },

  // Common agent defaults
  agents: {
    defaults: {
      sandbox: { mode: "all", scope: "session" },
    },
    // Merge agent lists from all clients
    list: { $include: ["./clients/mueller/agents.json5", "./clients/schmidt/agents.json5"] },
  },

  // Merge broadcast configs
  broadcast: {
    $include: ["./clients/mueller/broadcast.json5", "./clients/schmidt/broadcast.json5"],
  },

  channels: { whatsapp: { groupPolicy: "allowlist" } },
}
```

```json5
// ~/.openclaw/clients/mueller/agents.json5
[
  { id: "mueller-transcribe", workspace: "~/clients/mueller/transcribe" },
  { id: "mueller-docs", workspace: "~/clients/mueller/docs" },
]
```

```json5
// ~/.openclaw/clients/mueller/broadcast.json5
{
  "120363403215116621@g.us": ["mueller-transcribe", "mueller-docs"],
}
```

## Häufige Optionen

### Umgebungsvariablen + `.env`

OpenClaw liest Umgebungsvariablen aus dem Elternprozess (Shell, launchd/systemd, CI usw.).

Zusätzlich lädt es:

- `.env` aus dem aktuellen Arbeitsverzeichnis (falls vorhanden)
- einen globalen Fallback `.env` aus `~/.openclaw/.env` (alias `$OPENCLAW_STATE_DIR/.env`)

Keine der `.env`-Dateien überschreibt bestehende Umgebungsvariablen.

Sie können außerdem Inline-Umgebungsvariablen in der Konfiguration angeben. Diese werden nur angewendet, wenn
die Prozess-Umgebung den Schlüssel nicht enthält (gleiche Nicht-Überschreibungsregel):

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

Siehe [/environment](/environment) für vollständige Prioritäten und Quellen.

### `env.shellEnv` (optional)

Komfort-Opt-in: Wenn aktiviert und noch keine der erwarteten Schlüssel gesetzt sind, führt OpenClaw Ihre Login-Shell aus
und importiert nur die fehlenden erwarteten Schlüssel (überschreibt nie).
Dies sourced effektiv Ihr Shell-Profil.

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

Äquivalent als Umgebungsvariable:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

### Umgebungsvariablen-Substitution in der Konfiguration

Sie können Umgebungsvariablen direkt in jedem String-Wert der Konfiguration referenzieren, indem Sie die
Syntax `${VAR_NAME}` verwenden. Variablen werden beim Laden der Konfiguration vor der Validierung substituiert.

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
  gateway: {
    auth: {
      token: "${OPENCLAW_GATEWAY_TOKEN}",
    },
  },
}
```

**Regeln:**

- Es werden nur Großbuchstaben-Namen gematcht: `[A-Z_][A-Z0-9_]*`
- Fehlende oder leere Umgebungsvariablen führen beim Laden der Konfiguration zu einem Fehler
- Mit `$${VAR}` escapen, um ein literales `${VAR}` auszugeben
- Funktioniert mit `$include` (inkludierte Dateien erhalten ebenfalls Substitution)

**Inline-Substitution:**

```json5
{
  models: {
    providers: {
      custom: {
        baseUrl: "${CUSTOM_API_BASE}/v1", // → "https://api.example.com/v1"
      },
    },
  },
}
```

---

_Nächster Abschnitt: [Agent Runtime](/concepts/agent)_ 🦞
