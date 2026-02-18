# Product Brief — OpenClaw Ted Profile (Mac)

**Generated:** 2026-02-17

---

## Problem

The operator’s deal/legal workflow currently requires too much manual effort:
- copying/pasting email context,
- missing deadlines buried in threads,
- inconsistent filing and documentation hygiene,
- high friction to run the assistant reliably after restarts.

---

## Users

- **Primary:** Single operator (private; not shared with team).
- **No secondary users** in scope.

---

## Key Outcomes

1. **Drafts in Outlook Drafts**
   - The system creates multiple drafts per day.
   - Operator reviews and sends manually.

2. **Meeting/time proposals without “auto-booking”**
   - The system proposes tentative holds.
   - Operator approves/apply (or sends invite manually).

3. **Deal work stays organized**
   - Filing suggestions (with approval gates).
   - Deadlines extracted into proposals and surfaced in a daily view.
   - Evidence linkage to deal/task when possible; otherwise triaged.

4. **Mac reliability**
   - Survives reboots.
   - Auto-starts and self-checks.

---

## Success Metrics

### 30-day metrics (minimum viable success)
- **Draft throughput:** ≥ 5 useful drafts/day (on business days).
- **Draft quality:** ≥ 50% sent with minimal edits (baseline), improving week-over-week.
- **Missed deadlines:** 0 deadlines missed due to “buried in inbox.”
- **Operational reliability:** auto-start works; no “manual restart” needed > 1×/week.

### 60–90 day (growth targets, not day‑1)
- **Draft quality:** ≥ 70–90% sent with no edits (depending on category).
- **Triage rate:** < 20%, trending down toward < 5%.
- **Approval latency:** median time-to-approval decreasing.

---

## Core User Journeys

### Journey A — Email Draft Loop (daily)
1. Operator messages OpenClaw: “Draft replies for my unread deal emails.”
2. System reads inbox candidates (no body-by-default).
3. System selects 3–10 items and drafts replies.
4. Drafts appear in Outlook Drafts folder.
5. Operator reviews/sends.

### Journey B — Filing Suggestions (batch)
1. Operator asks: “Suggest filing for today’s deal emails.”
2. System proposes suggested folders/tags/categories.
3. Operator approves suggestions in a batch view.
4. System applies filing actions (approval-gated).
5. Audit trail records each move/tag.

### Journey C — Deadlines → Holds (proposal → certify → apply)
1. Operator asks: “Extract deadlines from this thread.”
2. System proposes deadline candidates and tentative holds.
3. Operator certifies.
4. System applies *draft/tentative* holds to calendar (no invites sent).

### Journey D — Setup & Health
1. Operator installs app, opens Setup Wizard.
2. Configures Graph profiles (2 tenants).
3. Stores secrets in Keychain.
4. Runs Doctor; clears blockers.
5. Begins using chat surface.

---

## Constraints

- Local-first: sidecar reachable only over loopback.
- No autonomous outbound comms.
- Secrets never stored in plaintext files.
- Governance gates enforce approvals for risky writes.

