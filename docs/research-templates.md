# Research templates

This file provides starter templates for the Research Assistant (CLI + UI). Copy-paste a template or use `openclaw research --template <name>`.

## 1) Research Brief (one-pager)

# Title: <short, descriptive>

**Summary:** One-line summary of the change or investigation.

## Context

Short background and relevant links (issue, PR, repo path).

## Goal / Success metrics

- Primary goal: ...
- Success metrics: e.g. `95th p99 < 200ms`, `error-rate < 0.1%`

## Requirements (functional)

- MUST: ... (acceptance criteria)
- SHOULD: ...

## Constraints & Assumptions

- ...

## Risks & Mitigations

- Risk: ... → Mitigation: ...

## Next steps / Owner

- Owner: @someone
- Rollout plan (canary %, duration)

---

## 2) Design doc (detailed)

# Title

**Summary:**

## Context & Motivation

## Goals & Success metrics

## Non-goals

## Architecture (high-level)

- Component A — responsibility
- Component B — responsibility

## APIs / Data model

- `POST /v1/foo` request/response example

## Testing & Validation

- Unit, integration, e2e, performance

## Migration & Rollout

- Phase 1: ...

## Observability

- Metrics: name, unit, SLO

## Risks & Alternatives

## Open questions

---

## 3) Postmortem / Investigation

# Incident / Investigation Title

**Summary:** short summary and impact

## Timeline

## Root cause analysis

## Mitigation & Follow-ups

## Lessons learned

> Examples and more templates may be added. To suggest a new template, open a PR that edits this file.
