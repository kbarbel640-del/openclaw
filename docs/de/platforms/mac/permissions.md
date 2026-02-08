---
summary: "Persistenz von macOS-Berechtigungen (TCC) und Signieranforderungen"
read_when:
  - Debuggen fehlender oder blockierter macOS-Berechtigungsabfragen
  - Verpacken oder Signieren der macOS-App
  - Ändern von Bundle-IDs oder App-Installationspfaden
title: "macOS-Berechtigungen"
x-i18n:
  source_path: platforms/mac/permissions.md
  source_hash: d012589c0583dd0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:01Z
---

# macOS-Berechtigungen (TCC)

macOS-Berechtigungsfreigaben sind fragil. TCC verknüpft eine Berechtigungsfreigabe mit der
Codesignatur der App, der Bundle-ID und dem Pfad auf dem Datenträger. Wenn sich einer dieser
Punkte ändert, behandelt macOS die App als neu und kann Abfragen verwerfen oder ausblenden.

## Anforderungen für stabile Berechtigungen

- Gleicher Pfad: Führen Sie die App von einem festen Speicherort aus (für OpenClaw, `dist/OpenClaw.app`).
- Gleiche Bundle-ID: Das Ändern der Bundle-ID erstellt eine neue Berechtigungsidentität.
- Signierte App: Unsigned- oder ad-hoc-signierte Builds behalten Berechtigungen nicht bei.
- Konsistente Signatur: Verwenden Sie ein echtes Apple-Development- oder Developer-ID-Zertifikat,
  damit die Signatur über Neubuilds hinweg stabil bleibt.

Ad-hoc-Signaturen erzeugen bei jedem Build eine neue Identität. macOS vergisst frühere
Freigaben, und Abfragen können vollständig verschwinden, bis die veralteten Einträge
bereinigt werden.

## Wiederherstellungs-Checkliste, wenn Abfragen verschwinden

1. Beenden Sie die App.
2. Entfernen Sie den App-Eintrag in „Systemeinstellungen -> Datenschutz & Sicherheit“.
3. Starten Sie die App vom selben Pfad erneut und erteilen Sie die Berechtigungen erneut.
4. Wenn die Abfrage weiterhin nicht erscheint, setzen Sie die TCC-Einträge mit `tccutil` zurück und versuchen Sie es erneut.
5. Einige Berechtigungen erscheinen erst nach einem vollständigen macOS-Neustart wieder.

Beispiel-Resets (ersetzen Sie die Bundle-ID nach Bedarf):

```bash
sudo tccutil reset Accessibility bot.molt.mac
sudo tccutil reset ScreenCapture bot.molt.mac
sudo tccutil reset AppleEvents
```

Wenn Sie Berechtigungen testen, signieren Sie immer mit einem echten Zertifikat. Ad-hoc-
Builds sind nur für kurze lokale Läufe akzeptabel, bei denen Berechtigungen keine Rolle spielen.
