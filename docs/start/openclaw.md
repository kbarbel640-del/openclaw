---
summary: "End-to-end setup guide for Real Dispatch operations."
read_when:
  - Setting up a dispatch-focused deployment
  - Validating intake, scheduling, technician loop, and closeout workflow
title: "Dispatch Setup Guide"
---

# Dispatch Setup Guide

> This guide keeps the legacy path `/start/openclaw` for link compatibility.

Use this setup when you want Real Dispatch to operate as an always-on dispatch engine for a service company.

Architecture and migration rationale: [OpenClaw reuse plan](/concepts/openclaw-reuse-plan).

## Safety baseline

- closed toolset only
- no public skill marketplace
- no arbitrary shell or OS execution by default
- system-of-record case file required for all state transitions
- full audit trail for every state-changing action

## Prerequisites

- Node 22+
- running gateway control plane
- configured database and object storage for case files and attachments

## Quick bootstrap

<Steps>
  <Step title="Install dependencies">
    ```bash
    pnpm install
    ```
  </Step>
  <Step title="Build the workspace">
    ```bash
    pnpm build
    ```
  </Step>
  <Step title="Start local gateway for development">
    ```bash
    pnpm openclaw gateway --port 18789 --verbose
    ```
  </Step>
  <Step title="Open operator surface">
    ```bash
    pnpm openclaw dashboard
    ```
  </Step>
</Steps>

## Configure the dispatch lifecycle

Required lifecycle:

`new -> triaged -> schedulable -> scheduled -> dispatched -> onsite -> closeout_pending -> closed`

Do not allow direct transition to `closed` without closeout validation.

## Agent role boundaries

- **Intake Agent**: intake normalization and triage only
- **Scheduling Agent**: slotting, assignment, confirmation, reschedule
- **Technician Liaison Agent**: onsite communication and evidence capture
- **Closeout Agent**: closeout packet and invoice draft generation

Keep permissions role-scoped and explicit.

## Data requirements

Every job case file should include:

- customer identity and contact
- site/location details
- issue classification and urgency
- schedule and assignment history
- technician timeline updates
- attachments (photos, forms, notes)
- closeout checklist status
- invoice draft fields
- audit trail

## Operational checks

```bash
pnpm openclaw status --all
pnpm openclaw health --json
```

Before production rollout, verify:

- intake messages become structured tickets
- scheduling emits customer confirmation and assignment events
- onsite evidence is attached to case files
- closeout packet generation blocks when evidence is incomplete
- audit timeline is complete and attributable
