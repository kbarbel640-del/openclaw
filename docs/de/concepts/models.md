---
summary: "Models CLI: auflisten, festlegen, Aliasse, Fallbacks, Scan, Status"
read_when:
  - Hinzufuegen oder Aendern der Models CLI (models list/set/scan/aliases/fallbacks)
  - Aendern des Fallback-Verhaltens oder der Auswahl-UX von Modellen
  - Aktualisieren von Model-Scan-Probes (tools/images)
title: "Models CLI"
x-i18n:
  source_path: concepts/models.md
  source_hash: c4eeb0236c645b55
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:10Z
---

# Models CLI

Siehe [/concepts/model-failover](/concepts/model-failover) fuer die Rotation von Auth-Profilen,
Cooldowns und wie diese mit Fallbacks zusammenspielen.
Schneller Anbieterueberblick + Beispiele: [/concepts/model-providers](/concepts/model-providers).

## Wie die Modellauswahl funktioniert

OpenClaw waehlt Modelle in dieser Reihenfolge aus:

1. **Primaeres** Modell (`agents.defaults.model.primary` oder `agents.defaults.model`).
2. **Fallbacks** in `agents.defaults.model.fallbacks` (in Reihenfolge).
3. **Provider-Auth-Failover** erfolgt innerhalb eines Anbieters, bevor zum
   naechsten Modell gewechselt wird.

Verwandt:

- `agents.defaults.models` ist die Allowlist/der Katalog der Modelle, die OpenClaw verwenden darf (inklusive Aliasse).
- `agents.defaults.imageModel` wird **nur dann** verwendet, wenn das primaere Modell keine Bilder akzeptieren kann.
- Pro-Agent-Standards koennen `agents.defaults.model` ueber `agents.list[].model` plus Bindings ueberschreiben (siehe [/concepts/multi-agent](/concepts/multi-agent)).

## Schnelle Modell-Empfehlungen (anekdotisch)

- **GLM**: etwas besser fuer Coding/Tool-Calling.
- **MiniMax**: besser fuer Schreiben und „Vibes“.

## Setup-Assistent (empfohlen)

Wenn Sie die Konfiguration nicht von Hand bearbeiten moechten, starten Sie den Einfuehrungs-Assistenten:

```bash
openclaw onboard
```

Er kann Modell + Auth fuer gaengige Anbieter einrichten, einschliesslich **OpenAI Code (Codex)
Abonnement** (OAuth) und **Anthropic** (API-Key empfohlen; `claude
setup-token` wird ebenfalls unterstuetzt).

## Config-Keys (Ueberblick)

- `agents.defaults.model.primary` und `agents.defaults.model.fallbacks`
- `agents.defaults.imageModel.primary` und `agents.defaults.imageModel.fallbacks`
- `agents.defaults.models` (Allowlist + Aliasse + Anbieterparameter)
- `models.providers` (benutzerdefinierte Anbieter, geschrieben in `models.json`)

Model-Refs werden auf Kleinbuchstaben normalisiert. Anbieter-Aliasse wie `z.ai/*` werden
zu `zai/*` normalisiert.

Beispiele fuer Anbieter-Konfigurationen (einschliesslich OpenCode Zen) finden Sie unter
[/gateway/configuration](/gateway/configuration#opencode-zen-multi-model-proxy).

## „Model is not allowed“ (und warum Antworten ausbleiben)

Wenn `agents.defaults.models` gesetzt ist, wird es zur **Allowlist** fuer `/model` und fuer
Sitzungs-Ueberschreibungen. Waehlt ein Benutzer ein Modell, das nicht in dieser Allowlist ist,
gibt OpenClaw zurueck:

```
Model "provider/model" is not allowed. Use /model to list available models.
```

Dies passiert **bevor** eine normale Antwort erzeugt wird, sodass es sich anfuehlen kann,
als haette es „nicht geantwortet“. Die Abhilfe ist entweder:

- Das Modell zu `agents.defaults.models` hinzufuegen, oder
- Die Allowlist leeren (`agents.defaults.models` entfernen), oder
- Ein Modell aus `/model list` waehlen.

Beispiel fuer eine Allowlist-Konfiguration:

```json5
{
  agent: {
    model: { primary: "anthropic/claude-sonnet-4-5" },
    models: {
      "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
      "anthropic/claude-opus-4-6": { alias: "Opus" },
    },
  },
}
```

## Wechseln von Modellen im Chat (`/model`)

Sie koennen Modelle fuer die aktuelle Sitzung wechseln, ohne neu zu starten:

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model status
```

Hinweise:

- `/model` (und `/model list`) ist ein kompakter, nummerierter Picker (Modellfamilie + verfuegbare Anbieter).
- `/model <#>` waehlt aus diesem Picker.
- `/model status` ist die Detailansicht (Auth-Kandidaten und, falls konfiguriert, Anbieter-Endpunkt `baseUrl` + `api`-Modus).
- Model-Refs werden geparst, indem am **ersten** `/` getrennt wird. Verwenden Sie `provider/model` beim Eingeben von `/model <ref>`.
- Wenn die Modell-ID selbst `/` enthaelt (OpenRouter-Stil), muessen Sie das Anbieter-Praefix angeben (Beispiel: `/model openrouter/moonshotai/kimi-k2`).
- Wenn Sie den Anbieter weglassen, behandelt OpenClaw die Eingabe als Alias oder als Modell fuer den **Standardanbieter** (funktioniert nur, wenn es kein `/` in der Modell-ID gibt).

Vollstaendiges Befehlsverhalten/Konfiguration: [Slash commands](/tools/slash-commands).

## CLI-Befehle

```bash
openclaw models list
openclaw models status
openclaw models set <provider/model>
openclaw models set-image <provider/model>

openclaw models aliases list
openclaw models aliases add <alias> <provider/model>
openclaw models aliases remove <alias>

openclaw models fallbacks list
openclaw models fallbacks add <provider/model>
openclaw models fallbacks remove <provider/model>
openclaw models fallbacks clear

openclaw models image-fallbacks list
openclaw models image-fallbacks add <provider/model>
openclaw models image-fallbacks remove <provider/model>
openclaw models image-fallbacks clear
```

`openclaw models` (ohne Unterbefehl) ist eine Abkuerzung fuer `models status`.

### `models list`

Zeigt standardmaessig konfigurierte Modelle an. Nuetzliche Flags:

- `--all`: kompletter Katalog
- `--local`: nur lokale Anbieter
- `--provider <name>`: nach Anbieter filtern
- `--plain`: ein Modell pro Zeile
- `--json`: maschinenlesbare Ausgabe

### `models status`

Zeigt das aufgeloeste primaere Modell, Fallbacks, Bildmodell sowie eine Auth-Uebersicht
der konfigurierten Anbieter. Zudem wird der OAuth-Ablaufstatus fuer im Auth-Store gefundene
Profile angezeigt (warnt standardmaessig innerhalb von 24 Std.). `--plain` gibt nur das
aufgeloeste primaere Modell aus.
Der OAuth-Status wird immer angezeigt (und ist in der Ausgabe von `--json` enthalten).
Wenn ein konfigurierter Anbieter keine Zugangsdaten hat, gibt `models status` einen Abschnitt
**Missing auth** aus.
JSON enthaelt `auth.oauth` (Warnfenster + Profile) und `auth.providers`
(effektive Auth pro Anbieter).
Verwenden Sie `--check` fuer Automatisierung (Exit `1` bei fehlend/abgelaufen,
`2` bei bevorstehendem Ablauf).

Bevorzugte Anthropic-Auth ist das Claude Code CLI setup-token (ueberall ausfuehren; bei Bedarf auf dem Gateway-Host einfuegen):

```bash
claude setup-token
openclaw models status
```

## Scanning (OpenRouter Free-Modelle)

`openclaw models scan` untersucht OpenRouters **Free-Model-Katalog** und kann
optional Modelle auf Tool- und Bild-Unterstuetzung pruefen.

Wichtige Flags:

- `--no-probe`: Live-Probes ueberspringen (nur Metadaten)
- `--min-params <b>`: minimale Parameter-Groesse (Milliarden)
- `--max-age-days <days>`: aeltere Modelle ueberspringen
- `--provider <name>`: Anbieter-Praefix-Filter
- `--max-candidates <n>`: Groesse der Fallback-Liste
- `--set-default`: `agents.defaults.model.primary` auf die erste Auswahl setzen
- `--set-image`: `agents.defaults.imageModel.primary` auf die erste Bild-Auswahl setzen

Das Probing erfordert einen OpenRouter-API-Key (aus Auth-Profilen oder
`OPENROUTER_API_KEY`). Ohne Key verwenden Sie `--no-probe`, um nur Kandidaten aufzulisten.

Scan-Ergebnisse werden gerankt nach:

1. Bild-Unterstuetzung
2. Tool-Latenz
3. Kontextgroesse
4. Parameteranzahl

Eingabe

- OpenRouter-`/models`-Liste (Filter `:free`)
- Erfordert OpenRouter-API-Key aus Auth-Profilen oder `OPENROUTER_API_KEY` (siehe [/environment](/environment))
- Optionale Filter: `--max-age-days`, `--min-params`, `--provider`, `--max-candidates`
- Probe-Steuerungen: `--timeout`, `--concurrency`

Bei Ausfuehrung in einem TTY koennen Sie Fallbacks interaktiv auswaehlen. Im nicht-interaktiven
Modus uebergeben Sie `--yes`, um die Standardwerte zu akzeptieren.

## Models-Registry (`models.json`)

Benutzerdefinierte Anbieter in `models.providers` werden in `models.json` unter dem
Agent-Verzeichnis (Standard `~/.openclaw/agents/<agentId>/models.json`) geschrieben. Diese Datei
wird standardmaessig zusammengefuehrt, sofern `models.mode` nicht auf `replace` gesetzt ist.
