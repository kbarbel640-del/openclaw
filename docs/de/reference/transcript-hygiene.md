---
summary: „Referenz: anbieterspezifische Regeln zur Transkript-Bereinigung und -Reparatur“
read_when:
  - Sie debuggen Anbieter-Ablehnungen von Anfragen, die mit der Transkript-Struktur zusammenhängen
  - Sie ändern die Transkript-Bereinigung oder die Logik zur Reparatur von Tool-Calls
  - Sie untersuchen Tool-Call-ID-Fehlzuordnungen zwischen Anbietern
title: „Transkript-Hygiene“
x-i18n:
  source_path: reference/transcript-hygiene.md
  source_hash: 43ed460827d514a8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:34Z
---

# Transkript-Hygiene (Provider-Fixups)

Dieses Dokument beschreibt **anbieterspezifische Korrekturen**, die auf Transkripte angewendet werden, bevor ein Run ausgeführt wird
(Aufbau des Modellkontexts). Dabei handelt es sich um **In-Memory**-Anpassungen, die verwendet werden, um strenge
Anbieteranforderungen zu erfüllen. Diese Hygieneschritte schreiben das gespeicherte JSONL-Transkript auf der
Festplatte **nicht** um; allerdings kann ein separater Reparaturdurchlauf für Sitzungsdateien fehlerhafte JSONL-Dateien
neu schreiben, indem ungültige Zeilen verworfen werden, bevor die Sitzung geladen wird. Wenn eine Reparatur erfolgt,
wird die Originaldatei zusammen mit der Sitzungsdatei gesichert.

Der Umfang umfasst:

- Bereinigung von Tool-Call-IDs
- Validierung von Tool-Call-Eingaben
- Reparatur der Tool-Ergebnis-Zuordnung
- Turn-Validierung / -Reihenfolge
- Bereinigung von Thought-Signaturen
- Bereinigung von Bild-Payloads

Wenn Sie Details zur Transkript-Speicherung benötigen, siehe:

- [/reference/session-management-compaction](/reference/session-management-compaction)

---

## Wo dies ausgeführt wird

Die gesamte Transkript-Hygiene ist im eingebetteten Runner zentralisiert:

- Richtlinienauswahl: `src/agents/transcript-policy.ts`
- Anwendung von Bereinigung/Reparatur: `sanitizeSessionHistory` in `src/agents/pi-embedded-runner/google.ts`

Die Richtlinie verwendet `provider`, `modelApi` und `modelId`, um zu entscheiden, was angewendet wird.

Getrennt von der Transkript-Hygiene werden Sitzungsdateien (falls erforderlich) vor dem Laden repariert:

- `repairSessionFileIfNeeded` in `src/agents/session-file-repair.ts`
- Aufgerufen von `run/attempt.ts` und `compact.ts` (eingebetteter Runner)

---

## Globale Regel: Bild-Bereinigung

Bild-Payloads werden immer bereinigt, um eine Ablehnung auf Anbieterseite aufgrund von Größen-
limits zu verhindern (Herunterskalieren/Neu-Komprimieren übergroßer Base64-Bilder).

Implementierung:

- `sanitizeSessionMessagesImages` in `src/agents/pi-embedded-helpers/images.ts`
- `sanitizeContentBlocksImages` in `src/agents/tool-images.ts`

---

## Globale Regel: fehlerhafte Tool-Calls

Assistant-Tool-Call-Blöcke, denen sowohl `input` als auch `arguments` fehlen, werden verworfen,
bevor der Modellkontext aufgebaut wird. Dies verhindert Anbieter-Ablehnungen durch teilweise
persistierte Tool-Calls (zum Beispiel nach einem Rate-Limit-Fehler).

Implementierung:

- `sanitizeToolCallInputs` in `src/agents/session-transcript-repair.ts`
- Angewendet in `sanitizeSessionHistory` in `src/agents/pi-embedded-runner/google.ts`

---

## Anbieter-Matrix (aktuelles Verhalten)

**OpenAI / OpenAI Codex**

- Nur Bild-Bereinigung.
- Beim Modellwechsel zu OpenAI Responses/Codex werden verwaiste Reasoning-Signaturen verworfen (eigenständige Reasoning-Elemente ohne nachfolgenden Content-Block).
- Keine Bereinigung von Tool-Call-IDs.
- Keine Reparatur der Tool-Ergebnis-Zuordnung.
- Keine Turn-Validierung oder -Neuordnung.
- Keine synthetischen Tool-Ergebnisse.
- Kein Entfernen von Thought-Signaturen.

**Google (Generative AI / Gemini CLI / Antigravity)**

- Bereinigung von Tool-Call-IDs: strikt alphanumerisch.
- Reparatur der Tool-Ergebnis-Zuordnung und synthetische Tool-Ergebnisse.
- Turn-Validierung (Gemini-artige Turn-Alternierung).
- Google-Turn-Reihenfolge-Fixup (Voranstellen eines winzigen User-Bootstraps, wenn der Verlauf mit dem Assistant beginnt).
- Antigravity Claude: Normalisierung von Thinking-Signaturen; Verwerfen nicht signierter Thinking-Blöcke.

**Anthropic / Minimax (Anthropic-kompatibel)**

- Reparatur der Tool-Ergebnis-Zuordnung und synthetische Tool-Ergebnisse.
- Turn-Validierung (Zusammenführen aufeinanderfolgender User-Turns, um strikte Alternierung zu erfüllen).

**Mistral (einschließlich modell-id-basierter Erkennung)**

- Bereinigung von Tool-Call-IDs: strict9 (alphanumerische Länge 9).

**OpenRouter Gemini**

- Bereinigung von Thought-Signaturen: Entfernen nicht-base64-`thought_signature`-Werte (Base64 bleibt erhalten).

**Alles andere**

- Nur Bild-Bereinigung.

---

## Historisches Verhalten (vor 2026.1.22)

Vor dem Release 2026.1.22 wendete OpenClaw mehrere Ebenen der Transkript-Hygiene an:

- Eine **transcript-sanitize-Erweiterung** lief bei jedem Kontextaufbau und konnte:
  - Tool-Nutzungs-/Ergebnis-Zuordnungen reparieren.
  - Tool-Call-IDs bereinigen (einschließlich eines nicht-strikten Modus, der `_`/`-` beibehielt).
- Der Runner führte ebenfalls anbieterspezifische Bereinigung durch, was Arbeit duplizierte.
- Zusätzliche Mutationen erfolgten außerhalb der Anbieter-Richtlinie, einschließlich:
  - Entfernen von `<final>`-Tags aus Assistant-Text vor der Persistierung.
  - Verwerfen leerer Assistant-Fehler-Turns.
  - Kürzen von Assistant-Inhalten nach Tool-Calls.

Diese Komplexität verursachte anbieterübergreifende Regressionen (insbesondere bei der
`openai-responses`
`call_id|fc_id`-Zuordnung). Die Bereinigung in 2026.1.22 entfernte die Erweiterung, zentralisierte
die Logik im Runner und machte OpenAI **no-touch** über die Bild-Bereinigung hinaus.
