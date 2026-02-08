---
summary: "Get a local Real Dispatch environment running quickly."
read_when:
  - First-time setup
  - Validating control-plane and dispatch-data-plane separation
title: "Getting Started"
---

# Getting Started

Goal: run a local Real Dispatch environment with control-plane connectivity and dispatch-oriented docs in place.

## Prereqs

- Node 22 or newer
- pnpm

## Quick setup

<Steps>
  <Step title="Install dependencies">
    ```bash
    pnpm install
    ```
  </Step>
  <Step title="Build">
    ```bash
    pnpm build
    ```
  </Step>
  <Step title="Start the gateway control plane">
    ```bash
    pnpm openclaw gateway --port 18789 --verbose
    ```
  </Step>
  <Step title="Open the dashboard">
    ```bash
    pnpm openclaw dashboard
    ```
  </Step>
</Steps>

## What to verify first

- control plane is reachable
- intake and scheduling flows are represented as job lifecycle states
- actions are writing audit events
- closeout gates require evidence before completion

## Next steps

- Dispatch setup guide: [Dispatch Setup Guide](/start/openclaw)
- Product framing and glossary: [Real Dispatch](/)
- Migration architecture detail: [OpenClaw reuse plan](/concepts/openclaw-reuse-plan)
- Operational security controls: [Gateway security](/gateway/security)
