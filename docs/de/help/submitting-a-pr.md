---
summary: "Wie Sie einen PR mit hohem Signal einreichen"
title: "Einreichen eines PR"
x-i18n:
  source_path: help/submitting-a-pr.md
  source_hash: 277b0f51b948d1a9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:50Z
---

Gute PRs lassen sich leicht prüfen: Reviewer sollten die Absicht schnell erkennen, das Verhalten verifizieren und Änderungen sicher zusammenführen können. Dieser Leitfaden behandelt prägnante PRs mit hohem Signal für menschliche und LLM-Reviews.

## Was einen guten PR ausmacht

- [ ] Erklären Sie das Problem, warum es wichtig ist, und die Änderung.
- [ ] Halten Sie Änderungen fokussiert. Vermeiden Sie breit angelegte Refactorings.
- [ ] Fassen Sie nutzerseitige/konfigurationsbezogene/Standardänderungen zusammen.
- [ ] Listen Sie Testabdeckung, Überspringungen und Gründe auf.
- [ ] Fügen Sie Belege hinzu: Logs, Screenshots oder Aufzeichnungen (UI/UX).
- [ ] Codewort: Fügen Sie „lobster-biscuit“ in die PR-Beschreibung ein, wenn Sie diesen Leitfaden gelesen haben.
- [ ] Führen Sie relevante `pnpm`-Befehle aus bzw. beheben Sie Fehler, bevor Sie den PR erstellen.
- [ ] Durchsuchen Sie Codebasis und GitHub nach verwandter Funktionalität/Issues/Fixes.
- [ ] Stützen Sie Aussagen auf Belege oder Beobachtungen.
- [ ] Guter Titel: Verb + Umfang + Ergebnis (z. B. `Docs: add PR and issue templates`).

Seien Sie prägnant; prägnante Reviews > Grammatik. Lassen Sie nicht zutreffende Abschnitte weg.

### Basis-Validierungsbefehle (für Ihre Änderung ausführen/Fehler beheben)

- `pnpm lint`
- `pnpm check`
- `pnpm build`
- `pnpm test`
- Protokolländerungen: `pnpm protocol:check`

## Progressive Offenlegung

- Oben: Zusammenfassung/Absicht
- Danach: Änderungen/Risiken
- Danach: Tests/Verifikation
- Zuletzt: Implementierung/Belege

## Häufige PR-Typen: Besonderheiten

- [ ] Fix: Repro, Ursache und Verifikation hinzufügen.
- [ ] Feature: Anwendungsfälle, Verhalten/Demos/Screenshots (UI) hinzufügen.
- [ ] Refactor: „Keine Verhaltensänderung“ angeben, auflisten, was verschoben/vereinfacht wurde.
- [ ] Chore: Begründung angeben (z. B. Build-Zeit, CI, Abhängigkeiten).
- [ ] Docs: Vorher-/Nachher-Kontext, aktualisierte Seite verlinken, `pnpm format` ausführen.
- [ ] Test: Welche Lücke wird abgedeckt; wie Regressionen verhindert werden.
- [ ] Perf: Vorher-/Nachher-Metriken hinzufügen und Messmethode beschreiben.
- [ ] UX/UI: Screenshots/Video, Auswirkungen auf Barrierefreiheit vermerken.
- [ ] Infra/Build: Umgebungen/Validierung.
- [ ] Security: Risiko, Repro, Verifikation zusammenfassen, keine sensiblen Daten. Nur belegte Aussagen.

## Checkliste

- [ ] Klares Problem/klare Absicht
- [ ] Fokussierter Umfang
- [ ] Verhaltensänderungen aufgelistet
- [ ] Auflistung und Ergebnis der Tests
- [ ] Manuelle Testschritte (falls zutreffend)
- [ ] Keine Geheimnisse/privaten Daten
- [ ] Evidenzbasiert

## Allgemeine PR-Vorlage

```md
#### Summary

#### Behavior Changes

#### Codebase and GitHub Search

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort (self-reported):
- Agent notes (optional, cite evidence):
```

## PR-Typ-Vorlagen (durch Ihren Typ ersetzen)

### Fix

```md
#### Summary

#### Repro Steps

#### Root Cause

#### Behavior Changes

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Feature

```md
#### Summary

#### Use Cases

#### Behavior Changes

#### Existing Functionality Check

- [ ] I searched the codebase for existing functionality.
      Searches performed (1-3 bullets):
  -
  -

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Refactor

```md
#### Summary

#### Scope

#### No Behavior Change Statement

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Chore/Maintenance

```md
#### Summary

#### Why This Matters

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Docs

```md
#### Summary

#### Pages Updated

#### Before/After

#### Formatting

pnpm format

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Test

```md
#### Summary

#### Gap Covered

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Perf

```md
#### Summary

#### Baseline

#### After

#### Measurement Method

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### UX/UI

```md
#### Summary

#### Screenshots or Video

#### Accessibility Impact

#### Tests

#### Manual Testing

### Prerequisites

-

### Steps

1.
2. **Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Infra/Build

```md
#### Summary

#### Environments Affected

#### Validation Steps

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```

### Security

```md
#### Summary

#### Risk Summary

#### Repro Steps

#### Mitigation or Fix

#### Verification

#### Tests

#### Manual Testing (omit if N/A)

### Prerequisites

-

### Steps

1.
2.

#### Evidence (omit if N/A)

**Sign-Off**

- Models used:
- Submitter effort:
- Agent notes:
```
