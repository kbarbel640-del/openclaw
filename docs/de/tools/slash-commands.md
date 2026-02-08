---
summary: "Slash-Befehle: Text vs. nativ, Konfiguration und unterstützte Befehle"
read_when:
  - Verwendung oder Konfiguration von Chat-Befehlen
  - Debugging der Befehlsweiterleitung oder Berechtigungen
title: "Slash-Befehle"
x-i18n:
  source_path: tools/slash-commands.md
  source_hash: ca0deebf89518e8c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:06:10Z
---

# Slash-Befehle

Befehle werden vom Gateway verarbeitet. Die meisten Befehle müssen als **eigenständige** Nachricht gesendet werden, die mit `/` beginnt.
Der nur für den Host verfügbare Bash-Chatbefehl verwendet `! <cmd>` (mit `/bash <cmd>` als Alias).

Es gibt zwei verwandte Systeme:

- **Befehle**: eigenständige `/...`-Nachrichten.
- **Direktiven**: `/think`, `/verbose`, `/reasoning`, `/elevated`, `/exec`, `/model`, `/queue`.
  - Direktiven werden aus der Nachricht entfernt, bevor das Modell sie sieht.
  - In normalen Chatnachrichten (nicht nur Direktiven) werden sie als „Inline-Hinweise“ behandelt und **persistieren** keine Sitzungseinstellungen.
  - In Nachrichten, die nur aus Direktiven bestehen (die Nachricht enthält ausschließlich Direktiven), werden sie in der Sitzung persistiert und beantworten mit einer Bestätigung.
  - Direktiven werden nur für **autorisierte Absender** angewendet (Kanal-Allowlisten/Pairing plus `commands.useAccessGroups`).
    Nicht autorisierte Absender sehen Direktiven als normalen Text.

Es gibt außerdem einige **Inline-Shortcuts** (nur allowlistete/autorisierte Absender): `/help`, `/commands`, `/status`, `/whoami` (`/id`).
Sie werden sofort ausgeführt, vor dem Modell entfernt, und der verbleibende Text durchläuft den normalen Ablauf.

## Konfiguration

```json5
{
  commands: {
    native: "auto",
    nativeSkills: "auto",
    text: true,
    bash: false,
    bashForegroundMs: 2000,
    config: false,
    debug: false,
    restart: false,
    useAccessGroups: true,
  },
}
```

- `commands.text` (Standard `true`) aktiviert das Parsen von `/...` in Chatnachrichten.
  - Auf Oberflächen ohne native Befehle (WhatsApp/WebChat/Signal/iMessage/Google Chat/MS Teams) funktionieren Textbefehle weiterhin, selbst wenn Sie dies auf `false` setzen.
- `commands.native` (Standard `"auto"`) registriert native Befehle.
  - Auto: ein für Discord/Telegram; aus für Slack (bis Sie Slash-Befehle hinzufügen); ignoriert für Anbieter ohne native Unterstützung.
  - Setzen Sie `channels.discord.commands.native`, `channels.telegram.commands.native` oder `channels.slack.commands.native`, um pro Anbieter zu überschreiben (Bool oder `"auto"`).
  - `false` löscht zuvor registrierte Befehle auf Discord/Telegram beim Start. Slack-Befehle werden in der Slack-App verwaltet und nicht automatisch entfernt.
- `commands.nativeSkills` (Standard `"auto"`) registriert **Skill**-Befehle nativ, wenn unterstützt.
  - Auto: ein für Discord/Telegram; aus für Slack (Slack erfordert das Erstellen eines Slash-Befehls pro Skill).
  - Setzen Sie `channels.discord.commands.nativeSkills`, `channels.telegram.commands.nativeSkills` oder `channels.slack.commands.nativeSkills`, um pro Anbieter zu überschreiben (Bool oder `"auto"`).
- `commands.bash` (Standard `false`) aktiviert `! <cmd>` zum Ausführen von Host-Shellbefehlen (`/bash <cmd>` ist ein Alias; erfordert `tools.elevated`-Allowlisten).
- `commands.bashForegroundMs` (Standard `2000`) steuert, wie lange Bash wartet, bevor in den Hintergrundmodus gewechselt wird (`0` hinterlegt sofort im Hintergrund).
- `commands.config` (Standard `false`) aktiviert `/config` (liest/schreibt `openclaw.json`).
- `commands.debug` (Standard `false`) aktiviert `/debug` (nur Laufzeit-Overrides).
- `commands.useAccessGroups` (Standard `true`) erzwingt Allowlisten/Richtlinien für Befehle.

## Befehlsliste

Text + nativ (wenn aktiviert):

- `/help`
- `/commands`
- `/skill <name> [input]` (führt einen Skill nach Name aus)
- `/status` (zeigt den aktuellen Status; enthält Anbieter-Nutzung/Kontingent für den aktuellen Modellanbieter, wenn verfügbar)
- `/allowlist` (Allowlist-Einträge auflisten/hinzufügen/entfernen)
- `/approve <id> allow-once|allow-always|deny` (Exec-Genehmigungsaufforderungen auflösen)
- `/context [list|detail|json]` (erklärt „Kontext“; `detail` zeigt Größe pro Datei + pro Werkzeug + pro Skill + System-Prompt)
- `/whoami` (zeigt Ihre Absender-ID; Alias: `/id`)
- `/subagents list|stop|log|info|send` (Sub-Agent-Ausführungen für die aktuelle Sitzung inspizieren, stoppen, protokollieren oder Nachrichten senden)
- `/config show|get|set|unset` (persistiert Konfiguration auf Datenträger, nur Owner; erfordert `commands.config: true`)
- `/debug show|set|unset|reset` (Laufzeit-Overrides, nur Owner; erfordert `commands.debug: true`)
- `/usage off|tokens|full|cost` (Nutzungsfußzeile pro Antwort oder lokale Kostenübersicht)
- `/tts off|always|inbound|tagged|status|provider|limit|summary|audio` (TTS steuern; siehe [/tts](/tts))
  - Discord: nativer Befehl ist `/voice` (Discord reserviert `/tts`); Text `/tts` funktioniert weiterhin.
- `/stop`
- `/restart`
- `/dock-telegram` (Alias: `/dock_telegram`) (Antworten auf Telegram umschalten)
- `/dock-discord` (Alias: `/dock_discord`) (Antworten auf Discord umschalten)
- `/dock-slack` (Alias: `/dock_slack`) (Antworten auf Slack umschalten)
- `/activation mention|always` (nur Gruppen)
- `/send on|off|inherit` (nur Owner)
- `/reset` oder `/new [model]` (optionaler Modellhinweis; Rest wird durchgereicht)
- `/think <off|minimal|low|medium|high|xhigh>` (dynamische Auswahl nach Modell/Anbieter; Aliasse: `/thinking`, `/t`)
- `/verbose on|full|off` (Alias: `/v`)
- `/reasoning on|off|stream` (Alias: `/reason`; wenn aktiv, sendet eine separate Nachricht mit Präfix `Reasoning:`; `stream` = nur Telegram-Entwurf)
- `/elevated on|off|ask|full` (Alias: `/elev`; `full` überspringt Exec-Genehmigungen)
- `/exec host=<sandbox|gateway|node> security=<deny|allowlist|full> ask=<off|on-miss|always> node=<id>` (senden Sie `/exec`, um den aktuellen Stand anzuzeigen)
- `/model <name>` (Alias: `/models`; oder `/<alias>` aus `agents.defaults.models.*.alias`)
- `/queue <mode>` (plus Optionen wie `debounce:2s cap:25 drop:summarize`; senden Sie `/queue`, um die aktuellen Einstellungen anzuzeigen)
- `/bash <command>` (nur Host; Alias für `! <command>`; erfordert `commands.bash: true` + `tools.elevated`-Allowlisten)

Nur Text:

- `/compact [instructions]` (siehe [/concepts/compaction](/concepts/compaction))
- `! <command>` (nur Host; jeweils einer; verwenden Sie `!poll` + `!stop` für lang laufende Jobs)
- `!poll` (Ausgabe/Status prüfen; akzeptiert optional `sessionId`; `/bash poll` funktioniert ebenfalls)
- `!stop` (den laufenden Bash-Job stoppen; akzeptiert optional `sessionId`; `/bash stop` funktioniert ebenfalls)

Hinweise:

- Befehle akzeptieren optional ein `:` zwischen Befehl und Argumenten (z. B. `/think: high`, `/send: on`, `/help:`).
- `/new <model>` akzeptiert einen Modell-Alias, `provider/model` oder einen Anbieternamen (unscharfe Übereinstimmung); bei keiner Übereinstimmung wird der Text als Nachrichteninhalt behandelt.
- Für eine vollständige Aufschlüsselung der Anbieter-Nutzung verwenden Sie `openclaw status --usage`.
- `/allowlist add|remove` erfordert `commands.config=true` und berücksichtigt Kanal-`configWrites`.
- `/usage` steuert die Nutzungsfußzeile pro Antwort; `/usage cost` gibt eine lokale Kostenübersicht aus OpenClaw-Sitzungsprotokollen aus.
- `/restart` ist standardmäßig deaktiviert; setzen Sie `commands.restart: true`, um es zu aktivieren.
- `/verbose` ist für Debugging und zusätzliche Sichtbarkeit gedacht; halten Sie es im Normalbetrieb **aus**.
- `/reasoning` (und `/verbose`) sind in Gruppeneinstellungen riskant: Sie können interne Überlegungen oder Werkzeugausgaben offenlegen, die Sie nicht beabsichtigt haben. Lassen Sie sie vorzugsweise deaktiviert, insbesondere in Gruppenchats.
- **Schneller Pfad:** reine Befehlsnachrichten von allowlisteten Absendern werden sofort verarbeitet (Queue + Modell werden umgangen).
- **Gruppen-Erwähnungs-Gating:** reine Befehlsnachrichten von allowlisteten Absendern umgehen Erwähnungsanforderungen.
- **Inline-Shortcuts (nur allowlistete Absender):** bestimmte Befehle funktionieren auch, wenn sie in eine normale Nachricht eingebettet sind, und werden entfernt, bevor das Modell den verbleibenden Text sieht.
  - Beispiel: `hey /status` löst eine Statusantwort aus, und der verbleibende Text durchläuft den normalen Ablauf.
- Derzeit: `/help`, `/commands`, `/status`, `/whoami` (`/id`).
- Nicht autorisierte reine Befehlsnachrichten werden stillschweigend ignoriert, und Inline-`/...`-Token werden als normaler Text behandelt.
- **Skill-Befehle:** `user-invocable` Skills werden als Slash-Befehle verfügbar gemacht. Namen werden zu `a-z0-9_` bereinigt (max. 32 Zeichen); Kollisionen erhalten numerische Suffixe (z. B. `_2`).
  - `/skill <name> [input]` führt einen Skill nach Name aus (nützlich, wenn native Befehlslimits per Skill verhindern).
  - Standardmäßig werden Skill-Befehle als normale Anfrage an das Modell weitergeleitet.
  - Skills können optional `command-dispatch: tool` deklarieren, um den Befehl direkt an ein Werkzeug zu routen (deterministisch, ohne Modell).
  - Beispiel: `/prose` (OpenProse-Plugin) — siehe [OpenProse](/prose).
- **Argumente nativer Befehle:** Discord verwendet Autovervollständigung für dynamische Optionen (und Button-Menüs, wenn Sie erforderliche Argumente weglassen). Telegram und Slack zeigen ein Button-Menü, wenn ein Befehl Auswahlmöglichkeiten unterstützt und Sie das Argument weglassen.

## Nutzungsoberflächen (was wo angezeigt wird)

- **Anbieter-Nutzung/Kontingent** (Beispiel: „Claude 80 % übrig“) wird in `/status` für den aktuellen Modellanbieter angezeigt, wenn die Nutzungsverfolgung aktiviert ist.
- **Tokens/Kosten pro Antwort** werden durch `/usage off|tokens|full` gesteuert (an normale Antworten angehängt).
- `/model status` bezieht sich auf **Modelle/Auth/Endpunkte**, nicht auf Nutzung.

## Modellauswahl (`/model`)

`/model` ist als Direktive implementiert.

Beispiele:

```
/model
/model list
/model 3
/model openai/gpt-5.2
/model opus@anthropic:default
/model status
```

Hinweise:

- `/model` und `/model list` zeigen einen kompakten, nummerierten Picker (Modellfamilie + verfügbare Anbieter).
- `/model <#>` wählt aus diesem Picker (und bevorzugt, wenn möglich, den aktuellen Anbieter).
- `/model status` zeigt die Detailansicht, einschließlich konfiguriertem Anbieter-Endpunkt (`baseUrl`) und API-Modus (`api`), sofern verfügbar.

## Debug-Overrides

`/debug` ermöglicht das Setzen von **nur zur Laufzeit** gültigen Konfigurations-Overrides (Speicher, nicht Datenträger). Nur Owner. Standardmäßig deaktiviert; aktivieren Sie es mit `commands.debug: true`.

Beispiele:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug set channels.whatsapp.allowFrom=["+1555","+4477"]
/debug unset messages.responsePrefix
/debug reset
```

Hinweise:

- Overrides gelten sofort für neue Konfigurationslesevorgänge, schreiben jedoch **nicht** nach `openclaw.json`.
- Verwenden Sie `/debug reset`, um alle Overrides zu löschen und zur Konfiguration auf Datenträger zurückzukehren.

## Konfigurationsaktualisierungen

`/config` schreibt in Ihre Konfiguration auf Datenträger (`openclaw.json`). Nur Owner. Standardmäßig deaktiviert; aktivieren Sie es mit `commands.config: true`.

Beispiele:

```
/config show
/config show messages.responsePrefix
/config get messages.responsePrefix
/config set messages.responsePrefix="[openclaw]"
/config unset messages.responsePrefix
```

Hinweise:

- Die Konfiguration wird vor dem Schreiben validiert; ungültige Änderungen werden abgelehnt.
- `/config`-Aktualisierungen bleiben über Neustarts hinweg bestehen.

## Oberflächenhinweise

- **Textbefehle** laufen in der normalen Chat-Sitzung (Direktnachrichten teilen `main`, Gruppen haben ihre eigene Sitzung).
- **Native Befehle** verwenden isolierte Sitzungen:
  - Discord: `agent:<agentId>:discord:slash:<userId>`
  - Slack: `agent:<agentId>:slack:slash:<userId>` (Präfix über `channels.slack.slashCommand.sessionPrefix` konfigurierbar)
  - Telegram: `telegram:slash:<userId>` (zielt über `CommandTargetSessionKey` auf die Chat-Sitzung)
- **`/stop`** zielt auf die aktive Chat-Sitzung, sodass der aktuelle Lauf abgebrochen werden kann.
- **Slack:** `channels.slack.slashCommand` wird weiterhin für einen einzelnen `/openclaw`-artigen Befehl unterstützt. Wenn Sie `commands.native` aktivieren, müssen Sie einen Slack-Slash-Befehl pro integriertem Befehl erstellen (gleiche Namen wie `/help`). Befehlsargument-Menüs für Slack werden als ephemere Block-Kit-Buttons ausgeliefert.
