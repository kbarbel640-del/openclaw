---
summary: „Testkit: Unit-/E2E-/Live-Suiten, Docker-Runner und was jeder Test abdeckt“
read_when:
  - Ausführen von Tests lokal oder in CI
  - Hinzufügen von Regressionen für Modell-/Anbieter-Bugs
  - Debugging von Gateway- und Agent-Verhalten
title: „Tests“
x-i18n:
  source_path: testing.md
  source_hash: 7a23ced0e6e3be5e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:13Z
---

# Tests

OpenClaw hat drei Vitest-Suiten (Unit/Integration, E2E, Live) sowie eine kleine Auswahl an Docker-Runnern.

Dieses Dokument ist ein Leitfaden „wie wir testen“:

- Was jede Suite abdeckt (und was sie bewusst _nicht_ abdeckt)
- Welche Befehle für typische Workflows auszuführen sind (lokal, vor dem Push, Debugging)
- Wie Live-Tests Credentials finden und Modelle/Anbieter auswählen
- Wie Regressionen für reale Modell-/Anbieter-Probleme hinzugefügt werden

## Schnellstart

An den meisten Tagen:

- Vollständiges Gate (vor dem Push erwartet): `pnpm build && pnpm check && pnpm test`

Wenn Sie Tests anfassen oder zusätzliche Sicherheit möchten:

- Coverage-Gate: `pnpm test:coverage`
- E2E-Suite: `pnpm test:e2e`

Beim Debuggen realer Anbieter/Modelle (erfordert echte Credentials):

- Live-Suite (Modelle + Gateway-Werkzeug-/Image-Probes): `pnpm test:live`

Tipp: Wenn Sie nur einen einzelnen fehlschlagenden Fall benötigen, grenzen Sie Live-Tests bevorzugt über die unten beschriebenen Allowlist-Umgebungsvariablen ein.

## Test-Suiten (was wo läuft)

Stellen Sie sich die Suiten als „zunehmenden Realismus“ vor (und zunehmende Flakiness/Kosten):

### Unit / Integration (Standard)

- Befehl: `pnpm test`
- Konfiguration: `vitest.config.ts`
- Dateien: `src/**/*.test.ts`
- Umfang:
  - Reine Unit-Tests
  - In-Prozess-Integrationstests (Gateway-Auth, Routing, Tooling, Parsing, Konfiguration)
  - Deterministische Regressionen für bekannte Bugs
- Erwartungen:
  - Läuft in CI
  - Keine echten Keys erforderlich
  - Sollte schnell und stabil sein

### E2E (Gateway-Smoke)

- Befehl: `pnpm test:e2e`
- Konfiguration: `vitest.e2e.config.ts`
- Dateien: `src/**/*.e2e.test.ts`
- Umfang:
  - End-to-End-Verhalten des Gateways mit mehreren Instanzen
  - WebSocket-/HTTP-Oberflächen, Node-Pairing und umfangreicheres Networking
- Erwartungen:
  - Läuft in CI (wenn in der Pipeline aktiviert)
  - Keine echten Keys erforderlich
  - Mehr bewegliche Teile als Unit-Tests (kann langsamer sein)

### Live (reale Anbieter + reale Modelle)

- Befehl: `pnpm test:live`
- Konfiguration: `vitest.live.config.ts`
- Dateien: `src/**/*.live.test.ts`
- Standard: **aktiviert** durch `pnpm test:live` (setzt `OPENCLAW_LIVE_TEST=1`)
- Umfang:
  - „Funktioniert dieser Anbieter/dieses Modell _heute_ tatsächlich mit echten Credentials?“
  - Erkennen von Anbieter-Formatänderungen, Tool-Calling-Eigenheiten, Auth-Problemen und Rate-Limit-Verhalten
- Erwartungen:
  - Absichtlich nicht CI-stabil (reale Netzwerke, reale Anbieter-Richtlinien, Kontingente, Ausfälle)
  - Kostet Geld / verbraucht Rate-Limits
  - Bevorzugen Sie eingegrenzte Teilmengen statt „alles“
  - Live-Läufe beziehen `~/.profile`, um fehlende API-Keys zu übernehmen
  - Anthropic-Key-Rotation: Setzen Sie `OPENCLAW_LIVE_ANTHROPIC_KEYS="sk-...,sk-..."` (oder `OPENCLAW_LIVE_ANTHROPIC_KEY=sk-...`) oder mehrere `ANTHROPIC_API_KEY*`-Variablen; Tests wiederholen sich bei Rate-Limits

## Welche Suite sollte ich ausführen?

Nutzen Sie diese Entscheidungstabelle:

- Logik/Tests bearbeiten: `pnpm test` ausführen (und `pnpm test:coverage`, wenn Sie viel geändert haben)
- Gateway-Networking / WS-Protokoll / Pairing anfassen: `pnpm test:e2e` hinzufügen
- Debugging „mein Bot ist down“ / anbieter­spezifische Fehler / Tool-Calling: eine eingegrenzte `pnpm test:live` ausführen

## Live: Modell-Smoke (Profil-Keys)

Live-Tests sind in zwei Ebenen aufgeteilt, um Fehler isolieren zu können:

- „Direktes Modell“ zeigt, ob der Anbieter/das Modell mit dem gegebenen Key überhaupt antworten kann.
- „Gateway-Smoke“ zeigt, ob die vollständige Gateway+Agent-Pipeline für dieses Modell funktioniert (Sitzungen, Historie, Werkzeuge, Sandbox-Richtlinie usw.).

### Ebene 1: Direkte Modell-Completion (kein Gateway)

- Test: `src/agents/models.profiles.live.test.ts`
- Ziel:
  - Erkannte Modelle auflisten
  - Mit `getApiKeyForModel` Modelle auswählen, für die Sie Credentials haben
  - Eine kleine Completion pro Modell ausführen (und gezielte Regressionen, wo nötig)
- Aktivieren:
  - `pnpm test:live` (oder `OPENCLAW_LIVE_TEST=1`, wenn Vitest direkt aufgerufen wird)
- Setzen Sie `OPENCLAW_LIVE_MODELS=modern` (oder `all`, Alias für modern), um diese Suite tatsächlich auszuführen; andernfalls wird sie übersprungen, um `pnpm test:live` auf Gateway-Smoke zu fokussieren
- Modelle auswählen:
  - `OPENCLAW_LIVE_MODELS=modern`, um die moderne Allowlist auszuführen (Opus/Sonnet/Haiku 4.5, GPT-5.x + Codex, Gemini 3, GLM 4.7, MiniMax M2.1, Grok 4)
  - `OPENCLAW_LIVE_MODELS=all` ist ein Alias für die moderne Allowlist
  - oder `OPENCLAW_LIVE_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,..."` (Komma-Allowlist)
- Anbieter auswählen:
  - `OPENCLAW_LIVE_PROVIDERS="google,google-antigravity,google-gemini-cli"` (Komma-Allowlist)
- Herkunft der Keys:
  - Standardmäßig: Profil-Store und Env-Fallbacks
  - Setzen Sie `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1`, um **nur** den Profil-Store zu erzwingen
- Warum es das gibt:
  - Trennt „Anbieter-API ist kaputt / Key ist ungültig“ von „Gateway-Agent-Pipeline ist kaputt“
  - Enthält kleine, isolierte Regressionen (Beispiel: OpenAI Responses/Codex Responses Reasoning-Replay + Tool-Call-Flows)

### Ebene 2: Gateway + Dev-Agent-Smoke (das, was „@openclaw“ tatsächlich tut)

- Test: `src/gateway/gateway-models.profiles.live.test.ts`
- Ziel:
  - Ein In-Prozess-Gateway starten
  - Eine `agent:dev:*`-Sitzung erstellen/patchen (Modell-Override pro Lauf)
  - Modelle mit Keys iterieren und Folgendes prüfen:
    - „Sinnvolle“ Antwort (keine Tools)
    - Eine echte Tool-Invocation funktioniert (Read-Probe)
    - Optionale zusätzliche Tool-Probes (Exec+Read-Probe)
    - OpenAI-Regressionspfade (nur Tool-Call → Follow-up) funktionieren weiterhin
- Probe-Details (damit Sie Fehler schnell erklären können):
  - `read`-Probe: Der Test schreibt eine Nonce-Datei in den Workspace und bittet den Agenten, sie zu `read` und die Nonce zurückzugeben.
  - `exec+read`-Probe: Der Test bittet den Agenten, eine Nonce per `exec` in eine Temp-Datei zu schreiben und sie anschließend zu `read`.
  - Image-Probe: Der Test hängt ein generiertes PNG (Katze + randomisierter Code) an und erwartet, dass das Modell `cat <CODE>` zurückgibt.
  - Implementierungsreferenz: `src/gateway/gateway-models.profiles.live.test.ts` und `src/gateway/live-image-probe.ts`.
- Aktivieren:
  - `pnpm test:live` (oder `OPENCLAW_LIVE_TEST=1`, wenn Vitest direkt aufgerufen wird)
- Modelle auswählen:
  - Standard: moderne Allowlist (Opus/Sonnet/Haiku 4.5, GPT-5.x + Codex, Gemini 3, GLM 4.7, MiniMax M2.1, Grok 4)
  - `OPENCLAW_LIVE_GATEWAY_MODELS=all` ist ein Alias für die moderne Allowlist
  - Oder `OPENCLAW_LIVE_GATEWAY_MODELS="provider/model"` (oder Komma-Liste) setzen, um einzugrenzen
- Anbieter auswählen (vermeiden Sie „OpenRouter alles“):
  - `OPENCLAW_LIVE_GATEWAY_PROVIDERS="google,google-antigravity,google-gemini-cli,openai,anthropic,zai,minimax"` (Komma-Allowlist)
- Tool- + Image-Probes sind in diesem Live-Test immer aktiv:
  - `read`-Probe + `exec+read`-Probe (Tool-Stress)
  - Image-Probe läuft, wenn das Modell Image-Input-Unterstützung meldet
  - Ablauf (auf hoher Ebene):
    - Test erzeugt ein winziges PNG mit „CAT“ + Zufallscode (`src/gateway/live-image-probe.ts`)
    - Sendet es via `agent` `attachments: [{ mimeType: "image/png", content: "<base64>" }]`
    - Gateway parst Anhänge in `images[]` (`src/gateway/server-methods/agent.ts` + `src/gateway/chat-attachments.ts`)
    - Eingebetteter Agent leitet eine multimodale User-Nachricht an das Modell weiter
    - Assertion: Antwort enthält `cat` + den Code (OCR-Toleranz: kleine Fehler erlaubt)

Tipp: Um zu sehen, was Sie auf Ihrer Maschine testen können (und die exakten `provider/model`-IDs), führen Sie aus:

```bash
openclaw models list
openclaw models list --json
```

## Live: Anthropic-Setup-Token-Smoke

- Test: `src/agents/anthropic.setup-token.live.test.ts`
- Ziel: Verifizieren, dass ein Claude-Code-CLI-Setup-Token (oder ein eingefügtes Setup-Token-Profil) einen Anthropic-Prompt abschließen kann.
- Aktivieren:
  - `pnpm test:live` (oder `OPENCLAW_LIVE_TEST=1`, wenn Vitest direkt aufgerufen wird)
  - `OPENCLAW_LIVE_SETUP_TOKEN=1`
- Token-Quellen (eine auswählen):
  - Profil: `OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test`
  - Raw-Token: `OPENCLAW_LIVE_SETUP_TOKEN_VALUE=sk-ant-oat01-...`
- Modell-Override (optional):
  - `OPENCLAW_LIVE_SETUP_TOKEN_MODEL=anthropic/claude-opus-4-6`

Setup-Beispiel:

```bash
openclaw models auth paste-token --provider anthropic --profile-id anthropic:setup-token-test
OPENCLAW_LIVE_SETUP_TOKEN=1 OPENCLAW_LIVE_SETUP_TOKEN_PROFILE=anthropic:setup-token-test pnpm test:live src/agents/anthropic.setup-token.live.test.ts
```

## Live: CLI-Backend-Smoke (Claude Code CLI oder andere lokale CLIs)

- Test: `src/gateway/gateway-cli-backend.live.test.ts`
- Ziel: Validieren der Gateway- + Agent-Pipeline mit einem lokalen CLI-Backend, ohne Ihre Standardkonfiguration anzufassen.
- Aktivieren:
  - `pnpm test:live` (oder `OPENCLAW_LIVE_TEST=1`, wenn Vitest direkt aufgerufen wird)
  - `OPENCLAW_LIVE_CLI_BACKEND=1`
- Standardwerte:
  - Modell: `claude-cli/claude-sonnet-4-5`
  - Befehl: `claude`
  - Argumente: `["-p","--output-format","json","--dangerously-skip-permissions"]`
- Overrides (optional):
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-opus-4-6"`
  - `OPENCLAW_LIVE_CLI_BACKEND_MODEL="codex-cli/gpt-5.3-codex"`
  - `OPENCLAW_LIVE_CLI_BACKEND_COMMAND="/full/path/to/claude"`
  - `OPENCLAW_LIVE_CLI_BACKEND_ARGS='["-p","--output-format","json","--permission-mode","bypassPermissions"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_CLEAR_ENV='["ANTHROPIC_API_KEY","ANTHROPIC_API_KEY_OLD"]'`
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_PROBE=1`, um einen echten Image-Anhang zu senden (Pfade werden in den Prompt injiziert).
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_ARG="--image"`, um Image-Dateipfade als CLI-Argumente statt Prompt-Injektion zu übergeben.
  - `OPENCLAW_LIVE_CLI_BACKEND_IMAGE_MODE="repeat"` (oder `"list"`), um zu steuern, wie Image-Argumente übergeben werden, wenn `IMAGE_ARG` gesetzt ist.
  - `OPENCLAW_LIVE_CLI_BACKEND_RESUME_PROBE=1`, um einen zweiten Turn zu senden und den Resume-Flow zu validieren.
- `OPENCLAW_LIVE_CLI_BACKEND_DISABLE_MCP_CONFIG=0`, um die Claude-Code-CLI-MCP-Konfiguration aktiviert zu lassen (Standard deaktiviert MCP-Konfiguration mit einer temporären leeren Datei).

Beispiel:

```bash
OPENCLAW_LIVE_CLI_BACKEND=1 \
  OPENCLAW_LIVE_CLI_BACKEND_MODEL="claude-cli/claude-sonnet-4-5" \
  pnpm test:live src/gateway/gateway-cli-backend.live.test.ts
```

### Empfohlene Live-Rezepte

Eingeschränkte, explizite Allowlists sind am schnellsten und am wenigsten flaky:

- Einzelnes Modell, direkt (kein Gateway):
  - `OPENCLAW_LIVE_MODELS="openai/gpt-5.2" pnpm test:live src/agents/models.profiles.live.test.ts`

- Einzelnes Modell, Gateway-Smoke:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Tool-Calling über mehrere Anbieter:
  - `OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,anthropic/claude-opus-4-6,google/gemini-3-flash-preview,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

- Google-Fokus (Gemini-API-Key + Antigravity):
  - Gemini (API-Key): `OPENCLAW_LIVE_GATEWAY_MODELS="google/gemini-3-flash-preview" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`
  - Antigravity (OAuth): `OPENCLAW_LIVE_GATEWAY_MODELS="google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-pro-high" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

Hinweise:

- `google/...` verwendet die Gemini API (API-Key).
- `google-antigravity/...` verwendet die Antigravity-OAuth-Bridge (Cloud-Code-Assist-ähnlicher Agent-Endpunkt).
- `google-gemini-cli/...` verwendet die lokale Gemini-CLI auf Ihrer Maschine (separate Auth + Tooling-Eigenheiten).
- Gemini API vs. Gemini CLI:
  - API: OpenClaw ruft Googles gehostete Gemini-API über HTTP auf (API-Key/Profil-Auth); das ist es, was die meisten Nutzer mit „Gemini“ meinen.
  - CLI: OpenClaw ruft ein lokales `gemini`-Binary auf; es hat eigene Authentifizierung und kann sich unterschiedlich verhalten (Streaming/Tool-Support/Versionsdrift).

## Live: Modell-Matrix (was wir abdecken)

Es gibt keine feste „CI-Modellliste“ (Live ist Opt-in), aber dies sind die **empfohlenen** Modelle, die regelmäßig auf einer Entwickler-Maschine mit Keys abgedeckt werden sollten.

### Moderner Smoke-Set (Tool-Calling + Image)

Dies ist der „Common Models“-Lauf, den wir funktionsfähig halten erwarten:

- OpenAI (nicht Codex): `openai/gpt-5.2` (optional: `openai/gpt-5.1`)
- OpenAI Codex: `openai-codex/gpt-5.3-codex` (optional: `openai-codex/gpt-5.3-codex-codex`)
- Anthropic: `anthropic/claude-opus-4-6` (oder `anthropic/claude-sonnet-4-5`)
- Google (Gemini API): `google/gemini-3-pro-preview` und `google/gemini-3-flash-preview` (ältere Gemini-2.x-Modelle vermeiden)
- Google (Antigravity): `google-antigravity/claude-opus-4-5-thinking` und `google-antigravity/gemini-3-flash`
- Z.AI (GLM): `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

Gateway-Smoke mit Tools + Image ausführen:
`OPENCLAW_LIVE_GATEWAY_MODELS="openai/gpt-5.2,openai-codex/gpt-5.3-codex,anthropic/claude-opus-4-6,google/gemini-3-pro-preview,google/gemini-3-flash-preview,google-antigravity/claude-opus-4-5-thinking,google-antigravity/gemini-3-flash,zai/glm-4.7,minimax/minimax-m2.1" pnpm test:live src/gateway/gateway-models.profiles.live.test.ts`

### Baseline: Tool-Calling (Read + optional Exec)

Wählen Sie mindestens eines pro Anbieter-Familie:

- OpenAI: `openai/gpt-5.2` (oder `openai/gpt-5-mini`)
- Anthropic: `anthropic/claude-opus-4-6` (oder `anthropic/claude-sonnet-4-5`)
- Google: `google/gemini-3-flash-preview` (oder `google/gemini-3-pro-preview`)
- Z.AI (GLM): `zai/glm-4.7`
- MiniMax: `minimax/minimax-m2.1`

Optionale zusätzliche Abdeckung (nice to have):

- xAI: `xai/grok-4` (oder neuestes verfügbares)
- Mistral: `mistral/`… (wählen Sie ein „tools“-fähiges Modell, das Sie aktiviert haben)
- Cerebras: `cerebras/`… (falls Sie Zugriff haben)
- LM Studio: `lmstudio/`… (lokal; Tool-Calling hängt vom API-Modus ab)

### Vision: Image-Senden (Anhang → multimodale Nachricht)

Nehmen Sie mindestens ein image-fähiges Modell in `OPENCLAW_LIVE_GATEWAY_MODELS` auf (Claude-/Gemini-/OpenAI-vision-fähige Varianten usw.), um die Image-Probe auszuführen.

### Aggregatoren / alternative Gateways

Wenn Sie Keys aktiviert haben, unterstützen wir außerdem Tests über:

- OpenRouter: `openrouter/...` (Hunderte Modelle; verwenden Sie `openclaw models scan`, um Tool-+Image-fähige Kandidaten zu finden)
- OpenCode Zen: `opencode/...` (Auth über `OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY`)

Weitere Anbieter, die Sie in die Live-Matrix aufnehmen können (falls Sie Credentials/Konfiguration haben):

- Built-in: `openai`, `openai-codex`, `anthropic`, `google`, `google-vertex`, `google-antigravity`, `google-gemini-cli`, `zai`, `openrouter`, `opencode`, `xai`, `groq`, `cerebras`, `mistral`, `github-copilot`
- Über `models.providers` (benutzerdefinierte Endpunkte): `minimax` (Cloud/API) sowie jeder OpenAI-/Anthropic-kompatible Proxy (LM Studio, vLLM, LiteLLM usw.)

Tipp: Versuchen Sie nicht, „alle Modelle“ in Docs fest zu verdrahten. Die maßgebliche Liste ist das, was `discoverModels(...)` auf Ihrer Maschine zurückgibt, plus die verfügbaren Keys.

## Credentials (niemals committen)

Live-Tests finden Credentials auf die gleiche Weise wie die CLI. Praktische Konsequenzen:

- Wenn die CLI funktioniert, sollten Live-Tests dieselben Keys finden.
- Wenn ein Live-Test „keine Credentials“ meldet, debuggen Sie genauso wie bei `openclaw models list` / Modell-Auswahl.

- Profil-Store: `~/.openclaw/credentials/` (bevorzugt; das ist mit „Profil-Keys“ in den Tests gemeint)
- Konfiguration: `~/.openclaw/openclaw.json` (oder `OPENCLAW_CONFIG_PATH`)

Wenn Sie sich auf Env-Keys verlassen möchten (z. B. exportiert in Ihrem `~/.profile`), führen Sie lokale Tests nach `source ~/.profile` aus oder verwenden Sie die Docker-Runner unten (sie können `~/.profile` in den Container mounten).

## Deepgram Live (Audio-Transkription)

- Test: `src/media-understanding/providers/deepgram/audio.live.test.ts`
- Aktivieren: `DEEPGRAM_API_KEY=... DEEPGRAM_LIVE_TEST=1 pnpm test:live src/media-understanding/providers/deepgram/audio.live.test.ts`

## Docker-Runner (optionale „funktioniert unter Linux“-Checks)

Diese führen `pnpm test:live` im Repo-Docker-Image aus, mounten Ihr lokales Konfigurationsverzeichnis und den Workspace (und sourcen `~/.profile`, falls gemountet):

- Direkte Modelle: `pnpm test:docker:live-models` (Skript: `scripts/test-live-models-docker.sh`)
- Gateway + Dev-Agent: `pnpm test:docker:live-gateway` (Skript: `scripts/test-live-gateway-models-docker.sh`)
- Onboarding-Assistent (TTY, vollständiges Scaffolding): `pnpm test:docker:onboard` (Skript: `scripts/e2e/onboard-docker.sh`)
- Gateway-Networking (zwei Container, WS-Auth + Health): `pnpm test:docker:gateway-network` (Skript: `scripts/e2e/gateway-network-docker.sh`)
- Plugins (Custom-Extension-Load + Registry-Smoke): `pnpm test:docker:plugins` (Skript: `scripts/e2e/plugins-docker.sh`)

Nützliche Umgebungsvariablen:

- `OPENCLAW_CONFIG_DIR=...` (Standard: `~/.openclaw`) gemountet nach `/home/node/.openclaw`
- `OPENCLAW_WORKSPACE_DIR=...` (Standard: `~/.openclaw/workspace`) gemountet nach `/home/node/.openclaw/workspace`
- `OPENCLAW_PROFILE_FILE=...` (Standard: `~/.profile`) gemountet nach `/home/node/.profile` und vor dem Ausführen der Tests gesourct
- `OPENCLAW_LIVE_GATEWAY_MODELS=...` / `OPENCLAW_LIVE_MODELS=...` zur Eingrenzung des Laufs
- `OPENCLAW_LIVE_REQUIRE_PROFILE_KEYS=1`, um sicherzustellen, dass Credentials aus dem Profil-Store stammen (nicht aus Env)

## Docs-Sanity

Führen Sie nach Doc-Änderungen die Docs-Checks aus: `pnpm docs:list`.

## Offline-Regression (CI-sicher)

Dies sind „reale Pipeline“-Regressionen ohne reale Anbieter:

- Gateway-Tool-Calling (Mock OpenAI, reales Gateway + Agent-Loop): `src/gateway/gateway.tool-calling.mock-openai.test.ts`
- Gateway-Assistent (WS `wizard.start`/`wizard.next`, schreibt Konfiguration + Auth erzwungen): `src/gateway/gateway.wizard.e2e.test.ts`

## Agent-Zuverlässigkeits-Evals (Skills)

Wir haben bereits einige CI-sichere Tests, die sich wie „Agent-Zuverlässigkeits-Evals“ verhalten:

- Mock-Tool-Calling durch den realen Gateway- + Agent-Loop (`src/gateway/gateway.tool-calling.mock-openai.test.ts`).
- End-to-End-Assistenten-Flows, die Sitzungs-Verdrahtung und Konfigurationswirkungen validieren (`src/gateway/gateway.wizard.e2e.test.ts`).

Was für Skills noch fehlt (siehe [Skills](/tools/skills)):

- **Decisioning:** Wenn Skills im Prompt gelistet sind, wählt der Agent den richtigen Skill (oder vermeidet irrelevante)?
- **Compliance:** Liest der Agent `SKILL.md` vor der Nutzung und befolgt die erforderlichen Schritte/Argumente?
- **Workflow-Verträge:** Multi-Turn-Szenarien, die Tool-Reihenfolge, Sitzungs-Historien-Übernahme und Sandbox-Grenzen prüfen.

Zukünftige Evals sollten zunächst deterministisch bleiben:

- Ein Szenario-Runner mit Mock-Anbietern, um Tool-Calls + Reihenfolge, Skill-Datei-Lesungen und Sitzungs-Verdrahtung zu prüfen.
- Eine kleine Suite skill-fokussierter Szenarien (verwenden vs. vermeiden, Gating, Prompt-Injection).
- Optionale Live-Evals (Opt-in, Env-gated) erst, nachdem die CI-sichere Suite steht.

## Regressionen hinzufügen (Leitfaden)

Wenn Sie ein Anbieter-/Modell-Problem beheben, das in Live entdeckt wurde:

- Fügen Sie, wenn möglich, eine CI-sichere Regression hinzu (Mock/Stub des Anbieters oder Erfassen der exakten Request-Shape-Transformation)
- Wenn es inhärent nur Live ist (Rate-Limits, Auth-Richtlinien), halten Sie den Live-Test eng und Opt-in über Env-Variablen
- Bevorzugen Sie die kleinste Ebene, die den Bug abfängt:
  - Bug in Anbieter-Request-Konvertierung/-Replay → Direkte-Modelle-Test
  - Bug in Gateway-Sitzung/Historie/Tool-Pipeline → Gateway-Live-Smoke oder CI-sicherer Gateway-Mock-Test
