---
summary: „OAuth in OpenClaw: Token-Austausch, Speicherung und Muster für mehrere Konten“
read_when:
  - Sie möchten OAuth in OpenClaw Ende-zu-Ende verstehen
  - Sie stoßen auf Probleme mit Token-Ungültigmachung / Abmeldung
  - Sie möchten setup-token- oder OAuth-Authentifizierungsflüsse
  - Sie möchten mehrere Konten oder Profil-Routing
title: „OAuth“
x-i18n:
  source_path: concepts/oauth.md
  source_hash: af714bdadc4a8929
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:04Z
---

# OAuth

OpenClaw unterstützt „Subscription-Auth“ über OAuth für Anbieter, die dies anbieten (insbesondere **OpenAI Codex (ChatGPT OAuth)**). Für Anthropic-Abonnements verwenden Sie den **setup-token**-Flow. Diese Seite erläutert:

- wie der OAuth-**Token-Austausch** funktioniert (PKCE)
- wo Tokens **gespeichert** werden (und warum)
- wie **mehrere Konten** gehandhabt werden (Profile + sitzungsweise Overrides)

OpenClaw unterstützt außerdem **Provider-Plugins**, die ihre eigenen OAuth- oder API‑Key‑
Flows mitbringen. Führen Sie diese aus über:

```bash
openclaw models auth login --provider <id>
```

## Die Token-Senke (warum es sie gibt)

OAuth-Anbieter stellen während Login-/Refresh-Flows häufig ein **neues Refresh-Token** aus. Einige Anbieter (oder OAuth-Clients) können ältere Refresh-Tokens ungültig machen, wenn für denselben Benutzer/dieselbe App ein neues ausgegeben wird.

Praktisches Symptom:

- Sie melden sich über OpenClaw _und_ über Claude Code / Codex CLI an → eines von beiden wird später scheinbar zufällig „abgemeldet“

Um dies zu reduzieren, behandelt OpenClaw `auth-profiles.json` als **Token-Senke**:

- die Runtime liest Anmeldedaten aus **einer Quelle**
- wir können mehrere Profile vorhalten und sie deterministisch routen

## Speicherung (wo Tokens liegen)

Secrets werden **pro Agent** gespeichert:

- Auth-Profile (OAuth + API-Keys): `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`
- Runtime-Cache (automatisch verwaltet; nicht bearbeiten): `~/.openclaw/agents/<agentId>/agent/auth.json`

Legacy-Datei nur für den Import (weiterhin unterstützt, aber nicht der Hauptspeicher):

- `~/.openclaw/credentials/oauth.json` (bei der ersten Nutzung in `auth-profiles.json` importiert)

All dies berücksichtigt außerdem `$OPENCLAW_STATE_DIR` (Override des State-Verzeichnisses). Vollständige Referenz: [/gateway/configuration](/gateway/configuration#auth-storage-oauth--api-keys)

## Anthropic setup-token (Subscription-Auth)

Führen Sie `claude setup-token` auf einem beliebigen Rechner aus und fügen Sie es anschließend in OpenClaw ein:

```bash
openclaw models auth setup-token --provider anthropic
```

Wenn Sie den Token anderswo erzeugt haben, fügen Sie ihn manuell ein:

```bash
openclaw models auth paste-token --provider anthropic
```

Verifizieren:

```bash
openclaw models status
```

## OAuth-Austausch (wie der Login funktioniert)

Die interaktiven Login-Flows von OpenClaw sind in `@mariozechner/pi-ai` implementiert und in die Assistenten/Befehle eingebunden.

### Anthropic (Claude Pro/Max) setup-token

Ablauf:

1. `claude setup-token` ausführen
2. den Token in OpenClaw einfügen
3. als Token-Auth-Profil speichern (kein Refresh)

Der Assistentenpfad ist `openclaw onboard` → Auth-Auswahl `setup-token` (Anthropic).

### OpenAI Codex (ChatGPT OAuth)

Ablauf (PKCE):

1. PKCE-Verifier/Challenge + zufällige `state` erzeugen
2. `https://auth.openai.com/oauth/authorize?...` öffnen
3. versuchen, den Callback auf `http://127.0.0.1:1455/auth/callback` abzufangen
4. falls der Callback nicht binden kann (oder Sie remote/headless sind), die Redirect-URL/den Code einfügen
5. Austausch bei `https://auth.openai.com/oauth/token`
6. `accountId` aus dem Access-Token extrahieren und `{ access, refresh, expires, accountId }` speichern

Der Assistentenpfad ist `openclaw onboard` → Auth-Auswahl `openai-codex`.

## Refresh + Ablauf

Profile speichern einen `expires`-Zeitstempel.

Zur Laufzeit:

- wenn `expires` in der Zukunft liegt → gespeicherten Access-Token verwenden
- wenn abgelaufen → unter Dateisperre refreshen und die gespeicherten Anmeldedaten überschreiben

Der Refresh-Flow ist automatisch; in der Regel müssen Sie Tokens nicht manuell verwalten.

## Mehrere Konten (Profile) + Routing

Zwei Muster:

### 1) Bevorzugt: separate Agenten

Wenn „privat“ und „geschäftlich“ niemals interagieren sollen, verwenden Sie isolierte Agenten (separate Sitzungen + Anmeldedaten + Workspace):

```bash
openclaw agents add work
openclaw agents add personal
```

Konfigurieren Sie die Authentifizierung dann pro Agent (Assistent) und routen Sie Chats zum richtigen Agenten.

### 2) Erweitert: mehrere Profile in einem Agenten

`auth-profiles.json` unterstützt mehrere Profil-IDs für denselben Anbieter.

Auswahl des verwendeten Profils:

- global über die Konfigurationsreihenfolge (`auth.order`)
- pro Sitzung über `/model ...@<profileId>`

Beispiel (Sitzungs-Override):

- `/model Opus@anthropic:work`

So sehen Sie, welche Profil-IDs existieren:

- `openclaw channels list --json` (zeigt `auth[]`)

Verwandte Dokumente:

- [/concepts/model-failover](/concepts/model-failover) (Rotation + Cooldown-Regeln)
- [/tools/slash-commands](/tools/slash-commands) (Befehlsoberfläche)
