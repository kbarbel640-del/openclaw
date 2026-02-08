---
summary: "Doctor-Befehl: Gesundheitsprüfungen, Konfigurationsmigrationen und Reparaturschritte"
read_when:
  - Hinzufuegen oder Aendern von Doctor-Migrationen
  - Einfuehren von inkompatiblen Konfigurationsaenderungen
title: "Doctor"
x-i18n:
  source_path: gateway/doctor.md
  source_hash: df7b25f60fd08d50
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:51Z
---

# Doctor

`openclaw doctor` ist das Reparatur- und Migrationswerkzeug fuer OpenClaw. Es behebt
veraltete Konfigurationen/Zustaende, prueft den Zustand und stellt umsetzbare
Reparaturschritte bereit.

## Schnellstart

```bash
openclaw doctor
```

### Headless / Automatisierung

```bash
openclaw doctor --yes
```

Akzeptiert Standardwerte ohne Rueckfrage (einschliesslich Neustart-/Service-/Sandbox-Reparaturschritten, falls zutreffend).

```bash
openclaw doctor --repair
```

Wendet empfohlene Reparaturen ohne Rueckfrage an (Reparaturen + Neustarts, wo sicher).

```bash
openclaw doctor --repair --force
```

Wendet auch aggressive Reparaturen an (ueberschreibt benutzerdefinierte Supervisor-Konfigurationen).

```bash
openclaw doctor --non-interactive
```

Fuehrt ohne Rueckfragen aus und wendet nur sichere Migrationen an (Konfigurationsnormalisierung + Verschieben von Zustandsdaten auf dem Datentraeger). Ueberspringt Neustart-/Service-/Sandbox-Aktionen, die eine menschliche Bestaetigung erfordern.
Legacy-Zustandsmigrationen laufen automatisch, wenn sie erkannt werden.

```bash
openclaw doctor --deep
```

Durchsucht Systemdienste nach zusaetzlichen Gateway-Installationen (launchd/systemd/schtasks).

Wenn Sie Aenderungen vor dem Schreiben pruefen moechten, oeffnen Sie zuerst die Konfigurationsdatei:

```bash
cat ~/.openclaw/openclaw.json
```

## Was es tut (Zusammenfassung)

- Optionale Vorab-Aktualisierung fuer Git-Installationen (nur interaktiv).
- Frischepruefung des UI-Protokolls (erstellt die Control UI neu, wenn das Protokollschema neuer ist).
- Gesundheitspruefung + Neustartaufforderung.
- Skills-Statuszusammenfassung (geeignet/fehlend/blockiert).
- Konfigurationsnormalisierung fuer Legacy-Werte.
- Warnungen zu OpenCode-Zen-Anbieterueberschreibungen (`models.providers.opencode`).
- Migration von Legacy-Zustand auf dem Datentraeger (Sitzungen/Agent-Verzeichnis/WhatsApp-Auth).
- Pruefungen von Zustandsintegritaet und Berechtigungen (Sitzungen, Transkripte, Zustandsverzeichnis).
- Pruefungen der Berechtigungen der Konfigurationsdatei (chmod 600) bei lokaler Ausfuehrung.
- Modell-Auth-Zustand: prueft OAuth-Ablauf, kann ablaufende Tokens aktualisieren und meldet Cooldown-/Deaktivierungszustaende von Auth-Profilen.
- Erkennung zusaetzlicher Workspace-Verzeichnisse (`~/openclaw`).
- Reparatur von Sandbox-Images, wenn Sandboxing aktiviert ist.
- Migration von Legacy-Diensten und Erkennung zusaetzlicher Gateways.
- Gateway-Laufzeitpruefungen (Dienst installiert, aber nicht laufend; zwischengespeichertes launchd-Label).
- Kanalstatuswarnungen (vom laufenden Gateway sondiert).
- Audit der Supervisor-Konfiguration (launchd/systemd/schtasks) mit optionaler Reparatur.
- Best-Practice-Pruefungen der Gateway-Laufzeit (Node vs. Bun, Pfade von Versionsmanagern).
- Diagnose von Gateway-Portkollisionen (Standard `18789`).
- Sicherheitswarnungen bei offenen DM-Richtlinien.
- Gateway-Auth-Warnungen, wenn kein `gateway.auth.token` gesetzt ist (lokaler Modus; bietet Token-Generierung an).
- systemd-linger-Pruefung unter Linux.
- Pruefungen von Quellinstallationen (pnpm-Workspace-Mismatch, fehlende UI-Assets, fehlendes tsx-Binary).
- Schreibt aktualisierte Konfiguration + Assistenten-Metadaten.

## Detailliertes Verhalten und Begruendung

### 0) Optionale Aktualisierung (Git-Installationen)

Wenn dies ein Git-Checkout ist und Doctor interaktiv ausgefuehrt wird, bietet es
vor dem Ausfuehren von Doctor ein Update (fetch/rebase/build) an.

### 1) Konfigurationsnormalisierung

Wenn die Konfiguration Legacy-Werteformen enthaelt (z. B. `messages.ackReaction`
ohne kanalspezifische Ueberschreibung), normalisiert Doctor diese in das aktuelle
Schema.

### 2) Migrationen von Legacy-Konfigurationsschluesseln

Wenn die Konfiguration veraltete Schluessel enthaelt, verweigern andere Befehle
die Ausfuehrung und fordern Sie auf, `openclaw doctor` auszufuehren.

Doctor wird:

- Erklaeren, welche Legacy-Schluessel gefunden wurden.
- Die angewendete Migration anzeigen.
- `~/.openclaw/openclaw.json` mit dem aktualisierten Schema neu schreiben.

Das Gateway fuehrt Doctor-Migrationen beim Start auch automatisch aus, wenn es ein
Legacy-Konfigurationsformat erkennt, sodass veraltete Konfigurationen ohne
manuelles Eingreifen repariert werden.

Aktuelle Migrationen:

- `routing.allowFrom` → `channels.whatsapp.allowFrom`
- `routing.groupChat.requireMention` → `channels.whatsapp/telegram/imessage.groups."*".requireMention`
- `routing.groupChat.historyLimit` → `messages.groupChat.historyLimit`
- `routing.groupChat.mentionPatterns` → `messages.groupChat.mentionPatterns`
- `routing.queue` → `messages.queue`
- `routing.bindings` → oberste Ebene `bindings`
- `routing.agents`/`routing.defaultAgentId` → `agents.list` + `agents.list[].default`
- `routing.agentToAgent` → `tools.agentToAgent`
- `routing.transcribeAudio` → `tools.media.audio.models`
- `bindings[].match.accountID` → `bindings[].match.accountId`
- `identity` → `agents.list[].identity`
- `agent.*` → `agents.defaults` + `tools.*` (tools/elevated/exec/sandbox/subagents)
- `agent.model`/`allowedModels`/`modelAliases`/`modelFallbacks`/`imageModelFallbacks`
  → `agents.defaults.models` + `agents.defaults.model.primary/fallbacks` + `agents.defaults.imageModel.primary/fallbacks`

### 2b) OpenCode-Zen-Anbieterueberschreibungen

Wenn Sie `models.providers.opencode` (oder `opencode-zen`) manuell hinzugefuegt haben,
ueberschreibt dies den integrierten OpenCode-Zen-Katalog aus `@mariozechner/pi-ai`.
Das kann jedes Modell auf eine einzelne API zwingen oder Kosten auf null setzen.
Doctor warnt Sie, damit Sie die Ueberschreibung entfernen und das Routing pro
Modell sowie die Kosten wiederherstellen koennen.

### 3) Migrationen von Legacy-Zustand (Datentraegerlayout)

Doctor kann aeltere On-Disk-Layouts in die aktuelle Struktur migrieren:

- Sitzungsstore + Transkripte:
  - von `~/.openclaw/sessions/` nach `~/.openclaw/agents/<agentId>/sessions/`
- Agent-Verzeichnis:
  - von `~/.openclaw/agent/` nach `~/.openclaw/agents/<agentId>/agent/`
- WhatsApp-Auth-Zustand (Baileys):
  - von Legacy-`~/.openclaw/credentials/*.json` (ausser `oauth.json`)
  - nach `~/.openclaw/credentials/whatsapp/<accountId>/...` (Standard-Account-ID: `default`)

Diese Migrationen sind Best-Effort und idempotent; Doctor gibt Warnungen aus, wenn
Legacy-Ordner als Backups zurueckbleiben. Gateway/CLI migrieren den Legacy-
Sitzungs- und Agent-Ordner beim Start ebenfalls automatisch, sodass Verlauf/Auth/
Modelle ohne manuelle Doctor-Ausfuehrung im agentenspezifischen Pfad landen.
WhatsApp-Auth wird absichtlich nur ueber `openclaw doctor` migriert.

### 4) Zustandsintegritaetspruefungen (Sitzungspersistenz, Routing und Sicherheit)

Das Zustandsverzeichnis ist das operative Rueckenmark. Verschwindet es, verlieren
Sie Sitzungen, Anmeldeinformationen, Logs und Konfiguration (sofern keine Backups
anderswo existieren).

Doctor prueft:

- **Zustandsverzeichnis fehlt**: warnt vor katastrophalem Zustandsverlust, fordert
  zum Neuerstellen des Verzeichnisses auf und erinnert daran, dass fehlende Daten
  nicht wiederhergestellt werden koennen.
- **Berechtigungen des Zustandsverzeichnisses**: ueberprueft Schreibbarkeit; bietet
  eine Reparatur der Berechtigungen an (und gibt einen `chown`-Hinweis aus,
  wenn ein Eigentuer-/Gruppen-Mismatch erkannt wird).
- **Fehlende Sitzungsverzeichnisse**: `sessions/` und das Sitzungsstore-
  Verzeichnis sind erforderlich, um Verlauf zu persistieren und `ENOENT`-
  Abstuerze zu vermeiden.
- **Transkript-Mismatch**: warnt, wenn zu aktuellen Sitzungseintraegen
  Transkriptdateien fehlen.
- **Hauptsitzung „1-zeilige JSONL“**: markiert, wenn das Haupttranskript nur eine
  Zeile hat (Verlauf sammelt sich nicht).
- **Mehrere Zustandsverzeichnisse**: warnt, wenn mehrere `~/.openclaw`-Ordner in
  Home-Verzeichnissen existieren oder wenn `OPENCLAW_STATE_DIR` woandershin zeigt
  (Verlauf kann sich zwischen Installationen aufteilen).
- **Remote-Modus-Hinweis**: wenn `gateway.mode=remote`, erinnert Doctor daran, es auf dem
  Remote-Host auszufuehren (der Zustand liegt dort).
- **Berechtigungen der Konfigurationsdatei**: warnt, wenn `~/.openclaw/openclaw.json` fuer
  Gruppe/Welt lesbar ist, und bietet an, auf `600` zu verschärfen.

### 5) Modell-Auth-Zustand (OAuth-Ablauf)

Doctor untersucht OAuth-Profile im Auth-Store, warnt bei ablaufenden/abgelaufenen
Tokens und kann diese bei Bedarf aktualisieren. Ist das Anthropic-Claude-Code-
Profil veraltet, empfiehlt es die Ausfuehrung von `claude setup-token` (oder das
Einfuegen eines Setup-Tokens). Aktualisierungsaufforderungen erscheinen nur bei
interaktiver Ausfuehrung (TTY); `--non-interactive` ueberspringt Aktualisierungsversuche.

Doctor meldet ausserdem Auth-Profile, die voruebergehend nicht nutzbar sind aufgrund von:

- kurzen Cooldowns (Rate-Limits/Timeouts/Auth-Fehler)
- laengeren Deaktivierungen (Abrechnung/Kreditfehler)

### 6) Validierung des Hooks-Modells

Wenn `hooks.gmail.model` gesetzt ist, validiert Doctor die Modellreferenz gegen den
Katalog und die Allowlist und warnt, wenn sie nicht aufloesbar oder nicht erlaubt ist.

### 7) Reparatur von Sandbox-Images

Wenn Sandboxing aktiviert ist, prueft Doctor Docker-Images und bietet an, diese zu
bauen oder auf Legacy-Namen zu wechseln, falls das aktuelle Image fehlt.

### 8) Migrationen von Gateway-Diensten und Aufraeumhinweise

Doctor erkennt Legacy-Gateway-Dienste (launchd/systemd/schtasks) und bietet an,
diese zu entfernen und den OpenClaw-Dienst mit dem aktuellen Gateway-Port zu
installieren. Es kann ausserdem nach zusaetzlichen gateway-aehnlichen Diensten
scannen und Aufraeumhinweise ausgeben. Profilbenannte OpenClaw-Gateway-Dienste
gelten als erstklassig und werden nicht als „extra“ markiert.

### 9) Sicherheitswarnungen

Doctor gibt Warnungen aus, wenn ein Anbieter fuer Direktnachrichten ohne Allowlist
offen ist oder wenn eine Richtlinie gefaehrlich konfiguriert ist.

### 10) systemd linger (Linux)

Bei Ausfuehrung als systemd-Benutzerdienst stellt Doctor sicher, dass Linger
aktiviert ist, damit das Gateway nach dem Abmelden weiterlaeuft.

### 11) Skills-Status

Doctor gibt eine kurze Zusammenfassung der geeigneten/fehlenden/blockierten Skills
fuer den aktuellen Workspace aus.

### 12) Gateway-Auth-Pruefungen (lokales Token)

Doctor warnt, wenn `gateway.auth` auf einem lokalen Gateway fehlt, und bietet an,
ein Token zu generieren. Verwenden Sie `openclaw doctor --generate-gateway-token`, um die Token-Erstellung in
der Automatisierung zu erzwingen.

### 13) Gateway-Gesundheitspruefung + Neustart

Doctor fuehrt eine Gesundheitspruefung durch und bietet einen Neustart des Gateways
an, wenn es ungesund erscheint.

### 14) Kanalstatuswarnungen

Wenn das Gateway gesund ist, fuehrt Doctor eine Kanalstatussondierung durch und
meldet Warnungen mit vorgeschlagenen Abhilfen.

### 15) Audit + Reparatur der Supervisor-Konfiguration

Doctor prueft die installierte Supervisor-Konfiguration (launchd/systemd/schtasks)
auf fehlende oder veraltete Standardwerte (z. B. systemd-Abhaengigkeiten
network-online und Neustartverzoegerung). Bei Abweichungen empfiehlt es ein Update
und kann die Service-Datei/Aufgabe auf die aktuellen Standardwerte neu schreiben.

Hinweise:

- `openclaw doctor` fragt vor dem Neuschreiben der Supervisor-Konfiguration nach.
- `openclaw doctor --yes` akzeptiert die Standard-Reparaturaufforderungen.
- `openclaw doctor --repair` wendet empfohlene Fixes ohne Rueckfragen an.
- `openclaw doctor --repair --force` ueberschreibt benutzerdefinierte Supervisor-Konfigurationen.
- Eine vollstaendige Neuerstellung kann jederzeit ueber `openclaw gateway install --force` erzwungen werden.

### 16) Gateway-Laufzeit- und Portdiagnose

Doctor untersucht die Service-Laufzeit (PID, letzter Exit-Status) und warnt, wenn
der Dienst installiert, aber nicht tatsaechlich laeuft. Ausserdem prueft es auf
Portkollisionen am Gateway-Port (Standard `18789`) und meldet wahrscheinliche
Ursachen (Gateway laeuft bereits, SSH-Tunnel).

### 17) Best Practices fuer die Gateway-Laufzeit

Doctor warnt, wenn der Gateway-Dienst auf Bun oder einem versionsverwalteten Node-
Pfad laeuft (`nvm`, `fnm`, `volta`, `asdf`, etc.).
WhatsApp- und Telegram-Kanaele erfordern Node, und Versionsmanager-Pfade koennen
nach Upgrades brechen, da der Dienst Ihre Shell-Initialisierung nicht laedt.
Doctor bietet an, auf eine System-Node-Installation zu migrieren, wenn verfuegbar
(Homebrew/apt/choco).

### 18) Konfigurationsschreiben + Assistenten-Metadaten

Doctor speichert saemtliche Konfigurationsaenderungen und versieht die Metadaten
des Assistenten mit einem Stempel, um den Doctor-Lauf zu dokumentieren.

### 19) Workspace-Tipps (Backup + Speichersystem)

Doctor empfiehlt ein Workspace-Speichersystem, wenn es fehlt, und gibt einen
Backup-Tipp aus, wenn der Workspace noch nicht unter Git steht.

Siehe [/concepts/agent-workspace](/concepts/agent-workspace) fuer eine vollstaendige
Anleitung zur Workspace-Struktur und zu Git-Backups (empfohlen: privates GitHub
oder GitLab).
