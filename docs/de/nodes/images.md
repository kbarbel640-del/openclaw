---
summary: "Regeln zur Bild- und Medienverarbeitung für Senden, Gateway und Agent-Antworten"
read_when:
  - "Ändern der Medien-Pipeline oder von Anhängen"
title: "Bild- und Medienunterstützung"
x-i18n:
  source_path: nodes/images.md
  source_hash: 971aed398ea01078
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:52Z
---

# Bild- & Medienunterstützung — 2025-12-05

Der WhatsApp-Kanal läuft über **Baileys Web**. Dieses Dokument beschreibt die aktuellen Regeln zur Medienverarbeitung für Senden, Gateway- und Agent-Antworten.

## Ziele

- Medien mit optionalen Bildunterschriften über `openclaw message send --media` senden.
- Auto-Antworten aus dem Web-Posteingang sollen Medien zusammen mit Text enthalten können.
- Pro-Typ-Limits sinnvoll und vorhersehbar halten.

## CLI-Oberfläche

- `openclaw message send --media <path-or-url> [--message <caption>]`
  - `--media` optional; die Bildunterschrift kann bei reinen Medien-Sends leer sein.
  - `--dry-run` gibt die aufgelöste Payload aus; `--json` emittiert `{ channel, to, messageId, mediaUrl, caption }`.

## Verhalten des WhatsApp-Web-Kanals

- Eingabe: lokaler Dateipfad **oder** HTTP(S)-URL.
- Ablauf: In einen Buffer laden, Medientyp erkennen und die korrekte Payload bauen:
  - **Bilder:** Größenänderung & erneute Komprimierung zu JPEG (max. Seite 2048 px) mit Zielwert `agents.defaults.mediaMaxMb` (Standard 5 MB), begrenzt auf 6 MB.
  - **Audio/Sprachnachricht/Video:** Durchreichen bis 16 MB; Audio wird als Sprachnachricht gesendet (`ptt: true`).
  - **Dokumente:** alles andere, bis 100 MB, mit beibehaltenem Dateinamen, sofern verfügbar.
- WhatsApp-GIF-ähnliche Wiedergabe: Senden eines MP4 mit `gifPlayback: true` (CLI: `--gif-playback`), sodass mobile Clients inline loopen.
- MIME-Erkennung bevorzugt Magic Bytes, dann Header, dann Dateiendung.
- Bildunterschrift stammt aus `--message` oder `reply.text`; eine leere Bildunterschrift ist erlaubt.
- Logging: Nicht-verbose zeigt `↩️`/`✅`; verbose enthält Größe und Quellpfad/URL.

## Auto-Antwort-Pipeline

- `getReplyFromConfig` gibt `{ text?, mediaUrl?, mediaUrls? }` zurück.
- Wenn Medien vorhanden sind, löst der Web-Sender lokale Pfade oder URLs über dieselbe Pipeline wie `openclaw message send` auf.
- Mehrere Medieneinträge werden, falls angegeben, sequenziell gesendet.

## Eingehende Medien zu Commands (Pi)

- Wenn eingehende Web-Nachrichten Medien enthalten, lädt OpenClaw diese in eine temporäre Datei herunter und stellt Templating-Variablen bereit:
  - `{{MediaUrl}}` Pseudo-URL für das eingehende Medium.
  - `{{MediaPath}}` lokaler temporärer Pfad, der vor Ausführung des Commands geschrieben wird.
- Wenn eine Docker-Sandbox pro Sitzung aktiviert ist, werden eingehende Medien in den Workspace der Sandbox kopiert und `MediaPath`/`MediaUrl` auf einen relativen Pfad wie `media/inbound/<filename>` umgeschrieben.
- Medienverständnis (falls konfiguriert über `tools.media.*` oder gemeinsam genutztes `tools.media.models`) läuft vor dem Templating und kann `[Image]`-, `[Audio]`- und `[Video]`-Blöcke in `Body` einfügen.
  - Audio setzt `{{Transcript}}` und verwendet das Transkript für das Command-Parsing, sodass Slash-Commands weiterhin funktionieren.
  - Video- und Bildbeschreibungen bewahren vorhandenen Bildunterschriftentext für das Command-Parsing.
- Standardmäßig wird nur der erste passende Bild-/Audio-/Video-Anhang verarbeitet; setzen Sie `tools.media.<cap>.attachments`, um mehrere Anhänge zu verarbeiten.

## Limits & Fehler

**Ausgehende Sendelimits (WhatsApp-Web-Send)**

- Bilder: ~6 MB Limit nach erneuter Komprimierung.
- Audio/Sprachnachricht/Video: 16 MB Limit; Dokumente: 100 MB Limit.
- Zu große oder nicht lesbare Medien → klarer Fehler in den Logs und die Antwort wird übersprungen.

**Limits für Medienverständnis (Transkription/Beschreibung)**

- Bild Standard: 10 MB (`tools.media.image.maxBytes`).
- Audio Standard: 20 MB (`tools.media.audio.maxBytes`).
- Video Standard: 50 MB (`tools.media.video.maxBytes`).
- Zu große Medien überspringen das Verständnis, Antworten werden jedoch weiterhin mit dem ursprünglichen Body gesendet.

## Hinweise für Tests

- Sende- und Antwortflüsse für Bild-/Audio-/Dokument-Fälle abdecken.
- Erneute Komprimierung für Bilder (Größenbegrenzung) und Sprachnachrichten-Flag für Audio validieren.
- Sicherstellen, dass Antworten mit mehreren Medien als sequenzielle Sends aufgefächert werden.
