---
summary: "Wie die macOS-App Gesundheitszustände von Gateway/Baileys meldet"
read_when:
  - Debugging von Gesundheitsindikatoren der macOS-App
title: "Gesundheitschecks"
x-i18n:
  source_path: platforms/mac/health.md
  source_hash: 0560e96501ddf53a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:04Z
---

# Gesundheitschecks auf macOS

So sehen Sie in der Menüleisten-App, ob der verknüpfte Kanal gesund ist.

## Menüleiste

- Der Statuspunkt spiegelt nun den Baileys‑Gesundheitszustand wider:
  - Grün: verknüpft + Socket kürzlich geöffnet.
  - Orange: verbindet/versucht erneut.
  - Rot: abgemeldet oder Prüfung fehlgeschlagen.
- Die zweite Zeile zeigt „linked · auth 12m“ oder den Grund des Fehlers an.
- Der Menüpunkt „Health Check ausführen“ startet eine Prüfung auf Abruf.

## Einstellungen

- Der Reiter „Allgemein“ erhält eine Health‑Karte mit: Auth‑Alter (verknüpft), Sitzungsspeicher‑Pfad/-Anzahl, Zeitpunkt der letzten Prüfung, letzter Fehler/Statuscode sowie Schaltflächen für „Health Check ausführen“ / „Protokolle anzeigen“.
- Verwendet einen zwischengespeicherten Schnappschuss, sodass die UI sofort lädt und bei Offline‑Status elegant zurückfällt.
- **Reiter „Kanäle“** zeigt Kanalstatus + Steuerungen für WhatsApp/Telegram (Login‑QR, Abmelden, Prüfung, letzter Disconnect/Fehler).

## Wie die Prüfung funktioniert

- Die App führt `openclaw health --json` über `ShellExecutor` etwa alle ~60 s sowie auf Abruf aus. Die Prüfung lädt Anmeldedaten und meldet den Status, ohne Nachrichten zu senden.
- Der letzte gute Schnappschuss und der letzte Fehler werden getrennt gecacht, um Flackern zu vermeiden; der Zeitstempel jedes Eintrags wird angezeigt.

## Im Zweifel

- Sie können weiterhin den CLI‑Ablauf unter [Gateway health](/gateway/health) (`openclaw status`, `openclaw status --deep`, `openclaw health --json`) verwenden und `/tmp/openclaw/openclaw-*.log` für `web-heartbeat` / `web-reconnect` verfolgen.
