---
summary: "Schneller Leitfaden zur Fehlerbehebung bei haeufigen OpenClaw-Fehlern"
read_when:
  - Untersuchung von Laufzeitproblemen oder Fehlern
title: "Fehlerbehebung"
x-i18n:
  source_path: gateway/troubleshooting.md
  source_hash: a07bb06f0b5ef568
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:24Z
---

# Fehlerbehebung 🔧

Wenn OpenClaw sich danebenbenimmt, erfahren Sie hier, wie Sie das Problem beheben.

Beginnen Sie mit den FAQ unter [Die ersten 60 Sekunden](/help/faq#first-60-seconds-if-somethings-broken), wenn Sie nur ein schnelles Triage-Rezept moechten. Diese Seite geht tiefer auf Laufzeitfehler und Diagnosen ein.

Anbieterspezifische Kurzlinks: [/channels/troubleshooting](/channels/troubleshooting)

## Status & Diagnosen

Schnelle Triage-Befehle (in dieser Reihenfolge):

| Befehl                             | Was er Ihnen sagt                                                                                                    | Wann verwenden                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `openclaw status`                  | Lokale Zusammenfassung: OS + Update, Gateway-Erreichbarkeit/-Modus, Service, Agents/Sitzungen, Anbieter-Konfigstatus | Erste Pruefung, schneller Ueberblick                          |
| `openclaw status --all`            | Vollstaendige lokale Diagnose (nur Lesen, kopierbar, relativ sicher) inkl. Log-Tail                                  | Wenn Sie einen Debug-Report teilen muessen                    |
| `openclaw status --deep`           | Fuehrt Gateway-Health-Checks aus (inkl. Anbieter-Probes; erfordert erreichbares Gateway)                             | Wenn „konfiguriert“ nicht „funktioniert“ bedeutet             |
| `openclaw gateway probe`           | Gateway-Erkennung + Erreichbarkeit (lokale + entfernte Ziele)                                                        | Wenn Sie vermuten, dass Sie das falsche Gateway pruefen       |
| `openclaw channels status --probe` | Fragt das laufende Gateway nach Kanalstatus (und optionalen Probes)                                                  | Wenn das Gateway erreichbar ist, Kanaele aber Probleme machen |
| `openclaw gateway status`          | Supervisor-Status (launchd/systemd/schtasks), Laufzeit-PID/Exit, letzter Gateway-Fehler                              | Wenn der Service „geladen aussieht“, aber nichts laeuft       |
| `openclaw logs --follow`           | Live-Logs (bestes Signal fuer Laufzeitprobleme)                                                                      | Wenn Sie den tatsaechlichen Fehlergrund benoetigen            |

**Ausgabe teilen:** bevorzugen Sie `openclaw status --all` (maskiert Tokens). Wenn Sie `openclaw status` einfuegen, setzen Sie vorher `OPENCLAW_SHOW_SECRETS=0` (Token-Vorschauen).

Siehe auch: [Health-Checks](/gateway/health) und [Logging](/logging).

## Haefige Probleme

### Kein API-Schluessel fuer Anbieter „anthropic“ gefunden

Das bedeutet, dass der **Auth-Store des Agents leer ist** oder Anthropic-Zugangsdaten fehlen.
Auth ist **pro Agent**, ein neuer Agent erbt also keine Schluessel des Haupt-Agents.

Loesungsoptionen:

- Onboarding erneut ausfuehren und **Anthropic** fuer diesen Agent auswaehlen.
- Oder ein Setup-Token auf dem **Gateway-Host** einfuegen:
  ```bash
  openclaw models auth setup-token --provider anthropic
  ```
- Oder `auth-profiles.json` aus dem Haupt-Agent-Verzeichnis in das neue Agent-Verzeichnis kopieren.

Ueberpruefen:

```bash
openclaw models status
```

### OAuth-Token-Aktualisierung fehlgeschlagen (Anthropic Claude-Abonnement)

Das bedeutet, dass das gespeicherte Anthropic-OAuth-Token abgelaufen ist und die Aktualisierung fehlgeschlagen ist.
Wenn Sie ein Claude-Abonnement (kein API-Schluessel) verwenden, ist die zuverlaessigste Loesung,
auf ein **Claude-Code-Setup-Token** zu wechseln und es auf dem **Gateway-Host** einzufuegen.

**Empfohlen (Setup-Token):**

```bash
# Run on the gateway host (paste the setup-token)
openclaw models auth setup-token --provider anthropic
openclaw models status
```

Wenn Sie das Token anderswo erzeugt haben:

```bash
openclaw models auth paste-token --provider anthropic
openclaw models status
```

Weitere Details: [Anthropic](/providers/anthropic) und [OAuth](/concepts/oauth).

### Control-UI scheitert ueber HTTP („device identity required“ / „connect failed“)

Wenn Sie das Dashboard ueber reines HTTP oeffnen (z. B. `http://<lan-ip>:18789/` oder
`http://<tailscale-ip>:18789/`), laeuft der Browser in einem **nicht-sicheren Kontext** und
blockiert WebCrypto, sodass keine Geraeteidentitaet erzeugt werden kann.

**Behebung:**

- Bevorzugen Sie HTTPS ueber [Tailscale Serve](/gateway/tailscale).
- Oder oeffnen Sie lokal auf dem Gateway-Host: `http://127.0.0.1:18789/`.
- Wenn Sie bei HTTP bleiben muessen, aktivieren Sie `gateway.controlUi.allowInsecureAuth: true` und
  verwenden Sie ein Gateway-Token (nur Token; keine Geraeteidentitaet/Paarung). Siehe
  [Control UI](/web/control-ui#insecure-http).

### CI-Secret-Scan fehlgeschlagen

Das bedeutet, dass `detect-secrets` neue Kandidaten gefunden hat, die noch nicht in der Baseline sind.
Folgen Sie [Secret Scanning](/gateway/security#secret-scanning-detect-secrets).

### Service installiert, aber nichts laeuft

Wenn der Gateway-Service installiert ist, der Prozess aber sofort beendet wird, kann der Service
„geladen“ erscheinen, waehrend nichts laeuft.

**Pruefen:**

```bash
openclaw gateway status
openclaw doctor
```

Doctor/Service zeigt den Laufzeitzustand (PID/letzter Exit) und Log-Hinweise.

**Logs:**

- Bevorzugt: `openclaw logs --follow`
- Datei-Logs (immer): `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (oder Ihr konfiguriertes `logging.file`)
- macOS LaunchAgent (falls installiert): `$OPENCLAW_STATE_DIR/logs/gateway.log` und `gateway.err.log`
- Linux systemd (falls installiert): `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`
- Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST`

**Mehr Logging aktivieren:**

- Dateilog-Detailgrad erhoehen (persistiertes JSONL):
  ```json
  { "logging": { "level": "debug" } }
  ```
- Konsolen-Verbosity erhoehen (nur TTY-Ausgabe):
  ```json
  { "logging": { "consoleLevel": "debug", "consoleStyle": "pretty" } }
  ```
- Kurz-Tipp: `--verbose` betrifft **nur** die Konsolenausgabe. Datei-Logs bleiben durch `logging.level` gesteuert.

Siehe [/logging](/logging) fuer eine vollstaendige Uebersicht zu Formaten, Konfiguration und Zugriff.

### „Gateway start blocked: set gateway.mode=local“

Das bedeutet, dass die Konfiguration existiert, aber `gateway.mode` nicht gesetzt ist (oder nicht `local`),
sodass das Gateway den Start verweigert.

**Behebung (empfohlen):**

- Fuehren Sie den Assistenten aus und setzen Sie den Gateway-Laufmodus auf **Local**:
  ```bash
  openclaw configure
  ```
- Oder setzen Sie ihn direkt:
  ```bash
  openclaw config set gateway.mode local
  ```

**Wenn Sie stattdessen ein entferntes Gateway betreiben wollten:**

- Setzen Sie eine Remote-URL und belassen Sie `gateway.mode=remote`:
  ```bash
  openclaw config set gateway.mode remote
  openclaw config set gateway.remote.url "wss://gateway.example.com"
  ```

**Ad-hoc/Dev-only:** uebergeben Sie `--allow-unconfigured`, um das Gateway ohne
`gateway.mode=local` zu starten.

**Noch keine Konfigurationsdatei?** Fuehren Sie `openclaw setup` aus, um eine Startkonfiguration zu erstellen, und starten Sie dann das Gateway erneut.

### Service-Umgebung (PATH + Runtime)

Der Gateway-Service laeuft mit einem **minimalen PATH**, um Shell-/Manager-Ballast zu vermeiden:

- macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
- Linux: `/usr/local/bin`, `/usr/bin`, `/bin`

Dies schliesst bewusst Versionsmanager (nvm/fnm/volta/asdf) und Paketmanager (pnpm/npm) aus,
da der Service Ihre Shell-Init nicht laedt. Laufzeitvariablen wie `DISPLAY`
sollten in `~/.openclaw/.env` liegen (frueh vom Gateway geladen).
Exec-Ausfuehrungen auf `host=gateway` fuehren Ihr Login-Shell-`PATH` in die Exec-Umgebung zusammen,
daher bedeuten fehlende Werkzeuge meist, dass Ihre Shell-Init sie nicht exportiert (oder setzen Sie
`tools.exec.pathPrepend`). Siehe [/tools/exec](/tools/exec).

WhatsApp- und Telegram-Kanaele erfordern **Node**; Bun wird nicht unterstuetzt. Wenn Ihr
Service mit Bun oder einem versionsverwalteten Node-Pfad installiert wurde, fuehren Sie `openclaw doctor`
aus, um auf eine System-Node-Installation zu migrieren.

### Skill fehlt API-Schluessel in der Sandbox

**Symptom:** Skill funktioniert auf dem Host, scheitert aber in der Sandbox mit fehlendem API-Schluessel.

**Warum:** Sandboxed Exec laeuft innerhalb von Docker und erbt **nicht** das Host-`process.env`.

**Behebung:**

- Setzen Sie `agents.defaults.sandbox.docker.env` (oder pro Agent `agents.list[].sandbox.docker.env`)
- oder backen Sie den Schluessel in Ihr benutzerdefiniertes Sandbox-Image
- und fuehren Sie dann `openclaw sandbox recreate --agent <id>` (oder `--all`) aus

### Service laeuft, aber Port lauscht nicht

Wenn der Service **laufend** meldet, aber nichts auf dem Gateway-Port lauscht,
hat das Gateway wahrscheinlich das Binden verweigert.

**Was „laufend“ hier bedeutet**

- `Runtime: running` bedeutet, dass Ihr Supervisor (launchd/systemd/schtasks) denkt, der Prozess lebt.
- `RPC probe` bedeutet, dass die CLI tatsaechlich eine Verbindung zum Gateway-WebSocket herstellen und `status` aufrufen konnte.
- Vertrauen Sie immer `Probe target:` + `Config (service):` als die „Was haben wir tatsaechlich versucht?“-Zeilen.

**Pruefen:**

- `gateway.mode` muss `local` fuer `openclaw gateway` und den Service sein.
- Wenn Sie `gateway.mode=remote` gesetzt haben, verwendet die **CLI standardmaessig** eine Remote-URL. Der Service kann lokal laufen, aber Ihre CLI prueft moeglicherweise die falsche Adresse. Verwenden Sie `openclaw gateway status`, um den aufgeloesten Service-Port + Probe-Ziel zu sehen (oder uebergeben Sie `--url`).
- `openclaw gateway status` und `openclaw doctor` zeigen den **letzten Gateway-Fehler** aus den Logs, wenn der Service laufend aussieht, der Port aber geschlossen ist.
- Non-Loopback-Binds (`lan`/`tailnet`/`custom` oder `auto`, wenn Loopback nicht verfuegbar ist) erfordern Auth:
  `gateway.auth.token` (oder `OPENCLAW_GATEWAY_TOKEN`).
- `gateway.remote.token` ist nur fuer Remote-CLI-Aufrufe; es aktiviert **keine** lokale Auth.
- `gateway.token` wird ignoriert; verwenden Sie `gateway.auth.token`.

**Wenn `openclaw gateway status` einen Konfigurations-Mismatch zeigt**

- `Config (cli): ...` und `Config (service): ...` sollten normalerweise uebereinstimmen.
- Wenn nicht, bearbeiten Sie mit hoher Wahrscheinlichkeit eine Konfiguration, waehrend der Service eine andere verwendet.
- Behebung: Fuehren Sie `openclaw gateway install --force` erneut aus demselben `--profile` / `OPENCLAW_STATE_DIR`, das der Service verwenden soll.

**Wenn `openclaw gateway status` Service-Konfigprobleme meldet**

- Die Supervisor-Konfiguration (launchd/systemd/schtasks) enthaelt nicht die aktuellen Defaults.
- Behebung: Fuehren Sie `openclaw doctor` aus, um sie zu aktualisieren (oder `openclaw gateway install --force` fuer ein vollstaendiges Neuschreiben).

**Wenn `Last gateway error:` „refusing to bind … without auth“ erwaehnt**

- Sie haben `gateway.bind` auf einen Non-Loopback-Modus gesetzt (`lan`/`tailnet`/`custom` oder `auto`, wenn Loopback nicht verfuegbar ist), aber keine Auth konfiguriert.
- Behebung: Setzen Sie `gateway.auth.mode` + `gateway.auth.token` (oder exportieren Sie `OPENCLAW_GATEWAY_TOKEN`) und starten Sie den Service neu.

**Wenn `openclaw gateway status` meldet `bind=tailnet`, aber kein Tailnet-Interface gefunden wurde**

- Das Gateway versuchte, an eine Tailscale-IP (100.64.0.0/10) zu binden, aber auf dem Host wurde keine erkannt.
- Behebung: Starten Sie Tailscale auf dieser Maschine (oder aendern Sie `gateway.bind` zu `loopback`/`lan`).

**Wenn `Probe note:` sagt, dass die Probe Loopback verwendet**

- Das ist fuer `bind=lan` zu erwarten: Das Gateway lauscht auf `0.0.0.0` (alle Interfaces), und Loopback sollte lokal weiterhin verbinden.
- Fuer entfernte Clients verwenden Sie eine echte LAN-IP (nicht `0.0.0.0`) plus Port und stellen Sie sicher, dass Auth konfiguriert ist.

### Adresse bereits in Verwendung (Port 18789)

Das bedeutet, dass bereits etwas auf dem Gateway-Port lauscht.

**Pruefen:**

```bash
openclaw gateway status
```

Es zeigt die Listener und wahrscheinliche Ursachen (Gateway laeuft bereits, SSH-Tunnel).
Falls noetig, stoppen Sie den Service oder waehlen Sie einen anderen Port.

### Zusaetzliche Workspace-Ordner erkannt

Wenn Sie von aelteren Installationen aktualisiert haben, koennen noch `~/openclaw` auf der Festplatte liegen.
Mehrere Workspace-Verzeichnisse koennen verwirrende Auth- oder Zustandsabweichungen verursachen, da
nur ein Workspace aktiv ist.

**Behebung:** Behalten Sie einen einzelnen aktiven Workspace und archivieren/entfernen Sie den Rest. Siehe
[Agent Workspace](/concepts/agent-workspace#extra-workspace-folders).

### Hauptchat laeuft in einem Sandbox-Workspace

Symptome: `pwd` oder Datei-Werkzeuge zeigen `~/.openclaw/sandboxes/...`, obwohl Sie
den Host-Workspace erwartet haben.

**Warum:** `agents.defaults.sandbox.mode: "non-main"` richtet sich nach `session.mainKey` (Standard `"main"`).
Gruppen-/Kanal-Sitzungen verwenden eigene Schluessel und werden daher als nicht-Haupt eingestuft
und erhalten Sandbox-Workspaces.

**Behebungsoptionen:**

- Wenn Sie Host-Workspaces fuer einen Agent moechten: setzen Sie `agents.list[].sandbox.mode: "off"`.
- Wenn Sie Host-Workspace-Zugriff innerhalb der Sandbox moechten: setzen Sie `workspaceAccess: "rw"` fuer diesen Agent.

### „Agent was aborted“

Der Agent wurde mitten in der Antwort unterbrochen.

**Ursachen:**

- Benutzer sendete `stop`, `abort`, `esc`, `wait` oder `exit`
- Timeout ueberschritten
- Prozess abgestuerzt

**Behebung:** Senden Sie einfach eine weitere Nachricht. Die Sitzung wird fortgesetzt.

### „Agent failed before reply: Unknown model: anthropic/claude-haiku-3-5“

OpenClaw lehnt absichtlich **aeltere/unsichere Modelle** ab (insbesondere solche,
die anfaelliger fuer Prompt-Injection sind). Wenn Sie diesen Fehler sehen, wird
der Modellname nicht mehr unterstuetzt.

**Behebung:**

- Waehlen Sie ein **aktuelles** Modell fuer den Anbieter und aktualisieren Sie Ihre Konfiguration oder den Modell-Alias.
- Wenn Sie unsicher sind, welche Modelle verfuegbar sind, fuehren Sie `openclaw models list` oder
  `openclaw models scan` aus und waehlen Sie ein unterstuetztes Modell.
- Pruefen Sie die Gateway-Logs fuer den detaillierten Fehlergrund.

Siehe auch: [Models CLI](/cli/models) und [Modellanbieter](/concepts/model-providers).

### Nachrichten loesen nichts aus

**Check 1:** Ist der Absender allowlisted?

```bash
openclaw status
```

Suchen Sie nach `AllowFrom: ...` in der Ausgabe.

**Check 2:** Ist bei Gruppenchats eine Erwaehnung erforderlich?

```bash
# The message must match mentionPatterns or explicit mentions; defaults live in channel groups/guilds.
# Multi-agent: `agents.list[].groupChat.mentionPatterns` overrides global patterns.
grep -n "agents\\|groupChat\\|mentionPatterns\\|channels\\.whatsapp\\.groups\\|channels\\.telegram\\.groups\\|channels\\.imessage\\.groups\\|channels\\.discord\\.guilds" \
  "${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
```

**Check 3:** Logs pruefen

```bash
openclaw logs --follow
# or if you want quick filters:
tail -f "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | grep "blocked\\|skip\\|unauthorized"
```

### Pairing-Code kommt nicht an

Wenn `dmPolicy` auf `pairing` steht, sollten unbekannte Absender einen Code erhalten,
und ihre Nachricht wird ignoriert, bis sie genehmigt ist.

**Check 1:** Wartet bereits eine ausstehende Anfrage?

```bash
openclaw pairing list <channel>
```

Ausstehende DM-Pairing-Anfragen sind standardmaessig auf **3 pro Kanal** begrenzt. Ist die Liste voll,
erzeugen neue Anfragen keinen Code, bis eine genehmigt wird oder ablaeuft.

**Check 2:** Wurde die Anfrage erstellt, aber keine Antwort gesendet?

```bash
openclaw logs --follow | grep "pairing request"
```

**Check 3:** Stellen Sie sicher, dass `dmPolicy` fuer diesen Kanal nicht `open`/`allowlist` ist.

### Bild + Erwaehnung funktioniert nicht

Bekanntes Problem: Wenn Sie ein Bild **nur** mit einer Erwaehnung (ohne weiteren Text) senden,
enthaelt WhatsApp manchmal nicht die Erwaehnungs-Metadaten.

**Workaround:** Fuegen Sie etwas Text mit der Erwaehnung hinzu:

- ❌ `@openclaw` + Bild
- ✅ `@openclaw check this` + Bild

### Sitzung wird nicht fortgesetzt

**Check 1:** Ist die Sitzungsdatei vorhanden?

```bash
ls -la ~/.openclaw/agents/<agentId>/sessions/
```

**Check 2:** Ist das Reset-Fenster zu kurz?

```json
{
  "session": {
    "reset": {
      "mode": "daily",
      "atHour": 4,
      "idleMinutes": 10080 // 7 days
    }
  }
}
```

**Check 3:** Hat jemand `/new`, `/reset` oder einen Reset-Trigger gesendet?

### Agent laeuft in ein Timeout

Standard-Timeout ist 30 Minuten. Fuer lange Aufgaben:

```json
{
  "reply": {
    "timeoutSeconds": 3600 // 1 hour
  }
}
```

Oder verwenden Sie das Werkzeug `process`, um lange Befehle im Hintergrund auszufuehren.

### WhatsApp getrennt

```bash
# Check local status (creds, sessions, queued events)
openclaw status
# Probe the running gateway + channels (WA connect + Telegram + Discord APIs)
openclaw status --deep

# View recent connection events
openclaw logs --limit 200 | grep "connection\\|disconnect\\|logout"
```

**Behebung:** Verbindet sich in der Regel automatisch wieder, sobald das Gateway laeuft. Wenn es haengt,
starten Sie den Gateway-Prozess neu (wie auch immer Sie ihn ueberwachen) oder fuehren Sie ihn manuell
mit ausfuehrlicher Ausgabe aus:

```bash
openclaw gateway --verbose
```

Wenn Sie abgemeldet / entkoppelt sind:

```bash
openclaw channels logout
trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/credentials" # if logout can't cleanly remove everything
openclaw channels login --verbose       # re-scan QR
```

### Medienversand fehlgeschlagen

**Check 1:** Ist der Dateipfad gueltig?

```bash
ls -la /path/to/your/image.jpg
```

**Check 2:** Ist die Datei zu gross?

- Bilder: max. 6 MB
- Audio/Video: max. 16 MB
- Dokumente: max. 100 MB

**Check 3:** Medien-Logs pruefen

```bash
grep "media\\|fetch\\|download" "$(ls -t /tmp/openclaw/openclaw-*.log | head -1)" | tail -20
```

### Hoher Speicherverbrauch

OpenClaw haelt den Gespraechsverlauf im Speicher.

**Behebung:** Periodisch neu starten oder Sitzungsgrenzen setzen:

```json
{
  "session": {
    "historyLimit": 100 // Max messages to keep
  }
}
```

## Allgemeine Fehlerbehebung

### „Gateway startet nicht — Konfiguration ungueltig“

OpenClaw startet jetzt nicht, wenn die Konfiguration unbekannte Schluessel,
fehlerhafte Werte oder ungueltige Typen enthaelt. Das ist aus Sicherheitsgruenden
beabsichtigt.

Beheben Sie dies mit Doctor:

```bash
openclaw doctor
openclaw doctor --fix
```

Hinweise:

- `openclaw doctor` meldet jeden ungueltigen Eintrag.
- `openclaw doctor --fix` wendet Migrationen/Reparaturen an und schreibt die Konfiguration neu.
- Diagnosebefehle wie `openclaw logs`, `openclaw health`, `openclaw status`, `openclaw gateway status` und `openclaw gateway probe` laufen weiterhin, auch wenn die Konfiguration ungueltig ist.

### „All models failed“ — was sollte ich zuerst pruefen?

- **Zugangsdaten** fuer die verwendeten Anbieter vorhanden (Auth-Profile + Umgebungsvariablen).
- **Modell-Routing**: Bestaetigen Sie, dass `agents.defaults.model.primary` und Fallbacks Modelle sind, auf die Sie Zugriff haben.
- **Gateway-Logs** in `/tmp/openclaw/…` fuer den exakten Anbieterfehler.
- **Modellstatus**: Verwenden Sie `/model status` (Chat) oder `openclaw models status` (CLI).

### Ich laufe auf meiner persoenlichen WhatsApp-Nummer — warum ist Self-Chat seltsam?

Aktivieren Sie den Self-Chat-Modus und allowlisten Sie Ihre eigene Nummer:

```json5
{
  channels: {
    whatsapp: {
      selfChatMode: true,
      dmPolicy: "allowlist",
      allowFrom: ["+15555550123"],
    },
  },
}
```

Siehe [WhatsApp-Setup](/channels/whatsapp).

### WhatsApp hat mich abgemeldet. Wie autorisiere ich mich neu?

Fuehren Sie den Login-Befehl erneut aus und scannen Sie den QR-Code:

```bash
openclaw channels login
```

### Build-Fehler auf `main` — was ist der Standard-Fix-Pfad?

1. `git pull origin main && pnpm install`
2. `openclaw doctor`
3. GitHub-Issues oder Discord pruefen
4. Temporare Loesung: Einen aelteren Commit auschecken

### npm install schlaegt fehl (allow-build-scripts / fehlendes tar oder yargs). Was nun?

Wenn Sie aus dem Quellcode arbeiten, verwenden Sie den Paketmanager des Repos: **pnpm** (bevorzugt).
Das Repo deklariert `packageManager: "pnpm@…"`.

Typische Wiederherstellung:

```bash
git status   # ensure you’re in the repo root
pnpm install
pnpm build
openclaw doctor
openclaw gateway restart
```

Warum: pnpm ist der konfigurierte Paketmanager fuer dieses Repo.

### Wie wechsle ich zwischen Git-Installationen und npm-Installationen?

Verwenden Sie den **Website-Installer** und waehlen Sie die Installationsmethode mit einem Flag. Er
aktualisiert inplace und schreibt den Gateway-Service so um, dass er auf die neue Installation zeigt.

Wechsel **zu Git-Installation**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --install-method git --no-onboard
```

Wechsel **zu npm global**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Hinweise:

- Der Git-Flow rebaset nur, wenn das Repo sauber ist. Committen oder staschen Sie Aenderungen zuerst.
- Nach dem Wechsel ausfuehren:
  ```bash
  openclaw doctor
  openclaw gateway restart
  ```

### Telegram-Block-Streaming teilt Text nicht zwischen Tool-Calls. Warum?

Block-Streaming sendet nur **abgeschlossene Textbloecke**. Haefige Gruende fuer eine einzelne Nachricht:

- `agents.defaults.blockStreamingDefault` ist noch `"off"`.
- `channels.telegram.blockStreaming` ist auf `false` gesetzt.
- `channels.telegram.streamMode` ist `partial` oder `block` **und Draft-Streaming ist aktiv**
  (Privatchat + Topics). Draft-Streaming deaktiviert in diesem Fall Block-Streaming.
- Ihre `minChars` / Coalesce-Einstellungen sind zu hoch, sodass Chunks zusammengefuehrt werden.
- Das Modell gibt einen einzigen grossen Textblock aus (keine Flush-Punkte waehrend der Antwort).

Fix-Checkliste:

1. Platzieren Sie Block-Streaming-Einstellungen unter `agents.defaults`, nicht auf Root-Ebene.
2. Setzen Sie `channels.telegram.streamMode: "off"`, wenn Sie echte Mehrfach-Nachrichten fuer Block-Antworten moechten.
3. Verwenden Sie waehrend der Fehlersuche kleinere Chunk-/Coalesce-Schwellen.

Siehe [Streaming](/concepts/streaming).

### Discord antwortet nicht in meinem Server, selbst mit `requireMention: false`. Warum?

`requireMention` steuert nur das Mention-Gating **nachdem** der Kanal die Allowlists passiert hat.
Standardmaessig ist `channels.discord.groupPolicy` **Allowlist**, daher muessen Guilds explizit aktiviert werden.
Wenn Sie `channels.discord.guilds.<guildId>.channels` setzen, sind nur die aufgelisteten Kanaele erlaubt; lassen Sie es weg, um alle Kanaele in der Guild zu erlauben.

Fix-Checkliste:

1. Setzen Sie `channels.discord.groupPolicy: "open"` **oder** fuegen Sie einen Guild-Allowlist-Eintrag hinzu (optional mit Kanal-Allowlist).
2. Verwenden Sie **numerische Kanal-IDs** in `channels.discord.guilds.<guildId>.channels`.
3. Platzieren Sie `requireMention: false` **unter** `channels.discord.guilds` (global oder pro Kanal).
   Top-Level `channels.discord.requireMention` ist kein unterstuetzter Schluessel.
4. Stellen Sie sicher, dass der Bot **Message Content Intent** und Kanalberechtigungen hat.
5. Fuehren Sie `openclaw channels status --probe` fuer Audit-Hinweise aus.

Doku: [Discord](/channels/discord), [Channels-Fehlerbehebung](/channels/troubleshooting).

### Cloud Code Assist API-Fehler: ungueltiges Tool-Schema (400). Was nun?

Dies ist fast immer ein **Tool-Schema-Kompatibilitaetsproblem**. Der Cloud-Code-Assist-
Endpoint akzeptiert nur eine strenge Teilmenge von JSON Schema. OpenClaw bereinigt/normalisiert
Tool-Schemata in aktuellen `main`, aber der Fix ist noch nicht in der letzten Version enthalten
(Stand: 13. Januar 2026).

Fix-Checkliste:

1. **OpenClaw aktualisieren**:
   - Wenn Sie aus dem Quellcode laufen koennen, ziehen Sie `main` und starten Sie das Gateway neu.
   - Andernfalls warten Sie auf die naechste Version mit dem Schema-Bereiniger.
2. Vermeiden Sie nicht unterstuetzte Keywords wie `anyOf/oneOf/allOf`, `patternProperties`,
   `additionalProperties`, `minLength`, `maxLength`, `format` usw.
3. Wenn Sie benutzerdefinierte Tools definieren, halten Sie das Top-Level-Schema auf `type: "object"` mit
   `properties` und einfachen Enums.

Siehe [Tools](/tools) und [TypeBox-Schemas](/concepts/typebox).

## macOS-spezifische Probleme

### App stuerzt beim Gewaehren von Berechtigungen ab (Sprache/Mikro)

Wenn die App verschwindet oder „Abort trap 6“ anzeigt, wenn Sie bei einer Datenschutzabfrage auf „Zulassen“ klicken:

**Fix 1: TCC-Cache zuruecksetzen**

```bash
tccutil reset All bot.molt.mac.debug
```

**Fix 2: Neue Bundle-ID erzwingen**
Wenn das Zuruecksetzen nicht hilft, aendern Sie die `BUNDLE_ID` in
[`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh)
(z. B. einen `.test`-Suffix hinzufuegen) und bauen Sie neu. Dadurch behandelt macOS die App als neu.

### Gateway haengt bei „Starting...“

Die App verbindet sich mit einem lokalen Gateway auf Port `18789`. Wenn sie haengen bleibt:

**Fix 1: Supervisor stoppen (bevorzugt)**
Wenn das Gateway von launchd ueberwacht wird, fuehrt das Beenden der PID nur zu einem Neustart. Stoppen Sie zuerst den Supervisor:

```bash
openclaw gateway status
openclaw gateway stop
# Or: launchctl bootout gui/$UID/bot.molt.gateway (replace with bot.molt.<profile>; legacy com.openclaw.* still works)
```

**Fix 2: Port ist belegt (Listener finden)**

```bash
lsof -nP -iTCP:18789 -sTCP:LISTEN
```

Wenn es ein nicht ueberwachter Prozess ist, versuchen Sie zuerst einen sauberen Stopp und eskalieren Sie dann:

```bash
kill -TERM <PID>
sleep 1
kill -9 <PID> # last resort
```

**Fix 3: CLI-Installation pruefen**
Stellen Sie sicher, dass die globale `openclaw`-CLI installiert ist und zur App-Version passt:

```bash
openclaw --version
npm install -g openclaw@<version>
```

## Debug-Modus

Ausfuehrliches Logging erhalten:

```bash
# Turn on trace logging in config:
#   ${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json} -> { logging: { level: "trace" } }
#
# Then run verbose commands to mirror debug output to stdout:
openclaw gateway --verbose
openclaw channels login --verbose
```

## Log-Speicherorte

| Log                               | Speicherort                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway-Datei-Logs (strukturiert) | `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (oder `logging.file`)                                                                                                                                                                                                                                                                     |
| Gateway-Service-Logs (Supervisor) | macOS: `$OPENCLAW_STATE_DIR/logs/gateway.log` + `gateway.err.log` (Standard: `~/.openclaw/logs/...`; Profile verwenden `~/.openclaw-<profile>/logs/...`)<br />Linux: `journalctl --user -u openclaw-gateway[-<profile>].service -n 200 --no-pager`<br />Windows: `schtasks /Query /TN "OpenClaw Gateway (<profile>)" /V /FO LIST` |
| Sitzungsdateien                   | `$OPENCLAW_STATE_DIR/agents/<agentId>/sessions/`                                                                                                                                                                                                                                                                                  |
| Medien-Cache                      | `$OPENCLAW_STATE_DIR/media/`                                                                                                                                                                                                                                                                                                      |
| Zugangsdaten                      | `$OPENCLAW_STATE_DIR/credentials/`                                                                                                                                                                                                                                                                                                |

## Health-Check

```bash
# Supervisor + probe target + config paths
openclaw gateway status
# Include system-level scans (legacy/extra services, port listeners)
openclaw gateway status --deep

# Is the gateway reachable?
openclaw health --json
# If it fails, rerun with connection details:
openclaw health --verbose

# Is something listening on the default port?
lsof -nP -iTCP:18789 -sTCP:LISTEN

# Recent activity (RPC log tail)
openclaw logs --follow
# Fallback if RPC is down
tail -20 /tmp/openclaw/openclaw-*.log
```

## Alles zuruecksetzen

Nukleare Option:

```bash
openclaw gateway stop
# If you installed a service and want a clean install:
# openclaw gateway uninstall

trash "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
openclaw channels login         # re-pair WhatsApp
openclaw gateway restart           # or: openclaw gateway
```

⚠️ Dadurch gehen alle Sitzungen verloren und WhatsApp muss neu gekoppelt werden.

## Hilfe erhalten

1. Zuerst Logs pruefen: `/tmp/openclaw/` (Standard: `openclaw-YYYY-MM-DD.log` oder Ihr konfiguriertes `logging.file`)
2. Vorhandene Issues auf GitHub durchsuchen
3. Neues Issue mit:
   - OpenClaw-Version
   - Relevanten Log-Ausschnitten
   - Schritten zur Reproduktion
   - Ihrer Konfiguration (Secrets schwärzen!)

---

_„Haben Sie schon versucht, es aus- und wieder einzuschalten?“_ — Jede IT-Person jemals

🦞🔧

### Browser startet nicht (Linux)

Wenn Sie `"Failed to start Chrome CDP on port 18800"` sehen:

**Wahrscheinlichste Ursache:** Als Snap verpacktes Chromium auf Ubuntu.

**Schneller Fix:** Installieren Sie stattdessen Google Chrome:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
```

Dann in der Konfiguration setzen:

```json
{
  "browser": {
    "executablePath": "/usr/bin/google-chrome-stable"
  }
}
```

**Vollstaendige Anleitung:** Siehe [browser-linux-troubleshooting](/tools/browser-linux-troubleshooting)
