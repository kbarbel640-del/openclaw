---
summary: "Erkundung: Modellkonfiguration, Authentifizierungsprofile und Fallback-Verhalten"
read_when:
  - Erkundung zukünftiger Ideen zur Modellauswahl + zu Authentifizierungsprofilen
title: "Erkundung der Modellkonfiguration"
x-i18n:
  source_path: experiments/proposals/model-config.md
  source_hash: 48623233d80f874c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:04:12Z
---

# Model Config (Erkundung)

Dieses Dokument sammelt **Ideen** für eine zukünftige Modellkonfiguration. Es ist keine
auslieferungsreife Spezifikation. Zum aktuellen Verhalten siehe:

- [Models](/concepts/models)
- [Model failover](/concepts/model-failover)
- [OAuth + profiles](/concepts/oauth)

## Motivation

Betreiber möchten:

- Mehrere Authentifizierungsprofile pro Anbieter (privat vs. Arbeit).
- Eine einfache `/model`-Auswahl mit vorhersehbaren Fallbacks.
- Eine klare Trennung zwischen Textmodellen und bildfähigen Modellen.

## Mögliche Richtung (auf hoher Ebene)

- Modellauswahl einfach halten: `provider/model` mit optionalen Aliasen.
- Anbietern mehrere Authentifizierungsprofile erlauben, mit einer expliziten Reihenfolge.
- Eine globale Fallback-Liste verwenden, damit alle Sitzungen konsistent failovern.
- Bild-Routing nur dann überschreiben, wenn es explizit konfiguriert ist.

## Offene Fragen

- Sollte die Profilrotation pro Anbieter oder pro Modell erfolgen?
- Wie sollte die UI die Profilauswahl für eine Sitzung darstellen?
- Was ist der sicherste Migrationspfad von älteren Konfigurationsschlüsseln?
