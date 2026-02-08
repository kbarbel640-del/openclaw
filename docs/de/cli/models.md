---
summary: "CLI-Referenz für `openclaw models` (Status/Liste/Setzen/Scannen, Aliase, Fallbacks, Authentifizierung)"
read_when:
  - Sie möchten Standardmodelle ändern oder den Authentifizierungsstatus von Anbietern anzeigen
  - Sie möchten verfügbare Modelle/Anbieter scannen und Authentifizierungsprofile debuggen
title: "Modelle"
x-i18n:
  source_path: cli/models.md
  source_hash: 923b6ffc7de382ba
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:47Z
---

# `openclaw models`

Modellerkennung, Scannen und Konfiguration (Standardmodell, Fallbacks, Authentifizierungsprofile).

Verwandt:

- Anbieter + Modelle: [Modelle](/providers/models)
- Einrichtung der Anbieter-Authentifizierung: [Erste Schritte](/start/getting-started)

## Häufige Befehle

```bash
openclaw models status
openclaw models list
openclaw models set <model-or-alias>
openclaw models scan
```

`openclaw models status` zeigt die aufgelösten Standard-/Fallbacks sowie eine Authentifizierungsübersicht.
Wenn Snapshots zur Anbieternutzung verfügbar sind, enthält der Abschnitt zum OAuth-/Tokenstatus
Header zur Anbieternutzung.
Fügen Sie `--probe` hinzu, um Live-Auth-Probes gegen jedes konfigurierte Anbieterprofil auszuführen.
Probes sind echte Anfragen (können Tokens verbrauchen und Rate-Limits auslösen).
Verwenden Sie `--agent <id>`, um den Modell-/Auth-Status eines konfigurierten Agenten zu prüfen. Wenn weggelassen,
verwendet der Befehl `OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR`, falls gesetzt, andernfalls den
konfigurierten Standard-Agenten.

Hinweise:

- `models set <model-or-alias>` akzeptiert `provider/model` oder einen Alias.
- Modellreferenzen werden geparst, indem am **ersten** `/` getrennt wird. Wenn die Modell-ID `/` (OpenRouter-Stil) enthält, geben Sie den Anbieterpräfix an (Beispiel: `openrouter/moonshotai/kimi-k2`).
- Wenn Sie den Anbieter weglassen, behandelt OpenClaw die Eingabe als Alias oder als Modell für den **Standardanbieter** (funktioniert nur, wenn es kein `/` in der Modell-ID gibt).

### `models status`

Optionen:

- `--json`
- `--plain`
- `--check` (Exit 1=abgelaufen/fehlend, 2=läuft bald ab)
- `--probe` (Live-Probe der konfigurierten Authentifizierungsprofile)
- `--probe-provider <name>` (einen Anbieter prüfen)
- `--probe-profile <id>` (wiederholen oder kommagetrennte Profil-IDs)
- `--probe-timeout <ms>`
- `--probe-concurrency <n>`
- `--probe-max-tokens <n>`
- `--agent <id>` (konfigurierte Agenten-ID; überschreibt `OPENCLAW_AGENT_DIR`/`PI_CODING_AGENT_DIR`)

## Aliase + Fallbacks

```bash
openclaw models aliases list
openclaw models fallbacks list
```

## Authentifizierungsprofile

```bash
openclaw models auth add
openclaw models auth login --provider <id>
openclaw models auth setup-token
openclaw models auth paste-token
```

`models auth login` führt den Authentifizierungsfluss (OAuth/API-Schlüssel) eines Anbieter-Plugins aus. Verwenden Sie
`openclaw plugins list`, um zu sehen, welche Anbieter installiert sind.

Hinweise:

- `setup-token` fordert einen Setup-Token-Wert an (erzeugen Sie ihn mit `claude setup-token` auf einem beliebigen Rechner).
- `paste-token` akzeptiert eine Token-Zeichenfolge, die andernorts oder aus Automatisierung generiert wurde.
