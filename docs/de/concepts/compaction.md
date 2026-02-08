---
summary: „Kontextfenster + Kompaktierung: wie OpenClaw Sitzungen unter Modellgrenzen hält“
read_when:
  - Sie möchten Auto-Kompaktierung und /compact verstehen
  - Sie debuggen lange Sitzungen, die Kontextgrenzen erreichen
title: „Kompaktierung“
x-i18n:
  source_path: concepts/compaction.md
  source_hash: e1d6791f2902044b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:03:55Z
---

# Kontextfenster & Kompaktierung

Jedes Modell hat ein **Kontextfenster** (maximale Token, die es sehen kann). Lang laufende Chats sammeln Nachrichten und Werkzeugergebnisse an; sobald das Fenster knapp wird, **kompaktiert** OpenClaw ältere Historie, um innerhalb der Grenzen zu bleiben.

## Was Kompaktierung ist

Kompaktierung **fasst ältere Konversationen zusammen** zu einem kompakten Zusammenfassungseintrag und hält aktuelle Nachrichten unverändert. Die Zusammenfassung wird im Sitzungsverlauf gespeichert, sodass zukünftige Anfragen Folgendes verwenden:

- Die Kompaktierungszusammenfassung
- Aktuelle Nachrichten nach dem Kompaktierungspunkt

Kompaktierung **persistiert** im JSONL-Verlauf der Sitzung.

## Konfiguration

Siehe [Kompaktierungskonfiguration & Modi](/concepts/compaction) für die `agents.defaults.compaction`-Einstellungen.

## Auto-Kompaktierung (standardmäßig aktiv)

Wenn sich eine Sitzung dem Kontextfenster des Modells nähert oder es überschreitet, löst OpenClaw die Auto-Kompaktierung aus und kann die ursprüngliche Anfrage mit dem kompaktierten Kontext erneut versuchen.

Sie sehen:

- `🧹 Auto-compaction complete` im ausführlichen Modus
- `/status`, das `🧹 Compactions: <count>` anzeigt

Vor der Kompaktierung kann OpenClaw einen **stillen Memory-Flush**-Durchlauf ausführen, um
dauerhafte Notizen auf die Festplatte zu schreiben. Siehe [Memory](/concepts/memory) für Details und Konfiguration.

## Manuelle Kompaktierung

Verwenden Sie `/compact` (optional mit Anweisungen), um einen Kompaktierungsdurchlauf zu erzwingen:

```
/compact Focus on decisions and open questions
```

## Quelle des Kontextfensters

Das Kontextfenster ist modellspezifisch. OpenClaw verwendet die Modelldefinition aus dem konfigurierten Anbieter-Katalog, um die Grenzen zu bestimmen.

## Kompaktierung vs. Pruning

- **Kompaktierung**: fasst zusammen und **persistiert** in JSONL.
- **Sitzungs-Pruning**: kürzt nur alte **Werkzeugergebnisse**, **im Speicher**, pro Anfrage.

Siehe [/concepts/session-pruning](/concepts/session-pruning) fuer Details zum Pruning.

## Tipps

- Verwenden Sie `/compact`, wenn sich Sitzungen abgestanden anfühlen oder der Kontext aufgebläht ist.
- Große Werkzeugausgaben werden bereits gekürzt; Pruning kann den Aufbau von Werkzeugergebnissen weiter reduzieren.
- Wenn Sie einen Neuanfang benötigen, starten `/new` oder `/reset` eine neue Sitzungs-ID.
