---
summary: "Mehrdatei-Patches mit dem apply_patch-Werkzeug anwenden"
read_when:
  - Sie benötigen strukturierte Dateiänderungen über mehrere Dateien hinweg
  - Sie möchten patchbasierte Änderungen dokumentieren oder debuggen
title: "apply_patch-Werkzeug"
x-i18n:
  source_path: tools/apply-patch.md
  source_hash: 8cec2b4ee3afa910
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:39Z
---

# apply_patch tool

Wenden Sie Dateiänderungen mit einem strukturierten Patch-Format an. Dies ist ideal für Mehrdatei-
oder Mehr-Hunk-Änderungen, bei denen ein einzelner `edit`-Aufruf fragil wäre.

Das Werkzeug akzeptiert eine einzelne `input`-Zeichenkette, die eine oder mehrere Dateioperationen kapselt:

```
*** Begin Patch
*** Add File: path/to/file.txt
+line 1
+line 2
*** Update File: src/app.ts
@@
-old line
+new line
*** Delete File: obsolete.txt
*** End Patch
```

## Parameter

- `input` (erforderlich): Vollständiger Patch-Inhalt einschließlich `*** Begin Patch` und `*** End Patch`.

## Hinweise

- Pfade werden relativ zum Workspace-Stammverzeichnis aufgelöst.
- Verwenden Sie `*** Move to:` innerhalb eines `*** Update File:`-Hunks, um Dateien umzubenennen.
- `*** End of File` kennzeichnet bei Bedarf eine reine EOF-Einfügung.
- Experimentell und standardmäßig deaktiviert. Aktivieren Sie es mit `tools.exec.applyPatch.enabled`.
- Nur für OpenAI (einschließlich OpenAI Codex). Optional per Modell über
  `tools.exec.applyPatch.allowModels` einschränken.
- Die Konfiguration befindet sich ausschließlich unter `tools.exec`.

## Beispiel

```json
{
  "tool": "apply_patch",
  "input": "*** Begin Patch\n*** Update File: src/index.ts\n@@\n-const foo = 1\n+const foo = 2\n*** End Patch"
}
```
