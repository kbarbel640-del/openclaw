---
summary: „Sprachaktivierung und Push-to-Talk-Modi sowie Routing-Details in der mac-App“
read_when:
  - Arbeiten an Sprachaktivierungs- oder PTT-Pfaden
title: „Sprachaktivierung“
x-i18n:
  source_path: platforms/mac/voicewake.md
  source_hash: f6440bb89f349ba5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:11Z
---

# Sprachaktivierung & Push-to-Talk

## Modi

- **Wake-Word-Modus** (Standard): Ein ständig aktiver Spracherkenner wartet auf Auslöser-Tokens (`swabbleTriggerWords`). Bei Treffer startet er die Aufnahme, zeigt das Overlay mit Teiltext an und sendet nach Stille automatisch.
- **Push-to-Talk (rechte Option halten)**: Halten Sie die rechte Option-Taste, um sofort aufzunehmen—kein Auslöser nötig. Das Overlay erscheint während des Haltens; beim Loslassen wird finalisiert und nach einer kurzen Verzögerung weitergeleitet, sodass Sie Text noch anpassen können.

## Laufzeitverhalten (Wake-Word)

- Der Spracherkenner lebt in `VoiceWakeRuntime`.
- Der Trigger feuert nur, wenn es eine **bedeutungsvolle Pause** zwischen dem Wake-Word und dem nächsten Wort gibt (~0,55 s Abstand). Overlay/Signalton können bereits bei der Pause starten, noch bevor der Befehl beginnt.
- Stillefenster: 2,0 s bei fließender Sprache, 5,0 s, wenn nur der Trigger gehört wurde.
- Harter Stopp: 120 s zur Vermeidung ausufernder Sitzungen.
- Entprellung zwischen Sitzungen: 350 ms.
- Das Overlay wird über `VoiceWakeOverlayController` mit Farbgebung für bestätigte/volatile Inhalte gesteuert.
- Nach dem Senden startet der Erkenner sauber neu, um auf den nächsten Trigger zu hören.

## Lebenszyklus-Invarianten

- Wenn Sprachaktivierung aktiviert ist und Berechtigungen erteilt sind, sollte der Wake-Word-Erkenner zuhören (außer während einer expliziten Push-to-Talk-Aufnahme).
- Die Sichtbarkeit des Overlays (einschließlich manuellem Schließen über die X-Taste) darf das Wiederaufnehmen des Erkenners niemals verhindern.

## Fehlerbild „klebendes Overlay“ (früher)

Zuvor konnte es passieren, dass bei einem sichtbar hängen gebliebenen Overlay und manuellem Schließen die Sprachaktivierung „tot“ wirkte, weil der Neustartversuch der Laufzeit durch die Overlay-Sichtbarkeit blockiert wurde und kein weiterer Neustart geplant war.

Härtung:

- Der Neustart der Wake-Laufzeit wird nicht mehr durch die Overlay-Sichtbarkeit blockiert.
- Das Abschließen des Overlay-Schließens triggert ein `VoiceWakeRuntime.refresh(...)` über `VoiceSessionCoordinator`, sodass ein manuelles X-Schließen das Zuhören immer fortsetzt.

## Push-to-Talk-Spezifika

- Die Hotkey-Erkennung nutzt einen globalen `.flagsChanged`-Monitor für **rechte Option** (`keyCode 61` + `.option`). Ereignisse werden nur beobachtet (kein Abfangen).
- Die Aufnahmepipeline lebt in `VoicePushToTalk`: startet Speech sofort, streamt Teiltexte ins Overlay und ruft `VoiceWakeForwarder` beim Loslassen auf.
- Beim Start von Push-to-Talk pausieren wir die Wake-Word-Laufzeit, um konkurrierende Audio-Taps zu vermeiden; sie startet nach dem Loslassen automatisch neu.
- Berechtigungen: Erfordert Mikrofon + Speech; zum Sehen von Ereignissen ist die Freigabe für Bedienungshilfen/Eingabemonitoring nötig.
- Externe Tastaturen: Manche stellen die rechte Option nicht wie erwartet bereit—bieten Sie einen Fallback-Shortcut an, wenn Nutzer Aussetzer melden.

## Benutzerseitige Einstellungen

- **Sprachaktivierung**-Schalter: aktiviert die Wake-Word-Laufzeit.
- **Cmd+Fn halten zum Sprechen**: aktiviert den Push-to-Talk-Monitor. Deaktiviert unter macOS < 26.
- Sprach- & Mikrofon-Auswahl, Live-Pegelanzeige, Triggerwort-Tabelle, Tester (nur lokal; leitet nicht weiter).
- Die Mikrofon-Auswahl behält die letzte Auswahl bei, wenn ein Gerät getrennt wird, zeigt einen Hinweis „getrennt“ an und fällt vorübergehend auf den Systemstandard zurück, bis es wieder verfügbar ist.
- **Sounds**: Signaltöne bei Trigger-Erkennung und beim Senden; Standard ist der macOS-Systemsound „Glass“. Sie können für jedes Ereignis eine beliebige von `NSSound` ladbare Datei (z. B. MP3/WAV/AIFF) wählen oder **Kein Sound** auswählen.

## Weiterleitungsverhalten

- Wenn Sprachaktivierung aktiviert ist, werden Transkripte an das aktive Gateway/den Agenten weitergeleitet (derselbe lokale vs. Remote-Modus wie im restlichen Teil der mac-App).
- Antworten werden an den **zuletzt verwendeten Hauptanbieter** (WhatsApp/Telegram/Discord/WebChat) zugestellt. Schlägt die Zustellung fehl, wird der Fehler protokolliert und der Lauf ist weiterhin über WebChat/Sitzungsprotokolle sichtbar.

## Weiterleitungs-Payload

- `VoiceWakeForwarder.prefixedTranscript(_:)` stellt den Maschinenhinweis vor dem Senden voran. Wird zwischen Wake-Word- und Push-to-Talk-Pfaden geteilt.

## Schnelle Überprüfung

- Push-to-Talk einschalten, Cmd+Fn halten, sprechen, loslassen: Das Overlay sollte Teiltexte anzeigen und dann senden.
- Während des Haltens sollten die Menüleisten-Ohren vergrößert bleiben (nutzt `triggerVoiceEars(ttl:nil)`); nach dem Loslassen fallen sie zurück.
