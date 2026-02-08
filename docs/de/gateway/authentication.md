---
summary: "Modellauthentifizierung: OAuth, API-Schlüssel und Setup-Token"
read_when:
  - Debugging der Modellauthentifizierung oder des OAuth-Ablaufs
  - Dokumentation von Authentifizierung oder Speicherung von Anmeldedaten
title: "Authentifizierung"
x-i18n:
  source_path: gateway/authentication.md
  source_hash: 66fa2c64ff374c9c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:17Z
---

# Authentifizierung

OpenClaw unterstützt OAuth und API-Schlüssel für Modellanbieter. Für Anthropic‑Konten empfehlen wir die Verwendung eines **API-Schlüssels**. Für den Zugriff über ein Claude‑Abonnement verwenden Sie das langlebige Token, das durch `claude setup-token` erstellt wird.

Siehe [/concepts/oauth](/concepts/oauth) fuer alle Details zum vollständigen OAuth‑Ablauf und zur Speicherstruktur.

## Empfohlene Anthropic‑Einrichtung (API‑Schlüssel)

Wenn Sie Anthropic direkt verwenden, nutzen Sie einen API‑Schlüssel.

1. Erstellen Sie einen API‑Schlüssel in der Anthropic Console.
2. Legen Sie ihn auf dem **Gateway‑Host** ab (der Maschine, auf der `openclaw gateway` läuft).

```bash
export ANTHROPIC_API_KEY="..."
openclaw models status
```

3. Wenn der Gateway unter systemd/launchd läuft, bevorzugen Sie es, den Schlüssel in `~/.openclaw/.env` zu hinterlegen, damit der Daemon ihn lesen kann:

```bash
cat >> ~/.openclaw/.env <<'EOF'
ANTHROPIC_API_KEY=...
EOF
```

Starten Sie anschließend den Daemon neu (oder starten Sie Ihren Gateway‑Prozess neu) und prüfen Sie erneut:

```bash
openclaw models status
openclaw doctor
```

Wenn Sie Umgebungsvariablen nicht selbst verwalten möchten, kann der Einführungs‑Assistent API‑Schlüssel für die Nutzung durch den Daemon speichern: `openclaw onboard`.

Siehe [Help](/help) fuer Details zur Vererbung von Umgebungsvariablen (`env.shellEnv`, `~/.openclaw/.env`, systemd/launchd).

## Anthropic: Setup‑Token (Abonnement‑Authentifizierung)

Für Anthropic ist der empfohlene Weg ein **API‑Schlüssel**. Wenn Sie ein Claude‑Abonnement verwenden, wird der Setup‑Token‑Ablauf ebenfalls unterstützt. Führen Sie ihn auf dem **Gateway‑Host** aus:

```bash
claude setup-token
```

Fügen Sie ihn dann in OpenClaw ein:

```bash
openclaw models auth setup-token --provider anthropic
```

Wenn das Token auf einer anderen Maschine erstellt wurde, fügen Sie es manuell ein:

```bash
openclaw models auth paste-token --provider anthropic
```

Wenn Sie einen Anthropic‑Fehler wie diesen sehen:

```
This credential is only authorized for use with Claude Code and cannot be used for other API requests.
```

…verwenden Sie stattdessen einen Anthropic‑API‑Schlüssel.

Manuelle Token‑Eingabe (beliebiger Anbieter; schreibt `auth-profiles.json` + aktualisiert die Konfiguration):

```bash
openclaw models auth paste-token --provider anthropic
openclaw models auth paste-token --provider openrouter
```

Automatisierungsfreundliche Prüfung (Beenden mit `1` bei abgelaufen/fehlend, `2` bei bald ablaufend):

```bash
openclaw models status --check
```

Optionale Ops‑Skripte (systemd/Termux) sind hier dokumentiert:
[/automation/auth-monitoring](/automation/auth-monitoring)

> `claude setup-token` erfordert ein interaktives TTY.

## Überprüfen des Modellauthentifizierungsstatus

```bash
openclaw models status
openclaw doctor
```

## Steuern, welche Anmeldedaten verwendet werden

### Pro Sitzung (Chat‑Befehl)

Verwenden Sie `/model <alias-or-id>@<profileId>`, um ein bestimmtes Anbieter‑Anmeldeprofil für die aktuelle Sitzung festzulegen (Beispiel‑Profil‑IDs: `anthropic:default`, `anthropic:work`).

Verwenden Sie `/model` (oder `/model list`) für eine kompakte Auswahl; verwenden Sie `/model status` für die vollständige Ansicht (Kandidaten + nächstes Auth‑Profil sowie Anbieter‑Endpunktdetails, sofern konfiguriert).

### Pro Agent (CLI‑Override)

Legen Sie eine explizite Reihenfolge der Auth‑Profile für einen Agenten fest (gespeichert in dessen `auth-profiles.json`):

```bash
openclaw models auth order get --provider anthropic
openclaw models auth order set --provider anthropic anthropic:default
openclaw models auth order clear --provider anthropic
```

Verwenden Sie `--agent <id>`, um einen bestimmten Agenten anzusprechen; lassen Sie es weg, um den konfigurierten Standard‑Agenten zu verwenden.

## Fehlerbehebung

### „Keine Anmeldedaten gefunden“

Wenn das Anthropic‑Token‑Profil fehlt, führen Sie `claude setup-token` auf dem **Gateway‑Host** aus und prüfen Sie anschließend erneut:

```bash
openclaw models status
```

### Token läuft ab/abgelaufen

Führen Sie `openclaw models status` aus, um zu bestätigen, welches Profil abläuft. Wenn das Profil fehlt, führen Sie `claude setup-token` erneut aus und fügen Sie das Token nochmals ein.

## Anforderungen

- Claude Max‑ oder Pro‑Abonnement (für `claude setup-token`)
- Claude Code CLI installiert (`claude`‑Befehl verfügbar)
