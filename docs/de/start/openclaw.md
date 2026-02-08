---
summary: "End-to-End-Anleitung zum Betrieb von OpenClaw als persönlicher Assistent mit Sicherheitshinweisen"
read_when:
  - Einführung einer neuen Assistenteninstanz
  - Überprüfung von Sicherheits- und Berechtigungsimplikationen
title: "Einrichtung eines persönlichen Assistenten"
x-i18n:
  source_path: start/openclaw.md
  source_hash: 55cd0c67e5e3b28e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:38Z
---

# Aufbau eines persönlichen Assistenten mit OpenClaw

OpenClaw ist ein WhatsApp- + Telegram- + Discord- + iMessage-Gateway für **Pi**-Agenten. Plugins fügen Mattermost hinzu. Diese Anleitung beschreibt die Einrichtung als „persönlicher Assistent“: eine dedizierte WhatsApp-Nummer, die sich wie Ihr ständig verfügbarer Agent verhält.

## ⚠️ Sicherheit zuerst

Sie versetzen einen Agenten in die Lage:

- Befehle auf Ihrer Maschine auszuführen (abhängig von Ihrer Pi-Werkzeugkonfiguration)
- Dateien in Ihrem Arbeitsbereich zu lesen/zu schreiben
- Nachrichten über WhatsApp/Telegram/Discord/Mattermost (Plugin) nach außen zu senden

Beginnen Sie konservativ:

- Setzen Sie immer `channels.whatsapp.allowFrom` (betreiben Sie ihn niemals offen für die ganze Welt auf Ihrem persönlichen Mac).
- Verwenden Sie eine dedizierte WhatsApp-Nummer für den Assistenten.
- Heartbeats sind jetzt standardmäßig alle 30 Minuten aktiviert. Deaktivieren Sie sie, bis Sie dem Setup vertrauen, indem Sie `agents.defaults.heartbeat.every: "0m"` setzen.

## Voraussetzungen

- OpenClaw installiert und eingeführt — siehe [Erste Schritte](/start/getting-started), falls Sie dies noch nicht getan haben
- Eine zweite Telefonnummer (SIM/eSIM/Prepaid) für den Assistenten

## Das Zwei-Telefon-Setup (empfohlen)

Sie möchten Folgendes:

```
Your Phone (personal)          Second Phone (assistant)
┌─────────────────┐           ┌─────────────────┐
│  Your WhatsApp  │  ──────▶  │  Assistant WA   │
│  +1-555-YOU     │  message  │  +1-555-ASSIST  │
└─────────────────┘           └────────┬────────┘
                                       │ linked via QR
                                       ▼
                              ┌─────────────────┐
                              │  Your Mac       │
                              │  (openclaw)      │
                              │    Pi agent     │
                              └─────────────────┘
```

Wenn Sie Ihr persönliches WhatsApp mit OpenClaw verknüpfen, wird jede Nachricht an Sie zu „Agenten-Eingabe“. Das ist selten gewünscht.

## 5-Minuten-Schnellstart

1. WhatsApp Web koppeln (zeigt QR; mit dem Assistenten-Telefon scannen):

```bash
openclaw channels login
```

2. Das Gateway starten (laufen lassen):

```bash
openclaw gateway --port 18789
```

3. Eine minimale Konfiguration in `~/.openclaw/openclaw.json` hinterlegen:

```json5
{
  channels: { whatsapp: { allowFrom: ["+15555550123"] } },
}
```

Senden Sie nun eine Nachricht von Ihrem erlaubten Telefon an die Assistenten-Nummer.

Wenn das Onboarding abgeschlossen ist, öffnen wir automatisch das Dashboard und geben einen sauberen (nicht tokenisierten) Link aus. Wenn zur Authentifizierung aufgefordert wird, fügen Sie das Token aus `gateway.auth.token` in den Control-UI-Einstellungen ein. Später erneut öffnen: `openclaw dashboard`.

## Geben Sie dem Agenten einen Arbeitsbereich (AGENTS)

OpenClaw liest Betriebsanweisungen und „Gedächtnis“ aus seinem Arbeitsbereichsverzeichnis.

Standardmäßig verwendet OpenClaw `~/.openclaw/workspace` als Agenten-Arbeitsbereich und erstellt ihn (plus die Starter-Dateien `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`) automatisch bei der Einrichtung/ersten Agentenausführung. `BOOTSTRAP.md` wird nur erstellt, wenn der Arbeitsbereich brandneu ist (er sollte nicht zurückkehren, nachdem Sie ihn gelöscht haben).

Tipp: Behandeln Sie diesen Ordner wie OpenClaws „Gedächtnis“ und machen Sie ihn zu einem Git-Repo (idealerweise privat), damit Ihre `AGENTS.md`- und Gedächtnisdateien gesichert sind. Wenn Git installiert ist, werden brandneue Arbeitsbereiche automatisch initialisiert.

```bash
openclaw setup
```

Vollständiges Arbeitsbereichs-Layout + Backup-Leitfaden: [Agent workspace](/concepts/agent-workspace)  
Gedächtnis-Workflow: [Memory](/concepts/memory)

Optional: Wählen Sie einen anderen Arbeitsbereich mit `agents.defaults.workspace` (unterstützt `~`).

```json5
{
  agent: {
    workspace: "~/.openclaw/workspace",
  },
}
```

Wenn Sie bereits eigene Arbeitsbereichsdateien aus einem Repo ausliefern, können Sie die Erstellung von Bootstrap-Dateien vollständig deaktivieren:

```json5
{
  agent: {
    skipBootstrap: true,
  },
}
```

## Die Konfiguration, die es zu „einem Assistenten“ macht

OpenClaw bringt standardmäßig eine gute Assistenten-Konfiguration mit, aber üblicherweise möchten Sie Folgendes anpassen:

- Persona/Anweisungen in `SOUL.md`
- Denk-Standardeinstellungen (falls gewünscht)
- Heartbeats (sobald Sie ihm vertrauen)

Beispiel:

```json5
{
  logging: { level: "info" },
  agent: {
    model: "anthropic/claude-opus-4-6",
    workspace: "~/.openclaw/workspace",
    thinkingDefault: "high",
    timeoutSeconds: 1800,
    // Start with 0; enable later.
    heartbeat: { every: "0m" },
  },
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  routing: {
    groupChat: {
      mentionPatterns: ["@openclaw", "openclaw"],
    },
  },
  session: {
    scope: "per-sender",
    resetTriggers: ["/new", "/reset"],
    reset: {
      mode: "daily",
      atHour: 4,
      idleMinutes: 10080,
    },
  },
}
```

## Sitzungen und Gedächtnis

- Sitzungsdateien: `~/.openclaw/agents/<agentId>/sessions/{{SessionId}}.jsonl`
- Sitzungsmetadaten (Token-Nutzung, letzte Route usw.): `~/.openclaw/agents/<agentId>/sessions/sessions.json` (Legacy: `~/.openclaw/sessions/sessions.json`)
- `/new` oder `/reset` startet eine neue Sitzung für diesen Chat (konfigurierbar über `resetTriggers`). Wird es allein gesendet, antwortet der Agent mit einem kurzen Hallo zur Bestätigung des Resets.
- `/compact [instructions]` verdichtet den Sitzungskontext und meldet das verbleibende Kontextbudget.

## Heartbeats (proaktiver Modus)

Standardmäßig führt OpenClaw alle 30 Minuten einen Heartbeat mit folgendem Prompt aus:
`Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
Setzen Sie `agents.defaults.heartbeat.every: "0m"`, um ihn zu deaktivieren.

- Wenn `HEARTBEAT.md` existiert, aber faktisch leer ist (nur Leerzeilen und Markdown-Überschriften wie `# Heading`), überspringt OpenClaw den Heartbeat-Lauf, um API-Aufrufe zu sparen.
- Wenn die Datei fehlt, läuft der Heartbeat dennoch und das Modell entscheidet, was zu tun ist.
- Wenn der Agent mit `HEARTBEAT_OK` antwortet (optional mit kurzem Padding; siehe `agents.defaults.heartbeat.ackMaxChars`), unterdrückt OpenClaw die ausgehende Zustellung für diesen Heartbeat.
- Heartbeats führen vollständige Agenten-Züge aus — kürzere Intervalle verbrauchen mehr Tokens.

```json5
{
  agent: {
    heartbeat: { every: "30m" },
  },
}
```

## Medien ein- und ausgehend

Eingehende Anhänge (Bilder/Audio/Dokumente) können über Templates an Ihren Befehl übergeben werden:

- `{{MediaPath}}` (lokaler temporärer Dateipfad)
- `{{MediaUrl}}` (Pseudo-URL)
- `{{Transcript}}` (falls Audiotranskription aktiviert ist)

Ausgehende Anhänge vom Agenten: Fügen Sie `MEDIA:<path-or-url>` in einer eigenen Zeile ein (keine Leerzeichen). Beispiel:

```
Here’s the screenshot.
MEDIA:https://example.com/screenshot.png
```

OpenClaw extrahiert diese und sendet sie zusammen mit dem Text als Medien.

## Betriebs-Checkliste

```bash
openclaw status          # local status (creds, sessions, queued events)
openclaw status --all    # full diagnosis (read-only, pasteable)
openclaw status --deep   # adds gateway health probes (Telegram + Discord)
openclaw health --json   # gateway health snapshot (WS)
```

Logs liegen unter `/tmp/openclaw/` (Standard: `openclaw-YYYY-MM-DD.log`).

## Nächste Schritte

- WebChat: [WebChat](/web/webchat)
- Gateway-Betrieb: [Gateway runbook](/gateway)
- Cron + Wakeups: [Cron jobs](/automation/cron-jobs)
- macOS-Menüleisten-Begleit-App: [OpenClaw macOS app](/platforms/macos)
- iOS-Node-App: [iOS app](/platforms/ios)
- Android-Node-App: [Android app](/platforms/android)
- Windows-Status: [Windows (WSL2)](/platforms/windows)
- Linux-Status: [Linux app](/platforms/linux)
- Sicherheit: [Security](/gateway/security)
