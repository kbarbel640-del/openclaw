---
summary: „Deep Dive: Session-Store + Transkripte, Lebenszyklus und (Auto-)Kompaktions-Interna“
read_when:
  - Sie muessen Session-IDs, Transcript-JSONL oder sessions.json-Felder debuggen
  - Sie aendern das Auto-Kompaktionsverhalten oder fuegen „Pre-Compaction“-Housekeeping hinzu
  - Sie moechten Speicher-Flushes oder stille System-Turns implementieren
title: „Session-Management Deep Dive“
x-i18n:
  source_path: reference/session-management-compaction.md
  source_hash: bf3715770ba63436
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:44Z
---

# Session-Management & Kompaktierung (Deep Dive)

Dieses Dokument erklaert, wie OpenClaw Sessions Ende-zu-Ende verwaltet:

- **Session-Routing** (wie eingehende Nachrichten einem `sessionKey` zugeordnet werden)
- **Session-Store** (`sessions.json`) und was er erfasst
- **Transkript-Persistenz** (`*.jsonl`) und ihre Struktur
- **Transkript-Hygiene** (anbieter­spezifische Korrekturen vor Runs)
- **Kontext-Limits** (Kontextfenster vs. erfasste Tokens)
- **Kompaktierung** (manuell + Auto-Kompaktierung) und wo Pre-Compaction-Arbeiten eingehakt werden
- **Stilles Housekeeping** (z. B. Speicher-Schreibvorgaenge, die keine nutzer­sichtbare Ausgabe erzeugen sollen)

Wenn Sie zuerst eine hoehere Ebene wollen, beginnen Sie mit:

- [/concepts/session](/concepts/session)
- [/concepts/compaction](/concepts/compaction)
- [/concepts/session-pruning](/concepts/session-pruning)
- [/reference/transcript-hygiene](/reference/transcript-hygiene)

---

## Quelle der Wahrheit: das Gateway

OpenClaw ist um einen einzelnen **Gateway-Prozess** herum konzipiert, der den Session-Status besitzt.

- UIs (macOS-App, Web-Control-UI, TUI) sollten das Gateway nach Session-Listen und Token-Zaehlern abfragen.
- Im Remote-Modus liegen Session-Dateien auf dem Remote-Host; „lokale Mac-Dateien pruefen“ spiegelt nicht wider, was das Gateway verwendet.

---

## Zwei Persistenzschichten

OpenClaw persistiert Sessions in zwei Schichten:

1. **Session-Store (`sessions.json`)**
   - Key/Value-Map: `sessionKey -> SessionEntry`
   - Klein, mutierbar, sicher zu bearbeiten (oder Eintraege zu loeschen)
   - Erfasst Session-Metadaten (aktuelle Session-ID, letzte Aktivitaet, Toggles, Token-Zaehler usw.)

2. **Transkript (`<sessionId>.jsonl`)**
   - Append-only-Transkript mit Baumstruktur (Eintraege haben `id` + `parentId`)
   - Speichert die eigentliche Konversation + Tool-Aufrufe + Kompaktierungszusammenfassungen
   - Wird verwendet, um den Modellkontext fuer kuenftige Turns wieder aufzubauen

---

## Speicherorte auf der Festplatte

Pro Agent auf dem Gateway-Host:

- Store: `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- Transkripte: `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`
  - Telegram-Topic-Sessions: `.../<sessionId>-topic-<threadId>.jsonl`

OpenClaw loest diese ueber `src/config/sessions.ts` auf.

---

## Session-Keys (`sessionKey`)

Ein `sessionKey` identifiziert, _in welchem Konversations-Container_ Sie sich befinden (Routing + Isolation).

Gaengige Muster:

- Haupt-/Direktchat (pro Agent): `agent:<agentId>:<mainKey>` (Standard `main`)
- Gruppe: `agent:<agentId>:<channel>:group:<id>`
- Raum/Kanal (Discord/Slack): `agent:<agentId>:<channel>:channel:<id>` oder `...:room:<id>`
- Cron: `cron:<job.id>`
- Webhook: `hook:<uuid>` (sofern nicht ueberschrieben)

Die kanonischen Regeln sind unter [/concepts/session](/concepts/session) dokumentiert.

---

## Session-IDs (`sessionId`)

Jeder `sessionKey` zeigt auf eine aktuelle `sessionId` (die Transkriptdatei, die die Konversation fortsetzt).

Faustregeln:

- **Reset** (`/new`, `/reset`) erzeugt eine neue `sessionId` fuer diesen `sessionKey`.
- **Taeglicher Reset** (Standard 4:00 Uhr Ortszeit auf dem Gateway-Host) erzeugt eine neue `sessionId` bei der naechsten Nachricht nach der Reset-Grenze.
- **Idle-Ablauf** (`session.reset.idleMinutes` oder legacy `session.idleMinutes`) erzeugt eine neue `sessionId`, wenn nach dem Idle-Fenster eine Nachricht eintrifft. Wenn taeglich + Idle beide konfiguriert sind, gewinnt das fruehere Ereignis.

Implementierungsdetail: Die Entscheidung erfolgt in `initSessionState()` in `src/auto-reply/reply/session.ts`.

---

## Session-Store-Schema (`sessions.json`)

Der Werttyp des Stores ist `SessionEntry` in `src/config/sessions.ts`.

Zentrale Felder (nicht vollstaendig):

- `sessionId`: aktuelle Transkript-ID (Dateiname wird hiervon abgeleitet, sofern `sessionFile` nicht gesetzt ist)
- `updatedAt`: Zeitstempel der letzten Aktivitaet
- `sessionFile`: optionale explizite Ueberschreibung des Transkriptpfads
- `chatType`: `direct | group | room` (hilft UIs und der Sende-Policy)
- `provider`, `subject`, `room`, `space`, `displayName`: Metadaten fuer Gruppen-/Kanal-Beschriftung
- Toggles:
  - `thinkingLevel`, `verboseLevel`, `reasoningLevel`, `elevatedLevel`
  - `sendPolicy` (Override pro Session)
- Modellauswahl:
  - `providerOverride`, `modelOverride`, `authProfileOverride`
- Token-Zaehler (Best-Effort / anbieterabhaengig):
  - `inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`
- `compactionCount`: wie oft die Auto-Kompaktierung fuer diesen Session-Key abgeschlossen wurde
- `memoryFlushAt`: Zeitstempel fuer den letzten Pre-Compaction-Speicher-Flush
- `memoryFlushCompactionCount`: Kompaktierungszaehler, als der letzte Flush lief

Der Store ist sicher zu bearbeiten, aber das Gateway ist die Autoritaet: Es kann Eintraege neu schreiben oder rehydrieren, waehrend Sessions laufen.

---

## Transkriptstruktur (`*.jsonl`)

Transkripte werden vom `@mariozechner/pi-coding-agent` seines `SessionManager` verwaltet.

Die Datei ist JSONL:

- Erste Zeile: Session-Header (`type: "session"`, enthaelt `id`, `cwd`, `timestamp`, optional `parentSession`)
- Danach: Session-Eintraege mit `id` + `parentId` (Baum)

Bemerkenswerte Eintragstypen:

- `message`: User-/Assistant-/toolResult-Nachrichten
- `custom_message`: von Erweiterungen injizierte Nachrichten, die _in_ den Modellkontext eingehen (koennen in der UI verborgen sein)
- `custom`: Erweiterungszustand, der _nicht_ in den Modellkontext eingeht
- `compaction`: persistierte Kompaktierungszusammenfassung mit `firstKeptEntryId` und `tokensBefore`
- `branch_summary`: persistierte Zusammenfassung beim Navigieren eines Baumzweigs

OpenClaw „korrigiert“ Transkripte bewusst **nicht**; das Gateway verwendet `SessionManager`, um sie zu lesen/schreiben.

---

## Kontextfenster vs. erfasste Tokens

Zwei unterschiedliche Konzepte sind relevant:

1. **Modell-Kontextfenster**: harte Grenze pro Modell (Tokens, die fuer das Modell sichtbar sind)
2. **Session-Store-Zaehler**: rollierende Statistiken, die in `sessions.json` geschrieben werden (verwendet fuer /status und Dashboards)

Wenn Sie Limits tunen:

- Das Kontextfenster stammt aus dem Modellkatalog (und kann per Konfiguration ueberschrieben werden).
- `contextTokens` im Store ist ein Laufzeit-Schaetz-/Reporting-Wert; behandeln Sie ihn nicht als strikte Garantie.

Weitere Details unter [/token-use](/token-use).

---

## Kompaktierung: was sie ist

Kompaktierung fasst aeltere Konversationen in einem persistenten `compaction`-Eintrag im Transkript zusammen und behaelt aktuelle Nachrichten intakt.

Nach der Kompaktierung sehen kuenftige Turns:

- Die Kompaktierungszusammenfassung
- Nachrichten nach `firstKeptEntryId`

Kompaktierung ist **persistent** (anders als Session-Pruning). Siehe [/concepts/session-pruning](/concepts/session-pruning).

---

## Wann Auto-Kompaktierung ausgeloest wird (Pi-Runtime)

Im eingebetteten Pi-Agenten wird Auto-Kompaktierung in zwei Faellen ausgeloest:

1. **Overflow-Recovery**: Das Modell gibt einen Kontext-Overflow-Fehler zurueck → kompaktieren → erneut versuchen.
2. **Schwellenwert-Pflege**: Nach einem erfolgreichen Turn, wenn:

`contextTokens > contextWindow - reserveTokens`

Dabei gilt:

- `contextWindow` ist das Kontextfenster des Modells
- `reserveTokens` ist der reservierte Headroom fuer Prompts + die naechste Modell-Ausgabe

Dies sind Pi-Runtime-Semantiken (OpenClaw konsumiert die Events, aber Pi entscheidet, wann kompaktieren wird).

---

## Kompaktierungs-Einstellungen (`reserveTokens`, `keepRecentTokens`)

Die Kompaktierungs-Einstellungen von Pi liegen in den Pi-Einstellungen:

```json5
{
  compaction: {
    enabled: true,
    reserveTokens: 16384,
    keepRecentTokens: 20000,
  },
}
```

OpenClaw erzwingt zusaetzlich eine Sicherheitsuntergrenze fuer eingebettete Runs:

- Wenn `compaction.reserveTokens < reserveTokensFloor`, hebt OpenClaw ihn an.
- Standard-Untergrenze ist `20000` Tokens.
- Setzen Sie `agents.defaults.compaction.reserveTokensFloor: 0`, um die Untergrenze zu deaktivieren.
- Wenn er bereits hoeher ist, laesst OpenClaw ihn unveraendert.

Warum: Genuegend Headroom fuer mehrturniges „Housekeeping“ (wie Speicher-Schreibvorgaenge) lassen, bevor Kompaktierung unvermeidlich wird.

Implementierung: `ensurePiCompactionReserveTokens()` in `src/agents/pi-settings.ts`
(aufgerufen von `src/agents/pi-embedded-runner.ts`).

---

## Nutzersichtbare Oberflaechen

Sie koennen Kompaktierung und Session-Status beobachten ueber:

- `/status` (in jeder Chat-Session)
- `openclaw status` (CLI)
- `openclaw sessions` / `sessions --json`
- Verbose-Modus: `🧹 Auto-compaction complete` + Kompaktierungszaehler

---

## Stilles Housekeeping (`NO_REPLY`)

OpenClaw unterstuetzt „stille“ Turns fuer Hintergrundaufgaben, bei denen der Nutzer keine Zwischen-Ausgaben sehen soll.

Konvention:

- Der Assistant beginnt seine Ausgabe mit `NO_REPLY`, um „keine Antwort an den Nutzer ausliefern“ zu signalisieren.
- OpenClaw entfernt/unterdrueckt dies in der Auslieferungsschicht.

Ab `2026.1.10` unterdrueckt OpenClaw ausserdem **Draft-/Typing-Streaming**, wenn ein partieller Chunk mit `NO_REPLY` beginnt, sodass stille Operationen keine partiellen Ausgaben mitten im Turn leaken.

---

## Pre-Compaction-„Memory Flush“ (implementiert)

Ziel: Bevor Auto-Kompaktierung stattfindet, einen stillen agentischen Turn ausfuehren, der dauerhaften Zustand auf die Festplatte schreibt (z. B. `memory/YYYY-MM-DD.md` im Agent-Workspace), sodass Kompaktierung keinen kritischen Kontext loeschen kann.

OpenClaw verwendet den **Pre-Threshold-Flush**-Ansatz:

1. Session-Kontextnutzung ueberwachen.
2. Wenn sie einen „Soft Threshold“ (unterhalb von Pis Kompaktierungsschwelle) ueberschreitet, einen stillen „write memory now“-Direktive an den Agenten ausfuehren.
3. `NO_REPLY` verwenden, sodass der Nutzer nichts sieht.

Konfiguration (`agents.defaults.compaction.memoryFlush`):

- `enabled` (Standard: `true`)
- `softThresholdTokens` (Standard: `4000`)
- `prompt` (User-Nachricht fuer den Flush-Turn)
- `systemPrompt` (zusaetzlicher System-Prompt, der fuer den Flush-Turn angehaengt wird)

Hinweise:

- Der Standard-Prompt/System-Prompt enthaelt einen `NO_REPLY`-Hinweis zur Unterdrueckung der Auslieferung.
- Der Flush laeuft einmal pro Kompaktierungszyklus (getrackt in `sessions.json`).
- Der Flush laeuft nur fuer eingebettete Pi-Sessions (CLI-Backends ueberspringen ihn).
- Der Flush wird uebersprungen, wenn der Session-Workspace schreibgeschuetzt ist (`workspaceAccess: "ro"` oder `"none"`).
- Siehe [Memory](/concepts/memory) fuer das Workspace-Dateilayout und Schreibmuster.

Pi stellt ausserdem einen `session_before_compact`-Hook in der Extension-API bereit, aber OpenClaws Flush-Logik lebt derzeit auf der Gateway-Seite.

---

## Checkliste zur Fehlerbehebung

- Session-Key falsch? Beginnen Sie mit [/concepts/session](/concepts/session) und bestaetigen Sie den `sessionKey` in `/status`.
- Store vs. Transkript stimmt nicht ueberein? Bestaetigen Sie den Gateway-Host und den Store-Pfad aus `openclaw status`.
- Kompaktierungs-Spam? Pruefen Sie:
  - Modell-Kontextfenster (zu klein)
  - Kompaktierungs-Einstellungen (`reserveTokens` zu hoch fuer das Modellfenster kann fruehere Kompaktierung verursachen)
  - Tool-Result-Bloat: Session-Pruning aktivieren/justieren
- Stille Turns leaken? Bestaetigen Sie, dass die Antwort mit `NO_REPLY` (exaktes Token) beginnt und Sie auf einem Build sind, der den Streaming-Unterdrueckungs-Fix enthaelt.
