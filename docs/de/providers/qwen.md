---
summary: "Verwenden Sie Qwen OAuth (Free-Tier) in OpenClaw"
read_when:
  - Sie moechten Qwen mit OpenClaw verwenden
  - Sie moechten Free-Tier-OAuth-Zugriff auf Qwen Coder
title: "Qwen"
x-i18n:
  source_path: providers/qwen.md
  source_hash: 88b88e224e2fecbb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:16Z
---

# Qwen

Qwen bietet einen Free-Tier-OAuth-Ablauf fuer die Modelle Qwen Coder und Qwen Vision
(2.000 Anfragen/Tag, vorbehaltlich der Qwen-Ratenbegrenzungen).

## Plugin aktivieren

```bash
openclaw plugins enable qwen-portal-auth
```

Starten Sie den Gateway nach der Aktivierung neu.

## Authentifizieren

```bash
openclaw models auth login --provider qwen-portal --set-default
```

Dies fuehrt den Qwen-Device-Code-OAuth-Ablauf aus und schreibt einen Anbieter-Eintrag in Ihren
`models.json` (zusaetzlich zu einem `qwen`-Alias fuer schnelles Umschalten).

## Modell-IDs

- `qwen-portal/coder-model`
- `qwen-portal/vision-model`

Modelle wechseln mit:

```bash
openclaw models set qwen-portal/coder-model
```

## Qwen Code CLI-Anmeldung wiederverwenden

Wenn Sie sich bereits mit der Qwen Code CLI angemeldet haben, synchronisiert OpenClaw die Anmeldedaten
aus `~/.qwen/oauth_creds.json`, wenn der Authentifizierungsspeicher geladen wird. Sie benoetigen dennoch einen
`models.providers.qwen-portal`-Eintrag (verwenden Sie den obigen Login-Befehl, um einen zu erstellen).

## Hinweise

- Tokens werden automatisch aktualisiert; fuehren Sie den Login-Befehl erneut aus, wenn die Aktualisierung fehlschlaegt oder der Zugriff widerrufen wird.
- Standard-Basis-URL: `https://portal.qwen.ai/v1` (ueberschreiben Sie diese mit
  `models.providers.qwen-portal.baseUrl`, falls Qwen einen anderen Endpunkt bereitstellt).
- Siehe [Model providers](/concepts/model-providers) fuer alle Details zu anbieterweiten Regeln.
