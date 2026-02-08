---
summary: "Agent-Tool-Oberflaeche fuer OpenClaw (Browser, Canvas, Nodes, Message, Cron), die die Legacy-`openclaw-*`-Skills ersetzt"
read_when:
  - Beim Hinzufuegen oder Aendern von Agent-Tools
  - Beim Ausmustern oder Aendern von `openclaw-*`-Skills
title: "Tools"
x-i18n:
  source_path: tools/index.md
  source_hash: 332c319afb6e65ad
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:30Z
---

# Tools (OpenClaw)

OpenClaw stellt **erstklassige Agent-Tools** fuer Browser, Canvas, Nodes und Cron bereit.
Diese ersetzen die alten `openclaw-*`-Skills: Die Tools sind typisiert, es wird nicht in die Shell gewechselt,
und der Agent sollte sich direkt auf sie verlassen.

## Tools deaktivieren

Sie koennen Tools global ueber `tools.allow` / `tools.deny` in `openclaw.json`
zulassen bzw. verbieten (Verbote haben Vorrang). Dadurch wird verhindert, dass nicht erlaubte Tools an Modellanbieter gesendet werden.

```json5
{
  tools: { deny: ["browser"] },
}
```

Hinweise:

- Abgleich ist nicht gross-/kleinschreibungssensitiv.
- `*`-Wildcards werden unterstuetzt (`"*"` bedeutet alle Tools).
- Wenn `tools.allow` nur auf unbekannte oder nicht geladene Plugin-Toolnamen verweist, protokolliert OpenClaw eine Warnung und ignoriert die Allowlist, damit Kern-Tools verfuegbar bleiben.

## Tool-Profile (Basis-Allowlist)

`tools.profile` setzt eine **Basis-Tool-Allowlist** vor `tools.allow`/`tools.deny`.
Pro-Agent-Override: `agents.list[].tools.profile`.

Profile:

- `minimal`: nur `session_status`
- `coding`: `group:fs`, `group:runtime`, `group:sessions`, `group:memory`, `image`
- `messaging`: `group:messaging`, `sessions_list`, `sessions_history`, `sessions_send`, `session_status`
- `full`: keine Einschraenkung (gleich wie nicht gesetzt)

Beispiel (standardmaessig nur Messaging, zusaetzlich Slack- + Discord-Tools erlauben):

```json5
{
  tools: {
    profile: "messaging",
    allow: ["slack", "discord"],
  },
}
```

Beispiel (Coding-Profil, aber exec/process ueberall verbieten):

```json5
{
  tools: {
    profile: "coding",
    deny: ["group:runtime"],
  },
}
```

Beispiel (globales Coding-Profil, Support-Agent nur Messaging):

```json5
{
  tools: { profile: "coding" },
  agents: {
    list: [
      {
        id: "support",
        tools: { profile: "messaging", allow: ["slack"] },
      },
    ],
  },
}
```

## Anbieter-spezifische Tool-Policy

Verwenden Sie `tools.byProvider`, um Tools fuer bestimmte Anbieter
(oder ein einzelnes `provider/model`) **weiter einzuschraenken**, ohne Ihre globalen Defaults zu aendern.
Pro-Agent-Override: `agents.list[].tools.byProvider`.

Dies wird **nach** dem Basis-Tool-Profil und **vor** den Allow/Deny-Listen angewendet,
sodass der Tool-Satz nur eingeengt werden kann.
Anbieter-Schluessel akzeptieren entweder `provider` (z. B. `google-antigravity`) oder
`provider/model` (z. B. `openai/gpt-5.2`).

Beispiel (globales Coding-Profil beibehalten, aber minimale Tools fuer Google Antigravity):

```json5
{
  tools: {
    profile: "coding",
    byProvider: {
      "google-antigravity": { profile: "minimal" },
    },
  },
}
```

Beispiel (anbieter-/modell-spezifische Allowlist fuer einen instabilen Endpunkt):

```json5
{
  tools: {
    allow: ["group:fs", "group:runtime", "sessions_list"],
    byProvider: {
      "openai/gpt-5.2": { allow: ["group:fs", "sessions_list"] },
    },
  },
}
```

Beispiel (Agent-spezifisches Override fuer einen einzelnen Anbieter):

```json5
{
  agents: {
    list: [
      {
        id: "support",
        tools: {
          byProvider: {
            "google-antigravity": { allow: ["message", "sessions_list"] },
          },
        },
      },
    ],
  },
}
```

## Tool-Gruppen (Kurzformen)

Tool-Policies (global, Agent, Sandbox) unterstuetzen `group:*`-Eintraege, die zu mehreren Tools expandieren.
Verwenden Sie diese in `tools.allow` / `tools.deny`.

Verfuegbare Gruppen:

- `group:runtime`: `exec`, `bash`, `process`
- `group:fs`: `read`, `write`, `edit`, `apply_patch`
- `group:sessions`: `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status`
- `group:memory`: `memory_search`, `memory_get`
- `group:web`: `web_search`, `web_fetch`
- `group:ui`: `browser`, `canvas`
- `group:automation`: `cron`, `gateway`
- `group:messaging`: `message`
- `group:nodes`: `nodes`
- `group:openclaw`: alle integrierten OpenClaw-Tools (ohne Anbieter-Plugins)

Beispiel (nur Datei-Tools + Browser erlauben):

```json5
{
  tools: {
    allow: ["group:fs", "browser"],
  },
}
```

## Plugins + Tools

Plugins koennen **zusaetzliche Tools** (und CLI-Befehle) ueber den Kernumfang hinaus registrieren.
Siehe [Plugins](/plugin) fuer Installation + Konfiguration und [Skills](/tools/skills) dafuer, wie
Anleitungen zur Tool-Nutzung in Prompts eingebracht werden. Einige Plugins liefern eigene Skills
neben Tools aus (z. B. das Voice-Call-Plugin).

Optionale Plugin-Tools:

- [Lobster](/tools/lobster): typisierte Workflow-Laufzeit mit fortsetzbaren Freigaben (erfordert die Lobster-CLI auf dem Gateway-Host).
- [LLM Task](/tools/llm-task): reiner JSON-LLM-Schritt fuer strukturierte Workflow-Ausgaben (optionale Schema-Validierung).

## Tool-Inventar

### `apply_patch`

Strukturierte Patches ueber eine oder mehrere Dateien anwenden. Verwenden Sie dies fuer Multi-Hunk-Edits.
Experimentell: aktivieren ueber `tools.exec.applyPatch.enabled` (nur OpenAI-Modelle).

### `exec`

Shell-Befehle im Workspace ausfuehren.

Kernparameter:

- `command` (erforderlich)
- `yieldMs` (Auto-Hintergrund nach Timeout, Standard 10000)
- `background` (sofort in den Hintergrund)
- `timeout` (Sekunden; beendet den Prozess bei Ueberschreitung, Standard 1800)
- `elevated` (Bool; auf dem Host ausfuehren, wenn erhöhter Modus aktiviert/erlaubt ist; aendert das Verhalten nur, wenn der Agent in einer Sandbox ist)
- `host` (`sandbox | gateway | node`)
- `security` (`deny | allowlist | full`)
- `ask` (`off | on-miss | always`)
- `node` (Node-ID/-Name fuer `host=node`)
- Brauchen Sie ein echtes TTY? Setzen Sie `pty: true`.

Hinweise:

- Gibt `status: "running"` mit einer `sessionId` zurueck, wenn in den Hintergrund gelegt.
- Verwenden Sie `process`, um Hintergrund-Sitzungen abzufragen/protokollieren/schreiben/beenden/leeren.
- Wenn `process` nicht erlaubt ist, laeuft `exec` synchron und ignoriert `yieldMs`/`background`.
- `elevated` ist durch `tools.elevated` plus ein moegliches `agents.list[].tools.elevated`-Override gesteuert (beide muessen erlauben) und ist ein Alias fuer `host=gateway` + `security=full`.
- `elevated` aendert das Verhalten nur, wenn der Agent in einer Sandbox ist (ansonsten No-Op).
- `host=node` kann eine macOS-Begleit-App oder einen headless Node-Host ansprechen (`openclaw node run`).
- Gateway-/Node-Freigaben und Allowlists: [Exec approvals](/tools/exec-approvals).

### `process`

Hintergrund-Exec-Sitzungen verwalten.

Kernaktionen:

- `list`, `poll`, `log`, `write`, `kill`, `clear`, `remove`

Hinweise:

- `poll` gibt neue Ausgaben und den Exit-Status zurueck, wenn abgeschlossen.
- `log` unterstuetzt zeilenbasierte `offset`/`limit` (lassen Sie `offset` weg, um die letzten N Zeilen zu holen).
- `process` ist pro Agent begrenzt; Sitzungen anderer Agenten sind nicht sichtbar.

### `web_search`

Websuche mit der Brave-Search-API.

Kernparameter:

- `query` (erforderlich)
- `count` (1–10; Standard aus `tools.web.search.maxResults`)

Hinweise:

- Erfordert einen Brave-API-Schluessel (empfohlen: `openclaw configure --section web` oder setzen Sie `BRAVE_API_KEY`).
- Aktivieren ueber `tools.web.search.enabled`.
- Antworten werden zwischengespeichert (Standard 15 Min.).
- Siehe [Web tools](/tools/web) fuer die Einrichtung.

### `web_fetch`

Lesbaren Inhalt aus einer URL abrufen und extrahieren (HTML → Markdown/Text).

Kernparameter:

- `url` (erforderlich)
- `extractMode` (`markdown` | `text`)
- `maxChars` (lange Seiten kuerzen)

Hinweise:

- Aktivieren ueber `tools.web.fetch.enabled`.
- `maxChars` wird durch `tools.web.fetch.maxCharsCap` begrenzt (Standard 50000).
- Antworten werden zwischengespeichert (Standard 15 Min.).
- Fuer JS-lastige Seiten bevorzugen Sie das Browser-Tool.
- Siehe [Web tools](/tools/web) fuer die Einrichtung.
- Siehe [Firecrawl](/tools/firecrawl) fuer den optionalen Anti-Bot-Fallback.

### `browser`

Den dedizierten, von OpenClaw verwalteten Browser steuern.

Kernaktionen:

- `status`, `start`, `stop`, `tabs`, `open`, `focus`, `close`
- `snapshot` (aria/ai)
- `screenshot` (gibt Image-Block + `MEDIA:<path>` zurueck)
- `act` (UI-Aktionen: click/type/press/hover/drag/select/fill/resize/wait/evaluate)
- `navigate`, `console`, `pdf`, `upload`, `dialog`

Profilverwaltung:

- `profiles` — alle Browser-Profile mit Status auflisten
- `create-profile` — neues Profil mit automatisch zugewiesenem Port erstellen (oder `cdpUrl`)
- `delete-profile` — Browser stoppen, Benutzerdaten loeschen, aus der Konfiguration entfernen (nur lokal)
- `reset-profile` — verwaisten Prozess auf dem Port des Profils beenden (nur lokal)

Haeufige Parameter:

- `profile` (optional; Standard `browser.defaultProfile`)
- `target` (`sandbox` | `host` | `node`)
- `node` (optional; waehlt eine spezifische Node-ID/-Name)
  Hinweise:
- Erfordert `browser.enabled=true` (Standard ist `true`; setzen Sie `false` zum Deaktivieren).
- Alle Aktionen akzeptieren den optionalen Parameter `profile` fuer Multi-Instanz-Unterstuetzung.
- Wenn `profile` fehlt, wird `browser.defaultProfile` verwendet (Standard „chrome“).
- Profilnamen: nur kleingeschriebene alphanumerische Zeichen + Bindestriche (max. 64 Zeichen).
- Portbereich: 18800–18899 (~100 Profile max.).
- Remote-Profile sind nur „attach-only“ (kein Start/Stop/Reset).
- Wenn eine browserfaehige Node verbunden ist, kann das Tool automatisch dorthin routen (sofern Sie nicht `target` festpinnen).
- `snapshot` verwendet standardmaessig `ai`, wenn Playwright installiert ist; nutzen Sie `aria` fuer den Accessibility-Tree.
- `snapshot` unterstuetzt auch Role-Snapshot-Optionen (`interactive`, `compact`, `depth`, `selector`), die Referenzen wie `e12` zurueckgeben.
- `act` erfordert `ref` aus `snapshot` (numerische `12` aus AI-Snapshots oder `e12` aus Role-Snapshots); verwenden Sie `evaluate` fuer seltene CSS-Selektor-Bedarfe.
- Vermeiden Sie `act` → `wait` standardmaessig; nutzen Sie es nur in Ausnahmefaellen (kein verlaesslicher UI-Zustand zum Warten).
- `upload` kann optional eine `ref` uebergeben, um nach dem Scharfschalten automatisch zu klicken.
- `upload` unterstuetzt auch `inputRef` (aria-Ref) oder `element` (CSS-Selektor), um `<input type="file">` direkt zu setzen.

### `canvas`

Das Node-Canvas steuern (present, eval, snapshot, A2UI).

Kernaktionen:

- `present`, `hide`, `navigate`, `eval`
- `snapshot` (gibt Image-Block + `MEDIA:<path>` zurueck)
- `a2ui_push`, `a2ui_reset`

Hinweise:

- Verwendet unter der Haube das Gateway-`node.invoke`.
- Wenn kein `node` angegeben ist, waehlt das Tool einen Standard (einzelne verbundene Node oder lokaler Mac-Node).
- A2UI ist nur v0.8 (kein `createSurface`); die CLI lehnt v0.9-JSONL mit Zeilenfehlern ab.
- Schneller Smoke-Test: `openclaw nodes canvas a2ui push --node <id> --text "Hello from A2UI"`.

### `nodes`

Gepaarte Nodes erkennen und ansprechen; Benachrichtigungen senden; Kamera/Bildschirm erfassen.

Kernaktionen:

- `status`, `describe`
- `pending`, `approve`, `reject` (Pairing)
- `notify` (macOS `system.notify`)
- `run` (macOS `system.run`)
- `camera_snap`, `camera_clip`, `screen_record`
- `location_get`

Hinweise:

- Kamera-/Bildschirmbefehle erfordern, dass die Node-App im Vordergrund ist.
- Bilder geben Image-Blöcke + `MEDIA:<path>` zurueck.
- Videos geben `FILE:<path>` (mp4) zurueck.
- Standort gibt ein JSON-Payload zurueck (lat/lon/accuracy/timestamp).
- `run`-Parameter: `command` argv-Array; optional `cwd`, `env` (`KEY=VAL`), `commandTimeoutMs`, `invokeTimeoutMs`, `needsScreenRecording`.

Beispiel (`run`):

```json
{
  "action": "run",
  "node": "office-mac",
  "command": ["echo", "Hello"],
  "env": ["FOO=bar"],
  "commandTimeoutMs": 12000,
  "invokeTimeoutMs": 45000,
  "needsScreenRecording": false
}
```

### `image`

Ein Bild mit dem konfigurierten Bildmodell analysieren.

Kernparameter:

- `image` (erforderlicher Pfad oder URL)
- `prompt` (optional; Standard „Describe the image.“)
- `model` (optionales Override)
- `maxBytesMb` (optionale Groessenbegrenzung)

Hinweise:

- Nur verfuegbar, wenn `agents.defaults.imageModel` konfiguriert ist (primaer oder Fallbacks) oder wenn aus Ihrem Standardmodell + konfigurierter Auth implizit ein Bildmodell abgeleitet werden kann (Best-Effort-Paarung).
- Verwendet das Bildmodell direkt (unabhaengig vom Haupt-Chatmodell).

### `message`

Nachrichten und Kanalaktionen ueber Discord/Google Chat/Slack/Telegram/WhatsApp/Signal/iMessage/MS Teams senden.

Kernaktionen:

- `send` (Text + optionale Medien; MS Teams unterstuetzt zusaetzlich `card` fuer Adaptive Cards)
- `poll` (WhatsApp/Discord/MS Teams-Umfragen)
- `react` / `reactions` / `read` / `edit` / `delete`
- `pin` / `unpin` / `list-pins`
- `permissions`
- `thread-create` / `thread-list` / `thread-reply`
- `search`
- `sticker`
- `member-info` / `role-info`
- `emoji-list` / `emoji-upload` / `sticker-upload`
- `role-add` / `role-remove`
- `channel-info` / `channel-list`
- `voice-status`
- `event-list` / `event-create`
- `timeout` / `kick` / `ban`

Hinweise:

- `send` leitet WhatsApp ueber das Gateway; andere Kanaele gehen direkt.
- `poll` verwendet das Gateway fuer WhatsApp und MS Teams; Discord-Umfragen gehen direkt.
- Wenn ein Message-Tool-Call an eine aktive Chat-Sitzung gebunden ist, sind Sendungen auf das Ziel dieser Sitzung beschraenkt, um Kontext-Leaks zu vermeiden.

### `cron`

Gateway-Cronjobs und Wakeups verwalten.

Kernaktionen:

- `status`, `list`
- `add`, `update`, `remove`, `run`, `runs`
- `wake` (Systemereignis einreihen + optionaler sofortiger Heartbeat)

Hinweise:

- `add` erwartet ein vollstaendiges Cronjob-Objekt (gleiches Schema wie die `cron.add`-RPC).
- `update` verwendet `{ id, patch }`.

### `gateway`

Den laufenden Gateway-Prozess neu starten oder Updates anwenden (In-Place).

Kernaktionen:

- `restart` (autorisiert + sendet `SIGUSR1` fuer In-Process-Restart; `openclaw gateway` Neustart In-Place)
- `config.get` / `config.schema`
- `config.apply` (validieren + Konfiguration schreiben + Neustart + Wake)
- `config.patch` (partielles Update mergen + Neustart + Wake)
- `update.run` (Update ausfuehren + Neustart + Wake)

Hinweise:

- Verwenden Sie `delayMs` (Standard 2000), um eine laufende Antwort nicht zu unterbrechen.
- `restart` ist standardmaessig deaktiviert; aktivieren Sie es mit `commands.restart: true`.

### `sessions_list` / `sessions_history` / `sessions_send` / `sessions_spawn` / `session_status`

Sitzungen auflisten, Transkriptverlauf inspizieren oder an eine andere Sitzung senden.

Kernparameter:

- `sessions_list`: `kinds?`, `limit?`, `activeMinutes?`, `messageLimit?` (0 = keine)
- `sessions_history`: `sessionKey` (oder `sessionId`), `limit?`, `includeTools?`
- `sessions_send`: `sessionKey` (oder `sessionId`), `message`, `timeoutSeconds?` (0 = Fire-and-Forget)
- `sessions_spawn`: `task`, `label?`, `agentId?`, `model?`, `runTimeoutSeconds?`, `cleanup?`
- `session_status`: `sessionKey?` (Standard aktuell; akzeptiert `sessionId`), `model?` (`default` hebt Override auf)

Hinweise:

- `main` ist der kanonische Direct-Chat-Schluessel; global/unbekannt sind verborgen.
- `messageLimit > 0` holt die letzten N Nachrichten pro Sitzung (Tool-Nachrichten gefiltert).
- `sessions_send` wartet auf die finale Fertigstellung, wenn `timeoutSeconds > 0`.
- Zustellung/Ankuendigung erfolgt nach Abschluss und nach Best-Effort; `status: "ok"` bestaetigt, dass der Agentenlauf beendet ist, nicht dass die Ankuendigung zugestellt wurde.
- `sessions_spawn` startet einen Sub-Agentenlauf und postet eine Ankuendigungsantwort zurueck in den anfragenden Chat.
- `sessions_spawn` ist nicht blockierend und gibt `status: "accepted"` sofort zurueck.
- `sessions_send` fuehrt ein Reply-back-Ping-Pong aus (Antwort `REPLY_SKIP` zum Stoppen; max. Zuege ueber `session.agentToAgent.maxPingPongTurns`, 0–5).
- Nach dem Ping-Pong fuehrt der Zielagent einen **Announce-Schritt** aus; antworten Sie `ANNOUNCE_SKIP`, um die Ankuendigung zu unterdruecken.

### `agents_list`

Agent-IDs auflisten, die die aktuelle Sitzung mit `sessions_spawn` ansprechen darf.

Hinweise:

- Das Ergebnis ist auf Pro-Agent-Allowlists beschraenkt (`agents.list[].subagents.allowAgents`).
- Wenn `["*"]` konfiguriert ist, enthaelt das Tool alle konfigurierten Agenten und markiert `allowAny: true`.

## Parameter (gemeinsam)

Gateway-gestuetzte Tools (`canvas`, `nodes`, `cron`):

- `gatewayUrl` (Standard `ws://127.0.0.1:18789`)
- `gatewayToken` (wenn Auth aktiviert)
- `timeoutMs`

Hinweis: Wenn `gatewayUrl` gesetzt ist, geben Sie `gatewayToken` explizit an. Tools erben keine Konfiguration
oder Umgebungs-Credentials fuer Overrides, und fehlende explizite Credentials sind ein Fehler.

Browser-Tool:

- `profile` (optional; Standard `browser.defaultProfile`)
- `target` (`sandbox` | `host` | `node`)
- `node` (optional; spezifische Node-ID/-Name festpinnen)

## Empfohlene Agentenablaeufe

Browser-Automatisierung:

1. `browser` → `status` / `start`
2. `snapshot` (ai oder aria)
3. `act` (click/type/press)
4. `screenshot`, falls Sie eine visuelle Bestaetigung benoetigen

Canvas-Rendern:

1. `canvas` → `present`
2. `a2ui_push` (optional)
3. `snapshot`

Node-Targeting:

1. `nodes` → `status`
2. `describe` auf der gewaehlten Node
3. `notify` / `run` / `camera_snap` / `screen_record`

## Sicherheit

- Vermeiden Sie direktes `system.run`; verwenden Sie `nodes` → `run` nur mit ausdruecklicher Nutzerzustimmung.
- Respektieren Sie die Nutzerzustimmung fuer Kamera-/Bildschirmaufnahmen.
- Verwenden Sie `status/describe`, um Berechtigungen sicherzustellen, bevor Medienbefehle aufgerufen werden.

## Wie Tools dem Agenten praesentiert werden

Tools werden in zwei parallelen Kanaelen bereitgestellt:

1. **System-Prompt-Text**: eine menschenlesbare Liste + Anleitung.
2. **Tool-Schema**: die strukturierten Funktionsdefinitionen, die an die Modell-API gesendet werden.

Das bedeutet, der Agent sieht sowohl „welche Tools existieren“ als auch „wie man sie aufruft“. Wenn ein Tool
nicht im System-Prompt oder im Schema erscheint, kann das Modell es nicht aufrufen.
