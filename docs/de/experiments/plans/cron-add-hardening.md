---
summary: "Härtung der Eingabeverarbeitung für cron.add, Abgleich der Schemas und Verbesserung der Cron-UI-/Agent-Tools"
owner: "openclaw"
status: "complete"
last_updated: "2026-01-05"
title: "Härtung von Cron Add"
x-i18n:
  source_path: experiments/plans/cron-add-hardening.md
  source_hash: d7e469674bd9435b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:17Z
---

# Härtung von Cron Add & Schema-Abgleich

## Kontext

Aktuelle Gateway-Logs zeigen wiederholte `cron.add`-Fehler mit ungültigen Parametern (fehlende `sessionTarget`, `wakeMode`, `payload` sowie fehlerhaftes `schedule`). Dies deutet darauf hin, dass mindestens ein Client (wahrscheinlich der Agent-Tool-Aufrufpfad) umschlossene oder nur teilweise spezifizierte Job-Payloads sendet. Separat gibt es Abweichungen zwischen Cron-Provider-Enums in TypeScript, dem Gateway-Schema, CLI-Flags und UI-Formulartypen sowie eine UI-Abweichung für `cron.status` (erwartet `jobCount`, während das Gateway `jobs` zurückgibt).

## Ziele

- `cron.add`-INVALID_REQUEST-Spam stoppen, indem gängige Wrapper-Payloads normalisiert und fehlende `kind`-Felder abgeleitet werden.
- Cron-Provider-Listen über Gateway-Schema, Cron-Typen, CLI-Dokumentation und UI-Formulare hinweg abgleichen.
- Das Schema des Agent-Cron-Tools explizit machen, damit das LLM korrekte Job-Payloads erzeugt.
- Die Anzeige der Jobanzahl im Cron-Status der Control UI korrigieren.
- Tests hinzufügen, die Normalisierung und Tool-Verhalten abdecken.

## Nicht-Ziele

- Änderung der Cron-Planungssemantik oder des Job-Ausführungsverhaltens.
- Hinzufügen neuer Planungsarten oder Cron-Ausdrucks-Parsing.
- Überarbeitung der UI/UX für Cron über die notwendigen Feldkorrekturen hinaus.

## Erkenntnisse (aktuelle Lücken)

- `CronPayloadSchema` im Gateway schließt `signal` + `imessage` aus, während TS-Typen diese enthalten.
- Control UI CronStatus erwartet `jobCount`, das Gateway gibt jedoch `jobs` zurück.
- Das Schema des Agent-Cron-Tools erlaubt beliebige `job`-Objekte und ermöglicht dadurch fehlerhafte Eingaben.
- Das Gateway validiert `cron.add` strikt ohne Normalisierung, sodass umschlossene Payloads fehlschlagen.

## Was sich geändert hat

- `cron.add` und `cron.update` normalisieren nun gängige Wrapper-Formen und leiten fehlende `kind`-Felder ab.
- Das Schema des Agent-Cron-Tools entspricht dem Gateway-Schema, wodurch ungültige Payloads reduziert werden.
- Provider-Enums sind über Gateway, CLI, UI und macOS-Picker hinweg abgestimmt.
- Die Control UI verwendet für den Status die vom Gateway gelieferte Zählvariable `jobs`.

## Aktuelles Verhalten

- **Normalisierung:** umschlossene `data`/`job`-Payloads werden entpackt; `schedule.kind` und `payload.kind` werden bei Sicherheit abgeleitet.
- **Standardwerte:** sichere Standardwerte werden für `wakeMode` und `sessionTarget` angewendet, wenn sie fehlen.
- **Provider:** Discord/Slack/Signal/iMessage werden nun konsistent über CLI/UI hinweg angezeigt.

Siehe [Cron jobs](/automation/cron-jobs) für die normalisierte Form und Beispiele.

## Verifikation

- Gateway-Logs auf reduzierte `cron.add`-INVALID_REQUEST-Fehler beobachten.
- Bestätigen, dass die Control UI nach dem Aktualisieren die Jobanzahl im Cron-Status anzeigt.

## Optionale Nacharbeiten

- Manueller Control-UI-Smoke-Test: einen Cron-Job pro Provider hinzufügen und die Status-Jobanzahl verifizieren.

## Offene Fragen

- Sollte `cron.add` explizites `state` von Clients akzeptieren (derzeit durch das Schema nicht erlaubt)?
- Sollten wir `webchat` als expliziten Delivery-Provider zulassen (derzeit in der Delivery-Auflösung gefiltert)?
