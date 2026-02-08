---
summary: "Pruefen, was Geld ausgeben kann, welche Schluessel verwendet werden und wie die Nutzung eingesehen wird"
read_when:
  - Sie moechten verstehen, welche Funktionen kostenpflichtige APIs aufrufen koennen
  - Sie muessen Schluessel, Kosten und Nutzungs-Sichtbarkeit pruefen
  - Sie erklaeren /status- oder /usage-Kostenberichte
title: "API-Nutzung und Kosten"
x-i18n:
  source_path: reference/api-usage-costs.md
  source_hash: 807d0d88801e919a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:27Z
---

# API-Nutzung & Kosten

Dieses Dokument listet **Funktionen, die API-Schluessel aufrufen koennen**, und wo deren Kosten erscheinen. Der Fokus liegt auf
OpenClaw-Funktionen, die Anbieter-Nutzung oder kostenpflichtige API-Aufrufe erzeugen koennen.

## Wo Kosten erscheinen (Chat + CLI)

**Kosten-Schnappschuss pro Sitzung**

- `/status` zeigt das aktuelle Sitzungsmodell, die Kontextnutzung und die Token der letzten Antwort.
- Wenn das Modell **API-Schluessel-Authentifizierung** verwendet, zeigt `/status` zusaetzlich die **geschaetzten Kosten** der letzten Antwort an.

**Kosten-Fusszeile pro Nachricht**

- `/usage full` fuegt jeder Antwort eine Nutzungs-Fusszeile hinzu, inklusive **geschaetzter Kosten** (nur bei API-Schluessel).
- `/usage tokens` zeigt nur Token; OAuth-Ablaufe blenden die Dollar-Kosten aus.

**CLI-Nutzungsfenster (Anbieter-Kontingente)**

- `openclaw status --usage` und `openclaw channels list` zeigen **Nutzungsfenster** der Anbieter
  (Kontingent-Schnappschuesse, keine Kosten pro Nachricht).

Siehe [Token use & costs](/token-use) fuer Details und Beispiele.

## Wie Schluessel gefunden werden

OpenClaw kann Zugangsdaten beziehen aus:

- **Auth-Profilen** (pro Agent, gespeichert in `auth-profiles.json`).
- **Umgebungsvariablen** (z. B. `OPENAI_API_KEY`, `BRAVE_API_KEY`, `FIRECRAWL_API_KEY`).
- **Konfiguration** (`models.providers.*.apiKey`, `tools.web.search.*`, `tools.web.fetch.firecrawl.*`,
  `memorySearch.*`, `talk.apiKey`).
- **Skills** (`skills.entries.<name>.apiKey`), die Schluessel in die Prozess-Umgebung des Skills exportieren koennen.

## Funktionen, die Schluessel ausgeben koennen

### 1) Kern-Modellantworten (Chat + Werkzeuge)

Jede Antwort oder jeder Werkzeugaufruf verwendet den **aktuellen Modellanbieter** (OpenAI, Anthropic usw.). Dies ist die
primaere Quelle fuer Nutzung und Kosten.

Siehe [Models](/providers/models) fuer die Preiskonfiguration und [Token use & costs](/token-use) fuer die Anzeige.

### 2) Medienverstaendnis (Audio/Bild/Video)

Eingehende Medien koennen vor der Antwort zusammengefasst oder transkribiert werden. Dies verwendet Modell-/Anbieter-APIs.

- Audio: OpenAI / Groq / Deepgram (jetzt **automatisch aktiviert**, wenn Schluessel vorhanden sind).
- Bild: OpenAI / Anthropic / Google.
- Video: Google.

Siehe [Media understanding](/nodes/media-understanding).

### 3) Gedaechtnis-Einbettungen + semantische Suche

Die semantische Gedaechtnissuche verwendet **Embedding-APIs**, wenn sie fuer entfernte Anbieter konfiguriert ist:

- `memorySearch.provider = "openai"` → OpenAI-Embeddings
- `memorySearch.provider = "gemini"` → Gemini-Embeddings
- Optionaler Rueckfall auf OpenAI, wenn lokale Embeddings fehlschlagen

Sie koennen es lokal halten mit `memorySearch.provider = "local"` (keine API-Nutzung).

Siehe [Memory](/concepts/memory).

### 4) Web-Suchwerkzeug (Brave / Perplexity ueber OpenRouter)

`web_search` verwendet API-Schluessel und kann Nutzungsgebuehren verursachen:

- **Brave Search API**: `BRAVE_API_KEY` oder `tools.web.search.apiKey`
- **Perplexity** (ueber OpenRouter): `PERPLEXITY_API_KEY` oder `OPENROUTER_API_KEY`

**Brave Free-Tier (grosszuegig):**

- **2.000 Anfragen/Monat**
- **1 Anfrage/Sekunde**
- **Kreditkarte erforderlich** zur Verifizierung (keine Belastung, ausser Sie upgraden)

Siehe [Web tools](/tools/web).

### 5) Web-Fetch-Werkzeug (Firecrawl)

`web_fetch` kann **Firecrawl** aufrufen, wenn ein API-Schluessel vorhanden ist:

- `FIRECRAWL_API_KEY` oder `tools.web.fetch.firecrawl.apiKey`

Wenn Firecrawl nicht konfiguriert ist, faellt das Werkzeug auf direktes Fetch + Readability zurueck (keine kostenpflichtige API).

Siehe [Web tools](/tools/web).

### 6) Anbieter-Nutzungs-Schnappschuesse (Status/Health)

Einige Statusbefehle rufen **Nutzungsendpunkte der Anbieter** auf, um Kontingentfenster oder den Authentifizierungsstatus anzuzeigen.
Dies sind in der Regel Aufrufe mit geringem Volumen, treffen aber dennoch Anbieter-APIs:

- `openclaw status --usage`
- `openclaw models status --json`

Siehe [Models CLI](/cli/models).

### 7) Zusammenfassung durch Kompaktions-Schutzmechanismus

Der Kompaktions-Schutzmechanismus kann den Sitzungsverlauf mit dem **aktuellen Modell** zusammenfassen, wodurch beim Ausfuehren
Anbieter-APIs aufgerufen werden.

Siehe [Session management + compaction](/reference/session-management-compaction).

### 8) Modell-Scan / -Probe

`openclaw models scan` kann OpenRouter-Modelle pruefen und verwendet `OPENROUTER_API_KEY`, wenn
die Probe aktiviert ist.

Siehe [Models CLI](/cli/models).

### 9) Talk (Sprache)

Der Talk-Modus kann **ElevenLabs** aufrufen, wenn konfiguriert:

- `ELEVENLABS_API_KEY` oder `talk.apiKey`

Siehe [Talk mode](/nodes/talk).

### 10) Skills (Drittanbieter-APIs)

Skills koennen `apiKey` in `skills.entries.<name>.apiKey` speichern. Wenn ein Skill diesen Schluessel fuer externe
APIs verwendet, koennen entsprechend dem Anbieter des Skills Kosten anfallen.

Siehe [Skills](/tools/skills).
