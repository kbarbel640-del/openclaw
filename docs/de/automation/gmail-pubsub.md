---
summary: "Gmail-Pub/Sub-Push in OpenClaw-Webhooks ueber gogcli integriert"
read_when:
  - Gmail-Posteingangs-Trigger mit OpenClaw verbinden
  - Pub/Sub-Push fuer das Aufwecken von Agenten einrichten
title: "Gmail PubSub"
x-i18n:
  source_path: automation/gmail-pubsub.md
  source_hash: dfb92133b69177e4
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:20Z
---

# Gmail Pub/Sub -> OpenClaw

Ziel: Gmail-Watch -> Pub/Sub-Push -> `gog gmail watch serve` -> OpenClaw-Webhook.

## Voraussetzungen

- `gcloud` installiert und angemeldet ([Installationsanleitung](https://docs.cloud.google.com/sdk/docs/install-sdk)).
- `gog` (gogcli) installiert und fuer das Gmail-Konto autorisiert ([gogcli.sh](https://gogcli.sh/)).
- OpenClaw-Hooks aktiviert (siehe [Webhooks](/automation/webhook)).
- `tailscale` angemeldet ([tailscale.com](https://tailscale.com/)). Die unterstuetzte Einrichtung nutzt Tailscale Funnel fuer den oeffentlichen HTTPS-Endpunkt.
  Andere Tunnel-Dienste koennen funktionieren, sind jedoch DIY/nicht unterstuetzt und erfordern manuelle Verdrahtung.
  Aktuell unterstuetzen wir Tailscale.

Beispiel-Hook-Konfiguration (Gmail-Preset-Zuordnung aktivieren):

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    path: "/hooks",
    presets: ["gmail"],
  },
}
```

Um die Gmail-Zusammenfassung an eine Chat-Oberflaeche zu senden, ueberschreiben Sie das Preset mit einer Zuordnung,
die `deliver` + optional `channel`/`to` setzt:

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    presets: ["gmail"],
    mappings: [
      {
        match: { path: "gmail" },
        action: "agent",
        wakeMode: "now",
        name: "Gmail",
        sessionKey: "hook:gmail:{{messages[0].id}}",
        messageTemplate: "New email from {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}\n{{messages[0].body}}",
        model: "openai/gpt-5.2-mini",
        deliver: true,
        channel: "last",
        // to: "+15551234567"
      },
    ],
  },
}
```

Wenn Sie einen festen Kanal verwenden moechten, setzen Sie `channel` + `to`. Andernfalls verwendet `channel: "last"`
die letzte Zustellroute (faellt auf WhatsApp zurueck).

Um fuer Gmail-Laeufe ein guenstigeres Modell zu erzwingen, setzen Sie `model` in der Zuordnung
(`provider/model` oder Alias). Wenn Sie `agents.defaults.models` erzwingen, fuegen Sie es dort ein.

Um ein Standardmodell und eine Denkstufe speziell fuer Gmail-Hooks festzulegen, fuegen Sie
`hooks.gmail.model` / `hooks.gmail.thinking` in Ihrer Konfiguration hinzu:

```json5
{
  hooks: {
    gmail: {
      model: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
      thinking: "off",
    },
  },
}
```

Hinweise:

- Pro Hook ueberschreiben `model`/`thinking` in der Zuordnung weiterhin diese Standards.
- Fallback-Reihenfolge: `hooks.gmail.model` → `agents.defaults.model.fallbacks` → Primaer (Auth/Rate-Limit/Timeouts).
- Wenn `agents.defaults.models` gesetzt ist, muss das Gmail-Modell in der Allowlist enthalten sein.
- Inhalte des Gmail-Hooks werden standardmaessig mit Sicherheitsgrenzen fuer externe Inhalte umhuellt.
  Zum Deaktivieren (gefaehrlich) setzen Sie `hooks.gmail.allowUnsafeExternalContent: true`.

Um die Payload-Verarbeitung weiter anzupassen, fuegen Sie `hooks.mappings` oder ein JS/TS-Transformationsmodul
unter `hooks.transformsDir` hinzu (siehe [Webhooks](/automation/webhook)).

## Assistent (empfohlen)

Verwenden Sie den OpenClaw-Helfer, um alles miteinander zu verdrahten (installiert Abhaengigkeiten auf macOS ueber brew):

```bash
openclaw webhooks gmail setup \
  --account openclaw@gmail.com
```

Standards:

- Verwendet Tailscale Funnel fuer den oeffentlichen Push-Endpunkt.
- Schreibt `hooks.gmail`-Konfiguration fuer `openclaw webhooks gmail run`.
- Aktiviert das Gmail-Hook-Preset (`hooks.presets: ["gmail"]`).

Pfad-Hinweis: Wenn `tailscale.mode` aktiviert ist, setzt OpenClaw automatisch
`hooks.gmail.serve.path` auf `/` und behaelt den oeffentlichen Pfad bei
`hooks.gmail.tailscale.path` (Standard `/gmail-pubsub`), da Tailscale
das gesetzte Pfad-Praefix vor dem Proxying entfernt.
Wenn das Backend den praefixierten Pfad erhalten soll, setzen Sie
`hooks.gmail.tailscale.target` (oder `--tailscale-target`) auf eine vollstaendige URL wie
`http://127.0.0.1:8788/gmail-pubsub` und gleichen Sie `hooks.gmail.serve.path` ab.

Moechten Sie einen benutzerdefinierten Endpunkt? Verwenden Sie `--push-endpoint <url>` oder `--tailscale off`.

Plattform-Hinweis: Unter macOS installiert der Assistent `gcloud`, `gogcli` und `tailscale`
ueber Homebrew; unter Linux installieren Sie diese zuvor manuell.

Gateway-Autostart (empfohlen):

- Wenn `hooks.enabled=true` und `hooks.gmail.account` gesetzt sind, startet das Gateway
  `gog gmail watch serve` beim Booten und erneuert den Watch automatisch.
- Setzen Sie `OPENCLAW_SKIP_GMAIL_WATCHER=1`, um sich abzumelden (nuetzlich, wenn Sie den Daemon selbst betreiben).
- Fuehren Sie den manuellen Daemon nicht gleichzeitig aus, sonst kommt es zu
  `listen tcp 127.0.0.1:8788: bind: address already in use`.

Manueller Daemon (startet `gog gmail watch serve` + automatische Erneuerung):

```bash
openclaw webhooks gmail run
```

## Einmalige Einrichtung

1. Waehlen Sie das GCP-Projekt **dem der OAuth-Client gehoert**, der von `gog` verwendet wird.

```bash
gcloud auth login
gcloud config set project <project-id>
```

Hinweis: Gmail-Watch erfordert, dass das Pub/Sub-Topic im selben Projekt liegt wie der OAuth-Client.

2. APIs aktivieren:

```bash
gcloud services enable gmail.googleapis.com pubsub.googleapis.com
```

3. Topic erstellen:

```bash
gcloud pubsub topics create gog-gmail-watch
```

4. Gmail-Push das Publizieren erlauben:

```bash
gcloud pubsub topics add-iam-policy-binding gog-gmail-watch \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

## Watch starten

```bash
gog gmail watch start \
  --account openclaw@gmail.com \
  --label INBOX \
  --topic projects/<project-id>/topics/gog-gmail-watch
```

Speichern Sie die `history_id` aus der Ausgabe (fuer Debugging).

## Push-Handler ausfuehren

Lokales Beispiel (Shared-Token-Auth):

```bash
gog gmail watch serve \
  --account openclaw@gmail.com \
  --bind 127.0.0.1 \
  --port 8788 \
  --path /gmail-pubsub \
  --token <shared> \
  --hook-url http://127.0.0.1:18789/hooks/gmail \
  --hook-token OPENCLAW_HOOK_TOKEN \
  --include-body \
  --max-bytes 20000
```

Hinweise:

- `--token` schuetzt den Push-Endpunkt (`x-gog-token` oder `?token=`).
- `--hook-url` verweist auf OpenClaw `/hooks/gmail` (zugeordnet; isolierter Lauf + Zusammenfassung an die Hauptinstanz).
- `--include-body` und `--max-bytes` steuern den an OpenClaw gesendeten Body-Ausschnitt.

Empfohlen: `openclaw webhooks gmail run` kapselt denselben Ablauf und erneuert den Watch automatisch.

## Handler exponieren (fortgeschritten, nicht unterstuetzt)

Wenn Sie einen Nicht-Tailscale-Tunnel benoetigen, verdrahten Sie ihn manuell und verwenden Sie die oeffentliche URL im Push-
Abo (nicht unterstuetzt, ohne Leitplanken):

```bash
cloudflared tunnel --url http://127.0.0.1:8788 --no-autoupdate
```

Verwenden Sie die generierte URL als Push-Endpunkt:

```bash
gcloud pubsub subscriptions create gog-gmail-watch-push \
  --topic gog-gmail-watch \
  --push-endpoint "https://<public-url>/gmail-pubsub?token=<shared>"
```

Produktion: Verwenden Sie einen stabilen HTTPS-Endpunkt und konfigurieren Sie Pub/Sub OIDC JWT, dann fuehren Sie aus:

```bash
gog gmail watch serve --verify-oidc --oidc-email <svc@...>
```

## Test

Senden Sie eine Nachricht an den ueberwachten Posteingang:

```bash
gog gmail send \
  --account openclaw@gmail.com \
  --to openclaw@gmail.com \
  --subject "watch test" \
  --body "ping"
```

Watch-Status und Verlauf pruefen:

```bash
gog gmail watch status --account openclaw@gmail.com
gog gmail history --account openclaw@gmail.com --since <historyId>
```

## Fehlerbehebung

- `Invalid topicName`: Projekt-Mismatch (Topic nicht im OAuth-Client-Projekt).
- `User not authorized`: fehlende `roles/pubsub.publisher` auf dem Topic.
- Leere Nachrichten: Gmail-Push liefert nur `historyId`; Abruf ueber `gog gmail history`.

## Bereinigung

```bash
gog gmail watch stop --account openclaw@gmail.com
gcloud pubsub subscriptions delete gog-gmail-watch-push
gcloud pubsub topics delete gog-gmail-watch
```
