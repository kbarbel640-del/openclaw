---
summary: „Hochwertige Issues und Fehlerberichte einreichen“
title: „Einreichen eines Issues“
x-i18n:
  source_path: help/submitting-an-issue.md
  source_hash: bcb33f05647e9f0d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:50Z
---

## Einreichen eines Issues

Klare, prägnante Issues beschleunigen Diagnose und Behebung. Fügen Sie für Bugs, Regressionen oder Funktionslücken Folgendes bei:

### Was enthalten sein sollte

- [ ] Titel: Bereich & Symptom
- [ ] Minimale Reproduktionsschritte
- [ ] Erwartetes vs. tatsächliches Verhalten
- [ ] Auswirkung & Schweregrad
- [ ] Umgebung: Betriebssystem, Runtime, Versionen, Konfiguration
- [ ] Belege: redigierte Logs, Screenshots (keine personenbezogenen Daten)
- [ ] Umfang: neu, Regression oder seit Langem bestehend
- [ ] Codewort: lobster-biscuit im Issue
- [ ] Codebasis & GitHub nach bestehendem Issue durchsucht
- [ ] Bestätigt, dass nicht kürzlich behoben/angegangen (insb. Sicherheit)
- [ ] Behauptungen durch Belege oder Repro untermauert

Seien Sie kurz. Knappheit > perfekte Grammatik.

Validierung (vor PR ausführen/beheben):

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- Bei Protokollcode: `pnpm protocol:check`

### Vorlagen

#### Bug-Report

```md
- [ ] Minimal repro
- [ ] Expected vs actual
- [ ] Environment
- [ ] Affected channels, where not seen
- [ ] Logs/screenshots (redacted)
- [ ] Impact/severity
- [ ] Workarounds

### Summary

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact

### Workarounds
```

#### Sicherheitsproblem

```md
### Summary

### Impact

### Versions

### Repro Steps (safe to share)

### Mitigation/workaround

### Evidence (redacted)
```

_Vermeiden Sie Geheimnisse/Exploit-Details in der Öffentlichkeit. Bei sensiblen Themen Details minimieren und eine private Offenlegung anfordern._

#### Regressionsbericht

```md
### Summary

### Last Known Good

### First Known Bad

### Repro Steps

### Expected

### Actual

### Environment

### Logs/Evidence

### Impact
```

#### Feature-Anfrage

```md
### Summary

### Problem

### Proposed Solution

### Alternatives

### Impact

### Evidence/examples
```

#### Verbesserung

```md
### Summary

### Current vs Desired Behavior

### Rationale

### Alternatives

### Evidence/examples
```

#### Untersuchung

```md
### Summary

### Symptoms

### What Was Tried

### Environment

### Logs/Evidence

### Impact
```

### Einreichen eines Fix-PR

Ein Issue vor dem PR ist optional. Fügen Sie Details im PR hinzu, wenn Sie es überspringen. Halten Sie den PR fokussiert, vermerken Sie die Issue-Nummer, fügen Sie Tests hinzu oder erklären Sie deren Fehlen, dokumentieren Sie Verhaltensänderungen/Risiken, legen Sie redigierte Logs/Screenshots als Nachweis bei und führen Sie vor dem Einreichen die entsprechende Validierung aus.
