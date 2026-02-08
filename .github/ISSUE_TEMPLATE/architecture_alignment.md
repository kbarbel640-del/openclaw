---
name: Architecture alignment
about: Capture current-state answers for Real Dispatch architecture and lock next commitments.
title: "[Alignment]: Control-plane vs data-plane status check"
labels: ["documentation", "enhancement"]
---

## How to use

Please answer inline with:

- exact file paths and links when possible
- short factual notes
- `not started yet` when missing

## Scope

Goal: map current repo reality against Real Dispatch target architecture (OpenClaw control plane + Dispatch data plane), and identify next irreversible commitments.

## 1) Product reality check

1. What is Real Dispatch's current north star in one sentence (operational outcome, not tech)?
2. What is the current MVP demo path we can run end-to-end today (exact steps)?
3. What's the first customer workflow we're optimizing for (doors/glass emergency service, scheduled installs, etc.)?

## 2) Control plane (OpenClaw reuse)

4. Which OpenClaw subsystems are we actively using in dev right now (gateway routing, cron, sessions, web UI, etc.)?
5. Where is message routing policy defined today (paths + how it's configured)?
6. What are the current DM pairing/allowlist defaults on each channel in dev/staging?

## 3) Tool gating + closed surface

7. What is the current tool policy strategy (what's allowed/denied)? Link to the enforcement points.
8. Are there any remaining escape hatches (shell, arbitrary HTTP fetch, filesystem reads/writes, browser control) enabled in dev?
9. What is the exact mechanism that prevents installing or running untrusted skills/plugins?

## 4) Data plane status

10. Do we have a `dispatch-api` service yet? If yes: where, what framework, what endpoints exist?
11. What is the current system-of-record for tickets/jobs (DB, files, memory, or none yet)?
12. Are we already persisting inbound/outbound messages? If yes: raw + normalized? Where?
13. Do we have an object store contract (MinIO/S3) for photos and generated PDFs?

## 5) State machine enforcement

14. Do we have a canonical `TicketState` enum today? Where?
15. Are state transitions enforced server-side, or is state implied in prompts/logs?
16. What transitions exist today, and which ones are soft (not validated)?
17. What's the plan for reschedule and cancel semantics?

## 6) Audit / eventing

18. Do we have an append-only `audit_events` table or event log today? If yes, schema + location.
19. What is our idempotency strategy for state-changing operations (request_id keys, dedupe rules)?
20. Can we replay a job timeline from persisted events right now? If not, what's missing?

## 7) Inbound normalization pipeline

21. Where do inbound messages land first (gateway -> what handler -> what store)?
22. How do we dedupe repeated inbound messages or retries from providers?
23. What is our ticket attach/create rule today (how do we decide new ticket vs existing)?
24. Are we storing message provenance (channel + peer + timestamp + raw payload)?

## 8) Testing + reliability

25. Do we have an e2e test that covers inbound -> ticket -> schedule -> onsite update -> closeout packet?
26. What are the top 3 flaky/unknown-risk areas right now?
27. What do we monitor in dev (logs, metrics, tracing) and what's the alert plan?

## 9) Security posture

28. What secrets management approach is used in dev (env vars, `.env`, vault, etc.)?
29. What network boundaries exist in `docker-compose` right now (internal-only, egress allowlist)?
30. What's our threat model statement (prompt injection, untrusted inbound, tool abuse) and where is it documented?

## 10) Decisions we should lock next

31. What contracts are already locked (tool I/O, schemas, state machine)? Where?
32. What's the next point-of-no-return decision we're about to make (DB schema, service boundaries, auth, etc.)?
33. If we could only complete one thing this week to de-risk the whole project, what should it be?

## Fill status

- [ ] Answered with repo paths/links
- [ ] Missing items explicitly marked `not started yet`
- [ ] Top 3 next actions proposed
