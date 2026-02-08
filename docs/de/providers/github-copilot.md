---
summary: "Melden Sie sich bei GitHub Copilot aus OpenClaw über den Geräte-Flow an"
read_when:
  - Sie möchten GitHub Copilot als Modellanbieter verwenden
  - Sie benötigen den Flow `openclaw models auth login-github-copilot`
title: "GitHub Copilot"
x-i18n:
  source_path: providers/github-copilot.md
  source_hash: 503e0496d92c921e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:11Z
---

# GitHub Copilot

## Was ist GitHub Copilot?

GitHub Copilot ist der KI-Codierungsassistent von GitHub. Er bietet Zugriff auf
Copilot-Modelle für Ihr GitHub-Konto und Ihren Tarif. OpenClaw kann Copilot auf
zwei verschiedene Arten als Modellanbieter verwenden.

## Zwei Möglichkeiten, Copilot in OpenClaw zu verwenden

### 1) Integrierter GitHub-Copilot-Anbieter (`github-copilot`)

Verwenden Sie den nativen Geräte-Anmelde-Flow, um ein GitHub-Token zu erhalten,
und tauschen Sie es dann beim Ausführen von OpenClaw gegen Copilot-API-Tokens
ein. Dies ist der **Standard** und der einfachste Weg, da VS Code nicht
erforderlich ist.

### 2) Copilot-Proxy-Plugin (`copilot-proxy`)

Verwenden Sie die **Copilot Proxy**-VS-Code-Erweiterung als lokale Brücke.
OpenClaw kommuniziert mit dem `/v1`-Endpunkt des Proxys und verwendet
die dort konfigurierte Modellliste. Wählen Sie diese Option, wenn Sie Copilot
Proxy bereits in VS Code ausführen oder den Datenverkehr darüber leiten müssen.
Sie müssen das Plugin aktivieren und die VS-Code-Erweiterung aktiv halten.

Verwenden Sie GitHub Copilot als Modellanbieter (`github-copilot`). Der
Anmeldebefehl führt den GitHub-Geräte-Flow aus, speichert ein Authentifizierungs-
profil und aktualisiert Ihre Konfiguration, um dieses Profil zu verwenden.

## CLI-Einrichtung

```bash
openclaw models auth login-github-copilot
```

Sie werden aufgefordert, eine URL zu besuchen und einen einmaligen Code
einzugeben. Lassen Sie das Terminal geöffnet, bis der Vorgang abgeschlossen ist.

### Optionale Flags

```bash
openclaw models auth login-github-copilot --profile-id github-copilot:work
openclaw models auth login-github-copilot --yes
```

## Ein Standardmodell festlegen

```bash
openclaw models set github-copilot/gpt-4o
```

### Konfigurationsausschnitt

```json5
{
  agents: { defaults: { model: { primary: "github-copilot/gpt-4o" } } },
}
```

## Hinweise

- Erfordert ein interaktives TTY; führen Sie den Befehl direkt in einem Terminal
  aus.
- Die Verfügbarkeit der Copilot-Modelle hängt von Ihrem Tarif ab; wenn ein Modell
  abgelehnt wird, versuchen Sie eine andere ID (zum Beispiel `github-copilot/gpt-4.1`).
- Die Anmeldung speichert ein GitHub-Token im Authentifizierungsprofil-Speicher
  und tauscht es beim Ausführen von OpenClaw gegen ein Copilot-API-Token ein.
