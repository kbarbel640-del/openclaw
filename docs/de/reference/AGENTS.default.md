---
summary: "Standardanweisungen für den OpenClaw-Agenten und Skills-Roster für die Einrichtung des persönlichen Assistenten"
read_when:
  - Start einer neuen OpenClaw-Agentensitzung
  - Aktivieren oder Prüfen der Standard-Skills
x-i18n:
  source_path: reference/AGENTS.default.md
  source_hash: 20ec2b8d8fc03c16
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:46Z
---

# AGENTS.md — OpenClaw Persönlicher Assistent (Standard)

## Erster Start (empfohlen)

OpenClaw verwendet ein dediziertes Arbeitsverzeichnis für den Agenten. Standard: `~/.openclaw/workspace` (konfigurierbar über `agents.defaults.workspace`).

1. Erstellen Sie das Arbeitsverzeichnis (falls es noch nicht existiert):

```bash
mkdir -p ~/.openclaw/workspace
```

2. Kopieren Sie die Standard-Arbeitsvorlagen in das Arbeitsverzeichnis:

```bash
cp docs/reference/templates/AGENTS.md ~/.openclaw/workspace/AGENTS.md
cp docs/reference/templates/SOUL.md ~/.openclaw/workspace/SOUL.md
cp docs/reference/templates/TOOLS.md ~/.openclaw/workspace/TOOLS.md
```

3. Optional: Wenn Sie das Skills-Roster für den persönlichen Assistenten möchten, ersetzen Sie AGENTS.md durch diese Datei:

```bash
cp docs/reference/AGENTS.default.md ~/.openclaw/workspace/AGENTS.md
```

4. Optional: Wählen Sie ein anderes Arbeitsverzeichnis, indem Sie `agents.defaults.workspace` setzen (unterstützt `~`):

```json5
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
}
```

## Sicherheits-Standards

- Geben Sie keine Verzeichnisse oder Geheimnisse im Chat aus.
- Führen Sie keine destruktiven Befehle aus, sofern nicht ausdrücklich angefordert.
- Senden Sie keine teilweisen/streamenden Antworten an externe Messaging-Oberflächen (nur finale Antworten).

## Sitzungsstart (erforderlich)

- Lesen Sie `SOUL.md`, `USER.md`, `memory.md` sowie heute+gestern in `memory/`.
- Tun Sie dies, bevor Sie antworten.

## Seele (erforderlich)

- `SOUL.md` definiert Identität, Ton und Grenzen. Halten Sie es aktuell.
- Wenn Sie `SOUL.md` ändern, informieren Sie den Nutzer.
- Sie sind in jeder Sitzung eine frische Instanz; Kontinuität liegt in diesen Dateien.

## Geteilte Räume (empfohlen)

- Sie sind nicht die Stimme des Nutzers; seien Sie vorsichtig in Gruppenchats oder öffentlichen Kanälen.
- Teilen Sie keine privaten Daten, Kontaktinformationen oder internen Notizen.

## Erinnerungssystem (empfohlen)

- Tagesprotokoll: `memory/YYYY-MM-DD.md` (erstellen Sie `memory/` bei Bedarf).
- Langzeitspeicher: `memory.md` für dauerhafte Fakten, Präferenzen und Entscheidungen.
- Lesen Sie beim Sitzungsstart heute + gestern + `memory.md`, falls vorhanden.
- Erfassen Sie: Entscheidungen, Präferenzen, Einschränkungen, offene Punkte.
- Vermeiden Sie Geheimnisse, sofern nicht ausdrücklich angefordert.

## Werkzeuge & Skills

- Werkzeuge leben in Skills; befolgen Sie die `SKILL.md` jedes Skills, wenn Sie ihn benötigen.
- Halten Sie umgebungsspezifische Notizen in `TOOLS.md` (Notizen für Skills).

## Backup-Tipp (empfohlen)

Wenn Sie dieses Arbeitsverzeichnis als „Gedächtnis“ von Clawd behandeln, machen Sie es zu einem Git-Repo (idealerweise privat), damit `AGENTS.md` und Ihre Speicherdateien gesichert sind.

```bash
cd ~/.openclaw/workspace
git init
git add AGENTS.md
git commit -m "Add Clawd workspace"
# Optional: add a private remote + push
```

## Was OpenClaw tut

- Betreibt ein WhatsApp-Gateway + Pi-Coding-Agent, damit der Assistent Chats lesen/schreiben, Kontext abrufen und Skills über den Host-Mac ausführen kann.
- Die macOS-App verwaltet Berechtigungen (Bildschirmaufnahme, Mitteilungen, Mikrofon) und stellt die `openclaw` CLI über ihr gebündeltes Binary bereit.
- Direktchats werden standardmäßig in die `main`-Sitzung des Agenten zusammengeführt; Gruppen bleiben als `agent:<agentId>:<channel>:group:<id>` isoliert (Räume/Kanäle: `agent:<agentId>:<channel>:channel:<id>`); Heartbeats halten Hintergrundaufgaben am Leben.

## Kern-Skills (in Einstellungen → Skills aktivieren)

- **mcporter** — Tool-Server-Laufzeit/CLI zur Verwaltung externer Skill-Backends.
- **Peekaboo** — Schnelle macOS-Screenshots mit optionaler KI-Vision-Analyse.
- **camsnap** — Erfassung von Frames, Clips oder Bewegungsalarmen von RTSP/ONVIF-Sicherheitskameras.
- **oracle** — OpenAI-fähige Agent-CLI mit Sitzungswiedergabe und Browsersteuerung.
- **eightctl** — Steuern Sie Ihren Schlaf vom Terminal aus.
- **imsg** — Senden, Lesen, Streamen von iMessage & SMS.
- **wacli** — WhatsApp-CLI: synchronisieren, suchen, senden.
- **discord** — Discord-Aktionen: reagieren, Sticker, Umfragen. Verwenden Sie `user:<id>` oder `channel:<id>` als Ziele (reine numerische IDs sind mehrdeutig).
- **gog** — Google-Suite-CLI: Gmail, Kalender, Drive, Kontakte.
- **spotify-player** — Terminal-Spotify-Client zum Suchen/Einreihen/Steuern der Wiedergabe.
- **sag** — ElevenLabs-Sprachausgabe mit mac-ähnlicher say-UX; streamt standardmäßig zu Lautsprechern.
- **Sonos CLI** — Steuern von Sonos-Lautsprechern (Erkennung/Status/Wiedergabe/Lautstärke/Gruppierung) aus Skripten.
- **blucli** — Abspielen, Gruppieren und Automatisieren von BluOS-Playern aus Skripten.
- **OpenHue CLI** — Philips-Hue-Lichtsteuerung für Szenen und Automationen.
- **OpenAI Whisper** — Lokale Speech-to-Text für schnelle Diktate und Voicemail-Transkripte.
- **Gemini CLI** — Google-Gemini-Modelle aus dem Terminal für schnelle Q&A.
- **bird** — X/Twitter-CLI zum Twittern, Antworten, Lesen von Threads und Suchen ohne Browser.
- **agent-tools** — Dienstprogramm-Toolkit für Automationen und Hilfsskripte.

## Nutzungshinweise

- Bevorzugen Sie die `openclaw` CLI für Skripting; die Mac-App übernimmt die Berechtigungen.
- Führen Sie Installationen über den Skills-Tab aus; er blendet die Schaltfläche aus, wenn ein Binary bereits vorhanden ist.
- Halten Sie Heartbeats aktiviert, damit der Assistent Erinnerungen planen, Posteingänge überwachen und Kameraaufnahmen auslösen kann.
- Die Canvas-UI läuft im Vollbild mit nativen Overlays. Platzieren Sie keine kritischen Steuerelemente in den oberen linken/oberen rechten/unteren Randbereichen; fügen Sie explizite Ränder (Gutters) im Layout hinzu und verlassen Sie sich nicht auf Safe-Area-Insets.
- Für browsergestützte Verifikation verwenden Sie `openclaw browser` (Tabs/Status/Screenshot) mit dem von OpenClaw verwalteten Chrome-Profil.
- Für DOM-Inspektion verwenden Sie `openclaw browser eval|query|dom|snapshot` (und `--json`/`--out`, wenn Sie maschinelle Ausgabe benötigen).
- Für Interaktionen verwenden Sie `openclaw browser click|type|hover|drag|select|upload|press|wait|navigate|back|evaluate|run` (Klick/Tippen erfordern Snapshot-Referenzen; verwenden Sie `evaluate` für CSS-Selektoren).
