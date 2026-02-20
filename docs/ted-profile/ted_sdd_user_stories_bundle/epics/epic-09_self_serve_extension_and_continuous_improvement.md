---
id: EPIC-09
title: Self-Serve Extension and Continuous Improvement
default_job_family: GOV
created: 2026-02-19
status: Proposed
---

## Intent

Allow controlled self-serve changes via skills/rules and track improvement using metrics.
Treat "bots" as governed role/skill profiles that can improve over time without becoming uncontrolled autonomous services.

## Scope (plain English)

Describe user-visible outcomes; avoid prescribing a specific API shape.

## Hard constraints (apply to all stories unless explicitly re-scoped)

- Draft-only for outbound communication and calendar invites.
- Single-operator posture by default; no team-wide access.
- Secrets never stored in plaintext files; use keychain/vault references.
- Full auditability with redaction before persistence.
