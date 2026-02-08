---
summary: „Gateway-Lebenszyklus auf macOS (launchd)“
read_when:
  - Integration der mac-App in den Gateway-Lebenszyklus
title: „Gateway-Lebenszyklus“
x-i18n:
  source_path: platforms/mac/child-process.md
  source_hash: 9b910f574b723bc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:58Z
---

# Gateway-Lebenszyklus auf macOS

Die macOS-App **verwaltet das Gateway standardmäßig über launchd** und startet
das Gateway **nicht** als Child-Process. Zunächst versucht sie, sich an ein bereits
laufendes Gateway auf dem konfigurierten Port anzuhängen; ist keines erreichbar,
aktiviert sie den launchd-Dienst über die externe `openclaw` CLI (keine
eingebettete Laufzeit). Dadurch erhalten Sie einen zuverlässigen Auto-Start bei
der Anmeldung und einen Neustart nach Abstürzen.

Der Child-Process-Modus (Gateway wird direkt von der App gestartet) ist derzeit
**nicht in Verwendung**. Wenn Sie eine engere Kopplung an die UI benötigen,
führen Sie das Gateway manuell in einem Terminal aus.

## Standardverhalten (launchd)

- Die App installiert einen benutzerspezifischen LaunchAgent mit dem Label
  `bot.molt.gateway` (oder `bot.molt.<profile>` bei Verwendung von `--profile`/`OPENCLAW_PROFILE`;
  das Legacy-Label `com.openclaw.*` wird unterstützt).
- Wenn der lokale Modus aktiviert ist, stellt die App sicher, dass der LaunchAgent
  geladen ist, und startet das Gateway bei Bedarf.
- Logs werden in den launchd-Gateway-Logpfad geschrieben (sichtbar in den Debug-Einstellungen).

Gängige Befehle:

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

Ersetzen Sie das Label durch `bot.molt.<profile>`, wenn Sie ein benanntes Profil ausführen.

## Unsigned Dev-Builds

`scripts/restart-mac.sh --no-sign` ist für schnelle lokale Builds gedacht, wenn Sie keine
Signierschlüssel haben. Um zu verhindern, dass launchd auf ein unsigniertes
Relay-Binary zeigt, wird:

- `~/.openclaw/disable-launchagent` geschrieben.

Signierte Ausführungen von `scripts/restart-mac.sh` entfernen diese Überschreibung, falls
der Marker vorhanden ist. Zum manuellen Zurücksetzen:

```bash
rm ~/.openclaw/disable-launchagent
```

## Attach-only-Modus

Um die macOS-App zu zwingen, **niemals launchd zu installieren oder zu verwalten**,
starten Sie sie mit `--attach-only` (oder `--no-launchd`). Dadurch wird
`~/.openclaw/disable-launchagent` gesetzt, sodass sich die App ausschließlich an ein bereits
laufendes Gateway anhängt. Dasselbe Verhalten können Sie in den Debug-Einstellungen
umschalten.

## Remote-Modus

Der Remote-Modus startet niemals ein lokales Gateway. Die App verwendet einen
SSH-Tunnel zum Remote-Host und verbindet sich über diesen Tunnel.

## Warum wir launchd bevorzugen

- Auto-Start bei der Anmeldung.
- Integrierte Neustart-/KeepAlive-Semantik.
- Vorhersehbare Logs und Überwachung.

Sollte jemals wieder ein echter Child-Process-Modus benötigt werden, sollte er
als separater, expliziter Dev-only-Modus dokumentiert werden.
