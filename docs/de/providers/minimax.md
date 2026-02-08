---
summary: "MiniMax M2.1 in OpenClaw verwenden"
read_when:
  - Sie möchten MiniMax-Modelle in OpenClaw nutzen
  - Sie benötigen Anleitungen zur Einrichtung von MiniMax
title: "MiniMax"
x-i18n:
  source_path: providers/minimax.md
  source_hash: 5bbd47fa3327e40c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:18Z
---

# MiniMax

MiniMax ist ein KI-Unternehmen, das die **M2/M2.1**‑Modellfamilie entwickelt. Die aktuelle,
auf Coding fokussierte Version ist **MiniMax M2.1** (23. Dezember 2025), entwickelt für
komplexe Aufgaben aus der Praxis.

Quelle: [MiniMax M2.1 Release Note](https://www.minimax.io/news/minimax-m21)

## Modellübersicht (M2.1)

MiniMax hebt folgende Verbesserungen in M2.1 hervor:

- Stärkeres **mehrsprachiges Coding** (Rust, Java, Go, C++, Kotlin, Objective‑C, TS/JS).
- Bessere **Web-/App‑Entwicklung** und ästhetische Ausgabequalität (einschließlich nativer Mobile‑Apps).
- Verbesserte Verarbeitung **zusammengesetzter Anweisungen** für Office‑ähnliche Workflows, aufbauend auf
  verschränktem Denken und integrierter Ausführung von Nebenbedingungen.
- **Kürzere Antworten** mit geringerem Token‑Verbrauch und schnelleren Iterationsschleifen.
- Stärkere **Kompatibilität mit Tool-/Agent‑Frameworks** und besseres Kontextmanagement (Claude Code,
  Droid/Factory AI, Cline, Kilo Code, Roo Code, BlackBox).
- Höherwertige **Dialog‑ und technische Schreibausgaben**.

## MiniMax M2.1 vs. MiniMax M2.1 Lightning

- **Geschwindigkeit:** Lightning ist die „schnelle“ Variante in der MiniMax‑Preisdokumentation.
- **Kosten:** Die Preise zeigen die gleichen Eingabekosten, aber Lightning hat höhere Ausgabekosten.
- **Routing im Coding‑Plan:** Das Lightning‑Backend ist im MiniMax‑Coding‑Plan nicht direkt verfügbar. MiniMax routet
  die meisten Anfragen automatisch zu Lightning, fällt jedoch bei Verkehrsspitzen auf das
  reguläre M2.1‑Backend zurück.

## Einrichtung auswählen

### MiniMax OAuth (Coding‑Plan) — empfohlen

**Am besten geeignet für:** schnelle Einrichtung mit dem MiniMax‑Coding‑Plan über OAuth, kein API‑Schlüssel erforderlich.

Aktivieren Sie das gebündelte OAuth‑Plugin und authentifizieren Sie sich:

```bash
openclaw plugins enable minimax-portal-auth  # skip if already loaded.
openclaw gateway restart  # restart if gateway is already running
openclaw onboard --auth-choice minimax-portal
```

Sie werden aufgefordert, einen Endpunkt auszuwählen:

- **Global** – Internationale Nutzer (`api.minimax.io`)
- **CN** – Nutzer in China (`api.minimaxi.com`)

Details finden Sie in der [MiniMax OAuth Plugin README](https://github.com/openclaw/openclaw/tree/main/extensions/minimax-portal-auth).

### MiniMax M2.1 (API‑Schlüssel)

**Am besten geeignet für:** gehostetes MiniMax mit Anthropic‑kompatibler API.

Konfiguration über die CLI:

- Führen Sie `openclaw configure` aus
- Wählen Sie **Model/auth**
- Wählen Sie **MiniMax M2.1**

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "minimax/MiniMax-M2.1" } } },
  models: {
    mode: "merge",
    providers: {
      minimax: {
        baseUrl: "https://api.minimax.io/anthropic",
        apiKey: "${MINIMAX_API_KEY}",
        api: "anthropic-messages",
        models: [
          {
            id: "MiniMax-M2.1",
            name: "MiniMax M2.1",
            reasoning: false,
            input: ["text"],
            cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### MiniMax M2.1 als Fallback (Opus primär)

**Am besten geeignet für:** Opus 4.6 als primäres Modell beibehalten und bei Bedarf auf MiniMax M2.1 ausweichen.

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": { alias: "opus" },
        "minimax/MiniMax-M2.1": { alias: "minimax" },
      },
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["minimax/MiniMax-M2.1"],
      },
    },
  },
}
```

### Optional: Lokal über LM Studio (manuell)

**Am besten geeignet für:** lokale Inferenz mit LM Studio.
Wir haben starke Ergebnisse mit MiniMax M2.1 auf leistungsstarker Hardware (z. B.
Desktop/Server) unter Verwendung des lokalen Servers von LM Studio beobachtet.

Manuelle Konfiguration über `openclaw.json`:

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: { "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" } },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## Konfiguration über `openclaw configure`

Verwenden Sie den interaktiven Konfigurationsassistenten, um MiniMax einzurichten, ohne JSON zu bearbeiten:

1. Führen Sie `openclaw configure` aus.
2. Wählen Sie **Model/auth**.
3. Wählen Sie **MiniMax M2.1**.
4. Wählen Sie bei Aufforderung Ihr Standardmodell.

## Konfigurationsoptionen

- `models.providers.minimax.baseUrl`: bevorzugen Sie `https://api.minimax.io/anthropic` (Anthropic‑kompatibel); `https://api.minimax.io/v1` ist optional für OpenAI‑kompatible Payloads.
- `models.providers.minimax.api`: bevorzugen Sie `anthropic-messages`; `openai-completions` ist optional für OpenAI‑kompatible Payloads.
- `models.providers.minimax.apiKey`: MiniMax‑API‑Schlüssel (`MINIMAX_API_KEY`).
- `models.providers.minimax.models`: definieren Sie `id`, `name`, `reasoning`, `contextWindow`, `maxTokens`, `cost`.
- `agents.defaults.models`: Aliase für Modelle definieren, die Sie in der Allowlist haben möchten.
- `models.mode`: behalten Sie `merge` bei, wenn Sie MiniMax zusätzlich zu den integrierten Modellen hinzufügen möchten.

## Hinweise

- Modell‑Referenzen sind `minimax/<model>`.
- Coding‑Plan‑Nutzungs‑API: `https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains` (erfordert einen Coding‑Plan‑Schlüssel).
- Aktualisieren Sie die Preiswerte in `models.json`, wenn Sie eine exakte Kostenverfolgung benötigen.
- Empfehlungslink für den MiniMax‑Coding‑Plan (10 % Rabatt): https://platform.minimax.io/subscribe/coding-plan?code=DbXJTRClnb&source=link
- Siehe [/concepts/model-providers](/concepts/model-providers) für Anbieterregeln.
- Verwenden Sie `openclaw models list` und `openclaw models set minimax/MiniMax-M2.1`, um zu wechseln.

## Fehlerbehebung

### „Unknown model: minimax/MiniMax-M2.1“

Dies bedeutet in der Regel, dass der **MiniMax‑Anbieter nicht konfiguriert** ist (kein Anbieter‑Eintrag
und kein MiniMax‑Authentifizierungsprofil/keine Umgebungsvariable gefunden). Eine Korrektur für diese
Erkennung ist in **2026.1.12** enthalten (zum Zeitpunkt des Schreibens noch unveröffentlicht). Beheben Sie das Problem durch:

- Upgrade auf **2026.1.12** (oder Ausführung aus dem Quellcode `main`), anschließend Neustart des Gateways.
- Ausführen von `openclaw configure` und Auswahl von **MiniMax M2.1**, oder
- Manuelles Hinzufügen des Blocks `models.providers.minimax`, oder
- Setzen von `MINIMAX_API_KEY` (oder eines MiniMax‑Authentifizierungsprofils), damit der Anbieter injiziert werden kann.

Stellen Sie sicher, dass die Modell‑ID **groß‑/kleinschreibungssensitiv** ist:

- `minimax/MiniMax-M2.1`
- `minimax/MiniMax-M2.1-lightning`

Überprüfen Sie anschließend erneut mit:

```bash
openclaw models list
```
