---
summary: "Fehlerbehebungs-Hub: Symptome → Prüfungen → Lösungen"
read_when:
  - Sie sehen einen Fehler und möchten den Lösungsweg finden
  - Der Installer meldet „success“, aber die CLI funktioniert nicht
title: "Fehlerbehebung"
x-i18n:
  source_path: help/troubleshooting.md
  source_hash: 00ba2a20732fa22c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:34Z
---

# Fehlerbehebung

## Die ersten 60 Sekunden

Führen Sie diese der Reihe nach aus:

```bash
openclaw status
openclaw status --all
openclaw gateway probe
openclaw logs --follow
openclaw doctor
```

Wenn der Gateway erreichbar ist, tiefere Prüfungen:

```bash
openclaw status --deep
```

## Häufige „es ist kaputt“-Fälle

### `openclaw: command not found`

Fast immer ein Node/npm-PATH-Problem. Beginnen Sie hier:

- [Install (Node/npm PATH sanity)](/install#nodejs--npm-path-sanity)

### Installer schlägt fehl (oder Sie benötigen vollständige Logs)

Führen Sie den Installer im Verbose-Modus erneut aus, um den vollständigen Trace und die npm-Ausgabe zu sehen:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --verbose
```

Für Beta-Installationen:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --beta --verbose
```

Sie können auch `OPENCLAW_VERBOSE=1` statt des Flags setzen.

### Gateway „unauthorized“, keine Verbindung möglich oder ständige Neuverbindungen

- [Gateway troubleshooting](/gateway/troubleshooting)
- [Gateway authentication](/gateway/authentication)

### Control UI schlägt über HTTP fehl (Geräteidentität erforderlich)

- [Gateway troubleshooting](/gateway/troubleshooting)
- [Control UI](/web/control-ui#insecure-http)

### `docs.openclaw.ai` zeigt einen SSL-Fehler (Comcast/Xfinity)

Einige Comcast/Xfinity-Verbindungen blockieren `docs.openclaw.ai` über Xfinity Advanced Security.
Deaktivieren Sie Advanced Security oder fügen Sie `docs.openclaw.ai` der Allowlist hinzu und versuchen Sie es erneut.

- Hilfe zu Xfinity Advanced Security: https://www.xfinity.com/support/articles/using-xfinity-xfi-advanced-security
- Schnelle Plausibilitätsprüfungen: Testen Sie einen mobilen Hotspot oder ein VPN, um ISP-seitige Filterung zu bestätigen

### Dienst meldet „running“, aber die RPC-Prüfung schlägt fehl

- [Gateway troubleshooting](/gateway/troubleshooting)
- [Background process / service](/gateway/background-process)

### Modell-/Auth-Fehler (Rate-Limit, Abrechnung, „all models failed“)

- [Models](/cli/models)
- [OAuth / auth concepts](/concepts/oauth)

### `/model` sagt `model not allowed`

Das bedeutet in der Regel, dass `agents.defaults.models` als Allowlist konfiguriert ist. Wenn sie nicht leer ist,
können nur diese Anbieter-/Modell-Schlüssel ausgewählt werden.

- Prüfen Sie die Allowlist: `openclaw config get agents.defaults.models`
- Fügen Sie das gewünschte Modell hinzu (oder leeren Sie die Allowlist) und versuchen Sie `/model` erneut
- Verwenden Sie `/models`, um die erlaubten Anbieter/Modelle zu durchsuchen

### Beim Einreichen eines Issues

Fügen Sie einen sicheren Bericht ein:

```bash
openclaw status --all
```

Wenn möglich, fügen Sie den relevanten Log-Ausschnitt aus `openclaw logs --follow` bei.
